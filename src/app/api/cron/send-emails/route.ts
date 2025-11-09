import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendAssetChangeEmail, sendMonthlyReportEmail } from '@/lib/email-service'

// Configurar timeout para 5 minutos (máximo da Vercel)
export const maxDuration = 300

/**
 * Cron Job para Envio de Emails
 * 
 * Processa a fila de emails pendentes e envia os emails.
 * Executa periodicamente para garantir que todos os emails sejam enviados.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  console.log('📧 Iniciando cron job de envio de emails...')

  try {
    // 1. Validar CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Tentativa de acesso não autorizada ao cron job')
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // 2. Configurações
    const BATCH_SIZE = parseInt(process.env.EMAIL_BATCH_SIZE || '50')
    const MAX_ATTEMPTS = 3
    const MAX_EXECUTION_TIME = 270 * 1000 // 4.5 minutos em ms (deixar buffer de 30s)

    console.log(`📊 Configurações: BATCH_SIZE=${BATCH_SIZE}, MAX_ATTEMPTS=${MAX_ATTEMPTS}`)

    // 3. Buscar emails pendentes ordenados por prioridade e data de criação
    const pendingEmails = await prisma.emailQueue.findMany({
      where: {
        status: 'PENDING',
        attempts: {
          lt: MAX_ATTEMPTS
        }
      },
      orderBy: [
        { priority: 'desc' }, // Prioridade alta primeiro
        { createdAt: 'asc' }  // Mais antigos primeiro
      ],
      take: BATCH_SIZE
    })

    console.log(`📦 Encontrados ${pendingEmails.length} emails pendentes para processar`)

    if (pendingEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum email pendente para processar',
        processed: 0,
        sent: 0,
        failed: 0
      })
    }

    let sentCount = 0
    let failedCount = 0
    let skippedCount = 0

    // 4. Processar cada email
    for (const emailQueue of pendingEmails) {
      // Verificar timeout
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        console.log(`⏱️ Timeout atingido. Processados ${sentCount + failedCount} de ${pendingEmails.length} emails`)
        break
      }

      try {
        // Atualizar tentativa
        await prisma.emailQueue.update({
          where: { id: emailQueue.id },
          data: {
            attempts: { increment: 1 },
            lastAttemptAt: new Date()
          }
        })

        const emailData = emailQueue.emailData as any

        // Enviar email baseado no tipo
        if (emailQueue.emailType === 'ASSET_CHANGE') {
          await sendAssetChangeEmail({
            email: emailQueue.email,
            userName: emailQueue.recipientName || 'Investidor',
            ticker: emailData.ticker,
            companyName: emailData.companyName,
            companyLogoUrl: emailData.companyLogoUrl || null,
            changeDirection: emailData.changeDirection,
            previousScore: emailData.previousScore,
            currentScore: emailData.currentScore,
            reportSummary: emailData.reportSummary,
            reportUrl: emailData.reportUrl,
          })
        } else if (emailQueue.emailType === 'MONTHLY_REPORT') {
          await sendMonthlyReportEmail({
            email: emailQueue.email,
            userName: emailQueue.recipientName || 'Investidor',
            ticker: emailData.ticker,
            companyName: emailData.companyName,
            companyLogoUrl: emailData.companyLogoUrl || null,
            reportSummary: emailData.reportSummary,
            reportUrl: emailData.reportUrl,
          })
        } else {
          console.error(`❌ Tipo de email desconhecido: ${emailQueue.emailType}`)
          await prisma.emailQueue.update({
            where: { id: emailQueue.id },
            data: {
              status: 'FAILED',
              errorMessage: `Tipo de email desconhecido: ${emailQueue.emailType}`
            }
          })
          failedCount++
          continue
        }

        // Marcar como enviado
        await prisma.emailQueue.update({
          where: { id: emailQueue.id },
          data: {
            status: 'SENT',
            sentAt: new Date()
          }
        })

        sentCount++
        console.log(`✅ Email enviado: ${emailQueue.email} (${emailQueue.emailType})`)

      } catch (error) {
        console.error(`❌ Erro ao enviar email ${emailQueue.id} para ${emailQueue.email}:`, error)
        
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
        const newAttempts = emailQueue.attempts + 1

        // Se excedeu o número máximo de tentativas, marcar como falha
        if (newAttempts >= MAX_ATTEMPTS) {
          await prisma.emailQueue.update({
            where: { id: emailQueue.id },
            data: {
              status: 'FAILED',
              errorMessage: `Falhou após ${newAttempts} tentativas: ${errorMessage}`
            }
          })
          failedCount++
        } else {
          // Manter como PENDING para nova tentativa
          await prisma.emailQueue.update({
            where: { id: emailQueue.id },
            data: {
              errorMessage: errorMessage
            }
          })
          skippedCount++
        }
      }
    }

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log(`✅ Cron job concluído em ${executionTime}s`)
    console.log(`📊 Estatísticas: ${sentCount} enviados, ${failedCount} falharam, ${skippedCount} aguardando nova tentativa`)

    return NextResponse.json({
      success: true,
      message: 'Processamento de emails concluído',
      processed: pendingEmails.length,
      sent: sentCount,
      failed: failedCount,
      skipped: skippedCount,
      executionTime: `${executionTime}s`
    })

  } catch (error) {
    console.error('❌ Erro no cron job de envio de emails:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao processar fila de emails',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

