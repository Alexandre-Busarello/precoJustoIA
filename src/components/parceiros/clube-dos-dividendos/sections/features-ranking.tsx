import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const MODELS = [
  { name: 'Graham', tag: 'Grátis' },
  { name: 'IA', tag: null },
  { name: 'Fund. 3+1', tag: null },
  { name: 'FCD', tag: null },
  { name: 'Div. Yield', tag: null },
  { name: 'Gordon', tag: null },
  { name: 'Fórmula Mágica', tag: null },
  { name: 'Value', tag: null },
]

const RANKING_CARDS = [
  {
    pos: 1,
    ticker: 'TAEE11',
    name: 'Transmissora Aliança de Energia Elétrica S.A.',
    sector: 'Energia',
    initials: 'TA',
    bg: 'bg-brand',
    price: 'R$ 34,20',
    upside: '+37%',
    upsideColor: 'text-positive',
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
    bg: 'bg-warning',
    price: 'R$ 58,20',
    upside: '+46%',
    upsideColor: 'text-positive',
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
    bg: 'bg-brand',
    price: 'R$ 31,10',
    upside: '+35%',
    upsideColor: 'text-positive',
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
    <section className="bg-background py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-brand-subtle text-brand">Ranking B3</Badge>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            Modelos ranqueando mais de 600 ativos da B3
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Escolha o modelo e veja quais ações passaram nos seus critérios — com indicadores, upside e análise individual.
          </p>
        </div>

        {/* Model cards */}
        <div className="mb-8 flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-8 md:overflow-visible md:pb-0">
          {MODELS.map((m, i) => (
            <div
              key={m.name}
              className={`relative flex min-w-[90px] shrink-0 flex-col items-center justify-center rounded-lg border px-3 py-3 text-center md:min-w-0 ${i === 4 ? 'border-brand bg-brand-subtle' : 'border-border bg-card'}`}
            >
              {m.tag && (
                <span className="absolute -right-1 -top-1 rounded-sm border border-border bg-card px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {m.tag}
                </span>
              )}
              <span className="text-xs font-semibold text-foreground leading-tight">{m.name}</span>
            </div>
          ))}
        </div>

        {/* Ranking cards — faithful to real UI */}
        <PreviewShell path="/ranking">
        <div className="space-y-3">
          {RANKING_CARDS.map((row) => (
            <div key={row.ticker} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              {/* Card header */}
              <div className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="flex items-start gap-3">
                  {/* Logo with position badge */}
                  <div className="relative shrink-0">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${row.bg} text-sm font-semibold text-primary-foreground`}>
                      {row.initials}
                    </div>
                    <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                      {row.pos}
                    </span>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{row.ticker}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{row.name}</p>
                    <span className="mt-1 inline-block rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                      {row.sector}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-semibold text-foreground tabular-nums">{row.price}</p>
                  <p className="text-xs font-semibold text-positive">Potencial {row.upside}</p>
                </div>
              </div>

              {/* Metrics row */}
              <div className="mx-4 mb-4 grid grid-cols-4 rounded-lg bg-surface border border-border px-3 py-2.5 text-center">
                {[
                  { label: 'P/L', value: row.pl },
                  { label: 'P/VP', value: row.pvp },
                  { label: 'ROE', value: row.roe },
                  { label: 'ROIC', value: row.roic },
                ].map((m) => (
                  <div key={m.label}>
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-sm font-semibold text-foreground">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Individual analysis */}
              <div className="border-t border-border px-5 py-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-brand">Análise Individual</span>
                </div>
                <p className="mb-1.5 text-sm text-foreground">
                  <strong>{row.ticker}</strong> passou em todos os filtros configurados.
                </p>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Critérios atendidos:</p>
                <ul className="space-y-0.5">
                  {row.criteria.map((c) => (
                    <li key={c} className="text-xs text-muted-foreground">• {c}</li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-2 px-4 pb-4">
                <div className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-card py-2.5 text-sm font-medium text-foreground">
                  Ver análise
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
