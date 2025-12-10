import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { NotificationService } from '@/lib/notification-service'
import { z } from 'zod'

const quizQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['MULTIPLE_CHOICE', 'TEXT', 'SCALE']),
  question: z.string().min(1),
  options: z.array(z.string()).optional(), // Para MULTIPLE_CHOICE
  required: z.boolean(),
  min: z.number().optional(), // Para SCALE
  max: z.number().optional() // Para SCALE
})

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
  sendEmail: z.boolean().optional(),
  isActive: z.boolean().optional(),
  displayType: z.enum(['BANNER', 'MODAL', 'QUIZ']).optional(),
  bannerTemplate: z.enum(['GRADIENT', 'SOLID', 'MINIMAL', 'ILLUSTRATED']).optional(),
  modalTemplate: z.enum(['GRADIENT', 'SOLID', 'MINIMAL', 'ILLUSTRATED']).optional(),
  quizConfig: z.object({
    questions: z.array(quizQuestionSchema).max(5).min(1)
  }).optional(),
  illustrationUrl: z.string().url().optional().nullable(),
  bannerColors: z.object({
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    textColor: z.string().optional(),
    buttonColor: z.string().optional(),
    buttonTextColor: z.string().optional()
  }).optional()
}).refine((data) => {
  // Se displayType é QUIZ, quizConfig é obrigatório
  if (data.displayType === 'QUIZ' && !data.quizConfig) {
    return false
  }
  // Se quizConfig existe, deve ter pelo menos 1 pergunta e no máximo 5
  if (data.quizConfig) {
    if (!data.quizConfig.questions || data.quizConfig.questions.length === 0 || data.quizConfig.questions.length > 5) {
      return false
    }
    // Validar que MULTIPLE_CHOICE tem options
    for (const question of data.quizConfig.questions) {
      if (question.type === 'MULTIPLE_CHOICE' && (!question.options || question.options.length === 0)) {
        return false
      }
      if (question.type === 'SCALE' && (question.min === undefined || question.max === undefined)) {
        return false
      }
    }
  }
  // Se template é ILLUSTRATED, illustrationUrl é obrigatório
  if ((data.bannerTemplate === 'ILLUSTRATED' || data.modalTemplate === 'ILLUSTRATED') && !data.illustrationUrl) {
    return false
  }
  return true
}, {
  message: 'Configuração inválida: QUIZ requer quizConfig, MULTIPLE_CHOICE requer options, SCALE requer min/max, ILLUSTRATED requer illustrationUrl'
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
      sendEmail,
      displayType: validatedData.displayType || 'BANNER',
      bannerTemplate: validatedData.bannerTemplate,
      modalTemplate: validatedData.modalTemplate,
      quizConfig: validatedData.quizConfig,
      illustrationUrl: validatedData.illustrationUrl || undefined,
      bannerColors: validatedData.bannerColors,
      isActive: validatedData.isActive ?? true
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

