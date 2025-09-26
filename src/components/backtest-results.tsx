'use client';

import { useState, useRef } from 'react';
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
    rebalanceAmount?: number;
    averagePrice?: number;
    totalShares?: number;
    totalDividends?: number;
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
  // CORREÇÃO: Ganho de Capital já inclui dividendos reinvestidos no valor final
  const capitalGain = result.finalValue - result.totalInvested;
  const totalDividends = result.totalDividendsReceived || 0;
  const totalGain = capitalGain; // NÃO somar dividendos - eles já estão no valor final
  
  // Calcular ganho total pela soma dos ativos para comparação/esclarecimento
  const calculateTotalGainFromAssets = () => {
    if (!result.assetPerformance || result.assetPerformance.length === 0) {
      return totalGain; // Fallback para o cálculo principal
    }

    let totalGainFromAssets = 0;
    
    result.assetPerformance.forEach(asset => {
      // Usar a mesma lógica do cálculo por ativo
      const directContribution = asset.contribution || 0;
      const reinvestment = asset.reinvestment || 0;
      const rebalanceInvestment = (asset.rebalanceAmount || 0) > 0 ? (asset.rebalanceAmount || 0) : 0;
      const totalInvestedInAsset = directContribution + reinvestment + rebalanceInvestment;
      
      const realizedProfits = (asset.rebalanceAmount || 0) < 0 ? Math.abs(asset.rebalanceAmount || 0) : 0;
      const assetGain = (asset.finalValue || 0) + realizedProfits - totalInvestedInAsset;
      
      totalGainFromAssets += assetGain;
    });
    
    return totalGainFromAssets;
  };

  const totalGainFromAssets = calculateTotalGainFromAssets();
  const gainPercentage = result.totalInvested > 0 ? (totalGain / result.totalInvested) * 100 : 0;
  const totalMonths = (result.positiveMonths || 0) + (result.negativeMonths || 0);
  const consistencyRate = totalMonths > 0 ? ((result.positiveMonths || 0) / totalMonths) * 100 : 0;
  const averageMonthlyReturn = result.monthlyReturns && result.monthlyReturns.length > 0 
    ? result.monthlyReturns.reduce((sum, month) => sum + (month.return || 0), 0) / result.monthlyReturns.length
    : 0;

  // Calcular sequências de meses positivos e negativos
  const calculateStreaks = () => {
    if (!result.monthlyReturns || result.monthlyReturns.length === 0) {
      return { longestPositiveStreak: 0, longestNegativeStreak: 0 };
    }

    let longestPositiveStreak = 0;
    let longestNegativeStreak = 0;
    let currentPositiveStreak = 0;
    let currentNegativeStreak = 0;

    for (const month of result.monthlyReturns) {
      const monthReturn = month.return || 0;
      
      if (monthReturn > 0) {
        currentPositiveStreak++;
        currentNegativeStreak = 0;
        longestPositiveStreak = Math.max(longestPositiveStreak, currentPositiveStreak);
      } else if (monthReturn < 0) {
        currentNegativeStreak++;
        currentPositiveStreak = 0;
        longestNegativeStreak = Math.max(longestNegativeStreak, currentNegativeStreak);
      } else {
        // Mês neutro (retorno = 0) quebra ambas as sequências
        currentPositiveStreak = 0;
        currentNegativeStreak = 0;
      }
    }

    return { longestPositiveStreak, longestNegativeStreak };
  };

  const { longestPositiveStreak, longestNegativeStreak } = calculateStreaks();

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
      // Scroll para a área da paginação após mudança de página
      setTimeout(() => {
        evolutionTableRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      // Scroll para a área da paginação após mudança de página
      setTimeout(() => {
        evolutionTableRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // Scroll para a área da paginação após mudança de página
      setTimeout(() => {
        evolutionTableRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
  };

  // Refs para scroll automático
  const evolutionTableRef = useRef<HTMLDivElement>(null);

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
      
      // Usar preço médio do backend (já calculado corretamente)
      // O preço médio agora considera apenas o custo das compras, não as vendas
      const averagePrice = asset.averagePrice || 0;
      
      // PERSPECTIVA DO INVESTIDOR: Calcular total investido considerando TODOS os aportes
      // Aportes diretos + dividendos/sobras reinvestidos + rebalanceamento positivo
      const directContribution = asset.contribution || 0;
      const reinvestment = asset.reinvestment || 0;
      const rebalanceInvestment = (asset.rebalanceAmount || 0) > 0 ? (asset.rebalanceAmount || 0) : 0;
      const totalInvested = directContribution + reinvestment + rebalanceInvestment;
      
      custodyInfo[asset.ticker] = {
        quantity: finalQuantity,
        averagePrice: averagePrice,
        totalInvested: totalInvested
      };
    });

    return custodyInfo;
  };

  const assetCustodyInfo = calculateAssetCustodyInfo();

  // Verificar se houve ajuste de período comparando com o primeiro mês dos resultados
  const originalStartDate = config?.startDate;
  const originalEndDate = config?.endDate;
  
  // Pegar o primeiro e último mês dos resultados (dados ordenados cronologicamente)
  const firstMonthResult = result.monthlyReturns && result.monthlyReturns.length > 0 
    ? result.monthlyReturns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
    : null;
  const lastMonthResult = result.monthlyReturns && result.monthlyReturns.length > 0 
    ? result.monthlyReturns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[result.monthlyReturns.length - 1]
    : null;

  // Verificar se as datas foram ajustadas
  const effectiveStartDate = firstMonthResult ? new Date(firstMonthResult.date) : null;
  const effectiveEndDate = lastMonthResult ? new Date(lastMonthResult.date) : null;
  
  const startDateAdjusted = originalStartDate && effectiveStartDate && 
    (originalStartDate.getFullYear() !== effectiveStartDate.getFullYear() || 
     originalStartDate.getMonth() !== effectiveStartDate.getMonth());
  
  const endDateAdjusted = originalEndDate && effectiveEndDate && 
    (originalEndDate.getFullYear() !== effectiveEndDate.getFullYear() || 
     originalEndDate.getMonth() !== effectiveEndDate.getMonth());
  
  const periodAdjusted = startDateAdjusted || endDateAdjusted;

  return (
    <div className="space-y-6">
      {/* Alerta de Período Ajustado */}
      {periodAdjusted && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                  📅 Período Ajustado Automaticamente
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                  O período do backtesting foi ajustado para o período ótimo onde todos os ativos possuem dados históricos disponíveis.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-amber-800 dark:text-amber-200">Período Solicitado:</span>
                    <br />
                    <span className="text-amber-700 dark:text-amber-300">
                      {originalStartDate?.toLocaleDateString('pt-BR')} - {originalEndDate?.toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-amber-800 dark:text-amber-200">Período Efetivo:</span>
                    <br />
                    <span className="text-amber-700 dark:text-amber-300">
                      {effectiveStartDate?.toLocaleDateString('pt-BR')} - {effectiveEndDate?.toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                {result.dataQualityIssues && result.dataQualityIssues.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-700">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                      Limitações de dados identificadas:
                    </p>
                    <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
                      {result.dataQualityIssues.map((issue, index) => (
                        <li key={index} className="flex items-start gap-1">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header com Resumo */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
        <CardHeader>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg sm:text-2xl flex items-center gap-2 flex-wrap">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
                  <span className="truncate">Resultados do Backtesting</span>
                  {periodAdjusted && (
                    <Badge variant="outline" className="text-xs sm:text-sm text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20 whitespace-nowrap">
                      <span className="hidden sm:inline">Período Ajustado</span>
                      <span className="sm:hidden">Ajustado</span>
                    </Badge>
                  )}
                </CardTitle>
                {config && (
                  <div className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1 text-xs sm:text-sm">
                      <span className="font-medium">{config.name}</span>
                      <span>•</span>
                      <span>{config.assets?.length || 0} ativos</span>
                      <span>•</span>
                      <span>{result.monthlyReturns?.length + 1 || 0} meses</span>
                    </div>
                    {periodAdjusted && (
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        Período: {effectiveStartDate?.toLocaleDateString('pt-BR')} - {effectiveEndDate?.toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Share2 className="w-4 h-4 mr-2" />
                  Compartilhar
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              </div> */}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center p-2 sm:p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Valor Final</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600 truncate">
                {formatCurrency(result.finalValue)}
              </p>
            </div>
            <div className="text-center p-2 sm:p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Ganho Total</p>
              <p className={`text-lg sm:text-2xl font-bold truncate ${totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalGain)}
              </p>
            </div>
            <div className="text-center p-2 sm:p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Retorno Total</p>
              <p className={`text-lg sm:text-2xl font-bold ${result.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(result.totalReturn)}
              </p>
            </div>
            <div className="text-center p-2 sm:p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Retorno Anual</p>
              <p className={`text-lg sm:text-2xl font-bold ${result.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(result.annualizedReturn)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
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
          description="Simulação: pagos em Mar/Ago/Out (33,33% cada)"
        />
      </div>

      {/* Tabs com Análises Detalhadas */}
      <Tabs defaultValue="overview" className="space-y-4">
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
              <TabsTrigger value="evolution" className="whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                Evolução
              </TabsTrigger>
              <TabsTrigger value="assets" className="whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                <span className="hidden sm:inline">Por Ativo</span>
                <span className="sm:hidden">Ativos</span>
              </TabsTrigger>
              <TabsTrigger value="transactions" className="whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                <span className="hidden sm:inline">Transações</span>
                <span className="sm:hidden">Trans.</span>
              </TabsTrigger>
              <TabsTrigger value="risk" className="whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                <span className="hidden sm:inline">Análise de Risco</span>
                <span className="sm:hidden">Risco</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

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
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base">Capital Próprio Investido:</span>
                  <span className="font-semibold text-sm sm:text-base">{formatCurrency(result.totalInvested)}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base">Valor Final:</span>
                  <span className="font-semibold text-sm sm:text-base">{formatCurrency(result.finalValue)}</span>
                </div>
                {result.finalCashReserve !== undefined && (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                    <span className="text-sm sm:text-base">Saldo em Caixa:</span>
                    <span className="font-semibold text-blue-600 text-sm sm:text-base">{formatCurrency(result.finalCashReserve || 0)}</span>
                  </div>
                )}
                {result.totalDividendsReceived !== undefined && result.totalDividendsReceived > 0 && (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                    <span className="text-sm sm:text-base">Dividendos Recebidos:</span>
                    <span className="font-semibold text-green-600 text-sm sm:text-base">{formatCurrency(result.totalDividendsReceived)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-base sm:text-lg">
                  <span>Ganho/Perda Total:</span>
                  <span className={`font-bold ${totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <span className="block sm:inline">{formatCurrency(totalGain)}</span>
                    <span className="block sm:inline sm:ml-1">({gainPercentage.toFixed(2)}%)</span>
                  </span>
                </div>
                {/* Informações sobre Dividendos */}
                {result.totalDividendsReceived !== undefined && result.totalDividendsReceived > 0 && (
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 pl-2 sm:pl-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                      <span>• Dividendos Recebidos e Reinvestidos:</span>
                      <span className="font-medium text-blue-600">
                        {formatCurrency(totalDividends)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Os dividendos foram automaticamente reinvestidos e já estão incluídos no ganho de capital acima.
                    </div>
                  </div>
                )}
                {result.totalDividendsReceived !== undefined && result.totalDividendsReceived > 0 && (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-sm text-gray-600 dark:text-gray-400">
                    <span>Yield sobre Investimento:</span>
                    <span className="font-medium text-green-600">
                      {((result.totalDividendsReceived / result.totalInvested) * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base">Retorno Médio Mensal:</span>
                  <span className={`font-semibold text-sm sm:text-base ${averageMonthlyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base">Meses Positivos:</span>
                  <Badge variant="default" className="bg-green-500 w-fit">
                    {result.positiveMonths}
                  </Badge>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base">Meses Negativos:</span>
                  <Badge variant="destructive" className="w-fit">
                    {result.negativeMonths}
                  </Badge>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base">Taxa de Acerto:</span>
                  <span className="font-semibold text-sm sm:text-base">{consistencyRate.toFixed(1)}%</span>
                </div>
                <Separator />
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base">Melhor Mês:</span>
                  <span className="font-semibold text-green-600 text-sm sm:text-base">
                    {formatPercentage(Math.max(...result.monthlyReturns.map(m => m.return)))}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base">Pior Mês:</span>
                  <span className="font-semibold text-red-600 text-sm sm:text-base">
                    {formatPercentage(Math.min(...result.monthlyReturns.map(m => m.return)))}
                  </span>
                </div>
                <Separator />
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base">Maior Sequência Positiva:</span>
                  <span className="font-semibold text-green-600 text-sm sm:text-base">
                    {longestPositiveStreak} {longestPositiveStreak === 1 ? 'mês' : 'meses'}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base">Maior Sequência Negativa:</span>
                  <span className="font-semibold text-red-600 text-sm sm:text-base">
                    {longestNegativeStreak} {longestNegativeStreak === 1 ? 'mês' : 'meses'}
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
                    <div ref={evolutionTableRef} className="overflow-x-auto">
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
                      <div className="mt-6 pt-4 border-t space-y-3">
                        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
                          <span className="block sm:inline">Página {currentPage} de {totalPages}</span>
                          <span className="hidden sm:inline"> • </span>
                          <span className="block sm:inline">Mostrando {startIndex + 1}-{Math.min(endIndex, sortedMonthlyReturns.length)} de {sortedMonthlyReturns.length} meses</span>
                        </div>
                        
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          {/* Primeira página */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(1)}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1 h-8 px-2 sm:px-3"
                            title="Primeira página"
                          >
                            <span className="text-xs sm:text-sm">««</span>
                            <span className="hidden lg:inline text-xs">Início</span>
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToPreviousPage}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1 h-8 px-2 sm:px-3"
                          >
                            <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Anterior</span>
                          </Button>
                          
                          {/* Números das páginas */}
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(totalPages <= 3 ? totalPages : 3, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage <= 2) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 1) {
                                pageNum = totalPages - 2 + i;
                              } else {
                                pageNum = currentPage - 1 + i;
                              }
                              
                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => goToPage(pageNum)}
                                  className="w-7 h-7 sm:w-8 sm:h-8 p-0 text-xs sm:text-sm"
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
                            className="flex items-center gap-1 h-8 px-2 sm:px-3"
                          >
                            <span className="hidden sm:inline">Próxima</span>
                            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                          
                          {/* Última página */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1 h-8 px-2 sm:px-3"
                            title="Última página"
                          >
                            <span className="hidden lg:inline text-xs">Fim</span>
                            <span className="text-xs sm:text-sm">»»</span>
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
              {/* Esclarecimento sobre diferença metodológica */}
              {Math.abs(totalGain - totalGainFromAssets) > 0.01 && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                    <p className="font-medium">📊 Diferença Metodológica</p>
                    <div className="text-xs space-y-1">
                      <p>• <strong>Ganho total da carteira:</strong> {formatCurrency(totalGain)} (valor final - capital próprio + dividendos)</p>
                      <p>• <strong>Soma dos ganhos por ativo:</strong> {formatCurrency(totalGainFromAssets)} (considera reinvestimentos)</p>
                      <p>• <strong>Diferença:</strong> {formatCurrency(Math.abs(totalGain - totalGainFromAssets))}</p>
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      A diferença ocorre porque os ganhos por ativo consideram dividendos reinvestidos como &quot;custo&quot;, 
                      enquanto o ganho total da carteira reflete o retorno real sobre o capital próprio investido.
                    </p>
                  </div>
                </div>
              )}
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
                        
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Valor Final</p>
                            <p className="font-semibold">{formatCurrency(asset.finalValue || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Aportes Diretos</p>
                            <p className="font-semibold text-blue-600">{formatCurrency(asset.contribution || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Dividendos + Sobras Aportados</p>
                            <p className="font-semibold text-green-600">{formatCurrency(asset.reinvestment || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Rebalanceamento</p>
                            <p className={`font-semibold ${(asset.rebalanceAmount || 0) >= 0 ? 'text-purple-600' : 'text-orange-600'}`}>
                              {formatCurrency(asset.rebalanceAmount || 0)}
                            </p>
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
                              <strong>Total Aportado:</strong> {formatCurrency(custodyInfo.totalInvested)} • 
                              <strong> Valor Atual:</strong> {formatCurrency(asset.finalValue || 0)}
                              {(asset.rebalanceAmount || 0) < 0 && (
                                <span> • <strong>Lucro Realizado:</strong> {formatCurrency(Math.abs(asset.rebalanceAmount || 0))}</span>
                              )}
                            </p>
                            <p>
                              <strong>Ganho Total:</strong> <span className={(() => {
                                // CORREÇÃO: Ganho total = valor atual + lucros realizados - total aportado (incluindo dividendos e rebalanceamento)
                                const realizedProfits = (asset.rebalanceAmount || 0) < 0 ? Math.abs(asset.rebalanceAmount || 0) : 0;
                                const totalGain = (asset.finalValue || 0) + realizedProfits - custodyInfo.totalInvested;
                                return totalGain >= 0 ? 'text-green-600' : 'text-red-600';
                              })()}>
                                {(() => {
                                  const realizedProfits = (asset.rebalanceAmount || 0) < 0 ? Math.abs(asset.rebalanceAmount || 0) : 0;
                                  const totalGain = (asset.finalValue || 0) + realizedProfits - custodyInfo.totalInvested;
                                  return formatCurrency(totalGain);
                                })()}
                              </span>
                              <span className="text-xs text-gray-500 ml-2">
                                ({formatCurrency(asset.finalValue || 0)} atual + {formatCurrency((asset.rebalanceAmount || 0) < 0 ? Math.abs(asset.rebalanceAmount || 0) : 0)} realizado - {formatCurrency(custodyInfo.totalInvested)} total aportado)
                              </span>
                            </p>
                            {(asset.rebalanceAmount || 0) !== 0 && (
                              <div className="text-xs text-gray-400 space-y-1">
                                <p>
                                  <strong>Composição do total aportado:</strong> {formatCurrency(asset.contribution || 0)} (aportes diretos) + {formatCurrency(asset.reinvestment || 0)} (dividendos/sobras) + {formatCurrency(asset.rebalanceAmount || 0)} (rebalanceamento)
                                </p>
                                {(asset.rebalanceAmount || 0) < 0 && (
                                  <p className="text-blue-500">
                                    <strong>💡 Rebalanceamento negativo:</strong> Vendas que devolveram R$ {formatCurrency(Math.abs(asset.rebalanceAmount || 0))} ao seu bolso (lucro realizado incluído no ganho total).
                                  </p>
                                )}
                                {(asset.rebalanceAmount || 0) > 0 && (
                                  <p className="text-purple-500">
                                    <strong>💡 Rebalanceamento positivo:</strong> R$ {formatCurrency(asset.rebalanceAmount || 0)} aportados neste ativo através de rebalanceamento (incluído no total aportado para cálculo do ganho).
                                  </p>
                                )}
                              </div>
                            )}
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
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 flex items-center justify-center ${color === 'blue' ? 'bg-blue-500' : 
                                          color === 'green' ? 'bg-green-500' :
                                          color === 'red' ? 'bg-red-500' :
                                          color === 'orange' ? 'bg-orange-500' :
                                          'bg-purple-500'}`}>
            <div className="w-4 h-4 sm:w-5 sm:h-5 text-white flex items-center justify-center">
              {icon}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium opacity-80 truncate">{title}</p>
            <p className="text-lg sm:text-2xl font-bold truncate">{value}</p>
            {description && (
              <p className="text-xs opacity-70 mt-1 line-clamp-2">{description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
