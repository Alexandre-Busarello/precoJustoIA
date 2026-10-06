'use client'

import Link from 'next/link'
import { CompanyLogo } from '@/components/company-logo'
import { cn } from '@/lib/utils'

/** Rota da página do ativo pelo tipo (`STOCK`, `FII`, `ETF`, `BDR`). Sem tipo, `/acao/` — a página redireciona se for outro. */
export function assetHref(ticker: string, assetType?: string | null): string {
  const slug = ticker.toLowerCase()
  switch (assetType?.toUpperCase()) {
    case 'FII':
      return `/fii/${slug}`
    case 'ETF':
      return `/etf/${slug}`
    case 'BDR':
      return `/bdr/${slug}`
    default:
      return `/acao/${slug}`
  }
}

interface AssetCellProps {
  ticker: string
  /** Segunda linha, truncada: normalmente o nome da empresa/fundo (ou um contexto curto, como a origem). */
  name?: string | null
  logoUrl?: string | null
  /** Página do ativo. Sem `href`, a célula é só informativa (sem link). */
  href?: string
  /** Largura máxima e afins (o nome trunca dentro dela). Padrão: `max-w-44 sm:max-w-56`. */
  className?: string
}

/**
 * Célula de ativo para listas e tabelas: logo (ou monograma) + ticker + nome truncado, como link para a página do
 * ativo. O clique não propaga para o `onRowClick`/expansão da `DataTable`.
 */
export function AssetCell({ ticker, name: rawName, logoUrl, href, className }: AssetCellProps) {
  // Alguns cadastros (ex.: backtests antigos) guardam o ticker como nome: não repete a mesma linha.
  const name = rawName && rawName.trim().toUpperCase() !== ticker.toUpperCase() ? rawName : null
  const content = (
    <>
      <CompanyLogo
        logoUrl={logoUrl}
        companyName={name || ticker}
        ticker={ticker}
        size={32}
        sizeClassName="size-7 sm:size-8"
        decorative
        className="border border-border p-0.5"
      />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block font-medium text-foreground underline-offset-4 group-hover/asset:underline">{ticker}</span>
        {name && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{name}</span>}
      </span>
    </>
  )
  const base = cn('group/asset flex min-h-11 min-w-0 max-w-44 items-center gap-2.5 text-left sm:max-w-56', className)

  if (!href) return <div className={base}>{content}</div>

  return (
    <Link
      href={href}
      prefetch={false}
      onClick={(e) => e.stopPropagation()}
      className={cn(base, 'rounded-md focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none')}
    >
      {content}
    </Link>
  )
}
