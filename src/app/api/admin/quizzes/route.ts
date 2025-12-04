import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/quizzes
 * Lista todos os quizzes criados com estatísticas
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    await requireAdminUser()

    const quizzes = await prisma.notificationCampaign.findMany({
      where: {
        displayType: 'QUIZ' as any
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            notifications: true,
            quizResponses: true
          }
        }
      }
    })

    const quizzesWithStats = quizzes.map((quiz) => {
      const totalNotifications = (quiz as any)._count.notifications || 0
      const totalResponses = (quiz as any)._count.quizResponses || 0

      return {
        id: quiz.id,
        title: quiz.title,
        message: quiz.message,
        createdAt: quiz.createdAt,
        dashboardExpiresAt: quiz.dashboardExpiresAt,
        totalNotifications,
        totalResponses,
        responseRate: totalNotifications > 0 
          ? ((totalResponses / totalNotifications) * 100).toFixed(1)
          : '0.0'
      }
    })

    return NextResponse.json({ quizzes: quizzesWithStats })
  } catch (error) {
    console.error('❌ Erro ao buscar quizzes:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar quizzes' },
      { status: 500 }
    )
  }
}

