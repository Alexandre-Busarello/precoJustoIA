'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target, 
  Calendar,
  DollarSign,
  BarChart3,
  PieChart,
  AlertTriangle,
  Info,
  Download,
  Share2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { BacktestTransactions } from './backtest-transactions';

// Interfaces
interface BacktestResult {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number | null;
  maxDrawdown: number;
  positiveMonths: number;
  negativeMonths: number;
  totalInvested: number;
  finalValue: number;
  finalCashReserve?: number; // Saldo de caixa final
  totalDividendsReceived?: number; // Total de dividendos recebidos
  monthlyReturns: Array<{
    date: string;
    return: number;
    portfolioValue: number;
    contribution: number;
  }>;
  assetPerformance: Array<{
    ticker: string;
    allocation: number;
    finalValue: number;
    totalReturn: number;
    contribution: number;
    reinvestment: number;
  }>;
  portfolioEvolution: Array<{
    date: string;
    value: number;
    holdings: Record<string, number>;
    monthlyReturn: number;
  }>;
  dataValidation?: any;
  dataQualityIssues?: string[];
  effectiveStartDate?: Date;
  effectiveEndDate?: Date;
  actualInvestment?: number;
  plannedInvestment?: number;
  missedContributions?: number;
  missedAmount?: number;
}

interface BacktestConfig {
  name: string;
  description?: string;
  assets: Array<{
    ticker: string;
    companyName?: string;
    allocation: number;
  }>;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  monthlyContribution: number;
  rebalanceFrequency: 'monthly' | 'quarterly' | 'yearly';
}

interface BacktestTransaction {
  id: string;
  month: number;
  date: string;
  ticker: string;
  transactionType: 'CONTRIBUTION' | 'REBALANCE_BUY' | 'REBALANCE_SELL' | 'CASH_RESERVE' | 'CASH_CREDIT' | 'CASH_DEBIT' | 'DIVIDEND_PAYMENT';
  contribution: number;
  price: number;
  sharesAdded: number;
  totalShares: number;
  dividendAmount?: number; // Valor de dividendos (apenas para DIVIDEND_PAYMENT)
  totalInvested: number;
  cashReserved?: number | null;
  totalContribution: number;
  portfolioValue: number;
  cashBalance: number;
}

interface BacktestResultsProps {
  result: BacktestResult;
  validation?: any;
  config?: BacktestConfig | null;
  transactions?: BacktestTransaction[];
}

export function BacktestResults({ result, config, transactions }: BacktestResultsProps) {
  // Debug: verificar se as transações estão chegando
  console.log('🔍 BacktestResults - Transações recebidas:', transactions?.length || 0);
  console.log('📋 Primeira transação:', transactions?.[0] || 'Nenhuma');

  // Estado para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; // 12 meses por página
  
  // Funções de formatação
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };


  // Calcular métricas derivadas
  // Ganho Total = Ganho de Capital + Dividendos Recebidos
  const capitalGain = result.finalValue - result.totalInvested;
  const totalDividends = result.totalDividendsReceived || 0;
  const totalGain = capitalGain + totalDividends;
  const gainPercentage = result.totalInvested > 0 ? (totalGain / result.totalInvested) * 100 : 0;
  const totalMonths = (result.positiveMonths || 0) + (result.negativeMonths || 0);
  const consistencyRate = totalMonths > 0 ? ((result.positiveMonths || 0) / totalMonths) * 100 : 0;
  const averageMonthlyReturn = result.monthlyReturns && result.monthlyReturns.length > 0 
    ? result.monthlyReturns.reduce((sum, month) => sum + (month.return || 0), 0) / result.monthlyReturns.length
    : 0;

  // Preparar dados para o gráfico
  const chartData = result.monthlyReturns && result.monthlyReturns.length > 0 
    ? result.monthlyReturns.map((month, index) => ({
        month: new Date(month.date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        value: month.portfolioValue,
        contribution: month.contribution,
        return: month.return * 100, // Converter para porcentagem
        cumulativeReturn: index === 0 ? 0 : 
          ((month.portfolioValue - (result.monthlyReturns[0]?.portfolioValue || 0)) / 
           (result.monthlyReturns[0]?.portfolioValue || 1)) * 100
      }))
    : [];

  // Ordenar dados por data mais recente e lógica de paginação
  const sortedMonthlyReturns = result.monthlyReturns && result.monthlyReturns.length > 0 
    ? [...result.monthlyReturns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];
  
  const totalPages = Math.ceil(sortedMonthlyReturns.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = sortedMonthlyReturns.slice(startIndex, endIndex);

  // Funções de navegação
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Calcular informações de custódia por ativo com preço médio ponderado
  const calculateAssetCustodyInfo = () => {
    if (!result.portfolioEvolution || result.portfolioEvolution.length === 0 || !result.assetPerformance) {
      return {};
    }

    const custodyInfo: Record<string, { quantity: number; averagePrice: number; totalInvested: number }> = {};
    
    // Para cada ativo, calcular baseado nos dados de performance
    result.assetPerformance.forEach(asset => {
      // Pegar quantidade final do último mês
      const lastMonth = result.portfolioEvolution[result.portfolioEvolution.length - 1];
      const finalQuantity = lastMonth?.holdings?.[asset.ticker] || 0;
      
      // O total investido vem da contribuição do ativo
      const totalInvested = asset.contribution || 0;
      
      // Usar preço médio real do backend (incluindo rebalanceamentos) se disponível
      // Caso contrário, calcular baseado no total investido (apenas aportes)
      const averagePrice = (asset as any).averagePrice || 
        (finalQuantity > 0 ? totalInvested / finalQuantity : 0);
      
      custodyInfo[asset.ticker] = {
        quantity: finalQuantity,
        averagePrice: averagePrice,
        totalInvested: totalInvested
      };
    });

    return custodyInfo;
  };

  const assetCustodyInfo = calculateAssetCustodyInfo();

  return (
    <div className="space-y-6">
      {/* Header com Resumo */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                Resultados do Backtesting
              </CardTitle>
              {config && (
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  {config.name} • {config.assets?.length || 0} ativos • {result.monthlyReturns?.length || 0} meses
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Compartilhar
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Valor Final</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(result.finalValue)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Ganho Total</p>
              <p className={`text-2xl font-bold ${totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalGain)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Retorno Total</p>
              <p className={`text-2xl font-bold ${result.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(result.totalReturn)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Retorno Anual</p>
              <p className={`text-2xl font-bold ${result.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(result.annualizedReturn)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Volatilidade"
          value={formatPercentage(result.volatility)}
          icon={<Activity />}
          color="orange"
          description="Risco anualizado da carteira"
        />
        <MetricCard
          title="Sharpe Ratio"
          value={result.sharpeRatio ? result.sharpeRatio.toFixed(2) : 'N/A'}
          icon={<Target />}
          color="purple"
          description="Retorno ajustado ao risco"
        />
        <MetricCard
          title="Drawdown Máximo"
          value={formatPercentage(result.maxDrawdown)}
          icon={<TrendingDown />}
          color="red"
          description="Maior perda do pico ao vale"
        />
        <MetricCard
          title="Consistência"
          value={`${consistencyRate.toFixed(1)}%`}
          icon={<Calendar />}
          color="blue"
          description={`${result.positiveMonths} meses positivos de ${result.positiveMonths + result.negativeMonths}`}
        />
        <MetricCard
          title="Dividendos Recebidos"
          value={result.totalDividendsReceived ? formatCurrency(result.totalDividendsReceived) : 'R$ 0,00'}
          icon={<DollarSign />}
          color="green"
          description="Total de dividendos pagos durante o período"
        />
      </div>

      {/* Tabs com Análises Detalhadas */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="evolution">Evolução</TabsTrigger>
          <TabsTrigger value="assets">Por Ativo</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="risk">Análise de Risco</TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Resumo Financeiro */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Resumo Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Investido:</span>
                  <span className="font-semibold">{formatCurrency(result.totalInvested)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valor Final:</span>
                  <span className="font-semibold">{formatCurrency(result.finalValue)}</span>
                </div>
                {result.finalCashReserve !== undefined && (
                  <div className="flex justify-between">
                    <span>Saldo em Caixa:</span>
                    <span className="font-semibold text-blue-600">{formatCurrency(result.finalCashReserve || 0)}</span>
                  </div>
                )}
                {result.totalDividendsReceived && result.totalDividendsReceived > 0 && (
                  <div className="flex justify-between">
                    <span>Dividendos Recebidos:</span>
                    <span className="font-semibold text-green-600">{formatCurrency(result.totalDividendsReceived)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg">
                  <span>Ganho/Perda Total:</span>
                  <span className={`font-bold ${totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totalGain)} ({gainPercentage.toFixed(2)}%)
                  </span>
                </div>
                {/* Decomposição do Ganho Total */}
                {result.totalDividendsReceived && result.totalDividendsReceived > 0 && (
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 pl-4">
                    <div className="flex justify-between">
                      <span>• Ganho de Capital:</span>
                      <span className={`font-medium ${capitalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(capitalGain)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Dividendos:</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(totalDividends)}
                      </span>
                    </div>
                  </div>
                )}
                {result.totalDividendsReceived && result.totalDividendsReceived > 0 && (
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Yield sobre Investimento:</span>
                    <span className="font-medium text-green-600">
                      {((result.totalDividendsReceived / result.totalInvested) * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Retorno Médio Mensal:</span>
                  <span className={`font-semibold ${averageMonthlyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(averageMonthlyReturn)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Estatísticas de Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Estatísticas de Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Meses Positivos:</span>
                  <Badge variant="default" className="bg-green-500">
                    {result.positiveMonths}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Meses Negativos:</span>
                  <Badge variant="destructive">
                    {result.negativeMonths}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Taxa de Acerto:</span>
                  <span className="font-semibold">{consistencyRate.toFixed(1)}%</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span>Melhor Mês:</span>
                  <span className="font-semibold text-green-600">
                    {formatPercentage(Math.max(...result.monthlyReturns.map(m => m.return)))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Pior Mês:</span>
                  <span className="font-semibold text-red-600">
                    {formatPercentage(Math.min(...result.monthlyReturns.map(m => m.return)))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Evolução da Carteira */}
        <TabsContent value="evolution">
          <div className="space-y-6">
            {/* Gráfico de Evolução */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Evolução da Carteira ao Longo do Tempo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => formatCurrency(value)}
                        />
                        <Tooltip 
                          formatter={(value, name) => {
                            if (name === 'value') return [formatCurrency(Number(value)), 'Valor da Carteira'];
                            if (name === 'contribution') return [formatCurrency(Number(value)), 'Aporte Mensal'];
                            return [value, name];
                          }}
                          labelFormatter={(label) => `Mês: ${label}`}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#3b82f6" 
                          fill="#3b82f6" 
                          fillOpacity={0.3}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-80 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500">Nenhum dado disponível para o gráfico</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabela de Dados Mensais com Paginação */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Dados Mensais Detalhados
                  </CardTitle>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {sortedMonthlyReturns.length} meses total
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {paginatedData.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3">Mês</th>
                            <th className="text-right p-3">Valor da Carteira</th>
                            <th className="text-right p-3">Retorno Mensal</th>
                            <th className="text-right p-3">Aporte</th>
                            <th className="text-right p-3">Variação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedData.map((month, index) => {
                            const actualIndex = startIndex + index;
                            // CORREÇÃO: Para dados ordenados por data decrescente, o mês anterior é o próximo no array
                            const previousMonth = actualIndex < sortedMonthlyReturns.length - 1 ? sortedMonthlyReturns[actualIndex + 1] : null;
                            const variation = previousMonth ? ((month.portfolioValue - previousMonth.portfolioValue) / previousMonth.portfolioValue) * 100 : 0;
                            
                            return (
                              <tr key={actualIndex} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="p-3 font-medium">
                                  {new Date(month.date).toLocaleDateString('pt-BR', { 
                                    month: 'short', 
                                    year: 'numeric' 
                                  })}
                                </td>
                                <td className="text-right p-3 font-mono font-semibold">
                                  {formatCurrency(month.portfolioValue || 0)}
                                </td>
                                <td className={`text-right p-3 font-mono ${(month.return || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatPercentage(month.return || 0)}
                                </td>
                                <td className="text-right p-3 font-mono text-blue-600">
                                  {formatCurrency(month.contribution || 0)}
                                </td>
                                <td className={`text-right p-3 font-mono ${variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {variation.toFixed(2)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Controles de Paginação */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6 pt-4 border-t">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Página {currentPage} de {totalPages} • 
                          Mostrando {startIndex + 1}-{Math.min(endIndex, sortedMonthlyReturns.length)} de {sortedMonthlyReturns.length} meses
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToPreviousPage}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="w-4 h-4" />
                            Anterior
                          </Button>
                          
                          {/* Números das páginas */}
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }
                              
                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => goToPage(pageNum)}
                                  className="w-8 h-8 p-0"
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages}
                          >
                            Próxima
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Nenhum dado mensal disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance por Ativo */}
        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Performance por Ativo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {result.assetPerformance && result.assetPerformance.length > 0 ? (
                  result.assetPerformance.map((asset) => {
                    const custodyInfo = assetCustodyInfo[asset.ticker];
                    
                    return (
                      <div key={asset.ticker} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">{asset.ticker}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Alocação: {formatPercentage(asset.allocation || 0)}
                            </p>
                          </div>
                          <Badge 
                            variant={(asset.totalReturn || 0) >= 0 ? "default" : "destructive"}
                            className={(asset.totalReturn || 0) >= 0 ? "bg-green-500" : ""}
                          >
                            {formatPercentage(asset.totalReturn || 0)}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Valor Final</p>
                            <p className="font-semibold">{formatCurrency(asset.finalValue || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Aportes (+ Dividendos Reinvestidos)</p>
                            <p className="font-semibold text-blue-600">{formatCurrency(asset.contribution || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Sobras Utilizadas</p>
                            <p className="font-semibold text-green-600">{formatCurrency(asset.reinvestment || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Qtd. em Custódia</p>
                            <p className="font-semibold">
                              {custodyInfo ? custodyInfo.quantity.toLocaleString('pt-BR', { 
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2 
                              }) : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Preço Médio Final</p>
                            <p className="font-semibold">
                              {custodyInfo ? formatCurrency(custodyInfo.averagePrice) : 'N/A'}
                            </p>
                          </div>
                        </div>
                        
                        {custodyInfo && (
                          <div className="mt-3 pt-3 border-t text-xs text-gray-500 dark:text-gray-400 space-y-1">
                            <p>
                              <strong>Posição Final:</strong> {custodyInfo.quantity.toLocaleString('pt-BR', { 
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2 
                              })} cotas × {formatCurrency(custodyInfo.averagePrice)} (preço médio)
                            </p>
                            <p>
                              <strong>Total Investido:</strong> {formatCurrency(custodyInfo.totalInvested)} • 
                              <strong> Valor Atual:</strong> {formatCurrency(asset.finalValue || 0)} • 
                              <strong> Ganho:</strong> <span className={(asset.finalValue || 0) >= custodyInfo.totalInvested ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency((asset.finalValue || 0) - custodyInfo.totalInvested)}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    <PieChart className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Nenhum dado de performance por ativo disponível</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Histórico de Transações */}
        <TabsContent value="transactions">
          <BacktestTransactions transactions={transactions || []} />
        </TabsContent>

        {/* Análise de Risco */}
        <TabsContent value="risk">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Métricas de Risco
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Volatilidade Anualizada:</span>
                    <span className="font-semibold">{formatPercentage(result.volatility)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Drawdown Máximo:</span>
                    <span className="font-semibold text-red-600">{formatPercentage(result.maxDrawdown)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sharpe Ratio:</span>
                    <span className="font-semibold">
                      {result.sharpeRatio ? result.sharpeRatio.toFixed(2) : 'N/A'}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span>Desvio Padrão Mensal:</span>
                    <span className="font-semibold">
                      {formatPercentage(result.volatility / Math.sqrt(12))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Interpretação dos Riscos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <h5 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
                    Volatilidade: {formatPercentage(result.volatility)}
                  </h5>
                  <p className="text-blue-700 dark:text-blue-300">
                    {result.volatility < 0.15 ? 'Baixa volatilidade - carteira conservadora' :
                     result.volatility < 0.25 ? 'Volatilidade moderada - carteira equilibrada' :
                     'Alta volatilidade - carteira agressiva'}
                  </p>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                  <h5 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
                    Drawdown: {formatPercentage(result.maxDrawdown)}
                  </h5>
                  <p className="text-amber-700 dark:text-amber-300">
                    {result.maxDrawdown < 0.10 ? 'Baixo risco de perdas significativas' :
                     result.maxDrawdown < 0.20 ? 'Risco moderado - perdas controláveis' :
                     'Alto risco - possibilidade de perdas significativas'}
                  </p>
                </div>

                {result.sharpeRatio && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <h5 className="font-semibold text-green-800 dark:text-green-200 mb-1">
                      Sharpe Ratio: {result.sharpeRatio.toFixed(2)}
                    </h5>
                    <p className="text-green-700 dark:text-green-300">
                      {result.sharpeRatio > 1 ? 'Excelente retorno ajustado ao risco' :
                       result.sharpeRatio > 0.5 ? 'Bom retorno ajustado ao risco' :
                       'Retorno baixo em relação ao risco assumido'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Informações sobre Qualidade dos Dados */}
      {(result.dataQualityIssues && result.dataQualityIssues.length > 0) && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
              <AlertTriangle className="w-5 h-5" />
              Observações sobre os Dados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-orange-700 dark:text-orange-300">
              {result.dataQualityIssues.map((issue, index) => (
                <li key={index}>• {issue}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Componente auxiliar para cards de métricas
interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'red' | 'orange' | 'purple';
  description?: string;
}

function MetricCard({ title, value, icon, color, description }: MetricCardProps) {
  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50 dark:bg-blue-950/20 text-blue-600',
    green: 'border-green-200 bg-green-50 dark:bg-green-950/20 text-green-600',
    red: 'border-red-200 bg-red-50 dark:bg-red-950/20 text-red-600',
    orange: 'border-orange-200 bg-orange-50 dark:bg-orange-950/20 text-orange-600',
    purple: 'border-purple-200 bg-purple-50 dark:bg-purple-950/20 text-purple-600'
  };

  return (
    <Card className={colorClasses[color]}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color === 'blue' ? 'bg-blue-500' : 
                                          color === 'green' ? 'bg-green-500' :
                                          color === 'red' ? 'bg-red-500' :
                                          color === 'orange' ? 'bg-orange-500' :
                                          'bg-purple-500'}`}>
            <div className="w-5 h-5 text-white">
              {icon}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium opacity-80">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs opacity-70 mt-1">{description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
