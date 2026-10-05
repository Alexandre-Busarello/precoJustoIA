import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const HOLDINGS = [
  { ticker: 'TAEE11', qty: 292, avgPrice: 'R$34,20', currentPrice: 'R$38,10', value: 'R$11.125', returnPct: '+11,4%', returnColor: 'text-positive', dividends: 'R$482', alloc: 38, target: 40 },
  { ticker: 'BBAS3',  qty: 120, avgPrice: 'R$52,10', currentPrice: 'R$58,20', value: 'R$6.984',  returnPct: '+11,7%', returnColor: 'text-positive', dividends: 'R$210', alloc: 24, target: 25 },
  { ticker: 'ITSA4',  qty: 450, avgPrice: 'R$8,90',  currentPrice: 'R$9,40',  value: 'R$4.230',  returnPct: '+5,6%',  returnColor: 'text-positive', dividends: 'R$130', alloc: 14, target: 15 },
  { ticker: 'BBSE3',  qty: 200, avgPrice: 'R$33,20', currentPrice: 'R$31,10', value: 'R$6.220',  returnPct: '−6,3%',  returnColor: 'text-negative',   dividends: 'R$290', alloc: 21, target: 20 },
]

const METRICS = [
  { label: 'Valor Atual',        value: 'R$ 28.559', sub: 'Capital investido: R$ 27.040', color: 'text-foreground' },
  { label: 'Retorno Total',      value: '+5,6%',     sub: '+R$ 1.519 líquido', color: 'text-positive' },
  { label: 'Dividendos Recib.',  value: 'R$ 1.112',  sub: 'Renda passiva acumulada',  color: 'text-brand' },
  { label: 'Maior Queda (Max. Drawdown)', value: '−8,3%', sub: 'Pior período registrado', color: 'text-negative' },
  { label: 'Volatilidade',       value: '14,2%',     sub: 'Risco anualizado', color: 'text-warning' },
  { label: 'Índice Sharpe',      value: '0,94',      sub: 'Retorno ajustado ao risco', color: 'text-brand' },
]

export function FeaturesPortfolioSection() {
  return (
    <section className="bg-background py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-brand-subtle text-brand">Carteira inteligente</Badge>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            Controle sua carteira com IA — sem integração com a B3
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Importe compras e vendas em texto livre, acompanhe retorno, drawdown e volatilidade — e veja quanto cada ativo se afasta da sua alocação-alvo.
          </p>
        </div>

        <PreviewShell path="/carteira">
        <div className="overflow-hidden rounded-lg border border-border shadow-sm">
          {/* AI import input */}
          <div className="border-b border-border bg-surface px-5 py-4">
            <div className="mb-3 flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Texto inteligente — importe com IA</p>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground font-mono">
              Compra de 100 TAEE11 a R$ 34,20 cada em 10/01/2025
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Exemplos: &ldquo;Venda de 50 BBAS3 por R$ 58,00&rdquo; · &ldquo;Dividendo de TAEE11: R$ 1,12 por ação&rdquo; · &ldquo;Aporte de R$ 5.000 hoje&rdquo;
            </p>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3 border-b border-border p-5 md:grid-cols-3">
            {METRICS.map((m) => (
              <div key={m.label} className="rounded-lg border border-border bg-surface px-4 py-3">
                <p className={`text-lg font-semibold ${m.color}`}>{m.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Holdings table */}
          <div className="border-b border-border px-5 py-4">
            <p className="mb-3 text-xs font-semibold text-muted-foreground">Posições</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-medium text-muted-foreground">
                    <th className="pb-2 text-left">Ativo</th>
                    <th className="pb-2 text-right">Qtd.</th>
                    <th className="pb-2 text-right">Preço médio</th>
                    <th className="pb-2 text-right">Atual</th>
                    <th className="pb-2 text-right">Retorno</th>
                    <th className="pb-2 text-right">Dividendos</th>
                    <th className="pb-2 text-right">Alocação</th>
                  </tr>
                </thead>
                <tbody>
                  {HOLDINGS.map((h, i) => (
                    <tr key={h.ticker} className={i < HOLDINGS.length - 1 ? 'border-b border-border' : ''}>
                      <td className="py-2.5">
                        <span className="font-semibold text-foreground">{h.ticker}</span>
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">{h.qty}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{h.avgPrice}</td>
                      <td className="py-2.5 text-right font-medium text-foreground">{h.currentPrice}</td>
                      <td className={`py-2.5 text-right font-semibold ${h.returnColor}`}>{h.returnPct}</td>
                      <td className="py-2.5 text-right text-brand">{h.dividends}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${h.alloc > h.target ? 'bg-warning' : 'bg-brand'}`}
                              style={{ width: `${(h.alloc / 45) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-xs text-muted-foreground">{h.alloc}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rebalancing suggestion */}
          <div className="px-5 py-4">
            <div className="rounded-lg border border-brand/40 bg-brand-subtle p-4">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-sm font-semibold text-brand">Ajuste para sua alocação-alvo</p>
              </div>
              <p className="mb-3 text-xs text-brand">
                Sua carteira está levemente fora dos alvos que você definiu. Para voltar a eles:
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-foreground">Abaixo da meta</span>
                  <span className="text-foreground">+12 TAEE11 · ajusta para 40% alvo</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-foreground">Acima da meta</span>
                  <span className="text-foreground">−8 BBSE3 · ajusta para 20% alvo</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-surface px-5 py-2 text-right text-xs text-muted-foreground">
            Sem integração com B3 · Dados ilustrativos · Premium
          </div>
        </div>
        </PreviewShell>
      </div>
    </section>
  )
}
