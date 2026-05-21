import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const METRICS_TOP = [
  { label: 'Valor Final', value: 'R$18.420', color: 'text-green-600' },
  { label: 'Ganho Total', value: 'R$8.420', color: 'text-green-600' },
  { label: 'Retorno Total', value: '+84,2%', color: 'text-green-600' },
  { label: 'Retorno Anual', value: '+13,4%', color: 'text-green-600' },
]

const METRICS_STATS = [
  { label: 'Volatilidade', value: '18,3%', icon: '📉', color: 'text-orange-600' },
  { label: 'Sharpe Ratio', value: '0,92', icon: '📊', color: 'text-purple-600' },
  { label: 'Drawdown Máx.', value: '−23,1%', icon: '⚠️', color: 'text-red-600' },
  { label: 'Dividendos', value: 'R$2.140', icon: '💰', color: 'text-emerald-600' },
  { label: 'Meses Positivos', value: '68%', icon: '✅', color: 'text-green-600' },
  { label: 'vs. IBOVESPA', value: '+31,2%', icon: '🎯', color: 'text-blue-600' },
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
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-indigo-100 text-indigo-700">Backtesting</Badge>
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
            Teste sua estratégia nos últimos anos antes de investir
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-500">
            Simule como qualquer carteira teria se saído no histórico real da B3 — com retorno, risco, Sharpe e comparação contra CDI e Ibovespa.
          </p>
        </div>

        <PreviewShell path="/backtesting">
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          {/* Summary header */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-5">
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-700">Simulação · Graham · 2020–2024</p>
              <Badge className="bg-blue-100 text-blue-700 text-xs">Capital inicial: R$10.000</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {METRICS_TOP.map((m) => (
                <div key={m.label} className="rounded-xl bg-white/80 px-4 py-3 text-center shadow-sm">
                  <p className={`text-xl font-extrabold ${m.color}`}>{m.value}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="mb-3 text-xs font-semibold uppercase text-slate-400">Evolução do portfólio</p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" preserveAspectRatio="none">
              <polyline
                points={polylinePoints(IBOV_POINTS, W, H)}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
              <polyline
                points={polylinePoints(CDI_POINTS, W, H)}
                fill="none"
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
              <polyline
                points={polylinePoints(CHART_POINTS, W, H)}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
              />
            </svg>
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-5 rounded bg-blue-500" />
                <span className="text-slate-600">Portfólio</span>
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
                <span className="text-slate-600">CDI</span>
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
                <span className="text-slate-600">IBOVESPA</span>
              </span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 p-6 md:grid-cols-3">
            {METRICS_STATS.map((m) => (
              <div key={m.label} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <span className="text-xl">{m.icon}</span>
                <div>
                  <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-xs text-slate-400">{m.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 bg-slate-50 px-5 py-2 text-right text-xs text-slate-400">
            Dados ilustrativos · PREMIUM
          </div>
        </div>
        </PreviewShell>
      </div>
    </section>
  )
}
