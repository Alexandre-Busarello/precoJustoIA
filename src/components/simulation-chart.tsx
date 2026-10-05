'use client'

/**
 * Comparação mês a mês das estratégias Sniper (chart-1) e Híbrida (chart-3).
 * Patrimônio investido em linha cheia, saldo devedor tracejado; break-even em cinza.
 */

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBRL, formatCompact, formatNumber } from '@/lib/format'
import { SectionHeader } from '@/components/ui/section-header'

interface MonthlyDataPoint {
  month: number
  debtBalance: number
  investedBalance: number
  netWorth: number
}

interface SimulationChartProps {
  sniperData: MonthlyDataPoint[]
  hybridData: MonthlyDataPoint[]
  sniperBreakEven?: number | null
  hybridBreakEven?: number | null
}

type SeriesKey = 'sniperInvested' | 'sniperDebt' | 'hybridInvested' | 'hybridDebt'

const SERIES: Array<{ key: SeriesKey; label: string; color: string; dashed: boolean }> = [
  { key: 'sniperInvested', label: 'Sniper, investido', color: 'var(--chart-1)', dashed: false },
  { key: 'sniperDebt', label: 'Sniper, saldo devedor', color: 'var(--chart-1)', dashed: true },
  { key: 'hybridInvested', label: 'Híbrido, investido', color: 'var(--chart-3)', dashed: false },
  { key: 'hybridDebt', label: 'Híbrido, saldo devedor', color: 'var(--chart-3)', dashed: true },
]

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' } as const

/** Eixo Y curto, em reais: "250 mil", "1,2 mi". */
function formatAxis(value: number): string {
  if (Math.abs(value) >= 1e6) return formatCompact(value)
  if (Math.abs(value) >= 1e3) return `${formatNumber(value / 1e3, { digits: 0 })} mil`
  return formatNumber(value, { digits: 0 })
}

type ChartRow = { month: number } & Partial<Record<SeriesKey, number>>

function SimulationTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string; value?: number }>
  label?: number
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 text-muted-foreground">Mês {label}</p>
      {SERIES.map((series) => {
        const entry = payload.find((p) => p.dataKey === series.key)
        if (!entry || typeof entry.value !== 'number') return null
        return (
          <p key={series.key} className="flex justify-between gap-4">
            <span>{series.label}</span>
            <span className="font-medium tabular-nums">{formatBRL(entry.value, { digits: 0 })}</span>
          </p>
        )
      })}
    </div>
  )
}

function LegendSwatch({ color, dashed }: { color: string; dashed: boolean }) {
  return (
    <svg width="16" height="8" aria-hidden="true">
      <line x1="0" x2="16" y1="4" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} />
    </svg>
  )
}

export function SimulationChart({ sniperData, hybridData, sniperBreakEven, hybridBreakEven }: SimulationChartProps) {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set())

  const chartData = useMemo(() => {
    const rows = new Map<number, ChartRow>()
    const put = (month: number, patch: Partial<ChartRow>) => rows.set(month, { ...(rows.get(month) ?? { month }), ...patch })
    sniperData.forEach((p) => put(p.month, { sniperDebt: p.debtBalance, sniperInvested: p.investedBalance }))
    hybridData.forEach((p) => put(p.month, { hybridDebt: p.debtBalance, hybridInvested: p.investedBalance }))
    return Array.from(rows.values()).sort((a, b) => a.month - b.month)
  }, [sniperData, hybridData])

  const toggle = (key: SeriesKey) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <SectionHeader
        title="Comparação das estratégias"
        description="Break-even é o mês em que o patrimônio investido supera o saldo devedor."
      />

      <div role="group" aria-label="Séries do gráfico" className="flex flex-wrap gap-2">
        {SERIES.map((series) => (
          <button
            key={series.key}
            type="button"
            aria-pressed={!hidden.has(series.key)}
            onClick={() => toggle(series.key)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground aria-pressed:text-foreground aria-[pressed=false]:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-8"
          >
            <LegendSwatch color={series.color} dashed={series.dashed} />
            {series.label}
          </button>
        ))}
      </div>

      <div className="h-72 w-full sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tickFormatter={(value: number) => `${value}`}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={formatAxis}
            />
            <Tooltip cursor={{ stroke: 'var(--border)' }} content={<SimulationTooltip />} />
            {sniperBreakEven ? (
              <ReferenceLine
                x={sniperBreakEven}
                stroke="var(--chart-2)"
                strokeDasharray="4 3"
                label={{ value: 'Break-even Sniper', position: 'insideTopRight', fontSize: 11, fill: 'var(--muted-foreground)' }}
              />
            ) : null}
            {hybridBreakEven ? (
              <ReferenceLine
                x={hybridBreakEven}
                stroke="var(--chart-2)"
                strokeDasharray="4 3"
                label={{ value: 'Break-even Híbrido', position: 'insideTopLeft', fontSize: 11, fill: 'var(--muted-foreground)' }}
              />
            ) : null}
            {SERIES.map((series) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={series.dashed ? 1.5 : 2}
                strokeDasharray={series.dashed ? '5 4' : undefined}
                hide={hidden.has(series.key)}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        Valores em reais; eixo horizontal em meses.
        {sniperBreakEven ? ` Break-even Sniper no mês ${sniperBreakEven}.` : ''}
        {hybridBreakEven ? ` Break-even Híbrido no mês ${hybridBreakEven}.` : ''}
      </p>
    </section>
  )
}
