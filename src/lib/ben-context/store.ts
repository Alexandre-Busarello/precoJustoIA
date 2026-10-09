/**
 * Estado do contexto do Ben no navegador (módulo, sem React Context):
 * - contexto da página registrado pelos pontos "Perguntar ao Ben" (vale só na mesma rota), para que o chat
 *   aberto pelo botão flutuante também saiba o que está na tela;
 * - pergunta em andamento de um "Perguntar ao Ben" (pergunta e resposta parcial), mostrada no chat até a versão
 *   salva chegar do servidor.
 */

import { mergeWithRoute, contextFromPath, withoutFocus } from './builders'
import type { BenPageContext } from './types'

type Listener = () => void

function createEmitter() {
  const listeners = new Set<Listener>()
  return {
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emit() {
      for (const listener of listeners) listener()
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexto da página
// ─────────────────────────────────────────────────────────────────────────────

let registered: { pathname: string; context: BenPageContext } | null = null
const contextEmitter = createEmitter()

/** Guarda o contexto da tela (sem o item clicado) para a rota atual. */
export function registerPageContext(pathname: string, context: BenPageContext): void {
  const next = withoutFocus(context)
  if (registered?.pathname === pathname && JSON.stringify(registered.context) === JSON.stringify(next)) return
  registered = { pathname, context: next }
  contextEmitter.emit()
}

export const subscribePageContext = contextEmitter.subscribe

/** Contexto da tela registrado para a rota, ou `null`. */
export function getRegisteredContext(pathname: string): BenPageContext | null {
  return registered?.pathname === pathname ? registered.context : null
}

/**
 * Contexto completo da rota: o da rota, completado pelo registrado pela página e pelo informado agora
 * (ex.: o de um "Perguntar ao Ben", com o item clicado).
 */
export function resolvePageContext(pathname: string, provided?: Partial<BenPageContext> | null): BenPageContext {
  const route = contextFromPath(pathname)
  const page = mergeWithRoute(route, getRegisteredContext(pathname))
  return provided ? mergeWithRoute(page, provided) : page
}

// ─────────────────────────────────────────────────────────────────────────────
// Pergunta em andamento
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingAsk {
  question: string
  /** Resposta recebida até agora (vazia enquanto o Ben consulta os dados). */
  answer: string
  /** Mensagens da conversa no servidor quando a pergunta saiu; acima disso, a versão salva já chegou. */
  baseCount: number
  startedAt: number
}

const pendingAsks = new Map<string, PendingAsk>()
const pendingEmitter = createEmitter()

export function startPendingAsk(conversationId: string, question: string, baseCount: number): void {
  pendingAsks.set(conversationId, { question, answer: '', baseCount, startedAt: Date.now() })
  pendingEmitter.emit()
}

export function appendPendingAnswer(conversationId: string, text: string): void {
  const pending = pendingAsks.get(conversationId)
  if (!pending) return
  pendingAsks.set(conversationId, { ...pending, answer: pending.answer + text })
  pendingEmitter.emit()
}

export function finishPendingAsk(conversationId: string): void {
  if (pendingAsks.delete(conversationId)) pendingEmitter.emit()
}

export const subscribePendingAsks = pendingEmitter.subscribe

export function getPendingAsk(conversationId: string | null): PendingAsk | null {
  return conversationId ? pendingAsks.get(conversationId) ?? null : null
}
