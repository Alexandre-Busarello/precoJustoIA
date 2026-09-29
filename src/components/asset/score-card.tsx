import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { InfoHint } from '@/components/ui/info-hint'

export interface ScorePillar {
  label: string
  /** 0–100 */
  value: number | null
  hint?: string
}

export interface ScoreCardProps {
  /** 0–100 */
  score: number | null
  /** Classificação textual (ex.: "Bom"). */
  label?: string
  pillars?: ScorePillar[]
  /** `compact`: número + rótulo + barra (cabeçalho). `full`: inclui a lista de pilares. */
  variant?: 'compact' | 'full'
  locked?: boolean
  title?: string
  className?: string
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value))
}

/** Barra fina neutra com preenchimento na cor da marca. */
export function ScoreBar({ value, className }: { value: number | null; className?: string }) {
  const width = value === null || !Number.isFinite(value) ? 0 : clamp(value)
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
    >
      <div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
    </div>
  )
}

/** Score único (0–100) usado por ação, FII, ETF e BDR. */
export function ScoreCard({ score, label, pillars = [], variant = 'full', locked = false, title = 'Score', className }: ScoreCardProps) {
  const hasScore = typeof score === 'number' && Number.isFinite(score)

  return (
    <div className={cn(variant === 'full' && 'rounded-lg border border-border bg-card p-4 sm:p-5', className)}>
      {variant === 'full' && <p className="text-sm font-medium text-foreground">{title}</p>}
      <div className={cn('flex items-baseline gap-2', variant === 'full' && 'mt-2')}>
        {locked ? (
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="select-none text-3xl font-semibold tabular-nums blur-sm">
              00
            </span>
            <Lock className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">Disponível no Premium</span>
          </span>
        ) : (
          <span data-num className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {hasScore ? formatNumber(Math.round(score), { digits: 0 }) : '—'}
          </span>
        )}
        <span className="text-sm text-muted-foreground">/100</span>
        {label && !locked && <span className="ml-1 text-sm font-medium text-foreground">{label}</span>}
      </div>
      <ScoreBar value={locked || !hasScore ? null : score} className="mt-2" />

      {variant === 'full' && pillars.length > 0 && (
        <ul className="mt-4 space-y-3">
          {pillars.map((pillar) => (
            <li key={pillar.label}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                  <span className="truncate">{pillar.label}</span>
                  {pillar.hint && <InfoHint content={pillar.hint} />}
                </span>
                <span data-num className="font-medium tabular-nums text-foreground">
                  {locked || pillar.value === null ? '—' : formatNumber(Math.round(pillar.value), { digits: 0 })}
                </span>
              </div>
              <ScoreBar value={locked ? null : pillar.value} className="mt-1.5 h-1" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
