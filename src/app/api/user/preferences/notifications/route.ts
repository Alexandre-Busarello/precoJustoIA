import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/notification-service'

/**
 * GET /api/user/preferences/notifications
 * Busca preferências de notificações do usuário
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

    const preferences = await NotificationService.getUserNotificationPreferences(session.user.id)

    return NextResponse.json(preferences)
  } catch (error) {
    console.error('❌ Erro ao buscar preferências:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar preferências' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/user/preferences/notifications
 * Atualiza preferências de notificações do usuário
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { emailNotificationsEnabled } = body

    if (typeof emailNotificationsEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'emailNotificationsEnabled deve ser um boolean' },
        { status: 400 }
      )
    }

    await NotificationService.updateUserNotificationPreferences(
      session.user.id,
      emailNotificationsEnabled
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Erro ao atualizar preferências:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar preferências' },
      { status: 500 }
    )
  }
}

