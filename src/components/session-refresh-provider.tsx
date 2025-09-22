'use client'

import { createContext, useContext } from 'react'
import { useSessionRefresh } from '@/hooks/use-session-refresh'
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
  const { refreshSession, startPolling, stopPolling } = useSessionRefresh({
    checkOnMount: true, // Verificar automaticamente quando páginas são acessadas
    enablePolling: false, // Não fazer polling por padrão
    interval: 3000, // Intervalo para polling (quando habilitado)
    onSessionUpdate: (newUser) => {
      // Mostrar toast quando o usuário se tornar Premium
      if (newUser.subscriptionTier === 'PREMIUM') {
        toast.success('🎉 Parabéns! Sua conta Premium foi ativada!', {
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
