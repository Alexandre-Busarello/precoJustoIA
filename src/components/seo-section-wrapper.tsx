'use client'

import { useSession } from 'next-auth/react'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { ReactNode } from 'react'

interface SEOSectionWrapperProps {
  children: ReactNode
  hideForPremium?: boolean
}

/**
 * Conteúdo explicativo/SEO escondido para assinantes Premium logados.
 * Visitantes anônimos sempre veem o conteúdo, mesmo quando ainda têm visualizações completas gratuitas
 * (o hook de status trata esse caso como Premium, mas o texto continua útil para eles).
 */
export function SEOSectionWrapper({ children, hideForPremium = true }: SEOSectionWrapperProps) {
  const { data: session } = useSession()
  const { isPremium } = usePremiumStatus()

  if (hideForPremium && session?.user && isPremium) {
    return null
  }

  return <>{children}</>
}
