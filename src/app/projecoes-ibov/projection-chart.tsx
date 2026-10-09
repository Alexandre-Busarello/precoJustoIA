'use client'

/**
 * Cone das faixas: fechamentos dos últimos 12 meses (linha sólida) e, a partir do último fechamento, a faixa ampla
 * (p5–p95), a faixa provável (p16–p84) e a mediana tracejada para até 252 pregões à frente.
 */

import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate, formatNumber } from '@/lib/format'
import type { ConePoint, DailyClose } from '@/lib/ibov-projections/engine'

interface ChartRow {
  x: number
  date: string
  close?: number
  wide?: [number, number]
  probable?: [number, number]
  median?: number
}

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' } as const
const monthFormat = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })

/** Data (YYYY-MM-DD) `offset` dias úteis depois de `from`. Aproximação: não considera feriados. */
function addWeekdays(from: string, offset: number): string {
  const d = new Date(`${from}T12:00:00Z`)
  let left = offset
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) left--
  }
  return d.toISOString().slice(0, 10)
}

function monthLabel(date: string): string {
  return monthFormat.format(new Date(`${date}T12:00:00Z`)).replace('.', '').replace(' de ', ' ')
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: ChartRow }> }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="text-muted-foreground">{row.x > 0 ? `Por volta de ${formatDate(`${row.date}T12:00:00Z`)}` : formatDate(`${row.date}T12:00:00Z`)}</p>
      {row.close !== undefined && <p className="font-medium tabular-nums">Fechamento: {formatNumber(row.close, { digits: 0 })} pts</p>}
      {row.x > 0 && row.probable && row.wide && (
        <dl className="mt-1 space-y-0.5 tabular-nums">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Faixa provável</dt>
            <dd>
              {formatNumber(row.probable[0], { digits: 0 })} a {formatNumber(row.probable[1], { digits: 0 })}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Faixa ampla</dt>
            <dd>
              {formatNumber(row.wide[0], { digits: 0 })} a {formatNumber(row.wide[1], { digits: 0 })}
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}

export default function ProjectionChart({ history, cone }: { history: DailyClose[]; cone: ConePoint[] }) {
  const rows = useMemo((): ChartRow[] => {
    if (history.length === 0) return []
    const last = history[history.length - 1]
    const past: ChartRow[] = history.map((point, index) => ({ x: index - (history.length - 1), date: point.date, close: point.close }))
    past[past.length - 1] = {
      ...past[past.length - 1],
      wide: [last.close, last.close],
      probable: [last.close, last.close],
      median: last.close,
    }
    const future: ChartRow[] = cone.map((point) => ({
      x: point.offset,
      date: addWeekdays(last.date, point.offset),
      wide: [point.levels.p5, point.levels.p95],
      probable: [point.levels.p16, point.levels.p84],
      median: point.levels.p50,
    }))
    return [...past, ...future]
  }, [history, cone])

  const ticks = useMemo(() => {
    if (rows.length === 0) return []
    const first = rows[0].x
    const lastX = rows[rows.length - 1].x
    const step = 63
    const out: number[] = []
    for (let x = 0; x >= first; x -= step) out.unshift(x)
    for (let x = step; x <= lastX; x += step) out.push(x)
    return out
  }, [rows])

  const dateByX = useMemo(() => {
    const map = new Map<number, string>()
    for (const row of rows) map.set(row.x, row.date)
    const last = rows.find((r) => r.x === 0)?.date
    if (last) for (const tick of ticks) if (!map.has(tick)) map.set(tick, addWeekdays(last, tick))
    return map
  }, [rows, ticks])

  if (rows.length === 0) return null

  return (
    <figure className="space-y-2">
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="x"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={ticks}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              tickFormatter={(x: number) => {
                const date = dateByX.get(x)
                return date ? monthLabel(date) : ''
              }}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={68}
              domain={['auto', 'auto']}
              tickFormatter={(value: number) => `${formatNumber(value / 1000, { digits: 0 })} mil`}
            />
            <Tooltip cursor={{ stroke: 'var(--border)' }} content={<ChartTooltip />} />
            <ReferenceLine x={0} stroke="var(--border)" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="wide"
              stroke="none"
              fill="var(--chart-1)"
              fillOpacity={0.08}
              isAnimationActive={false}
              connectNulls={false}
              activeDot={false}
            />
            <Area
              type="monotone"
              dataKey="probable"
              stroke="none"
              fill="var(--chart-1)"
              fillOpacity={0.18}
              isAnimationActive={false}
              connectNulls={false}
              activeDot={false}
            />
            <Line
              type="monotone"
              dataKey="median"
              stroke="var(--chart-1)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="close"
              stroke="var(--foreground)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: 'var(--foreground)', strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line x1="0" x2="16" y1="4" y2="4" stroke="var(--foreground)" strokeWidth="2" />
          </svg>
          Fechamentos
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="10" aria-hidden="true">
            <rect width="12" height="10" rx="2" fill="var(--chart-1)" fillOpacity="0.3" />
          </svg>
          Faixa provável (68%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="10" aria-hidden="true">
            <rect width="12" height="10" rx="2" fill="var(--chart-1)" fillOpacity="0.12" />
          </svg>
          Faixa ampla (90%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line x1="0" x2="16" y1="4" y2="4" stroke="var(--chart-1)" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          Mediana histórica (estimativa)
        </span>
      </figcaption>
    </figure>
  )
}
