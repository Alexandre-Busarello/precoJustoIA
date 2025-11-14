'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { isSessionExpiredError } from '@/lib/auth-utils'

interface UseSessionRefreshOptions {
  /**
   * Se deve verificar automaticamente quando a página é acessada (padrão: true)
   */
  checkOnMount?: boolean
  /**
   * Se deve fazer polling automático (padrão: false)
   */
  enablePolling?: boolean
  /**
   * Intervalo de polling em milissegundos (padrão: 5000ms = 5s)
   */
  interval?: number
  /**
   * Callback chamado quando a sessão é atualizada
   */
  onSessionUpdate?: (newSession: any) => void
}

export function useSessionRefresh(options: UseSessionRefreshOptions = {}) {
  const { data: session, update: updateSession, status } = useSession()
  const router = useRouter()
  const { 
    checkOnMount = true, 
    enablePolling = false, 
    interval = 5000, 
    onSessionUpdate 
  } = options
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPollingRef = useRef(false)
  const lastCheckRef = useRef<number>(0)
  const isCheckingRef = useRef(false)

  const refreshSession = useCallback(async (force = false) => {
    if (status !== 'authenticated' || !session?.user?.id) {
      return null
    }

    // Evitar múltiplas verificações simultâneas
    if (isCheckingRef.current && !force) {
      console.log('Session check already in progress, skipping...')
      return null
    }

    // Throttling: não verificar mais de uma vez a cada 30 segundos (exceto se forçado)
    const now = Date.now()
    const timeSinceLastCheck = now - lastCheckRef.current
    if (timeSinceLastCheck < 30000 && !force) {
      console.log('Session checked recently, skipping...', { timeSinceLastCheck })
      return null
    }

    isCheckingRef.current = true
    lastCheckRef.current = now

    try {
      console.log('Checking session for updates...')
      
      const response = await fetch('/api/refresh-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('Erro ao atualizar sessão:', response.statusText)
        return null
      }

      const data = await response.json()
      
      // Verificar se houve mudança no subscriptionTier
      const currentTier = session.user.subscriptionTier
      const newTier = data.user.subscriptionTier
      
      if (currentTier !== newTier) {
        console.log('Subscription tier changed:', { from: currentTier, to: newTier })
        
        try {
          // Forçar atualização completa da sessão NextAuth
          await updateSession()

          // Chamar callback se fornecido
          if (onSessionUpdate) {
            onSessionUpdate(data.user)
          }

          return data.user
        } catch (updateError) {
          // Se a atualização falhar por expiração de token, redirecionar para login
          if (isSessionExpiredError(updateError)) {
            console.log('Token expirado durante atualização, redirecionando para login...')
            router.push('/login?callbackUrl=' + encodeURIComponent(window.location.pathname))
            return null
          }
          throw updateError
        }
      }

      console.log('No subscription changes detected')
      return null
    } catch (error) {
      console.error('Erro ao atualizar sessão:', error)
      
      // Se o erro for de expiração de token, redirecionar para login
      if (isSessionExpiredError(error)) {
        console.log('Token expirado, redirecionando para login...')
        router.push('/login?callbackUrl=' + encodeURIComponent(window.location.pathname))
      }
      
      return null
    } finally {
      isCheckingRef.current = false
    }
  }, [session?.user?.id, session?.user?.subscriptionTier, status, updateSession, onSessionUpdate, router])

  const startPolling = useCallback(() => {
    if (isPollingRef.current || !enablePolling) return

    isPollingRef.current = true
    intervalRef.current = setInterval(async () => {
      await refreshSession()
    }, interval)

    console.log('Session polling started with interval:', interval)
  }, [refreshSession, interval, enablePolling])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      isPollingRef.current = false
      console.log('Session polling stopped')
    }
  }, [])

  // Detectar quando a sessão se torna inválida/expirada e redirecionar
  // useEffect(() => {
  //   // Se o status mudou para 'unauthenticated', significa que a sessão foi invalidada
  //   // Isso pode acontecer quando o token expira ou é inválido
  //   if (status === 'unauthenticated') {
  //     console.log('Sessão invalidada/expirada, redirecionando para login...')
  //     const currentPath = window.location.pathname
  //     // Não redirecionar se já estiver na página de login
  //     if (currentPath !== '/login' && currentPath !== '/register') {
  //       router.push('/login?callbackUrl=' + encodeURIComponent(currentPath))
  //     }
  //   }
  // }, [status, router])

  // Verificar sessão quando a página é acessada (checkOnMount)
  useEffect(() => {
    if (checkOnMount && status === 'authenticated' && session?.user?.id) {
      console.log('Page accessed, checking session for updates...')
      refreshSession()
    }
  }, [checkOnMount, status, session?.user?.id, refreshSession])

  // Iniciar/parar polling baseado na opção enablePolling
  useEffect(() => {
    if (enablePolling && status === 'authenticated') {
      startPolling()
    } else {
      stopPolling()
    }

    return () => {
      stopPolling()
    }
  }, [enablePolling, status, startPolling, stopPolling])

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  return {
    refreshSession,
    startPolling,
    stopPolling,
    isPolling: isPollingRef.current,
  }
}
