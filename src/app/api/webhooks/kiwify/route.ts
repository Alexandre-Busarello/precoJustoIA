import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeWrite } from '@/lib/prisma-wrapper'
import { WebhookProcessor } from '@/lib/webhook-processor'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * Valida a assinatura do webhook do Kiwify usando HMAC SHA1
 * 
 * A validação segue a fórmula: signature = hmac_sha1(JSON.stringify(request.body), secretKey)
 * O signature vem na querystring e o secretKey é o token do webhook configurado no painel
 */
function validateKiwifySignature(bodyText: string, signature: string | null, secretKey: string): boolean {
  if (!signature || !secretKey) {
    return false
  }

  const calculatedSignature = crypto
    .createHmac('sha1', secretKey)
    .update(bodyText)
    .digest('hex')

  return calculatedSignature === signature
}

/**
 * Verifica se o evento deve ser processado (incluído na fila)
 * Apenas eventos que temos tratamento específico são incluídos na fila
 */
function shouldProcessEvent(webhookEventType: string | null): boolean {
  if (!webhookEventType) {
    return false
  }

  const processedEvents = [
    'order_approved',
    'order_refunded',
    'chargeback',
    'subscription_canceled',
    'subscription_renewed',
    'subscription_late',
  ]

  return processedEvents.includes(webhookEventType)
}

/**
 * Webhook do Kiwify para processar compras confirmadas
 * 
 * Formato do webhook do Kiwify:
 * - O evento vem em webhook_event_type
 * - Os dados do cliente estão em Customer (Customer.email, Customer.full_name)
 * - Os dados da subscription estão em Subscription (Subscription.id, Subscription.next_payment)
 * - O order_id está em order_id
 * - A validação usa signature na querystring com HMAC SHA1
 * 
 * Eventos suportados:
 * - order_approved: Compra aprovada (ativa premium)
 * - order_refunded: Reembolso (remove premium)
 * - chargeback: Chargeback (remove premium)
 * - subscription_canceled: Assinatura cancelada (remove premium)
 * - subscription_renewed: Assinatura renovada (renova premium)
 * - subscription_late: Assinatura atrasada (pode manter ou remover premium)
 * 
 * IMPORTANTE: 
 * - O email é sempre a chave entre Kiwify e a aplicação
 * - Configure KIWIFY_WEBHOOK_SECRET nas variáveis de ambiente com o token do painel
 */
export async function POST(request: NextRequest) {
  try {
    // Em desenvolvimento, permitir bypass se ALLOW_TEST_WEBHOOK estiver configurado
    const isTestMode = process.env.NODE_ENV === 'development' && process.env.ALLOW_TEST_WEBHOOK === 'true'
    
    // Ler o body como texto primeiro (precisamos do texto bruto para validação)
    const bodyText = await request.text()

    // Parsear o JSON
    let body: any
    try {
      body = JSON.parse(bodyText)
    } catch (parseError) {
      console.error('❌ Error parsing webhook body as JSON:', parseError)
      console.error('Raw body received:', bodyText)
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    console.log('🔗 Kiwify webhook received:', {
      webhook_event_type: body.webhook_event_type,
      order_status: body.order_status,
      order_id: body.order_id,
      customer_email: body.Customer?.email,
    })

    // Validar assinatura do webhook usando HMAC SHA1
    // O signature vem na querystring: ?signature=xxx
    // A fórmula é: signature = hmac_sha1(JSON.stringify(request.body), secretKey)
    if (!isTestMode) {
      const webhookToken = process.env.KIWIFY_WEBHOOK_SECRET
      const { searchParams } = new URL(request.url)
      const signature = searchParams.get('signature')

      if (webhookToken) {
        if (!signature) {
          console.error('❌ Missing signature in querystring')
          return NextResponse.json(
            { error: 'Assinatura não encontrada' },
            { status: 401 }
          )
        }

        const isValid = validateKiwifySignature(bodyText, signature, webhookToken)
        if (!isValid) {
          console.error('❌ Invalid webhook signature. Expected signature from HMAC SHA1 of body with token')
          return NextResponse.json(
            { error: 'Assinatura inválida' },
            { status: 401 }
          )
        }

        console.log('✅ Webhook signature validated successfully')
      } else {
        console.warn('⚠️ KIWIFY_WEBHOOK_SECRET not configured. Skipping signature validation.')
      }
    }

    // O Kiwify envia o evento em webhook_event_type
    const webhookEventType = body.webhook_event_type
    
    // Validar que temos um evento
    if (!webhookEventType) {
      // Carrinho abandonado não tem webhook_event_type, podemos ignorar
      console.log('⚠️ Webhook sem webhook_event_type recebido (possivelmente carrinho abandonado)')
      return NextResponse.json({
        success: true,
        message: 'Evento não processado (carrinho abandonado ou evento desconhecido)',
      })
    }

    // Verificar se devemos processar este evento
    const shouldProcess = shouldProcessEvent(webhookEventType)
    
    if (!shouldProcess) {
      // Eventos não processados (billet_created, pix_created, order_rejected) não vão para a fila
      console.log('⚠️ Evento não processado, ignorando:', webhookEventType)
      return NextResponse.json({
        success: true,
        message: 'Evento recebido mas não processado',
        webhook_event_type: webhookEventType,
      })
    }

    // Extrair informações para a fila
    const orderId = body.order_id || null
    const customerEmail = body.Customer?.email || null

    // Salvar evento no banco com status PENDING
    let webhookEventId: string
    try {
      const savedEvent = await safeWrite(
        'save-kiwify-webhook-event',
        () => prisma.webhookEvent.create({
          data: {
            provider: 'KIWIFY',
            eventId: orderId || undefined,
            eventType: webhookEventType,
            status: 'PENDING',
            rawData: body,
            processedData: {
              customerEmail,
              orderId,
              eventType: webhookEventType,
            },
            externalReference: orderId || undefined,
          },
        }),
        ['webhook_events']
      )
      webhookEventId = savedEvent.id
      console.log(`💾 Webhook event saved with ID: ${webhookEventId}`)
    } catch (error) {
      console.error('❌ Failed to save webhook event:', error)
      // Continuar mesmo se falhar ao salvar (não bloquear o webhook)
      webhookEventId = ''
    }

    // Processar evento
    let success = false
    let errorMessage: string | null = null

    try {
      // Atualizar status para PROCESSING
      if (webhookEventId) {
        await safeWrite(
          'update-kiwify-webhook-status-processing',
          () => prisma.webhookEvent.update({
            where: { id: webhookEventId },
            data: { 
              status: 'PROCESSING',
              lastProcessedAt: new Date(),
            },
          }),
          ['webhook_events']
        )
      }

      // Processar usando o WebhookProcessor
      success = await WebhookProcessor.processKiwifyEvent({
        eventType: webhookEventType,
        rawData: body,
      })

      // Atualizar status baseado no resultado
      if (webhookEventId) {
        await safeWrite(
          'update-kiwify-webhook-status-result',
          () => prisma.webhookEvent.update({
            where: { id: webhookEventId },
            data: {
              status: success ? 'DONE' : 'FAILED',
              processedAt: success ? new Date() : undefined,
              lastProcessedAt: new Date(),
              errorMessage: success ? null : 'Processing failed',
              retryCount: { increment: 1 },
            },
          }),
          ['webhook_events']
        )
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Error processing webhook:', error)
      
      // Atualizar status para FAILED
      if (webhookEventId) {
        try {
          await safeWrite(
            'update-kiwify-webhook-status-failed',
            () => prisma.webhookEvent.update({
              where: { id: webhookEventId },
              data: {
                status: 'FAILED',
                lastProcessedAt: new Date(),
                errorMessage,
                retryCount: { increment: 1 },
              },
            }),
            ['webhook_events']
          )
        } catch (updateError) {
          console.error('❌ Failed to update webhook event status:', updateError)
        }
      }
      
      success = false
    }

    if (!success) {
      console.error('❌ Webhook processing failed, returning 500 to trigger retry')
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: 500 }
      )
    }

    console.log('✅ Webhook processed successfully')
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('❌ Webhook error:', error)
    return NextResponse.json(
      {
        error: 'Webhook handler failed',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}

