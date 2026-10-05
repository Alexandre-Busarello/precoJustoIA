'use client'

/** Análise em texto da simulação de dívida (Premium). A IA só é chamada quando o usuário clica em "Gerar análise". */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { MarkdownRenderer } from '@/components/markdown-renderer'

interface AIAnalysisSectionProps {
  simulationResults: any
  debtData: any
  monthlyBudget: number
  investmentSplit: number
  rentabilityRate: number
  rentabilitySource: string
}

export function AIAnalysisSection({
  simulationResults,
  debtData,
  monthlyBudget,
  investmentSplit,
  rentabilityRate,
  rentabilitySource
}: AIAnalysisSectionProps) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false)
  const { toast } = useToast()

  const handleGenerateAnalysis = async () => {
    setIsLoadingAnalysis(true)
    try {
      const response = await fetch('/api/simulation/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debtName: debtData.name || 'Dívida',
          initialDebtBalance: debtData.balance,
          debtAnnualRate: debtData.interestRateAnnual,
          monthlyPayment: debtData.monthlyPayment,
          monthlyBudget,
          investmentSplit,
          rentabilityRate,
          rentabilitySource,
          sniperResults: {
            breakEvenMonth: simulationResults.sniper.breakEvenMonth,
            finalDebtBalance: simulationResults.sniper.finalDebtBalance,
            finalInvestedBalance: simulationResults.sniper.finalInvestedBalance,
            finalNetWorth: simulationResults.sniper.finalNetWorth,
            totalInterestPaid: simulationResults.sniper.totalInterestPaid,
            totalInvestmentContribution: simulationResults.sniper.totalInvestmentContribution,
            totalInvestmentReturn: simulationResults.sniper.totalInvestmentReturn
          },
          hybridResults: {
            breakEvenMonth: simulationResults.hybrid.breakEvenMonth,
            finalDebtBalance: simulationResults.hybrid.finalDebtBalance,
            finalInvestedBalance: simulationResults.hybrid.finalInvestedBalance,
            finalNetWorth: simulationResults.hybrid.finalNetWorth,
            totalInterestPaid: simulationResults.hybrid.totalInterestPaid,
            totalInvestmentContribution: simulationResults.hybrid.totalInvestmentContribution,
            totalInvestmentReturn: simulationResults.hybrid.totalInvestmentReturn
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Não foi possível gerar a análise.')
      }

      const data = await response.json()
      setAnalysis(data.analysis)
    } catch (error: any) {
      toast({
        title: 'Não foi possível gerar a análise',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsLoadingAnalysis(false)
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <SectionHeader
        title="Análise da simulação por IA"
        description="Leitura em texto dos resultados, gerada por IA a partir dos números acima. É uma estimativa, não recomendação de investimento."
        actions={
          !analysis && (
            <Button onClick={handleGenerateAnalysis} disabled={isLoadingAnalysis} variant="outline" size="sm">
              {isLoadingAnalysis && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
              {isLoadingAnalysis ? 'Gerando análise' : 'Gerar análise'}
            </Button>
          )
        }
      />
      {isLoadingAnalysis ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ) : (
        analysis && (
          <MarkdownRenderer content={analysis} className="text-sm" />
        )
      )}
    </section>
  )
}
