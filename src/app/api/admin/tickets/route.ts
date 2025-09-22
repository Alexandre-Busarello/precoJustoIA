import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'

// GET /api/admin/tickets - Listar todos os tickets (apenas admins)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se é admin - ÚNICA FONTE DA VERDADE
    const user = await requireAdminUser()

    if (!user) {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem acessar este endpoint.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')
    const assignedTo = searchParams.get('assignedTo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const where: any = {}
    
    if (status) where.status = status
    if (priority) where.priority = priority
    if (category) where.category = category
    if (assignedTo === 'unassigned') {
      where.assignedTo = null
    } else if (assignedTo && assignedTo !== 'all') {
      where.assignedTo = assignedTo
    }

    const [tickets, total, stats] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          user: {
            select: { name: true, email: true, subscriptionTier: true }
          },
          assignee: {
            select: { name: true, email: true }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              user: {
                select: { name: true, email: true, isAdmin: true }
              }
            }
          },
          _count: {
            select: { messages: true }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: offset,
        take: limit
      }),
      prisma.supportTicket.count({ where }),
      // Estatísticas gerais
      prisma.supportTicket.groupBy({
        by: ['status'],
        _count: true
      })
    ])

    // Estatísticas por prioridade
    const priorityStats = await prisma.supportTicket.groupBy({
      by: ['priority'],
      _count: true,
      where: {
        status: {
          in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'WAITING_ADMIN']
        }
      }
    })

    // Tickets não atribuídos
    const unassignedCount = await prisma.supportTicket.count({
      where: {
        assignedTo: null,
        status: {
          in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'WAITING_ADMIN']
        }
      }
    })

    return NextResponse.json({
      tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        byStatus: stats.reduce((acc, item) => {
          acc[item.status] = item._count
          return acc
        }, {} as Record<string, number>),
        byPriority: priorityStats.reduce((acc, item) => {
          acc[item.priority] = item._count
          return acc
        }, {} as Record<string, number>),
        unassigned: unassignedCount
      }
    })

  } catch (error) {
    console.error('Erro ao buscar tickets (admin):', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
