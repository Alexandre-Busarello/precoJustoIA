import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const MODELS = [
  { name: 'Graham', tag: 'FREE', gradient: 'from-blue-500 to-cyan-500' },
  { name: 'IA', tag: 'HOT', gradient: 'from-purple-500 to-pink-500' },
  { name: 'Fund. 3+1', tag: 'HOT', gradient: 'from-green-500 to-emerald-500' },
  { name: 'FCD', tag: 'HOT', gradient: 'from-orange-500 to-red-500' },
  { name: 'Div. Yield', tag: null, gradient: 'from-green-600 to-teal-600' },
  { name: 'Gordon', tag: null, gradient: 'from-violet-500 to-purple-500' },
  { name: 'Fórmula Mágica', tag: null, gradient: 'from-yellow-500 to-orange-500' },
  { name: 'Value', tag: 'HOT', gradient: 'from-indigo-500 to-purple-500' },
]

const RANKING_CARDS = [
  {
    pos: 1,
    ticker: 'TAEE11',
    name: 'Transmissora Aliança de Energia Elétrica S.A.',
    sector: 'Energia',
    initials: 'TA',
    bg: 'bg-blue-600',
    price: 'R$ 34,20',
    upside: '+37%',
    upsideColor: 'text-green-600',
    pl: '8,4', pvp: '1,2', roe: '21,3%', roic: '17,8%',
    criteria: [
      'DY: ≥ 8% (atual: 12,4%)',
      'Payout: ≤ 60% (atual: 48%)',
      'P/VP: ≤ 2,0 (atual: 1,2)',
    ],
  },
  {
    pos: 2,
    ticker: 'BBAS3',
    name: 'Banco do Brasil S.A.',
    sector: 'Financeiro',
    initials: 'BB',
    bg: 'bg-yellow-500',
    price: 'R$ 58,20',
    upside: '+46%',
    upsideColor: 'text-green-600',
    pl: '5,8', pvp: '0,9', roe: '18,5%', roic: '14,2%',
    criteria: [
      'DY: ≥ 8% (atual: 9,1%)',
      'Payout: ≤ 60% (atual: 41%)',
      'P/VP: ≤ 2,0 (atual: 0,9)',
    ],
  },
  {
    pos: 3,
    ticker: 'BBSE3',
    name: 'BB Seguridade Participações S.A.',
    sector: 'Seguros',
    initials: 'BS',
    bg: 'bg-blue-800',
    price: 'R$ 31,10',
    upside: '+35%',
    upsideColor: 'text-green-600',
    pl: '10,2', pvp: '3,1', roe: '62,4%', roic: '48,7%',
    criteria: [
      'DY: ≥ 8% (atual: 9,8%)',
      'Payout: ≤ 60% (atual: 55%)',
      'P/VP: ≤ 4,0 (atual: 3,1)',
    ],
  },
]

export function FeaturesRankingSection() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-blue-100 text-blue-700">Ranking B3</Badge>
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
            8 modelos rankeando 500+ ativos da B3
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-500">
            Escolha o modelo e veja quais ações passaram nos seus critérios — com indicadores, upside e análise individual.
          </p>
        </div>

        {/* Model cards */}
        <div className="mb-8 flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-8 md:overflow-visible md:pb-0">
          {MODELS.map((m, i) => (
            <div
              key={m.name}
              className={`relative flex min-w-[90px] shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br ${m.gradient} px-3 py-3 text-center shadow-sm md:min-w-0 ${i === 4 ? 'ring-2 ring-offset-1 ring-green-500' : ''}`}
            >
              {m.tag && (
                <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-xs font-bold text-slate-700 shadow">
                  {m.tag}
                </span>
              )}
              <span className="text-xs font-semibold text-white leading-tight">{m.name}</span>
            </div>
          ))}
        </div>

        {/* Ranking cards — faithful to real UI */}
        <PreviewShell path="/ranking">
        <div className="space-y-3">
          {RANKING_CARDS.map((row) => (
            <div key={row.ticker} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Card header */}
              <div className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="flex items-start gap-3">
                  {/* Logo with position badge */}
                  <div className="relative shrink-0">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${row.bg} text-sm font-extrabold text-white`}>
                      {row.initials}
                    </div>
                    <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                      {row.pos}
                    </span>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-slate-900">{row.ticker}</p>
                    <p className="text-xs text-slate-400 leading-tight">{row.name}</p>
                    <span className="mt-1 inline-block rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                      {row.sector}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-extrabold text-green-600">{row.price}</p>
                  <p className="text-xs font-semibold text-green-600">Upside {row.upside}</p>
                </div>
              </div>

              {/* Metrics row */}
              <div className="mx-4 mb-4 grid grid-cols-4 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-center">
                {[
                  { label: 'P/L', value: row.pl },
                  { label: 'P/VP', value: row.pvp },
                  { label: 'ROE', value: row.roe },
                  { label: 'ROIC', value: row.roic },
                ].map((m) => (
                  <div key={m.label}>
                    <p className="text-xs text-slate-400">{m.label}</p>
                    <p className="text-sm font-semibold text-slate-800">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Individual analysis */}
              <div className="border-t border-slate-100 px-5 py-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className="text-blue-500 text-xs">◎</span>
                  <span className="text-xs font-semibold text-blue-600">Análise Individual</span>
                </div>
                <p className="mb-1.5 text-sm text-slate-700">
                  <strong>{row.ticker}</strong> passou em todos os filtros configurados.
                </p>
                <p className="mb-1 text-xs font-semibold text-slate-600">Critérios atendidos:</p>
                <ul className="space-y-0.5">
                  {row.criteria.map((c) => (
                    <li key={c} className="text-xs text-slate-500">• {c}</li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-2 px-4 pb-4">
                <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white">
                  <span className="text-xs">▣</span> Ver Análise
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-400">
                  ⚙
                </div>
              </div>
            </div>
          ))}
        </div>
        </PreviewShell>
      </div>
    </section>
  )
}
