import { NextRequest, NextResponse } from 'next/server'
import { processWebhookNotification, validateWebhookSignature } from '@/lib/mercadopago'
import { prisma } from '@/lib/prisma'
import { safeWrite } from '@/lib/prisma-wrapper'
import { WebhookProcessor } from '@/lib/webhook-processor'

export async function POST(request: NextRequest) {
  console.log('🔗 MercadoPago webhook POST request received')
  
  try {
    // Obter headers necessários para validação
    const xSignature = request.headers.get('x-signature')
    const xRequestId = request.headers.get('x-request-id')
    const dataId = request.nextUrl.searchParams.get('data.id')
    
    console.log('🔍 Webhook headers:', {
      hasXSignature: !!xSignature,
      hasXRequestId: !!xRequestId,
      dataId,
    })

    // Ler o corpo da requisição
    const rawBody = await request.text()
    let body: any
    
    try {
      body = JSON.parse(rawBody)
    } catch (error) {
      console.error('❌ Invalid JSON in webhook body')
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      )
    }
    
    console.log('🎯 MercadoPago webhook received:', body)

    // Validar assinatura do webhook (apenas em produção)
    if (process.env.NODE_ENV === 'production') {
      if (!xSignature || !xRequestId || !dataId) {
        console.error('❌ Missing required headers for webhook validation')
        return NextResponse.json(
          { error: 'Missing required headers' },
          { status: 401 }
        )
      }

      const isValidSignature = validateWebhookSignature(
        xSignature,
        xRequestId,
        dataId,
        rawBody
      )

      if (!isValidSignature) {
        console.error('❌ Invalid webhook signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }

      console.log('✅ Webhook signature validated successfully')
    } else {
      console.log('⚠️ Skipping webhook signature validation in development mode')
    }

    // Processar notificação do webhook
    const paymentData = await processWebhookNotification(body)
    
    if (!paymentData) {
      console.log('📭 No payment data to process, considering success')
      return NextResponse.json({ received: true })
    }

    // Extrair metadados do evento
    const eventType = body.type || body.action || 'payment'
    const paymentId = paymentData.id ? String(paymentData.id) : null
    const userId = paymentData.external_reference?.split('-')[0] || null

    // Salvar evento no banco com status PENDING
    let webhookEventId: string
    try {
      const savedEvent = await safeWrite(
        'save-mercadopago-webhook-event',
        () => prisma.webhookEvent.create({
          data: {
            provider: 'MERCADOPAGO',
            eventId: paymentId ? `mp_${paymentId}` : undefined,
            eventType,
            status: 'PENDING',
            rawData: body,
            processedData: {
              paymentId,
              userId,
              status: paymentData.status,
              externalReference: paymentData.external_reference,
            },
            userId: userId || undefined,
            paymentId: paymentId || undefined,
            externalReference: paymentData.external_reference || undefined,
          },
        }),
        ['webhook_events']
      )
      webhookEventId = savedEvent.id
      console.log(`💾 Webhook event saved with ID: ${webhookEventId}`)
    } catch (error) {
      console.error('❌ Failed to save webhook event:', error)
      webhookEventId = ''
    }

    // Processar evento
    let success = false
    let errorMessage: string | null = null

    try {
      // Atualizar status para PROCESSING
      if (webhookEventId) {
        await safeWrite(
          'update-webhook-status-processing',
          () => prisma.webhookEvent.update({
            where: { id: webhookEventId },
            data: { 
              status: 'PROCESSING',
              lastProcessedAt: new Date(),
            },
          }), []
        )
      }

      // Processar apenas pagamentos aprovados
      if (paymentData.status === 'approved') {
        console.log('💰 Processing approved payment')
        success = await WebhookProcessor.processMercadoPagoEvent({
          eventType,
          rawData: body,
        })
      } else {
        console.log(`📋 Payment status: ${paymentData.status} - no action needed`)
        success = true // Outros status são considerados sucesso
      }

      // Atualizar status baseado no resultado
      if (webhookEventId) {
        await safeWrite(
          'update-webhook-status-result',
          () => prisma.webhookEvent.update({
            where: { id: webhookEventId },
            data: {
              status: success ? 'DONE' : 'FAILED',
              processedAt: success ? new Date() : undefined,
              lastProcessedAt: new Date(),
              errorMessage: success ? null : 'Processing failed',
              retryCount: { increment: 1 },
            },
          }), []
        )
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Error processing webhook:', error)
      
      // Atualizar status para FAILED
      if (webhookEventId) {
        try {
          await safeWrite(
            'update-webhook-status-failed',
            () => prisma.webhookEvent.update({
              where: { id: webhookEventId },
              data: {
                status: 'FAILED',
                lastProcessedAt: new Date(),
                errorMessage,
                retryCount: { increment: 1 },
              },
            }), []
          )
        } catch (updateError) {
          console.error('❌ Failed to update webhook event status:', updateError)
        }
      }
      
      success = false
    }

    if (!success) {
      console.error('❌ MercadoPago webhook processing failed, returning 500 to trigger retry')
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: 500 }
      )
    }

    console.log('✅ MercadoPago webhook processed successfully')
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('❌ Webhook MercadoPago error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

