/**
 * API Route para processar mensagens do Ben
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { processBenMessageStream } from '@/lib/ben-service'
import { extractImportantInfo, consolidateMemory, shouldRegisterMemory } from '@/lib/ben-memory-service'
import { extractPageContext } from '@/lib/ben-page-context'
import { prisma } from '@/lib/prisma'
import { checkBenMessageLimit } from '@/lib/ben-message-limit-service'
import { generateBenCTAMessage } from '@/lib/ben-cta-message'

// waitUntil para garantir que tarefas assíncronas completem em ambientes serverless
// Em produção na Vercel, o waitUntil está disponível via NextResponse.waitUntil
// Para desenvolvimento local, usamos um fallback
const waitUntil = (promise: Promise<any>) => {
  promise.catch(err => console.error('Erro em waitUntil:', err))
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
    const { conversationId, message, contextUrl, pageContext: clientPageContext } = body

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: 'conversationId e message são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar limite de mensagens antes de processar
    const limitCheck = await checkBenMessageLimit(user.id)
    if (!limitCheck.allowed) {
      // Salvar mensagem do usuário primeiro
      // @ts-ignore - Prisma Client ainda não foi regenerado após migração
      await prisma.benMessage.create({
        data: {
          conversationId,
          role: 'USER',
          content: message
        }
      })

      // Criar mensagem do Ben informando sobre o limite
      const ctaMessage = generateBenCTAMessage(limitCheck.remaining)
      // @ts-ignore - Prisma Client ainda não foi regenerado após migração
      await prisma.benMessage.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: ctaMessage
        }
      })

      // Retornar sucesso para que o frontend possa refetch as mensagens
      return NextResponse.json(
        { 
          success: true,
          limitReached: true,
          message: 'Limite atingido. Mensagem do Ben criada na conversa.'
        },
        { status: 200 }
      )
    }

    // Extrair contexto completo da página (server-side)
    const pageContext = await extractPageContext(contextUrl || '/', clientPageContext)

    // Verificar se a conversa pertence ao usuário
    // @ts-ignore - Prisma Client ainda não foi regenerado após migração
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

    // Criar stream de resposta SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        try {
          // Processar mensagem via streaming
          const streamGenerator = processBenMessageStream(
            user.id,
            conversationId,
            message,
            contextUrl,
            pageContext
          )

          // Enviar chunks incrementalmente
          for await (const chunk of streamGenerator) {
            const eventType = chunk.type
            const data = JSON.stringify(chunk.data)
            
            // Enviar evento SSE no formato: event: <type>\ndata: <data>\n\n
            const sseMessage = `event: ${eventType}\ndata: ${data}\n\n`
            controller.enqueue(encoder.encode(sseMessage))
          }

          // Disparar processo paralelo de avaliação e registro de memória
          // Este processo roda em background e não bloqueia a resposta ao usuário
          waitUntil(
            (async () => {
              try {
                // Avaliar se a conversa contém informações relevantes para memória
                const evaluation = await shouldRegisterMemory(conversationId)
                
                if (evaluation.shouldRegister) {
                  console.log(`[Memória] Registrando memória para conversa ${conversationId} (score: ${evaluation.relevanceScore}, motivo: ${evaluation.reason})`)
                  
                  // Extrair informações importantes da conversa
                  const extractedInfo = await extractImportantInfo(conversationId)
                  if (extractedInfo) {
                    // Consolidar memória incluindo o ID da conversa de origem
                    await consolidateMemory(user.id, extractedInfo, conversationId)
                    console.log(`[Memória] Memória registrada com sucesso para conversa ${conversationId}`)
                  } else {
                    console.warn(`[Memória] Não foi possível extrair informações da conversa ${conversationId}`)
                  }
                } else {
                  console.log(`[Memória] Conversa ${conversationId} não contém informações relevantes (score: ${evaluation.relevanceScore}, motivo: ${evaluation.reason})`)
                }
              } catch (error) {
                console.error(`[Memória] Erro ao processar memória para conversa ${conversationId}:`, error)
              }
            })()
          )

          controller.close()
        } catch (error) {
          console.error('Erro no stream:', error)
          const errorData = JSON.stringify({
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          })
          controller.enqueue(encoder.encode(`event: error\ndata: ${errorData}\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    console.error('Erro ao processar mensagem do Ben:', error)
    return NextResponse.json(
      { 
        error: 'Erro ao processar mensagem',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

