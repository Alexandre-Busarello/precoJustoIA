import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { NotificationService } from '@/lib/notification-service'
import { z } from 'zod'

const createCampaignSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  link: z.string().optional(),
  linkType: z.enum(['INTERNAL', 'EXTERNAL']),
  ctaText: z.string().max(50).optional(), // Texto customizado do botão CTA (máximo 50 caracteres)
  segmentType: z.enum([
    'ALL_USERS',
    'ASSET_SUBSCRIBERS',
    'RECENT_RANKING_CREATORS',
    'RECENT_RADAR_USERS',
    'RECENT_BACKTEST_USERS',
    'RECENT_PORTFOLIO_CREATORS',
    'ACTIVE_PORTFOLIO_USERS',
    'PREMIUM_USERS',
    'FREE_USERS',
    'EARLY_ADOPTERS',
    'TRIAL_USERS',
    'RECENT_LOGINS',
    'NEW_USERS',
    'FEATURE_USERS',
    'SUPPORT_TICKET_USERS',
    'EMAIL_LIST'
  ]),
  segmentConfig: z.any().optional(),
  showOnDashboard: z.boolean().optional(),
  dashboardExpiresAt: z.string().optional().nullable(),
  sendEmail: z.boolean().optional()
})

/**
 * POST /api/admin/notifications/campaign
 * Cria uma nova campanha de notificações (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Verificar se é admin
    await requireAdminUser()

    const body = await request.json()
    
    // Validar com safeParse para melhor tratamento de erros
    const validationResult = createCampaignSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validationResult.error.issues },
        { status: 400 }
      )
    }
    
    const validatedData = validationResult.data

    // Aplicar valores padrão
    const linkType = validatedData.linkType || 'INTERNAL'
    const segmentConfig = validatedData.segmentConfig || {}
    const showOnDashboard = validatedData.showOnDashboard ?? false
    const sendEmail = validatedData.sendEmail ?? false
    
    // Validar link se fornecido
    let link = validatedData.link
    if (link && link.trim() !== '') {
      // Se for link interno, não precisa validar URL
      if (linkType === 'INTERNAL') {
        link = link.startsWith('/') ? link : `/${link}`
      } else {
        // Validar URL externa
        try {
          new URL(link)
        } catch {
          return NextResponse.json(
            { error: 'Link externo deve ser uma URL válida' },
            { status: 400 }
          )
        }
      }
    } else {
      link = undefined
    }

    const dashboardExpiresAt = validatedData.dashboardExpiresAt
      ? new Date(validatedData.dashboardExpiresAt)
      : undefined

    const result = await NotificationService.createCampaign({
      title: validatedData.title,
      message: validatedData.message,
      link,
      linkType,
      ctaText: validatedData.ctaText,
      segmentType: validatedData.segmentType,
      segmentConfig,
      showOnDashboard,
      dashboardExpiresAt,
      createdBy: session.user.id,
      sendEmail
    })

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('❌ Erro ao criar campanha:', error)
    return NextResponse.json(
      { error: 'Erro ao criar campanha' },
      { status: 500 }
    )
  }
}

