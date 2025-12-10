import { prisma } from '@/lib/prisma'
import { EmailQueueService } from './email-queue-service'

export type NotificationType = 
  | 'SYSTEM'
  | 'CAMPAIGN'
  | 'ASSET_CHANGE'
  | 'MONTHLY_REPORT'
  | 'AI_REPORT'
  | 'QUIZ'

export type NotificationDisplayType = 'BANNER' | 'MODAL' | 'QUIZ'

export type NotificationTemplate = 'GRADIENT' | 'SOLID' | 'MINIMAL' | 'ILLUSTRATED'

export type NotificationLinkType = 'INTERNAL' | 'EXTERNAL'

export type NotificationSegmentType =
  | 'ALL_USERS'
  | 'ASSET_SUBSCRIBERS'
  | 'RECENT_RANKING_CREATORS'
  | 'RECENT_RADAR_USERS'
  | 'RECENT_BACKTEST_USERS'
  | 'RECENT_PORTFOLIO_CREATORS'
  | 'ACTIVE_PORTFOLIO_USERS'
  | 'PREMIUM_USERS'
  | 'FREE_USERS'
  | 'EARLY_ADOPTERS'
  | 'TRIAL_USERS'
  | 'RECENT_LOGINS'
  | 'NEW_USERS'
  | 'FEATURE_USERS'
  | 'SUPPORT_TICKET_USERS'
  | 'EMAIL_LIST'

export interface CreateNotificationParams {
  userId: string
  title: string
  message: string
  link?: string
  linkType?: NotificationLinkType
  type: NotificationType
  campaignId?: string
  metadata?: Record<string, any>
  sendEmail?: boolean // Se deve enviar email também
}

export interface CreateCampaignParams {
  title: string
  message: string
  link?: string
  linkType?: NotificationLinkType
  ctaText?: string // Texto customizado do botão CTA
  segmentType: NotificationSegmentType
  segmentConfig: Record<string, any>
  showOnDashboard?: boolean
  dashboardExpiresAt?: Date
  createdBy: string
  sendEmail?: boolean
  displayType?: NotificationDisplayType
  bannerTemplate?: NotificationTemplate
  modalTemplate?: NotificationTemplate
  quizConfig?: Record<string, any>
  illustrationUrl?: string
  bannerColors?: {
    primaryColor?: string
    secondaryColor?: string
    backgroundColor?: string
    textColor?: string
    buttonColor?: string
    buttonTextColor?: string
  }
  isActive?: boolean
}

export interface Notification {
  id: string
  userId: string
  campaignId: string | null
  title: string
  message: string
  link: string | null
  linkType: NotificationLinkType
  type: NotificationType
  isRead: boolean
  readAt: Date | null
  metadata: Record<string, any> | null
  createdAt: Date
}

export interface NotificationPreferences {
  emailNotificationsEnabled: boolean
}

/**
 * SERVIÇO DE NOTIFICAÇÕES
 * 
 * Gerencia criação, leitura e segmentação de notificações
 */
export class NotificationService {
  /**
   * Cria uma notificação individual para um usuário
   */
  static async createNotification(params: CreateNotificationParams): Promise<string> {
    const {
      userId,
      title,
      message,
      link,
      linkType = 'INTERNAL',
      type,
      campaignId,
      metadata,
      sendEmail = false
    } = params

    try {
      // Criar notificação
      const notification = await prisma.notification.create({
        data: {
          userId,
          campaignId: campaignId || null,
          title,
          message,
          link: link || null,
          linkType,
          type,
          metadata: metadata || undefined,
        }
      })

      // Se deve enviar email, verificar preferências e adicionar à fila
      if (sendEmail) {
        await this.sendNotificationEmail(userId, notification.id, title, message, link, linkType)
      }

      return notification.id
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao criar notificação:', error)
      throw error
    }
  }

  /**
   * Cria uma campanha de notificações para um segmento de usuários
   */
  static async createCampaign(params: CreateCampaignParams): Promise<{ campaignId: string; notificationsCreated: number }> {
    const {
      title,
      message,
      link,
      linkType = 'INTERNAL',
      ctaText,
      segmentType,
      segmentConfig,
      showOnDashboard = false,
      dashboardExpiresAt,
      createdBy,
      sendEmail = false,
      displayType = 'BANNER',
      bannerTemplate,
      modalTemplate,
      quizConfig,
      illustrationUrl,
      bannerColors,
      isActive = true
    } = params

    try {
      // Criar campanha
      const campaign = await prisma.notificationCampaign.create({
        data: {
          title,
          message,
          link: link || null,
          linkType,
          ctaText: ctaText || null,
          segmentType: segmentType as any, // Cast necessário pois Prisma enum pode estar desatualizado até regeneração
          segmentConfig,
          showOnDashboard,
          dashboardExpiresAt: dashboardExpiresAt || null,
          createdBy,
          displayType: displayType as any,
          bannerTemplate: bannerTemplate as any || null,
          modalTemplate: modalTemplate as any || null,
          quizConfig: quizConfig || null,
          illustrationUrl: illustrationUrl || null,
          bannerColors: bannerColors || null,
          isActive,
          stats: {
            totalSent: 0,
            totalRead: 0,
            totalClicked: 0
          }
        } as any // Cast temporário até migration ser aplicada
      })

      // Buscar usuários do segmento
      const userIds = await this.getSegmentUserIds(segmentType, segmentConfig)
      
      console.log(`📢 [NOTIFICATION] Campanha criada: ${campaign.id}, segmento: ${segmentType}, usuários: ${userIds.length}`)

      // Criar notificações para cada usuário
      let notificationsCreated = 0
      const batchSize = 100

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize)
        
        const notifications = await Promise.all(
          batch.map(userId =>
            prisma.notification.create({
              data: {
                userId,
                campaignId: campaign.id,
                title,
                message,
                link: link || null,
                linkType,
                type: (displayType === 'QUIZ' ? 'QUIZ' : 'CAMPAIGN') as any,
                metadata: {
                  campaignId: campaign.id,
                  segmentType,
                  ...segmentConfig
                }
              }
            })
          )
        )

        notificationsCreated += notifications.length

        // Enviar emails se necessário
        if (sendEmail) {
          await Promise.all(
            notifications.map(notification =>
              this.sendNotificationEmail(notification.userId, notification.id, title, message, link, linkType, ctaText)
            )
          )
        }
      }

      // Recalcular estatísticas da campanha baseado nas notificações criadas
      await this.recalculateCampaignStats(campaign.id)

      return {
        campaignId: campaign.id,
        notificationsCreated
      }
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao criar campanha:', error)
      throw error
    }
  }

  /**
   * Estende uma campanha existente criando notificações apenas para novos usuários
   * que entraram no segmento desde a criação original da campanha
   */
  static async extendCampaignForNewUsers(
    campaignId: string,
    sendEmail: boolean = false
  ): Promise<{ newNotificationsCreated: number; newUsersCount: number }> {
    try {
      // Buscar campanha existente
      const campaign = await prisma.notificationCampaign.findUnique({
        where: { id: campaignId }
      })

      if (!campaign) {
        throw new Error('Campanha não encontrada')
      }

      // Obter usuários atuais do segmento
      const currentUserIds = await this.getSegmentUserIds(
        campaign.segmentType as NotificationSegmentType,
        campaign.segmentConfig as Record<string, any>
      )

      // Buscar usuários que já receberam notificação desta campanha
      const existingNotifications = await prisma.notification.findMany({
        where: { campaignId },
        select: { userId: true }
      })

      const existingUserIds = new Set(existingNotifications.map(n => n.userId))

      // Calcular diferença (novos usuários)
      const newUserIds = currentUserIds.filter(userId => !existingUserIds.has(userId))

      if (newUserIds.length === 0) {
        return {
          newNotificationsCreated: 0,
          newUsersCount: 0
        }
      }

      console.log(`📢 [NOTIFICATION] Estendendo campanha ${campaignId}: ${newUserIds.length} novos usuários`)

      // Criar notificações apenas para novos usuários
      let notificationsCreated = 0
      const batchSize = 100

      for (let i = 0; i < newUserIds.length; i += batchSize) {
        const batch = newUserIds.slice(i, i + batchSize)
        
        const notifications = await Promise.all(
          batch.map(userId =>
            prisma.notification.create({
              data: {
                userId,
                campaignId: campaign.id,
                title: campaign.title,
                message: campaign.message,
                link: campaign.link || null,
                linkType: campaign.linkType as NotificationLinkType,
                type: ((campaign as any).displayType === 'QUIZ' ? 'QUIZ' : 'CAMPAIGN') as any,
                metadata: {
                  campaignId: campaign.id,
                  segmentType: campaign.segmentType,
                  ...(campaign.segmentConfig as Record<string, any>)
                }
              }
            })
          )
        )

        notificationsCreated += notifications.length

        // Enviar emails se necessário
        if (sendEmail) {
          await Promise.all(
            notifications.map(notification =>
              this.sendNotificationEmail(
                notification.userId,
                notification.id,
                campaign.title,
                campaign.message,
                campaign.link,
                campaign.linkType as NotificationLinkType,
                (campaign as any).ctaText
              )
            )
          )
        }
      }

      // Recalcular estatísticas da campanha
      await this.recalculateCampaignStats(campaign.id)

      return {
        newNotificationsCreated: notificationsCreated,
        newUsersCount: newUserIds.length
      }
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao estender campanha:', error)
      throw error
    }
  }

  /**
   * Conta quantos novos usuários receberiam notificação se a campanha fosse estendida
   */
  static async countNewUsersForCampaign(campaignId: string): Promise<number> {
    try {
      // Buscar campanha existente
      const campaign = await prisma.notificationCampaign.findUnique({
        where: { id: campaignId }
      })

      if (!campaign) {
        throw new Error('Campanha não encontrada')
      }

      // Obter usuários atuais do segmento
      const currentUserIds = await this.getSegmentUserIds(
        campaign.segmentType as NotificationSegmentType,
        campaign.segmentConfig as Record<string, any>
      )

      // Buscar usuários que já receberam notificação desta campanha
      const existingNotifications = await prisma.notification.findMany({
        where: { campaignId },
        select: { userId: true }
      })

      const existingUserIds = new Set(existingNotifications.map(n => n.userId))

      // Calcular diferença (novos usuários)
      const newUserIds = currentUserIds.filter(userId => !existingUserIds.has(userId))

      return newUserIds.length
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao contar novos usuários:', error)
      throw error
    }
  }

  /**
   * Processa campanhas ativas para um usuário específico
   * Cria notificações apenas para campanhas ativas que o usuário ainda não recebeu
   * e que o usuário pertence ao segmento da campanha
   */
  static async processActiveCampaignsForUser(userId: string): Promise<{ processed: number }> {
    try {
      // Buscar todas as campanhas ativas
      const activeCampaigns = await prisma.notificationCampaign.findMany({
        where: {
          isActive: true
        } as any
      })

      if (activeCampaigns.length === 0) {
        return { processed: 0 }
      }

      // Buscar todas as notificações de campanhas que o usuário já recebeu
      const existingNotifications = await prisma.notification.findMany({
        where: {
          userId,
          campaignId: { not: null }
        },
        select: { campaignId: true }
      })

      const existingCampaignIds = new Set(
        existingNotifications
          .map(n => n.campaignId)
          .filter((id): id is string => id !== null)
      )

      let processedCount = 0

      // Processar cada campanha ativa
      for (const campaign of activeCampaigns) {
        // Se usuário já recebeu notificação desta campanha, pular
        if (existingCampaignIds.has(campaign.id)) {
          continue
        }

        // Verificar se usuário pertence ao segmento da campanha
        const segmentUserIds = await this.getSegmentUserIds(
          campaign.segmentType as NotificationSegmentType,
          campaign.segmentConfig as Record<string, any>
        )

        // Se usuário não pertence ao segmento, pular
        if (!segmentUserIds.includes(userId)) {
          continue
        }

        // Verificação final antes de criar (double-check para prevenir race conditions)
        // Isso garante idempotência mesmo se duas requisições chegarem simultaneamente
        const alreadyExists = await prisma.notification.findFirst({
          where: {
            userId,
            campaignId: campaign.id
          }
        })

        if (alreadyExists) {
          // Já existe, pular (pode ter sido criado por outra requisição simultânea)
          continue
        }

        // Criar notificação para o usuário
        try {
          await prisma.notification.create({
            data: {
              userId,
              campaignId: campaign.id,
              title: campaign.title,
              message: campaign.message,
              link: campaign.link || null,
              linkType: campaign.linkType as NotificationLinkType,
              type: ((campaign as any).displayType === 'QUIZ' ? 'QUIZ' : 'CAMPAIGN') as any,
              metadata: {
                campaignId: campaign.id,
                segmentType: campaign.segmentType,
                ...(campaign.segmentConfig as Record<string, any>)
              }
            }
          })

          processedCount++

          // Recalcular estatísticas da campanha
          await this.recalculateCampaignStats(campaign.id)
        } catch (error: any) {
          // Se erro for de constraint único (duplicação), ignorar silenciosamente
          // Isso pode acontecer em race conditions extremas
          if (error?.code === 'P2002') {
            console.log(`⚠️ [NOTIFICATION] Notificação já existe para usuário ${userId} e campanha ${campaign.id}, ignorando...`)
            continue
          }
          // Re-throw outros erros
          throw error
        }
      }

      console.log(`📢 [NOTIFICATION] Processadas ${processedCount} campanhas ativas para usuário ${userId}`)

      return { processed: processedCount }
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao processar campanhas ativas:', error)
      throw error
    }
  }

  /**
   * Busca notificações do usuário (paginado)
   */
  static async getUserNotifications(
    userId: string,
    options: {
      page?: number
      limit?: number
      filter?: 'all' | 'unread' | 'read'
    } = {}
  ): Promise<{ notifications: Notification[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 20, filter = 'all' } = options
    const skip = (page - 1) * limit

    try {
      const where: any = { userId }
      
      if (filter === 'unread') {
        where.isRead = false
      } else if (filter === 'read') {
        where.isRead = true
      }

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.notification.count({ where })
      ])

      return {
        notifications: notifications.map(n => ({
          id: n.id,
          userId: n.userId,
          campaignId: n.campaignId,
          title: n.title,
          message: n.message,
          link: n.link,
          linkType: n.linkType as NotificationLinkType,
          type: n.type as any as NotificationType, // Cast temporário até Prisma ser regenerado
          isRead: n.isRead,
          readAt: n.readAt,
          metadata: n.metadata as Record<string, any> | null,
          createdAt: n.createdAt
        })),
        total,
        hasMore: skip + notifications.length < total
      }
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao buscar notificações:', error)
      throw error
    }
  }

  /**
   * Recalcula estatísticas de uma campanha baseado nas notificações reais
   */
  static async recalculateCampaignStats(campaignId: string): Promise<void> {
    try {
      const [totalSent, totalRead] = await Promise.all([
        prisma.notification.count({
          where: { campaignId }
        }),
        prisma.notification.count({
          where: { 
            campaignId,
            isRead: true
          }
        })
      ])

      // Buscar stats existentes para preservar totalClicked se existir
      const campaign = await prisma.notificationCampaign.findUnique({
        where: { id: campaignId },
        select: { stats: true }
      })

      const existingStats = campaign?.stats as { totalClicked?: number } | null

      await prisma.notificationCampaign.update({
        where: { id: campaignId },
        data: {
          stats: {
            totalSent,
            totalRead,
            totalClicked: existingStats?.totalClicked || 0
          }
        }
      })
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao recalcular estatísticas da campanha:', error)
    }
  }

  /**
   * Marca notificação como lida
   */
  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      // Verificar se já está lida antes de atualizar
      const existingNotification = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { isRead: true, campaignId: true }
      })

      if (!existingNotification) {
        throw new Error('Notificação não encontrada')
      }

      // Se já estava lida, não fazer nada
      if (existingNotification.isRead) {
        return
      }

      await prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId, // Garantir que é do usuário correto
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      })

      // Recalcular estatísticas da campanha se houver
      if (existingNotification.campaignId) {
        await this.recalculateCampaignStats(existingNotification.campaignId)
      }
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao marcar como lida:', error)
      throw error
    }
  }

  /**
   * Marca todas as notificações do usuário como lidas
   */
  static async markAllAsRead(userId: string): Promise<number> {
    try {
      // Buscar campanhas afetadas antes de atualizar
      const notificationsToUpdate = await prisma.notification.findMany({
        where: {
          userId,
          isRead: false
        },
        select: { campaignId: true }
      })

      const affectedCampaignIds = new Set<string>()
      notificationsToUpdate.forEach(n => {
        if (n.campaignId) {
          affectedCampaignIds.add(n.campaignId)
        }
      })

      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      })

      // Recalcular estatísticas das campanhas afetadas
      await Promise.all(
        Array.from(affectedCampaignIds).map(campaignId => 
          this.recalculateCampaignStats(campaignId)
        )
      )

      return result.count
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao marcar todas como lidas:', error)
      throw error
    }
  }

  /**
   * Conta notificações não lidas do usuário
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      return await prisma.notification.count({
        where: {
          userId,
          isRead: false
        }
      })
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao contar não lidas:', error)
      return 0
    }
  }

  /**
   * Busca notificação destacada para dashboard
   * Retorna sempre a campanha mais recente quando há múltiplas ativas
   */
  static async getDashboardNotification(userId: string): Promise<(Notification & { ctaText?: string | null; bannerTemplate?: NotificationTemplate | null; illustrationUrl?: string | null; bannerColors?: { primaryColor?: string; secondaryColor?: string; backgroundColor?: string; textColor?: string; buttonColor?: string; buttonTextColor?: string } | null }) | null> {
    try {
      const now = new Date()
      
      // Buscar todas as campanhas ativas ordenadas pela mais recente
      const campaigns = await prisma.notificationCampaign.findMany({
        where: {
          showOnDashboard: true,
          displayType: 'BANNER' as any, // Apenas banners na dashboard
          OR: [
            { dashboardExpiresAt: null },
            { dashboardExpiresAt: { gt: now } }
          ]
        } as any,
        orderBy: { createdAt: 'desc' }, // Mais recente primeiro
        include: {
          notifications: {
            where: {
              userId
            },
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        }
      })

      // Encontrar a primeira campanha que tenha notificação para este usuário
      // Como já está ordenado por createdAt desc, a primeira com notificação é a mais recente
      const campaign = campaigns.find(c => c.notifications.length > 0)

      if (!campaign || !campaign.notifications[0]) {
        return null
      }

      const notification = campaign.notifications[0]
      return {
        id: notification.id,
        userId: notification.userId,
        campaignId: notification.campaignId,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        linkType: notification.linkType as NotificationLinkType,
        type: notification.type as any as NotificationType,
        isRead: notification.isRead,
        readAt: notification.readAt,
        metadata: notification.metadata as Record<string, any> | null,
        createdAt: notification.createdAt,
        ctaText: (campaign as any).ctaText,
        bannerTemplate: (campaign as any).bannerTemplate as NotificationTemplate | null,
        illustrationUrl: (campaign as any).illustrationUrl,
        bannerColors: (campaign as any).bannerColors as { primaryColor?: string; secondaryColor?: string; backgroundColor?: string; textColor?: string; buttonColor?: string; buttonTextColor?: string } | null
      }
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao buscar notificação do dashboard:', error)
      return null
    }
  }

  /**
   * Cria notificação automática de relatório de IA
   */
  static async createNotificationFromAIReport(params: {
    userId: string
    ticker: string
    companyName: string
    reportId: string
    reportType: 'MONTHLY_REPORT' | 'ASSET_CHANGE' | 'FREE_USER_ASSET_CHANGE'
    reportUrl: string
    reportSummary: string
    changeDirection?: 'positive' | 'negative'
    previousScore?: number
    currentScore?: number
  }): Promise<string> {
    const {
      userId,
      ticker,
      companyName,
      reportId,
      reportType,
      reportUrl,
      reportSummary,
      changeDirection,
      previousScore,
      currentScore
    } = params

    let title: string
    let message: string
    let type: NotificationType

    if (reportType === 'ASSET_CHANGE') {
      type = 'ASSET_CHANGE'
      const direction = changeDirection === 'positive' ? 'melhorou' : 'piorou'
      const scoreChange = previousScore !== undefined && currentScore !== undefined
        ? `${previousScore.toFixed(1)} → ${currentScore.toFixed(1)}`
        : ''
      title = `${ticker}: Score Geral ${direction}`
      message = `Detectamos uma mudança relevante nos fundamentos de ${companyName} (${ticker}). ${scoreChange ? `Score: ${scoreChange}. ` : ''}${reportSummary.substring(0, 200)}...`
    } else if (reportType === 'MONTHLY_REPORT') {
      type = 'MONTHLY_REPORT'
      title = `📊 Novo Relatório Mensal: ${ticker}`
      message = `Um novo relatório mensal foi gerado para ${companyName} (${ticker}). ${reportSummary.substring(0, 200)}...`
    } else {
      type = 'AI_REPORT'
      title = `Mudança detectada em ${ticker}`
      message = `Detectamos uma mudança relevante nos fundamentos de ${companyName} (${ticker}). Faça upgrade para Premium e veja os detalhes completos.`
    }

    // Verificar preferências de email
    const preferences = await this.getUserNotificationPreferences(userId)
    const sendEmail = preferences.emailNotificationsEnabled

    return await this.createNotification({
      userId,
      title,
      message,
      link: reportUrl,
      linkType: 'INTERNAL',
      type,
      metadata: {
        reportId,
        ticker,
        companyName,
        reportType,
        changeDirection,
        previousScore,
        currentScore
      },
      sendEmail
    })
  }

  /**
   * Busca preferências de notificações do usuário
   */
  static async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const preferences = await prisma.userNotificationPreferences.findUnique({
        where: { userId }
      })

      // Se não existir, criar com padrão (email habilitado)
      if (!preferences) {
        const created = await prisma.userNotificationPreferences.create({
          data: {
            userId,
            emailNotificationsEnabled: true
          }
        })
        return { emailNotificationsEnabled: created.emailNotificationsEnabled }
      }

      return { emailNotificationsEnabled: preferences.emailNotificationsEnabled }
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao buscar preferências:', error)
      // Retornar padrão em caso de erro
      return { emailNotificationsEnabled: true }
    }
  }

  /**
   * Atualiza preferências de notificações do usuário
   */
  static async updateUserNotificationPreferences(
    userId: string,
    emailNotificationsEnabled: boolean
  ): Promise<void> {
    try {
      await prisma.userNotificationPreferences.upsert({
        where: { userId },
        create: {
          userId,
          emailNotificationsEnabled
        },
        update: {
          emailNotificationsEnabled
        }
      })
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao atualizar preferências:', error)
      throw error
    }
  }

  /**
   * Conta quantos usuários serão afetados por um segmento
   */
  static async countSegmentUsers(
    segmentType: NotificationSegmentType,
    segmentConfig: Record<string, any>
  ): Promise<number> {
    const userIds = await this.getSegmentUserIds(segmentType, segmentConfig)
    return userIds.length
  }

  /**
   * Busca IDs de usuários de um segmento específico
   */
  private static async getSegmentUserIds(
    segmentType: NotificationSegmentType,
    segmentConfig: Record<string, any>
  ): Promise<string[]> {
    const { daysAgo = 30, assetTicker, featureName } = segmentConfig
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - daysAgo)

    switch (segmentType) {
      case 'ALL_USERS':
        const allUsers = await prisma.user.findMany({
          select: { id: true }
        })
        return allUsers.map(u => u.id)

      case 'ASSET_SUBSCRIBERS':
        if (!assetTicker) throw new Error('assetTicker é obrigatório para ASSET_SUBSCRIBERS')
        const company = await prisma.company.findUnique({
          where: { ticker: assetTicker },
          select: { id: true }
        })
        if (!company) return []
        const subscribers = await prisma.userAssetSubscription.findMany({
          where: { companyId: company.id },
          select: { userId: true }
        })
        return subscribers.map(s => s.userId)

      case 'RECENT_RANKING_CREATORS':
        const rankingCreators = await prisma.rankingHistory.findMany({
          where: {
            createdAt: { gte: dateThreshold }
          },
          select: { userId: true },
          distinct: ['userId']
        })
        return rankingCreators.map(r => r.userId)

      case 'RECENT_RADAR_USERS':
        const radarUsers = await prisma.radarConfig.findMany({
          where: {
            updatedAt: { gte: dateThreshold }
          },
          select: { userId: true }
        })
        return radarUsers.map(r => r.userId)

      case 'RECENT_BACKTEST_USERS':
        const backtestUsers = await prisma.backtestConfig.findMany({
          where: {
            createdAt: { gte: dateThreshold }
          },
          select: { userId: true },
          distinct: ['userId']
        })
        return backtestUsers.map(b => b.userId)

      case 'RECENT_PORTFOLIO_CREATORS':
        const portfolioCreators = await prisma.portfolioConfig.findMany({
          where: {
            createdAt: { gte: dateThreshold }
          },
          select: { userId: true },
          distinct: ['userId']
        })
        return portfolioCreators.map(p => p.userId)

      case 'ACTIVE_PORTFOLIO_USERS':
        // Usuários que adicionaram transações recentemente
        const activePortfolioTransactions = await prisma.portfolioTransaction.findMany({
          where: {
            createdAt: { gte: dateThreshold }
          },
          include: {
            portfolio: {
              select: { userId: true }
            }
          }
        })
        // Extrair userIds únicos
        const uniqueUserIds = new Set<string>()
        activePortfolioTransactions.forEach(t => {
          if (t.portfolio?.userId) {
            uniqueUserIds.add(t.portfolio.userId)
          }
        })
        return Array.from(uniqueUserIds)

      case 'PREMIUM_USERS':
        const premiumUsers = await prisma.user.findMany({
          where: {
            subscriptionTier: 'PREMIUM'
          },
          select: { id: true }
        })
        return premiumUsers.map(u => u.id)

      case 'FREE_USERS':
        const freeUsers = await prisma.user.findMany({
          where: {
            subscriptionTier: 'FREE'
          },
          select: { id: true }
        })
        return freeUsers.map(u => u.id)

      case 'EARLY_ADOPTERS':
        const earlyAdopters = await prisma.user.findMany({
          where: {
            isEarlyAdopter: true
          },
          select: { id: true }
        })
        return earlyAdopters.map(u => u.id)

      case 'TRIAL_USERS':
        const trialUsers = await prisma.user.findMany({
          where: {
            trialStartedAt: { not: null },
            trialEndsAt: { gt: new Date() }
          },
          select: { id: true }
        })
        return trialUsers.map(u => u.id)

      case 'RECENT_LOGINS':
        const recentLogins = await prisma.user.findMany({
          where: {
            lastLoginAt: { gte: dateThreshold }
          },
          select: { id: true }
        })
        return recentLogins.map(u => u.id)

      case 'NEW_USERS':
        const newUsers = await prisma.user.findMany({
          where: {
            createdAt: { gte: dateThreshold }
          },
          select: { id: true }
        })
        return newUsers.map(u => u.id)

      case 'FEATURE_USERS':
        if (!featureName) throw new Error('featureName é obrigatório para FEATURE_USERS')
        const featureUsers = await prisma.featureUsage.findMany({
          where: {
            feature: featureName,
            usedAt: { gte: dateThreshold }
          },
          select: { userId: true },
          distinct: ['userId']
        })
        return featureUsers.map(f => f.userId)

      case 'SUPPORT_TICKET_USERS':
        const ticketUsers = await prisma.supportTicket.findMany({
          where: {
            createdAt: { gte: dateThreshold }
          },
          select: { userId: true },
          distinct: ['userId']
        })
        return ticketUsers.map(t => t.userId)

      case 'EMAIL_LIST':
        const emails = segmentConfig.emails as string[] | undefined
        if (!emails || !Array.isArray(emails) || emails.length === 0) {
          return []
        }
        // Buscar usuários pelos emails fornecidos
        const usersByEmail = await prisma.user.findMany({
          where: {
            email: { in: emails }
          },
          select: { id: true }
        })
        return usersByEmail.map(u => u.id)

      default:
        throw new Error(`Tipo de segmento desconhecido: ${segmentType}`)
    }
  }

  /**
   * Envia email de notificação (adiciona à fila)
   */
  private static async sendNotificationEmail(
    userId: string,
    notificationId: string,
    title: string,
    message: string,
    link: string | null | undefined,
    linkType: NotificationLinkType,
    ctaText?: string | null
  ): Promise<void> {
    try {
      // Buscar dados do usuário
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true }
      })

      if (!user) {
        console.warn(`⚠️ [NOTIFICATION] Usuário ${userId} não encontrado para envio de email`)
        return
      }

      // Verificar preferências novamente (pode ter mudado)
      const preferences = await this.getUserNotificationPreferences(userId)
      if (!preferences.emailNotificationsEnabled) {
        console.log(`📧 [NOTIFICATION] Email desabilitado para usuário ${userId}`)
        return
      }

      // Construir URL completa se for link interno
      // IMPORTANTE: URLs internas devem ser convertidas para absolutas em emails
      // A notificação armazena URLs relativas (ex: /acao/PETR4/relatorios/123)
      // Mas no email precisamos de URLs absolutas (ex: https://precojusto.ai/acao/PETR4/relatorios/123)
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'https://precojusto.ai'
      let emailLink: string
      
      if (!link) {
        // Se não houver link, usar página de notificações
        emailLink = `${baseUrl}/notificacoes`
      } else if (linkType === 'INTERNAL') {
        // Link interno: converter para absoluto
        // Se já começar com http/https, assumir que é externo mesmo marcado como interno
        if (link.startsWith('http://') || link.startsWith('https://')) {
          emailLink = link
        } else {
          // Garantir que comece com / e adicionar baseUrl
          const internalPath = link.startsWith('/') ? link : `/${link}`
          // Remover baseUrl se já estiver presente (evitar duplicação acidental)
          const cleanPath = internalPath.replace(new RegExp(`^${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '')
          emailLink = `${baseUrl}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`
        }
      } else {
        // Link externo: usar como está
        emailLink = link
      }

      // Adicionar à fila de emails
      await EmailQueueService.queueEmail({
        email: user.email,
        emailType: 'NOTIFICATION',
        recipientName: user.name || null,
        emailData: {
          title,
          message,
          link: emailLink,
          notificationId,
          ctaText: ctaText || null
        },
        priority: 0,
        metadata: {
          userId,
          notificationId
        }
      })
    } catch (error) {
      console.error(`❌ [NOTIFICATION] Erro ao enviar email de notificação para ${userId}:`, error)
      // Não falhar a criação da notificação por causa do email
    }
  }

  /**
   * Busca modal ou quiz pendente para usuário
   * Prioriza quizzes sobre modais
   */
  static async getModalNotification(userId: string): Promise<{
    id: string
    campaignId: string
    title: string
    message: string
    link: string | null
    linkType: NotificationLinkType
    ctaText: string | null
    modalTemplate: NotificationTemplate | null
    illustrationUrl: string | null
    displayType: NotificationDisplayType
  } | null> {
    try {
      const now = new Date()
      
      // Primeiro, verificar se há quiz pendente (prioridade)
      // Quiz só aparece automaticamente se não foi respondido E não foi visto ainda
      const quizCampaign = await prisma.notificationCampaign.findFirst({
        where: {
          displayType: 'QUIZ' as any,
          OR: [
            { dashboardExpiresAt: null },
            { dashboardExpiresAt: { gt: now } }
          ],
          notifications: {
            some: {
              userId
            }
          },
          NOT: {
            OR: [
              {
                quizResponses: {
                  some: {
                    userId
                  }
                }
              },
              {
                modalViews: {
                  some: {
                    userId
                  }
                }
              }
            ]
          } as any
        } as any,
        orderBy: { createdAt: 'desc' },
        include: {
          notifications: {
            where: {
              userId
            },
            take: 1
          }
        }
      } as any)

      if (quizCampaign && (quizCampaign as any).notifications.length > 0) {
        return {
          id: (quizCampaign as any).notifications[0].id,
          campaignId: quizCampaign.id,
          title: quizCampaign.title,
          message: quizCampaign.message,
          link: quizCampaign.link,
          linkType: quizCampaign.linkType as NotificationLinkType,
          ctaText: quizCampaign.ctaText,
          modalTemplate: (quizCampaign as any).modalTemplate as NotificationTemplate | null,
          illustrationUrl: (quizCampaign as any).illustrationUrl,
          displayType: 'QUIZ' as NotificationDisplayType
        }
      }

      // Se não há quiz, buscar modal pendente
      const modalCampaign = await prisma.notificationCampaign.findFirst({
        where: {
          displayType: 'MODAL' as any,
          OR: [
            { dashboardExpiresAt: null },
            { dashboardExpiresAt: { gt: now } }
          ],
          notifications: {
            some: {
              userId
            }
          },
          NOT: {
            modalViews: {
              some: {
                userId
              }
            }
          } as any
        } as any,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          message: true,
          link: true,
          linkType: true,
          ctaText: true,
          modalTemplate: true,
          illustrationUrl: true,
          notifications: {
            where: {
              userId
            },
            take: 1,
            select: {
              id: true
            }
          }
        }
      } as any)

      if (!modalCampaign || (modalCampaign as any).notifications.length === 0) {
        return null
      }

      return {
        id: (modalCampaign as any).notifications[0].id,
        campaignId: modalCampaign.id,
        title: modalCampaign.title,
        message: modalCampaign.message,
        link: modalCampaign.link,
        linkType: modalCampaign.linkType as NotificationLinkType,
        ctaText: modalCampaign.ctaText,
        modalTemplate: (modalCampaign as any).modalTemplate as NotificationTemplate | null,
        illustrationUrl: (modalCampaign as any).illustrationUrl,
        displayType: 'MODAL' as NotificationDisplayType
      }
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao buscar modal:', error)
      return null
    }
  }

  /**
   * Marca modal como vista
   */
  static async markModalAsViewed(
    userId: string,
    campaignId: string,
    dismissed: boolean = false
  ): Promise<void> {
    try {
      await (prisma as any).notificationModalView.upsert({
        where: {
          userId_campaignId: {
            userId,
            campaignId
          }
        },
        create: {
          userId,
          campaignId,
          dismissedAt: dismissed ? new Date() : null
        },
        update: {
          dismissedAt: dismissed ? new Date() : undefined
        }
      })
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao marcar modal como vista:', error)
      throw error
    }
  }

  /**
   * Verifica se usuário já viu modal
   */
  static async hasUserViewedModal(userId: string, campaignId: string): Promise<boolean> {
    try {
      const view = await (prisma as any).notificationModalView.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId
          }
        }
      })
      return !!view
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao verificar visualização de modal:', error)
      return false
    }
  }

  /**
   * Busca quiz pendente ou específico
   */
  static async getQuizNotification(
    userId: string,
    campaignId?: string
  ): Promise<{
    id: string
    campaignId: string
    title: string
    message: string
    quizConfig: Record<string, any>
    modalTemplate: NotificationTemplate | null
    illustrationUrl: string | null
  } | null> {
    try {
      const now = new Date()
      
      const where: any = {
        displayType: 'QUIZ' as any,
        OR: [
          { dashboardExpiresAt: null },
          { dashboardExpiresAt: { gt: now } }
        ],
        notifications: {
          some: {
            userId
          }
        },
        NOT: {
          quizResponses: {
            some: {
              userId
            }
          } as any
        } as any
      }

      if (campaignId) {
        where.id = campaignId
      }

      const campaign = await prisma.notificationCampaign.findFirst({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          notifications: {
            where: {
              userId
            },
            take: 1
          }
        }
      })

      if (!campaign || (campaign as any).notifications.length === 0 || !(campaign as any).quizConfig) {
        return null
      }

      return {
        id: (campaign as any).notifications[0].id,
        campaignId: campaign.id,
        title: campaign.title,
        message: campaign.message,
        quizConfig: (campaign as any).quizConfig as Record<string, any>,
        modalTemplate: (campaign as any).modalTemplate as NotificationTemplate | null,
        illustrationUrl: (campaign as any).illustrationUrl
      }
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao buscar quiz:', error)
      return null
    }
  }

  /**
   * Submete respostas do quiz
   */
  static async submitQuizResponse(
    userId: string,
    campaignId: string,
    responses: Record<string, any>
  ): Promise<void> {
    try {
      // Verificar se já respondeu
      const existing = await (prisma as any).quizResponse.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId
          }
        }
      })

      if (existing) {
        throw new Error('Quiz já foi respondido por este usuário')
      }

      await (prisma as any).quizResponse.create({
        data: {
          userId,
          campaignId,
          responses
        }
      })
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao submeter quiz:', error)
      throw error
    }
  }

  /**
   * Verifica se usuário já respondeu quiz
   */
  static async hasUserCompletedQuiz(userId: string, campaignId: string): Promise<boolean> {
    try {
      const response = await (prisma as any).quizResponse.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId
          }
        }
      })
      return !!response
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao verificar resposta de quiz:', error)
      return false
    }
  }

  /**
   * Busca informações do quiz (mesmo se já foi respondido)
   * Retorna informações básicas e indica se já foi respondido
   */
  static async getQuizInfo(
    userId: string,
    campaignId: string
  ): Promise<{
    id: string
    campaignId: string
    title: string
    message: string
    quizConfig: Record<string, any>
    modalTemplate: NotificationTemplate | null
    illustrationUrl: string | null
    isCompleted: boolean
    completedAt?: Date
  } | null> {
    try {
      const now = new Date()
      
      const campaign = await prisma.notificationCampaign.findFirst({
        where: {
          id: campaignId,
          displayType: 'QUIZ' as any,
          OR: [
            { dashboardExpiresAt: null },
            { dashboardExpiresAt: { gt: now } }
          ],
          notifications: {
            some: {
              userId
            }
          }
        } as any,
        include: {
          notifications: {
            where: {
              userId
            },
            take: 1
          }
        }
      })

      if (!campaign || (campaign as any).notifications.length === 0 || !(campaign as any).quizConfig) {
        return null
      }

      // Verificar se já foi respondido
      const response = await (prisma as any).quizResponse.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId
          }
        }
      })

      return {
        id: (campaign as any).notifications[0].id,
        campaignId: campaign.id,
        title: campaign.title,
        message: campaign.message,
        quizConfig: (campaign as any).quizConfig as Record<string, any>,
        modalTemplate: (campaign as any).modalTemplate as NotificationTemplate | null,
        illustrationUrl: (campaign as any).illustrationUrl,
        isCompleted: !!response,
        completedAt: response?.completedAt ? new Date(response.completedAt) : undefined
      }
    } catch (error) {
      console.error('❌ [NOTIFICATION] Erro ao buscar informações do quiz:', error)
      return null
    }
  }
}

// Exportar funções helper
export const createNotification = NotificationService.createNotification.bind(NotificationService)
export const createCampaign = NotificationService.createCampaign.bind(NotificationService)
export const getUserNotifications = NotificationService.getUserNotifications.bind(NotificationService)
export const markAsRead = NotificationService.markAsRead.bind(NotificationService)
export const markAllAsRead = NotificationService.markAllAsRead.bind(NotificationService)
export const getUnreadCount = NotificationService.getUnreadCount.bind(NotificationService)
export const getDashboardNotification = NotificationService.getDashboardNotification.bind(NotificationService)
export const createNotificationFromAIReport = NotificationService.createNotificationFromAIReport.bind(NotificationService)
export const getUserNotificationPreferences = NotificationService.getUserNotificationPreferences.bind(NotificationService)
export const updateUserNotificationPreferences = NotificationService.updateUserNotificationPreferences.bind(NotificationService)
export const getModalNotification = NotificationService.getModalNotification.bind(NotificationService)
export const markModalAsViewed = NotificationService.markModalAsViewed.bind(NotificationService)
export const hasUserViewedModal = NotificationService.hasUserViewedModal.bind(NotificationService)
export const getQuizNotification = NotificationService.getQuizNotification.bind(NotificationService)
export const submitQuizResponse = NotificationService.submitQuizResponse.bind(NotificationService)
export const hasUserCompletedQuiz = NotificationService.hasUserCompletedQuiz.bind(NotificationService)

