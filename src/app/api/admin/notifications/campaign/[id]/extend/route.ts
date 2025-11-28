import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { NotificationService } from '@/lib/notification-service'
import { z } from 'zod'

const extendCampaignSchema = z.object({
  sendEmail: z.boolean().optional().default(false)
})

/**
 * POST /api/admin/notifications/campaign/[id]/extend
 * Estende uma campanha existente criando notificações apenas para novos usuários
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

    const body = await request.json()
    const validationResult = extendCampaignSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { sendEmail } = validationResult.data

    const result = await NotificationService.extendCampaignForNewUsers(
      campaignId,
      sendEmail
    )

    return NextResponse.json({
      success: true,
      newNotificationsCreated: result.newNotificationsCreated,
      newUsersCount: result.newUsersCount
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

    console.error('❌ Erro ao estender campanha:', error)
    return NextResponse.json(
      { error: 'Erro ao estender campanha' },
      { status: 500 }
    )
  }
}

