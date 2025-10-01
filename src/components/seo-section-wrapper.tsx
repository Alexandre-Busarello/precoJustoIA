'use client'

import { usePremiumStatus } from '@/hooks/use-premium-status'
import { ReactNode } from 'react'

interface SEOSectionWrapperProps {
  children: ReactNode
  hideForPremium?: boolean
}

export function SEOSectionWrapper({ children, hideForPremium = true }: SEOSectionWrapperProps) {
  const { isPremium } = usePremiumStatus()

  // Se hideForPremium está ativo e o usuário é premium, não renderiza
  if (hideForPremium && isPremium) {
    return null
  }

  return <>{children}</>
}


