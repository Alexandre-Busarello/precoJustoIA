"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Download, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import Link from "next/link"

interface ReportData {
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
  sustainability: {
    roe: number | null
    payout: number | null
    margemLiquida: number | null
    liquidezCorrente: number | null
    dividendTrapAlerts: string[]
    score: number
    breakdown: {
      roe: { points: number; maxPoints: number; value: number | null; description: string }
      payout: { points: number; maxPoints: number; value: number | null; description: string }
      margemLiquida: { points: number; maxPoints: number; value: number | null; description: string }
      liquidezCorrente: { points: number; maxPoints: number; value: number | null; description: string }
    }
  }
  sectorComparison: {
    sectorAverage: number | null
    companySector: string | null
    isAboveAverage: boolean | null
  }
  projections: {
    conservative: {
      monthly: number
      annual: number
    }
    optimistic: {
      monthly: number
      annual: number
    }
  }
  historicalTrend: {
    trend: "increasing" | "decreasing" | "stable"
    averageGrowth: number
    consistency: number
  }
}

export default function DividendYieldReportPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const ticker = params.ticker as string
  const investmentAmount = searchParams.get("investmentAmount")

  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return

    if (status === "unauthenticated") {
      router.push(`/calculadoras/dividend-yield?redirect=${encodeURIComponent(window.location.href)}`)
      return
    }

    if (status === "authenticated" && ticker && investmentAmount) {
      loadReport()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ticker, investmentAmount])

  const loadReport = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/calculators/dividend-yield/report?ticker=${ticker}&investmentAmount=${investmentAmount}`
      )

      if (!response.ok) {
        throw new Error("Erro ao carregar relatório")
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Erro ao carregar relatório")
      }

      setReportData(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number | null): string => {
    if (value === null) return "N/A"
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatPercent = (value: number | null): string => {
    if (value === null) return "N/A"
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

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing":
        return <TrendingUp className="w-5 h-5 text-green-600" />
      case "decreasing":
        return <TrendingDown className="w-5 h-5 text-red-600" />
      default:
        return <Minus className="w-5 h-5 text-gray-600" />
    }
  }

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case "increasing":
        return "Crescimento"
      case "decreasing":
        return "Declínio"
      default:
        return "Estável"
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Carregando relatório completo...</p>
        </div>
      </div>
    )
  }

  if (error || !reportData) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Erro ao carregar relatório</h2>
              <p className="text-muted-foreground mb-4">{error || "Relatório não encontrado"}</p>
              <Button asChild>
                <Link href="/calculadoras/dividend-yield">Voltar para Calculadora</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Preparar dados para gráficos
  const historicalChartData = reportData.dividendHistory
    .slice(0, 60)
    .reverse()
    .map((div) => {
      const date = typeof div.date === "string" ? new Date(div.date) : div.date
      return {
        date: formatDate(date),
        amount: div.amount,
        projectedIncome: div.amount * (parseFloat(investmentAmount || "0") / reportData.currentPrice),
      }
    })

  // Agrupar por ano para gráfico de barras
  const yearlyData = new Map<number, number>()
  reportData.dividendHistory.forEach((div) => {
    const date = typeof div.date === "string" ? new Date(div.date) : div.date
    const year = date.getFullYear()
    const current = yearlyData.get(year) || 0
    yearlyData.set(year, current + div.amount)
  })

  const yearlyChartData = Array.from(yearlyData.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-5)
    .map(([year, total]) => ({
      year: year.toString(),
      total,
      projectedIncome: total * (parseFloat(investmentAmount || "0") / reportData.currentPrice),
    }))

  return (
    <div className="container mx-auto px-4 py-8 lg:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Relatório Completo - {reportData.companyName} ({reportData.ticker})
            </h1>
            <p className="text-muted-foreground">
              Análise detalhada de dividend yield e sustentabilidade
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/calculadoras/dividend-yield">
              <Download className="w-4 h-4 mr-2" />
              Nova Análise
            </Link>
          </Button>
        </div>
      </div>

      {/* Resumo Executivo */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Resumo Executivo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Dividend Yield</p>
              <p className="text-2xl font-bold text-green-600">
                {formatPercent(reportData.dividendYield)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Renda Mensal</p>
              <p className="text-2xl font-bold">{formatCurrency(reportData.monthlyIncome)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Renda Anual</p>
              <p className="text-2xl font-bold">{formatCurrency(reportData.annualIncome)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Score Sustentabilidade</p>
              <p className="text-2xl font-bold">{reportData.sustainability.score}/100</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Evolução Histórica (Últimos 5 Anos)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={yearlyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="total" fill="#10b981" name="Dividendo por Ação" />
                <Bar dataKey="projectedIncome" fill="#3b82f6" name="Renda Projetada" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tendência de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {getTrendIcon(reportData.historicalTrend.trend)}
                <div>
                  <p className="font-semibold">{getTrendLabel(reportData.historicalTrend.trend)}</p>
                  <p className="text-sm text-muted-foreground">
                    Crescimento médio: {formatPercent(reportData.historicalTrend.averageGrowth)}
                  </p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-muted-foreground">Consistência</p>
                  <p className="text-xs text-muted-foreground">
                    {reportData.historicalTrend.consistency}%
                  </p>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                  <div
                    className="bg-green-600 h-4 rounded-full transition-all"
                    style={{ width: `${reportData.historicalTrend.consistency}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <strong>Como é calculado:</strong> Mede a regularidade dos intervalos entre pagamentos de dividendos. Empresas que pagam em intervalos consistentes (ex: mensalmente ou trimestralmente) têm maior consistência.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Análise de Sustentabilidade */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Análise de Sustentabilidade</CardTitle>
            <Badge variant="outline" className="text-lg">
              Score: {reportData.sustainability.score}/100
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Breakdown do Score */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h4 className="font-semibold mb-3 text-sm">Como o Score é Calculado:</h4>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">ROE (Return on Equity)</span>
                    <Badge variant="secondary" className="text-xs">
                      {reportData.sustainability.breakdown.roe.points}/{reportData.sustainability.breakdown.roe.maxPoints} pts
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {reportData.sustainability.breakdown.roe.value !== null
                      ? `Valor: ${formatPercent(reportData.sustainability.breakdown.roe.value)} - ${reportData.sustainability.breakdown.roe.description}`
                      : reportData.sustainability.breakdown.roe.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Mede a rentabilidade sobre o patrimônio líquido. Quanto maior, melhor a capacidade de gerar lucros.
                  </p>
                </div>
                <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${(reportData.sustainability.breakdown.roe.points / reportData.sustainability.breakdown.roe.maxPoints) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">Payout Ratio</span>
                    <Badge variant="secondary" className="text-xs">
                      {reportData.sustainability.breakdown.payout.points}/{reportData.sustainability.breakdown.payout.maxPoints} pts
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {reportData.sustainability.breakdown.payout.value !== null
                      ? `Valor: ${formatPercent(reportData.sustainability.breakdown.payout.value)} - ${reportData.sustainability.breakdown.payout.description}`
                      : reportData.sustainability.breakdown.payout.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Percentual do lucro distribuído como dividendos. Ideal entre 30-60% para equilibrar distribuição e reinvestimento.
                  </p>
                </div>
                <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${(reportData.sustainability.breakdown.payout.points / reportData.sustainability.breakdown.payout.maxPoints) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">Margem Líquida</span>
                    {reportData.sustainability.breakdown.margemLiquida.maxPoints > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {reportData.sustainability.breakdown.margemLiquida.points}/{reportData.sustainability.breakdown.margemLiquida.maxPoints} pts
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        N/A
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {reportData.sustainability.breakdown.margemLiquida.value !== null
                      ? `Valor: ${formatPercent(reportData.sustainability.breakdown.margemLiquida.value)} - ${reportData.sustainability.breakdown.margemLiquida.description}`
                      : reportData.sustainability.breakdown.margemLiquida.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {reportData.sustainability.breakdown.margemLiquida.maxPoints === 0
                      ? "Métrica não aplicável para empresas do setor financeiro devido às particularidades do setor."
                      : "Percentual do lucro líquido sobre a receita. Indica eficiência operacional e capacidade de gerar lucros."}
                  </p>
                </div>
                {reportData.sustainability.breakdown.margemLiquida.maxPoints > 0 ? (
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${(reportData.sustainability.breakdown.margemLiquida.points / reportData.sustainability.breakdown.margemLiquida.maxPoints) * 100}%`,
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 opacity-50" />
                )}
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">Liquidez Corrente</span>
                    {reportData.sustainability.breakdown.liquidezCorrente.maxPoints > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {reportData.sustainability.breakdown.liquidezCorrente.points}/{reportData.sustainability.breakdown.liquidezCorrente.maxPoints} pts
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        N/A
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {reportData.sustainability.breakdown.liquidezCorrente.value !== null
                      ? `Valor: ${reportData.sustainability.breakdown.liquidezCorrente.value.toFixed(2)} - ${reportData.sustainability.breakdown.liquidezCorrente.description}`
                      : reportData.sustainability.breakdown.liquidezCorrente.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {reportData.sustainability.breakdown.liquidezCorrente.maxPoints === 0
                      ? "Métrica não aplicável para empresas do setor financeiro devido às particularidades do setor."
                      : "Razão entre ativos circulantes e passivos circulantes. Indica capacidade de pagar obrigações de curto prazo."}
                  </p>
                </div>
                {reportData.sustainability.breakdown.liquidezCorrente.maxPoints > 0 ? (
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${(reportData.sustainability.breakdown.liquidezCorrente.points / reportData.sustainability.breakdown.liquidezCorrente.maxPoints) * 100}%`,
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 opacity-50" />
                )}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-muted-foreground">
                <strong>Nota:</strong> O score é calculado proporcionalmente ao máximo possível baseado nos dados disponíveis. 
                Cada métrica tem um peso específico: ROE (30%), Payout Ratio (25%), Margem Líquida (25%), Liquidez Corrente (20%).
                {reportData.sustainability.breakdown.margemLiquida.maxPoints === 0 || reportData.sustainability.breakdown.liquidezCorrente.maxPoints === 0 ? (
                  <span className="block mt-1">
                    <strong>Importante:</strong> Para empresas do setor financeiro, Margem Líquida e Liquidez Corrente não são consideradas no cálculo do score, pois essas métricas não são aplicáveis devido às particularidades do setor.
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          {/* Métricas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">ROE</p>
              <p className="text-xl font-bold">
                {reportData.sustainability.roe !== null
                  ? formatPercent(reportData.sustainability.roe)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Payout Ratio</p>
              <p className="text-xl font-bold">
                {reportData.sustainability.payout !== null
                  ? formatPercent(reportData.sustainability.payout)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Margem Líquida</p>
              <p className="text-xl font-bold">
                {reportData.sustainability.margemLiquida !== null
                  ? formatPercent(reportData.sustainability.margemLiquida)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Liquidez Corrente</p>
              <p className="text-xl font-bold">
                {reportData.sustainability.liquidezCorrente !== null
                  ? reportData.sustainability.liquidezCorrente.toFixed(2)
                  : "N/A"}
              </p>
            </div>
          </div>

          {reportData.sustainability.dividendTrapAlerts.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                    Alertas de Dividend Trap
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
                    {reportData.sustainability.dividendTrapAlerts.map((alert, index) => (
                      <li key={index}>{alert}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparação Setorial */}
      {reportData.sectorComparison.sectorAverage !== null && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Comparação Setorial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Setor: {reportData.sectorComparison.companySector}</span>
                <Badge
                  variant={reportData.sectorComparison.isAboveAverage ? "default" : "secondary"}
                >
                  {reportData.sectorComparison.isAboveAverage
                    ? "Acima da Média"
                    : "Abaixo da Média"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Dividend Yield da Empresa</p>
                  <p className="text-2xl font-bold">{formatPercent(reportData.dividendYield)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Média do Setor</p>
                  <p className="text-2xl font-bold">
                    {formatPercent(reportData.sectorComparison.sectorAverage)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projeções Futuras */}
      <Card>
        <CardHeader>
          <CardTitle>Projeções Futuras</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-4 text-orange-600">Cenário Conservador (-20%)</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Renda Mensal:</span>
                  <span className="font-semibold">
                    {formatCurrency(reportData.projections.conservative.monthly)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Renda Anual:</span>
                  <span className="font-semibold">
                    {formatCurrency(reportData.projections.conservative.annual)}
                  </span>
                </div>
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-4 text-green-600">Cenário Otimista (+20%)</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Renda Mensal:</span>
                  <span className="font-semibold">
                    {formatCurrency(reportData.projections.optimistic.monthly)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Renda Anual:</span>
                  <span className="font-semibold">
                    {formatCurrency(reportData.projections.optimistic.annual)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            * Projeções baseadas em tendência histórica e podem variar conforme condições de
            mercado
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

