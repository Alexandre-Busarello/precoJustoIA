'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { formatBRL } from '@/lib/format'

interface SupportResistanceLevel {
  price: number
  strength: number
  type: 'support' | 'resistance' | 'psychological'
  touches: number
}

interface HistoricalPrice {
  date: string
  close: number
  high: number
  low: number
}

interface SupportResistanceChartProps {
  historicalData: HistoricalPrice[]
  supportLevels: SupportResistanceLevel[]
  resistanceLevels: SupportResistanceLevel[]
  currentPrice: number
}

/** Estilo comum dos gráficos: grade só horizontal, eixos xs em muted, tooltip em superfície de popover. */
const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' } as const
const TOOLTIP_PROPS = {
  contentStyle: {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--popover-foreground)',
    fontSize: 12,
  },
  labelStyle: { color: 'var(--muted-foreground)', marginBottom: 4 },
  itemStyle: { color: 'var(--popover-foreground)', padding: 0 },
  cursor: { stroke: 'var(--border)' },
  separator: ': ',
} as const

const SUPPORT_DASH = '6 4'
const RESISTANCE_DASH = '2 3'

const monthFormat = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })

function strongest(levels: SupportResistanceLevel[]): SupportResistanceLevel | null {
  return [...levels].sort((a, b) => b.strength - a.strength)[0] ?? null
}

function LegendItem({ label, dash, color }: { label: string; dash?: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="18" height="4" aria-hidden="true">
        <line x1="0" y1="2" x2="18" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dash} />
      </svg>
      {label}
    </span>
  )
}

/** Preço mensal com o suporte e a resistência mais fortes (linhas tracejadas neutras). */
export default function SupportResistanceChart({
  historicalData,
  supportLevels,
  resistanceLevels,
  currentPrice,
}: SupportResistanceChartProps) {
  // Um ponto por mês (o mais recente de cada mês)
  const chartData = useMemo(() => {
    const monthly = new Map<string, { time: number; close: number; high: number; low: number }>()
    for (const d of historicalData) {
      const date = new Date(d.date)
      const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`
      const existing = monthly.get(key)
      if (!existing || date.getTime() > existing.time) {
        monthly.set(key, { time: date.getTime(), close: Number(d.close), high: Number(d.high), low: Number(d.low) })
      }
    }
    return Array.from(monthly.values())
      .sort((a, b) => a.time - b.time)
      .map((item) => ({ ...item, label: monthFormat.format(new Date(item.time)) }))
  }, [historicalData])

  const support = useMemo(() => strongest(supportLevels), [supportLevels])
  const resistance = useMemo(() => strongest(resistanceLevels), [resistanceLevels])

  const levels = [support?.price, resistance?.price, currentPrice].filter((v): v is number => typeof v === 'number')
  const minPrice = Math.min(...chartData.map((d) => d.low), ...levels) * 0.95
  const maxPrice = Math.max(...chartData.map((d) => d.high), ...levels) * 1.05
  const tickDigits = maxPrice < 20 ? 2 : 0

  return (
    <figure className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <figcaption className="mb-3 text-sm font-medium text-foreground">Preço mensal com suporte e resistência</figcaption>
      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis
              domain={[minPrice, maxPrice]}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(value: number) => formatBRL(value, { digits: tickDigits })}
            />
            <Tooltip
              {...TOOLTIP_PROPS}
              formatter={(value) => [formatBRL(typeof value === 'number' ? value : Number(value)), 'Fechamento']}
            />
            <Line type="monotone" dataKey="close" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Fechamento" />
            {support && (
              <ReferenceLine y={support.price} stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray={SUPPORT_DASH} />
            )}
            {resistance && (
              <ReferenceLine y={resistance.price} stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray={RESISTANCE_DASH} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        <LegendItem label="Fechamento mensal" color="var(--chart-1)" />
        {support && (
          <LegendItem
            label={`Suporte mais forte: ${formatBRL(support.price)} (força ${support.strength}/5)`}
            color="var(--muted-foreground)"
            dash={SUPPORT_DASH}
          />
        )}
        {resistance && (
          <LegendItem
            label={`Resistência mais forte: ${formatBRL(resistance.price)} (força ${resistance.strength}/5)`}
            color="var(--muted-foreground)"
            dash={RESISTANCE_DASH}
          />
        )}
      </div>
    </figure>
  )
}
