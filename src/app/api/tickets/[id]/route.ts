import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requirePremiumUser, requireAdminUser } from '@/lib/user-service'
import { z } from 'zod'

const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'WAITING_ADMIN', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().optional().nullable()
})

// GET /api/tickets/[id] - Buscar ticket específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar se é usuário Premium - ÚNICA FONTE DA VERDADE
    const user = await requirePremiumUser()
    
    if (!user) {
      return NextResponse.json({ 
        error: 'Acesso Premium necessário para usar a Central de Tickets' 
      }, { status: 403 })
    }

    const resolvedParams = await params

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: resolvedParams.id,
        // Usuários normais só veem seus próprios tickets, admins veem todos
        ...(user.isAdmin ? {} : { userId: user.id })
      },
      include: {
        user: {
          select: { name: true, email: true }
        },
        assignee: {
          select: { name: true, email: true }
        },
        messages: {
          where: {
            // Usuários normais não veem mensagens internas
            ...(user?.isAdmin ? {} : { isInternal: false })
          },
          include: {
            user: {
              select: { name: true, email: true, isAdmin: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
    }

    return NextResponse.json(ticket)

  } catch (error) {
    console.error('Erro ao buscar ticket:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PATCH /api/tickets/[id] - Atualizar ticket (apenas admins)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se é admin - ÚNICA FONTE DA VERDADE
    const user = await requireAdminUser()

    if (!user) {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem atualizar tickets.' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateTicketSchema.parse(body)
    const resolvedParams = await params

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: resolvedParams.id }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
    }

    const updateData: any = {}
    
    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status
      if (validatedData.status === 'CLOSED' || validatedData.status === 'RESOLVED') {
        updateData.closedAt = new Date()
      }
    }
    
    if (validatedData.priority !== undefined) {
      updateData.priority = validatedData.priority
    }
    
    if (validatedData.assignedTo !== undefined) {
      updateData.assignedTo = validatedData.assignedTo
    }

    const updatedTicket = await prisma.supportTicket.update({
      where: { id: resolvedParams.id },
      data: updateData,
      include: {
        user: {
          select: { name: true, email: true }
        },
        assignee: {
          select: { name: true, email: true }
        },
        messages: {
          include: {
            user: {
              select: { name: true, email: true, isAdmin: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    return NextResponse.json(updatedTicket)

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Dados inválidos', 
        details: error.issues 
      }, { status: 400 })
    }

    console.error('Erro ao atualizar ticket:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
