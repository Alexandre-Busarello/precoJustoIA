import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/notification-service'

/**
 * GET /api/notifications/unread-count
 * Conta notificações não lidas do usuário autenticado
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const count = await NotificationService.getUnreadCount(session.user.id)

    return NextResponse.json({ count })
  } catch (error) {
    console.error('❌ Erro ao contar notificações não lidas:', error)
    return NextResponse.json(
      { error: 'Erro ao contar notificações' },
      { status: 500 }
    )
  }
}

