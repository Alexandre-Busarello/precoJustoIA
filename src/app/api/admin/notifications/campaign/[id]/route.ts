import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { NotificationService } from '@/lib/notification-service'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema para perguntas do quiz (reutilizado do createCampaignSchema)
const quizQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['MULTIPLE_CHOICE', 'TEXT', 'SCALE']),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  required: z.boolean().optional()
})

const updateCampaignSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(2000).optional(),
  link: z.string().optional(),
  linkType: z.enum(['INTERNAL', 'EXTERNAL']).optional(),
  ctaText: z.string().max(50).optional(),
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
    'DASHBOARD_NEW_USERS',
    'FEATURE_USERS',
    'SUPPORT_TICKET_USERS',
    'EMAIL_LIST'
  ]).optional(),
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
 * PUT /api/admin/notifications/campaign/[id]
 * Atualiza uma campanha existente (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    await requireAdminUser()

    const resolvedParams = await params
    const campaignId = resolvedParams.id

    // Verificar se campanha existe
    const existingCampaign = await prisma.notificationCampaign.findUnique({
      where: { id: campaignId }
    })

    if (!existingCampaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validationResult = updateCampaignSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const validatedData = validationResult.data

    // Preparar dados para atualização
    const updateData: any = {}
    
    if (validatedData.title !== undefined) updateData.title = validatedData.title
    if (validatedData.message !== undefined) updateData.message = validatedData.message
    if (validatedData.link !== undefined) updateData.link = validatedData.link || null
    if (validatedData.linkType !== undefined) updateData.linkType = validatedData.linkType
    if (validatedData.ctaText !== undefined) updateData.ctaText = validatedData.ctaText || null
    if (validatedData.segmentType !== undefined) updateData.segmentType = validatedData.segmentType as any
    if (validatedData.segmentConfig !== undefined) updateData.segmentConfig = validatedData.segmentConfig
    if (validatedData.showOnDashboard !== undefined) updateData.showOnDashboard = validatedData.showOnDashboard
    if (validatedData.dashboardExpiresAt !== undefined) {
      updateData.dashboardExpiresAt = validatedData.dashboardExpiresAt 
        ? new Date(validatedData.dashboardExpiresAt)
        : null
    }
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive
    if (validatedData.displayType !== undefined) updateData.displayType = validatedData.displayType as any
    if (validatedData.bannerTemplate !== undefined) updateData.bannerTemplate = validatedData.bannerTemplate as any || null
    if (validatedData.modalTemplate !== undefined) updateData.modalTemplate = validatedData.modalTemplate as any || null
    if (validatedData.quizConfig !== undefined) updateData.quizConfig = validatedData.quizConfig || null
    if (validatedData.illustrationUrl !== undefined) updateData.illustrationUrl = validatedData.illustrationUrl || null
    if (validatedData.bannerColors !== undefined) updateData.bannerColors = validatedData.bannerColors || null

    // Atualizar campanha
    const updatedCampaign = await prisma.notificationCampaign.update({
      where: { id: campaignId },
      data: updateData
    })

    // Atualizar todas as notificações relacionadas se título ou mensagem mudaram
    if (validatedData.title !== undefined || validatedData.message !== undefined) {
      await prisma.notification.updateMany({
        where: { campaignId },
        data: {
          ...(validatedData.title !== undefined && { title: validatedData.title }),
          ...(validatedData.message !== undefined && { message: validatedData.message }),
          ...(validatedData.link !== undefined && { link: validatedData.link || null }),
          ...(validatedData.linkType !== undefined && { linkType: validatedData.linkType })
        }
      })
    }

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('❌ Erro ao atualizar campanha:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar campanha' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/notifications/campaign/[id]
 * Remove uma campanha e suas notificações (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    await requireAdminUser()

    const resolvedParams = await params
    const campaignId = resolvedParams.id

    // Verificar se campanha existe
    const existingCampaign = await prisma.notificationCampaign.findUnique({
      where: { id: campaignId },
      include: {
        _count: {
          select: { notifications: true }
        }
      }
    })

    if (!existingCampaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      )
    }

    // Deletar todas as notificações relacionadas primeiro
    await prisma.notification.deleteMany({
      where: { campaignId }
    })

    // Deletar a campanha
    await prisma.notificationCampaign.delete({
      where: { id: campaignId }
    })

    return NextResponse.json({
      success: true,
      message: `Campanha e ${existingCampaign._count.notifications} notificação(ões) removidas com sucesso`
    })
  } catch (error) {
    console.error('❌ Erro ao remover campanha:', error)
    return NextResponse.json(
      { error: 'Erro ao remover campanha' },
      { status: 500 }
    )
  }
}

