import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const METRICS_TOP = [
  { label: 'Valor Final', value: 'R$18.420', color: 'text-positive' },
  { label: 'Ganho Total', value: 'R$8.420', color: 'text-positive' },
  { label: 'Retorno Total', value: '+84,2%', color: 'text-positive' },
  { label: 'Retorno Anual', value: '+13,4%', color: 'text-positive' },
]

const METRICS_STATS = [
  { label: 'Volatilidade', value: '18,3%', color: 'text-warning' },
  { label: 'Sharpe Ratio', value: '0,92', color: 'text-brand' },
  { label: 'Drawdown Máx.', value: '−23,1%', color: 'text-negative' },
  { label: 'Dividendos', value: 'R$2.140', color: 'text-brand' },
  { label: 'Meses Positivos', value: '68%', color: 'text-positive' },
  { label: 'vs. IBOVESPA', value: '+31,2%', color: 'text-brand' },
]

// Simplified sparkline data — relative heights 0–100
const CHART_POINTS = [30, 35, 32, 40, 38, 45, 50, 48, 55, 60, 57, 65, 70, 68, 75, 80, 78, 84]
const CDI_POINTS =   [30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64]
const IBOV_POINTS =  [30, 28, 33, 38, 36, 42, 39, 44, 50, 47, 53, 58, 55, 61, 58, 66, 63, 69]

function polylinePoints(data: number[], w: number, h: number) {
  return data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / 100) * h}`)
    .join(' ')
}

export function FeaturesBacktestSection() {
  const W = 400
  const H = 100

  return (
    <section className="bg-background py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-brand-subtle text-brand">Backtesting</Badge>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            Teste sua estratégia nos últimos anos antes de investir
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Simule como qualquer carteira teria se saído no histórico real da B3 — com retorno, risco, Sharpe e comparação contra CDI e Ibovespa.
          </p>
        </div>

        <PreviewShell path="/backtesting">
        <div className="overflow-hidden rounded-lg border border-border shadow-sm">
          {/* Summary header */}
          <div className="px-6 py-5">
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Simulação · Graham · 2020–2024</p>
              <Badge className="bg-brand-subtle text-brand text-xs">Capital inicial: R$10.000</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {METRICS_TOP.map((m) => (
                <div key={m.label} className="rounded-lg bg-card px-4 py-3 text-center shadow-sm">
                  <p className={`text-xl font-semibold ${m.color}`}>{m.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="border-b border-border px-6 py-5">
            <p className="mb-3 text-xs font-semibold text-muted-foreground">Evolução do portfólio</p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" preserveAspectRatio="none">
              <polyline
                points={polylinePoints(IBOV_POINTS, W, H)}
                fill="none"
                stroke="var(--chart-4)"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
              <polyline
                points={polylinePoints(CDI_POINTS, W, H)}
                fill="none"
                stroke="var(--chart-2)"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
              <polyline
                points={polylinePoints(CHART_POINTS, W, H)}
                fill="none"
                stroke="var(--chart-1)"
                strokeWidth="2.5"
              />
            </svg>
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-5 rounded bg-brand" />
                <span className="text-muted-foreground">Portfólio</span>
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="var(--chart-2)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
                <span className="text-muted-foreground">CDI</span>
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="var(--chart-4)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
                <span className="text-muted-foreground">IBOVESPA</span>
              </span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 p-6 md:grid-cols-3">
            {METRICS_STATS.map((m) => (
              <div key={m.label} className="flex items-center gap-3 rounded-lg bg-surface p-3">
                <div>
                  <p className={`text-sm font-semibold ${m.color}`}>{m.value}</p>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border bg-surface px-5 py-2 text-right text-xs text-muted-foreground">
            Dados ilustrativos · Premium
          </div>
        </div>
        </PreviewShell>
      </div>
    </section>
  )
}
