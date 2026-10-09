'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart } from 'lucide-react'

import { getIbovBannerSummary, type IbovBannerSummary } from '@/app/actions/ibov-projection'
import { formatNumber } from '@/lib/format'
import type { PageNoticeSource } from '@/components/page-notice'

const DISMISS_PREFIX = 'pja-ibov-range-dismissed:'

function readDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(DISMISS_PREFIX + key) === '1'
  } catch {
    return false
  }
}

/** Segunda-feira da semana do fechamento (YYYY-MM-DD): dispensar esconde o aviso até a semana seguinte. */
function weekKey(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/** 198.420 → "198 mil". */
function thousands(value: number): string {
  return `${formatNumber(Math.round(value / 1000), { digits: 0 })} mil`
}

/**
 * Faixa provável do Ibovespa para o mês (estatística histórica), como aviso inline de menor prioridade no PageNotice.
 * O número vem do cálculo determinístico do servidor; nada aqui chama IA.
 */
export function useIbovProjectionNotice({ enabled }: { enabled: boolean }): PageNoticeSource {
  const { data, isLoading } = useQuery<IbovBannerSummary | null>({
    queryKey: ['ibov-banner-summary'],
    queryFn: () => getIbovBannerSummary(),
    enabled,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const key = data ? weekKey(data.lastCloseDate) : null

  useEffect(() => {
    if (key && readDismissed(key)) setDismissedKey(key)
  }, [key])

  if (!enabled) return { pending: true, notice: null }
  if (isLoading) return { pending: true, notice: null }
  if (!data || !key || dismissedKey === key) return { pending: false, notice: null }

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
      title: (
        <span className="tabular-nums">
          Ibovespa: faixa provável para o mês entre {thousands(data.low)} e {thousands(data.high)} pts
        </span>
      ),
      description: 'Estatística com base no histórico do índice, não é previsão nem recomendação.',
      action: { label: 'Ver faixas', href: '/projecoes-ibov' },
      onDismiss: dismiss,
    },
  }
}
