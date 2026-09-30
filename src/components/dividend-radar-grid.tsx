'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChartLine } from 'lucide-react'
import { CompanyLogo } from '@/components/company-logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatBRL, formatPct } from '@/lib/format'
import type { DividendProjection } from '@/lib/dividend-radar-service'
import {
  buildDividendMonths,
  DEFAULT_MONTH_WINDOW,
  formatDateOnly,
  monthDotState,
  monthLabel,
  monthShort,
  monthTotal,
  perShareDigits,
  type ConfirmedDividendInput,
  type DividendEvent,
  type DividendMonth,
} from '@/app/radar-dividendos/dividend-months'

export interface DividendGridCompany {
  ticker: string
  name: string
  sector: string | null
  logoUrl: string | null
  projections: DividendProjection[]
  historicalDividends?: ConfirmedDividendInput[]
}

interface DividendRadarGridProps {
  companies: DividendGridCompany[]
  loading?: boolean
  /** Mostra links para a página do ativo no radar e para a análise (desligue na própria página do ativo). */
  showCompanyLinks?: boolean
  /** Meses à frente no calendário (padrão: 7, completando 12 meses com os 4 passados e o atual). */
  monthsAhead?: number
  className?: string
}

type DotState = ReturnType<typeof monthDotState>

/** Confirmado = ponto sólido da marca; projetado = ponto vazado da marca; sem provento = marcador mínimo. */
function MonthDot({ state, size = 'md' }: { state: DotState; size?: 'sm' | 'md' }) {
  const dimension = size === 'md' ? 'size-3' : 'size-2.5'
  if (state === 'confirmed') return <span aria-hidden="true" className={cn('inline-block shrink-0 rounded-full bg-brand', dimension)} />
  if (state === 'projected')
    return <span aria-hidden="true" className={cn('inline-block shrink-0 rounded-full border-2 border-brand', dimension)} />
  return <span aria-hidden="true" className="inline-block size-1 shrink-0 rounded-full bg-border" />
}

function formatPerShare(amount: number | null): string {
  return amount === null ? '—' : formatBRL(amount, { digits: perShareDigits(amount) })
}

function describeMonth(ticker: string, month: DividendMonth): string {
  const state = monthDotState(month)
  const status = state === 'confirmed' ? 'confirmado' : state === 'projected' ? 'projetado' : 'sem proventos'
  const total = monthTotal(month)
  return `${ticker}, ${monthLabel(month.month, month.year)}: ${status}${total !== null ? `, ${formatPerShare(total)} por ação` : ''}`
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm tabular-nums text-foreground">{value}</dd>
    </div>
  )
}

function EventDetails({ event }: { event: DividendEvent }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={event.kind === 'confirmed' ? 'brand' : 'neutral'}>
          {event.kind === 'confirmed' ? 'Confirmado' : 'Projetado'}
        </Badge>
        {event.confidence !== null && (
          <span className="text-xs text-muted-foreground">Confiança {formatPct(event.confidence / 100, { digits: 0 })}</span>
        )}
      </div>
      <dl className="divide-y divide-border">
        <DetailRow label={event.kind === 'projected' ? 'Data ex estimada' : 'Data ex'} value={formatDateOnly(event.exDate)} />
        <DetailRow label="Pagamento" value={event.paymentDate ? formatDateOnly(event.paymentDate) : 'Não informado'} />
        <DetailRow label={event.kind === 'projected' ? 'Valor estimado por ação' : 'Valor por ação'} value={formatPerShare(event.amount)} />
        <DetailRow label="Tipo" value={event.type ?? 'Não informado'} />
      </dl>
    </div>
  )
}

function DetailsFootnote({ hasProjection }: { hasProjection: boolean }) {
  return (
    <p className="text-xs leading-5 text-muted-foreground">
      Tem direito ao provento quem tem a ação no fim do pregão anterior à data ex (a data-com).
      {hasProjection && ' Projeções são estimativas geradas por IA a partir do histórico e podem não se confirmar.'}
    </p>
  )
}

function MonthDetails({ month }: { month: DividendMonth }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{monthLabel(month.month, month.year)}</p>
      {month.events.map((event, index) => (
        <EventDetails key={`${event.kind}-${event.exDate}-${index}`} event={event} />
      ))}
      <DetailsFootnote hasProjection={month.events.some((e) => e.kind === 'projected')} />
    </div>
  )
}

interface CompanyRow {
  company: DividendGridCompany
  months: DividendMonth[]
}

export function DividendRadarLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground', className)}>
      <span className="inline-flex items-center gap-1.5">
        <MonthDot state="confirmed" size="sm" />
        Confirmado
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MonthDot state="projected" size="sm" />
        Projetado (estimativa)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block h-3 w-4 rounded-sm border border-border bg-surface" />
        Mês atual
      </span>
      <span className="md:hidden">Toque em uma empresa para ver datas e valores.</span>
      <span className="hidden md:inline">Clique em um mês para ver datas e valores.</span>
    </div>
  )
}

/** Grupos de meses consecutivos do mesmo ano, para o marcador de ano do cabeçalho mobile. */
function yearGroups(months: DividendMonth[]): Array<{ year: number; span: number }> {
  const groups: Array<{ year: number; span: number }> = []
  for (const month of months) {
    const last = groups[groups.length - 1]
    if (last && last.year === month.year) last.span++
    else groups.push({ year: month.year, span: 1 })
  }
  return groups
}

/**
 * Calendário de proventos: 4 meses passados, o mês atual e até 7 meses à frente (12 meses).
 * Desktop: tabela com um popover por mês. Mobile: uma linha compacta de pontos por empresa; o toque abre um sheet com os detalhes.
 */
export function DividendRadarGrid({
  companies,
  loading,
  showCompanyLinks = true,
  monthsAhead = DEFAULT_MONTH_WINDOW.future,
  className,
}: DividendRadarGridProps) {
  const [selected, setSelected] = useState<CompanyRow | null>(null)

  const rows = useMemo<CompanyRow[]>(() => {
    const now = new Date()
    return companies.map((company) => ({
      company,
      months: buildDividendMonths(company.historicalDividends, company.projections, now, { future: monthsAhead }),
    }))
  }, [companies, monthsAhead])

  if (loading) {
    return (
      <div className={cn('space-y-2', className)} aria-busy="true">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={cn('rounded-lg border border-dashed border-border px-4 py-10 text-center', className)}>
        <p className="text-sm text-muted-foreground">Nenhuma empresa com proventos confirmados ou projetados.</p>
      </div>
    )
  }

  const monthWindow = rows[0].months
  const mobileColumns = { gridTemplateColumns: `5.5rem repeat(${monthWindow.length}, minmax(0, 1fr))` }

  return (
    <div className={cn('space-y-3', className)}>
      <DividendRadarLegend />

      {/* Desktop: tabela com popover por mês */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-background md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Proventos confirmados e projetados por mês</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="sticky left-0 z-10 bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Empresa
              </th>
              {monthWindow.map((month, index) => (
                <th
                  key={month.key}
                  scope="col"
                  aria-current={month.isCurrent ? 'date' : undefined}
                  className={cn(
                    'px-1 py-2 text-center text-xs font-medium whitespace-nowrap',
                    month.isCurrent ? 'bg-surface text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {monthShort(month.month)}
                  {(index === 0 || month.month === 1) && (
                    <span className="ml-0.5 font-normal text-muted-foreground">{String(month.year).slice(2)}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ company, months }) => (
              <tr key={company.ticker} className="border-b border-border last:border-0">
                <th scope="row" className="sticky left-0 z-10 bg-background px-3 py-1.5 text-left font-normal">
                  <div className="flex items-center gap-2.5">
                    <CompanyLogo logoUrl={company.logoUrl} companyName={company.name} ticker={company.ticker} size={32} />
                    <div className="min-w-0">
                      {showCompanyLinks ? (
                        <Link
                          href={`/radar-dividendos/${company.ticker.toLowerCase()}`}
                          className="text-sm font-medium text-foreground hover:text-brand hover:underline underline-offset-4"
                        >
                          {company.ticker}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-foreground">{company.ticker}</span>
                      )}
                      <p className="max-w-[12rem] truncate text-xs text-muted-foreground">{company.name}</p>
                    </div>
                    {showCompanyLinks && (
                      <Link
                        href={`/acao/${company.ticker.toLowerCase()}`}
                        aria-label={`Ver análise completa de ${company.ticker}`}
                        title="Ver análise completa"
                        className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <ChartLine className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </th>
                {months.map((month) => {
                  const state = monthDotState(month)
                  return (
                    <td key={month.key} className={cn('p-0 text-center', month.isCurrent && 'bg-surface')}>
                      {state === 'none' ? (
                        <span className="flex h-14 items-center justify-center">
                          <MonthDot state="none" />
                          <span className="sr-only">{describeMonth(company.ticker, month)}</span>
                        </span>
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              aria-label={describeMonth(company.ticker, month)}
                              className="flex h-14 w-full min-w-16 flex-col items-center justify-center gap-1 rounded-md transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                            >
                              <MonthDot state={state} />
                              <span className="text-xs tabular-nums text-muted-foreground">{formatPerShare(monthTotal(month))}</span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent side="top" className="w-72">
                            <p className="mb-2 text-xs text-muted-foreground">
                              {company.ticker} · {company.name}
                            </p>
                            <MonthDetails month={month} />
                          </PopoverContent>
                        </Popover>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: uma linha de pontos por empresa */}
      <div className="overflow-hidden rounded-lg border border-border bg-background md:hidden">
        <div aria-hidden="true" className="border-b border-border text-center text-xs text-muted-foreground">
          <div className="grid" style={mobileColumns}>
            <span className="row-span-2 self-end px-3 py-1.5 text-left">Empresa</span>
            {yearGroups(monthWindow).map((group, index) => (
              <span
                key={group.year}
                style={{ gridColumn: `span ${group.span}` }}
                className={cn('truncate pt-1.5 tabular-nums', index > 0 && 'border-l border-border')}
              >
                {group.span >= 2 ? group.year : String(group.year).slice(2)}
              </span>
            ))}
            {monthWindow.map((month, index) => (
              <span
                key={month.key}
                className={cn(
                  'py-1 uppercase',
                  month.isCurrent && 'bg-surface font-medium text-foreground',
                  index > 0 && month.month === 1 && 'border-l border-border'
                )}
              >
                {monthShort(month.month).charAt(0)}
              </span>
            ))}
          </div>
        </div>
        <ul>
          {rows.map((row) => (
            <li key={row.company.ticker} className="border-b border-border last:border-0">
              <button
                type="button"
                onClick={() => setSelected(row)}
                aria-label={`Ver proventos de ${row.company.ticker}`}
                style={mobileColumns}
                className="grid min-h-14 w-full items-stretch text-left transition-colors active:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="flex min-w-0 flex-col justify-center px-3 py-2">
                  <span className="text-sm font-medium text-foreground">{row.company.ticker}</span>
                  <span className="truncate text-xs text-muted-foreground">{row.company.name}</span>
                </span>
                {row.months.map((month, index) => (
                  <span
                    key={month.key}
                    className={cn(
                      'flex items-center justify-center',
                      month.isCurrent && 'bg-surface',
                      index > 0 && month.month === 1 && 'border-l border-border'
                    )}
                  >
                    <MonthDot state={monthDotState(month)} size="sm" />
                  </span>
                ))}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="bottom" className="gap-0">
          {selected && (
            <>
              <SheetHeader className="pr-14">
                <SheetTitle>Proventos de {selected.company.ticker}</SheetTitle>
                <SheetDescription>{selected.company.name}</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
                {selected.months.filter((m) => m.events.length > 0).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem proventos no período exibido.</p>
                ) : (
                  selected.months
                    .filter((m) => m.events.length > 0)
                    .map((month) => (
                      <section key={month.key} className="space-y-2">
                        <h3 className={cn('text-sm font-medium text-foreground', month.isCurrent && 'text-brand')}>
                          {monthLabel(month.month, month.year)}
                          {month.isCurrent && <span className="font-normal text-muted-foreground"> · mês atual</span>}
                        </h3>
                        {month.events.map((event, index) => (
                          <div key={`${event.kind}-${event.exDate}-${index}`} className="rounded-lg border border-border p-3">
                            <EventDetails event={event} />
                          </div>
                        ))}
                      </section>
                    ))
                )}
                <DetailsFootnote hasProjection={selected.months.some((m) => m.events.some((e) => e.kind === 'projected'))} />
                {showCompanyLinks && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline">
                      <Link href={`/radar-dividendos/${selected.company.ticker.toLowerCase()}`}>Histórico completo</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/acao/${selected.company.ticker.toLowerCase()}`}>Ver análise</Link>
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
