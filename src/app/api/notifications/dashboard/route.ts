import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/notification-service'

/**
 * GET /api/notifications/dashboard
 * Busca notificação destacada para dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { notification: null },
        { status: 200 }
      )
    }

    const notification = await NotificationService.getDashboardNotification(session.user.id)

    return NextResponse.json({ notification })
  } catch (error) {
    console.error('❌ Erro ao buscar notificação do dashboard:', error)
    return NextResponse.json(
      { notification: null },
      { status: 200 }
    )
  }
}

