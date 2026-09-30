'use client'

import * as React from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { IndicatorItem } from '@/components/asset/indicator-grid'

export interface IndicatorHistoryDrawerProps {
  item: IndicatorItem | null
  ticker: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Formata um valor do indicador (tabela, tooltip e resumo). */
  formatValue: (value: number | null) => string
  /** Formata os rótulos do eixo Y. */
  formatTick: (value: number) => string
  /** Diferença atual vs. média já formatada, com a cor semântica. */
  delta?: { text: string; tone: 'positive' | 'negative' | 'neutral' } | null
}

const TONE_CLASS = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-foreground',
} as const

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' } as const

function LegendItem({ label, dashed, color }: { label: string; dashed?: boolean; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="16" height="4" aria-hidden="true">
        <line x1="0" y1="2" x2="16" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '3 2' : undefined} />
      </svg>
      {label}
    </span>
  )
}

function SummaryItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd data-num className={cn('mt-0.5 truncate text-base font-semibold tabular-nums text-foreground', className)}>
        {value}
      </dd>
    </div>
  )
}

/**
 * Histórico anual de um indicador: painel inferior no mobile e lateral no desktop (Esc fecha).
 * Linha da série em chart-1 e média de 7 anos tracejada em chart-2.
 */
export function IndicatorHistoryDrawer({
  item,
  ticker,
  open,
  onOpenChange,
  formatValue,
  formatTick,
  delta,
}: IndicatorHistoryDrawerProps) {
  const isMobile = useIsMobile()
  const data = React.useMemo(
    () => (item?.history ?? []).map((point) => ({ year: String(point.year), value: point.value })),
    [item]
  )
  const hasChart = data.length >= 2
  const firstYear = item?.history[0]?.year
  const lastYear = item?.history[item.history.length - 1]?.year

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn('gap-0 overflow-y-auto', !isMobile && 'w-full sm:max-w-md')}
      >
        {item && (
          <>
            <SheetHeader className="pr-14">
              <SheetTitle className="text-lg tracking-tight">{item.label}</SheetTitle>
              <SheetDescription>
                {ticker} · histórico anual
                {firstYear && lastYear && firstYear !== lastYear ? ` de ${firstYear} a ${lastYear}` : ''}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              <dl className="grid grid-cols-3 gap-3 border-y border-border py-3">
                <SummaryItem label="Atual" value={formatValue(item.value)} />
                <SummaryItem label="Média 7a" value={formatValue(item.average)} />
                <SummaryItem
                  label="Diferença"
                  value={delta?.text ?? '—'}
                  className={delta ? TONE_CLASS[delta.tone] : undefined}
                />
              </dl>

              {hasChart ? (
                <figure className="space-y-2">
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="year" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis
                          tick={AXIS_TICK}
                          tickLine={false}
                          axisLine={false}
                          width={64}
                          tickFormatter={(value: number) => formatTick(value)}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          cursor={{ stroke: 'var(--border)' }}
                          content={({ active, payload, label }) => {
                            const point = payload?.[0]?.payload as { year: string; value: number } | undefined
                            if (!active || !point) return null
                            return (
                              <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                                <p className="text-muted-foreground">{String(label ?? point.year)}</p>
                                <p className="font-medium tabular-nums">{formatValue(point.value)}</p>
                              </div>
                            )
                          }}
                        />
                        {item.average !== null && (
                          <ReferenceLine y={item.average} stroke="var(--chart-2)" strokeWidth={1.5} strokeDasharray="4 3" />
                        )}
                        <Line
                          type="linear"
                          dataKey="value"
                          stroke="var(--chart-1)"
                          strokeWidth={2}
                          dot={{ r: 3, fill: 'var(--chart-1)', strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <LegendItem label="Valor anual" color="var(--chart-1)" />
                    {item.average !== null && <LegendItem label="Média 7a" color="var(--chart-2)" dashed />}
                  </figcaption>
                </figure>
              ) : (
                <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
                  Ainda não há anos suficientes de {item.label} para montar o gráfico.
                </p>
              )}

              <div className="space-y-2 text-sm leading-6">
                <p className="text-foreground">{item.description}</p>
                {item.reference && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Referência usual:</span> {item.reference}. Compare
                    sempre com empresas do mesmo setor.
                  </p>
                )}
              </div>

              {item.history.length > 0 && (
                <table className="w-full text-sm">
                  <caption className="sr-only">Valores anuais de {item.label}</caption>
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th scope="col" className="py-2 text-left font-medium">
                        Ano
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        {item.label}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...item.history].reverse().map((point) => (
                      <tr key={point.year} className="border-b border-border last:border-0">
                        <td className="py-2 text-muted-foreground tabular-nums">{point.year}</td>
                        <td className="py-2 text-right tabular-nums text-foreground">{formatValue(point.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
