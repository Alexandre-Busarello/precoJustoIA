import { useSession } from 'next-auth/react'
import { useMemo } from 'react'
import { useAlfa } from '@/contexts/alfa-context'

/**
 * Hook centralizado para verificação de status Premium no frontend
 * ÚNICA FONTE DA VERDADE para componentes React
 * 
 * @returns {object} Status Premium do usuário atual
 */
export function usePremiumStatus() {
  const { data: session, status } = useSession()
  const { stats: alfaStats, isLoading: isLoadingAlfa } = useAlfa()
  
  const premiumStatus = useMemo(() => {
    if (status === 'loading' || isLoadingAlfa) {
      return {
        isPremium: false,
        isVip: false,
        isLoading: true,
        subscriptionTier: 'FREE' as const,
        premiumExpiresAt: null,
        isAlfaPhase: false
      }
    }

    if (!session?.user) {
      return {
        isPremium: false,
        isVip: false,
        isLoading: false,
        subscriptionTier: 'FREE' as const,
        premiumExpiresAt: null,
        isAlfaPhase: alfaStats?.phase === 'ALFA'
      }
    }

    const tier = session.user.subscriptionTier || 'FREE'
    const expiresAt = session.user.premiumExpiresAt ? new Date(session.user.premiumExpiresAt) : null
    const now = new Date()
    const isAlfaPhase = alfaStats?.phase === 'ALFA'

    // Verificar se Premium está ativo normalmente
    const hasValidPremium = tier === 'PREMIUM' && (!expiresAt || expiresAt > now)
    const hasValidVip = tier === 'VIP' && (!expiresAt || expiresAt > now)

    // Durante a fase ALFA, todos os usuários logados têm acesso Premium
    const isPremium = isAlfaPhase || hasValidPremium
    const isVip = hasValidVip // VIP não é afetado pela fase ALFA

    return {
      isPremium,
      isVip,
      isLoading: false,
      subscriptionTier: tier as 'FREE' | 'PREMIUM' | 'VIP',
      premiumExpiresAt: expiresAt,
      isAlfaPhase
    }
  }, [session, status, alfaStats, isLoadingAlfa])

  return premiumStatus
}

/**
 * Hook simples que retorna apenas se o usuário é Premium
 * Para casos onde só precisa do boolean
 */
export function useIsPremium(): boolean {
  const { isPremium } = usePremiumStatus()
  return isPremium
}

/**
 * Hook que retorna se o usuário está logado e é Premium
 */
export function useIsLoggedInPremium(): { isLoggedIn: boolean; isPremium: boolean } {
  const { data: session } = useSession()
  const { isPremium } = usePremiumStatus()
  
  return {
    isLoggedIn: !!session,
    isPremium
  }
}
