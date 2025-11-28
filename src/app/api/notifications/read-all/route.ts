import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/notification-service'

/**
 * POST /api/notifications/read-all
 * Marca todas as notificações do usuário como lidas
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

    const count = await NotificationService.markAllAsRead(session.user.id)

    return NextResponse.json({ success: true, count })
  } catch (error) {
    console.error('❌ Erro ao marcar todas as notificações como lidas:', error)
    return NextResponse.json(
      { error: 'Erro ao marcar notificações como lidas' },
      { status: 500 }
    )
  }
}

