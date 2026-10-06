'use client'

import { useEffect, useRef } from 'react'

interface UseExitIntentOptions {
  /** Segundos mínimos na página antes de considerar a intenção de saída. @default 10 */
  minTimeOnPage?: number
  /** Segundos mínimos desde a última interação (clique, tecla, scroll, toque). @default 5 */
  minTimeSinceInteraction?: number
  /** Chamado uma única vez por ativação quando a intenção de saída é detectada. */
  onExitIntent: () => void
  /** Liga/desliga a detecção. @default true */
  enabled?: boolean
}

/**
 * Detecta intenção de saída no desktop: o mouse deixa a janela pela borda superior.
 * Sem bibliotecas externas; ignora saídas logo após carregar ou interagir para evitar falsos positivos.
 */
export function useExitIntent({
  minTimeOnPage = 10,
  minTimeSinceInteraction = 5,
  onExitIntent,
  enabled = true,
}: UseExitIntentOptions) {
  const pageLoadTime = useRef<number>(Date.now())
  const lastInteractionTime = useRef<number>(Date.now())
  const hasTriggered = useRef(false)
  const onExitIntentRef = useRef(onExitIntent)

  useEffect(() => {
    onExitIntentRef.current = onExitIntent
  }, [onExitIntent])

  useEffect(() => {
    if (!enabled) return
    // Recomeça a contagem sempre que a detecção é ligada (ex.: navegação client-side até a página)
    pageLoadTime.current = Date.now()
    lastInteractionTime.current = Date.now()
    hasTriggered.current = false

    const handleMouseLeave = (e: MouseEvent) => {
      const related = e.relatedTarget as Element | null
      const isLeavingTop = e.clientY <= 0 && (related === null || related.nodeName === 'HTML')
      if (!isLeavingTop || hasTriggered.current) return

      const now = Date.now()
      const timeOnPage = (now - pageLoadTime.current) / 1000
      const timeSinceInteraction = (now - lastInteractionTime.current) / 1000
      if (timeOnPage >= minTimeOnPage && timeSinceInteraction >= minTimeSinceInteraction) {
        hasTriggered.current = true
        onExitIntentRef.current()
      }
    }

    const handleInteraction = () => {
      lastInteractionTime.current = Date.now()
    }

    const interactionEvents = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'] as const
    interactionEvents.forEach((event) => document.addEventListener(event, handleInteraction, { passive: true }))
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      interactionEvents.forEach((event) => document.removeEventListener(event, handleInteraction))
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [enabled, minTimeOnPage, minTimeSinceInteraction])
}
