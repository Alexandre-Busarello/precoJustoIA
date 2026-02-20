import { useSession } from 'next-auth/react'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

async function fetchAnonCanViewFull(): Promise<{ canViewFullContent: boolean }> {
  const res = await fetch('/api/anon-can-view-full', { credentials: 'include' })
  if (!res.ok) return { canViewFullContent: false }
  return res.json()
}

/**
 * Hook centralizado para verificação de status Premium no frontend
 * ÚNICA FONTE DA VERDADE para componentes React
 *
 * Para anônimos: retorna isPremium=true quando usos não excedem limite (2 por IP).
 * Após exceder, volta à regra padrão (isPremium=false).
 *
 * @returns {object} Status Premium do usuário atual
 */
export function usePremiumStatus() {
  const { data: session, status } = useSession()
  const { data: anonAccess, isLoading: anonLoading } = useQuery({
    queryKey: ['anon-can-view-full'],
    queryFn: fetchAnonCanViewFull,
    enabled: status !== 'loading' && !session?.user,
    staleTime: 60 * 1000,
  })

  const premiumStatus = useMemo(() => {
    if (status === 'loading') {
      return {
        isPremium: false,
        isVip: false,
        isLoading: true,
        subscriptionTier: 'FREE' as const,
        premiumExpiresAt: null,
        trialStartedAt: null,
        trialEndsAt: null,
        isTrialActive: false,
        trialDaysRemaining: null
      }
    }

    if (!session?.user) {
      const canViewFull = anonAccess?.canViewFullContent ?? false
      return {
        isPremium: canViewFull,
        isVip: false,
        isLoading: anonLoading,
        subscriptionTier: 'FREE' as const,
        premiumExpiresAt: null,
        trialStartedAt: null,
        trialEndsAt: null,
        isTrialActive: false,
        trialDaysRemaining: null
      }
    }

    const tier = session.user.subscriptionTier || 'FREE'
    const expiresAt = session.user.premiumExpiresAt ? new Date(session.user.premiumExpiresAt) : null
    const trialEndsAt = session.user.trialEndsAt ? new Date(session.user.trialEndsAt) : null
    const trialStartedAt = session.user.trialStartedAt ? new Date(session.user.trialStartedAt) : null
    const now = new Date()

    // Verificar se Premium está ativo normalmente
    const hasValidPremium = tier === 'PREMIUM' && (!expiresAt || expiresAt > now)
    const hasValidVip = tier === 'VIP' && (!expiresAt || expiresAt > now)

    // Verificar se trial está ativo
    // Garantir que trialEndsAt > trialStartedAt E trialEndsAt > now
    const isTrialActive = trialStartedAt && trialEndsAt && 
                         trialEndsAt > trialStartedAt &&
                         trialEndsAt > now
    
    // Calcular dias restantes do trial
    let trialDaysRemaining: number | null = null
    if (isTrialActive && trialEndsAt) {
      const diffTime = trialEndsAt.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      trialDaysRemaining = diffDays > 0 ? diffDays : null
    }

    // Trial também dá acesso Premium
    const isPremium = hasValidPremium || isTrialActive
    const isVip = hasValidVip

    return {
      isPremium,
      isVip,
      isLoading: false,
      subscriptionTier: tier as 'FREE' | 'PREMIUM' | 'VIP',
      premiumExpiresAt: expiresAt,
      trialStartedAt,
      trialEndsAt,
      isTrialActive,
      trialDaysRemaining
    }
  }, [session, status, anonAccess?.canViewFullContent, anonLoading])

  return premiumStatus
}

/**
 * Hook simples que retorna apenas se o usuário é Premium
 * Para casos onde só precisa do boolean
 */
export function useIsPremium(): boolean {
  const { isPremium } = usePremiumStatus()
  return isPremium ?? false
}

/**
 * Hook que retorna se o usuário está logado e é Premium
 */
export function useIsLoggedInPremium(): { isLoggedIn: boolean; isPremium: boolean } {
  const { data: session } = useSession()
  const { isPremium } = usePremiumStatus()
  
  return {
    isLoggedIn: !!session,
    isPremium: isPremium ?? false
  }
}
