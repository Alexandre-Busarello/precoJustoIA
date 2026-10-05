'use client'

/**
 * Trajetória estimada do Ibovespa: valor atual (ponto sólido) e as estimativas por horizonte, em linha tracejada.
 */

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDeltaPct, formatNumber } from '@/lib/format'

export interface ProjectionPoint {
  label: string
  value: number
  /** `true` para o valor atual; os demais são estimativas. */
  current?: boolean
}

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' } as const

function ProjectionTooltip({
  active,
  payload,
  base,
}: {
  active?: boolean
  payload?: Array<{ payload?: ProjectionPoint }>
  base: number
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="text-muted-foreground">{point.current ? 'Valor atual' : `Estimativa: ${point.label.toLowerCase()}`}</p>
      <p className="font-medium tabular-nums">{formatNumber(point.value, { digits: 0 })} pts</p>
      {!point.current && base > 0 && (
        <p className="text-muted-foreground tabular-nums">{formatDeltaPct(point.value / base - 1)} vs. atual</p>
      )}
    </div>
  )
}

export default function ProjectionChart({ points }: { points: ProjectionPoint[] }) {
  const base = points.find((p) => p.current)?.value ?? 0

  return (
    <figure className="space-y-2">
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={64}
              domain={['auto', 'auto']}
              tickFormatter={(value: number) => formatNumber(value, { digits: 0 })}
            />
            <Tooltip cursor={{ stroke: 'var(--border)' }} content={<ProjectionTooltip base={base} />} />
            <Line
              type="linear"
              dataKey="value"
              stroke="var(--chart-1)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; index?: number; payload?: ProjectionPoint }) => {
                const { cx, cy, index, payload } = props
                if (cx === undefined || cy === undefined) return <g key={index} />
                return payload?.current ? (
                  <circle key={index} cx={cx} cy={cy} r={5} fill="var(--foreground)" />
                ) : (
                  <circle key={index} cx={cx} cy={cy} r={4} fill="var(--card)" stroke="var(--chart-1)" strokeWidth={1.5} />
                )
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden="true">
            <circle cx="5" cy="5" r="4" fill="var(--foreground)" />
          </svg>
          Valor atual
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line x1="0" x2="16" y1="4" y2="4" stroke="var(--chart-1)" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          Estimativas por horizonte
        </span>
        <span>Horizontes igualmente espaçados, fora de escala de tempo</span>
      </figcaption>
    </figure>
  )
}
