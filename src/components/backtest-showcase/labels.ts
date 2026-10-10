/** Rótulos da vitrine (sem React): usados pelo card, pela faixa compacta e pela metodologia. */
import { formatBRL, formatPct } from '@/lib/format'
import type { ShowcaseSummary } from '@/lib/backtest-showcase/summary'

/** "R$ 1.000/mês, sem capital inicial", "R$ 10.000 iniciais, sem aportes" ou "R$ 10.000 iniciais + R$ 1.000/mês". */
export function showcaseMoneyLabel(item: Pick<ShowcaseSummary, 'initialCapital' | 'monthlyContribution'>): string {
  const initial = formatBRL(item.initialCapital, { digits: 0 })
  const monthly = `${formatBRL(item.monthlyContribution, { digits: 0 })}/mês`
  if (item.initialCapital <= 0) return `${monthly}, sem capital inicial`
  if (item.monthlyContribution <= 0) return `${initial} iniciais, sem aportes`
  return `${initial} iniciais + ${monthly}`
}

/** "BOVA11, 100%" ou "PETR4, VALE3, ITUB4, WEGE3 e BBAS3, 20% cada". */
export function showcaseCompositionLabel(item: Pick<ShowcaseSummary, 'tickers' | 'allocations'>): string {
  if (item.tickers.length === 1) return `${item.tickers[0]}, ${formatPct(item.allocations[0] ?? 1, { digits: 0 })}`
  const names = `${item.tickers.slice(0, -1).join(', ')} e ${item.tickers[item.tickers.length - 1]}`
  const equal = item.allocations.every((weight) => Math.abs(weight - item.allocations[0]) < 0.0001)
  return equal
    ? `${names}, ${formatPct(item.allocations[0], { digits: 0 })} cada`
    : item.tickers.map((ticker, index) => `${ticker} ${formatPct(item.allocations[index], { digits: 0 })}`).join(', ')
}
