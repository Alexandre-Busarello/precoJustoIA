'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  DollarSign, 
  Building2,
  Target,
  Info,
  Percent
} from 'lucide-react'

// Tipos
interface ComprehensiveFinancialViewProps {
  data: {
    company: {
      ticker: string
      name: string
      sector: string | null
      industry: string | null
    }
    financialData: Record<string, unknown>[]
    balanceSheets: Record<string, unknown>[]
    incomeStatements: Record<string, unknown>[]
    cashflowStatements: Record<string, unknown>[]
    keyStatistics: Record<string, unknown>[]
    valueAddedStatements: Record<string, unknown>[]
  }
}

// Função para converter Decimal para number
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value)
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber()
  }
  return parseFloat(String(value))
}

// Funções de formatação
function formatCurrency(value: number | null, compact: boolean = false): string {
  if (value === null || value === undefined) return 'N/A'
  
  if (compact) {
    if (Math.abs(value) >= 1_000_000_000) {
      return `R$ ${(value / 1_000_000_000).toFixed(2)}B`
    } else if (Math.abs(value) >= 1_000_000) {
      return `R$ ${(value / 1_000_000).toFixed(2)}M`
    } else if (Math.abs(value) >= 1_000) {
      return `R$ ${(value / 1_000).toFixed(2)}K`
    }
  }
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

function formatPercent(value: unknown): string {
  const numValue = toNumber(value)
  if (numValue === null) return 'N/A'
  return `${(numValue * 100).toFixed(2)}%`
}

function formatNumber(value: unknown, decimals: number = 2): string {
  const numValue = toNumber(value)
  if (numValue === null) return 'N/A'
  return numValue.toFixed(decimals)
}


// Componente para indicador com fallback
function IndicatorWithFallback({ 
  label, 
  value, 
  fallbackValue, 
  formatter = formatNumber,
}: {
  label: string
  value: unknown
  fallbackValue?: unknown
  formatter?: (val: unknown) => string
}) {
  const displayValue = value !== null ? value : fallbackValue
  const isUsingFallback = value === null && fallbackValue !== null

  return (
    <div className="flex flex-col space-y-1">
      <div className="flex items-center space-x-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {isUsingFallback && (
          <Badge variant="outline" className="text-xs">
            <Info className="w-3 h-3 mr-1" />
            Estimado
          </Badge>
        )}
      </div>
      <span className="text-lg font-semibold">
        {formatter(displayValue)}
      </span>
    </div>
  )
}

// Componente principal
export default function ComprehensiveFinancialView({ data }: ComprehensiveFinancialViewProps) {
  
  const { company, financialData, balanceSheets, incomeStatements, cashflowStatements, keyStatistics } = data
  
  // Dados mais recentes
  const latestFinancial = financialData[0]
  const latestBalance = balanceSheets[0]
  const latestIncome = incomeStatements[0]
  const latestCashflow = cashflowStatements[0]
  const latestStats = keyStatistics[0]

  // Verificar se tem fallbacks aplicados
  const hasFinancialFallbacks = latestFinancial?._hasFinancialFallbacks || false

  return (
    <div className="space-y-6">
      {/* Header com informações da empresa */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <div className="min-w-0 flex-1">
              <CardTitle 
                className="text-lg sm:text-xl lg:text-2xl break-words leading-tight"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                  hyphens: 'auto'
                }}
              >
                {company.name}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">{company.ticker}</Badge>
                {company.sector && (
                  <Badge variant="outline" className="text-xs truncate max-w-[120px] sm:max-w-none">
                    {company.sector}
                  </Badge>
                )}
                {company.industry && (
                  <Badge variant="outline" className="text-xs hidden sm:inline-flex truncate max-w-[150px]">
                    {company.industry}
                  </Badge>
                )}
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs whitespace-nowrap">
                  📊 Dados Anuais
                </Badge>
              </div>
            </div>
            {hasFinancialFallbacks && (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 flex-shrink-0 w-fit">
                <Building2 className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Setor Financeiro</span>
                <span className="sm:hidden">Financeiro</span>
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Tabs para diferentes visões */}
      <Tabs defaultValue="overview" className="w-full">
        {/* TabsList responsiva - scrollável no mobile */}
        <div className="relative mb-4">
          <div 
            className="overflow-x-auto pb-2"
            style={{
              scrollbarWidth: 'none', /* Firefox */
              msOverflowStyle: 'none', /* IE and Edge */
            }}
          >
            <style jsx>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-max min-w-full sm:min-w-0">
              <TabsTrigger value="overview" className="whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                <span className="hidden sm:inline">Visão Geral</span>
                <span className="sm:hidden">Visão</span>
              </TabsTrigger>
              <TabsTrigger value="income" className="whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                DRE
              </TabsTrigger>
              <TabsTrigger value="balance" className="whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                Balanço
              </TabsTrigger>
              <TabsTrigger value="cashflow" className="whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                <span className="hidden sm:inline">Fluxo de Caixa</span>
                <span className="sm:hidden">Fluxo</span>
              </TabsTrigger>
              <TabsTrigger value="valuation" className="whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                Valuation
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Indicadores Principais */}
            <Card>
              <CardHeader className="pb-3 p-4">
                <CardTitle className="text-sm font-medium flex items-center">
                  <DollarSign className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Receita & Lucro</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0">
                <IndicatorWithFallback
                  label="Receita Total"
                  value={toNumber(latestFinancial?.receitaTotal)}
                  fallbackValue={toNumber(latestIncome?.operatingIncome)}
                  formatter={(v) => formatCurrency(toNumber(v), true)}
                />
                <IndicatorWithFallback
                  label="Lucro Líquido"
                  value={toNumber(latestFinancial?.lucroLiquido)}
                  fallbackValue={toNumber(latestIncome?.netIncome)}
                  formatter={(v) => formatCurrency(toNumber(v), true)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 p-4">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Percent className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Margens</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0">
                <IndicatorWithFallback
                  label="Margem Líquida"
                  value={toNumber(latestFinancial?.margemLiquida)}
                  fallbackValue={
                    latestIncome?.netIncome && latestIncome?.operatingIncome && toNumber(latestIncome.operatingIncome) && toNumber(latestIncome.operatingIncome)! > 0
                      ? toNumber(latestIncome.netIncome)! / toNumber(latestIncome.operatingIncome)!
                      : null
                  }
                  formatter={formatPercent}
                />
                <IndicatorWithFallback
                  label="Margem EBITDA"
                  value={toNumber(latestFinancial?.margemEbitda)}
                  formatter={formatPercent}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 p-4">
                <CardTitle className="text-sm font-medium flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Rentabilidade</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0">
                <IndicatorWithFallback
                  label="ROE"
                  value={toNumber(latestFinancial?.roe)}
                  formatter={formatPercent}
                />
                <IndicatorWithFallback
                  label="ROA"
                  value={toNumber(latestFinancial?.roa)}
                  formatter={formatPercent}
                />
                <IndicatorWithFallback
                  label="ROIC"
                  value={toNumber(latestFinancial?.roic)}
                  formatter={formatPercent}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 p-4">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Target className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Valuation</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0">
                <IndicatorWithFallback
                  label="P/L"
                  value={toNumber(latestStats?.forwardPE)}
                  fallbackValue={toNumber(latestFinancial?.pl)}
                  formatter={formatNumber}
                />
                <IndicatorWithFallback
                  label="P/VP"
                  value={toNumber(latestStats?.priceToBook)}
                  fallbackValue={toNumber(latestFinancial?.pvp)}
                  formatter={formatNumber}
                />
                <IndicatorWithFallback
                  label="Dividend Yield"
                  value={toNumber(latestStats?.dividendYield) ? toNumber(latestStats?.dividendYield)! / 100 : null}
                  fallbackValue={toNumber(latestFinancial?.dy)}
                  formatter={formatPercent}
                />
                <IndicatorWithFallback
                  label="EV/EBITDA"
                  value={toNumber(latestFinancial?.evEbitda)}
                  formatter={formatNumber}
                />
              </CardContent>
            </Card>
          </div>

          {/* Dados Históricos Anuais */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Evolução Anual (Últimos 5 Anos)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Dados anuais históricos para análise de tendências
              </p>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[600px] px-4 sm:px-0">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-1 sm:px-2 min-w-[80px] sm:min-w-[100px]">Ano</th>
                        <th className="text-right py-2 px-1 sm:px-2 min-w-[80px] sm:min-w-[90px]">Receita</th>
                        <th className="text-right py-2 px-1 sm:px-2 min-w-[90px] sm:min-w-[100px]">Lucro Líq.</th>
                        <th className="text-right py-2 px-1 sm:px-2 min-w-[80px] sm:min-w-[90px]">Margem</th>
                        <th className="text-right py-2 px-1 sm:px-2 min-w-[60px] sm:min-w-[70px]">ROE</th>
                        <th className="text-right py-2 px-1 sm:px-2 min-w-[60px] sm:min-w-[70px]">P/L</th>
                      </tr>
                    </thead>
                  <tbody>
                    {incomeStatements.slice(0, 5).map((item, index) => {
                      // Encontrar dados anuais correspondentes por ano
                      const itemYear = new Date(item.endDate as string).getFullYear()
                      const correspondingStats = keyStatistics.find(ks => {
                        const statsYear = new Date(ks.endDate as string).getFullYear()
                        return statsYear === itemYear
                      })
                      
                      // Buscar dados financeiros do mesmo ano
                      const correspondingFinancial = financialData.find(fd => {
                        return fd.year === itemYear
                      })
                      
                      return (
                        <tr key={index} className="border-b">
                          <td className="py-2 px-1 sm:px-2">
                            {new Date(item.endDate as string).getFullYear()}
                          </td>
                          <td className="text-right py-2 px-1 sm:px-2">
                            {item.totalRevenue ? formatCurrency(toNumber(item.totalRevenue), true) : 
                             formatCurrency(toNumber(item.operatingIncome), true)}
                          </td>
                          <td className="text-right py-2 px-1 sm:px-2">
                            {formatCurrency(toNumber(item.netIncome), true)}
                          </td>
                          <td className="text-right py-2 px-1 sm:px-2">
                            {item.netIncome && item.operatingIncome && toNumber(item.operatingIncome) && toNumber(item.operatingIncome)! > 0
                              ? formatPercent(toNumber(item.netIncome)! / toNumber(item.operatingIncome)!)
                              : formatPercent(correspondingFinancial?.margemLiquida)
                            }
                          </td>
                          <td className="text-right py-2 px-1 sm:px-2">
                            {formatPercent(correspondingFinancial?.roe)}
                          </td>
                          <td className="text-right py-2 px-1 sm:px-2">
                            {formatNumber(toNumber(correspondingStats?.forwardPE) ?? toNumber(correspondingFinancial?.pl))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DRE */}
        <TabsContent value="income" className="space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Demonstração do Resultado do Exercício (Anual)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Último ano: {latestIncome ? new Date(latestIncome.endDate as string).getFullYear() : 'N/A'}
              </p>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">RECEITAS</h4>
                  <IndicatorWithFallback
                    label="Receita Total"
                    value={toNumber(latestIncome?.totalRevenue)}
                    fallbackValue={toNumber(latestIncome?.operatingIncome)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                  <IndicatorWithFallback
                    label="Lucro Bruto"
                    value={toNumber(latestIncome?.grossProfit)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">RESULTADO OPERACIONAL</h4>
                  <IndicatorWithFallback
                    label="Resultado Operacional"
                    value={toNumber(latestIncome?.operatingIncome)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                  <IndicatorWithFallback
                    label="EBIT"
                    value={toNumber(latestIncome?.ebit)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">RESULTADO LÍQUIDO</h4>
                  <IndicatorWithFallback
                    label="Lucro Antes dos Impostos"
                    value={toNumber(latestIncome?.incomeBeforeTax)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                  <IndicatorWithFallback
                    label="Lucro Líquido"
                    value={toNumber(latestIncome?.netIncome)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                </div>
              </div>

              {/* Histórico DRE */}
              <div className="mt-6 sm:mt-8">
                <h4 className="font-semibold mb-4 text-sm sm:text-base">Histórico Anual (Últimos 5 Anos)</h4>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[600px] px-4 sm:px-0">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-1 sm:px-2 min-w-[80px] sm:min-w-[100px]">Ano</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[90px] sm:min-w-[100px]">Receita</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[90px] sm:min-w-[100px]">L. Bruto</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[70px] sm:min-w-[80px]">EBIT</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[90px] sm:min-w-[100px]">L. Líquido</th>
                        </tr>
                      </thead>
                    <tbody>
                      {incomeStatements.slice(0, 5).map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-2 px-1 sm:px-2">{new Date(item.endDate as string).getFullYear()}</td>
                          <td className="text-right py-2 px-1 sm:px-2">
                            {item.totalRevenue ? formatCurrency(toNumber(item.totalRevenue), true) : 
                             formatCurrency(toNumber(item.operatingIncome), true)}
                          </td>
                          <td className="text-right py-2 px-1 sm:px-2">
                            {formatCurrency(toNumber(item.grossProfit), true)}
                          </td>
                          <td className="text-right py-2 px-1 sm:px-2">
                            {formatCurrency(toNumber(item.ebit), true)}
                          </td>
                          <td className="text-right py-2 px-1 sm:px-2">
                            {formatCurrency(toNumber(item.netIncome), true)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balanço */}
        <TabsContent value="balance" className="space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Balanço Patrimonial (Anual)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Último ano: {latestBalance ? new Date(latestBalance.endDate as string).getFullYear() : 'N/A'}
              </p>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">ATIVO</h4>
                  <IndicatorWithFallback
                    label="Ativo Total"
                    value={toNumber(latestBalance?.totalAssets)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                  <IndicatorWithFallback
                    label="Ativo Circulante"
                    value={toNumber(latestBalance?.totalCurrentAssets)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                  <IndicatorWithFallback
                    label="Caixa e Equivalentes"
                    value={toNumber(latestBalance?.cash)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">PASSIVO</h4>
                  <IndicatorWithFallback
                    label="Passivo Total"
                    value={toNumber(latestBalance?.totalLiab)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                  <IndicatorWithFallback
                    label="Passivo Circulante"
                    value={toNumber(latestBalance?.totalCurrentLiabilities)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">PATRIMÔNIO LÍQUIDO</h4>
                  <IndicatorWithFallback
                    label="Patrimônio Líquido"
                    value={toNumber(latestBalance?.totalStockholderEquity)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                  <IndicatorWithFallback
                    label="Capital Social"
                    value={toNumber(latestBalance?.commonStock)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                </div>
              </div>

              {/* Histórico Balanço */}
              <div className="mt-6 sm:mt-8">
                <h4 className="font-semibold mb-4 text-sm sm:text-base">Histórico Anual - Balanço (Últimos 5 Anos)</h4>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[650px] px-4 sm:px-0">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-1 sm:px-2 min-w-[80px] sm:min-w-[100px]">Ano</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[90px] sm:min-w-[110px]">Ativo</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[90px] sm:min-w-[110px]">Passivo</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[100px] sm:min-w-[120px]">Patrimônio</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[70px] sm:min-w-[80px]">Caixa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balanceSheets.slice(0, 5).map((item, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-2 px-1 sm:px-2">{new Date(item.endDate as string).getFullYear()}</td>
                            <td className="text-right py-2 px-1 sm:px-2">
                              {formatCurrency(toNumber(item.totalAssets), true)}
                            </td>
                            <td className="text-right py-2 px-1 sm:px-2">
                              {formatCurrency(toNumber(item.totalLiab), true)}
                            </td>
                            <td className="text-right py-2 px-1 sm:px-2">
                              {formatCurrency(toNumber(item.totalStockholderEquity), true)}
                            </td>
                            <td className="text-right py-2 px-1 sm:px-2">
                              {formatCurrency(toNumber(item.cash), true)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fluxo de Caixa */}
        <TabsContent value="cashflow" className="space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Demonstração do Fluxo de Caixa (Anual)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Último ano: {latestCashflow ? new Date(latestCashflow.endDate as string).getFullYear() : 'N/A'}
              </p>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">OPERACIONAL</h4>
                  <IndicatorWithFallback
                    label="Fluxo de Caixa Operacional"
                    value={toNumber(latestCashflow?.operatingCashFlow)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                  <IndicatorWithFallback
                    label="Resultado das Operações"
                    value={toNumber(latestCashflow?.incomeFromOperations)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">INVESTIMENTO</h4>
                  <IndicatorWithFallback
                    label="Fluxo de Caixa de Investimento"
                    value={toNumber(latestCashflow?.investmentCashFlow)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">FINANCIAMENTO</h4>
                  <IndicatorWithFallback
                    label="Fluxo de Caixa de Financiamento"
                    value={toNumber(latestCashflow?.financingCashFlow)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                  <IndicatorWithFallback
                    label="Variação do Caixa"
                    value={toNumber(latestCashflow?.increaseOrDecreaseInCash)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                </div>
              </div>

              {/* Histórico Fluxo de Caixa */}
              <div className="mt-6 sm:mt-8">
                <h4 className="font-semibold mb-4 text-sm sm:text-base">Histórico Anual - Fluxo de Caixa (Últimos 5 Anos)</h4>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[700px] px-4 sm:px-0">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-1 sm:px-2 min-w-[80px] sm:min-w-[100px]">Ano</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[100px] sm:min-w-[120px]">FC Oper.</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[100px] sm:min-w-[120px]">FC Invest.</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[110px] sm:min-w-[130px]">FC Financ.</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[90px] sm:min-w-[110px]">Var. Caixa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashflowStatements.slice(0, 5).map((item, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-2 px-1 sm:px-2">{new Date(item.endDate as string).getFullYear()}</td>
                            <td className="text-right py-2 px-1 sm:px-2">
                              {formatCurrency(toNumber(item.operatingCashFlow), true)}
                            </td>
                            <td className="text-right py-2 px-1 sm:px-2">
                              {formatCurrency(toNumber(item.investmentCashFlow), true)}
                            </td>
                            <td className="text-right py-2 px-1 sm:px-2">
                              {formatCurrency(toNumber(item.financingCashFlow), true)}
                            </td>
                            <td className="text-right py-2 px-1 sm:px-2">
                              {formatCurrency(toNumber(item.increaseOrDecreaseInCash), true)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Valuation */}
        <TabsContent value="valuation" className="space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Indicadores de Valuation (Dados Anuais)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Baseado nos dados anuais mais recentes disponíveis
              </p>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">MÚLTIPLOS</h4>
                <IndicatorWithFallback
                  label="P/L"
                  value={toNumber(latestStats?.forwardPE)}
                  fallbackValue={toNumber(latestFinancial?.pl)}
                  formatter={formatNumber}
                />
                  <IndicatorWithFallback
                    label="P/VP"
                    value={toNumber(latestStats?.priceToBook)}
                    fallbackValue={toNumber(latestFinancial?.pvp)}
                    formatter={formatNumber}
                  />
                  <IndicatorWithFallback
                    label="EV/EBITDA"
                    value={toNumber(latestFinancial?.evEbitda)}
                    formatter={formatNumber}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">ENTERPRISE VALUE</h4>
                  <IndicatorWithFallback
                    label="Enterprise Value"
                    value={toNumber(latestStats?.enterpriseValue)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                  <IndicatorWithFallback
                    label="Market Cap"
                    value={toNumber(latestStats?.marketCap)}
                    fallbackValue={toNumber(latestFinancial?.marketCap)}
                    formatter={(v) => formatCurrency(toNumber(v), true)}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">DIVIDENDOS</h4>
                  <IndicatorWithFallback
                    label="Dividend Yield"
                    value={toNumber(latestStats?.dividendYield) ? toNumber(latestStats?.dividendYield)! / 100 : null}
                    fallbackValue={toNumber(latestFinancial?.dy)}
                    formatter={formatPercent}
                  />
                  <IndicatorWithFallback
                    label="Último Dividendo"
                    value={toNumber(latestStats?.lastDividendValue)}
                    fallbackValue={toNumber(latestFinancial?.ultimoDividendo)}
                    formatter={(v) => formatCurrency(toNumber(v))}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">OUTROS</h4>
                  <IndicatorWithFallback
                    label="LPA"
                    value={toNumber(latestStats?.trailingEps)}
                    fallbackValue={toNumber(latestFinancial?.lpa)}
                    formatter={(v) => formatCurrency(toNumber(v))}
                  />
                  <IndicatorWithFallback
                    label="VPA"
                    value={toNumber(latestStats?.bookValue)}
                    fallbackValue={toNumber(latestFinancial?.vpa)}
                    formatter={(v) => formatCurrency(toNumber(v))}
                  />
                </div>
              </div>

              {/* Histórico Valuation */}
              <div className="mt-6 sm:mt-8">
                <h4 className="font-semibold mb-4 text-sm sm:text-base">Histórico Anual - Valuation (Últimos 5 Anos)</h4>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[750px] px-4 sm:px-0">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-1 sm:px-2 min-w-[80px] sm:min-w-[100px]">Ano</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[60px] sm:min-w-[70px]">P/L</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[60px] sm:min-w-[70px]">P/VP</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[80px] sm:min-w-[100px]">DY</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[80px] sm:min-w-[100px]">Market Cap</th>
                          <th className="text-right py-2 px-1 sm:px-2 min-w-[100px] sm:min-w-[120px]">EV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keyStatistics.slice(0, 5).map((item, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-2 px-1 sm:px-2">{new Date(item.endDate as string).getFullYear()}</td>
                            <td className="text-right py-2 px-1 sm:px-2">
                              {(() => {
                                const forwardPE = toNumber(item.forwardPE)
                                if (forwardPE !== null) {
                                  return formatNumber(forwardPE)
                                }
                                // Buscar fallback nos dados anuais do mesmo ano
                                const itemYear = new Date(item.endDate as string).getFullYear()
                                const fallbackFinancial = financialData.find(fd => fd.year === itemYear)
                                return formatNumber(toNumber(fallbackFinancial?.pl))
                              })()}
                            </td>
                            <td className="text-right py-2 px-1 sm:px-2">
                              {formatNumber(toNumber(item.priceToBook))}
                            </td>
                            <td className="text-right py-2 px-1 sm:px-2">
                              {formatPercent(toNumber(item.dividendYield) ? toNumber(item.dividendYield)! / 100 : null)}
                            </td>
                            <td className="text-right py-2 px-1 sm:px-2">
                              {formatCurrency(toNumber(item.marketCap), true)}
                            </td>
                            <td className="text-right py-2 px-1 sm:px-2">
                              {formatCurrency(toNumber(item.enterpriseValue), true)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
