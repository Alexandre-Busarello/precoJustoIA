'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart } from 'lucide-react'

import { getOrCreateIbovProjection } from '@/app/actions/ibov-projection'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { formatDeltaPct, formatNumber } from '@/lib/format'
import type { PageNoticeSource } from '@/components/page-notice'

type Period = 'WEEKLY' | 'MONTHLY'

interface ProjectionResult {
  success: boolean
  projection?: { projectedValue: number; validUntil: string | Date }
  currentValue?: number | null
  isPremium?: boolean
}

const DISMISS_PREFIX = 'pja-ibov-notice-dismissed:'

function readDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(DISMISS_PREFIX + key) === '1'
  } catch {
    return false
  }
}

/** Só leitura: nunca dispara o cálculo da projeção (que usa IA); se ainda não existe, não há aviso. */
function useProjection(period: Period, enabled: boolean) {
  return useQuery<ProjectionResult>({
    queryKey: ['ibov-projection', period],
    queryFn: () => getOrCreateIbovProjection(period) as Promise<ProjectionResult>,
    enabled,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

function describe(label: string, result: ProjectionResult | undefined): string | null {
  const projected = result?.projection?.projectedValue
  const current = result?.currentValue
  if (!result?.success || !projected || projected <= 0) return null
  const delta = current && current > 0 ? projected / current - 1 : null
  return `${label} ${formatNumber(projected, { digits: 0 })} pts${delta !== null ? ` (${formatDeltaPct(delta)})` : ''}`
}

/**
 * Estimativa semanal/mensal do Ibovespa gerada pelo Ben, como aviso inline de menor prioridade no PageNotice.
 * Só para Premium (para o plano gratuito os valores vêm ocultos do servidor).
 */
export function useIbovProjectionNotice({ enabled }: { enabled: boolean }): PageNoticeSource {
  const { isPremium, isLoading: premiumLoading } = usePremiumStatus()
  const active = enabled && !premiumLoading && !!isPremium
  const weekly = useProjection('WEEKLY', active)
  const monthly = useProjection('MONTHLY', active)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  const validUntil = weekly.data?.projection?.validUntil ?? monthly.data?.projection?.validUntil
  const key = validUntil ? new Date(validUntil).toISOString().slice(0, 10) : null

  useEffect(() => {
    if (key && readDismissed(key)) setDismissedKey(key)
  }, [key])

  if (!enabled || premiumLoading) return { pending: true, notice: null }
  if (!isPremium) return { pending: false, notice: null }
  if (weekly.isLoading || monthly.isLoading) return { pending: true, notice: null }

  const parts = [describe('Semana:', weekly.data), describe('Mês:', monthly.data)].filter(Boolean)
  if (parts.length === 0 || !key || dismissedKey === key) return { pending: false, notice: null }

  const dismiss = () => {
    setDismissedKey(key)
    try {
      window.localStorage.setItem(DISMISS_PREFIX + key, '1')
    } catch {
      // Sem localStorage: o aviso some só nesta visita
    }
  }

  return {
    pending: false,
    notice: {
      id: 'ibov-projection',
      icon: LineChart,
      title: 'Estimativa do Ben para o Ibovespa',
      description: <span className="tabular-nums">{parts.join(' · ')}. Estimativa gerada por IA, não é recomendação.</span>,
      action: { label: 'Ver projeções', href: '/projecoes-ibov' },
      onDismiss: dismiss,
    },
  }
}
