'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { useExitIntent } from '@/hooks/use-exit-intent'
import { ExitIntentModal } from './exit-intent-modal'

interface ExitIntentProviderProps {
  /**
   * Páginas onde o exit intent deve ser ativado
   * @default ['/planos', '/checkout']
   */
  enabledPages?: string[]
}

/**
 * Provider que gerencia exit intent em páginas específicas
 * Só exibe o modal se o usuário não estiver logado ou não for premium
 */
export function ExitIntentProvider({ enabledPages = ['/planos', '/checkout'] }: ExitIntentProviderProps) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { isPremium, isLoading: isLoadingPremium } = usePremiumStatus()
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Verificar se exit intent deve estar ativo nesta página
  const isEnabled = enabledPages.includes(pathname)

  // Só ativar se:
  // 1. Está em uma página habilitada
  // 2. Status não está carregando
  // 3. Usuário não está logado OU não é premium
  const shouldActivate = isEnabled && 
    status !== 'loading' && 
    !isLoadingPremium &&
    (status === 'unauthenticated' || !isPremium)

  const handleExitIntent = useCallback(() => {
    if (shouldActivate) {
      console.log('[ExitIntentProvider] Modal aberto')
      setIsModalOpen(true)
    }
  }, [shouldActivate])

  useExitIntent({
    enabled: shouldActivate,
    onExitIntent: handleExitIntent,
    minTimeOnPage: 10, // Mínimo 10 segundos na página
    minTimeSinceInteraction: 5, // Mínimo 5 segundos desde última interação
    debug: process.env.NODE_ENV === 'development', // Debug apenas em desenvolvimento
  })

  if (!isEnabled) {
    return null
  }

  return (
    <ExitIntentModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      page={pathname}
    />
  )
}

