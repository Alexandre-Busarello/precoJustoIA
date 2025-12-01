'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'
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
        throw new Error(error.error || 'Erro ao gerar análise')
      }

      const data = await response.json()
      setAnalysis(data.analysis)
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsLoadingAnalysis(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Consultor AI - Análise Personalizada</CardTitle>
          </div>
          {!analysis && (
            <Button
              onClick={handleGenerateAnalysis}
              disabled={isLoadingAnalysis}
              variant="outline"
              size="sm"
            >
              {isLoadingAnalysis ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando análise...
                </>
              ) : (
                'Gerar Análise com IA'
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingAnalysis ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground">Gerando análise personalizada...</span>
          </div>
        ) : analysis ? (
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <MarkdownRenderer content={analysis} />
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Obtenha uma análise detalhada e personalizada dos resultados da sua simulação,
              com recomendações práticas baseadas em inteligência artificial.
            </p>
            <Button
              onClick={handleGenerateAnalysis}
              disabled={isLoadingAnalysis}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Gerar Análise com IA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

