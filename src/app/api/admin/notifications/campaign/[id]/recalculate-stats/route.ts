import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { NotificationService } from '@/lib/notification-service'

/**
 * POST /api/admin/notifications/campaign/[id]/recalculate-stats
 * Recalcula estatísticas de uma campanha manualmente (admin only)
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

    await requireAdminUser()

    const resolvedParams = await params
    const campaignId = resolvedParams.id

    // Usar método privado através de um método público temporário
    // Ou criar um método público para isso
    await (NotificationService as any).recalculateCampaignStats(campaignId)

    return NextResponse.json({
      success: true,
      message: 'Estatísticas recalculadas com sucesso'
    })
  } catch (error: any) {
    console.error('❌ Erro ao recalcular estatísticas:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao recalcular estatísticas' },
      { status: 500 }
    )
  }
}

