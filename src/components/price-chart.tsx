'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatBRL, formatCompact, formatNumber } from '@/lib/format'
import { Badge } from '@/components/ui/badge'

interface PriceChartData {
  date: string
  open: number
  high: number
  low: number
  close: number
  adjustedClose: number
  volume: number
}

type Signal = 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO'

interface RSIData {
  date: Date
  rsi: number
  signal: Signal
}

interface StochasticData {
  date: Date
  k: number
  d: number
  signal: Signal
}

interface TechnicalAnalysis {
  rsi: RSIData[]
  stochastic: StochasticData[]
  currentRSI: RSIData | null
  currentStochastic: StochasticData | null
  overallSignal: Signal
}

interface PriceChartProps {
  data: PriceChartData[]
  technicalAnalysis: TechnicalAnalysis | null
  ticker: string
}

type ChartType = 'line' | 'candlestick'

/** Estilo comum dos gráficos: grade só horizontal, eixos xs em muted, tooltip em superfície de popover. */
const GRID_PROPS = { stroke: 'var(--border)', vertical: false } as const
const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' } as const
const AXIS_PROPS = { tick: AXIS_TICK, tickLine: false, axisLine: false } as const
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
  // pt-BR: sem espaço antes dos dois-pontos ("Fechamento: R$ 111,06").
  separator: ': ',
} as const

interface PriceScale {
  domain: [number, number]
  ticks: number[]
  /** Casas decimais dos rótulos: centavos quando o passo é menor que R$ 1 (FIIs de cota baixa). */
  digits: number
}

/**
 * Escala de preço com passos "redondos" (1, 2, 2,5 ou 5 × 10^n) e 5% de folga nas pontas.
 * Os ticks são explícitos, então o último nunca fica colado no penúltimo.
 */
function niceScale(values: number[], count = 5): PriceScale | null {
  const finite = values.filter((v) => Number.isFinite(v))
  if (finite.length === 0) return null
  let min = Math.min(...finite)
  let max = Math.max(...finite)
  if (min === max) {
    min = min * 0.95
    max = max * 1.05 || 1
  }
  const pad = (max - min) * 0.05
  const lo = Math.max(0, min - pad)
  const hi = max + pad
  const rawStep = (hi - lo) / (count - 1)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalized = rawStep / magnitude
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude
  const start = Math.floor(lo / step) * step
  const end = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks, digits: step < 1 ? 2 : 0 }
}

const MONTH_FORMAT = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })

/** `2026-09-01` → `set. 26`. Os dados são mensais em UTC. */
function monthLabel(value: string | Date): string {
  const parts = MONTH_FORMAT.formatToParts(new Date(value))
  const month = parts.find((p) => p.type === 'month')?.value ?? ''
  const year = parts.find((p) => p.type === 'year')?.value ?? ''
  return `${month} ${year}`
}

const SIGNAL_LABEL: Record<Signal, string> = {
  SOBRECOMPRA: 'Sobrecompra',
  SOBREVENDA: 'Sobrevenda',
  NEUTRO: 'Neutro',
}

function SignalBadge({ signal }: { signal: Signal }) {
  return <Badge variant={signal === 'NEUTRO' ? 'neutral' : 'warning'}>{SIGNAL_LABEL[signal]}</Badge>
}

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

interface CandlestickShapeProps {
  payload?: PriceChartData
  x?: number
  y?: number
  width?: number
  height?: number
}

/**
 * Vela: verde/vermelho porque aqui a cor significa alta/baixa no período.
 * A barra usa `dataKey="range"` ([mínima, máxima]), então `y` é a máxima e `y + height` a mínima na escala de preço.
 */
function CandlestickBar({ payload, x = 0, y: rawY = 0, width = 0, height: rawHeight = 0 }: CandlestickShapeProps) {
  if (!payload) return null
  const { open, high, low, close } = payload
  const y = rawHeight < 0 ? rawY + rawHeight : rawY
  const height = Math.abs(rawHeight)
  const color = close >= open ? 'var(--positive)' : 'var(--negative)'
  const range = high - low || 1
  const bodyTop = ((high - Math.max(open, close)) / range) * height + y
  const bodyBottom = ((high - Math.min(open, close)) / range) * height + y
  const center = x + width / 2

  return (
    <g>
      <line x1={center} y1={y} x2={center} y2={bodyTop} stroke={color} strokeWidth={1} />
      <rect
        x={x + width * 0.2}
        y={bodyTop}
        width={width * 0.6}
        height={Math.max(1, bodyBottom - bodyTop)}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
      <line x1={center} y1={bodyBottom} x2={center} y2={y + height} stroke={color} strokeWidth={1} />
    </g>
  )
}

function ChartPanel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </div>
  )
}

export default function PriceChart({ data, technicalAnalysis, ticker }: PriceChartProps) {
  const [chartType, setChartType] = useState<ChartType>('line')

  // Um ponto por mês: o último registro com volume de cada mês, em ordem cronológica
  const chartData = useMemo(() => {
    const monthly = new Map<string, PriceChartData>()
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    sorted.forEach((item) => {
      if (item.volume <= 0) return
      const date = new Date(item.date)
      const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`
      const existing = monthly.get(key)
      if (!existing || date.getTime() > new Date(existing.date).getTime()) monthly.set(key, item)
    })
    return Array.from(monthly.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((item) => ({ ...item, label: monthLabel(item.date), range: [item.low, item.high] as [number, number] }))
  }, [data])

  const closeScale = useMemo(() => niceScale(chartData.map((d) => d.close)), [chartData])
  const candleScale = useMemo(() => niceScale(chartData.flatMap((d) => [d.low, d.high])), [chartData])

  const rsiData = useMemo(
    () => (technicalAnalysis?.rsi ?? []).map((item) => ({ label: monthLabel(item.date), rsi: item.rsi })),
    [technicalAnalysis]
  )

  const stochasticData = useMemo(
    () => (technicalAnalysis?.stochastic ?? []).map((item) => ({ label: monthLabel(item.date), k: item.k, d: item.d })),
    [technicalAnalysis]
  )

  if (!data || data.length === 0) {
    return (
      <ChartPanel title={`Preço de ${ticker}`}>
        <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">Dados históricos indisponíveis.</p>
      </ChartPanel>
    )
  }

  const priceTick = (scale: PriceScale | null) => (value: number) => formatBRL(value, { digits: scale?.digits ?? 0 })
  const tooltipLabel = (label: unknown) => String(label ?? '')

  return (
    <div className="space-y-4">
      <ChartPanel
        title={`Preço de ${ticker} (mensal)`}
        aside={
          <div role="group" aria-label="Tipo de gráfico" className="inline-flex rounded-md bg-muted p-0.5">
            {(['line', 'candlestick'] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={chartType === type}
                onClick={() => setChartType(type)}
                className={cn(
                  'inline-flex h-11 items-center rounded-[5px] px-3 text-sm font-medium transition-colors md:h-7',
                  chartType === type ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {type === 'line' ? 'Linha' : 'Candlestick'}
              </button>
            ))}
          </div>
        }
      >
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'line' ? (
              <ComposedChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={24} />
                <YAxis
                  yAxisId="price"
                  {...AXIS_PROPS}
                  width={64}
                  domain={closeScale?.domain ?? ['auto', 'auto']}
                  ticks={closeScale?.ticks}
                  tickFormatter={priceTick(closeScale)}
                />
                <YAxis yAxisId="volume" orientation="right" hide domain={[0, (max: number) => max * 4]} />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  labelFormatter={tooltipLabel}
                  formatter={(value, name) =>
                    name === 'volume'
                      ? [formatCompact(Number(value)), 'Volume']
                      : [formatBRL(Number(value)), 'Fechamento']
                  }
                />
                <Bar yAxisId="volume" dataKey="volume" name="volume" fill="var(--chart-2)" fillOpacity={0.35} />
                <Area
                  yAxisId="price"
                  type="monotone"
                  dataKey="close"
                  name="close"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="var(--chart-1)"
                  fillOpacity={0.08}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </ComposedChart>
            ) : (
              <ComposedChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={24} />
                <YAxis
                  {...AXIS_PROPS}
                  width={64}
                  domain={candleScale?.domain ?? ['auto', 'auto']}
                  ticks={candleScale?.ticks}
                  tickFormatter={priceTick(candleScale)}
                />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  labelFormatter={tooltipLabel}
                  content={({ active, payload, label }) => {
                    const point = payload?.[0]?.payload as PriceChartData | undefined
                    if (!active || !point) return null
                    return (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                        <p className="mb-1 text-muted-foreground">{String(label ?? '')}</p>
                        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 tabular-nums">
                          <dt className="text-muted-foreground">Abertura</dt>
                          <dd className="text-right">{formatBRL(point.open)}</dd>
                          <dt className="text-muted-foreground">Máxima</dt>
                          <dd className="text-right">{formatBRL(point.high)}</dd>
                          <dt className="text-muted-foreground">Mínima</dt>
                          <dd className="text-right">{formatBRL(point.low)}</dd>
                          <dt className="text-muted-foreground">Fechamento</dt>
                          <dd className="text-right">{formatBRL(point.close)}</dd>
                        </dl>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="range" shape={<CandlestickBar />} isAnimationActive={false} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      {technicalAnalysis && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartPanel
            title="RSI (índice de força relativa)"
            aside={
              technicalAnalysis.currentRSI && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {formatNumber(technicalAnalysis.currentRSI.rsi, { digits: 1 })}
                  </span>
                  <SignalBadge signal={technicalAnalysis.currentRSI.signal} />
                </div>
              )
            }
          >
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rsiData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis {...AXIS_PROPS} width={32} domain={[0, 100]} ticks={[0, 30, 70, 100]} />
                  <Tooltip
                    {...TOOLTIP_PROPS}
                    labelFormatter={tooltipLabel}
                    formatter={(value) => [formatNumber(Number(value), { digits: 1 }), 'RSI']}
                  />
                  <ReferenceLine y={70} stroke="var(--chart-2)" strokeDasharray="4 3" />
                  <ReferenceLine y={30} stroke="var(--chart-2)" strokeDasharray="4 3" />
                  <Line type="monotone" dataKey="rsi" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <LegendItem label="RSI" color="var(--chart-1)" />
              <LegendItem label="Limites 70 (sobrecompra) e 30 (sobrevenda)" color="var(--chart-2)" dashed />
            </div>
          </ChartPanel>

          <ChartPanel
            title="Oscilador estocástico"
            aside={
              technicalAnalysis.currentStochastic && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    %K {formatNumber(technicalAnalysis.currentStochastic.k, { digits: 1 })} · %D{' '}
                    {formatNumber(technicalAnalysis.currentStochastic.d, { digits: 1 })}
                  </span>
                  <SignalBadge signal={technicalAnalysis.currentStochastic.signal} />
                </div>
              )
            }
          >
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stochasticData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis {...AXIS_PROPS} width={32} domain={[0, 100]} ticks={[0, 20, 80, 100]} />
                  <Tooltip
                    {...TOOLTIP_PROPS}
                    labelFormatter={tooltipLabel}
                    formatter={(value, name) => [formatNumber(Number(value), { digits: 1 }), name === 'k' ? '%K' : '%D']}
                  />
                  <ReferenceLine y={80} stroke="var(--chart-2)" strokeDasharray="4 3" />
                  <ReferenceLine y={20} stroke="var(--chart-2)" strokeDasharray="4 3" />
                  <Line type="monotone" dataKey="k" name="k" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                  <Line
                    type="monotone"
                    dataKey="d"
                    name="d"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <LegendItem label="%K" color="var(--chart-1)" />
              <LegendItem label="%D" color="var(--chart-2)" dashed />
              <span>Limites 80 e 20</span>
            </div>
          </ChartPanel>
        </div>
      )}

      {technicalAnalysis && (
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <h3 className="text-sm font-medium text-foreground">Resumo dos indicadores</h3>
          <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Leitura geral</dt>
              <dd className="mt-1">
                <SignalBadge signal={technicalAnalysis.overallSignal} />
              </dd>
            </div>
            {technicalAnalysis.currentRSI && (
              <div>
                <dt className="text-xs text-muted-foreground">RSI atual</dt>
                <dd className="mt-1 text-sm font-medium tabular-nums text-foreground">
                  {formatNumber(technicalAnalysis.currentRSI.rsi, { digits: 1 })}
                </dd>
              </div>
            )}
            {technicalAnalysis.currentStochastic && (
              <div>
                <dt className="text-xs text-muted-foreground">Estocástico atual</dt>
                <dd className="mt-1 text-sm font-medium tabular-nums text-foreground">
                  %K {formatNumber(technicalAnalysis.currentStochastic.k, { digits: 1 })} · %D{' '}
                  {formatNumber(technicalAnalysis.currentStochastic.d, { digits: 1 })}
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            RSI acima de 70 indica sobrecompra e abaixo de 30, sobrevenda. O oscilador estocástico funciona de forma
            parecida, com limites em 80 e 20. Os indicadores descrevem o comportamento recente do preço e não são
            recomendação de investimento.
          </p>
        </div>
      )}
    </div>
  )
}
