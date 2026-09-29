'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { useExitIntent } from '@/hooks/use-exit-intent'
import { claimModalSlot, releaseModalSlot } from '@/lib/interruptions'
import { ExitIntentModal } from './exit-intent-modal'

const SLOT_ID = 'exit-intent'
const LAST_SHOWN_KEY = 'pja-exit-intent-last-shown'
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000
const DESKTOP_POINTER_QUERY = '(min-width: 1024px) and (pointer: fine)'

function shownRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(LAST_SHOWN_KEY)
    const last = raw ? Number(raw) : 0
    return Number.isFinite(last) && last > 0 && Date.now() - last < COOLDOWN_MS
  } catch {
    return false
  }
}

function markShown() {
  try {
    window.localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()))
  } catch {
    // localStorage indisponível: o limite por página (slot de interrupção) continua valendo
  }
}

interface ExitIntentProviderProps {
  /** Páginas onde a pesquisa de saída pode aparecer. Nunca em /checkout. @default ['/planos'] */
  enabledPages?: string[]
}

/**
 * Pesquisa de saída não bloqueante (card no canto inferior direito).
 * Regras: só desktop com mouse, só visitante anônimo ou em teste grátis, nunca em /checkout,
 * no máximo 1 vez a cada 30 dias e respeitando o slot único de interrupção da página.
 */
export function ExitIntentProvider({ enabledPages = ['/planos'] }: ExitIntentProviderProps) {
  const pathname = usePathname()
  const { status } = useSession()
  const { isTrialActive, isLoading: isLoadingPremium } = usePremiumStatus()
  const [isOpen, setIsOpen] = useState(false)
  const [eligibleDevice, setEligibleDevice] = useState(false)

  useEffect(() => {
    setEligibleDevice(window.matchMedia(DESKTOP_POINTER_QUERY).matches && !shownRecently())
  }, [pathname])

  const isEnabledPage = !!pathname && enabledPages.includes(pathname) && !pathname.startsWith('/checkout')
  const shouldActivate =
    isEnabledPage &&
    eligibleDevice &&
    status !== 'loading' &&
    !isLoadingPremium &&
    (status === 'unauthenticated' || Boolean(isTrialActive))

  const handleExitIntent = useCallback(() => {
    if (shownRecently() || !claimModalSlot(SLOT_ID)) return
    markShown()
    setIsOpen(true)
  }, [])

  useExitIntent({ enabled: shouldActivate, onExitIntent: handleExitIntent, minTimeOnPage: 10, minTimeSinceInteraction: 5 })

  const handleClose = useCallback(() => {
    setIsOpen(false)
    releaseModalSlot(SLOT_ID)
  }, [])

  if (!isEnabledPage || !pathname) return null

  return <ExitIntentModal isOpen={isOpen} onClose={handleClose} page={pathname} />
}
