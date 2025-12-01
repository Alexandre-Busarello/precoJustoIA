'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, DollarSign, Calendar, Target } from 'lucide-react'

interface SimulationSummaryProps {
  sniperResults: {
    breakEvenMonth: number | null
    finalDebtBalance: number
    finalInvestedBalance: number
    finalNetWorth: number
    totalInterestPaid: number
    totalInvestmentContribution: number
    totalInvestmentReturn: number
    totalMonths: number
  }
  hybridResults: {
    breakEvenMonth: number | null
    finalDebtBalance: number
    finalInvestedBalance: number
    finalNetWorth: number
    totalInterestPaid: number
    totalInvestmentContribution: number
    totalInvestmentReturn: number
    totalMonths: number
  }
  rentabilityRate: number
}

export function SimulationSummary({
  sniperResults,
  hybridResults,
  rentabilityRate
}: SimulationSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  // Determinar qual estratégia é melhor financeiramente
  const sniperBetter = sniperResults.finalNetWorth > hybridResults.finalNetWorth
  const interestSaved = hybridResults.totalInterestPaid - sniperResults.totalInterestPaid
  const netWorthDifference = Math.abs(sniperResults.finalNetWorth - hybridResults.finalNetWorth)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Resumo Comparativo das Estratégias
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Estratégia Recomendada */}
        <div className={`p-4 rounded-lg border-2 ${
          sniperBetter 
            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
            : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className={`h-5 w-5 ${sniperBetter ? 'text-green-600' : 'text-blue-600'}`} />
            <h3 className="font-semibold text-lg">
              {sniperBetter ? 'Estratégia Sniper Recomendada' : 'Estratégia Híbrida Recomendada'}
            </h3>
            <Badge variant={sniperBetter ? 'default' : 'secondary'}>
              Melhor Patrimônio Líquido
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {sniperBetter ? (
              <>
                A estratégia <strong>Sniper</strong> resulta em um patrimônio líquido final de{' '}
                <strong>{formatCurrency(sniperResults.finalNetWorth)}</strong>, que é{' '}
                <strong>{formatCurrency(netWorthDifference)}</strong> maior que a estratégia Híbrida.
                Além disso, você economiza <strong>{formatCurrency(interestSaved)}</strong> em juros pagos.
              </>
            ) : (
              <>
                A estratégia <strong>Híbrida</strong> resulta em um patrimônio líquido final de{' '}
                <strong>{formatCurrency(hybridResults.finalNetWorth)}</strong>, que é{' '}
                <strong>{formatCurrency(netWorthDifference)}</strong> maior que a estratégia Sniper.
                No entanto, você paga <strong>{formatCurrency(interestSaved)}</strong> a mais em juros.
              </>
            )}
          </p>
        </div>

        {/* Comparação Detalhada */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Estratégia Sniper */}
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                Estratégia Sniper
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Patrimônio Líquido Final</span>
                <span className={`font-semibold ${sniperBetter ? 'text-green-600' : ''}`}>
                  {formatCurrency(sniperResults.finalNetWorth)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Patrimônio Investido</span>
                <span className="font-medium">{formatCurrency(sniperResults.finalInvestedBalance)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Saldo Devedor Final</span>
                <span className="font-medium">{formatCurrency(sniperResults.finalDebtBalance)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total de Juros Pagos</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(sniperResults.totalInterestPaid)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Break-even</span>
                <span className="font-medium">
                  {sniperResults.breakEvenMonth 
                    ? `Mês ${formatNumber(sniperResults.breakEvenMonth)}`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Investido</span>
                <span className="font-medium">{formatCurrency(sniperResults.totalInvestmentContribution)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Retorno dos Investimentos</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(sniperResults.totalInvestmentReturn)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Estratégia Híbrida */}
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                Estratégia Híbrida
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Patrimônio Líquido Final</span>
                <span className={`font-semibold ${!sniperBetter ? 'text-green-600' : ''}`}>
                  {formatCurrency(hybridResults.finalNetWorth)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Patrimônio Investido</span>
                <span className="font-medium">{formatCurrency(hybridResults.finalInvestedBalance)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Saldo Devedor Final</span>
                <span className="font-medium">{formatCurrency(hybridResults.finalDebtBalance)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total de Juros Pagos</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(hybridResults.totalInterestPaid)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Break-even</span>
                <span className="font-medium">
                  {hybridResults.breakEvenMonth 
                    ? `Mês ${formatNumber(hybridResults.breakEvenMonth)}`
                    : 'Não atingido'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Investido</span>
                <span className="font-medium">{formatCurrency(hybridResults.totalInvestmentContribution)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Retorno dos Investimentos</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(hybridResults.totalInvestmentReturn)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Insights */}
        <div className="border-t pt-4 space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Insights Financeiros
          </h4>
          
          {/* Economia de Juros */}
          {interestSaved > 0 && (
            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm">
                <strong className="text-green-700 dark:text-green-300">
                  Economia de Juros com Sniper:
                </strong>{' '}
                <span className="text-green-600 dark:text-green-400">
                  {formatCurrency(interestSaved)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                A estratégia Sniper economiza esta quantia em juros pagos comparada à estratégia Híbrida.
                {sniperResults.finalInvestedBalance < hybridResults.finalInvestedBalance && (
                  <>
                    {' '}Embora o patrimônio investido final seja menor, a economia em juros compensa essa diferença,
                    resultando em um patrimônio líquido maior.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Explicação sobre acumular menos */}
          {sniperResults.finalInvestedBalance < hybridResults.finalInvestedBalance && sniperResults.finalNetWorth > hybridResults.finalNetWorth && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm">
                <strong className="text-blue-700 dark:text-blue-300">
                  Por que acumular menos pode ser melhor?
                </strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                A estratégia Sniper acumula menos patrimônio investido ({formatCurrency(sniperResults.finalInvestedBalance)} vs {formatCurrency(hybridResults.finalInvestedBalance)}),
                mas resulta em um <strong>patrimônio líquido maior</strong> ({formatCurrency(sniperResults.finalNetWorth)} vs {formatCurrency(hybridResults.finalNetWorth)}).
                Isso acontece porque ao quitar a dívida mais rápido, você economiza {formatCurrency(interestSaved)} em juros,
                compensando a diferença de investimento. O importante é o <strong>patrimônio líquido final</strong>, não apenas o investido.
              </p>
            </div>
          )}

          {/* Comparação de Break-even */}
          {sniperResults.breakEvenMonth && hybridResults.breakEvenMonth && (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-sm">
                <strong className="text-purple-700 dark:text-purple-300">
                  Break-even Point:
                </strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                A estratégia <strong>Sniper</strong> atinge o break-even no mês {formatNumber(sniperResults.breakEvenMonth)},
                enquanto a estratégia <strong>Híbrida</strong> atinge no mês {formatNumber(hybridResults.breakEvenMonth)}.
                {sniperResults.breakEvenMonth < hybridResults.breakEvenMonth ? (
                  <> A estratégia Sniper atinge a liberdade financeira técnica {formatNumber(hybridResults.breakEvenMonth - sniperResults.breakEvenMonth)} meses antes.</>
                ) : (
                  <> A estratégia Híbrida atinge a liberdade financeira técnica {formatNumber(sniperResults.breakEvenMonth - hybridResults.breakEvenMonth)} meses antes.</>
                )}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

