import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/notification-service'

/**
 * GET /api/notifications/process-active-campaigns
 * Processa campanhas ativas para o usuário autenticado
 * Cria notificações apenas para campanhas ativas que o usuário ainda não recebeu
 * e que o usuário pertence ao segmento da campanha
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

    const userId = session.user.id

    const result = await NotificationService.processActiveCampaignsForUser(userId)

    return NextResponse.json({
      success: true,
      processed: result.processed
    })
  } catch (error) {
    console.error('❌ Erro ao processar campanhas ativas:', error)
    return NextResponse.json(
      { error: 'Erro ao processar campanhas ativas' },
      { status: 500 }
    )
  }
}

