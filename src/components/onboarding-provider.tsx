"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { OnboardingModal } from "./onboarding-modal"
import { OnboardingBanner } from "./onboarding-banner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNotificationModal } from "@/hooks/use-notification-modal"

async function fetchUserOnboardingStatus(email?: string) {
  // Verificar cache no localStorage primeiro
  if (email) {
    const cacheKey = `onboarding-status-cache-${email}`
    const cachedData = localStorage.getItem(cacheKey)
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData)
        const now = Date.now()
        // Se o cache ainda é válido (menos de 30 minutos), retornar do cache
        if (parsed.timestamp && (now - parsed.timestamp) < 30 * 60 * 1000) {
          console.log('[Onboarding] Usando cache do localStorage')
          return parsed.data
        }
      } catch {
        // Cache inválido, continuar para buscar do servidor
        console.warn('[Onboarding] Cache inválido, buscando do servidor')
      }
    }
  }

  // Buscar do servidor
  const response = await fetch("/api/user/onboarding-status")
  if (!response.ok) {
    return null
  }
  const data = await response.json()
  
  // Salvar no cache do localStorage
  if (email && data) {
    const cacheKey = `onboarding-status-cache-${email}`
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
  }
  
  return data
}

// Páginas internas onde o onboarding deve aparecer
const ONBOARDING_ALLOWED_PAGES = [
  "/dashboard",
  "/acao",
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

// Verifica se a rota atual é uma página interna permitida
function isOnboardingAllowedPage(pathname: string): boolean {
  // Verificar se é uma rota exata
  if (ONBOARDING_ALLOWED_PAGES.includes(pathname)) {
    return true
  }
  
  // Verificar se é uma rota dinâmica (ex: /acao/PETR4)
  if (pathname.startsWith("/acao/")) {
    return true
  }
  
  // Verificar se é uma rota de comparação (ex: /compara-acoes)
  if (pathname.startsWith("/compara-acoes")) {
    return true
  }
  
  return false
}

export function OnboardingProvider() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  
  // Verificar se há notificações modais pendentes (MODAL ou QUIZ)
  // Se houver, não mostrar onboarding até que sejam fechadas
  const { notification: modalNotification, isLoading: isLoadingModal } = useNotificationModal()

  // Verificar se está em uma página permitida
  const isAllowedPage = pathname ? isOnboardingAllowedPage(pathname) : false

  // Buscar status do onboarding do usuário apenas se:
  // 1. Usuário está autenticado
  // 2. Tem email na sessão
  // 3. Está em uma página permitida
  const { data: onboardingStatus } = useQuery({
    queryKey: ["user-onboarding-status", session?.user?.email],
    queryFn: () => fetchUserOnboardingStatus(session?.user?.email || undefined),
    enabled: status === "authenticated" && !!session?.user?.email && isAllowedPage,
    staleTime: Infinity, // Dados nunca ficam stale - só atualiza quando invalidamos manualmente
    gcTime: 60 * 60 * 1000, // 1 hora - dados permanecem no cache por 1 hora após não serem usados
    refetchOnWindowFocus: false, // Não refazer quando a janela recebe foco
    refetchOnMount: false, // Não refazer ao montar - sempre usa cache se disponível
    refetchOnReconnect: false, // Não refazer ao reconectar
    // Usar placeholderData do localStorage para evitar loading state
    placeholderData: () => {
      if (session?.user?.email) {
        const cacheKey = `onboarding-status-cache-${session.user.email}`
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData)
            const now = Date.now()
            // Se o cache ainda é válido, usar como placeholder
            if (parsed.timestamp && (now - parsed.timestamp) < 30 * 60 * 1000) {
              return parsed.data
            }
          } catch {
            // Ignorar erro
          }
        }
      }
      return undefined
    },
  })

  useEffect(() => {
    // CRÍTICO: Não mostrar onboarding se houver notificações modais pendentes
    // Priorizar notificações sobre onboarding
    if (isLoadingModal || modalNotification) {
      setShowOnboarding(false)
      setShowBanner(false)
      return
    }

    // Mostrar onboarding completo apenas se:
    // 1. Usuário está autenticado
    // 2. lastOnboardingSeenAt é null (nunca viu o onboarding)
    // 3. Está em uma página interna permitida
    // 4. NÃO há notificações modais pendentes (verificado acima)
    if (
      status === "authenticated" &&
      session?.user?.email &&
      onboardingStatus?.shouldShowOnboarding === true &&
      pathname &&
      isOnboardingAllowedPage(pathname)
    ) {
      setShowOnboarding(true)
      setShowBanner(false) // Não mostrar banner se está mostrando onboarding completo
    } else {
      // Esconder onboarding se não estiver em página permitida
      setShowOnboarding(false)
      
      // Mostrar banner se tem perguntas faltando e não foi dispensado
      if (
        status === "authenticated" &&
        session?.user?.email &&
        onboardingStatus?.hasMissingQuestions === true &&
        !bannerDismissed &&
        pathname &&
        isOnboardingAllowedPage(pathname)
      ) {
        // Verificar se o banner foi dispensado no localStorage
        const dismissedKey = `onboarding-banner-dismissed-${session.user.email}`
        const wasDismissed = localStorage.getItem(dismissedKey) === 'true'
        if (!wasDismissed) {
          setShowBanner(true)
        }
      } else {
        setShowBanner(false)
      }
    }
  }, [status, session, onboardingStatus, pathname, bannerDismissed, modalNotification, isLoadingModal])

  const handleClose = () => {
    setShowOnboarding(false)
  }

  const handleComplete = async () => {
    setShowOnboarding(false)
    setShowBanner(false)
    // Limpar cache do localStorage
    if (session?.user?.email) {
      const cacheKey = `onboarding-status-cache-${session.user.email}`
      localStorage.removeItem(cacheKey)
    }
    // Invalidar query para atualizar o status
    await queryClient.invalidateQueries({
      queryKey: ["user-onboarding-status", session?.user?.email],
    })
  }

  const handleBannerComplete = () => {
    setShowBanner(false)
    setShowOnboarding(true) // Abrir modal com apenas as perguntas faltantes
  }

  const handleBannerDismiss = () => {
    setShowBanner(false)
    setBannerDismissed(true)
    // Salvar no localStorage para não mostrar novamente
    if (session?.user?.email) {
      const dismissedKey = `onboarding-banner-dismissed-${session.user.email}`
      localStorage.setItem(dismissedKey, 'true')
    }
  }

  return (
    <>
      {showOnboarding && (
        <OnboardingModal
          isOpen={showOnboarding}
          onClose={handleClose}
          onComplete={handleComplete}
          // Só passar onlyQuestions se for um onboarding parcial (já visto, mas com perguntas faltando)
          // Quando shouldShowOnboarding === true, é onboarding novo completo - mostrar welcome
          // Quando hasMissingQuestions === true mas shouldShowOnboarding === false, é onboarding parcial
          onlyQuestions={
            onboardingStatus?.shouldShowOnboarding === true
              ? undefined // Onboarding completo novo - mostrar welcome
              : onboardingStatus?.missingQuestions && onboardingStatus.missingQuestions.length > 0
                ? onboardingStatus.missingQuestions // Onboarding parcial - mostrar apenas perguntas faltantes
                : undefined
          }
          savedData={{
            acquisitionSource: onboardingStatus?.onboardingAcquisitionSource,
            experienceLevel: onboardingStatus?.onboardingExperienceLevel,
            investmentFocus: onboardingStatus?.onboardingInvestmentFocus,
          }}
        />
      )}
      {showBanner && onboardingStatus?.missingQuestions && (
        <OnboardingBanner
          missingQuestions={onboardingStatus.missingQuestions}
          onComplete={handleBannerComplete}
          onDismiss={handleBannerDismiss}
        />
      )}
    </>
  )
}

