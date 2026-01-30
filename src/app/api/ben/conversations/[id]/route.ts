/**
 * API Route para atualizar e deletar conversas do Ben
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const { id: conversationId } = await params
    const body = await request.json()
    const { title } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Título é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se a conversa pertence ao usuário
    const conversation = await prisma.benConversation.findUnique({
      where: { id: conversationId },
      select: { userId: true }
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversa não encontrada' },
        { status: 404 }
      )
    }

    if (conversation.userId !== user.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // Atualizar título
    const updated = await prisma.benConversation.update({
      where: { id: conversationId },
      data: {
        title: title.trim(),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      conversation: {
        id: updated.id,
        title: updated.title,
        updatedAt: updated.updatedAt
      }
    })
  } catch (error) {
    console.error('Erro ao atualizar conversa:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar conversa' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const { id: conversationId } = await params

    // Verificar se a conversa pertence ao usuário
    const conversation = await prisma.benConversation.findUnique({
      where: { id: conversationId },
      select: { userId: true }
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversa não encontrada' },
        { status: 404 }
      )
    }

    if (conversation.userId !== user.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // Deletar conversa (mensagens serão deletadas em cascade)
    await prisma.benConversation.delete({
      where: { id: conversationId }
    })

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Erro ao deletar conversa:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar conversa' },
      { status: 500 }
    )
  }
}


