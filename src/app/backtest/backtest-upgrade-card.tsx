import Link from 'next/link'
import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExamplePortfolioCard } from './example-portfolio-card'

const BENEFITS = [
  'Simulação com cotações históricas das ações da B3',
  'Aportes mensais e rebalanceamento mensal, trimestral ou anual',
  'Comparação com CDI e Ibovespa no mesmo período',
  'Volatilidade, Sharpe, drawdown e resultado por ativo',
]

/** Card inline para usuário logado sem Premium (substitui o antigo redirecionamento para o dashboard). */
export function BacktestUpgradeCard() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <section aria-labelledby="backtest-upgrade-title" className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <Badge variant="brand">Premium</Badge>
        <h2 id="backtest-upgrade-title" className="mt-3 text-lg font-semibold tracking-tight text-foreground">
          O backtest faz parte do plano Premium
        </h2>
        <p className="mt-1 max-w-[60ch] text-sm leading-6 text-muted-foreground">
          Veja como uma carteira teria se comportado no passado antes de montar a sua estratégia.
        </p>
        <ul className="mt-4 space-y-2">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              {benefit}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/planos">Conhecer o Premium</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/ranking">Ver rankings</Link>
          </Button>
        </div>
      </section>
      <ExamplePortfolioCard />
    </div>
  )
}
