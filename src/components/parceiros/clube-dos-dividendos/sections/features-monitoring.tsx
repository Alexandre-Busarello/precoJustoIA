import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const ACTIVE_MONITORS = [
  {
    ticker: 'TAEE11',
    name: 'Taesa',
    conditions: ['DY ≥ 10%', 'Payout ≤ 60%', 'Score ≥ 85'],
    lastTriggered: 'Hoje, 09:14',
    status: 'triggered',
  },
  {
    ticker: 'BBAS3',
    name: 'Banco do Brasil',
    conditions: ['P/VP ≤ 1,0', 'ROE ≥ 18%', 'P/L ≤ 7'],
    lastTriggered: 'Aguardando',
    status: 'waiting',
  },
  {
    ticker: 'WEGE3',
    name: 'WEG',
    conditions: ['Score ≥ 90', 'Preço ≤ R$ 38,00'],
    lastTriggered: 'Aguardando',
    status: 'waiting',
  },
]

const CONDITION_GROUPS = [
  {
    label: 'Preço',
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    fields: [
      { name: 'Preço abaixo de', value: 'R$ 35,00' },
      { name: 'Preço acima de', value: '—' },
    ],
  },
  {
    label: 'Valuation',
    color: 'bg-violet-50 border-violet-200 text-violet-700',
    fields: [
      { name: 'P/L máx.', value: '10' },
      { name: 'P/VP máx.', value: '1,5' },
    ],
  },
  {
    label: 'Dividendos',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    fields: [
      { name: 'DY mín.', value: '8%' },
      { name: 'Payout máx.', value: '60%' },
    ],
  },
  {
    label: 'Score / Rentabilidade',
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    fields: [
      { name: 'Score mín.', value: '80' },
      { name: 'ROE mín.', value: '15%' },
    ],
  },
]

export function FeaturesMonitoringSection() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 lg:flex-row-reverse lg:items-start lg:gap-16">

          {/* Description */}
          <div className="lg:w-2/5">
            <Badge className="mb-3 bg-orange-100 text-orange-700">Alertas Inteligentes</Badge>
            <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
              Alertas automáticos com os seus critérios
            </h2>
            <p className="mt-4 text-slate-500">
              Monte filtros exatamente como um screening — DY, P/L, P/VP, Score, ROE, Payout, Margem e muito mais — e receba um alerta por e-mail quando qualquer ativo atingir suas condições.
            </p>
            <ul className="mt-6 space-y-2">
              {[
                'Combine múltiplos indicadores por ativo',
                'Alertas por e-mail em tempo real',
                'Monitoramentos ilimitados no PREMIUM',
                'Parâmetros de valuation, dividendos e rentabilidade',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Badge className="bg-amber-100 text-amber-700">Exclusivo PREMIUM</Badge>
            </div>
          </div>

          {/* Preview panel */}
          <div className="flex-1 space-y-4">
          <PreviewShell path="/dashboard/monitoramentos-customizados">

            {/* Create monitor form */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-base">
                  🔔
                </div>
                <p className="font-semibold text-slate-800">Novo Monitoramento Customizado</p>
                <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">PREMIUM</span>
              </div>

              <div className="p-5 space-y-4">
                {/* Asset selected */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-slate-500">Ativo monitorado</p>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">TA</div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">TAEE11</p>
                      <p className="text-xs text-slate-400">Transmissora Aliança de Energia</p>
                    </div>
                    <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Selecionado</span>
                  </div>
                </div>

                {/* Condition groups */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">Critérios de disparo</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CONDITION_GROUPS.map((g) => (
                      <div key={g.label} className={`rounded-xl border p-3 ${g.color}`}>
                        <p className="mb-2 text-xs font-semibold">{g.label}</p>
                        {g.fields.map((f) => (
                          <div key={f.name} className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">{f.name}</span>
                            <span className={`font-semibold ${f.value === '—' ? 'text-slate-300' : ''}`}>{f.value}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-400">Disparará quando TAEE11 satisfizer <strong>todos</strong> os critérios acima.</p>
              </div>
            </div>

            {/* Active monitors list */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Seus monitoramentos ativos</p>
              </div>
              <div className="divide-y divide-slate-100 bg-white">
                {ACTIVE_MONITORS.map((m) => (
                  <div key={m.ticker} className={`px-5 py-4 ${m.status === 'triggered' ? 'bg-emerald-50/50' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {m.ticker.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{m.ticker}</p>
                          <p className="text-xs text-slate-400">{m.name}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        m.status === 'triggered'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {m.status === 'triggered' ? '🔔 Disparou' : 'Aguardando'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.conditions.map((c) => (
                        <span key={c} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                          {c}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">{m.lastTriggered}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-2 text-right text-xs text-slate-400">
                Dados ilustrativos · PREMIUM
              </div>
            </div>

          </PreviewShell>
          </div>
        </div>
      </div>
    </section>
  )
}
