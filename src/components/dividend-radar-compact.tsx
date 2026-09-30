'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionHeader } from '@/components/ui/section-header'
import { useDividendRadarProjections } from '@/hooks/use-dividend-radar'
import { formatBRL, formatDate, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'

interface DividendRadarCompactProps {
  ticker: string
  companyName: string
  /** Dividend yield atual (fração). Com valor > 0, mostra o link para a calculadora de renda passiva. */
  dividendYield?: number | null
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

interface MonthSlot {
  month: number
  year: number
  isCurrent: boolean
}

/** 4 meses passados + mês atual + 6 meses futuros. */
function monthWindow(now: Date): MonthSlot[] {
  return Array.from({ length: 11 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 4 + index, 1)
    return { month: date.getMonth() + 1, year: date.getFullYear(), isCurrent: index === 4 }
  })
}

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-brand" />
        Pago
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-full border-2 border-brand" />
        Projetado (estimativa)
      </span>
    </div>
  )
}

/** Radar de dividendos compacto: meses com pagamento confirmado (ponto cheio) e projetado (ponto vazado). */
export function DividendRadarCompact({ ticker, companyName, dividendYield }: DividendRadarCompactProps) {
  const { data, isLoading, error } = useDividendRadarProjections(ticker)

  const projections = data?.projections || []
  const historicalDividends = data?.historicalDividends || []
  const hasData = projections.length > 0 || historicalDividends.length > 0
  const tickerPath = ticker.toLowerCase()

  const header = (
    <SectionHeader
      title="Dividendos"
      description={`Proventos pagos e projetados de ${companyName}.`}
      actions={
        hasData ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/radar-dividendos/${tickerPath}`}>Ver radar completo</Link>
          </Button>
        ) : undefined
      }
    />
  )

  const calculatorLink =
    typeof dividendYield === 'number' && dividendYield > 0 ? (
      <p className="text-sm text-muted-foreground">
        Dividend yield atual de <span className="font-medium tabular-nums text-foreground">{formatPct(dividendYield)}</span>.{' '}
        <Link
          href={`/calculadoras/dividend-yield?ticker=${ticker.toUpperCase()}`}
          prefetch={false}
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          Calcule sua renda passiva
        </Link>
      </p>
    ) : null

  if (isLoading) {
    return (
      <div className="space-y-4">
        {header}
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    )
  }

  if (error || !hasData) {
    return (
      <div className="space-y-4">
        {header}
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Sem proventos nos últimos meses nem pagamentos projetados para {ticker.toUpperCase()}.
        </p>
        {calculatorLink}
      </div>
    )
  }

  const projectionMap = new Map<string, typeof projections>()
  projections.forEach((p) => {
    const key = monthKey(p.year, p.month)
    projectionMap.set(key, [...(projectionMap.get(key) ?? []), p])
  })
  const historicalMap = new Map<string, typeof historicalDividends>()
  historicalDividends.forEach((h) => {
    const key = monthKey(h.year, h.month)
    historicalMap.set(key, [...(historicalMap.get(key) ?? []), h])
  })

  return (
    <div className="space-y-4">
      {header}
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <Legend />
        <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
          {monthWindow(new Date()).map(({ month, year, isCurrent }) => {
            const key = monthKey(year, month)
            const paid = historicalMap.get(key)?.[0]
            const projected = projectionMap.get(key)?.[0]
            const monthLabel = `${MONTHS[month - 1]} ${String(year).slice(2)}`
            const description = paid
              ? `pago ${formatBRL(paid.amount)} por ação, data com ${formatDate(paid.exDate)}`
              : projected
                ? `projetado ${formatBRL(projected.projectedAmount)} por ação (estimativa)`
                : 'sem pagamento'

            return (
              <li
                key={key}
                aria-label={`${MONTHS[month - 1]} de ${year}: ${description}`}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-md border px-1 py-2 text-center',
                  isCurrent ? 'border-brand' : 'border-border'
                )}
              >
                <span className={cn('text-xs', isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                  {monthLabel}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-3 rounded-full',
                    paid ? 'bg-brand' : projected ? 'border-2 border-brand' : 'bg-muted'
                  )}
                />
                <span className="text-xs tabular-nums text-foreground">
                  {paid ? formatBRL(paid.amount) : projected ? formatBRL(projected.projectedAmount) : '—'}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="text-xs text-muted-foreground">
          Valores por ação. Projeções são estimativas baseadas no histórico de pagamentos.
        </p>
      </div>
      {calculatorLink}
    </div>
  )
}
