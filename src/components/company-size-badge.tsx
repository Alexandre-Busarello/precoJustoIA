import { Badge } from '@/components/ui/badge'
import { Building2, TrendingUp, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompanySizeBadgeProps {
  marketCap: number | null
  className?: string
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
}

// Função para determinar o tamanho da empresa
function getCompanySize(marketCap: number | null): 'small_caps' | 'mid_caps' | 'blue_chips' | null {
  if (!marketCap) return null;
  
  // Valores em bilhões de reais
  const marketCapBillions = marketCap / 1_000_000_000;
  
  if (marketCapBillions < 2) {
    return 'small_caps'; // Menos de R$ 2 bilhões
  } else if (marketCapBillions >= 2 && marketCapBillions < 10) {
    return 'mid_caps'; // R$ 2-10 bilhões
  } else {
    return 'blue_chips'; // Mais de R$ 10 bilhões
  }
}

// Configurações para cada tamanho de empresa
const sizeConfig = {
  small_caps: {
    label: 'Small Caps',
    fullLabel: 'Small Caps',
    description: 'Menos de R$ 2 bi',
    icon: Zap,
    variant: 'secondary' as const,
    className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800'
  },
  mid_caps: {
    label: 'Mid Caps',
    fullLabel: 'Mid Caps',
    description: 'R$ 2 - 10 bi',
    icon: TrendingUp,
    variant: 'secondary' as const,
    className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  },
  blue_chips: {
    label: 'Large Caps',
    fullLabel: 'Large Caps',
    description: 'Mais de R$ 10 bi',
    icon: Building2,
    variant: 'secondary' as const,
    className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
  }
}

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5'
}

export function CompanySizeBadge({ 
  marketCap, 
  className, 
  showIcon = true, 
  size = 'md' 
}: CompanySizeBadgeProps) {
  const companySize = getCompanySize(marketCap)
  
  if (!companySize) {
    return null
  }
  
  const config = sizeConfig[companySize]
  const Icon = config.icon
  
  return (
    <Badge 
      variant={config.variant}
      className={cn(
        config.className,
        sizeClasses[size],
        'font-medium whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1',
        className
      )}
      title={`${config.fullLabel} - ${config.description}`}
    >
      {showIcon && <Icon className={cn(
        size === 'sm' ? 'w-3 h-3' : 
        size === 'md' ? 'w-3.5 h-3.5' : 
        'w-4 h-4'
      )} />}
      <span className="truncate">{config.label}</span>
    </Badge>
  )
}

// Função utilitária para obter informações do tamanho da empresa
export function getCompanySizeInfo(marketCap: number | null) {
  const companySize = getCompanySize(marketCap)
  return companySize ? sizeConfig[companySize] : null
}

// Função utilitária para formatação de market cap
export function formatMarketCap(marketCap: number | null): string {
  if (!marketCap) return 'N/A'
  
  const billions = marketCap / 1_000_000_000
  
  if (billions >= 1) {
    return `R$ ${billions.toFixed(1)}B`
  } else {
    const millions = marketCap / 1_000_000
    return `R$ ${millions.toFixed(0)}M`
  }
}
