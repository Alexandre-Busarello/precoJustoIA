import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requirePremiumUser } from '@/lib/user-service'
import { z } from 'zod'

const createMessageSchema = z.object({
  message: z.string().min(1, 'Mensagem não pode estar vazia').max(2000, 'Mensagem muito longa'),
  isInternal: z.boolean().optional().default(false)
})

// POST /api/tickets/[id]/messages - Adicionar mensagem ao ticket
export async function POST(
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

    const body = await request.json()
    const validatedData = createMessageSchema.parse(body)
    const resolvedParams = await params

    // Verificar se o ticket existe e se o usuário tem acesso
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: resolvedParams.id,
        // Usuários normais só podem responder seus próprios tickets
        ...(user.isAdmin ? {} : { userId: user.id })
      }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
    }

    // Verificar se o ticket está fechado
    if (ticket.status === 'CLOSED') {
      return NextResponse.json({ 
        error: 'Não é possível adicionar mensagens a um ticket fechado' 
      }, { status: 400 })
    }

    // Apenas admins podem criar mensagens internas
    const isInternal = validatedData.isInternal && user.isAdmin

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: resolvedParams.id,
        userId: user.id, // Usar o ID real do banco
        message: validatedData.message,
        isInternal
      },
      include: {
        user: {
          select: { name: true, email: true, isAdmin: true }
        }
      }
    })

    // Atualizar status do ticket baseado em quem está respondendo
    let newStatus = ticket.status
    if (user.isAdmin) {
      // Admin respondendo - muda para WAITING_USER se estava em WAITING_ADMIN
      if (ticket.status === 'WAITING_ADMIN' || ticket.status === 'OPEN') {
        newStatus = 'WAITING_USER'
      }
    } else {
      // Usuário respondendo - muda para WAITING_ADMIN se estava em WAITING_USER
      if (ticket.status === 'WAITING_USER' || ticket.status === 'OPEN') {
        newStatus = 'WAITING_ADMIN'
      }
    }

    // Atualizar o ticket se o status mudou
    if (newStatus !== ticket.status) {
      await prisma.supportTicket.update({
        where: { id: resolvedParams.id },
        data: { status: newStatus }
      })
    }

    return NextResponse.json(message, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Dados inválidos', 
        details: error.issues 
      }, { status: 400 })
    }

    console.error('Erro ao criar mensagem:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// GET /api/tickets/[id]/messages - Listar mensagens do ticket
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

    // Verificar se o ticket existe e se o usuário tem acesso
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: resolvedParams.id,
        // Usuários normais só veem seus próprios tickets
        ...(user.isAdmin ? {} : { userId: user.id })
      }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
    }

    const messages = await prisma.ticketMessage.findMany({
      where: {
        ticketId: resolvedParams.id,
        // Usuários normais não veem mensagens internas
        ...(user.isAdmin ? {} : { isInternal: false })
      },
      include: {
        user: {
          select: { name: true, email: true, isAdmin: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(messages)

  } catch (error) {
    console.error('Erro ao buscar mensagens:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
