import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/notification-service'

/**
 * POST /api/notifications/modal/[campaignId]/viewed
 * Marca modal como vista
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
    const body = await request.json().catch(() => ({}))
    const dismissed = body.dismissed === true

    await NotificationService.markModalAsViewed(
      session.user.id,
      resolvedParams.campaignId,
      dismissed
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Erro ao marcar modal como vista:', error)
    return NextResponse.json(
      { error: 'Erro ao marcar modal como vista' },
      { status: 500 }
    )
  }
}

