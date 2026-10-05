import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const TICKERS_BREADCRUMB = ['TAEE11', 'BBAS3', 'ITSA4', 'BBSE3', 'SAPR11', 'CPLE6']

type Medal = { label: string; border: string; bg: string; badgeBg: string; badgeText: string }
const MEDALS: Medal[] = [
  { label: '#1 Ouro',   border: 'border-warning', bg: 'bg-warning-subtle',  badgeBg: 'bg-warning-subtle', badgeText: 'text-warning' },
  { label: '#2 Prata',  border: 'border-border',  bg: 'bg-surface',   badgeBg: 'bg-muted',  badgeText: 'text-foreground' },
  { label: '#3 Bronze', border: 'border-warning', bg: 'bg-warning-subtle',  badgeBg: 'bg-warning-subtle', badgeText: 'text-warning' },
]

const TOP3 = [
  {
    ticker: 'TAEE11', name: 'Taesa', full: 'Transmissora Aliança de Energia Elétrica S.A.',
    sector: 'Energia', size: 'Large Caps', sizeColor: 'bg-positive-subtle text-positive',
    initials: 'TA', bg: 'bg-brand',
    price: 'R$ 34,20', upside: '+37% de upside',
    industry: 'Transmissão de Energia', location: 'Belo Horizonte, MG', employees: '839 funcionários',
  },
  {
    ticker: 'BBAS3', name: 'Banco do Brasil', full: 'Banco do Brasil S.A.',
    sector: 'Financeiro', size: 'Large Caps', sizeColor: 'bg-positive-subtle text-positive',
    initials: 'BB', bg: 'bg-warning',
    price: 'R$ 58,20', upside: '+46% de upside',
    industry: 'Bancos', location: 'Brasília, DF', employees: '86.000 funcionários',
  },
  {
    ticker: 'BBSE3', name: 'BB Seguridade', full: 'BB Seguridade Participações S.A.',
    sector: 'Seguros', size: 'Large Caps', sizeColor: 'bg-positive-subtle text-positive',
    initials: 'BS', bg: 'bg-brand',
    price: 'R$ 31,10', upside: '+35% de upside',
    industry: 'Seguros', location: 'Brasília, DF', employees: 'N/D',
  },
]

const OTHERS = [
  { ticker: 'ITSA4', name: 'Itaúsa', full: 'Itaúsa S.A.', sector: 'Financeiro', size: 'Large Caps', sizeColor: 'bg-positive-subtle text-positive', initials: 'IT', bg: 'bg-warning', price: 'R$ 9,40', upside: '+39% de upside', industry: 'Holdings', location: 'São Paulo, SP', employees: '300 funcionários' },
  { ticker: 'SAPR11', name: 'Sanepar', full: 'Cia de Saneamento do Paraná S.A.', sector: 'Saneamento', size: 'Mid Caps', sizeColor: 'bg-brand-subtle text-brand', initials: 'SA', bg: 'bg-brand', price: 'R$ 22,40', upside: '+32% de upside', industry: 'Saneamento', location: 'Curitiba, PR', employees: '5.200 funcionários' },
  { ticker: 'CPLE6', name: 'Copel', full: 'Companhia Paranaense de Energia S.A.', sector: 'Energia', size: 'Large Caps', sizeColor: 'bg-positive-subtle text-positive', initials: 'CP', bg: 'bg-negative', price: 'R$ 10,80', upside: '+28% de upside', industry: 'Energia Elétrica', location: 'Curitiba, PR', employees: '6.100 funcionários' },
]

const TABLE_ROWS = [
  {
    label: 'P/L', sub: 'Preço/Lucro',
    values: ['8,4','5,8','10,2','9,1','7,6','11,3'],
    best: 1,
  },
  {
    label: 'P/VP', sub: 'Preço/Valor Patrimonial',
    values: ['1,2','0,9','3,1','1,1','0,8','1,4'],
    best: 4,
  },
  {
    label: 'ROE', sub: 'Retorno sobre Patrimônio',
    values: ['21,3%','18,5%','62,4%','23,1%','14,2%','16,8%'],
    best: 2,
  },
  {
    label: 'Dividend Yield', sub: 'Rendimento de Dividendos',
    values: ['12,4%','9,1%','9,8%','7,4%','8,3%','8,0%'],
    best: 0,
  },
  {
    label: 'Margem Líquida', sub: 'Margem de Lucro Líquido',
    values: ['38,4%','22,1%','44,7%','18,3%','19,6%','21,5%'],
    best: 2,
  },
  {
    label: 'ROIC', sub: 'Retorno sobre Capital Investido',
    values: ['17,8%','14,2%','48,7%','16,1%','10,3%','13,4%'],
    best: 2,
  },
  {
    label: 'Dív.Líq./EBITDA', sub: 'Dívida Líquida sobre EBITDA',
    values: ['0,8','1,1','0,0','0,5','1,4','1,2'],
    best: 2,
  },
]

function CompanyCard({ ticker, full, sector, size, sizeColor, initials, bg, price, industry, location, employees }: typeof TOP3[0]) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${bg} text-sm font-semibold text-primary-foreground`}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-foreground">{ticker}</span>
            <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">{sector}</span>
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${sizeColor}`}>{size}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground truncate">{full}</p>
          <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{price}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p>{industry}</p>
        <p>{location}</p>
        <p>{employees}</p>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-border py-2 text-xs font-medium text-foreground">
        Ver análise completa
      </div>
    </div>
  )
}

export function FeaturesComparisonSection() {
  return (
    <section className="bg-surface py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-brand-subtle text-brand">Comparador inteligente</Badge>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            Compare até 6 ações lado a lado
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Veja qual ativo tem melhor P/L, ROE, DY, margem e muito mais — rankeados automaticamente com médias históricas de 7 anos.
          </p>
        </div>

        <PreviewShell path="/compara-acoes/TAEE11/BBAS3/ITSA4/BBSE3/SAPR11/CPLE6">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {/* Page header */}
          <div className="border-b border-border px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="font-semibold text-foreground">Comparação de ações</h3>
            </div>
            {/* Breadcrumb */}
            <div className="flex flex-wrap items-center gap-1.5">
              {TICKERS_BREADCRUMB.map((t, i) => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className="rounded border border-border bg-surface px-2 py-0.5 text-xs font-semibold text-foreground">{t}</span>
                  {i < TICKERS_BREADCRUMB.length - 1 && <span className="text-xs text-muted-foreground">→</span>}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Análise comparativa detalhada entre {TICKERS_BREADCRUMB.length} ações da B3</p>
          </div>

          {/* Top 3 podium */}
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
            {TOP3.map((company, i) => {
              const medal = MEDALS[i]
              return (
                <div key={company.ticker} className={`relative overflow-hidden rounded-lg border-2 ${medal.border} ${medal.bg}`}>
                  <div className={`flex items-center justify-between border-b ${medal.border} px-4 py-2`}>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${medal.badgeBg} ${medal.badgeText}`}>
                      {medal.label}
                    </span>
                  </div>
                  <div className="p-4">
                    <CompanyCard {...company} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Other 3 */}
          <div className="grid grid-cols-1 gap-4 border-t border-border p-5 md:grid-cols-3">
            {OTHERS.map((company) => (
              <CompanyCard key={company.ticker} {...company} />
            ))}
          </div>

          {/* Detailed comparison table */}
          <div className="border-t border-border p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">↕</span>
                <h4 className="font-semibold text-foreground">Comparação detalhada</h4>
              </div>
              <span className="rounded-full border border-positive/40 bg-positive-subtle px-2.5 py-0.5 text-xs font-medium text-positive">
                Ranking por Médias Históricas
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground w-36">Indicador</th>
                    {TICKERS_BREADCRUMB.map((t) => (
                      <th key={t} className="px-3 py-2 text-center text-xs font-semibold text-foreground">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TABLE_ROWS.map((row) => (
                    <tr key={row.label} className="border-b border-border">
                      <td className="py-3 pr-4">
                        <p className="text-xs font-semibold text-foreground">{row.label}</p>
                        <p className="text-xs text-muted-foreground">{row.sub}</p>
                      </td>
                      {row.values.map((v, i) => (
                        <td key={i} className="px-3 py-3 text-center">
                          <div className={`inline-flex items-center gap-1 ${i === row.best ? 'font-semibold text-positive' : 'text-foreground'}`}>
                            {v}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
