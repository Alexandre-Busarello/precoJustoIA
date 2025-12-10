import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/notifications/campaigns
 * Lista todas as campanhas criadas (admin only)
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

    // Verificar se é admin
    await requireAdminUser()

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const [campaigns, total] = await Promise.all([
      prisma.notificationCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { notifications: true }
          }
        }
      }),
      prisma.notificationCampaign.count()
    ])

    // Recalcular estatísticas para cada campanha baseado nas notificações reais
    const campaignsWithStats = await Promise.all(
      campaigns.map(async (c) => {
        const [totalSent, totalRead] = await Promise.all([
          prisma.notification.count({
            where: { campaignId: c.id }
          }),
          prisma.notification.count({
            where: { 
              campaignId: c.id,
              isRead: true
            }
          })
        ])

        // Buscar stats existentes para preservar totalClicked se existir
        const existingStats = c.stats as { totalClicked?: number } | null

        const updatedStats = {
          totalSent,
          totalRead,
          totalClicked: existingStats?.totalClicked || 0
        }

        // Atualizar stats no banco se mudou
        const currentStats = c.stats as { totalSent?: number; totalRead?: number; totalClicked?: number } | null
        if (!currentStats || currentStats.totalRead !== totalRead || currentStats.totalSent !== totalSent) {
          await prisma.notificationCampaign.update({
            where: { id: c.id },
            data: { stats: updatedStats }
          })
        }

        return {
          id: c.id,
          title: c.title,
          message: c.message,
          link: c.link,
          linkType: c.linkType,
          ctaText: (c as any).ctaText || null,
          segmentType: c.segmentType,
          segmentConfig: c.segmentConfig,
          showOnDashboard: c.showOnDashboard,
          dashboardExpiresAt: c.dashboardExpiresAt,
          isActive: (c as any).isActive ?? true,
          stats: updatedStats,
          createdAt: c.createdAt,
          notificationCount: c._count.notifications
        }
      })
    )

    return NextResponse.json({
      campaigns: campaignsWithStats,
      total,
      page,
      limit,
      hasMore: skip + campaigns.length < total
    })
  } catch (error) {
    console.error('❌ Erro ao listar campanhas:', error)
    return NextResponse.json(
      { error: 'Erro ao listar campanhas' },
      { status: 500 }
    )
  }
}

