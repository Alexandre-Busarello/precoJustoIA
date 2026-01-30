/**
 * API Route para gerenciar memória do Ben
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { getUserMemory, buildMemoryContext } from '@/lib/ben-memory-service'
import { extractImportantInfo, consolidateMemory } from '@/lib/ben-memory-service'
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
    const contextUrl = searchParams.get('contextUrl') || undefined

    const memories = await getUserMemory(user.id, contextUrl)
    const memoryContext = await buildMemoryContext(user.id, contextUrl)

    return NextResponse.json({
      success: true,
      memories: memories.map(m => ({
        id: m.id,
        category: m.category,
        key: m.key,
        content: m.content,
        metadata: m.metadata,
        importance: m.importance,
        relevanceScore: m.relevanceScore,
        lastAccessed: m.lastAccessed,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt
      })),
      memoryContext
    })
  } catch (error) {
    console.error('Erro ao buscar memória:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar memória' },
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
    const { conversationId } = body

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se a conversa pertence ao usuário
    const conversation = await prisma.benConversation.findUnique({
      where: { id: conversationId },
      select: { userId: true }
    })

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json(
        { error: 'Conversa não encontrada ou acesso negado' },
        { status: 404 }
      )
    }

    // Forçar extração e consolidação de memória
    const extractedInfo = await extractImportantInfo(conversationId)
    if (extractedInfo) {
      await consolidateMemory(user.id, extractedInfo, conversationId)
    }

    return NextResponse.json({
      success: true,
      message: 'Memória consolidada com sucesso'
    })
  } catch (error) {
    console.error('Erro ao consolidar memória:', error)
    return NextResponse.json(
      { error: 'Erro ao consolidar memória' },
      { status: 500 }
    )
  }
}

