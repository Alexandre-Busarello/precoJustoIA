/**
 * CRON JOB: Processamento de Pagamentos Pendentes
 * 
 * Concilia eventos de webhook não processados (PENDING ou FAILED)
 * e atualiza o status de acesso dos usuários no banco de dados.
 * 
 * Este job deve ser executado periodicamente para garantir que todos
 * os pagamentos sejam processados mesmo se o webhook falhar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeWrite } from '@/lib/prisma-wrapper'
import { WebhookProcessor } from '@/lib/webhook-processor'

const MAX_RETRIES = 5 // Máximo de tentativas por evento
const BATCH_SIZE = 50 // Processar até 50 eventos por execução

/**
 * Verifica autenticação do cron job
 */
function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET

  // Em desenvolvimento, permitir sem secret (CUIDADO!)
  if (!cronSecret && process.env.NODE_ENV !== 'production') {
    console.warn('⚠️ CRON_SECRET not set - allowing in development mode')
    return true
  }

  if (!cronSecret) {
    console.error('❌ CRON_SECRET not configured')
    return false
  }

  // Verificar header Authorization: Bearer
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${cronSecret}`) {
    return true
  }

  // Verificar header x-cron-secret
  const cronHeader = request.headers.get('x-cron-secret')
  if (cronHeader === cronSecret) {
    return true
  }

  return false
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  console.log('\n' + '='.repeat(60))
  console.log('🔄 [CRON JOB] Iniciando processamento de pagamentos pendentes')
  console.log(`   Timestamp: ${new Date().toISOString()}`)
  console.log('='.repeat(60) + '\n')

  try {
    // 1. Verificar autenticação
    const isAuthorized = verifyCronAuth(request)
    
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid cron secret' },
        { status: 401 }
      )
    }

    // 2. Buscar eventos pendentes ou falhados
    const pendingEvents = await prisma.webhookEvent.findMany({
      where: {
        status: {
          in: ['PENDING', 'FAILED']
        },
        retryCount: {
          lt: MAX_RETRIES
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: BATCH_SIZE
    });

    console.log(`📦 Encontrados ${pendingEvents.length} eventos para processar`)

    if (pendingEvents.length === 0) {
      console.log('✅ Nenhum evento pendente encontrado')
      return NextResponse.json({
        success: true,
        processed: 0,
        succeeded: 0,
        failed: 0,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      })
    }

    // 3. Processar cada evento
    let succeeded = 0
    let failed = 0
    const errors: string[] = []

    for (const event of pendingEvents) {
      console.log(`\n🔄 Processando evento ${event.id} (${event.provider} - ${event.eventType})`)
      
      try {
        // Atualizar status para PROCESSING
        await safeWrite(
          'update-webhook-processing',
          () => prisma.webhookEvent.update({
            where: { id: event.id },
            data: {
              status: 'PROCESSING',
              lastProcessedAt: new Date(),
            },
          }),
          ['webhook_events']
        )

        // Processar evento baseado no provider
        let success = false
        
        if (event.provider === 'STRIPE') {
          success = await WebhookProcessor.processStripeEvent({
            eventType: event.eventType,
            rawData: event.rawData,
          })
        } else if (event.provider === 'MERCADOPAGO') {
          success = await WebhookProcessor.processMercadoPagoEvent({
            eventType: event.eventType,
            rawData: event.rawData,
          })
        } else {
          console.error(`❌ Provider desconhecido: ${event.provider}`)
          success = false
        }

        // Atualizar status baseado no resultado
        await safeWrite(
          'update-webhook-result',
          () => prisma.webhookEvent.update({
            where: { id: event.id },
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

        if (success) {
          succeeded++
          console.log(`✅ Evento ${event.id} processado com sucesso`)
        } else {
          failed++
          errors.push(`Evento ${event.id}: Processing failed`)
          console.error(`❌ Evento ${event.id} falhou ao processar`)
        }
      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Evento ${event.id}: ${errorMessage}`)
        
        console.error(`❌ Erro ao processar evento ${event.id}:`, error)

        // Atualizar status para FAILED
        try {
          await safeWrite(
            'update-webhook-error',
            () => prisma.webhookEvent.update({
              where: { id: event.id },
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
          console.error(`❌ Erro ao atualizar status do evento ${event.id}:`, updateError)
        }
      }
    }

    const duration = Date.now() - startTime

    console.log('\n' + '='.repeat(60))
    console.log('✅ [CRON JOB] Processamento concluído')
    console.log(`   Processados: ${pendingEvents.length}`)
    console.log(`   Sucesso: ${succeeded}`)
    console.log(`   Falhas: ${failed}`)
    console.log(`   Duração: ${duration}ms`)
    console.log('='.repeat(60) + '\n')

    return NextResponse.json({
      success: true,
      processed: pendingEvents.length,
      succeeded,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      duration,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('\n❌ [CRON JOB] Erro durante processamento:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

