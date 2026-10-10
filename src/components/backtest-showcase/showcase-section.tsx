import type { ReactNode } from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/ui/section-header'
import { getShowcaseResults } from '@/lib/backtest-showcase/cache'
import { cn } from '@/lib/utils'
import { ShowcaseCard, type ShowcaseViewer } from './showcase-card'
import { SHOWCASE_METHOD_HREF } from './showcase-disclosure'
import { ShowcaseStrip } from './showcase-strip'

/**
 * Seção com os três cards (servidor). Sem vitrine completa, não renderiza nada: a página segue sem o bloco.
 * Use dentro de `<Suspense>` para não segurar o resto da página no primeiro cálculo.
 */
export async function BacktestShowcaseSection({ viewer, className }: { viewer: ShowcaseViewer; className?: string }) {
  const block = await getShowcaseResults()
  if (!block) return null
  return (
    <section aria-labelledby="backtest-showcase-title" className={cn('border-b border-border py-12 sm:py-16', className)}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="backtest-showcase-title"
          title="Três backtests com dados reais"
          description="Carteiras fixas, definidas antes de ver qualquer resultado e mostradas sempre juntas, inclusive quando rendem menos que o CDI."
          actions={
            <Link
              href={SHOWCASE_METHOD_HREF}
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline md:min-h-8"
            >
              Regras da vitrine
            </Link>
          }
        />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {block.items.map((item) => (
            <ShowcaseCard key={item.id} item={item} block={block} viewer={viewer} />
          ))}
        </div>
      </div>
    </section>
  )
}

/** Faixa compacta (servidor); sem vitrine completa, mostra `fallback` (ou nada). */
export async function BacktestShowcaseStrip({
  fallback = null,
  headingLevel,
  className,
}: {
  fallback?: ReactNode
  headingLevel?: 'h2' | 'h3'
  className?: string
}) {
  const block = await getShowcaseResults()
  if (!block) return <>{fallback}</>
  return <ShowcaseStrip block={block} headingLevel={headingLevel} className={className} />
}
