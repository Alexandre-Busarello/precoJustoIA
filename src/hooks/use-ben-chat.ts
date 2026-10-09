/**
 * Hook para gerenciar chat do Ben
 */

'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import type { ChunkMetadata } from '@/lib/ben-service'
import type { BenPageContext } from '@/lib/ben-context/types'
import {
  appendPendingAnswer,
  finishPendingAsk,
  getPendingAsk,
  resolvePageContext,
  startPendingAsk,
  subscribePendingAsks,
  type PendingAsk,
} from '@/lib/ben-context/store'

interface BenConversation {
  id: string
  title: string
  contextUrl: string | null
  shareToken: string | null
  sharedAt: Date | null
  createdAt: Date
  updatedAt: Date
  lastMessage: string | null
  messageCount: number
}

interface BenMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  createdAt: Date
  toolCalls?: any
}

/** Contexto antigo do chat (`pageType` lido do pathname); o novo é `BenPageContext` (campo `kind`). */
interface LegacyPageContext {
  pageType: string
  ticker?: string
}

interface SendMessageParams {
  conversationId: string
  message: string
  /** Contexto da tela. Sem ele (ou no formato antigo), vale o da rota completado pelo registrado pela página. */
  pageContext?: Partial<BenPageContext> | LegacyPageContext
}

/** Contexto enviado ao servidor: rota + o registrado pela página + o informado na chamada. */
function requestContext(pathname: string, pageContext: SendMessageParams['pageContext']): BenPageContext {
  const provided = pageContext && 'kind' in pageContext ? pageContext : null
  return resolvePageContext(pathname, provided)
}

interface TextChunkData {
  text: string
  metadata: ChunkMetadata
}

/**
 * Hook para listar conversas do Ben
 */
export function useBenConversations() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['ben-conversations'],
    queryFn: async () => {
      const response = await fetch('/api/ben/conversations')
      if (!response.ok) {
        throw new Error('Erro ao buscar conversas')
      }
      const data = await response.json()
      return data.conversations as BenConversation[]
    },
    enabled: !!session
  })
}

/**
 * Hook para criar nova conversa
 */
export function useCreateBenConversation() {
  const queryClient = useQueryClient()
  const pathname = usePathname()

  return useMutation({
    mutationFn: async (title?: string) => {
      const response = await fetch('/api/ben/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          contextUrl: pathname
        })
      })

      if (!response.ok) {
        throw new Error('Erro ao criar conversa')
      }

      const data = await response.json()
      return data.conversation as BenConversation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ben-conversations'] })
    }
  })
}

/**
 * Hook para enviar mensagem ao Ben
 */
export function useSendBenMessage() {
  const queryClient = useQueryClient()
  const pathname = usePathname()

  return useMutation({
    mutationFn: async ({ conversationId, message, pageContext }: SendMessageParams) => {
      const response = await fetch('/api/ben/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId,
          message,
          contextUrl: pathname,
          pageContext: requestContext(pathname, pageContext)
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao enviar mensagem')
      }

      const data = await response.json()
      return data
    },
    onSuccess: (_, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['ben-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['ben-messages', variables.conversationId] })
    }
  })
}

/**
 * Hook para enviar mensagem ao Ben com streaming SSE
 */
export function useSendBenMessageStream() {
  const queryClient = useQueryClient()
  const pathname = usePathname()

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      message,
      pageContext,
      onChunk 
    }: SendMessageParams & { 
      onChunk?: (chunk: { type: string; data: any | TextChunkData }) => void
    }) => {
      const response = await fetch('/api/ben/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId,
          message,
          contextUrl: pathname,
          pageContext: requestContext(pathname, pageContext)
        })
      })

      if (!response.ok) {
        // Tentar ler erro como JSON primeiro
        try {
          const errorData = await response.json()
          // Criar erro customizado com dados completos para tratamento no componente
          const error = new Error(errorData.error || 'Erro ao enviar mensagem') as any
          error.response = { status: response.status, data: errorData }
          error.data = errorData
          throw error
        } catch (err) {
          // Se não conseguir parsear JSON, lançar erro genérico
          if (err instanceof Error && 'response' in err) {
            throw err
          }
          throw new Error(`Erro HTTP ${response.status}`)
        }
      }

      // Verificar se é streaming response
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('text/event-stream')) {
        // Processar SSE incrementalmente
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let finalResult: any = null

        if (!reader) {
          throw new Error('Stream não disponível')
        }

        while (true) {
          const { done, value } = await reader.read()
          
          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          
          // Processar eventos SSE completos (terminados com \n\n)
          let eventEndIndex = buffer.indexOf('\n\n')
          
          while (eventEndIndex !== -1) {
            const eventText = buffer.substring(0, eventEndIndex)
            buffer = buffer.substring(eventEndIndex + 2)
            
            // Parsear evento SSE
            const lines = eventText.split('\n')
            let eventType = ''
            let eventData = ''
            
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.substring(7).trim()
              } else if (line.startsWith('data: ')) {
                // Pode haver múltiplas linhas de data, concatenar todas
                const dataLine = line.substring(6).trim()
                if (eventData) {
                  eventData += '\n' + dataLine
                } else {
                  eventData = dataLine
                }
              }
            }
            
            if (eventData) {
              try {
                // O eventData contém apenas o valor JSON do campo 'data' do SSE
                const dataValue = JSON.parse(eventData)
                // Criar objeto no formato esperado pelo onChunk
                const parsed = {
                  type: eventType || 'text',
                  data: dataValue
                }
                
                // Chamar onChunk imediatamente para cada chunk recebido
                if (onChunk) {
                  onChunk(parsed)
                }

                if (parsed.type === 'done') {
                  finalResult = parsed.data
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.data.error || 'Erro no stream')
                }
              } catch (parseError) {
                console.warn('Erro ao parsear evento SSE:', parseError, 'Data:', eventData.substring(0, 100))
              }
            }
            
            // Procurar próximo evento
            eventEndIndex = buffer.indexOf('\n\n')
          }
        }

        return finalResult || { success: true, message: '', toolCalls: null }
      } else {
        // Fallback para resposta JSON normal
        const data = await response.json()
        
        // Se limite foi atingido, refetch mensagens para mostrar a mensagem do Ben
        if (data.limitReached) {
          queryClient.invalidateQueries({ queryKey: ['ben-messages', conversationId] })
        }
        
        return data
      }
    },
    onSuccess: (result, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['ben-conversations'] })
      
      // Se limite foi atingido, refetch mensagens para mostrar a mensagem do Ben
      if (result?.limitReached) {
        queryClient.invalidateQueries({ queryKey: ['ben-messages', variables.conversationId] })
      }
      // Não invalidar mensagens aqui normalmente - já recebemos tudo via streaming
    }
  })
}

/**
 * Hook para carregar mensagens de uma conversa
 */
export function useBenMessages(conversationId: string | null) {
  const query = useQuery({
    queryKey: ['ben-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return []

      const response = await fetch(`/api/ben/conversations/${conversationId}/messages`)
      if (!response.ok) {
        throw new Error('Erro ao buscar mensagens')
      }

      const data = await response.json()
      return data.messages as BenMessage[]
    },
    enabled: !!conversationId,
    refetchInterval: 5000 // Refetch a cada 5 segundos quando conversa está aberta
  })

  // Pergunta de um "Perguntar ao Ben" ainda em andamento: aparece na conversa até a versão salva chegar
  const pending = useSyncExternalStore(
    subscribePendingAsks,
    () => getPendingAsk(conversationId),
    () => null
  )
  const data = useMemo(() => withPendingAsk(query.data, pending), [query.data, pending])

  return { ...query, data }
}

/** Texto da resposta enquanto o Ben consulta os dados (antes do primeiro trecho). */
export const BEN_PENDING_ANSWER = 'Consultando os dados da plataforma…'

function withPendingAsk(messages: BenMessage[] | undefined, pending: PendingAsk | null): BenMessage[] | undefined {
  if (!pending) return messages
  const saved = messages ?? []
  if (saved.length > pending.baseCount) return messages
  const createdAt = new Date(pending.startedAt)
  return [
    ...saved,
    { id: `pending-question-${pending.startedAt}`, role: 'USER', content: pending.question, createdAt },
    { id: `pending-answer-${pending.startedAt}`, role: 'ASSISTANT', content: pending.answer || BEN_PENDING_ANSWER, createdAt },
  ]
}

export interface BenLimitState {
  allowed: boolean
  /** Mensagens restantes hoje; -1 = sem limite (Premium). */
  remaining: number
  /** Limite diário; -1 = sem limite. */
  limit: number
}

async function fetchBenLimit(): Promise<BenLimitState> {
  const response = await fetch('/api/ben/chat')
  if (!response.ok) throw new Error('Erro ao verificar o limite de mensagens')
  return response.json()
}

/** Limite diário de mensagens do Ben (grátis: 2 por dia). */
export function useBenLimit({ enabled = true }: { enabled?: boolean } = {}) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ['ben-limit'],
    queryFn: fetchBenLimit,
    enabled: !!session && enabled,
    staleTime: 30 * 1000
  })
}

export type AskBenOutcome =
  | { status: 'sent'; conversationId: string }
  | { status: 'limit'; limit: BenLimitState }

export interface AskBenCallbacks {
  /** A conversa foi criada e a pergunta saiu: hora de abrir o chat nela. */
  onStarted?: (conversationId: string) => void
  /** A resposta não veio (erro do servidor ou da rede). */
  onFailed?: (message: string) => void
}

/**
 * "Perguntar ao Ben": confere o limite do plano, cria uma conversa nova e envia a pergunta com o contexto da tela.
 * Com o limite atingido, não cria conversa nem envia nada (o chamador mostra o estado de limite).
 */
export function useAskBen() {
  const queryClient = useQueryClient()
  const createConversation = useCreateBenConversation()
  const sendMessage = useSendBenMessageStream()

  const ask = useCallback(
    async (question: string, context: Partial<BenPageContext> | null, callbacks: AskBenCallbacks = {}): Promise<AskBenOutcome> => {
      const limit = await queryClient.fetchQuery({ queryKey: ['ben-limit'], queryFn: fetchBenLimit, staleTime: 0 })
      if (!limit.allowed) return { status: 'limit', limit }

      const conversation = await createConversation.mutateAsync(undefined)
      const conversationId = conversation.id
      startPendingAsk(conversationId, question, 0)
      callbacks.onStarted?.(conversationId)

      let streamError: string | null = null
      const settle = async () => {
        await queryClient.refetchQueries({ queryKey: ['ben-messages', conversationId] })
        finishPendingAsk(conversationId)
        queryClient.invalidateQueries({ queryKey: ['ben-limit'] })
        if (streamError) callbacks.onFailed?.(streamError)
      }

      sendMessage.mutate(
        {
          conversationId,
          message: question,
          pageContext: context ?? undefined,
          onChunk: (chunk) => {
            if (chunk.type === 'text' && chunk.data) appendPendingAnswer(conversationId, String(chunk.data))
            else if (chunk.type === 'error') streamError = chunk.data?.error || 'Erro ao gerar a resposta'
          }
        },
        {
          onSettled: () => void settle(),
          onError: (error) => {
            streamError = error instanceof Error && error.message ? error.message : 'Erro ao enviar a pergunta'
          }
        }
      )

      return { status: 'sent', conversationId }
    },
    [queryClient, createConversation, sendMessage]
  )

  return { ask, isAsking: createConversation.isPending }
}

/**
 * Hook para compartilhar uma conversa
 */
export function useShareBenConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(`/api/ben/conversations/${conversationId}/share`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao compartilhar conversa')
      }

      const data = await response.json()
      return data as { shareToken: string; shareUrl: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ben-conversations'] })
    }
  })
}

/**
 * Hook para descompartilhar uma conversa
 */
export function useUnshareBenConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(`/api/ben/conversations/${conversationId}/share`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao descompartilhar conversa')
      }

      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ben-conversations'] })
    }
  })
}

/**
 * Hook para carregar memória geral do usuário
 */
export function useBenMemory(contextUrl?: string) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['ben-memory', contextUrl],
    queryFn: async () => {
      const url = contextUrl 
        ? `/api/ben/memory?contextUrl=${encodeURIComponent(contextUrl)}`
        : '/api/ben/memory'
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Erro ao buscar memória')
      }
      const data = await response.json()
      return data
    },
    enabled: !!session
  })
}

/**
 * Hook para buscar conversas com filtros
 */
export function useSearchBenConversations(query: string, sort: string = 'updatedAt', order: 'asc' | 'desc' = 'desc') {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['ben-conversations-search', query, sort, order],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: query,
        sort,
        order
      })
      
      const response = await fetch(`/api/ben/conversations/search?${params}`)
      if (!response.ok) {
        throw new Error('Erro ao buscar conversas')
      }
      const data = await response.json()
      return data.conversations as BenConversation[]
    },
    enabled: !!session
  })
}

/**
 * Hook para atualizar título de uma conversa
 */
export function useUpdateBenConversationTitle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ conversationId, title }: { conversationId: string; title: string }) => {
      const response = await fetch(`/api/ben/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar título')
      }

      const data = await response.json()
      return data.conversation as BenConversation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ben-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['ben-conversations-search'] })
    }
  })
}

/**
 * Hook para deletar uma conversa
 */
export function useDeleteBenConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(`/api/ben/conversations/${conversationId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao deletar conversa')
      }

      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ben-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['ben-conversations-search'] })
    }
  })
}

