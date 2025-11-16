"use client"

import { usePremiumStatus } from '@/hooks/use-premium-status'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useState } from 'react'

/**
 * Banner discreto mostrando status do trial
 * Aparece quando usuário está em trial ativo
 */
export function TrialBanner() {
  const { isTrialActive, trialDaysRemaining, isPremium } = usePremiumStatus()
  const [dismissed, setDismissed] = useState(false)

  // Não mostrar se não está em trial ou se foi dispensado
  if (!isTrialActive || dismissed || !trialDaysRemaining) {
    return null
  }

  // Não mostrar se já é Premium (não está mais em trial)
  if (isPremium && !isTrialActive) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-violet-50 to-pink-50 border-b border-violet-200/50 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium text-violet-900">
            🎁 Trial Premium Ativo
          </span>
          <span className="text-sm text-violet-700">
            {trialDaysRemaining === 1 
              ? 'Último dia!' 
              : `${trialDaysRemaining} dias restantes`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="default"
            className="bg-violet-600 hover:bg-violet-700"
          >
            <Link href="/planos">
              Assinar Premium
            </Link>
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-violet-600 hover:text-violet-800 p-1"
            aria-label="Fechar banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

