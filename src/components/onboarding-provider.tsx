"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { OnboardingModal } from "./onboarding-modal"
import { OnboardingBanner } from "./onboarding-banner"
import { claimModalSlot, releaseModalSlot } from "@/lib/interruptions"

const SLOT_ID = "onboarding"
const CACHE_TTL_MS = 30 * 60 * 1000

interface OnboardingStatus {
  shouldShowOnboarding: boolean
  hasMissingQuestions?: boolean
  missingQuestions?: string[]
  name?: string | null
  onboardingAcquisitionSource?: string | null
  onboardingExperienceLevel?: string | null
  onboardingInvestmentFocus?: string | null
}

const cacheKey = (email: string) => `onboarding-status-cache-${email}`

function readCachedStatus(email?: string | null): OnboardingStatus | undefined {
  if (!email) return undefined
  try {
    const raw = localStorage.getItem(cacheKey(email))
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { data?: OnboardingStatus; timestamp?: number }
    if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS) return parsed.data
  } catch {
    // cache ilegível ou storage bloqueado: busca no servidor
  }
  return undefined
}

function writeCachedStatus(email: string, data: OnboardingStatus | null) {
  try {
    if (data) localStorage.setItem(cacheKey(email), JSON.stringify({ data, timestamp: Date.now() }))
    else localStorage.removeItem(cacheKey(email))
  } catch {
    // storage indisponível: segue sem cache
  }
}

async function fetchOnboardingStatus(email?: string | null): Promise<OnboardingStatus | null> {
  const cached = readCachedStatus(email)
  if (cached) return cached
  const response = await fetch("/api/user/onboarding-status")
  if (!response.ok) return null
  const data = (await response.json()) as OnboardingStatus
  if (email && data) writeCachedStatus(email, data)
  return data
}

// Páginas internas onde o onboarding pode aparecer
const ONBOARDING_ALLOWED_PAGES = [
  "/dashboard",
  "/ranking",
  "/comparador",
  "/backtest",
  "/analise-setorial",
  "/screening-acoes",
  "/calculadoras",
  "/pl-bolsa",
  "/carteira",
  "/backtesting-carteiras",
]

function isOnboardingAllowedPage(pathname: string | null): boolean {
  if (!pathname) return false
  return (
    ONBOARDING_ALLOWED_PAGES.includes(pathname) ||
    pathname.startsWith("/acao/") ||
    pathname.startsWith("/compara-acoes")
  )
}

/**
 * Estado do onboarding do usuário logado.
 * `pending` enquanto ainda não se sabe se o onboarding vai abrir: outras interrupções
 * (ex.: comunicados no dashboard) devem esperar, porque o onboarding tem prioridade.
 */
export function useOnboardingStatus() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const email = session?.user?.email ?? null
  const allowed = isOnboardingAllowedPage(pathname)
  const enabled = status === "authenticated" && !!email && allowed

  const query = useQuery({
    queryKey: ["user-onboarding-status", email],
    queryFn: () => fetchOnboardingStatus(email),
    enabled,
    staleTime: Infinity, // só atualiza quando invalidado
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: () => readCachedStatus(email),
  })

  const data = enabled ? query.data ?? null : null
  const pending = status === "loading" || (enabled && query.isPending)

  return {
    email,
    allowed,
    data,
    pending,
    shouldShowOnboarding: enabled && data?.shouldShowOnboarding === true,
  }
}

export function OnboardingProvider() {
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const { email, data, shouldShowOnboarding } = useOnboardingStatus()
  const [showOnboarding, setShowOnboarding] = useState(false)
  // Modal aberto pelo banner (só as perguntas que faltam): pedido do usuário, não ocupa o slot
  const [manualQuestions, setManualQuestions] = useState<string[] | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  // Abre automaticamente uma única vez por visualização de página e só se o slot estiver livre
  useEffect(() => {
    if (!shouldShowOnboarding || showOnboarding) return
    if (claimModalSlot(SLOT_ID)) setShowOnboarding(true)
  }, [shouldShowOnboarding, showOnboarding, pathname])

  useEffect(() => {
    if (!email) return
    try {
      setBannerDismissed(localStorage.getItem(`onboarding-banner-dismissed-${email}`) === "true")
    } catch {
      setBannerDismissed(false)
    }
  }, [email])

  const refreshStatus = useCallback(async () => {
    if (!email) return
    writeCachedStatus(email, null)
    await queryClient.invalidateQueries({ queryKey: ["user-onboarding-status", email] })
  }, [email, queryClient])

  const handleClose = () => {
    setShowOnboarding(false)
    setManualQuestions(null)
    releaseModalSlot(SLOT_ID)
    // O modal já marcou lastOnboardingSeenAt: não reabrir na próxima página enquanto o status recarrega
    if (email) {
      queryClient.setQueryData<OnboardingStatus | null>(["user-onboarding-status", email], (prev) =>
        prev ? { ...prev, shouldShowOnboarding: false } : prev
      )
    }
    void refreshStatus()
  }

  const handleBannerDismiss = () => {
    setBannerDismissed(true)
    if (!email) return
    try {
      localStorage.setItem(`onboarding-banner-dismissed-${email}`, "true")
    } catch {
      // storage indisponível: o banner some só nesta sessão
    }
  }

  const missingQuestions = data?.missingQuestions ?? []
  const showBanner =
    !showOnboarding &&
    !manualQuestions &&
    !shouldShowOnboarding &&
    !bannerDismissed &&
    data?.hasMissingQuestions === true &&
    missingQuestions.length > 0

  const modalOpen = showOnboarding || manualQuestions !== null

  return (
    <>
      {modalOpen && (
        <OnboardingModal
          isOpen
          onClose={handleClose}
          onComplete={refreshStatus}
          // Onboarding novo mostra as boas-vindas; pelo banner, só as perguntas que faltam
          onlyQuestions={manualQuestions ?? undefined}
          pendingQuestions={data?.missingQuestions}
          savedData={{
            name: data?.name,
            acquisitionSource: data?.onboardingAcquisitionSource,
            experienceLevel: data?.onboardingExperienceLevel,
            investmentFocus: data?.onboardingInvestmentFocus,
          }}
        />
      )}
      {showBanner && (
        <OnboardingBanner
          missingQuestions={missingQuestions}
          onComplete={() => setManualQuestions(missingQuestions)}
          onDismiss={handleBannerDismiss}
        />
      )}
    </>
  )
}
