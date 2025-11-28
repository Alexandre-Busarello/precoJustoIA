import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { NotificationService } from '@/lib/notification-service'

/**
 * GET /api/admin/notifications/campaign/[id]/new-users-count
 * Conta quantos novos usuários receberiam notificação se a campanha fosse estendida
 */
export async function GET(
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

    await requireAdminUser()

    const resolvedParams = await params
    const campaignId = resolvedParams.id

    const count = await NotificationService.countNewUsersForCampaign(campaignId)

    return NextResponse.json({
      success: true,
      count
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Campanha não encontrada') {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }
    }

    console.error('❌ Erro ao contar novos usuários:', error)
    return NextResponse.json(
      { error: 'Erro ao contar novos usuários' },
      { status: 500 }
    )
  }
}

