import { useSession } from 'next-auth/react'
import { useMemo } from 'react'

/**
 * Hook centralizado para verificação de status Premium no frontend
 * ÚNICA FONTE DA VERDADE para componentes React
 * 
 * @returns {object} Status Premium do usuário atual
 */
export function usePremiumStatus() {
  const { data: session, status } = useSession()
  
  const premiumStatus = useMemo(() => {
    if (status === 'loading') {
      return {
        isPremium: false,
        isVip: false,
        isLoading: true,
        subscriptionTier: 'FREE' as const,
        premiumExpiresAt: null
      }
    }

    if (!session?.user) {
      return {
        isPremium: false,
        isVip: false,
        isLoading: false,
        subscriptionTier: 'FREE' as const,
        premiumExpiresAt: null
      }
    }

    const tier = session.user.subscriptionTier || 'FREE'
    const expiresAt = session.user.premiumExpiresAt ? new Date(session.user.premiumExpiresAt) : null
    const now = new Date()

    // Verificar se Premium está ativo
    const isPremium = tier === 'PREMIUM' && (!expiresAt || expiresAt > now)
    const isVip = tier === 'VIP' && (!expiresAt || expiresAt > now)

    return {
      isPremium,
      isVip,
      isLoading: false,
      subscriptionTier: tier as 'FREE' | 'PREMIUM' | 'VIP',
      premiumExpiresAt: expiresAt
    }
  }, [session, status])

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
