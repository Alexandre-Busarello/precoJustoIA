import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/notification-service'

/**
 * POST /api/notifications/[id]/read
 * Marca notificação como lida
 */
export async function POST(
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

    const resolvedParams = await params
    const notificationId = resolvedParams.id

    await NotificationService.markAsRead(notificationId, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Erro ao marcar notificação como lida:', error)
    return NextResponse.json(
      { error: 'Erro ao marcar notificação como lida' },
      { status: 500 }
    )
  }
}

