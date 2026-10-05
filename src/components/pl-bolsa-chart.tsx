'use client'

/**
 * Gráfico do P/L agregado da bolsa: linha única (chart-1, 1,5 px) com área de 6%
 * e a média histórica do período como linha cinza tracejada.
 */

import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMultiple, formatNumber } from '@/lib/format'

export interface PLBolsaChartData {
  date: string
  pl: number
  averagePl: number
  companyCount: number
}

interface PLBolsaChartProps {
  data: PLBolsaChartData[]
  averagePL?: number
  loading?: boolean
}

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' } as const
const MONTHS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** `YYYY-MM-DD` → "mar. 2024" (eixo) ou "março de 2024" (tooltip). */
export function formatMonth(date: string, long = false): string {
  const [year, month] = date.split('-').map(Number)
  return long ? `${MONTHS_LONG[month - 1]} de ${year}` : `${MONTHS[month - 1]} ${year}`
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload?: PLBolsaChartData }>
  averagePL?: number
}

function PLTooltip({ active, payload, averagePL }: TooltipProps) {
  const item = payload?.[0]?.payload
  if (!active || !item) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 text-muted-foreground">{formatMonth(item.date, true)}</p>
      <p className="flex justify-between gap-4">
        <span>P/L</span>
        <span className="font-medium tabular-nums">{formatMultiple(item.pl)}</span>
      </p>
      {averagePL !== undefined && (
        <p className="flex justify-between gap-4">
          <span className="text-muted-foreground">Média do período</span>
          <span className="tabular-nums">{formatMultiple(averagePL)}</span>
        </p>
      )}
      <p className="flex justify-between gap-4">
        <span className="text-muted-foreground">Empresas</span>
        <span className="tabular-nums">{formatNumber(item.companyCount, { digits: 0 })}</span>
      </p>
    </div>
  )
}

export function PLBolsaChart({ data, averagePL, loading }: PLBolsaChartProps) {
  const yDomain = useMemo((): [number, number] => {
    const values = data.map((item) => item.pl).filter((v) => Number.isFinite(v))
    if (values.length === 0) return [0, 20]
    const min = Math.min(...values, averagePL ?? Infinity)
    const max = Math.max(...values, averagePL ?? -Infinity)
    return [Math.max(0, Math.floor(min * 0.9)), Math.ceil(max * 1.05)]
  }, [data, averagePL])

  if (loading) return <Skeleton className="h-72 w-full sm:h-96" />

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg bg-surface px-4 text-center text-sm text-muted-foreground sm:h-96">
        Nenhum dado disponível para o período e os filtros selecionados.
      </div>
    )
  }

  return (
    <figure className="space-y-2">
      <div className="h-72 sm:h-96">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
              tickFormatter={(value: string) => formatMonth(value)}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={yDomain}
              allowDecimals={false}
              tickFormatter={(value: number) => formatMultiple(value, { digits: 0 })}
            />
            <Tooltip cursor={{ stroke: 'var(--border)' }} content={<PLTooltip averagePL={averagePL} />} />
            {averagePL !== undefined && (
              <ReferenceLine y={averagePL} stroke="var(--chart-2)" strokeWidth={1.5} strokeDasharray="4 3" />
            )}
            <Area
              type="monotone"
              dataKey="pl"
              stroke="var(--chart-1)"
              strokeWidth={1.5}
              fill="var(--chart-1)"
              fillOpacity={0.06}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--chart-1)', strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line x1="0" x2="16" y1="4" y2="4" stroke="var(--chart-1)" strokeWidth="2" />
          </svg>
          P/L agregado (média ponderada por valor de mercado)
        </span>
        {averagePL !== undefined && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="16" height="8" aria-hidden="true">
              <line x1="0" x2="16" y1="4" y2="4" stroke="var(--chart-2)" strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            Média do período
          </span>
        )}
      </figcaption>
    </figure>
  )
}
