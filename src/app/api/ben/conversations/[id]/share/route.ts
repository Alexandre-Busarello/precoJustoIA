/**
 * API Route para compartilhar/descompartilhar conversas do Ben
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

export async function POST(
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

    const { id } = await params
    const conversationId = id

    // Verificar se a conversa pertence ao usuário
    const conversation = await prisma.benConversation.findUnique({
      where: { id: conversationId },
      select: { userId: true, shareToken: true }
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

    // Gerar token único se não existir
    let shareToken = conversation.shareToken
    if (!shareToken) {
      shareToken = randomBytes(32).toString('hex')
    }

    // Atualizar conversa com token e data de compartilhamento
    await prisma.benConversation.update({
      where: { id: conversationId },
      data: {
        shareToken,
        sharedAt: new Date()
      }
    })

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/share/ben/${shareToken}`

    return NextResponse.json({
      success: true,
      shareToken,
      shareUrl
    })
  } catch (error) {
    console.error('Erro ao compartilhar conversa:', error)
    return NextResponse.json(
      { error: 'Erro ao compartilhar conversa' },
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

    const { id } = await params
    const conversationId = id

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

    // Remover token de compartilhamento
    await prisma.benConversation.update({
      where: { id: conversationId },
      data: {
        shareToken: null,
        sharedAt: null
      }
    })

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Erro ao descompartilhar conversa:', error)
    return NextResponse.json(
      { error: 'Erro ao descompartilhar conversa' },
      { status: 500 }
    )
  }
}

