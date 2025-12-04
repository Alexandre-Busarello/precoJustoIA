import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/notification-service'

/**
 * POST /api/notifications/quiz/[campaignId]/submit
 * Submete respostas do quiz
 */
export async function POST(
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
    const body = await request.json()
    const { responses } = body

    if (!responses || typeof responses !== 'object') {
      return NextResponse.json(
        { error: 'Respostas inválidas' },
        { status: 400 }
      )
    }

    await NotificationService.submitQuizResponse(
      session.user.id,
      resolvedParams.campaignId,
      responses
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ Erro ao submeter quiz:', error)
    
    if (error.message?.includes('já foi respondido')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao submeter quiz' },
      { status: 500 }
    )
  }
}

