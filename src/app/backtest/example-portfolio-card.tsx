import { formatBRL, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EXAMPLE_YEARS, buildExampleConfig } from './backtest-utils'

/** Resumo estático da carteira de exemplo que abre a ferramenta (landing e card de upgrade). */
export function ExamplePortfolioCard({ className }: { className?: string }) {
  const example = buildExampleConfig()

  return (
    <div className={cn('rounded-lg border border-border bg-card p-5', className)}>
      <p className="text-sm font-medium text-foreground">Carteira de exemplo</p>
      <p className="mt-1 text-sm text-muted-foreground">A ferramenta já abre com esta carteira. Troque os ativos quando quiser.</p>

      <ul className="mt-4 divide-y divide-border border-y border-border text-sm">
        {example.assets.map((asset) => (
          <li key={asset.ticker} className="flex items-center justify-between py-2">
            <span className="font-medium text-foreground">{asset.ticker}</span>
            <span className="tabular-nums text-muted-foreground">{formatPct(asset.allocation, { digits: 0 })}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Período</dt>
          <dd className="text-foreground">Últimos {EXAMPLE_YEARS} anos</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Capital inicial</dt>
          <dd className="tabular-nums text-foreground">{formatBRL(example.initialCapital)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Aporte mensal</dt>
          <dd className="text-foreground">Sem aportes</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Rebalanceamento</dt>
          <dd className="text-foreground">Mensal</dd>
        </div>
      </dl>
    </div>
  )
}
