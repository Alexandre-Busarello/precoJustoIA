'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
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
  ChevronRight,
  LineChart as LineChartIcon
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Line,
  LineChart,
  Legend
} from 'recharts';
import { BacktestTransactions } from './backtest-transactions';
import {
  alignBenchmarkDates,
  type BenchmarkData
} from '@/lib/benchmark-service';

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
  // Ref para scroll automático ao carregar resultados
  const resultsTopRef = useRef<HTMLDivElement>(null);
  
  // Scroll automático para o topo quando os resultados carregam
  useEffect(() => {
    if (resultsTopRef.current) {
      // Pequeno delay para garantir que o componente está totalmente renderizado
      setTimeout(() => {
        resultsTopRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
  }, [result]); // Dispara quando result muda (novo backtest carregado)
  

  // Estado para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; // 12 meses por página
  
  // Estados para benchmarks
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [loadingBenchmarks, setLoadingBenchmarks] = useState(true);
  const [showBenchmarks, setShowBenchmarks] = useState(true);
  
  // Buscar dados de benchmarks quando o componente montar
  useEffect(() => {
    async function loadBenchmarks() {
      if (!config || !result.monthlyReturns || result.monthlyReturns.length === 0) {
        setLoadingBenchmarks(false);
        return;
      }

      try {
        setLoadingBenchmarks(true);
        
        // Usar as datas efetivas do backtest
        const sortedReturns = [...result.monthlyReturns].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        const startDate = new Date(sortedReturns[0].date);
        const endDate = new Date(sortedReturns[sortedReturns.length - 1].date);
        
        console.log('📊 Buscando benchmarks para período:', startDate, '-', endDate);
        
        // Buscar benchmarks via API (servidor)
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        const response = await fetch(`/api/benchmarks?startDate=${startDateStr}&endDate=${endDateStr}`);
        
        if (!response.ok) {
          throw new Error('Erro ao buscar benchmarks');
        }
        
        const data = await response.json();
        setBenchmarkData(data);
        
        console.log('✅ Benchmarks carregados:', {
          cdi: data.cdi.length,
          ibov: data.ibov.length
        });
      } catch (error) {
        console.error('❌ Erro ao carregar benchmarks:', error);
        setBenchmarkData(null);
      } finally {
        setLoadingBenchmarks(false);
      }
    }

    loadBenchmarks();
  }, [config, result.monthlyReturns]);
  
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
  const totalMonths = (result.positiveMonths || 0) + (result.negativeMonths || 0);
  const consistencyRate = totalMonths > 0 ? ((result.positiveMonths || 0) / totalMonths) * 100 : 0;
  // CORREÇÃO: Calcular retorno médio mensal baseado no retorno anualizado (composição correta)
  // Fórmula: (1 + retorno_anual)^(1/12) - 1
  const averageMonthlyReturn = result.annualizedReturn > -1 
    ? Math.pow(1 + result.annualizedReturn, 1/12) - 1
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

  // Calcular métricas de recuperação após perdas
  const calculateRecoveryMetrics = () => {
    if (!result.monthlyReturns || result.monthlyReturns.length === 0) {
      return {
        averageRecoveryTime: 0,
        maxRecoveryTime: 0,
        recoveryCount: 0,
        recoverySuccessRate: 0,
        avgLossBeforeRecovery: 0,
        recoveryPeriods: [],
        isCurrentlyInDrawdown: false,
        currentDrawdownDuration: 0
      };
    }

    // Ordenar por data para análise cronológica
    const sortedReturns = [...result.monthlyReturns].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const recoveryPeriods: Array<{
      startMonth: number;
      endMonth: number;
      duration: number;
      maxLoss: number;
      startValue: number;
      endValue: number;
      isComplete: boolean;
    }> = [];

    let currentPeak = sortedReturns[0]?.portfolioValue || 0;
    let currentPeakIndex = 0;
    let inDrawdown = false;
    let drawdownStartIndex = 0;
    let maxDrawdownInPeriod = 0;
    let drawdownStartValue = 0;

    for (let i = 1; i < sortedReturns.length; i++) {
      const currentValue = sortedReturns[i].portfolioValue;
      
      if (currentValue > currentPeak) {
        // Novo pico - se estávamos em drawdown, registrar recuperação COMPLETA
        if (inDrawdown) {
          const recoveryDuration = i - drawdownStartIndex;
          recoveryPeriods.push({
            startMonth: drawdownStartIndex,
            endMonth: i,
            duration: recoveryDuration,
            maxLoss: maxDrawdownInPeriod,
            startValue: drawdownStartValue,
            endValue: currentValue,
            isComplete: true // Recuperação completa - superou o pico anterior
          });
          inDrawdown = false;
        }
        
        currentPeak = currentValue;
        currentPeakIndex = i;
        maxDrawdownInPeriod = 0;
      } else if (currentValue < currentPeak) {
        // Valor abaixo do pico
        if (!inDrawdown) {
          // Início de um novo drawdown
          inDrawdown = true;
          drawdownStartIndex = currentPeakIndex;
          drawdownStartValue = currentPeak;
        }
        
        const currentDrawdown = (currentPeak - currentValue) / currentPeak;
        maxDrawdownInPeriod = Math.max(maxDrawdownInPeriod, currentDrawdown);
      }
    }

    // Verificar se terminou em drawdown não recuperado
    const finalValue = sortedReturns[sortedReturns.length - 1]?.portfolioValue || 0;
    const isCurrentlyInDrawdown = inDrawdown && finalValue < currentPeak;
    const currentDrawdownDuration = isCurrentlyInDrawdown ? sortedReturns.length - 1 - drawdownStartIndex : 0;

    // CORREÇÃO CRÍTICA: Só considerar recuperações COMPLETAS e significativas
    // Filtrar apenas recuperações que:
    // 1. Foram completadas (isComplete = true)
    // 2. Tiveram perdas > 5%
    // 3. Efetivamente superaram o pico anterior
    const significantCompleteRecoveries = recoveryPeriods.filter(period => 
      period.maxLoss > 0.05 && 
      period.isComplete && 
      period.endValue > period.startValue
    );
    
    const averageRecoveryTime = significantCompleteRecoveries.length > 0 
      ? significantCompleteRecoveries.reduce((sum, period) => sum + period.duration, 0) / significantCompleteRecoveries.length 
      : 0;
    
    const maxRecoveryTime = significantCompleteRecoveries.length > 0 
      ? Math.max(...significantCompleteRecoveries.map(period => period.duration)) 
      : 0;

    const avgLossBeforeRecovery = significantCompleteRecoveries.length > 0
      ? significantCompleteRecoveries.reduce((sum, period) => sum + period.maxLoss, 0) / significantCompleteRecoveries.length
      : 0;

    // Contar total de drawdowns significativos (incluindo o atual se existir)
    const allSignificantDrawdowns = recoveryPeriods.filter(period => period.maxLoss > 0.05).length + 
      (isCurrentlyInDrawdown && maxDrawdownInPeriod > 0.05 ? 1 : 0);
    
    const recoverySuccessRate = allSignificantDrawdowns > 0 
      ? (significantCompleteRecoveries.length / allSignificantDrawdowns) * 100 
      : 100;

    return {
      averageRecoveryTime,
      maxRecoveryTime,
      recoveryCount: significantCompleteRecoveries.length,
      recoverySuccessRate,
      avgLossBeforeRecovery,
      recoveryPeriods: significantCompleteRecoveries,
      isCurrentlyInDrawdown,
      currentDrawdownDuration
    };
  };

  const recoveryMetrics = calculateRecoveryMetrics();

  // Preparar dados para o gráfico com benchmarks
  const chartData = useMemo(() => {
    if (!result.monthlyReturns || result.monthlyReturns.length === 0) return [];
    
    // Ordenar dados cronologicamente
    let sortedReturns = [...result.monthlyReturns].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // CORREÇÃO: Se falta o primeiro mês, adicionar manualmente
    if (transactions && transactions.length > 0) {
      // Descobrir a data da primeira transação
      const sortedTransactions = [...transactions].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const firstTransactionDate = sortedTransactions[0]?.date.split('T')[0]; // Remover hora
      const firstReturnDate = sortedReturns[0]?.date.split('T')[0];
      
      if (firstReturnDate !== firstTransactionDate) {
        // Inferir dados do primeiro mês baseado no capital inicial + primeiro aporte
        const firstMonthData = {
          date: firstTransactionDate,
          return: 0, // Primeiro mês sem retorno calculado
          portfolioValue: (config?.initialCapital || 0) + (config?.monthlyContribution || 0), // Capital + aporte
          contribution: (config?.initialCapital || 0) + (config?.monthlyContribution || 0),
        };
        
        sortedReturns = [firstMonthData, ...sortedReturns];
      }
    }
    
    // Preparar dados da carteira
    const portfolioData = sortedReturns.map((month) => {
      // CORREÇÃO: Forçar UTC para evitar problemas de timezone
      const date = new Date(month.date + 'T12:00:00Z'); // Adicionar hora meio-dia UTC
      const monthLabel = date.toLocaleDateString('pt-BR', { 
        month: 'short', 
        year: '2-digit',
        timeZone: 'UTC' // Forçar UTC
      });
      
      return {
        month: monthLabel,
        date: month.date,
        carteira: month.portfolioValue,
        contribution: month.contribution,
        return: month.return * 100,
      };
    });
    
    // Se não temos benchmarks ou estão desabilitados, retornar apenas dados da carteira
    if (!benchmarkData || !showBenchmarks || loadingBenchmarks) {
      return portfolioData;
    }
    
    // Alinhar benchmarks com as datas do backtest
    const backtestDates = sortedReturns.map(m => m.date);
    const alignedCDI = alignBenchmarkDates(benchmarkData.cdi, backtestDates);
    const alignedIBOV = alignBenchmarkDates(benchmarkData.ibov, backtestDates);
    
    // Simular investimento no CDI (taxa % diária do Banco Central)
    const simulateCDIInvestment = (cdiData: Array<{ date: string; value: number }>) => {
      if (cdiData.length === 0 || !config) return [];
      
      console.log('🟢 ===== VALIDAÇÃO CDI =====');
      console.log('🟢 Taxa CDI inicial (raw):', cdiData[0]?.value);
      console.log('🟢 Taxa CDI final (raw):', cdiData[cdiData.length - 1]?.value);
      console.log('🟢 Número de meses:', cdiData.length);
      
      // O Banco Central retorna o CDI como taxa diária (%)
      // Valores típicos: 0.03% a 0.06% ao dia
      
      // Calcular taxa média diária do período
      const avgDailyRate = cdiData.reduce((sum, item) => sum + item.value, 0) / cdiData.length;
      
      // Converter taxa diária para mensal (assumindo ~21 dias úteis por mês)
      // Juros compostos: (1 + taxa_diária)^21 - 1
      const avgMonthlyRate = Math.pow(1 + (avgDailyRate / 100), 21) - 1;
      
      // Taxa anualizada: (1 + taxa_mensal)^12 - 1
      const avgAnnualRate = Math.pow(1 + avgMonthlyRate, 12) - 1;
      
      console.log('🟢 Taxa CDI média diária:', avgDailyRate.toFixed(4) + '% a.d.');
      console.log('🟢 Taxa mensal equivalente:', (avgMonthlyRate * 100).toFixed(3) + '% a.m.');
      console.log('🟢 Taxa anualizada equivalente:', (avgAnnualRate * 100).toFixed(2) + '% a.a.');
      console.log('🟢 ========================');
      
      // CORREÇÃO: Adicionar capital inicial + aporte no primeiro mês (igual à carteira)
      let accumulatedValue = (config.initialCapital || 0) + config.monthlyContribution;
      const results: number[] = [accumulatedValue];
      
      for (let i = 1; i < sortedReturns.length; i++) {
        // Aplicar rendimento CDI mensal sobre saldo atual
        accumulatedValue = accumulatedValue * (1 + avgMonthlyRate);
        
        // Adicionar novo aporte após rendimento
        accumulatedValue += config.monthlyContribution;
        
        results.push(accumulatedValue);
      }
      
      // Calcular retorno total e validar (SEMPRE sortedReturns.length aportes)
      const numAportes = sortedReturns.length;
      const totalAportes = config.monthlyContribution * numAportes;
      const initialInvestment = (config.initialCapital || 0) + totalAportes;
      const finalValue = results[results.length - 1];
      const totalReturn = ((finalValue - initialInvestment) / initialInvestment) * 100;
      const annualizedReturn = (Math.pow(finalValue / initialInvestment, 12 / sortedReturns.length) - 1) * 100;
      
      console.log('🟢 ===== RESULTADO CDI =====');
      console.log('🟢 📊 BREAKDOWN DO TOTAL INVESTIDO:');
      console.log('🟢   Capital Inicial:', formatCurrency(config.initialCapital || 0));
      console.log('🟢   Número de Aportes Mensais:', numAportes, 'meses');
      console.log('🟢   Aporte Mensal:', formatCurrency(config.monthlyContribution));
      console.log('🟢   Total Aportes:', formatCurrency(totalAportes));
      console.log('🟢   ➡️ TOTAL INVESTIDO:', formatCurrency(initialInvestment));
      console.log('🟢 Valor Final:', formatCurrency(finalValue));
      console.log('🟢 Ganho Líquido:', formatCurrency(finalValue - initialInvestment));
      console.log('🟢 Retorno Total:', totalReturn.toFixed(2) + '%');
      console.log('🟢 Retorno Anualizado (com aportes):', annualizedReturn.toFixed(2) + '% a.a.');
      console.log('🟢 Primeiros 5 meses:', results.slice(0, 5).map(v => formatCurrency(v)));
      console.log('🟢 Últimos 5 meses:', results.slice(-5).map(v => formatCurrency(v)));
      console.log('🟢 ========================');
      
      return results;
    };
    
    // Simular investimento no IBOV (índice de preço)
    const simulateIBOVInvestment = (ibovData: Array<{ date: string; value: number }>) => {
      if (ibovData.length === 0 || !config) return [];
      
      console.log('🟠 ===== DEBUG IBOV SIMULATION =====');
      console.log('🟠 Total de meses (sortedReturns.length):', sortedReturns.length);
      console.log('🟠 Total de dados IBOV:', ibovData.length);
      console.log('🟠 Primeiros 5 meses IBOV:', ibovData.slice(0, 5));
      console.log('🟠 Últimos 5 meses IBOV:', ibovData.slice(-5));
      
      // CORREÇÃO: Adicionar capital inicial + aporte no primeiro mês (igual à carteira)
      let accumulatedValue = (config.initialCapital || 0) + config.monthlyContribution;
      const results: number[] = [accumulatedValue];
      
      console.log('🟠 Mês 0 (inicial): Valor Acumulado =', formatCurrency(accumulatedValue));
      
      for (let i = 1; i < sortedReturns.length; i++) {
        const prevValue = accumulatedValue;
        
        // IBOV é índice de preço, calculamos variação percentual
        const monthReturn = ibovData[i] && ibovData[i - 1]
          ? (ibovData[i].value - ibovData[i - 1].value) / ibovData[i - 1].value
          : 0;
        
        // Aplicar retorno sobre saldo atual
        accumulatedValue = accumulatedValue * (1 + monthReturn);
        
        // Log detalhado dos últimos 5 meses
        if (i >= sortedReturns.length - 5) {
          console.log(`🟠 Mês ${i}:`, 
            `Data: ${ibovData[i]?.date || 'N/A'}`,
            `IBOV[${i-1}]: ${ibovData[i-1]?.value.toFixed(2)}`,
            `IBOV[${i}]: ${ibovData[i]?.value.toFixed(2)}`,
            `Retorno: ${(monthReturn * 100).toFixed(2)}%`,
            `Antes: ${formatCurrency(prevValue)}`,
            `Depois retorno: ${formatCurrency(accumulatedValue)}`
          );
        }
        
        // Adicionar novo aporte
        accumulatedValue += config.monthlyContribution;
        
        if (i >= sortedReturns.length - 5) {
          console.log(`🟠   + Aporte: ${formatCurrency(config.monthlyContribution)} → Total: ${formatCurrency(accumulatedValue)}`);
        }
        
        results.push(accumulatedValue);
      }
      
      console.log('🟠 ===========================');
      
      // Calcular retorno total e validar (SEMPRE sortedReturns.length aportes)
      const numAportes = sortedReturns.length;
      const totalAportes = config.monthlyContribution * numAportes;
      const initialInvestment = (config.initialCapital || 0) + totalAportes;
      const finalValue = results[results.length - 1];
      const totalReturn = ((finalValue - initialInvestment) / initialInvestment) * 100;
      const annualizedReturn = (Math.pow(finalValue / initialInvestment, 12 / sortedReturns.length) - 1) * 100;
      
      console.log('🟠 ===== RESULTADO IBOV =====');
      console.log('🟠 📊 BREAKDOWN DO TOTAL INVESTIDO:');
      console.log('🟠   Capital Inicial:', formatCurrency(config.initialCapital || 0));
      console.log('🟠   Número de Aportes Mensais:', numAportes, 'meses');
      console.log('🟠   Aporte Mensal:', formatCurrency(config.monthlyContribution));
      console.log('🟠   Total Aportes:', formatCurrency(totalAportes));
      console.log('🟠   ➡️ TOTAL INVESTIDO:', formatCurrency(initialInvestment));
      console.log('🟠 Valor Final:', formatCurrency(finalValue));
      console.log('🟠 Ganho Líquido:', formatCurrency(finalValue - initialInvestment));
      console.log('🟠 Retorno Total:', totalReturn.toFixed(2) + '%');
      console.log('🟠 Retorno Anualizado:', annualizedReturn.toFixed(2) + '% a.a.');
      console.log('🟠 Primeiros 5 meses:', results.slice(0, 5).map(v => formatCurrency(v)));
      console.log('🟠 Últimos 5 meses:', results.slice(-5).map(v => formatCurrency(v)));
      console.log('🟠 ========================');
      
      return results;
    };
    
    const cdiValues = simulateCDIInvestment(alignedCDI);
    const ibovValues = simulateIBOVInvestment(alignedIBOV);
    
    // Log comparativo final
    if (cdiValues.length > 0 && ibovValues.length > 0) {
      const carteiraFinal = sortedReturns[sortedReturns.length - 1]?.portfolioValue || 0;
      const cdiFinal = cdiValues[cdiValues.length - 1] || 0;
      const ibovFinal = ibovValues[ibovValues.length - 1] || 0;
      
      console.log('');
      console.log('💼 ===== COMPARAÇÃO FINAL =====');
      console.log('💼 Sua Carteira:', formatCurrency(carteiraFinal));
      console.log('🟢 CDI:', formatCurrency(cdiFinal), '(', (cdiFinal > carteiraFinal ? '+' : ''), formatCurrency(cdiFinal - carteiraFinal), ')');
      console.log('🟠 IBOV:', formatCurrency(ibovFinal), '(', (ibovFinal > carteiraFinal ? '+' : ''), formatCurrency(ibovFinal - carteiraFinal), ')');
      console.log('================================');
      console.log('');
    }
    
    // Combinar todos os dados
    const finalChartData = portfolioData.map((data, index) => ({
      ...data,
      cdi: cdiValues[index] ?? null,
      ibov: ibovValues[index] ?? null,
    }));
    
    console.log('📊 ===== CHART DATA FINAL =====');
    console.log('📊 Total de pontos no gráfico:', finalChartData.length);
    console.log('📊 Últimos 5 pontos do gráfico:');
    finalChartData.slice(-5).forEach((point, idx) => {
      console.log(`📊   [${finalChartData.length - 5 + idx}] ${point.month} (${point.date}): Carteira: R$ ${point.carteira.toFixed(2)}, IBOV: R$ ${point.ibov ? point.ibov.toFixed(2) : 'N/A'}`);
    });
    console.log('📊 ========================');
    
    return finalChartData;
  }, [result.monthlyReturns, benchmarkData, showBenchmarks, loadingBenchmarks, config, transactions]);

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
    <div ref={resultsTopRef} className="space-y-6">
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

      {/* Barra de contexto — leve, sem gradiente */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground min-w-0">
          <BarChart3 className="w-4 h-4 flex-shrink-0" />
          {config && (
            <>
              <span className="font-medium text-foreground truncate">{config.name}</span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">{config.assets?.length || 0} ativos</span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">{(result.monthlyReturns?.length || 0) + 1} meses</span>
            </>
          )}
        </div>
        {periodAdjusted && (
          <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 w-fit whitespace-nowrap">
            Período ajustado: {effectiveStartDate?.toLocaleDateString('pt-BR')} – {effectiveEndDate?.toLocaleDateString('pt-BR')}
          </Badge>
        )}
      </div>

      {/* Hero: manchete de retorno + gráfico comparativo (o dado mais importante, logo de cara) */}
      <Card className="border bg-card">
        <CardContent className="pt-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground mb-1">Retorno da carteira no período</p>
              <p className={`text-4xl sm:text-5xl font-bold tracking-tight ${result.totalReturn >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}>
                {formatPercentage(result.totalReturn)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {formatCurrency(result.finalValue)} de valor final
                {benchmarkData && showBenchmarks && (
                  <span className="hidden sm:inline"> — veja como se compara ao CDI e ao Ibovespa abaixo</span>
                )}
              </p>
            </div>
            <div className="flex gap-6 sm:gap-8">
              <div>
                <p className="text-xs text-muted-foreground">Ganho total</p>
                <p className={`text-lg font-semibold ${totalGain >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}>
                  {formatCurrency(totalGain)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Retorno anualizado</p>
                <p className={`text-lg font-semibold ${result.annualizedReturn >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}>
                  {formatPercentage(result.annualizedReturn)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <LineChartIcon className="w-4 h-4 text-muted-foreground" />
              Evolução patrimonial comparativa
            </p>
            {benchmarkData && !loadingBenchmarks && (
              <Button
                variant={showBenchmarks ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowBenchmarks(!showBenchmarks)}
                className="text-xs"
              >
                {showBenchmarks ? 'Ocultar' : 'Mostrar'} CDI/Ibovespa
              </Button>
            )}
          </div>

          {loadingBenchmarks ? (
            <div className="h-72 sm:h-80 bg-muted/40 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 mx-auto text-muted-foreground mb-3 animate-pulse" />
                <p className="text-sm text-muted-foreground">Carregando benchmarks...</p>
              </div>
            </div>
          ) : chartData.length > 0 ? (
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                      return value.toFixed(0);
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      padding: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: any, name) => {
                      const numValue = Number(value);
                      const label = String(name ?? '');
                      if (isNaN(numValue) || numValue === null || numValue === undefined) {
                        return ['N/A', label];
                      }
                      const formattedValue = formatCurrency(numValue);
                      if (label === 'carteira') return [formattedValue, 'Sua Carteira'];
                      if (label === 'cdi') return [formattedValue, 'CDI'];
                      if (label === 'ibov') return [formattedValue, 'IBOVESPA'];
                      return [formattedValue, label];
                    }}
                    labelFormatter={(label) => label}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="line" />

                  <Line
                    type="monotone"
                    dataKey="carteira"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={false}
                    name="Sua Carteira"
                    activeDot={{ r: 5 }}
                  />
                  {showBenchmarks && benchmarkData?.cdi && benchmarkData.cdi.length > 0 && (
                    <Line
                      type="monotone"
                      dataKey="cdi"
                      stroke="var(--muted-foreground)"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                      name="CDI"
                    />
                  )}
                  {showBenchmarks && benchmarkData?.ibov && benchmarkData.ibov.length > 0 && (
                    <Line
                      type="monotone"
                      dataKey="ibov"
                      stroke="#d97706"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                      name="IBOVESPA"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 sm:h-80 bg-muted/40 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum dado disponível para o gráfico</p>
              </div>
            </div>
          )}

          {/* Comparativo com benchmarks — tons neutros, cor só na identidade de cada série */}
          {showBenchmarks && benchmarkData && chartData.length > 0 && (() => {
            const finalCarteira = chartData[chartData.length - 1]?.carteira || 0;
            const finalCDI = (chartData[chartData.length - 1] as any)?.cdi || 0;
            const finalIBOV = (chartData[chartData.length - 1] as any)?.ibov || 0;
            const totalInvestedForReturn = result.totalInvested;

            const returnCarteira = totalInvestedForReturn > 0 ? ((finalCarteira - totalInvestedForReturn) / totalInvestedForReturn) * 100 : 0;
            const returnCDI = totalInvestedForReturn > 0 ? ((finalCDI - totalInvestedForReturn) / totalInvestedForReturn) * 100 : 0;
            const returnIBOV = totalInvestedForReturn > 0 ? ((finalIBOV - totalInvestedForReturn) / totalInvestedForReturn) * 100 : 0;

            const tiles = [
              { label: 'Sua Carteira', value: returnCarteira, final: finalCarteira, dotClass: 'bg-blue-600', delta: null as number | null, visible: true },
              { label: 'CDI', value: returnCDI, final: finalCDI, dotClass: 'bg-muted-foreground', delta: returnCarteira - returnCDI, visible: benchmarkData.cdi.length > 0 },
              { label: 'IBOVESPA', value: returnIBOV, final: finalIBOV, dotClass: 'bg-amber-600', delta: returnCarteira - returnIBOV, visible: benchmarkData.ibov.length > 0 },
            ];

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {tiles.filter(t => t.visible).map((tile) => (
                  <div key={tile.label} className="p-3 sm:p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs sm:text-sm font-medium text-foreground">{tile.label}</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${tile.dotClass}`}></span>
                    </div>
                    <p className={`text-xl sm:text-2xl font-bold ${tile.value >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}>
                      {tile.value >= 0 ? '+' : ''}{tile.value.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(tile.final)}
                      {tile.delta !== null && (
                        <span className="ml-2">
                          {tile.delta >= 0 ? '▲' : '▼'} {Math.abs(tile.delta).toFixed(1)}pp vs. carteira
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Métricas secundárias — cartões neutros, sem cor decorativa por métrica */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Retorno Anualizado"
          value={formatPercentage(result.annualizedReturn)}
          icon={<TrendingUp />}
          tone={result.annualizedReturn >= 0 ? 'positive' : 'negative'}
          description="Retorno composto ao ano"
        />
        <MetricCard
          title="Volatilidade"
          value={formatPercentage(result.volatility)}
          icon={<Activity />}
          tone="neutral"
          description="Risco anualizado da carteira"
        />
        <MetricCard
          title="Sharpe Ratio"
          value={result.sharpeRatio ? result.sharpeRatio.toFixed(2) : 'N/A'}
          icon={<Target />}
          tone="neutral"
          description="Retorno ajustado ao risco"
        />
        <MetricCard
          title="Drawdown Máximo"
          value={formatPercentage(result.maxDrawdown)}
          icon={<TrendingDown />}
          tone="negative"
          description="Maior perda do pico ao vale"
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
              <TabsTrigger value="assets" className="whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                <span className="hidden sm:inline">Por Ativo</span>
                <span className="sm:hidden">Ativos</span>
              </TabsTrigger>
              <TabsTrigger value="evolution" className="whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                <span className="hidden sm:inline">Dados Mensais</span>
                <span className="sm:hidden">Mensal</span>
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
            {/* Resumo Financeiro — sem repetir Valor Final/Ganho Total, já na manchete acima */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  Resumo Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base text-muted-foreground">Capital Próprio Investido:</span>
                  <span className="font-semibold text-sm sm:text-base">{formatCurrency(result.totalInvested)}</span>
                </div>
                {result.finalCashReserve !== undefined && (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                    <span className="text-sm sm:text-base text-muted-foreground">Saldo em Caixa:</span>
                    <span className="font-semibold text-sm sm:text-base">{formatCurrency(result.finalCashReserve || 0)}</span>
                  </div>
                )}
                {result.totalDividendsReceived !== undefined && result.totalDividendsReceived > 0 && (
                  <>
                    <Separator />
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                      <span className="text-sm sm:text-base text-muted-foreground">Dividendos Recebidos e Reinvestidos:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-500 text-sm sm:text-base">{formatCurrency(totalDividends)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Reinvestidos automaticamente — já incluídos no ganho de capital.
                    </p>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-sm text-muted-foreground">
                      <span>Yield sobre Investimento:</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-500">
                        {((result.totalDividendsReceived / result.totalInvested) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <div className="flex flex-col">
                    <span className="text-sm sm:text-base text-muted-foreground">Retorno Médio Mensal (Composto):</span>
                    <span className="text-xs text-muted-foreground">Equivalente mensal do retorno anualizado</span>
                  </div>
                  <span className={`font-semibold text-sm sm:text-base ${averageMonthlyReturn >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}>
                    {formatPercentage(averageMonthlyReturn)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Estatísticas de Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  Estatísticas de Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base text-muted-foreground">Consistência (meses positivos):</span>
                  <span className="font-semibold text-sm sm:text-base">{consistencyRate.toFixed(1)}% <span className="text-muted-foreground font-normal">({result.positiveMonths}/{result.positiveMonths + result.negativeMonths})</span></span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base text-muted-foreground">Tempo de Recuperação:</span>
                  <span className="font-semibold text-sm sm:text-base">
                    {recoveryMetrics.isCurrentlyInDrawdown
                      ? `Em drawdown há ${recoveryMetrics.currentDrawdownDuration}+ meses`
                      : recoveryMetrics.averageRecoveryTime > 0
                        ? `${recoveryMetrics.averageRecoveryTime.toFixed(1)} meses (média)`
                        : 'Sem perdas significativas'}
                  </span>
                </div>
                <Separator />
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base text-muted-foreground">Melhor Mês:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-500 text-sm sm:text-base">
                    {formatPercentage(Math.max(...result.monthlyReturns.map(m => m.return)))}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base text-muted-foreground">Pior Mês:</span>
                  <span className="font-semibold text-red-600 dark:text-red-500 text-sm sm:text-base">
                    {formatPercentage(Math.min(...result.monthlyReturns.map(m => m.return)))}
                  </span>
                </div>
                <Separator />
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base text-muted-foreground">Maior Sequência Positiva:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-500 text-sm sm:text-base">
                    {longestPositiveStreak} {longestPositiveStreak === 1 ? 'mês' : 'meses'}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm sm:text-base text-muted-foreground">Maior Sequência Negativa:</span>
                  <span className="font-semibold text-red-600 dark:text-red-500 text-sm sm:text-base">
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
                    {/* Layout Mobile: Cards */}
                    <div ref={evolutionTableRef} className="md:hidden space-y-3">
                      {paginatedData.map((month, index) => {
                        const actualIndex = startIndex + index;
                        const previousMonth = actualIndex < sortedMonthlyReturns.length - 1 ? sortedMonthlyReturns[actualIndex + 1] : null;
                        const variation = previousMonth ? ((month.portfolioValue - previousMonth.portfolioValue) / previousMonth.portfolioValue) * 100 : 0;
                        return (
                          <Card key={actualIndex}>
                            <CardContent className="p-3 sm:p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">
                                  {new Date(month.date).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                                </span>
                                <span className="font-mono font-semibold text-green-600">
                                  {formatCurrency(month.portfolioValue || 0)}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-500">Retorno:</span>
                                  <span className={`font-mono ml-1 ${(month.return || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatPercentage(month.return || 0)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Aporte:</span>
                                  <span className="font-mono text-blue-600 ml-1">{formatCurrency(month.contribution || 0)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Variação:</span>
                                  <span className={`font-mono ml-1 ${variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {variation.toFixed(2)}%
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Layout Desktop: Tabela */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm min-w-[400px]">
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
                            const previousMonth = actualIndex < sortedMonthlyReturns.length - 1 ? sortedMonthlyReturns[actualIndex + 1] : null;
                            const variation = previousMonth ? ((month.portfolioValue - previousMonth.portfolioValue) / previousMonth.portfolioValue) * 100 : 0;
                            return (
                              <tr key={actualIndex} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="p-3 font-medium">
                                  {new Date(month.date).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
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
                        
                        <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
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
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 text-sm">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
                  <TrendingUp className="w-5 h-5" />
                  Capacidade de Recuperação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {recoveryMetrics.isCurrentlyInDrawdown ? (
                    <>
                      <div className="flex justify-between">
                        <span>Status Atual:</span>
                        <span className="font-semibold text-red-600">
                          Em Drawdown
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Duração do Drawdown Atual:</span>
                        <span className="font-semibold text-red-600">
                          {recoveryMetrics.currentDrawdownDuration} meses
                        </span>
                      </div>
                      <Separator />
                    </>
                  ) : null}
                  
                  <div className="flex justify-between">
                    <span>Recuperações Completas:</span>
                    <span className="font-semibold text-green-600">
                      {recoveryMetrics.recoveryCount} vezes
                    </span>
                  </div>
                  
                  {recoveryMetrics.recoveryCount > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span>Tempo Médio de Recuperação:</span>
                        <span className="font-semibold text-blue-600">
                          {recoveryMetrics.averageRecoveryTime.toFixed(1)} meses
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Maior Tempo de Recuperação:</span>
                        <span className="font-semibold text-orange-600">
                          {recoveryMetrics.maxRecoveryTime} meses
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Perda Média Antes da Recuperação:</span>
                        <span className="font-semibold text-red-600">
                          {formatPercentage(recoveryMetrics.avgLossBeforeRecovery)}
                        </span>
                      </div>
                    </>
                  )}
                  
                  <Separator />
                  <div className="flex justify-between">
                    <span>Taxa de Sucesso de Recuperação:</span>
                    <span className={`font-semibold ${recoveryMetrics.recoverySuccessRate >= 80 ? 'text-green-600' : recoveryMetrics.recoverySuccessRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {recoveryMetrics.recoverySuccessRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
                
                {recoveryMetrics.isCurrentlyInDrawdown ? (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-700 dark:text-red-300">
                      <strong>⚠️ Atenção:</strong> A carteira está atualmente em drawdown há {recoveryMetrics.currentDrawdownDuration} meses e ainda não se recuperou completamente. 
                      {recoveryMetrics.recoveryCount > 0 && (
                        <span> Baseado no histórico, recuperações anteriores levaram em média {recoveryMetrics.averageRecoveryTime.toFixed(1)} meses.</span>
                      )}
                    </p>
                  </div>
                ) : recoveryMetrics.recoveryCount > 0 ? (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>💡 Interpretação:</strong> Após perdas superiores a 5%, a carteira conseguiu se recuperar completamente em média em {recoveryMetrics.averageRecoveryTime.toFixed(1)} meses.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      <strong>🎉 Excelente:</strong> A carteira não teve perdas significativas (&gt;5%) durante o período analisado.
                    </p>
                  </div>
                )}
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

                {recoveryMetrics.isCurrentlyInDrawdown ? (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <h5 className="font-semibold text-red-800 dark:text-red-200 mb-1">
                      Drawdown Atual: {recoveryMetrics.currentDrawdownDuration} meses
                    </h5>
                    <p className="text-red-700 dark:text-red-300">
                      {recoveryMetrics.currentDrawdownDuration < 6 ? 'Drawdown recente - ainda dentro do esperado' :
                       recoveryMetrics.currentDrawdownDuration < 12 ? 'Drawdown prolongado - requer paciência' :
                       recoveryMetrics.currentDrawdownDuration < 24 ? 'Drawdown longo - situação preocupante' :
                       'Drawdown muito longo - revisão da estratégia recomendada'}
                    </p>
                    {recoveryMetrics.recoveryCount > 0 && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        📊 Histórico: Recuperações anteriores levaram em média {recoveryMetrics.averageRecoveryTime.toFixed(1)} meses
                      </p>
                    )}
                  </div>
                ) : recoveryMetrics.recoveryCount > 0 && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                    <h5 className="font-semibold text-purple-800 dark:text-purple-200 mb-1">
                      Recuperação: {recoveryMetrics.averageRecoveryTime.toFixed(1)} meses (média)
                    </h5>
                    <p className="text-purple-700 dark:text-purple-300">
                      {recoveryMetrics.averageRecoveryTime < 3 ? 'Recuperação rápida - boa resiliência' :
                       recoveryMetrics.averageRecoveryTime < 6 ? 'Recuperação moderada - resiliência adequada' :
                       recoveryMetrics.averageRecoveryTime < 12 ? 'Recuperação lenta - paciência necessária' :
                       'Recuperação muito lenta - alta persistência necessária'}
                    </p>
                    {recoveryMetrics.maxRecoveryTime > recoveryMetrics.averageRecoveryTime * 2 && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        ⚠️ Atenção: A pior recuperação levou {recoveryMetrics.maxRecoveryTime} meses
                      </p>
                    )}
                  </div>
                )}

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

                {recoveryMetrics.recoveryCount === 0 && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
                    <h5 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-1">
                      🎉 Sem Perdas Significativas
                    </h5>
                    <p className="text-emerald-700 dark:text-emerald-300">
                      A carteira não teve perdas superiores a 5% durante o período analisado, demonstrando excelente estabilidade.
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
  /** Cor é só semântica (bom/ruim), nunca decorativa por métrica. */
  tone?: 'positive' | 'negative' | 'neutral';
  description?: string;
}

function MetricCard({ title, value, icon, tone = 'neutral', description }: MetricCardProps) {
  const valueClass =
    tone === 'positive' ? 'text-emerald-600 dark:text-emerald-500' :
    tone === 'negative' ? 'text-red-600 dark:text-red-500' :
    'text-foreground';

  return (
    <Card className="border bg-card min-w-0">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-2 sm:gap-3 min-w-0">
          <div className="p-1.5 sm:p-2 rounded-lg flex-shrink-0 flex items-center justify-center bg-muted">
            <div className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex items-center justify-center">
              {icon}
            </div>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground break-words">{title}</p>
            <p className={`text-lg sm:text-2xl font-bold break-all ${valueClass}`}>{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground/80 mt-1 break-words line-clamp-2">{description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
