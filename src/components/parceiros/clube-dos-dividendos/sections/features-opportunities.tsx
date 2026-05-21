import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

type StatusType = 'green' | 'yellow' | 'red'

const STATUS_COLORS: Record<StatusType, { dot: string; label: string }> = {
  green: { dot: 'bg-green-500', label: 'text-green-700' },
  yellow: { dot: 'bg-yellow-500', label: 'text-yellow-700' },
  red: { dot: 'bg-red-500', label: 'text-red-600' },
}

function StatusDot({ status, label }: { status: StatusType; label: string }) {
  const c = STATUS_COLORS[status]
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
      <span className={`text-xs font-medium ${c.label}`}>{label}</span>
    </div>
  )
}

const OPPORTUNITIES = [
  {
    ticker: 'TAEE11',
    name: 'Taesa',
    score: 94,
    scoreStatus: 'green' as StatusType,
    valuation: '+37%',
    valuationStatus: 'green' as StatusType,
    tecnico: 'Entrada',
    tecnicoStatus: 'green' as StatusType,
    sentimento: 82,
    sentimentoStatus: 'green' as StatusType,
    strategies: ['Dividendos', 'Bazin'],
  },
  {
    ticker: 'BBAS3',
    name: 'Banco do Brasil',
    score: 88,
    scoreStatus: 'green' as StatusType,
    valuation: '+46%',
    valuationStatus: 'green' as StatusType,
    tecnico: 'Atenção',
    tecnicoStatus: 'yellow' as StatusType,
    sentimento: 71,
    sentimentoStatus: 'yellow' as StatusType,
    strategies: ['Graham', 'Value'],
  },
  {
    ticker: 'WEGE3',
    name: 'WEG',
    score: 62,
    scoreStatus: 'yellow' as StatusType,
    valuation: '+8%',
    valuationStatus: 'yellow' as StatusType,
    tecnico: 'Aguardar',
    tecnicoStatus: 'yellow' as StatusType,
    sentimento: 85,
    sentimentoStatus: 'green' as StatusType,
    strategies: ['IA', 'Fund. 3+1'],
  },
  {
    ticker: 'MGLU3',
    name: 'Magalu',
    score: 28,
    scoreStatus: 'red' as StatusType,
    valuation: '−12%',
    valuationStatus: 'red' as StatusType,
    tecnico: 'Evitar',
    tecnicoStatus: 'red' as StatusType,
    sentimento: 31,
    sentimentoStatus: 'red' as StatusType,
    strategies: [],
  },
]

export function FeaturesOpportunitiesSection() {
  return (
    <section className="bg-slate-950 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            Radar de Oportunidades
          </Badge>
          <h2 className="text-3xl font-extrabold text-white md:text-4xl">
            Identifique em segundos o que comprar, aguardar ou evitar
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">
            Cada ativo é avaliado em 4 dimensões: Score Geral, Valuation, Técnico e Sentimento. Três cores, uma decisão clara.
          </p>
        </div>

        <PreviewShell path="/radar-de-oportunidades">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs font-semibold uppercase text-slate-500">
                <th className="px-5 py-3">Ativo</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Estratégias</th>
                <th className="px-4 py-3">Valuation</th>
                <th className="px-4 py-3">Técnico</th>
                <th className="px-4 py-3">Sentimento</th>
              </tr>
            </thead>
            <tbody>
              {OPPORTUNITIES.map((row, i) => (
                <tr key={row.ticker} className={i < OPPORTUNITIES.length - 1 ? 'border-b border-slate-800' : ''}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                        {row.ticker.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{row.ticker}</div>
                        <div className="text-xs text-slate-500">{row.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${
                          row.scoreStatus === 'green'
                            ? 'bg-green-500'
                            : row.scoreStatus === 'yellow'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                      >
                        {row.score}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {row.strategies.length > 0
                        ? row.strategies.map((s) => (
                            <span key={s} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                              {s}
                            </span>
                          ))
                        : <span className="text-xs text-slate-600">Nenhuma</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusDot
                      status={row.valuationStatus}
                      label={row.valuation}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <StatusDot status={row.tecnicoStatus} label={row.tecnico} />
                  </td>
                  <td className="px-4 py-4">
                    <StatusDot status={row.sentimentoStatus} label={String(row.sentimento)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-4 border-t border-slate-800 bg-slate-900/80 px-5 py-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />Comprar</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />Aguardar</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Evitar</span>
            <span className="ml-auto text-slate-600">Dados ilustrativos · PREMIUM</span>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {OPPORTUNITIES.map((row) => {
            const score = STATUS_COLORS[row.scoreStatus]
            return (
              <div key={row.ticker} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                      {row.ticker.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{row.ticker}</div>
                      <div className="text-xs text-slate-500">{row.name}</div>
                    </div>
                  </div>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${score.dot}`}>
                    {row.score}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Valuation</p>
                    <StatusDot status={row.valuationStatus} label={row.valuation} />
                  </div>
                  <div>
                    <p className="text-slate-500">Técnico</p>
                    <StatusDot status={row.tecnicoStatus} label={row.tecnico} />
                  </div>
                  <div>
                    <p className="text-slate-500">Sentimento</p>
                    <StatusDot status={row.sentimentoStatus} label={String(row.sentimento)} />
                  </div>
                </div>
              </div>
            )
          })}
          <p className="text-right text-xs text-slate-600">Dados ilustrativos</p>
        </div>
        </PreviewShell>
      </div>
    </section>
  )
}
