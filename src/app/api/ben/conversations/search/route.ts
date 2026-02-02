/**
 * API Route para buscar conversas do Ben
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

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const sort = searchParams.get('sort') || 'updatedAt'
    const order = searchParams.get('order') || 'desc'

    // Construir query de busca
    const where: any = {
      userId: user.id
    }

    if (q.trim().length > 0) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        {
          messages: {
            some: {
              content: { contains: q, mode: 'insensitive' }
            }
          }
        }
      ]
    }

    // Construir ordenação
    const orderBy: any = {}
    if (sort === 'title') {
      orderBy.title = order
    } else if (sort === 'createdAt') {
      orderBy.createdAt = order
    } else {
      orderBy.updatedAt = order
    }

    const conversations = await prisma.benConversation.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Última mensagem para preview
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy,
      take: 100 // Limite maior para busca
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
    console.error('Erro ao buscar conversas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar conversas' },
      { status: 500 }
    )
  }
}



