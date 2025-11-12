"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, DollarSign, Calendar, FileText, Lock, Shield, BarChart3, Sparkles, CheckCircle } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface CalculationResult {
  ticker: string
  companyName: string
  currentPrice: number
  dividendYield: number
  monthlyIncome: number
  annualIncome: number
  lastDividend: {
    amount: number
    date: Date
  }
  dividendHistory: Array<{
    date: Date
    amount: number
  }>
  averageMonthlyDividend: number
  averageQuarterlyDividend: number
  totalDividendsLast12Months: number
}

interface DividendYieldResultsProps {
  result: CalculationResult
  investmentAmount: number
  onViewFullReport: () => void
  isAuthenticated: boolean
}

export function DividendYieldResults({
  result,
  investmentAmount,
  onViewFullReport,
  isAuthenticated,
}: DividendYieldResultsProps) {
  const formatCurrency = (value: number | null): string => {
    if (value === null) return "N/A"
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatPercent = (value: number): string => {
    return `${(value * 100).toFixed(2)}%`
  }

  const formatDate = (date: Date | string): string => {
    const d = typeof date === "string" ? new Date(date) : date
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d)
  }

  // Preparar dados para gráfico (últimos 12 meses)
  const chartData = result.dividendHistory
    .slice(0, 12)
    .reverse()
    .map((div) => {
      const date = typeof div.date === "string" ? new Date(div.date) : div.date
      return {
        date: formatDate(date),
        amount: div.amount,
        projectedIncome: div.amount * (investmentAmount / result.currentPrice),
      }
    })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Resultado do Cálculo - {result.companyName} ({result.ticker})</span>
            <Badge variant="outline" className="text-green-600 border-green-600">
              Preço: {formatCurrency(result.currentPrice)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Métricas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Dividend Yield</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatPercent(result.dividendYield)}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Renda Mensal</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(result.monthlyIncome)}
                    </p>
                  </div>
                  <Calendar className="w-8 h-8 text-blue-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Renda Anual</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatCurrency(result.annualIncome)}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-purple-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Último Dividendo</p>
                    <p className="text-lg font-bold">{formatCurrency(result.lastDividend.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(result.lastDividend.date)}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-orange-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Evolução */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evolução dos Dividendos (Últimos 12 Meses)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelStyle={{ color: "#000" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Dividendo por Ação"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Informações Adicionais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Total Últimos 12 Meses</p>
                <p className="text-xl font-bold">
                  {formatCurrency(result.totalDividendsLast12Months)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Média Mensal</p>
                <p className="text-xl font-bold">
                  {formatCurrency(result.averageMonthlyDividend)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Média Trimestral</p>
                <p className="text-xl font-bold">
                  {formatCurrency(result.averageQuarterlyDividend)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CTA para Relatório Completo - Melhorado */}
          <Card className="border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 via-white to-emerald-50/50 dark:from-green-950/20 dark:via-background dark:to-emerald-950/20">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-6">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 bg-green-600 text-white rounded-full px-4 py-1.5 mb-3">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-semibold">Relatório Completo Disponível</span>
                  </div>
                  <h3 className="font-bold text-xl mb-2">
                    {isAuthenticated
                      ? "Acesse o Relatório Completo Agora"
                      : "Desbloqueie o Relatório Completo Grátis"}
                  </h3>
                  <p className="text-muted-foreground">
                    {isAuthenticated
                      ? "Veja análises profissionais que vão além do cálculo básico"
                      : "Cadastre-se grátis e tenha acesso a análises profissionais"}
                  </p>
                </div>

                {/* O que está incluído no relatório */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm mb-1">Análise de Sustentabilidade</p>
                      <p className="text-xs text-muted-foreground">
                        Score completo, ROE, Payout, Margens e alertas de Dividend Trap
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <BarChart3 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm mb-1">Gráficos Históricos (5 anos)</p>
                      <p className="text-xs text-muted-foreground">
                        Evolução completa, tendência e consistência dos pagamentos
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <TrendingUp className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm mb-1">Comparação Setorial</p>
                      <p className="text-xs text-muted-foreground">
                        Veja como a empresa se compara com a média do setor
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <DollarSign className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm mb-1">Projeções Futuras</p>
                      <p className="text-xs text-muted-foreground">
                        Cenários conservador e otimista baseados em tendência histórica
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button
                    onClick={onViewFullReport}
                    size="lg"
                    className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg"
                  >
                    {isAuthenticated ? (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Ver Relatório Completo Agora
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Cadastrar-se Grátis e Ver Relatório
                      </>
                    )}
                  </Button>
                  {!isAuthenticated && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      <span>Sem cartão • Acesso imediato • Grátis para sempre</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}

