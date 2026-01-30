/**
 * API Route para gerenciar conversas do Ben
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const conversations = await prisma.benConversation.findMany({
      where: { userId: user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Última mensagem para preview
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50
    })

    return NextResponse.json({
      success: true,
      conversations: conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        contextUrl: conv.contextUrl,
        shareToken: conv.shareToken,
        sharedAt: conv.sharedAt,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        lastMessage: conv.messages[0]?.content || null,
        messageCount: conv._count.messages
      }))
    })
  } catch (error) {
    console.error('Erro ao listar conversas:', error)
    return NextResponse.json(
      { error: 'Erro ao listar conversas' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { title, contextUrl } = body

    // Extrair título da URL se não fornecido
    let conversationTitle = title
    if (!conversationTitle && contextUrl) {
      // Tentar extrair ticker ou nome da página da URL
      const urlMatch = contextUrl.match(/\/(acao|etf|fii|bdr)\/([^\/]+)/)
      if (urlMatch) {
        conversationTitle = `Conversa sobre ${urlMatch[2]}`
      } else {
        conversationTitle = 'Nova conversa'
      }
    }

    const conversation = await prisma.benConversation.create({
      data: {
        userId: user.id,
        title: conversationTitle || 'Nova conversa',
        contextUrl: contextUrl || null
      }
    })

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        contextUrl: conversation.contextUrl,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      }
    })
  } catch (error) {
    console.error('Erro ao criar conversa:', error)
    return NextResponse.json(
      { error: 'Erro ao criar conversa' },
      { status: 500 }
    )
  }
}

