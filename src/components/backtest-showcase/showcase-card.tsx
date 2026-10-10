import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Stat } from '@/components/ui/stat'
import { formatBRL, formatDeltaPct, formatPct } from '@/lib/format'
import { showcaseCompositionLabel, showcaseMoneyLabel } from './labels'
import { cn } from '@/lib/utils'
import { rebalanceLabel } from '@/lib/backtest/quick-backtest'
import { formatShowcasePeriod, type ShowcaseBlock, type ShowcaseSummary } from '@/lib/backtest-showcase/summary'
import { OpenInBacktestButton } from './open-in-backtest-button'
import { ShowcaseChart } from './showcase-chart'
import { ShowcaseDisclosure } from './showcase-disclosure'

export type ShowcaseViewer = 'anon' | 'free' | 'premium'

export const SHOWCASE_REGISTER_HREF = '/register?returnUrl=/backtest'

function rebalanceText(item: Pick<ShowcaseSummary, 'tickers' | 'rebalanceFrequency'>): string {
  return item.tickers.length === 1 ? 'um só ativo, sem rebalanceamento' : rebalanceLabel(item.rebalanceFrequency)
}

function toneOf(value: number): 'positive' | 'negative' | 'default' {
  const rounded = Math.round(value * 1000)
  return rounded > 0 ? 'positive' : rounded < 0 ? 'negative' : 'default'
}

function ShowcaseCta({ item, viewer }: { item: ShowcaseSummary; viewer: ShowcaseViewer }) {
  if (viewer === 'premium') {
    return (
      <OpenInBacktestButton
        title={item.title}
        tickers={item.tickers}
        initialCapital={item.initialCapital}
        monthlyContribution={item.monthlyContribution}
        rebalanceFrequency={item.rebalanceFrequency}
      />
    )
  }
  const cta = viewer === 'free' ? { href: '/planos', label: 'Ver planos' } : { href: SHOWCASE_REGISTER_HREF, label: 'Criar conta grátis' }
  return (
    <Button variant="outline" asChild className="w-full sm:w-auto">
      <Link href={cta.href}>{cta.label}</Link>
    </Button>
  )
}

interface ShowcaseCardProps {
  item: ShowcaseSummary
  block: Pick<ShowcaseBlock, 'computedAt' | 'shortenedWindow'>
  viewer: ShowcaseViewer
  className?: string
}

/** Uma vitrine: o que foi simulado, 4 números, queda máxima, gráfico, rodapé obrigatório e a próxima ação. */
export function ShowcaseCard({ item, block, viewer, className }: ShowcaseCardProps) {
  const titleId = `showcase-${item.id}`
  return (
    <article aria-labelledby={titleId} className={cn('flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-5', className)}>
      <header className="space-y-1">
        <h3 id={titleId} className="text-base font-semibold tracking-tight text-foreground">
          {item.title}
        </h3>
        <p className="text-sm text-muted-foreground">{item.why}</p>
        <p className="text-xs leading-5 text-muted-foreground">
          <span className="tabular-nums text-foreground">{formatShowcasePeriod(item.firstMonth, item.lastMonth)}</span>
          <span aria-hidden="true"> · </span>
          <span className="tabular-nums">{showcaseMoneyLabel(item)}</span>
          <span aria-hidden="true"> · </span>
          <span>{rebalanceText(item)}</span>
          <span aria-hidden="true"> · </span>
          <span className="tabular-nums">{showcaseCompositionLabel(item)}</span>
        </p>
      </header>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
          <Stat
            size="sm"
            className="bg-card p-3"
            label="Valor final"
            value={formatBRL(item.finalValue, { digits: 0 })}
            caption={
              // Curto para caber em 320 px sem cortar o valor (a legenda do Stat trunca): "de R$ 60.000"
              <span className="tabular-nums">
                de {formatBRL(item.totalInvested, { digits: 0 })}
                <span className="sr-only"> aportados</span>
              </span>
            }
          />
          <Stat
            size="sm"
            className="bg-card p-3"
            label="Retorno"
            value={formatDeltaPct(item.totalReturn)}
            tone={toneOf(item.totalReturn)}
            caption={<span className="tabular-nums">{formatDeltaPct(item.annualizedReturn)} ao ano</span>}
            hint="Retorno no período: (valor final − aportado) ÷ aportado. Ao ano: retorno composto medido pela cota, sem o efeito dos aportes."
          />
          <Stat
            size="sm"
            className="bg-card p-3"
            label="No CDI"
            value={formatBRL(item.cdiFinalValue, { digits: 0 })}
            caption={<span className="tabular-nums">{formatDeltaPct(item.cdiReturn)}</span>}
            hint="O mesmo dinheiro, nas mesmas datas, aplicado no CDI."
          />
          <Stat
            size="sm"
            className="bg-card p-3"
            label="No Ibovespa"
            value={formatBRL(item.ibovFinalValue, { digits: 0 })}
            caption={<span className="tabular-nums">{formatDeltaPct(item.ibovReturn)}</span>}
            hint="O mesmo dinheiro, nas mesmas datas, no Ibovespa. É um índice de preço, sem dividendos."
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Queda máxima de <span className="font-medium tabular-nums text-foreground">{formatPct(item.maxDrawdown)}</span> do pico ao vale
          <span aria-hidden="true"> · </span>
          volatilidade de <span className="tabular-nums">{formatPct(item.volatility)}</span> ao ano
        </p>
      </div>

      <ShowcaseChart series={item.series} title={item.title} />

      <ShowcaseDisclosure
        computedAt={block.computedAt}
        tradingCostRate={item.tradingCostRate}
        totalTradingCosts={item.totalTradingCosts}
        shortenedWindow={block.shortenedWindow}
        className="mt-auto border-t border-border pt-3"
      />

      <ShowcaseCta item={item} viewer={viewer} />
    </article>
  )
}
