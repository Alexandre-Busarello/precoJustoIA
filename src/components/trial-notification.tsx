"use client"

import { usePremiumStatus } from '@/hooks/use-premium-status'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertCircle, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

/**
 * Notificação suave quando trial está acabando
 * Aparece quando restam 3 dias ou 1 dia
 */
export function TrialNotification() {
  const { isTrialActive, trialDaysRemaining, isPremium } = usePremiumStatus()
  const [dismissed, setDismissed] = useState(false)

  // Não mostrar se não está em trial, foi dispensado ou já é Premium
  if (!isTrialActive || dismissed || !trialDaysRemaining || (isPremium && !isTrialActive)) {
    return null
  }

  // Mostrar apenas quando restam 3 dias ou 1 dia
  if (trialDaysRemaining > 3 || trialDaysRemaining < 1) {
    return null
  }

  // Verificar se já foi dispensado no localStorage
  useEffect(() => {
    const dismissedKey = `trial-notification-dismissed-${trialDaysRemaining}`
    const wasDismissed = localStorage.getItem(dismissedKey)
    if (wasDismissed) {
      setDismissed(true)
    }
  }, [trialDaysRemaining])

  const handleDismiss = () => {
    const dismissedKey = `trial-notification-dismissed-${trialDaysRemaining}`
    localStorage.setItem(dismissedKey, 'true')
    setDismissed(true)
  }

  const isUrgent = trialDaysRemaining === 1

  return (
    <Alert className={`mb-4 ${isUrgent ? 'border-orange-500 bg-orange-50' : 'border-violet-500 bg-violet-50'}`}>
      <AlertCircle className={`h-4 w-4 ${isUrgent ? 'text-orange-600' : 'text-violet-600'}`} />
      <AlertTitle className={isUrgent ? 'text-orange-900' : 'text-violet-900'}>
        {isUrgent 
          ? '⚠️ Último dia do seu Trial Premium!' 
          : `⏰ Seu Trial Premium termina em ${trialDaysRemaining} dias`}
      </AlertTitle>
      <AlertDescription className={isUrgent ? 'text-orange-800' : 'text-violet-800'}>
        {isUrgent 
          ? 'Não perca o acesso a todos os recursos Premium. Assine agora e continue aproveitando!' 
          : 'Continue aproveitando todos os recursos Premium. Assine agora e garanta seu acesso!'}
      </AlertDescription>
      <div className="flex items-center gap-2 mt-3">
        <Button
          asChild
          size="sm"
          variant={isUrgent ? "default" : "outline"}
          className={isUrgent ? 'bg-orange-600 hover:bg-orange-700' : ''}
        >
          <Link href="/planos">
            Assinar Premium Agora
          </Link>
        </Button>
        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-700 ml-auto p-1"
          aria-label="Fechar notificação"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </Alert>
  )
}

