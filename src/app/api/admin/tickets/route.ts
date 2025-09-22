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

    // Buscar todos os tickets primeiro para calcular urgência
    const allTickets = await prisma.supportTicket.findMany({
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
          include: {
            user: {
              select: { name: true, email: true, isAdmin: true }
            }
          }
        },
        _count: {
          select: { messages: true }
        }
      }
    })

    // Calcular urgência baseada no tempo sem resposta do admin
    const now = new Date()
    const ticketsWithUrgency = allTickets.map(ticket => {
      let isUrgentByTime = false
      let hoursSinceLastAdminResponse = 0

      // Verificar se há mensagens
      if (ticket.messages.length > 0) {
        // Encontrar a última mensagem do admin
        const lastAdminMessage = ticket.messages.find(msg => msg.user.isAdmin)
        const lastUserMessage = ticket.messages[0] // Mais recente

        if (lastAdminMessage) {
          // Se a última mensagem foi do usuário após a última do admin
          if (!lastUserMessage.user.isAdmin && lastUserMessage.createdAt > lastAdminMessage.createdAt) {
            const hoursDiff = (now.getTime() - lastUserMessage.createdAt.getTime()) / (1000 * 60 * 60)
            hoursSinceLastAdminResponse = hoursDiff
            isUrgentByTime = hoursDiff > 48
          }
        } else {
          // Nunca houve resposta do admin
          const hoursDiff = (now.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60)
          hoursSinceLastAdminResponse = hoursDiff
          isUrgentByTime = hoursDiff > 48
        }
      } else {
        // Ticket sem mensagens
        const hoursDiff = (now.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60)
        hoursSinceLastAdminResponse = hoursDiff
        isUrgentByTime = hoursDiff > 48
      }

      return {
        ...ticket,
        isUrgentByTime,
        hoursSinceLastAdminResponse,
        // Atualizar prioridade se urgente por tempo
        priority: isUrgentByTime && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' 
          ? 'URGENT' as const 
          : ticket.priority,
        messages: ticket.messages.slice(0, 1) // Manter apenas a última mensagem para performance
      }
    })

    // Ordenar: urgentes por tempo primeiro, depois por prioridade, depois por data
    const sortedTickets = ticketsWithUrgency.sort((a, b) => {
      // Primeiro: tickets urgentes por tempo
      if (a.isUrgentByTime && !b.isUrgentByTime) return -1
      if (!a.isUrgentByTime && b.isUrgentByTime) return 1
      
      // Segundo: prioridade
      const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder]
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder]
      if (aPriority !== bPriority) return bPriority - aPriority
      
      // Terceiro: data de criação (mais antigos primeiro)
      return a.createdAt.getTime() - b.createdAt.getTime()
    })

    // Aplicar paginação
    const tickets = sortedTickets.slice(offset, offset + limit)
    const total = sortedTickets.length

    // Estatísticas gerais
    const stats = await prisma.supportTicket.groupBy({
      by: ['status'],
      _count: true
    })

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
