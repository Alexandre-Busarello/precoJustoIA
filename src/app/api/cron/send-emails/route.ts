import { NextRequest, NextResponse } from 'next/server'
import { EmailQueueService } from '@/lib/email-queue-service'
import { 
  sendAssetChangeEmail, 
  sendMonthlyReportEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPaymentFailureEmail,
  sendFreeUserAssetChangeEmail,
  sendSubscriptionConfirmationEmail,
  sendPremiumExpirationEmail,
  sendPriceVariationReportEmail,
  sendCustomTriggerReportEmail,
  sendEmail,
  generateEmailVerificationTemplate,
  generateNotificationEmailTemplate
} from '@/lib/email-service'

// Configurar timeout para 60 segundos (máximo do plano hobby da Vercel)
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
    const MAX_EXECUTION_TIME = 50 * 1000 // 50 segundos em ms (deixar buffer de 10s)
    
    // Rate limiting do Resend: máximo 2 requisições por segundo
    // Processar sequencialmente com delay de 500ms entre requisições (garante máximo 2/s)
    const RESEND_RATE_LIMIT_DELAY = 500 // ms entre requisições (2 req/s = 500ms)
    
    // Helper para detectar erros de rate limit
    const isRateLimitError = (error: any): boolean => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return errorMessage.toLowerCase().includes('too many requests') ||
             errorMessage.toLowerCase().includes('rate limit') ||
             (error as any)?.status === 429
    }

    console.log(`📊 Configurações: BATCH_SIZE=${BATCH_SIZE}, MAX_ATTEMPTS=${MAX_ATTEMPTS}, RATE_LIMIT_DELAY=${RESEND_RATE_LIMIT_DELAY}ms`)

    // 3. Buscar emails pendentes ordenados por prioridade e data de criação
    const pendingEmails = await EmailQueueService.getPendingEmails(BATCH_SIZE, MAX_ATTEMPTS)

    console.log(`📦 Encontrados ${pendingEmails.length} emails pendentes para processar sequencialmente com throttling`)

    if (pendingEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum email pendente para processar',
        processed: 0,
        sent: 0,
        skipped: 0
      })
    }

    let sentCount = 0
    let skippedCount = 0

    // Função para processar um único email
    const processEmail = async (emailQueue: typeof pendingEmails[0]) => {
      const stats = {
        sent: false,
        skipped: false,
        error: null as string | null,
        isRateLimit: false,
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

          case 'SUBSCRIPTION_CONFIRMATION':
            await sendSubscriptionConfirmationEmail({
              email: emailQueue.email,
              ticker: emailData.ticker,
              companyName: emailData.companyName,
              unsubscribeUrl: emailData.unsubscribeUrl,
              companyLogoUrl: emailData.companyLogoUrl || null,
            })
            break

          case 'PREMIUM_EXPIRED':
            await sendPremiumExpirationEmail(
              emailQueue.email,
              emailQueue.recipientName || emailData.userName
            )
            break

          case 'PRICE_VARIATION_REPORT':
            // Garantir que isPremium seja sempre um boolean explícito
            const isPremium = typeof emailData.isPremium === 'boolean' 
              ? emailData.isPremium 
              : false;
            
            await sendPriceVariationReportEmail({
              email: emailQueue.email,
              userName: emailQueue.recipientName || 'Investidor',
              ticker: emailData.ticker,
              companyName: emailData.companyName,
              companyLogoUrl: emailData.companyLogoUrl || null,
              reportUrl: emailData.reportUrl,
              reportSummary: emailData.reportSummary || '',
              isPremium,
              hasFlag: emailData.hasFlag ?? false,
            })
            break

          case 'CUSTOM_TRIGGER_REPORT':
            // Garantir que isPremium seja sempre um boolean explícito
            const isPremiumCustom = typeof emailData.isPremium === 'boolean' 
              ? emailData.isPremium 
              : false;
            
            await sendCustomTriggerReportEmail({
              email: emailQueue.email,
              userName: emailQueue.recipientName || 'Investidor',
              ticker: emailData.ticker,
              companyName: emailData.companyName,
              companyLogoUrl: emailData.companyLogoUrl || null,
              reportUrl: emailData.reportUrl,
              reportSummary: emailData.reportSummary || '',
              isPremium: isPremiumCustom,
            })
            break

          default:
            throw new Error(`Tipo de email desconhecido: ${emailQueue.emailType}`)
        }

        // Marcar como enviado APENAS se não houve erro
        await EmailQueueService.markAsSent(emailQueue.id)

        stats.sent = true
        console.log(`✅ Email enviado: ${emailQueue.email} (${emailQueue.emailType})`)
        return stats

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
        const isRateLimit = isRateLimitError(error)
        
        console.error(`❌ Erro ao enviar email ${emailQueue.id} para ${emailQueue.email}:`, errorMessage)
        
        if (isRateLimit) {
          console.warn(`⚠️ [RATE LIMIT] Rate limit detectado para email ${emailQueue.id}. Mantendo como PENDING.`)
        } else {
          console.warn(`⚠️ [EMAIL ERROR] Erro ao enviar email ${emailQueue.id}. Mantendo como PENDING para nova tentativa.`)
        }
        
        // CRÍTICO: Qualquer erro mantém o email como PENDING (não marca como FAILED)
        // O email será reprocessado na próxima execução do cron
        // O incrementAttempt já foi chamado no início, então apenas atualizamos a mensagem de erro
        stats.skipped = true
        stats.isRateLimit = isRateLimit
        stats.error = errorMessage
        
        // Atualizar mensagem de erro mas manter como PENDING
        // Não precisamos chamar incrementAttempt novamente pois já foi chamado no início
        // Apenas atualizamos a mensagem de erro se necessário
        await EmailQueueService.incrementAttempt(emailQueue.id, errorMessage)
        
        return stats
      }
    }

    // 4. Processar emails sequencialmente com throttling para respeitar rate limit do Resend
    // Resend permite máximo 2 requisições por segundo, então processamos sequencialmente
    // com delay de 500ms entre requisições (garante máximo 2/s)
    console.log(`\n🚀 Processando ${pendingEmails.length} email(s) sequencialmente com throttling (${RESEND_RATE_LIMIT_DELAY}ms entre requisições)...`)
    
    for (let i = 0; i < pendingEmails.length; i++) {
      // Verificar timeout antes de processar próximo email
      const elapsedTime = Date.now() - startTime
      if (elapsedTime >= MAX_EXECUTION_TIME) {
        console.log(`⏱️ Timeout atingido. Processados ${sentCount + skippedCount} de ${pendingEmails.length} emails`)
        break
      }

      const emailQueue = pendingEmails[i]
      console.log(`\n📧 [${i + 1}/${pendingEmails.length}] Processando email para ${emailQueue.email} (${emailQueue.emailType})...`)

      try {
        const stats = await processEmail(emailQueue)
        
        if (stats.sent) sentCount++
        if (stats.skipped) skippedCount++
        
        // Se foi rate limit, adicionar delay maior antes de continuar
        if (stats.isRateLimit) {
          console.log(`⏳ Rate limit detectado. Aguardando ${RESEND_RATE_LIMIT_DELAY * 2}ms antes de continuar...`)
          await new Promise(resolve => setTimeout(resolve, RESEND_RATE_LIMIT_DELAY * 2))
        } else {
          // Delay normal entre requisições para respeitar rate limit (exceto no último email)
          if (i < pendingEmails.length - 1) {
            await new Promise(resolve => setTimeout(resolve, RESEND_RATE_LIMIT_DELAY))
          }
        }
      } catch (error) {
        // Erro não tratado na função processEmail
        skippedCount++
        console.error(`❌ Erro não tratado ao processar email:`, error)
        
        // Delay mesmo em caso de erro para não sobrecarregar
        if (i < pendingEmails.length - 1) {
          await new Promise(resolve => setTimeout(resolve, RESEND_RATE_LIMIT_DELAY))
        }
      }
    }

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log(`✅ Cron job concluído em ${executionTime}s`)
    console.log(`📊 Estatísticas: ${sentCount} enviados, ${skippedCount} aguardando nova tentativa (mantidos como PENDING)`)

    return NextResponse.json({
      success: true,
      message: 'Processamento de emails concluído',
      processed: pendingEmails.length,
      sent: sentCount,
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

