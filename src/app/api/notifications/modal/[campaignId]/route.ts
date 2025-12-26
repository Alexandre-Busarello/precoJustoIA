import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/notifications/modal/[campaignId]
 * Busca dados completos de uma campanha modal por campaignId (mesmo que já tenha sido vista)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const { campaignId } = await params

    // Buscar campanha e verificar se o usuário tem notificação relacionada
    const campaign = await prisma.notificationCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        title: true,
        message: true,
        link: true,
        linkType: true,
        ctaText: true,
        modalTemplate: true,
        illustrationUrl: true,
        displayType: true,
        notifications: {
          where: {
            userId: session.user.id
          },
          take: 1,
          select: {
            id: true
          }
        }
      }
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se o usuário tem notificação relacionada a esta campanha
    if (campaign.notifications.length === 0) {
      return NextResponse.json(
        { error: 'Você não tem acesso a esta campanha' },
        { status: 403 }
      )
    }

    // Verificar se é do tipo MODAL
    if (campaign.displayType !== 'MODAL') {
      return NextResponse.json(
        { error: 'Esta campanha não é do tipo MODAL' },
        { status: 400 }
      )
    }

    // Buscar a notificação completa para obter título e mensagem personalizados
    const notificationId = campaign.notifications[0].id
    const fullNotification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { title: true, message: true }
    })

    return NextResponse.json({
      notification: {
        id: notificationId,
        campaignId: campaign.id,
        title: fullNotification?.title || campaign.title,
        message: fullNotification?.message || campaign.message,
        link: campaign.link,
        linkType: campaign.linkType,
        ctaText: campaign.ctaText,
        modalTemplate: campaign.modalTemplate,
        illustrationUrl: campaign.illustrationUrl,
        displayType: campaign.displayType
      }
    })
  } catch (error) {
    console.error('❌ Erro ao buscar campanha modal:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar campanha' },
      { status: 500 }
    )
  }
}

