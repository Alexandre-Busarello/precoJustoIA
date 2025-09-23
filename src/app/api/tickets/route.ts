import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePremiumUser } from '@/lib/user-service'
import { inferTicketPriority, explainPriorityReason } from '@/lib/ticket-priority-inference'
import { z } from 'zod'

const createTicketSchema = z.object({
  title: z.string().min(5, 'Título deve ter pelo menos 5 caracteres').max(200, 'Título muito longo'),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres').max(2000, 'Descrição muito longa'),
  category: z.enum(['GENERAL', 'TECHNICAL', 'BILLING', 'FEATURE_REQUEST', 'BUG_REPORT', 'ACCOUNT'])
  // Removido priority - será inferido automaticamente
})

// GET /api/tickets - Listar tickets do usuário
export async function GET(request: NextRequest) {
  try {
    // Verificar se é usuário Premium - ÚNICA FONTE DA VERDADE
    const user = await requirePremiumUser()
    
    if (!user) {
      return NextResponse.json({ 
        error: 'Acesso Premium necessário para usar a Central de Tickets' 
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    const where = {
      userId: user.id, // Usar o ID real do banco
      ...(status && { status: status as any })
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              user: {
                select: { name: true, email: true, isAdmin: true }
              }
            }
          },
          assignee: {
            select: { name: true, email: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.supportTicket.count({ where })
    ])

    return NextResponse.json({
      tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Erro ao buscar tickets:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST /api/tickets - Criar novo ticket
export async function POST(request: NextRequest) {
  try {
    // Verificar se é usuário Premium - ÚNICA FONTE DA VERDADE
    const user = await requirePremiumUser()
    
    if (!user) {
      return NextResponse.json({ 
        error: 'Acesso Premium necessário para usar a Central de Tickets' 
      }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createTicketSchema.parse(body)

    // Verificar limite de tickets abertos por usuário (máximo 5)
    const openTicketsCount = await prisma.supportTicket.count({
      where: {
        userId: user.id, // Usar o ID real do banco
        status: {
          in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'WAITING_ADMIN']
        }
      }
    })

    if (openTicketsCount >= 5) {
      return NextResponse.json({ 
        error: 'Você já possui o máximo de 5 tickets abertos. Aguarde a resolução de alguns antes de criar novos.' 
      }, { status: 429 })
    }

    // Inferir prioridade automaticamente baseado na categoria e descrição
    const inferredPriority = inferTicketPriority(validatedData.category, validatedData.description)
    const priorityReason = explainPriorityReason(validatedData.category, validatedData.description, inferredPriority)
    
    console.log(`🎯 Prioridade inferida: ${inferredPriority} - ${priorityReason}`)

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id, // Usar o ID real do banco
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        priority: inferredPriority, // Prioridade inferida automaticamente
        status: 'OPEN'
      },
      include: {
        messages: {
          include: {
            user: {
              select: { name: true, email: true, isAdmin: true }
            }
          }
        },
        assignee: {
          select: { name: true, email: true }
        }
      }
    })

    // Criar mensagem inicial com a descrição
    await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        userId: user.id, // Usar o ID real do banco
        message: validatedData.description,
        isInternal: false
      }
    })

    return NextResponse.json(ticket, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Dados inválidos', 
        details: error.issues 
      }, { status: 400 })
    }

    console.error('Erro ao criar ticket:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
