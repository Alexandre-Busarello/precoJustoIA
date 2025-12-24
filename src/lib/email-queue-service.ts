import { prisma } from '@/lib/prisma'
import { EmailType } from '@prisma/client'
import { 
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPaymentFailureEmail,
  sendAssetChangeEmail,
  sendMonthlyReportEmail,
  sendFreeUserAssetChangeEmail,
  sendSubscriptionConfirmationEmail,
  sendBulkMonitoringConfirmationEmail,
  sendPriceVariationReportEmail,
  sendCustomTriggerReportEmail,
  generateEmailVerificationTemplate,
  generateNotificationEmailTemplate
} from './email-service'

export interface QueueEmailParams {
  email: string
  emailType: EmailType
  emailData: Record<string, any>
  recipientName?: string | null
  priority?: number
  metadata?: Record<string, any>
}

export interface QueueEmailResult {
  success: boolean
  queueId?: string
  sent: boolean
  error?: string
}

export interface PendingEmail {
  id: string
  email: string
  emailType: EmailType
  recipientName: string | null
  emailData: Record<string, any>
  attempts: number
  priority: number
  metadata: Record<string, any> | null
  createdAt: Date
}

/**
 * SERVIÇO DE FILA DE EMAILS
 * 
 * Camada de abstração para gerenciar a fila de emails.
 * Atualmente usa Prisma/PostgreSQL, mas abstraído para permitir migração futura.
 * 
 * IMPORTANTE: Tenta enviar imediatamente antes de criar registro para evitar race conditions.
 */
export class EmailQueueService {
  /**
   * Adiciona email à fila e tenta enviar imediatamente
   * 
   * Fluxo:
   * 1. Tenta enviar imediatamente (sob demanda)
   * 2. Se sucesso: cria registro com status SENT
   * 3. Se falha: cria registro com status PENDING para processamento posterior
   */
  static async queueEmail(params: QueueEmailParams): Promise<QueueEmailResult> {
    const { email, emailType, emailData, recipientName, priority = 0, metadata } = params

    // Helper para detectar erros de rate limit
    const isRateLimitError = (error: any): boolean => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return errorMessage.toLowerCase().includes('too many requests') ||
             errorMessage.toLowerCase().includes('rate limit') ||
             (error as any)?.status === 429
    }

    try {
      // Tentar enviar imediatamente ANTES de criar registro
      let sent = false
      let sendError: string | null = null
      let isRateLimit = false

      try {
        await this.sendEmailByType(email, emailType, emailData, recipientName)
        sent = true
      } catch (error) {
        sendError = error instanceof Error ? error.message : 'Erro desconhecido ao enviar email'
        isRateLimit = isRateLimitError(error)
        
        if (isRateLimit) {
          console.log(`⚠️ [EMAIL-QUEUE] Rate limit ao enviar imediatamente ${emailType} para ${email}. Adicionando à fila como PENDING.`)
        } else {
          console.log(`⚠️ [EMAIL-QUEUE] Falha ao enviar imediatamente ${emailType} para ${email}: ${sendError}`)
        }
      }

      // CRÍTICO: Se for erro de rate limit, SEMPRE criar como PENDING (não como SENT)
      // Mesmo que o erro tenha ocorrido, não devemos marcar como SENT
      const status = (sent && !isRateLimit) ? 'SENT' : 'PENDING'

      // Criar registro na fila
      const queueRecord = await prisma.emailQueue.create({
        data: {
          email,
          emailType,
          recipientName: recipientName || null,
          emailData,
          status,
          priority,
          metadata: metadata || undefined,
          attempts: sent ? 0 : 0, // Se já enviou, não precisa tentar novamente
          sentAt: (sent && !isRateLimit) ? new Date() : null,
          errorMessage: (!sent && sendError) ? sendError : null,
        }
      })

      if (sent && !isRateLimit) {
        console.log(`✅ [EMAIL-QUEUE] Email ${emailType} enviado imediatamente para ${email} (queueId: ${queueRecord.id})`)
      } else {
        const reason = isRateLimit ? 'rate limit' : 'erro no envio'
        console.log(`📋 [EMAIL-QUEUE] Email ${emailType} adicionado à fila para ${email} (queueId: ${queueRecord.id}) - Motivo: ${reason}`)
      }

      return {
        success: true,
        queueId: queueRecord.id,
        sent: sent && !isRateLimit, // Só considerar enviado se não foi rate limit
        error: sent ? undefined : sendError || undefined
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao adicionar à fila'
      console.error(`❌ [EMAIL-QUEUE] Erro ao adicionar email à fila:`, errorMessage)
      return {
        success: false,
        sent: false,
        error: errorMessage
      }
    }
  }

  /**
   * Busca emails pendentes para processamento
   */
  static async getPendingEmails(batchSize: number = 50, maxAttempts: number = 3): Promise<PendingEmail[]> {
    try {
      const pendingEmails = await prisma.emailQueue.findMany({
        where: {
          status: 'PENDING',
          attempts: {
            lt: maxAttempts
          }
        },
        orderBy: [
          { priority: 'desc' }, // Prioridade alta primeiro
          { createdAt: 'asc' }  // Mais antigos primeiro
        ],
        take: batchSize
      })

      return pendingEmails.map(email => ({
        id: email.id,
        email: email.email,
        emailType: email.emailType as EmailType,
        recipientName: email.recipientName,
        emailData: email.emailData as Record<string, any>,
        attempts: email.attempts,
        priority: email.priority,
        metadata: email.metadata as Record<string, any> | null,
        createdAt: email.createdAt
      }))
    } catch (error) {
      console.error('❌ [EMAIL-QUEUE] Erro ao buscar emails pendentes:', error)
      return []
    }
  }

  /**
   * Incrementa tentativas de envio
   */
  static async incrementAttempt(queueId: string, errorMessage?: string): Promise<void> {
    try {
      await prisma.emailQueue.update({
        where: { id: queueId },
        data: {
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          errorMessage: errorMessage || null
        }
      })
    } catch (error) {
      console.error(`❌ [EMAIL-QUEUE] Erro ao incrementar tentativa para ${queueId}:`, error)
    }
  }

  /**
   * Marca email como enviado
   */
  static async markAsSent(queueId: string): Promise<void> {
    try {
      await prisma.emailQueue.update({
        where: { id: queueId },
        data: {
          status: 'SENT',
          sentAt: new Date()
        }
      })
    } catch (error) {
      console.error(`❌ [EMAIL-QUEUE] Erro ao marcar como enviado ${queueId}:`, error)
    }
  }

  /**
   * Marca email como falhou
   */
  static async markAsFailed(queueId: string, errorMessage: string): Promise<void> {
    try {
      await prisma.emailQueue.update({
        where: { id: queueId },
        data: {
          status: 'FAILED',
          errorMessage
        }
      })
    } catch (error) {
      console.error(`❌ [EMAIL-QUEUE] Erro ao marcar como falhou ${queueId}:`, error)
    }
  }

  /**
   * Envia email baseado no tipo (função interna para tentativa imediata)
   */
  private static async sendEmailByType(
    email: string,
    emailType: EmailType,
    emailData: Record<string, any>,
    recipientName?: string | null
  ): Promise<void> {
    switch (emailType) {
      case 'ASSET_CHANGE':
        await sendAssetChangeEmail({
          email,
          userName: recipientName || 'Investidor',
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
          email,
          userName: recipientName || 'Investidor',
          ticker: emailData.ticker,
          companyName: emailData.companyName,
          companyLogoUrl: emailData.companyLogoUrl || null,
          reportSummary: emailData.reportSummary,
          reportUrl: emailData.reportUrl,
        })
        break

      case 'PASSWORD_RESET':
        await sendPasswordResetEmail(
          email,
          emailData.resetUrl,
          emailData.userName
        )
        break

      case 'WELCOME':
        await sendWelcomeEmail(
          email,
          emailData.userName,
          emailData.isEarlyAdopter || false
        )
        break

      case 'PAYMENT_FAILURE':
        await sendPaymentFailureEmail(
          email,
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
          to: email,
          subject: template.subject,
          html: template.html,
          text: template.text
        })
        break

      case 'FREE_USER_ASSET_CHANGE':
        await sendFreeUserAssetChangeEmail({
          email,
          userName: recipientName || 'Investidor',
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
          recipientName || undefined,
          emailData.ctaText || null,
          emailData.illustrationUrl || null
        )
        await sendEmail({
          to: email,
          subject: notificationTemplate.subject,
          html: notificationTemplate.html,
          text: notificationTemplate.text
        })
        break

      case 'SUBSCRIPTION_CONFIRMATION':
        // Verificar se é confirmação de múltiplos monitoramentos ou único
        if (emailData.companies && Array.isArray(emailData.companies)) {
          // Email de confirmação em massa
          await sendBulkMonitoringConfirmationEmail({
            email,
            companies: emailData.companies,
          })
        } else {
          // Email de confirmação único
          await sendSubscriptionConfirmationEmail({
            email,
            ticker: emailData.ticker,
            companyName: emailData.companyName,
            unsubscribeUrl: emailData.unsubscribeUrl,
            companyLogoUrl: emailData.companyLogoUrl || null,
          })
        }
        break

      case 'PRICE_VARIATION_REPORT':
        await sendPriceVariationReportEmail({
          email,
          userName: recipientName || 'Investidor',
          ticker: emailData.ticker,
          companyName: emailData.companyName,
          companyLogoUrl: emailData.companyLogoUrl || null,
          reportUrl: emailData.reportUrl,
          reportSummary: emailData.reportSummary || '',
          isPremium: emailData.isPremium ?? true, // Default true para manter compatibilidade
          hasFlag: (emailData as any).hasFlag ?? false, // Indica se há flag ativo (não tipado ainda)
        } as any)
        break

      case 'CUSTOM_TRIGGER_REPORT':
        await sendCustomTriggerReportEmail({
          email,
          userName: recipientName || 'Investidor',
          ticker: emailData.ticker,
          companyName: emailData.companyName,
          companyLogoUrl: emailData.companyLogoUrl || null,
          reportUrl: emailData.reportUrl,
          reportSummary: emailData.reportSummary || '',
          isPremium: emailData.isPremium ?? true, // Default true para manter compatibilidade
        })
        break

      default:
        throw new Error(`Tipo de email desconhecido: ${emailType}`)
    }
  }
}

// Exportar função helper para facilitar uso
export const queueEmail = EmailQueueService.queueEmail.bind(EmailQueueService)
export const getPendingEmails = EmailQueueService.getPendingEmails.bind(EmailQueueService)
export const incrementAttempt = EmailQueueService.incrementAttempt.bind(EmailQueueService)
export const markAsSent = EmailQueueService.markAsSent.bind(EmailQueueService)
export const markAsFailed = EmailQueueService.markAsFailed.bind(EmailQueueService)

