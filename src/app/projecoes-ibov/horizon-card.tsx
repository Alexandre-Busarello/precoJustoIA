/**
 * Cartão de um horizonte: faixa provável (p16–p84), faixa ampla (p5–p95), frequência de alta e calibração.
 * Faixas são estimativas estatísticas: nada de verde/vermelho aqui, que fica para resultados realizados.
 */

import { Badge } from '@/components/ui/badge'
import { formatDate, formatDeltaPct, formatNumber, formatPct } from '@/lib/format'
import type { Calibration, HorizonProjection } from '@/lib/ibov-projections/engine'

const points = (value: number) => formatNumber(value, { digits: 0 })

const VERDICT: Record<Calibration['verdict'], { label: string; variant: 'neutral' | 'warning' }> = {
  ok: { label: 'Calibração dentro do esperado', variant: 'neutral' },
  'too-wide': { label: 'Faixa mais larga que o observado', variant: 'warning' },
  'too-narrow': { label: 'Faixa mais estreita que o observado', variant: 'warning' },
  insufficient: { label: 'Amostra pequena', variant: 'neutral' },
}

/** Barra horizontal: faixa ampla (clara), faixa provável (marca), mediana (traço) e último fechamento (ponto). */
function RangeBar({ horizon, lastClose }: { horizon: HorizonProjection; lastClose: number }) {
  const levels = horizon.levels!
  const min = Math.min(levels.p5, lastClose)
  const max = Math.max(levels.p95, lastClose)
  const span = max - min || 1
  const pos = (v: number) => `${((v - min) / span) * 100}%`
  const width = (a: number, b: number) => `${((b - a) / span) * 100}%`

  return (
    <div aria-hidden="true" className="relative h-6">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <div className="absolute top-1.5 h-3 rounded-sm bg-brand/15" style={{ left: pos(levels.p5), width: width(levels.p5, levels.p95) }} />
      <div className="absolute top-1.5 h-3 rounded-sm bg-brand/40" style={{ left: pos(levels.p16), width: width(levels.p16, levels.p84) }} />
      <div className="absolute top-0.5 h-5 w-0.5 -translate-x-1/2 rounded-full bg-brand" style={{ left: pos(levels.p50) }} />
      <div
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground"
        style={{ left: pos(lastClose) }}
      />
    </div>
  )
}

function RangeRow({ label, low, high, lowReturn, highReturn }: { label: string; low: number; high: number; lowReturn: number; highReturn: number }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">
        <span className="text-lg font-semibold text-foreground">
          {points(low)} a {points(high)}
        </span>
        <span className="ml-1 text-xs text-muted-foreground">pts</span>
        <span className="block text-xs text-muted-foreground">
          {formatDeltaPct(lowReturn)} a {formatDeltaPct(highReturn)}
        </span>
      </dd>
    </div>
  )
}

function calibrationText(horizon: HorizonProjection): string | null {
  const c = horizon.calibration
  if (c.insideProbable === null || c.insideWide === null) return null
  const base = `Nos últimos 5 anos, o fechamento caiu dentro da faixa provável em ${formatPct(c.insideProbable, { digits: 0 })} ${horizon.periodNoun} e dentro da faixa ampla em ${formatPct(c.insideWide, { digits: 0 })}`
  if (c.verdict === 'insufficient') {
    return `${base} (${formatNumber(c.evaluations, { digits: 0 })} datas avaliadas, só ${formatNumber(c.independentPeriods, { digits: 0 })} períodos sem sobreposição: amostra pequena para concluir).`
  }
  if (c.verdict === 'too-narrow') return `${base}. O índice saiu da faixa mais vezes que o esperado (68% e 90%).`
  if (c.verdict === 'too-wide') return `${base}. A faixa tem sido mais larga que o necessário (68% e 90%).`
  return `${base}, perto dos 68% e 90% esperados.`
}

export function HorizonCard({
  horizon,
  lastClose,
  historyStart,
}: {
  horizon: HorizonProjection
  lastClose: number
  historyStart: string | null
}) {
  const title = `Faixa para ${horizon.label}`

  if (horizon.status !== 'ok' || !horizon.levels || !horizon.returns) {
    return (
      <section className="space-y-2 rounded-lg border border-border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">Histórico insuficiente para calcular esta faixa.</p>
      </section>
    )
  }

  const { levels, returns } = horizon
  const verdict = VERDICT[horizon.calibration.verdict]
  const calibration = calibrationText(horizon)

  return (
    <section aria-labelledby={`horizon-${horizon.id}`} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="space-y-0.5">
        <h2 id={`horizon-${horizon.id}`} className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{formatNumber(horizon.tradingDays, { digits: 0 })} pregões à frente do último fechamento</p>
      </div>

      <dl className="space-y-3">
        <RangeRow label="Faixa provável (cerca de 68%)" low={levels.p16} high={levels.p84} lowReturn={returns.p16} highReturn={returns.p84} />
        <RangeRow label="Faixa ampla (cerca de 90%)" low={levels.p5} high={levels.p95} lowReturn={returns.p5} highReturn={returns.p95} />
      </dl>

      <RangeBar horizon={horizon} lastClose={lastClose} />

      <dl className="text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Mediana histórica</dt>
          <dd className="tabular-nums text-foreground">
            {points(levels.p50)} <span className="text-xs text-muted-foreground">({formatDeltaPct(returns.p50)})</span>
          </dd>
        </div>
      </dl>
      {horizon.positiveShare !== null && (
        <p className="text-sm leading-6 text-foreground">
          Em {formatPct(horizon.positiveShare, { digits: 0 })} {horizon.periodNoun} dos últimos 10 anos, o Ibovespa terminou acima do
          ponto de partida.
        </p>
      )}

      <div className="mt-auto space-y-2 border-t border-border pt-3">
        <Badge variant={verdict.variant}>{verdict.label}</Badge>
        {calibration && <p className="text-xs leading-5 text-muted-foreground">{calibration}</p>}
        <p className="text-xs leading-5 text-muted-foreground">
          Amostra: {formatNumber(horizon.sampleSize, { digits: 0 })} janelas sobrepostas
          {historyStart ? ` desde ${formatDate(`${historyStart}T12:00:00Z`)}` : ''} (cerca de{' '}
          {formatNumber(horizon.independentPeriods, { digits: 0 })} períodos sem sobreposição).
        </p>
      </div>
    </section>
  )
}
