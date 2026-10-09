/**
 * Hooks do chat do Ben: conversas, mensagens, limite do plano e envio com streaming.
 *
 * O envio guarda o andamento de cada resposta ("run") num estado de módulo, por conversa: pergunta, trecho
 * recebido, fase (consultando dados, escrevendo, salvando, interrompida, erro) e as ferramentas em execução.
 * Assim a resposta continua visível se o painel fechar e abrir de novo, e o botão "Perguntar ao Ben" e o painel
 * usam o mesmo caminho.
 */

'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import type { BenPageContext } from '@/lib/ben-context/types'
import { conversationTitleFrom } from '@/components/ben/ben-chat-utils'

export interface BenConversation {
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

export interface BenMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  createdAt: Date
  toolCalls?: unknown
}

const messagesKey = (conversationId: string | null) => ['ben-messages', conversationId] as const

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
 * Cria uma conversa. `contextUrl` é a tela em que ela começou (o histórico mostra o contexto a partir dela).
 */
export function useCreateBenConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ title, contextUrl }: { title?: string; contextUrl: string }) => {
      const response = await fetch('/api/ben/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, contextUrl })
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
 * Mensagens salvas de uma conversa.
 */
export function useBenMessages(conversationId: string | null) {
  return useQuery({
    queryKey: messagesKey(conversationId),
    queryFn: async () => {
      if (!conversationId) return []
      const response = await fetch(`/api/ben/conversations/${conversationId}/messages`)
      if (!response.ok) {
        throw new Error('Erro ao buscar mensagens')
      }
      const data = await response.json()
      return data.messages as BenMessage[]
    },
    enabled: !!conversationId
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Limite do plano
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Andamento das respostas (por conversa)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * - `consulting`: o Ben consulta os dados (ferramentas) antes do primeiro trecho;
 * - `writing`: a resposta chega em trechos;
 * - `saving`: a resposta terminou e a versão salva está a caminho;
 * - `stopped`: o usuário parou a resposta;
 * - `error`: a resposta não veio (mensagem em `error`).
 */
export type BenRunPhase = 'consulting' | 'writing' | 'saving' | 'stopped' | 'error'

export interface BenToolCall {
  name: string
  args?: unknown
}

export interface BenRun {
  question: string
  answer: string
  phase: BenRunPhase
  tools: BenToolCall[]
  error: string | null
  /** Mensagens salvas quando a pergunta saiu; acima disso, a versão salva já chegou. */
  baseCount: number
  startedAt: number
  /** O que foi enviado, para "Tentar de novo". */
  request: BenSendRequest
}

const runs = new Map<string, BenRun>()
const controllers = new Map<string, AbortController>()
const runListeners = new Set<() => void>()

function emitRuns() {
  for (const listener of runListeners) listener()
}

function subscribeRuns(listener: () => void) {
  runListeners.add(listener)
  return () => {
    runListeners.delete(listener)
  }
}

function updateRun(conversationId: string, patch: Partial<BenRun>) {
  const run = runs.get(conversationId)
  if (!run) return
  runs.set(conversationId, { ...run, ...patch })
  emitRuns()
}

/** Andamento da resposta em curso (ou a última interrompida / com erro) desta conversa. */
export function useBenRun(conversationId: string | null): BenRun | null {
  return useSyncExternalStore(
    subscribeRuns,
    () => (conversationId ? runs.get(conversationId) ?? null : null),
    () => null
  )
}

export function isBenRunActive(run: BenRun | null | undefined): boolean {
  return run?.phase === 'consulting' || run?.phase === 'writing'
}

/** Para a resposta em curso. O servidor não grava a pergunta nem a resposta interrompidas. */
export function stopBenRun(conversationId: string): void {
  controllers.get(conversationId)?.abort()
}

/** Remove a resposta interrompida ou com erro da tela. */
export function dismissBenRun(conversationId: string): void {
  if (runs.delete(conversationId)) emitRuns()
}

/** Mensagem de erro para gente, sem o texto técnico do servidor. */
function humanError(status: number | null): string {
  if (status === null) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  if (status === 401) return 'Sua sessão expirou. Entre de novo para continuar a conversa.'
  if (status === 429) return 'Muitas mensagens em pouco tempo. Espere um pouco e tente de novo.'
  return 'O Ben não conseguiu responder agora. Tente de novo em instantes.'
}

/** Lê o SSE do chat (`event: <tipo>\ndata: <json>\n\n`) e repassa cada evento. */
async function readBenStream(
  response: Response,
  onEvent: (type: string, data: unknown) => void,
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Stream não disponível')
  const decoder = new TextDecoder()
  let buffer = ''

  const flush = (eventText: string) => {
    let type = 'text'
    const dataLines: string[] = []
    for (const line of eventText.split('\n')) {
      if (line.startsWith('event: ')) type = line.slice(7).trim()
      else if (line.startsWith('data: ')) dataLines.push(line.slice(6))
    }
    if (dataLines.length === 0) return
    let data: unknown
    try {
      data = JSON.parse(dataLines.join('\n'))
    } catch {
      return
    }
    onEvent(type, data)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let end = buffer.indexOf('\n\n')
    while (end !== -1) {
      flush(buffer.slice(0, end))
      buffer = buffer.slice(end + 2)
      end = buffer.indexOf('\n\n')
    }
  }
  if (buffer.trim()) flush(buffer)
}

export interface BenSendRequest {
  question: string
  /** Contexto da tela já resolvido (`resolvePageContext`); sem a tela, o genérico. */
  context: BenPageContext
  /** Rota da tela (memória e título da conversa no servidor). */
  contextUrl: string
}

async function streamRun(queryClient: QueryClient, conversationId: string, request: BenSendRequest): Promise<void> {
  const controller = new AbortController()
  controllers.set(conversationId, controller)
  let failed = false

  try {
    const response = await fetch('/api/ben/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        conversationId,
        message: request.question,
        contextUrl: request.contextUrl,
        pageContext: request.context
      })
    })
    if (!response.ok) {
      failed = true
      updateRun(conversationId, { phase: 'error', error: humanError(response.status) })
      return
    }

    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      await readBenStream(response, (type, data) => {
        const run = runs.get(conversationId)
        if (!run || failed) return
        if (type === 'tool_call' && data && typeof data === 'object' && 'name' in data) {
          const call = data as { name: unknown; args?: unknown }
          if (typeof call.name === 'string') updateRun(conversationId, { tools: [...run.tools, { name: call.name, args: call.args }] })
        } else if (type === 'text' && typeof data === 'string' && data) {
          updateRun(conversationId, { phase: 'writing', answer: run.answer + data })
        } else if (type === 'error') {
          failed = true
          updateRun(conversationId, { phase: 'error', error: humanError(500) })
        }
      })
    } else {
      // Resposta JSON: o limite foi atingido entre a conferência e o envio (o servidor grava o aviso na conversa).
      await response.json().catch(() => null)
    }

    if (failed) return
    updateRun(conversationId, { phase: 'saving' })
    await queryClient.refetchQueries({ queryKey: messagesKey(conversationId) })
    const saved = queryClient.getQueryData<BenMessage[]>(messagesKey(conversationId)) ?? []
    const run = runs.get(conversationId)
    if (run && saved.length > run.baseCount) dismissBenRun(conversationId)
  } catch (error) {
    if (controller.signal.aborted) {
      updateRun(conversationId, { phase: 'stopped' })
    } else {
      updateRun(conversationId, { phase: 'error', error: humanError(error instanceof TypeError ? null : 500) })
    }
  } finally {
    if (controllers.get(conversationId) === controller) controllers.delete(conversationId)
    queryClient.invalidateQueries({ queryKey: ['ben-limit'] })
    queryClient.invalidateQueries({ queryKey: ['ben-conversations'] })
  }
}

export type BenSendOutcome =
  | { status: 'sent'; conversationId: string }
  | { status: 'limit'; limit: BenLimitState }
  | { status: 'busy' }

export interface BenSendParams extends BenSendRequest {
  /** Conversa em que a pergunta entra; sem ela, cria uma nova (título = a pergunta). */
  conversationId?: string | null
  /** A conversa nova foi criada: hora de mostrá-la. */
  onConversation?: (conversationId: string) => void
}

/**
 * Envia uma pergunta ao Ben: confere o limite do plano, cria a conversa se preciso e acompanha a resposta.
 * Com o limite atingido, não cria conversa nem envia nada (quem chama mostra o estado de limite).
 * Os erros de rede e do servidor ficam na resposta (`useBenRun`), com "Tentar de novo".
 */
export function useBenSend() {
  const queryClient = useQueryClient()
  const createConversation = useCreateBenConversation()
  const { mutateAsync: create } = createConversation

  const send = useCallback(
    async ({ conversationId, onConversation, ...request }: BenSendParams): Promise<BenSendOutcome> => {
      if (conversationId && isBenRunActive(runs.get(conversationId))) return { status: 'busy' }

      const limit = await queryClient.fetchQuery({ queryKey: ['ben-limit'], queryFn: fetchBenLimit, staleTime: 0 })
      if (!limit.allowed) return { status: 'limit', limit }

      let id = conversationId ?? null
      if (!id) {
        const conversation = await create({ title: conversationTitleFrom(request.question), contextUrl: request.contextUrl })
        id = conversation.id
        queryClient.setQueryData(messagesKey(id), [])
        onConversation?.(id)
      }

      const saved = queryClient.getQueryData<BenMessage[]>(messagesKey(id)) ?? []
      runs.set(id, {
        question: request.question,
        answer: '',
        phase: 'consulting',
        tools: [],
        error: null,
        baseCount: saved.length,
        startedAt: Date.now(),
        request
      })
      emitRuns()
      void streamRun(queryClient, id, request)
      return { status: 'sent', conversationId: id }
    },
    [queryClient, create]
  )

  return { send, isCreating: createConversation.isPending }
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
