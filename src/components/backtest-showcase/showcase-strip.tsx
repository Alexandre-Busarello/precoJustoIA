import { formatDeltaPct, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { formatShowcasePeriod, type ShowcaseBlock } from '@/lib/backtest-showcase/summary'
import { showcaseMoneyLabel } from './labels'
import { ShowcaseDisclosure } from './showcase-disclosure'

function toneClass(value: number): string {
  const rounded = Math.round(value * 1000)
  return rounded > 0 ? 'text-positive' : rounded < 0 ? 'text-negative' : 'text-foreground'
}

/** Mesmo período para todas as carteiras: "out. 2021 a set. 2026". */
function blockPeriod(block: ShowcaseBlock): string {
  const first = block.items[0]
  return formatShowcasePeriod(first.firstMonth, first.lastMonth)
}

interface ShowcaseStripProps {
  block: ShowcaseBlock
  /** Nível do título (padrão h3). */
  headingLevel?: 'h2' | 'h3'
  className?: string
}

/** Faixa compacta da vitrine: as três carteiras, sempre juntas, com retorno, CDI e queda máxima. */
export function ShowcaseStrip({ block, headingLevel: Heading = 'h3', className }: ShowcaseStripProps) {
  const first = block.items[0]
  return (
    <section aria-labelledby="showcase-strip-title" className={cn('min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5', className)}>
      <Heading id="showcase-strip-title" className="text-sm font-medium text-foreground">
        Backtests de exemplo com dados reais
      </Heading>
      <p className="mt-1 text-sm text-muted-foreground">
        <span className="tabular-nums">{blockPeriod(block)}</span>. Carteiras fixas, mostradas sempre juntas.
      </p>

      <ul className="mt-3 divide-y divide-border border-y border-border">
        {block.items.map((item) => (
          <li key={item.id} className="py-3">
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            <p className="text-xs tabular-nums text-muted-foreground">{showcaseMoneyLabel(item)}</p>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Retorno</dt>
                <dd className={cn('font-medium tabular-nums', toneClass(item.totalReturn))}>{formatDeltaPct(item.totalReturn)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">CDI</dt>
                <dd className="tabular-nums text-foreground">{formatDeltaPct(item.cdiReturn)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Queda máxima</dt>
                <dd className="tabular-nums text-foreground">{formatPct(item.maxDrawdown)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <ShowcaseDisclosure
        computedAt={block.computedAt}
        tradingCostRate={first.tradingCostRate}
        shortenedWindow={block.shortenedWindow}
        mentionsIbovespa={false}
        className="mt-3"
      />
    </section>
  )
}
