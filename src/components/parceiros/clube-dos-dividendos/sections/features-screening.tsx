import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const FILTER_GROUPS = [
  {
    label: 'Dividendos',
    color: 'border-warning bg-warning-subtle',
    labelColor: 'text-warning',
    filters: ['Dividend Yield ≥ 6%', 'Payout ≤ 80%', 'Score Sustentabilidade ≥ 70'],
  },
  {
    label: 'Valuation',
    color: 'border-brand bg-brand-subtle',
    labelColor: 'text-brand',
    filters: ['P/L ≤ 12x', 'P/VP ≤ 2x', 'EV/EBITDA ≤ 8x'],
  },
  {
    label: 'Rentabilidade',
    color: 'border-positive bg-positive-subtle',
    labelColor: 'text-positive',
    filters: ['ROE ≥ 15%', 'Margem Líquida ≥ 10%'],
  },
  {
    label: 'Endividamento',
    color: 'border-negative bg-negative-subtle',
    labelColor: 'text-negative',
    filters: ['Dívida/EBITDA ≤ 3x', 'Liquidez Corrente ≥ 1'],
  },
  {
    label: 'Crescimento',
    color: 'border-brand bg-brand-subtle',
    labelColor: 'text-brand',
    filters: ['CAGR Lucros ≥ 5%', 'CAGR Receitas ≥ 8%'],
  },
  {
    label: 'Tamanho',
    color: 'border-border bg-surface',
    labelColor: 'text-foreground',
    filters: ['Market Cap ≥ R$1B'],
  },
]

const SCREENING_RESULT = [
  { ticker: 'TAEE11', preco: 'R$34,20', justo: 'R$46,80', upside: '+37%', dy: '12,4%', roe: '21%' },
  { ticker: 'BBSE3', preco: 'R$31,10', justo: 'R$41,90', upside: '+35%', dy: '9,8%', roe: '18%' },
  { ticker: 'ITSA4', preco: 'R$9,40', justo: 'R$13,05', upside: '+39%', dy: '7,4%', roe: '17%' },
]

export function FeaturesScreeningSection() {
  return (
    <section className="bg-surface py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-brand-subtle text-brand">Screening Avançado</Badge>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            Filtre ativos por mais de 20 critérios
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Combine filtros de dividendos, valuation, endividamento e crescimento. Encontre exatamente o que você procura em segundos.
          </p>
        </div>

        <PreviewShell path="/screening">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8 rounded-lg border border-border bg-card p-5 shadow-sm">
          {/* Filter panel */}
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm lg:w-64 lg:shrink-0">
            <p className="mb-4 text-sm font-semibold text-foreground">Configurar filtros</p>
            <div className="space-y-3">
              {FILTER_GROUPS.map((g) => (
                <div key={g.label} className={`rounded-lg border ${g.color} p-3`}>
                  <p className={`mb-2 text-xs font-semibold ${g.labelColor}`}>{g.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.filters.map((f) => (
                      <span
                        key={f}
                        className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground shadow-sm"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                Resultado:{' '}
                <span className="text-brand font-semibold">23 ativos</span> encontrados
                <span className="ml-1 text-xs text-muted-foreground">(ilustrativo)</span>
              </p>
              <Badge className="bg-warning-subtle text-warning">Premium</Badge>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-left text-xs font-semibold text-muted-foreground">
                    <th className="px-4 py-3">Ativo</th>
                    <th className="px-4 py-3">Preço</th>
                    <th className="px-4 py-3">P. Justo</th>
                    <th className="px-4 py-3">Upside</th>
                    <th className="px-4 py-3">DY</th>
                    <th className="px-4 py-3">ROE</th>
                  </tr>
                </thead>
                <tbody>
                  {SCREENING_RESULT.map((row, i) => (
                    <tr key={row.ticker} className={i < SCREENING_RESULT.length - 1 ? 'border-b border-border' : ''}>
                      <td className="px-4 py-3 font-semibold text-foreground">{row.ticker}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.preco}</td>
                      <td className="px-4 py-3 text-foreground">{row.justo}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-brand-subtle px-2 py-0.5 text-xs font-semibold text-brand">
                          {row.upside}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-brand">{row.dy}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.roe}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-border bg-surface px-4 py-2 text-right text-xs text-muted-foreground">
                Resultados completos disponíveis na plataforma
              </div>
            </div>

            {/* Preset strategies */}
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Estratégias rápidas</p>
              <div className="flex flex-wrap gap-2">
                {['Vacas Leiteiras', 'Graham Clássico', 'Small Caps Crescimento', 'Desconto Excessivo', 'Fórmula Mágica'].map((s) => (
                  <span key={s} className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        </PreviewShell>
      </div>
    </section>
  )
}
