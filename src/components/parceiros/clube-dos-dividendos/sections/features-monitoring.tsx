import { Check } from 'lucide-react'
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
    color: 'bg-brand-subtle border-brand/40 text-brand',
    fields: [
      { name: 'Preço abaixo de', value: 'R$ 35,00' },
      { name: 'Preço acima de', value: '—' },
    ],
  },
  {
    label: 'Valuation',
    color: 'bg-brand-subtle border-brand/40 text-brand',
    fields: [
      { name: 'P/L máx.', value: '10' },
      { name: 'P/VP máx.', value: '1,5' },
    ],
  },
  {
    label: 'Dividendos',
    color: 'bg-brand-subtle border-brand/40 text-brand',
    fields: [
      { name: 'DY mín.', value: '8%' },
      { name: 'Payout máx.', value: '60%' },
    ],
  },
  {
    label: 'Score / Rentabilidade',
    color: 'bg-warning-subtle border-warning/40 text-warning',
    fields: [
      { name: 'Score mín.', value: '80' },
      { name: 'ROE mín.', value: '15%' },
    ],
  },
]

export function FeaturesMonitoringSection() {
  return (
    <section className="bg-background py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 lg:flex-row-reverse lg:items-start lg:gap-16">

          {/* Description */}
          <div className="lg:w-2/5">
            <Badge className="mb-3 bg-warning-subtle text-warning">Alertas inteligentes</Badge>
            <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
              Alertas automáticos com os seus critérios
            </h2>
            <p className="mt-4 text-muted-foreground">
              Monte filtros exatamente como um screening — DY, P/L, P/VP, Score, ROE, Payout, Margem e muito mais — e receba um alerta por e-mail quando qualquer ativo atingir suas condições.
            </p>
            <ul className="mt-6 space-y-2">
              {[
                'Combine múltiplos indicadores por ativo',
                'Alertas por e-mail em tempo real',
                'Monitoramentos ilimitados no Premium',
                'Parâmetros de valuation, dividendos e rentabilidade',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="size-4 shrink-0 mt-0.5 text-brand" strokeWidth={1.75} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Badge className="bg-warning-subtle text-warning">Exclusivo Premium</Badge>
            </div>
          </div>

          {/* Preview panel */}
          <div className="flex-1 space-y-4">
          <PreviewShell path="/dashboard/monitoramentos-customizados">

            {/* Create monitor form */}
            <div className="overflow-hidden rounded-lg border border-border shadow-sm">
              <div className="flex items-center gap-3 border-b border-border bg-surface px-5 py-4">
                <p className="font-semibold text-foreground">Novo Monitoramento Customizado</p>
                <span className="ml-auto rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-semibold text-warning">Premium</span>
              </div>

              <div className="p-5 space-y-4">
                {/* Asset selected */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Ativo monitorado</p>
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-primary-foreground">TA</div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">TAEE11</p>
                      <p className="text-xs text-muted-foreground">Transmissora Aliança de Energia</p>
                    </div>
                    <span className="ml-auto rounded-full bg-brand-subtle px-2 py-0.5 text-xs font-medium text-brand">Selecionado</span>
                  </div>
                </div>

                {/* Condition groups */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Critérios de disparo</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CONDITION_GROUPS.map((g) => (
                      <div key={g.label} className={`rounded-lg border p-3 ${g.color}`}>
                        <p className="mb-2 text-xs font-semibold">{g.label}</p>
                        {g.fields.map((f) => (
                          <div key={f.name} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{f.name}</span>
                            <span className={`font-semibold ${f.value === '—' ? 'text-muted-foreground' : ''}`}>{f.value}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">Disparará quando TAEE11 satisfizer <strong>todos</strong> os critérios acima.</p>
              </div>
            </div>

            {/* Active monitors list */}
            <div className="overflow-hidden rounded-lg border border-border shadow-sm">
              <div className="border-b border-border bg-surface px-5 py-3">
                <p className="text-xs font-semibold text-muted-foreground">Seus monitoramentos ativos</p>
              </div>
              <div className="divide-y divide-border bg-card">
                {ACTIVE_MONITORS.map((m) => (
                  <div key={m.ticker} className={`px-5 py-4 ${m.status === 'triggered' ? 'bg-brand-subtle' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {m.ticker.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{m.ticker}</p>
                          <p className="text-xs text-muted-foreground">{m.name}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        m.status === 'triggered'
                          ? 'bg-brand-subtle text-brand'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {m.status === 'triggered' ? 'Disparou' : 'Aguardando'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.conditions.map((c) => (
                        <span key={c} className="rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                          {c}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{m.lastTriggered}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-border bg-surface px-5 py-2 text-right text-xs text-muted-foreground">
                Dados ilustrativos · Premium
              </div>
            </div>

          </PreviewShell>
          </div>
        </div>
      </div>
    </section>
  )
}
