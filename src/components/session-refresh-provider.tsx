'use client'

import { createContext, useContext, useRef, useEffect } from 'react'
import { useSessionRefresh } from '@/hooks/use-session-refresh'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

interface SessionRefreshContextType {
  startPaymentVerification: () => void
  refreshSession: () => Promise<any>
}

const SessionRefreshContext = createContext<SessionRefreshContextType | null>(null)

interface SessionRefreshProviderProps {
  children: React.ReactNode
}

export function SessionRefreshProvider({ children }: SessionRefreshProviderProps) {
  const { data: session } = useSession()
  const toastShownRef = useRef(false)
  const previousTierRef = useRef<string | undefined>(session?.user?.subscriptionTier)
  const lastToastTimeRef = useRef<number>(0)

  // Sincronizar previousTierRef com a sessão inicial e resetar toast quando necessário
  useEffect(() => {
    const currentTier = session?.user?.subscriptionTier
    
    // Se o usuário perdeu o Premium (downgrade), resetar o flag do toast
    // Isso permite mostrar o toast novamente se o usuário fizer upgrade novamente
    if (previousTierRef.current === 'PREMIUM' && currentTier !== 'PREMIUM') {
      toastShownRef.current = false
      lastToastTimeRef.current = 0
    }
    
    // Inicializar previousTierRef se ainda não foi inicializado
    if (previousTierRef.current === undefined && currentTier !== undefined) {
      previousTierRef.current = currentTier
    }
  }, [session?.user?.subscriptionTier])

  const { refreshSession, startPolling, stopPolling } = useSessionRefresh({
    checkOnMount: true, // Verificar automaticamente quando páginas são acessadas
    enablePolling: false, // Não fazer polling por padrão
    interval: 3000, // Intervalo para polling (quando habilitado)
    onSessionUpdate: (newUser) => {
      const previousTier = previousTierRef.current
      const newTier = newUser.subscriptionTier

      // Verificar se há uma mudança real de tier para PREMIUM
      const isUpgradeToPremium = 
        newTier === 'PREMIUM' && 
        previousTier !== 'PREMIUM'

      // Atualizar referência do tier anterior ANTES de mostrar o toast
      // Isso previne que chamadas subsequentes detectem a mesma mudança
      previousTierRef.current = newTier

      // Só mostrar toast se:
      // 1. É uma mudança real para PREMIUM
      // 2. Ainda não mostramos o toast (verificação atômica)
      if (isUpgradeToPremium && !toastShownRef.current) {
        // Marcar como mostrado ANTES de exibir (evita race conditions)
        toastShownRef.current = true
        lastToastTimeRef.current = Date.now()
        
        toast.success('Sua conta Premium foi ativada', {
          description: 'Agora você tem acesso a todas as análises avançadas.',
          duration: 5000,
        })
      }
    }
  })

  // Função para iniciar verificação após pagamento
  const startPaymentVerification = () => {
    console.log('Iniciando verificação de pagamento...')
    
    // Fazer uma verificação imediata
    refreshSession(true) // force = true
    
    // Iniciar polling temporário para capturar mudanças do webhook
    startPolling()
    
    // Parar verificação após 2 minutos (tempo suficiente para webhook processar)
    setTimeout(() => {
      console.log('Parando verificação de pagamento após timeout')
      stopPolling()
    }, 120000) // 2 minutos
  }

  // Não fazer verificação automática no mount para evitar loops

  const contextValue: SessionRefreshContextType = {
    startPaymentVerification,
    refreshSession: refreshSession || (() => Promise.resolve(null)),
  }

  return (
    <SessionRefreshContext.Provider value={contextValue}>
      {children}
    </SessionRefreshContext.Provider>
  )
}

// Hook para usar as funções de refresh em qualquer componente
export function usePaymentVerification() {
  const context = useContext(SessionRefreshContext)
  
  if (!context) {
    // Fallback se o contexto não estiver disponível
    return {
      startVerification: () => {
        console.warn('SessionRefreshContext not available')
      },
      checkSession: async () => {
        console.warn('SessionRefreshContext not available')
        return null
      },
    }
  }

  const startVerification = () => {
    context.startPaymentVerification()
  }

  const checkSession = async () => {
    return await context.refreshSession()
  }

  return {
    startVerification,
    checkSession,
  }
}
