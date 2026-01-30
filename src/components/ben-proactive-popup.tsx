'use client'

/**
 * Popup proativo do Ben - Aparece próximo ao FAB com mensagens contextuais
 */

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

/**
 * Extrai contexto básico da página baseado no pathname (client-side)
 */
function extractBasicPageContext(pathname: string): { pageType: string; ticker?: string } {
  // Análise técnica de ação
  if (pathname.match(/^\/acao\/([^/]+)\/analise-tecnica/)) {
    const tickerMatch = pathname.match(/^\/acao\/([^/]+)\/analise-tecnica/)
    return {
      pageType: 'technical_analysis',
      ticker: tickerMatch ? tickerMatch[1].toUpperCase() : undefined
    }
  }
  // Análise técnica de BDR
  if (pathname.match(/^\/bdr\/([^/]+)\/analise-tecnica/)) {
    const tickerMatch = pathname.match(/^\/bdr\/([^/]+)\/analise-tecnica/)
    return {
      pageType: 'technical_analysis',
      ticker: tickerMatch ? tickerMatch[1].toUpperCase() : undefined
    }
  }
  // Radar de dividendos por ticker
  if (pathname.startsWith('/radar-dividendos/')) {
    const tickerMatch = pathname.match(/^\/radar-dividendos\/([^/]+)/)
    return {
      pageType: 'dividend_radar',
      ticker: tickerMatch ? tickerMatch[1].toUpperCase() : undefined
    }
  }
  if (pathname.startsWith('/acao/')) {
    const tickerMatch = pathname.match(/^\/acao\/([^/]+)/)
    return {
      pageType: 'action',
      ticker: tickerMatch ? tickerMatch[1].toUpperCase() : undefined
    }
  }
  if (pathname.startsWith('/bdr/')) {
    const tickerMatch = pathname.match(/^\/bdr\/([^/]+)/)
    return {
      pageType: 'bdr',
      ticker: tickerMatch ? tickerMatch[1].toUpperCase() : undefined
    }
  }
  if (pathname === '/radar') {
    return { pageType: 'radar' }
  }
  if (pathname === '/dashboard' || pathname === '/') {
    return { pageType: 'dashboard' }
  }
  return { pageType: 'other' }
}

interface BenProactivePopupProps {
  show: boolean
  onClose: () => void
  onStartConversation: () => void
  messageType: 'first_time' | 'inactive' | 'contextual' | null
  message?: {
    title: string
    message: string
    cta: string
  }
}

export function BenProactivePopup({
  show,
  onClose,
  onStartConversation,
  messageType,
  message
}: BenProactivePopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    if (show) {
      setIsMounted(true)
      // Delay para animação suave
      setTimeout(() => setIsVisible(true), 100)
    } else {
      setIsVisible(false)
      // Aguardar animação antes de desmontar
      setTimeout(() => setIsMounted(false), 300)
    }
  }, [show])

  if (!isMounted || !message) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed bottom-20 sm:bottom-24 right-4 sm:right-6 z-50',
        'w-[calc(100vw-2rem)] max-w-[320px] sm:w-[380px]',
        'transition-all duration-300 ease-out',
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      )}
    >
      <Card className="shadow-2xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30">
        <CardContent className="p-4">
          {/* Header com avatar do Ben */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-violet-500 p-0.5 shrink-0">
              <Image
                src="/ben.png"
                alt="Ben"
                width={48}
                height={48}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm">{message.title}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={onClose}
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Mensagem */}
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            {message.message}
          </p>

          {/* Botões de ação */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={onStartConversation}
              className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
              size="sm"
            >
              {message.cta}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="shrink-0 w-full sm:w-auto"
            >
              Depois
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Seta apontando para o FAB */}
      <div className="absolute -bottom-2 right-8 sm:right-8 w-4 h-4 bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 border-r-2 border-b-2 border-blue-200 dark:border-blue-800 transform rotate-45" />
    </div>
  )
}

/**
 * Hook para gerenciar popup proativo do Ben
 */
export function useBenProactivePopup() {
  const pathname = usePathname()
  const [showPopup, setShowPopup] = useState(false)
  const [popupData, setPopupData] = useState<{
    messageType: 'first_time' | 'inactive' | 'contextual' | null
    message: { title: string; message: string; cta: string } | null
  }>({
    messageType: null,
    message: null
  })

  useEffect(() => {
    // Verificar se já foi mostrado nesta sessão (localStorage)
    const popupShownKey = 'ben-proactive-popup-shown'
    const lastShown = localStorage.getItem(popupShownKey)
    const now = Date.now()
    
    // Se foi mostrado há menos de 1 hora, não mostrar novamente
    if (lastShown && now - parseInt(lastShown) < 60 * 60 * 1000) {
      return
    }

    // Delay antes de mostrar (2-3 segundos)
    const timer = setTimeout(async () => {
      try {
        const contextUrl = pathname

        const response = await fetch(`/api/ben/interactions?contextUrl=${encodeURIComponent(contextUrl)}`)
        if (!response.ok) return

        const data = await response.json()
        
        if (data.success && data.proactive?.shouldShow && data.proactive?.message) {
          setPopupData({
            messageType: data.proactive.messageType,
            message: data.proactive.message
          })
          setShowPopup(true)
          
          // Marcar como mostrado
          localStorage.setItem(popupShownKey, now.toString())
        }
      } catch (error) {
        console.error('[Ben Proactive Popup] Erro ao verificar:', error)
      }
    }, 2500) // 2.5 segundos de delay

    return () => clearTimeout(timer)
  }, [pathname])

  const handleClose = () => {
    setShowPopup(false)
  }

  const handleStartConversation = () => {
    setShowPopup(false)
    // O FAB será aberto pelo componente pai
  }

  return {
    showPopup,
    popupData,
    handleClose,
    handleStartConversation
  }
}

