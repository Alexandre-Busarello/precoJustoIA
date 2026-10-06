'use client'

import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/lib/format'
import type { TechnicalAnalysisData } from '@/lib/technical-analysis-service'

interface TechnicalAnalysisTrafficLightProps {
  ticker: string
  currentPrice: number
  compact?: boolean // Versão compacta (bloco da página de ativo)
}

interface ApiResponse {
  analysis: TechnicalAnalysisData
}

type Tone = 'positive' | 'warning' | 'negative'

const subscribeNoop = () => () => {}

const DOT: Record<Tone, string> = {
  positive: 'bg-positive',
  warning: 'bg-warning',
  negative: 'bg-negative',
}

/**
 * Posição do preço em relação à faixa estimada pela análise técnica (sem linguagem de compra/venda).
 * Dentro da faixa e abaixo do preço justo técnico = positivo; acima da faixa = negativo; demais = atenção.
 */
export function technicalPosition(
  analysis: Pick<TechnicalAnalysisData, 'aiFairEntryPrice' | 'aiMinPrice' | 'aiMaxPrice'>,
  price: number
): { tone: Tone; label: string } | null {
  const fair = analysis.aiFairEntryPrice
  if (!fair || price <= 0) return null
  const { aiMinPrice: min, aiMaxPrice: max } = analysis
  if (min && max) {
    if (price < min) return { tone: 'warning', label: 'Técnica: abaixo da faixa estimada' }
    if (price > max) return { tone: 'negative', label: 'Técnica: acima da faixa estimada' }
    return { tone: price <= fair ? 'positive' : 'warning', label: 'Técnica: dentro da faixa estimada' }
  }
  const diff = price / fair - 1
  if (diff <= 0) return { tone: 'positive', label: 'Técnica: abaixo do preço justo técnico' }
  if (diff <= 0.1) return { tone: 'warning', label: 'Técnica: próximo do preço justo técnico' }
  return { tone: 'negative', label: 'Técnica: acima do preço justo técnico' }
}

export default function TechnicalAnalysisTrafficLight({
  ticker,
  currentPrice,
  compact = false
}: TechnicalAnalysisTrafficLightProps) {
  const { data, isLoading } = useQuery<ApiResponse | null>({
    queryKey: ['technical-analysis-traffic-light', ticker],
    queryFn: async () => {
      const response = await fetch(`/api/technical-analysis/${ticker}`)
      if (!response.ok) {
        return null
      }
      return response.json()
    },
    staleTime: 1000 * 60 * 30, // Cache por 30 minutos
    retry: false
  })

  // Servidor e hidratação renderizam o esqueleto; o estado real só depois de montar (evita divergência)
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false)

  const analysis = data?.analysis
  const position = analysis ? technicalPosition(analysis, currentPrice) : null
  const boxClass = cn('rounded-lg border border-border bg-card', compact ? 'p-3' : 'p-4 sm:p-5')

  if (!hydrated || isLoading) {
    return (
      <div className={boxClass} aria-busy="true">
        <Skeleton className="h-4 w-56 max-w-full" />
        <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      </div>
    )
  }

  if (!analysis || !position) {
    return (
      <div className={boxClass}>
        <p className="text-sm font-medium text-foreground">Faixa técnica indisponível no momento</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ainda não há uma faixa estimada para {ticker}. A análise completa mostra os indicadores técnicos disponíveis.
        </p>
      </div>
    )
  }

  const hasRange = Boolean(analysis.aiMinPrice && analysis.aiMaxPrice)

  return (
    <div className={boxClass}>
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', DOT[position.tone])} />
        {position.label}
      </p>
      <dl className={cn('mt-2 grid gap-x-6 gap-y-1 text-sm', hasRange ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
        {hasRange && (
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <dt className="text-muted-foreground">Faixa estimada (30 dias)</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {formatBRL(analysis.aiMinPrice)} – {formatBRL(analysis.aiMaxPrice)}
            </dd>
          </div>
        )}
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <dt className="text-muted-foreground">Preço justo técnico</dt>
          <dd className="font-medium tabular-nums text-foreground">{formatBRL(analysis.aiFairEntryPrice)}</dd>
        </div>
        {!compact && (
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <dt className="text-muted-foreground">Preço atual</dt>
            <dd className="font-medium tabular-nums text-foreground">{formatBRL(currentPrice)}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}
