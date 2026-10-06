'use client'

import { InfoHint } from '@/components/ui/info-hint'
import type { StrategyAnalysis } from '@/lib/strategies'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface RadarStrategies {
  graham?: StrategyAnalysis | null
  barsi?: StrategyAnalysis | null
  dividendYield?: StrategyAnalysis | null
  lowPE?: StrategyAnalysis | null
  magicFormula?: StrategyAnalysis | null
  fcd?: StrategyAnalysis | null
  gordon?: StrategyAnalysis | null
  fundamentalist?: StrategyAnalysis | null
  bazin?: StrategyAnalysis | null
  lynch?: StrategyAnalysis | null
  bankPvp?: StrategyAnalysis | null
}

interface RadarStrategyBadgesProps {
  strategies: RadarStrategies
  /** Ticker da linha, para o nome acessível da ajuda. */
  ticker: string
  className?: string
}

/** Ordem e nomes das estratégias do radar (Barsi e Bazin são métodos distintos). */
export const RADAR_STRATEGY_LABELS: Array<{ key: keyof RadarStrategies; label: string }> = [
  { key: 'graham', label: 'Graham' },
  { key: 'barsi', label: 'Barsi' },
  { key: 'bazin', label: 'Bazin' },
  { key: 'lynch', label: 'Peter Lynch' },
  { key: 'bankPvp', label: 'P/VP justo' },
  { key: 'dividendYield', label: 'Dividend yield' },
  { key: 'lowPE', label: 'P/L baixo' },
  { key: 'magicFormula', label: 'Fórmula mágica' },
  { key: 'fcd', label: 'FCD' },
  { key: 'gordon', label: 'Gordon' },
  { key: 'fundamentalist', label: 'Fundamentalista' },
]

/**
 * Estratégias do ativo: contagem "6/8" + um ponto de 6 px por estratégia (cheio = aprovado, vazio = não aprovado)
 * e uma ajuda por toque com os nomes. Sem pílulas coloridas.
 */
export function RadarStrategyBadges({ strategies, ticker, className }: RadarStrategyBadgesProps) {
  const list = RADAR_STRATEGY_LABELS.map((item) => ({ ...item, analysis: strategies[item.key] })).filter(
    (item): item is typeof item & { analysis: StrategyAnalysis } => item.analysis !== null && item.analysis !== undefined
  )

  if (list.length === 0) {
    return <span className={cn('text-sm text-muted-foreground', className)}>—</span>
  }

  const approved = list.filter((item) => item.analysis.isEligible).length

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-sm font-medium tabular-nums text-foreground">
        {approved}/{list.length}
        <span className="sr-only"> estratégias aprovadas</span>
      </span>
      <span className="flex items-center gap-1">
        {list.map((item) => {
          const ok = item.analysis.isEligible
          return (
            <span
              key={item.key}
              role="img"
              aria-label={`${item.label}: ${ok ? 'aprovado' : 'não aprovado'}`}
              className={cn('size-1.5 shrink-0 rounded-full border', ok ? 'border-brand bg-brand' : 'border-muted-foreground')}
            />
          )
        })}
      </span>
      <InfoHint
        label={`Estratégias de ${ticker}`}
        side="bottom"
        content={
          <div className="space-y-2">
            <p className="font-medium text-foreground">Estratégias de {ticker}</p>
            <ul className="space-y-1">
              {list.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-1.5 rounded-full border',
                        item.analysis.isEligible ? 'border-brand bg-brand' : 'border-muted-foreground'
                      )}
                    />
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.analysis.isEligible ? 'Aprovado' : 'Não aprovado'}
                    {typeof item.analysis.score === 'number' && ` · ${formatNumber(item.analysis.score, { digits: 0 })}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        }
      />
    </div>
  )
}
