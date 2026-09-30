import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Stat, type StatProps } from '@/components/ui/stat'
import { CompanyLogo } from '@/components/company-logo'

export type AssetPriceStat = Pick<StatProps, 'label' | 'value' | 'delta' | 'deltaLabel' | 'hint' | 'caption' | 'tone'>

export interface AssetPriceHeaderProps {
  ticker: string
  name: string
  /** Nome da página ao lado do ticker (ex.: "Análise técnica"). */
  pageLabel: string
  /** Linha abaixo do título (ex.: nome da empresa · setor). */
  subtitle?: string
  logoUrl?: string | null
  back?: { href: string; label: string }
  /** Até 4 indicadores de preço (2 × 2 no mobile, 4 colunas no desktop). */
  stats: AssetPriceStat[]
  /** Conteúdo extra abaixo do subtítulo (ex.: link para o ticker anterior). */
  children?: React.ReactNode
  className?: string
}

/**
 * Cabeçalho das subpáginas de ativo (análise técnica, radar de dividendos): mesmo formato do AssetHeader
 * (logo 40 px, ticker que nunca trunca, linha de indicadores), mas só com dados de preço/proventos.
 */
export function AssetPriceHeader({
  ticker,
  name,
  pageLabel,
  subtitle,
  logoUrl,
  back,
  stats,
  children,
  className,
}: AssetPriceHeaderProps) {
  return (
    <section aria-label={`${pageLabel} de ${ticker}`} className={cn('space-y-4', className)}>
      {back && (
        <Link
          href={back.href}
          className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none md:min-h-8"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex items-start gap-3">
        <CompanyLogo logoUrl={logoUrl ?? null} companyName={name} ticker={ticker} size={40} />
        <div className="min-w-0 flex-1">
          <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="shrink-0 text-2xl font-semibold tracking-tight text-foreground">{ticker}</span>
            <span className="text-base font-normal text-muted-foreground">{pageLabel}</span>
          </h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle ?? name}</p>
          {children && <div className="mt-1">{children}</div>}
        </div>
      </div>
      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
          {stats.slice(0, 4).map((stat, index) => (
            <Stat key={index} {...stat} />
          ))}
        </div>
      )}
    </section>
  )
}
