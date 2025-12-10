import { NextRequest, NextResponse } from 'next/server'
import { EmailQueueService } from '@/lib/email-queue-service'
import { 
  sendAssetChangeEmail, 
  sendMonthlyReportEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPaymentFailureEmail,
  sendFreeUserAssetChangeEmail,
  sendEmail,
  generateEmailVerificationTemplate,
  generateNotificationEmailTemplate
} from '@/lib/email-service'

// Configurar timeout para 60 segundos (máximo do plano hobby da Vercel)
export const maxDuration = 60

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
    const PARALLEL_BATCH_SIZE = 5 // Processar 5 emails em paralelo
    const MAX_ATTEMPTS = 3
    const MAX_EXECUTION_TIME = 50 * 1000 // 50 segundos em ms (deixar buffer de 10s)

    console.log(`📊 Configurações: BATCH_SIZE=${BATCH_SIZE}, PARALLEL_BATCH_SIZE=${PARALLEL_BATCH_SIZE}, MAX_ATTEMPTS=${MAX_ATTEMPTS}`)

    // 3. Buscar emails pendentes ordenados por prioridade e data de criação
    const pendingEmails = await EmailQueueService.getPendingEmails(BATCH_SIZE, MAX_ATTEMPTS)

    console.log(`📦 Encontrados ${pendingEmails.length} emails pendentes para processar em paralelo (${PARALLEL_BATCH_SIZE} por vez)`)

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

    // Função para processar um único email
    const processEmail = async (emailQueue: typeof pendingEmails[0]) => {
      const stats = {
        sent: false,
        failed: false,
        skipped: false,
        error: null as string | null,
      };

      try {
        // Incrementar tentativa
        await EmailQueueService.incrementAttempt(emailQueue.id)

        const emailData = emailQueue.emailData as any

        // Enviar email baseado no tipo
        switch (emailQueue.emailType) {
          case 'ASSET_CHANGE':
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
            break

          case 'MONTHLY_REPORT':
            await sendMonthlyReportEmail({
              email: emailQueue.email,
              userName: emailQueue.recipientName || 'Investidor',
              ticker: emailData.ticker,
              companyName: emailData.companyName,
              companyLogoUrl: emailData.companyLogoUrl || null,
              reportSummary: emailData.reportSummary,
              reportUrl: emailData.reportUrl,
            })
            break

          case 'PASSWORD_RESET':
            await sendPasswordResetEmail(
              emailQueue.email,
              emailData.resetUrl,
              emailData.userName
            )
            break

          case 'WELCOME':
            await sendWelcomeEmail(
              emailQueue.email,
              emailData.userName,
              emailData.isEarlyAdopter || false
            )
            break

          case 'PAYMENT_FAILURE':
            await sendPaymentFailureEmail(
              emailQueue.email,
              emailData.retryUrl,
              emailData.userName,
              emailData.failureReason
            )
            break

          case 'EMAIL_VERIFICATION':
            const template = generateEmailVerificationTemplate(
              emailData.verificationUrl,
              emailData.userName
            )
            await sendEmail({
              to: emailQueue.email,
              subject: template.subject,
              html: template.html,
              text: template.text
            })
            break

          case 'FREE_USER_ASSET_CHANGE':
            await sendFreeUserAssetChangeEmail({
              email: emailQueue.email,
              userName: emailQueue.recipientName || 'Investidor',
              ticker: emailData.ticker,
              companyName: emailData.companyName,
              companyLogoUrl: emailData.companyLogoUrl || null,
            })
            break

          case 'NOTIFICATION':
            const notificationTemplate = generateNotificationEmailTemplate(
              emailData.title,
              emailData.message,
              emailData.link || null,
              emailQueue.recipientName || undefined,
              emailData.ctaText || null,
              emailData.illustrationUrl || null
            )
            await sendEmail({
              to: emailQueue.email,
              subject: notificationTemplate.subject,
              html: notificationTemplate.html,
              text: notificationTemplate.text
            })
            break

          default:
            throw new Error(`Tipo de email desconhecido: ${emailQueue.emailType}`)
        }

        // Marcar como enviado
        await EmailQueueService.markAsSent(emailQueue.id)

        stats.sent = true
        console.log(`✅ Email enviado: ${emailQueue.email} (${emailQueue.emailType})`)
        return stats

      } catch (error) {
        console.error(`❌ Erro ao enviar email ${emailQueue.id} para ${emailQueue.email}:`, error)
        
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
        const newAttempts = emailQueue.attempts + 1

        // Se excedeu o número máximo de tentativas, marcar como falha
        if (newAttempts >= MAX_ATTEMPTS) {
          await EmailQueueService.markAsFailed(
            emailQueue.id,
            `Falhou após ${newAttempts} tentativas: ${errorMessage}`
          )
          stats.failed = true
        } else {
          // Manter como PENDING para nova tentativa (já atualizado pelo incrementAttempt)
          stats.skipped = true
        }
        stats.error = errorMessage
        return stats
      }
    }

    // 4. Processar emails em lotes paralelos
    for (let i = 0; i < pendingEmails.length; i += PARALLEL_BATCH_SIZE) {
      // Verificar timeout antes de processar próximo batch
      const elapsedTime = Date.now() - startTime
      if (elapsedTime >= MAX_EXECUTION_TIME) {
        console.log(`⏱️ Timeout atingido. Processados ${sentCount + failedCount + skippedCount} de ${pendingEmails.length} emails`)
        break
      }

      const batch = pendingEmails.slice(i, i + PARALLEL_BATCH_SIZE)
      console.log(`\n🚀 Processando batch ${Math.floor(i / PARALLEL_BATCH_SIZE) + 1} com ${batch.length} email(s) em paralelo...`)

      // Processar batch em paralelo
      const results = await Promise.allSettled(
        batch.map(emailQueue => processEmail(emailQueue))
      )

      // Agregar estatísticas
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const stats = result.value
          if (stats.sent) sentCount++
          if (stats.failed) failedCount++
          if (stats.skipped) skippedCount++
        } else {
          // Erro não tratado na função processEmail
          failedCount++
          console.error(`❌ Erro não tratado ao processar email:`, result.reason)
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

