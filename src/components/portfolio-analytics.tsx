"use client";

import { useState, useEffect, useCallback, cache } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Award,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { portfolioCache } from "@/lib/portfolio-cache";

interface PortfolioAnalyticsProps {
  portfolioId: string;
}

interface AnalyticsData {
  evolution: Array<{
    date: string;
    value: number;
    invested: number;
    cashBalance: number;
    return: number;
    returnAmount: number;
  }>;
  benchmarkComparison: Array<{
    date: string;
    portfolio: number;
    cdi: number;
    ibovespa: number;
  }>;
  monthlyReturns: Array<{
    date: string;
    return: number;
  }>;
  drawdownHistory: Array<{
    date: string;
    drawdown: number;
    isInDrawdown: boolean;
    peak: number;
    value: number;
  }>;
  drawdownPeriods: Array<{
    startDate: string;
    endDate: string | null;
    duration: number;
    depth: number;
    recovered: boolean;
  }>;
  summary: {
    totalReturn: number;
    cdiReturn: number;
    ibovespaReturn: number;
    outperformanceCDI: number;
    outperformanceIbovespa: number;
    bestMonth: {
      date: string;
      return: number;
    };
    worstMonth: {
      date: string;
      return: number;
    };
    averageMonthlyReturn: number;
    volatility: number;
    currentDrawdown: number;
    maxDrawdownDepth: number;
    averageRecoveryTime: number;
    drawdownCount: number;
  };
}

export function PortfolioAnalytics({ portfolioId }: PortfolioAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper para formatar datas em UTC (evita problemas de timezone)
  const formatDateUTC = (dateString: string) => {
    // Parse da string YYYY-MM-DD diretamente
    const [year, month, day] = dateString.split("-").map(Number);
    return { year, month, day };
  };

  const formatDateShort = (dateString: string) => {
    const { year, month } = formatDateUTC(dateString);
    return `${month}/${year.toString().slice(2)}`;
  };

  const formatMonthYear = (dateString: string) => {
    const { year, month } = formatDateUTC(dateString);
    const monthNames = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];
    return `${monthNames[month - 1]} ${year}`;
  };

  const formatMonthYearLong = (dateString: string) => {
    const { year, month } = formatDateUTC(dateString);
    const monthNames = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    const result = `${monthNames[month - 1]} ${year}`;
    // console.log(`📅 formatMonthYearLong: ${dateString} -> month=${month}, result=${result}`);
    return result;
  };

  // Helper para formatar label do tooltip (mostra "Atual" para o último ponto)
  const formatTooltipLabel = (dateString: string, dataArray: any[]) => {
    if (!dataArray || dataArray.length === 0) return formatMonthYear(dateString);
    
    // Verifica se é o último ponto
    const lastDate = dataArray[dataArray.length - 1]?.date;
    const isLastPoint = dateString === lastDate;
    
    if (isLastPoint) {
      return `📍 Atual (${formatMonthYear(dateString)})`;
    }
    
    return formatMonthYear(dateString);
  };

  const fetchAnalytics = useCallback(
    async (forceRefresh = false) => {
      try {
        setLoading(true);
        setError(null);

        // Try cache first (unless force refresh)
        if (!forceRefresh) {
          const cached = portfolioCache.analytics.get(
            portfolioId
          ) as AnalyticsData | null;
          if (cached) {
            setAnalytics(cached);
            setLoading(false);
            return;
          }
        }

        // Fetch from API
        console.log("🌐 [API] Buscando analytics do servidor...");
        const response = await cache(async() => fetch(`/api/portfolio/${portfolioId}/analytics`))();

        if (!response.ok) {
          throw new Error("Failed to fetch analytics");
        }

        const data = await response.json();
        console.log("📊 [FRONTEND] Analytics data received:", {
          evolutionCount: data.evolution?.length,
          monthlyReturnsCount: data.monthlyReturns?.length,
          drawdownPeriodsCount: data.drawdownPeriods?.length,
        });

        // Save to cache
        portfolioCache.analytics.set(portfolioId, data);
        setAnalytics(data);
      } catch (err) {
        console.error("Error fetching analytics:", err);
        setError("Erro ao carregar análises");
      } finally {
        setLoading(false);
      }
    },
    [portfolioId]
  );

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
          <p className="text-muted-foreground">Calculando análises...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics || analytics.evolution.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Não há dados suficientes para gerar análises</p>
            <p className="text-sm mt-2">
              Adicione transações à carteira para ver as análises
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary } = analytics;

  // Altura responsiva para gráficos
  const chartHeight =
    typeof window !== "undefined" && window.innerWidth < 768 ? 250 : 350;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Retorno Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {summary.totalReturn.toFixed(2)}%
              </div>
              {summary.totalReturn >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              vs CDI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">
                {summary.outperformanceCDI > 0 ? "+" : ""}
                {summary.outperformanceCDI.toFixed(2)}%
              </div>
              <div className="text-xs text-muted-foreground">
                CDI: {summary.cdiReturn.toFixed(2)}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              vs Ibovespa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">
                {summary.outperformanceIbovespa > 0 ? "+" : ""}
                {summary.outperformanceIbovespa.toFixed(2)}%
              </div>
              <div className="text-xs text-muted-foreground">
                IBOV: {summary.ibovespaReturn.toFixed(2)}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Volatilidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">
                {summary.volatility.toFixed(2)}%
              </div>
              <div className="text-xs text-muted-foreground">
                Desvio padrão mensal
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="evolution" className="space-y-4">
        {/* Mobile: Scroll horizontal | Desktop: Grid */}
        <div className="w-full overflow-x-auto pb-2 -mx-2 px-2 md:overflow-visible">
          <TabsList className="inline-flex md:grid w-auto md:w-full md:grid-cols-4 gap-1 min-w-full md:min-w-0">
            <TabsTrigger
              value="evolution"
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap flex-shrink-0"
            >
              Evolução
            </TabsTrigger>
            <TabsTrigger
              value="benchmark"
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap flex-shrink-0"
            >
              Benchmarks
            </TabsTrigger>
            <TabsTrigger
              value="drawdown"
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap flex-shrink-0"
            >
              Drawdown
            </TabsTrigger>
            <TabsTrigger
              value="monthly"
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap flex-shrink-0"
            >
              Retornos Mensais
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="evolution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evolução do Patrimônio</CardTitle>
              <CardDescription>
                Valor total da carteira ao longo do tempo
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 md:px-6">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <AreaChart
                  data={analytics.evolution}
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="colorInvested"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(value) =>
                      `R$ ${(value / 1000).toFixed(0)}k`
                    }
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`}
                    labelFormatter={(label) => formatTooltipLabel(label, analytics.evolution)}
                    contentStyle={{ fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Valor Total"
                    stroke="#8884d8"
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="invested"
                    name="Investido"
                    stroke="#82ca9d"
                    fillOpacity={1}
                    fill="url(#colorInvested)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="benchmark" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comparação com Benchmarks</CardTitle>
              <CardDescription>
                Retorno acumulado da carteira vs CDI e Ibovespa
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 md:px-6">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart
                  data={analytics.benchmarkComparison}
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: any) => `${Number(value).toFixed(2)}%`}
                    labelFormatter={(label) => formatTooltipLabel(label, analytics.benchmarkComparison)}
                    contentStyle={{ fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Line
                    type="monotone"
                    dataKey="portfolio"
                    name="Carteira"
                    stroke="#8884d8"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="cdi"
                    name="CDI"
                    stroke="#82ca9d"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                  <Line
                    type="monotone"
                    dataKey="ibovespa"
                    name="Ibovespa"
                    stroke="#ffc658"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Performance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Melhor Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    {summary.bestMonth.date ? (
                      <>
                        <div className="text-2xl font-bold text-green-600">
                          +{summary.bestMonth.return.toFixed(2)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatMonthYearLong(summary.bestMonth.date)}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Dados insuficientes
                      </div>
                    )}
                  </div>
                  <Award className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Pior Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    {summary.worstMonth.date ? (
                      <>
                        <div className="text-2xl font-bold text-red-600">
                          {summary.worstMonth.return.toFixed(2)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatMonthYearLong(summary.worstMonth.date)}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Dados insuficientes
                      </div>
                    )}
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="drawdown" className="space-y-4">
          {/* Educational Disclaimer */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-blue-600 text-sm font-semibold">?</span>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-blue-900">
                    📊 O que é Drawdown?
                  </p>
                  <p className="text-blue-800 leading-relaxed">
                    <strong>Drawdown</strong> mede quanto sua carteira caiu
                    desde o melhor momento (pico de retorno). Por exemplo: se
                    sua carteira estava com{" "}
                    <span className="font-semibold">+5% de lucro</span> e agora
                    está com{" "}
                    <span className="font-semibold">-2% de prejuízo</span>, o
                    drawdown é de <span className="font-semibold">7%</span> (a
                    diferença entre +5% e -2%).
                  </p>
                  <p className="text-blue-700 text-xs">
                    💡 <strong>Dica:</strong> Drawdowns são normais no
                    investimento. Eles ajudam a medir o risco e entender os
                    períodos difíceis da carteira.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Drawdown</CardTitle>
              <CardDescription>
                Períodos de queda desde o pico anterior da carteira
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 md:px-6">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <AreaChart
                  data={analytics.drawdownHistory}
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                  <defs>
                    <linearGradient
                      id="colorDrawdown"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: any) => `${Number(value).toFixed(2)}%`}
                    labelFormatter={(label) => formatTooltipLabel(label, analytics.drawdownHistory)}
                    contentStyle={{ fontSize: "12px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="drawdown"
                    name="Drawdown"
                    stroke="#ef4444"
                    fillOpacity={1}
                    fill="url(#colorDrawdown)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Drawdown Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Drawdown Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {summary.currentDrawdown > 0
                    ? `-${summary.currentDrawdown.toFixed(2)}%`
                    : "0%"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {summary.currentDrawdown > 0 ? "Em drawdown" : "Sem drawdown"}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Maior Drawdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  -{summary.maxDrawdownDepth.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  Máximo histórico
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Tempo de Recuperação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.averageRecoveryTime > 0
                    ? `${summary.averageRecoveryTime.toFixed(0)} meses`
                    : "-"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Média de {summary.drawdownCount} períodos
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Drawdown Periods Table */}
          {analytics.drawdownPeriods.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Períodos de Drawdown</CardTitle>
                <CardDescription>
                  Histórico completo de todas as quedas e recuperações
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Início</th>
                        <th className="text-left py-2 px-2">Fim</th>
                        <th className="text-right py-2 px-2">Profundidade</th>
                        <th className="text-right py-2 px-2">Duração</th>
                        <th className="text-center py-2 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.drawdownPeriods.map((period, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-2 px-2 text-sm">
                            {formatMonthYearLong(period.startDate)}
                          </td>
                          <td className="py-2 px-2 text-sm">
                            {period.endDate
                              ? formatMonthYearLong(period.endDate)
                              : "-"}
                          </td>
                          <td className="py-2 px-2 text-sm text-right text-red-600 font-semibold">
                            -{period.depth.toFixed(2)}%
                          </td>
                          <td className="py-2 px-2 text-sm text-right">
                            {period.duration}{" "}
                            {period.duration === 1 ? "mês" : "meses"}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {period.recovered ? (
                              <Badge variant="default" className="bg-green-600">
                                Recuperado
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Em curso</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Retornos Mensais</CardTitle>
              <CardDescription>Performance mensal da carteira</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Média Mensal: </span>
                  <span className="font-semibold">
                    {summary.averageMonthlyReturn.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="px-2 md:px-6">
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart
                    data={analytics.monthlyReturns}
                    margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="opacity-30"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateShort}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={(value) => `${value.toFixed(0)}%`}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: any) => `${Number(value).toFixed(2)}%`}
                      labelFormatter={(label) => {
                        // Para o gráfico de barras, usar formatMonthYearLong mas com "Atual" para último ponto
                        if (!analytics.monthlyReturns || analytics.monthlyReturns.length === 0) return formatMonthYearLong(label);
                        const lastDate = analytics.monthlyReturns[analytics.monthlyReturns.length - 1]?.date;
                        const isLastPoint = label === lastDate;
                        return isLastPoint ? `📍 Atual (${formatMonthYearLong(label)})` : formatMonthYearLong(label);
                      }}
                      contentStyle={{ fontSize: "12px" }}
                    />
                    <Bar
                      dataKey="return"
                      name="Retorno"
                      fill="#8884d8"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Returns Table */}
          <Card>
            <CardHeader>
              <CardTitle>Tabela de Retornos Mensais</CardTitle>
              <CardDescription>
                Rentabilidade detalhada mês a mês
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Retorno</TableHead>
                      <TableHead className="text-center">
                        Classificação
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.monthlyReturns.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {formatMonthYearLong(item.date)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            item.return >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {item.return >= 0 ? "+" : ""}
                          {item.return.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-center">
                          {item.return >= 0 ? (
                            <TrendingUp className="inline h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="inline h-4 w-4 text-red-600" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Função utilitária para invalidar TODOS os caches de uma carteira
 * Deve ser chamada quando qualquer escrita acontecer (criar, editar, deletar transações, etc)
 *
 * @deprecated Use portfolioCache.invalidateAll() diretamente do @/lib/portfolio-cache
 */
export function invalidatePortfolioAnalyticsCache(portfolioId: string) {
  portfolioCache.invalidateAll(portfolioId);
}
