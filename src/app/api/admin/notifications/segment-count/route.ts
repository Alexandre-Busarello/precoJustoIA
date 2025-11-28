import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { NotificationService, NotificationSegmentType } from '@/lib/notification-service'

/**
 * POST /api/admin/notifications/segment-count
 * Conta quantos usuários serão afetados por um segmento (admin only)
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

    // Verificar se é admin
    await requireAdminUser()

    const body = await request.json()
    const { segmentType, segmentConfig } = body

    if (!segmentType) {
      return NextResponse.json(
        { error: 'segmentType é obrigatório' },
        { status: 400 }
      )
    }

    const count = await NotificationService.countSegmentUsers(
      segmentType as NotificationSegmentType,
      segmentConfig || {}
    )

    return NextResponse.json({
      success: true,
      count
    })
  } catch (error: any) {
    console.error('❌ Erro ao contar usuários do segmento:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao contar usuários do segmento' },
      { status: 500 }
    )
  }
}

