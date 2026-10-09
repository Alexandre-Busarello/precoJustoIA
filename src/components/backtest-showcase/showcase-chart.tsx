import { formatBRL } from '@/lib/format'
import { formatShowcaseMonth, type ShowcasePoint } from '@/lib/backtest-showcase/summary'

const WIDTH = 300
const HEIGHT = 96
const PAD = 4

const SERIES = [
  { key: 'portfolio', label: 'Carteira', color: 'var(--chart-1)', dashed: false },
  { key: 'cdi', label: 'CDI', color: 'var(--chart-2)', dashed: true },
  { key: 'ibov', label: 'Ibovespa', color: 'var(--chart-3)', dashed: true },
] as const

/** Linha pequena (SVG renderizado no servidor): carteira contra CDI e Ibovespa com os mesmos aportes. */
export function ShowcaseChart({ series, title }: { series: ShowcasePoint[]; title: string }) {
  if (series.length < 2) return null
  const values = series.flatMap((point) => [point.portfolio, point.cdi, point.ibov])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const x = (index: number) => PAD + (index / (series.length - 1)) * (WIDTH - PAD * 2)
  const y = (value: number) => HEIGHT - PAD - ((value - min) / range) * (HEIGHT - PAD * 2)
  const last = series[series.length - 1]

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-24 w-full"
        role="img"
        aria-label={`${title}: evolução de ${formatShowcaseMonth(series[0].month)} a ${formatShowcaseMonth(last.month)}. Carteira ${formatBRL(last.portfolio, { digits: 0 })}, CDI ${formatBRL(last.cdi, { digits: 0 })}, Ibovespa ${formatBRL(last.ibov, { digits: 0 })}.`}
      >
        <line x1={PAD} x2={WIDTH - PAD} y1={HEIGHT - PAD} y2={HEIGHT - PAD} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
        {/* Benchmarks primeiro: a carteira fica por cima */}
        {[...SERIES].reverse().map((s) => (
          <polyline
            key={s.key}
            fill="none"
            stroke={s.color}
            strokeWidth={s.dashed ? 1.5 : 2}
            strokeDasharray={s.dashed ? '4 3' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            points={series.map((point, index) => `${x(index).toFixed(1)},${y(point[s.key]).toFixed(1)}`).join(' ')}
          />
        ))}
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <svg aria-hidden="true" width="14" height="4" className="shrink-0">
                <line x1="1" x2="13" y1="2" y2="2" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '3 2' : undefined} strokeLinecap="round" />
              </svg>
              {s.label}
            </span>
          ))}
      </figcaption>
    </figure>
  )
}
