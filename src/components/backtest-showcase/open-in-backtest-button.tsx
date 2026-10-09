'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { QUICK_DEFAULTS, busyLabel, quickLandingUrl } from '@/lib/backtest/quick-backtest'

interface OpenInBacktestButtonProps {
  title: string
  tickers: string[]
  initialCapital: number
  monthlyContribution: number
  rebalanceFrequency: 'monthly' | 'quarterly' | 'yearly'
}

/**
 * Premium: roda a vitrine no backtest rápido com os mesmos ativos e valores e abre o resultado na ferramenta
 * (o mesmo motor e a mesma janela de 5 anos, então os números conferem com o card).
 */
export function OpenInBacktestButton({ title, tickers, initialCapital, monthlyContribution, rebalanceFrequency }: OpenInBacktestButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const open = async () => {
    if (busy) return
    setBusy(true)
    let navigating = false
    try {
      const response = await fetch('/api/backtest/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers,
          source: 'asset',
          sourceLabel: title,
          overrides: { years: QUICK_DEFAULTS.years, initialCapital, monthlyContribution, rebalanceFrequency },
          mode: 'run',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        router.push('/login?callbackUrl=/backtest')
        return
      }
      if (!response.ok || !data.configId) {
        toast({ title: 'Não foi possível simular', description: data.error || 'Tente de novo em instantes.', variant: 'destructive' })
        return
      }
      navigating = true
      router.push(
        quickLandingUrl({
          configId: data.configId,
          view: 'results',
          source: 'asset',
          sourceLabel: data.sourceLabel ?? title,
          returnTo: `${window.location.pathname}${window.location.search}`,
          adjustments: data.adjustments,
        })
      )
    } catch (error) {
      console.error('Erro ao abrir a vitrine no backtest:', error)
      toast({ title: 'Não foi possível simular', description: 'Verifique a conexão e tente de novo.', variant: 'destructive' })
    } finally {
      if (!navigating) setBusy(false)
    }
  }

  return (
    <Button type="button" variant="outline" onClick={open} disabled={busy} aria-busy={busy || undefined} className="w-full sm:w-auto">
      {busy ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <BarChart3 className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
      )}
      {busy ? busyLabel(QUICK_DEFAULTS.years) : 'Abrir no backtest'}
    </Button>
  )
}
