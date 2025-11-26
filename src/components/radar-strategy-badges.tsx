'use client'

import { Badge } from '@/components/ui/badge'
import { StrategyAnalysis } from '@/lib/strategies'
import { cn } from '@/lib/utils'

interface RadarStrategyBadgesProps {
  strategies: {
    graham?: StrategyAnalysis | null
    barsi?: StrategyAnalysis | null
    dividendYield?: StrategyAnalysis | null
    lowPE?: StrategyAnalysis | null
    magicFormula?: StrategyAnalysis | null
    fcd?: StrategyAnalysis | null
    gordon?: StrategyAnalysis | null
    fundamentalist?: StrategyAnalysis | null
  }
  className?: string
  compact?: boolean
}

const strategyLabels: Record<string, string> = {
  graham: 'Graham',
  barsi: 'Bazin',
  dividendYield: 'DY',
  lowPE: 'Low P/E',
  magicFormula: 'MF',
  fcd: 'FCD',
  gordon: 'Gordon',
  fundamentalist: 'Fund',
}

export function RadarStrategyBadges({
  strategies,
  className,
  compact = false,
}: RadarStrategyBadgesProps) {
  const strategyList = [
    { key: 'graham', analysis: strategies.graham },
    { key: 'barsi', analysis: strategies.barsi },
    { key: 'dividendYield', analysis: strategies.dividendYield },
    { key: 'lowPE', analysis: strategies.lowPE },
    { key: 'magicFormula', analysis: strategies.magicFormula },
    { key: 'fcd', analysis: strategies.fcd },
    { key: 'gordon', analysis: strategies.gordon },
    { key: 'fundamentalist', analysis: strategies.fundamentalist },
  ].filter(item => item.analysis !== null && item.analysis !== undefined)

  if (strategyList.length === 0) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>
        Nenhuma estratégia
      </span>
    )
  }

  if (compact) {
    // Modo compacto: apenas contagem e cores
    const approvedCount = strategyList.filter(item => item.analysis?.isEligible).length
    const totalCount = strategyList.length

    return (
      <div className={cn('flex items-center gap-1', className)}>
        <span className="text-xs text-muted-foreground">
          {approvedCount}/{totalCount}
        </span>
        <div className="flex gap-0.5">
          {strategyList.map((item) => (
            <div
              key={item.key}
              className={cn(
                'w-2 h-2 rounded-full',
                item.analysis?.isEligible
                  ? 'bg-green-500'
                  : 'bg-red-500'
              )}
              title={`${strategyLabels[item.key]}: ${item.analysis?.isEligible ? 'Aprovado' : 'Reprovado'}`}
            />
          ))}
        </div>
      </div>
    )
  }

  // Modo completo: badges com nomes
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {strategyList.map((item) => (
        <Badge
          key={item.key}
          variant={item.analysis?.isEligible ? 'default' : 'destructive'}
          className={cn(
            'text-xs px-2 py-1',
            item.analysis?.isEligible
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white'
          )}
          title={`${strategyLabels[item.key]}: Score ${item.analysis?.score?.toFixed(0) || 0} - ${item.analysis?.isEligible ? 'Aprovado' : 'Reprovado'}`}
        >
          {strategyLabels[item.key]}
        </Badge>
      ))}
    </div>
  )
}

