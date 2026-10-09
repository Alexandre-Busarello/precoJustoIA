'use client'

/**
 * Estado do painel único do Ben (módulo, sem React Context). O painel é montado uma vez no layout raiz
 * (`BenChatFAB`) e qualquer ponto da app o abre: botão flutuante, "Perguntar ao Ben", histórico de conversas.
 */

import { useSyncExternalStore } from 'react'

export type BenSheetSnap = 'half' | 'full'

export interface BenPanelState {
  open: boolean
  /** Conversa no painel; `null` = conversa nova (criada no primeiro envio). */
  conversationId: string | null
  /** Contexto (`contextKey`) em que a conversa atual começou. */
  conversationKey: string | null
  /** Altura da folha no mobile. */
  snap: BenSheetSnap
}

let state: BenPanelState = { open: false, conversationId: null, conversationKey: null, snap: 'half' }
/** Quem recebe o foco quando o painel fecha (o painel é controlado, sem gatilho do Radix). */
let returnFocus: HTMLElement | null = null
const listeners = new Set<() => void>()

function setState(next: Partial<BenPanelState>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export interface OpenBenPanelOptions {
  /** Abre nesta conversa (ex.: a criada por um "Perguntar ao Ben" ou escolhida no histórico). */
  conversationId?: string
  /** Contexto da conversa informada. */
  conversationKey?: string | null
  /** Começa uma conversa nova. */
  fresh?: boolean
  /**
   * Contexto da tela atual. Sem `conversationId` nem `fresh`, o painel continua a conversa atual só se ela
   * for desta tela; senão abre uma conversa nova (uma pergunta feita na carteira não cai na conversa de PETR4).
   */
  pageKey?: string
  returnFocus?: HTMLElement | null
}

export function openBenPanel(options: OpenBenPanelOptions = {}): void {
  returnFocus = options.returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
  if (options.conversationId) {
    setState({ open: true, snap: 'half', conversationId: options.conversationId, conversationKey: options.conversationKey ?? null })
    return
  }
  const keep = !options.fresh && state.conversationId !== null && state.conversationKey === options.pageKey
  setState({
    open: true,
    snap: 'half',
    conversationId: keep ? state.conversationId : null,
    conversationKey: keep ? state.conversationKey : options.pageKey ?? null,
  })
}

export function isBenPanelOpen(): boolean {
  return state.open
}

export function closeBenPanel(): void {
  if (state.open) setState({ open: false })
}

/** Troca a conversa do painel (histórico, "Nova conversa" ou a criada no primeiro envio). */
export function setBenConversation(conversationId: string | null, conversationKey: string | null): void {
  setState({ conversationId, conversationKey })
}

/** A conversa foi excluída (ou não existe mais): se é a do painel, o painel passa para uma conversa nova. */
export function forgetBenConversation(conversationId: string): void {
  if (state.conversationId === conversationId) setState({ conversationId: null, conversationKey: null })
}

export function setBenSheetSnap(snap: BenSheetSnap): void {
  if (state.snap !== snap) setState({ snap })
}

export function takeBenReturnFocus(): HTMLElement | null {
  const element = returnFocus
  returnFocus = null
  return element && element.isConnected ? element : null
}

const getState = () => state
const SERVER_STATE: BenPanelState = { open: false, conversationId: null, conversationKey: null, snap: 'half' }

export function useBenPanel(): BenPanelState {
  return useSyncExternalStore(subscribe, getState, () => SERVER_STATE)
}
