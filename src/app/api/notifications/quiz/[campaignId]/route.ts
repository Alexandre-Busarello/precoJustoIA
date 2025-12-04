import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/notification-service'

/**
 * GET /api/notifications/quiz/[campaignId]
 * Busca configuração do quiz se ainda não foi respondido
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const resolvedParams = await params

    // Buscar informações do quiz (mesmo se já foi respondido)
    const quizInfo = await NotificationService.getQuizInfo(
      session.user.id,
      resolvedParams.campaignId
    )

    if (!quizInfo) {
      return NextResponse.json(
        { error: 'Quiz não encontrado' },
        { status: 404 }
      )
    }

    // Se já foi respondido, retornar com flag isCompleted
    if (quizInfo.isCompleted) {
      return NextResponse.json({ 
        quiz: {
          ...quizInfo,
          isCompleted: true
        },
        isCompleted: true 
      })
    }

    // Se não foi respondido, retornar normalmente
    return NextResponse.json({ quiz: quizInfo, isCompleted: false })
  } catch (error) {
    console.error('❌ Erro ao buscar quiz:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar quiz' },
      { status: 500 }
    )
  }
}

