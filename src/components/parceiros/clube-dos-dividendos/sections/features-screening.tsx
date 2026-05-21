import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const FILTER_GROUPS = [
  {
    label: 'Dividendos',
    color: 'border-amber-400 bg-amber-50',
    labelColor: 'text-amber-700',
    filters: ['Dividend Yield ≥ 6%', 'Payout ≤ 80%', 'Score Sustentabilidade ≥ 70'],
  },
  {
    label: 'Valuation',
    color: 'border-violet-400 bg-violet-50',
    labelColor: 'text-violet-700',
    filters: ['P/L ≤ 12x', 'P/VP ≤ 2x', 'EV/EBITDA ≤ 8x'],
  },
  {
    label: 'Rentabilidade',
    color: 'border-green-400 bg-green-50',
    labelColor: 'text-green-700',
    filters: ['ROE ≥ 15%', 'Margem Líquida ≥ 10%'],
  },
  {
    label: 'Endividamento',
    color: 'border-red-400 bg-red-50',
    labelColor: 'text-red-700',
    filters: ['Dívida/EBITDA ≤ 3x', 'Liquidez Corrente ≥ 1'],
  },
  {
    label: 'Crescimento',
    color: 'border-blue-400 bg-blue-50',
    labelColor: 'text-blue-700',
    filters: ['CAGR Lucros ≥ 5%', 'CAGR Receitas ≥ 8%'],
  },
  {
    label: 'Tamanho',
    color: 'border-slate-400 bg-slate-50',
    labelColor: 'text-slate-700',
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
    <section className="bg-slate-50 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-purple-100 text-purple-700">Screening Avançado</Badge>
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
            Filtre os melhores ativos por mais de 20 critérios
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-500">
            Combine filtros de dividendos, valuation, endividamento e crescimento. Encontre exatamente o que você procura em segundos.
          </p>
        </div>

        <PreviewShell path="/screening">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {/* Filter panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:w-64 lg:shrink-0">
            <p className="mb-4 text-sm font-semibold text-slate-700">Configurar filtros</p>
            <div className="space-y-3">
              {FILTER_GROUPS.map((g) => (
                <div key={g.label} className={`rounded-xl border ${g.color} p-3`}>
                  <p className={`mb-2 text-xs font-bold uppercase tracking-wide ${g.labelColor}`}>{g.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.filters.map((f) => (
                      <span
                        key={f}
                        className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 shadow-sm"
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
              <p className="text-sm font-semibold text-slate-700">
                Resultado:{' '}
                <span className="text-emerald-600 font-bold">23 ativos</span> encontrados
                <span className="ml-1 text-xs text-slate-400">(ilustrativo)</span>
              </p>
              <Badge className="bg-amber-100 text-amber-700">PREMIUM</Badge>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-400">
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
                    <tr key={row.ticker} className={i < SCREENING_RESULT.length - 1 ? 'border-b border-slate-100' : ''}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.ticker}</td>
                      <td className="px-4 py-3 text-slate-600">{row.preco}</td>
                      <td className="px-4 py-3 text-slate-700">{row.justo}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          {row.upside}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-emerald-600">{row.dy}</td>
                      <td className="px-4 py-3 text-slate-500">{row.roe}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-right text-xs text-slate-400">
                Resultados completos disponíveis na plataforma
              </div>
            </div>

            {/* Preset strategies */}
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Estratégias rápidas</p>
              <div className="flex flex-wrap gap-2">
                {['Vacas Leiteiras', 'Graham Clássico', 'Small Caps Crescimento', 'Desconto Excessivo', 'Fórmula Mágica'].map((s) => (
                  <span key={s} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
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
