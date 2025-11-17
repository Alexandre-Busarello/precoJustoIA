'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface UseExitIntentOptions {
  /**
   * Tempo mínimo em segundos que o usuário deve estar na página antes de detectar exit intent
   * @default 10
   */
  minTimeOnPage?: number
  
  /**
   * Tempo mínimo em segundos desde a última interação antes de detectar exit intent
   * @default 5
   */
  minTimeSinceInteraction?: number
  
  /**
   * Callback quando exit intent é detectado
   */
  onExitIntent: () => void
  
  /**
   * Se deve ativar a detecção
   * @default true
   */
  enabled?: boolean
  
  /**
   * Modo debug para logs no console
   * @default false
   */
  debug?: boolean
}

/**
 * Hook para detectar exit intent (quando usuário tenta fechar a aba)
 * Implementação manual sem bibliotecas externas para evitar falsos positivos
 */
export function useExitIntent({
  minTimeOnPage = 10,
  minTimeSinceInteraction = 5,
  onExitIntent,
  enabled = true,
  debug = false,
}: UseExitIntentOptions) {
  const [shouldShow, setShouldShow] = useState(false)
  const pageLoadTime = useRef<number>(Date.now())
  const lastInteractionTime = useRef<number>(Date.now())
  const hasTriggered = useRef<boolean>(false)
  const onExitIntentRef = useRef(onExitIntent)

  // Atualizar ref do callback para evitar recriação do useEffect
  useEffect(() => {
    onExitIntentRef.current = onExitIntent
  }, [onExitIntent])

  useEffect(() => {
    if (!enabled) {
      if (debug) console.log('[ExitIntent] Desabilitado')
      return
    }

    if (debug) {
      console.log('[ExitIntent] Ativado', {
        minTimeOnPage,
        minTimeSinceInteraction,
        pageLoadTime: new Date(pageLoadTime.current).toISOString(),
      })
    }

    const handleMouseLeave = (e: MouseEvent) => {
      // Só disparar se o mouse sair pela parte superior da janela
      // relatedTarget === null indica que está saindo da janela completamente
      const isLeavingTop = e.clientY <= 0 && (e.relatedTarget === null || (e.relatedTarget as Element)?.nodeName === 'HTML')
      
      if (isLeavingTop) {
        const timeOnPage = (Date.now() - pageLoadTime.current) / 1000
        const timeSinceInteraction = (Date.now() - lastInteractionTime.current) / 1000

        if (debug) {
          console.log('[ExitIntent] Mouse saindo pela parte superior', {
            clientY: e.clientY,
            relatedTarget: e.relatedTarget,
            timeOnPage: timeOnPage.toFixed(2),
            timeSinceInteraction: timeSinceInteraction.toFixed(2),
            hasTriggered: hasTriggered.current,
          })
        }

        // Verificar condições para evitar falsos positivos
        if (
          timeOnPage >= minTimeOnPage &&
          timeSinceInteraction >= minTimeSinceInteraction &&
          !hasTriggered.current
        ) {
          if (debug) {
            console.log('[ExitIntent] ✅ Condições atendidas! Disparando modal')
          }
          hasTriggered.current = true
          setShouldShow(true)
          onExitIntentRef.current()
        } else if (debug) {
          console.log('[ExitIntent] ❌ Condições não atendidas', {
            timeOnPageOk: timeOnPage >= minTimeOnPage,
            timeSinceInteractionOk: timeSinceInteraction >= minTimeSinceInteraction,
            notTriggered: !hasTriggered.current,
          })
        }
      }
    }

    // Rastrear interações do usuário (sem mousemove para evitar reset constante)
    const handleInteraction = () => {
      lastInteractionTime.current = Date.now()
      if (debug) {
        console.log('[ExitIntent] Interação detectada, resetando timer')
      }
    }

    // Eventos de interação (removido mousemove para evitar falsos positivos)
    const interactionEvents = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click']
    
    interactionEvents.forEach((event) => {
      document.addEventListener(event, handleInteraction, { passive: true })
    })

    // Evento de exit intent
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      interactionEvents.forEach((event) => {
        document.removeEventListener(event, handleInteraction)
      })
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [enabled, minTimeOnPage, minTimeSinceInteraction, debug])

  return {
    shouldShow,
    reset: () => {
      hasTriggered.current = false
      setShouldShow(false)
      if (debug) console.log('[ExitIntent] Resetado')
    },
  }
}

