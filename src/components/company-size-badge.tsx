import { Badge } from '@/components/ui/badge'
import { formatBRLCompact } from '@/lib/format'

interface CompanySizeBadgeProps {
  marketCap: number | null
  className?: string
  /** Mantido por compatibilidade; o badge não usa mais ícone. */
  showIcon?: boolean
  /** Mantido por compatibilidade; o badge tem tamanho único. */
  size?: 'sm' | 'md' | 'lg'
}

type CompanySize = 'small_caps' | 'mid_caps' | 'blue_chips'

// Faixas de valor de mercado em reais
function getCompanySize(marketCap: number | null): CompanySize | null {
  if (!marketCap) return null
  const marketCapBillions = marketCap / 1_000_000_000
  if (marketCapBillions < 2) return 'small_caps'
  if (marketCapBillions < 10) return 'mid_caps'
  return 'blue_chips'
}

const sizeConfig: Record<CompanySize, { label: string; fullLabel: string; description: string }> = {
  small_caps: { label: 'Small cap', fullLabel: 'Small cap', description: 'Menos de R$ 2 bi' },
  mid_caps: { label: 'Mid cap', fullLabel: 'Mid cap', description: 'R$ 2 bi a R$ 10 bi' },
  blue_chips: { label: 'Large cap', fullLabel: 'Large cap', description: 'Mais de R$ 10 bi' },
}

/** Porte da empresa pelo valor de mercado (Badge neutro). */
export function CompanySizeBadge({ marketCap, className }: CompanySizeBadgeProps) {
  const companySize = getCompanySize(marketCap)
  if (!companySize) return null
  const config = sizeConfig[companySize]

  return (
    <Badge variant="neutral" className={className}>
      <span>{config.label}</span>
      <span className="sr-only"> ({config.description})</span>
    </Badge>
  )
}

/** Informações do porte da empresa (rótulo e faixa), ou `null` sem valor de mercado. */
export function getCompanySizeInfo(marketCap: number | null) {
  const companySize = getCompanySize(marketCap)
  return companySize ? sizeConfig[companySize] : null
}

/** Valor de mercado compacto em pt-BR (`R$ 625,7 bi`); `—` sem dado. */
export function formatMarketCap(marketCap: number | null): string {
  return formatBRLCompact(marketCap || null)
}
