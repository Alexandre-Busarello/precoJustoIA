import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/quizzes/[campaignId]
 * Busca detalhes de um quiz específico com todas as respostas
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    await requireAdminUser()

    const resolvedParams = await params
    const { campaignId } = resolvedParams

    // Buscar campanha do quiz
    const campaign = await prisma.notificationCampaign.findUnique({
      where: { id: campaignId },
      include: {
        _count: {
          select: {
            notifications: true,
            quizResponses: true
          }
        }
      }
    })

    if (!campaign || (campaign as any).displayType !== 'QUIZ') {
      return NextResponse.json(
        { error: 'Quiz não encontrado' },
        { status: 404 }
      )
    }

    // Buscar todas as respostas do quiz
    const responses = await (prisma as any).quizResponse.findMany({
      where: { campaignId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { completedAt: 'desc' }
    })

    const totalResponses = responses.length
    const totalNotifications = (campaign as any)._count.notifications

    return NextResponse.json({
      quiz: {
        id: campaign.id,
        title: campaign.title,
        message: campaign.message,
        quizConfig: (campaign as any).quizConfig,
        createdAt: campaign.createdAt,
        dashboardExpiresAt: campaign.dashboardExpiresAt,
        totalNotifications,
        totalResponses,
        responseRate: totalNotifications > 0 
          ? ((totalResponses / totalNotifications) * 100).toFixed(1)
          : '0.0'
      },
      responses: responses.map((r: any) => ({
        id: r.id,
        userId: r.userId,
        userName: r.user.name || r.user.email,
        userEmail: r.user.email,
        responses: r.responses,
        completedAt: r.completedAt
      }))
    })
  } catch (error) {
    console.error('❌ Erro ao buscar detalhes do quiz:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar detalhes do quiz' },
      { status: 500 }
    )
  }
}

