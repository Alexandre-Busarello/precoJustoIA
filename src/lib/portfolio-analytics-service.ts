/**
 * PORTFOLIO ANALYTICS SERVICE
 * 
 * Calcula dados analíticos avançados para carteiras:
 * - Evolução mensal do valor da carteira
 * - Comparação com benchmarks (CDI, Ibovespa)
 * - Métricas de performance ao longo do tempo
 * - Análise de retorno vs risco
 */

import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import { HistoricalDataService } from './historical-data-service';
import { getLatestPrices as getQuotes, pricesToNumberMap } from './quote-service';
import { fetchBenchmarkData, alignBenchmarkDates, type BenchmarkData } from './benchmark-service';

/**
 * Ponto de evolução da carteira
 */
export interface EvolutionPoint {
  date: string; // YYYY-MM-DD
  value: number; // Valor total da carteira
  invested: number; // Capital líquido investido (aportes - saques) para exibição no gráfico
  totalInvested: number; // Total bruto investido (aportes totais) para cálculos de benchmarks
  cashBalance: number; // Saldo em caixa
  return: number; // Retorno total (%)
  returnAmount: number; // Retorno em reais
}

/**
 * Benchmark comparison data
 */
export interface BenchmarkComparison {
  date: string;
  portfolio: number; // Retorno acumulado da carteira (%)
  cdi: number; // Retorno acumulado do CDI (%)
  ibovespa: number; // Retorno acumulado do Ibovespa (%)
}

/**
 * Drawdown point data
 */
export interface DrawdownPoint {
  date: string;
  drawdown: number; // Drawdown atual (%)
  isInDrawdown: boolean; // Se está em período de drawdown
  peak: number; // Pico da carteira até esta data
  value: number; // Valor atual da carteira
}

/**
 * Drawdown period data
 */
export interface DrawdownPeriod {
  startDate: string;
  endDate: string | null; // null se ainda está em drawdown
  duration: number; // Duração em meses
  depth: number; // Profundidade máxima (%)
  recovered: boolean; // Se já recuperou
}

/**
 * Análise completa de analytics
 */
export interface PortfolioAnalytics {
  evolution: EvolutionPoint[];
  benchmarkComparison: BenchmarkComparison[];
  monthlyReturns: {
    date: string;
    return: number;
  }[];
  drawdownHistory: DrawdownPoint[];
  drawdownPeriods: DrawdownPeriod[];
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
    currentDrawdown: number; // Drawdown atual (%)
    maxDrawdownDepth: number; // Maior drawdown histórico (%)
    averageRecoveryTime: number; // Tempo médio de recuperação (meses)
    drawdownCount: number; // Número de períodos de drawdown
  };
}

/**
 * Portfolio Analytics Service
 */
export class PortfolioAnalyticsService {
  
  /**
   * Calcula analytics completo de uma carteira
   */
  static async calculateAnalytics(
    portfolioId: string,
    userId: string
  ): Promise<PortfolioAnalytics> {
    // Verify ownership
    const portfolio = await prisma.portfolioConfig.findFirst({
      where: {
        id: portfolioId,
        userId: userId
      },
      include: {
        assets: {
          where: { isActive: true }
        }
      }
    });

    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // Get all confirmed/executed transactions ordered by date
    const transactions = await safeQueryWithParams(
      'get-portfolio_transactions-analytics',
      () => prisma.portfolioTransaction.findMany({
        where: {
          portfolioId,
          status: {
            in: ['CONFIRMED', 'EXECUTED']
          }
        },
        orderBy: {
          date: 'asc'
        }
      }),
      { portfolioId }
    );

    if (!transactions || transactions.length === 0) {
      return this.getEmptyAnalytics();
    }

    // Calculate evolution
    const evolution = await this.calculateEvolution(portfolioId, transactions, portfolio.assets);
    
    // Calculate benchmark comparison
    const benchmarkComparison = await this.calculateBenchmarkComparison(
      evolution,
      portfolio.startDate
    );

    // Calculate monthly returns
    const monthlyReturns = this.calculateMonthlyReturns(evolution);

    // Calculate drawdown history and periods
    const { drawdownHistory, drawdownPeriods } = this.calculateDrawdown(evolution);

    // Calculate summary statistics
    const summary = this.calculateSummary(evolution, benchmarkComparison, monthlyReturns, drawdownHistory, drawdownPeriods);

    return {
      evolution,
      benchmarkComparison,
      monthlyReturns,
      drawdownHistory,
      drawdownPeriods,
      summary
    };
  }

  /**
   * Calcula a evolução mensal da carteira
   * Método público para ser reutilizado por PortfolioMetricsService
   */
  public static async calculateEvolution(
    portfolioId: string,
    transactions: any[],
    assets: any[]
  ): Promise<EvolutionPoint[]> {
    const evolution: EvolutionPoint[] = [];
    const holdings = new Map<string, number>(); // ticker -> quantity
    let cashBalance = 0;
    let totalInvested = 0;

    // Get unique tickers from transactions
    const tickers = Array.from(
      new Set(
        transactions
          .filter(t => t.ticker)
          .map(t => t.ticker!)
      )
    );

    // Ensure we have historical data for all tickers
    // Optimized: Check all tickers at once, then fetch only missing data
    if (tickers.length > 0) {
      // Converter para Date se for string (Prisma retorna como string ISO)
      const firstTransactionDate = transactions[0].date instanceof Date 
        ? transactions[0].date 
        : new Date(transactions[0].date);
      const endDate = new Date();
      
      // Buscar apenas 3 anos antes da primeira transação (otimização)
      const startDate = new Date(firstTransactionDate);
      startDate.setFullYear(startDate.getFullYear() - 3);
      
      console.log(`📊 [ANALYTICS] Verificando dados históricos para ${tickers.length} ativos (3 anos)...`);
      
      // Check which tickers need historical data (single query)
      const tickersNeedingData = await this.getTickersNeedingHistoricalData(
        tickers,
        startDate,
        endDate,
        '1mo'
      );
      
      if (tickersNeedingData.length === 0) {
        console.log(`✅ [ANALYTICS] Todos os ativos já possuem dados históricos`);
      } else {
        console.log(`📥 [ANALYTICS] Buscando dados históricos para ${tickersNeedingData.length} ativos: ${tickersNeedingData.join(', ')}`);
        
        // Fetch data only for tickers that need it
        for (const ticker of tickersNeedingData) {
          try {
            await HistoricalDataService.ensureHistoricalData(
              ticker,
              startDate,
              endDate,
              '1mo',
              false // Don't fetch maximum, just what we need
            );
          } catch (error) {
            console.error(`⚠️ [ANALYTICS] Erro ao buscar dados de ${ticker}:`, error);
            // Continue with other tickers even if one fails
          }
        }
        
        console.log(`✅ [ANALYTICS] Dados históricos garantidos para todos os ativos`);
      }
    }

    // Get all dates (monthly) from first transaction to today
    // Garantir que usamos UTC para evitar timezone issues
    // Converter para Date se for string (Prisma retorna como string ISO)
    const firstTxDate = transactions[0].date instanceof Date 
      ? transactions[0].date 
      : new Date(transactions[0].date);
    const startDate = new Date(Date.UTC(
      firstTxDate.getFullYear(),
      firstTxDate.getMonth(),
      1 // Primeiro dia do mês da primeira transação
    ));
    const endDate = new Date();
    const monthlyDates = this.getMonthlyDates(startDate, endDate);

    console.log(`📅 [ANALYTICS] Calculando evolução de ${this.formatDateUTC(startDate)} até ${this.formatDateUTC(endDate)}`);
    console.log(`📅 [ANALYTICS] Total de ${monthlyDates.length} meses para processar`);

    // Track which transactions have been processed
    let lastProcessedTxIndex = 0;

    // Se estamos no meio de um mês (dia > 1), adicionar um ponto extra para "hoje"
    const now = new Date();
    const currentMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const isInMiddleOfMonth = now.getDate() > 1;
    
    // Se estamos no meio do mês e não temos um ponto para hoje, adicionar
    if (isInMiddleOfMonth && monthlyDates.length > 0) {
      const lastDate = monthlyDates[monthlyDates.length - 1];
      if (lastDate.getTime() === currentMonthStart.getTime()) {
        monthlyDates.push(now);
        console.log(`📅 [ANALYTICS] Adicionado ponto extra para hoje (${this.formatDateUTC(now)}) no meio do mês`);
      }
    }

    for (let i = 0; i < monthlyDates.length; i++) {
      const date = monthlyDates[i];
      const isToday = i === monthlyDates.length - 1 && date.getTime() >= currentMonthStart.getTime() && isInMiddleOfMonth;
      
      // Para "hoje" (ponto extra no meio do mês), usar preços e transações de agora
      // Para outros pontos, usar o dia 1 do mês
      const priceDate = isToday ? now : date;
      const txProcessingDate = isToday ? now : date;
      
      // Process only NEW transactions up to this date
      while (lastProcessedTxIndex < transactions.length) {
        const tx = transactions[lastProcessedTxIndex];
        
        // Converter tx.date para Date se for string (Prisma retorna como string ISO)
        const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
        
        // Stop if transaction is after current processing date
        if (txDate > txProcessingDate) break;

        // Process this transaction
        if (tx.type === 'CASH_CREDIT' || tx.type === 'MONTHLY_CONTRIBUTION') {
          // 🔧 CORREÇÃO: MONTHLY_CONTRIBUTION também é um aporte (dinheiro novo na carteira)
          // Deve ser contado como investimento, não como lucro
          cashBalance += Number(tx.amount);
          totalInvested += Number(tx.amount); // Acumula aportes
        } else if (tx.type === 'DIVIDEND') {
          cashBalance += Number(tx.amount);
          // Dividends are returns, not investments
        } else if (tx.type === 'CASH_DEBIT') {
          cashBalance -= Number(tx.amount);
          // CASH_DEBIT é saque real, não afeta totalInvested aqui
          // (será usado no cálculo de netInvested depois)
        } else if (tx.type === 'BUY' || tx.type === 'BUY_REBALANCE') {
          cashBalance -= Number(tx.amount);
          const quantity = Number(tx.quantity || 0);
          holdings.set(tx.ticker!, (holdings.get(tx.ticker!) || 0) + quantity);
        } else if (tx.type === 'SELL_REBALANCE' || tx.type === 'SELL_WITHDRAWAL') {
          cashBalance += Number(tx.amount);
          const quantity = Number(tx.quantity || 0);
          holdings.set(tx.ticker!, (holdings.get(tx.ticker!) || 0) - quantity);
          // 🔧 CORREÇÃO: SELL_WITHDRAWAL não reduz totalInvested
          // totalInvested é apenas a soma de CASH_CREDIT (aportes)
          // Vendas apenas movem dinheiro para caixa
        }

        lastProcessedTxIndex++;
      }

      // Get prices for this date (usar data atual para o mês corrente)
      const prices = await this.getPricesAtDate(tickers, priceDate);

      // Calculate portfolio value
      let assetsValue = 0;
      for (const [ticker, quantity] of holdings) {
        const price = prices.get(ticker) || 0;
        assetsValue += quantity * price;
      }

      const totalValue = assetsValue + cashBalance;
      
      // 🔧 CORREÇÃO CRÍTICA: Cálculo correto do retorno considerando saques
      // 
      // Fórmula correta: Retorno = (Valor Atual + Saques - Investido) / Investido
      //
      // Onde:
      // - Valor Atual = Valor dos Ativos + Caixa
      // - Saques = Total de saques (CASH_DEBIT) - dinheiro que saiu da carteira
      // - Investido = Total de aportes (CASH_CREDIT + MONTHLY_CONTRIBUTION)
      //
      // IMPORTANTE: 
      // - Saques DEVEM ser somados ao valor atual no cálculo do retorno
      //   porque representam dinheiro que você retirou mas que faz parte do retorno total
      // - Isso garante que o retorno não aumenta artificialmente quando você saca dinheiro
      
      // Calculate total withdrawals (CASH_DEBIT only - money that left the portfolio)
      const totalWithdrawals = transactions
        .slice(0, lastProcessedTxIndex)
        .filter(tx => tx.type === 'CASH_DEBIT')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      
      // Calculate total dividends received (for debugging)
      const totalDividends = transactions
        .slice(0, lastProcessedTxIndex)
        .filter(tx => tx.type === 'DIVIDEND')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      
      // Return = (Current Value + Withdrawals - Invested) / Invested
      // Isso garante que o retorno não aumenta artificialmente quando você saca dinheiro
      const returnAmount = totalValue + totalWithdrawals - totalInvested;
      const returnPercent = totalInvested > 0 ? (returnAmount / totalInvested) * 100 : 0;
      
      // Net invested para exibição (capital líquido investido)
      const netInvested = totalInvested - totalWithdrawals;
      
      // Debug log para o último ponto
      if (isToday) {
        const pricesList: { [key: string]: number } = {};
        for (const [ticker, price] of prices) {
          pricesList[ticker] = price;
        }
        
        console.log(`📊 [ANALYTICS - ${this.formatDateUTC(date)} - PREÇOS E TRANSAÇÕES DE HOJE]`, {
          priceDate: this.formatDateUTC(priceDate),
          txProcessingDate: this.formatDateUTC(txProcessingDate),
          transactionsProcessed: lastProcessedTxIndex,
          totalTransactions: transactions.length,
          prices: pricesList,
          assetsValue: assetsValue.toFixed(2),
          cashBalance: cashBalance.toFixed(2),
          totalValue: totalValue.toFixed(2),
          totalInvested: totalInvested.toFixed(2),
          totalWithdrawals: totalWithdrawals.toFixed(2),
          netInvested: netInvested.toFixed(2),
          totalDividends: totalDividends.toFixed(2),
          returnAmount: returnAmount.toFixed(2),
          returnPercent: returnPercent.toFixed(2) + '%',
          formula: `(${totalValue.toFixed(2)} + ${totalWithdrawals.toFixed(2)} - ${totalInvested.toFixed(2)}) / ${totalInvested.toFixed(2)} = ${returnPercent.toFixed(2)}%`
        });
      }

      // Skip months before any transactions were processed (avoid empty months)
      // Only add evolution point if we've processed at least one transaction
      // OR if this is not the very first month
      if (lastProcessedTxIndex > 0 || evolution.length > 0) {
        evolution.push({
          date: this.formatDateUTC(date),
          value: totalValue,
          invested: netInvested, // 🔧 Capital líquido investido (aportes - saques) para exibição correta no gráfico
          totalInvested: totalInvested, // 🔧 Total bruto investido (aportes totais) para cálculos de benchmarks
          cashBalance,
          return: returnPercent, // 🔧 Retorno calculado com totalInvested (considerando saques no numerador)
          returnAmount
        });
      }
    }

    return evolution;
  }

  /**
   * Busca preços dos ativos em uma data específica
   * Para datas recentes (últimas 24h), usa Yahoo Finance para preços em tempo real
   */
  private static async getPricesAtDate(
    tickers: string[],
    date: Date
  ): Promise<Map<string, number>> {
    // Se a data for recente (últimas 24 horas), usar Yahoo Finance para preços atuais
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    if (date >= oneDayAgo) {
      console.log(`📊 [ANALYTICS] Data recente detectada (${this.formatDateUTC(date)}), usando Yahoo Finance...`);
      const priceMap = await getQuotes(tickers);
      return pricesToNumberMap(priceMap);
    }
    
    // Para datas antigas, usar banco de dados
    const prices = new Map<string, number>();

    for (const ticker of tickers) {
      const company = await prisma.company.findUnique({
        where: { ticker }
      });

      if (!company) continue;

      // Try to find historical price closest to date
      const historicalPrice = await prisma.historicalPrice.findFirst({
        where: {
          companyId: company.id,
          date: {
            lte: date
          }
        },
        orderBy: {
          date: 'desc'
        },
        take: 1
      });

      if (historicalPrice) {
        prices.set(ticker, Number(historicalPrice.close));
      } else {
        // Fallback to daily quote
        const dailyQuote = await prisma.dailyQuote.findFirst({
          where: {
            companyId: company.id,
            date: {
              lte: date
            }
          },
          orderBy: {
            date: 'desc'
          },
          take: 1
        });

        if (dailyQuote) {
          prices.set(ticker, Number(dailyQuote.price));
        }
      }
    }

    return prices;
  }

  /**
   * Verifica quais tickers precisam de dados históricos (consulta única otimizada)
   */
  private static async getTickersNeedingHistoricalData(
    tickers: string[],
    startDate: Date,
    endDate: Date,
    interval: string = '1mo'
  ): Promise<string[]> {
    if (tickers.length === 0) return [];

    // Get all companies for these tickers
    const companies = await prisma.company.findMany({
      where: {
        ticker: {
          in: tickers
        }
      },
      select: {
        id: true,
        ticker: true
      }
    });

    const companyMap = new Map(companies.map(c => [c.ticker, c.id]));
    const tickersNeedingData: string[] = [];

    // Check historical data for all companies in a single query
    const historicalDataCounts = await prisma.historicalPrice.groupBy({
      by: ['companyId'],
      where: {
        companyId: {
          in: companies.map(c => c.id)
        },
        interval: interval,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      _count: {
        id: true
      }
    });

    const dataCountMap = new Map(
      historicalDataCounts.map(d => [d.companyId, d._count.id])
    );

    // Calculate expected number of data points
    const monthsDiff = this.getMonthsDifference(startDate, endDate);
    const expectedPoints = Math.max(1, monthsDiff);
    const threshold = Math.max(1, Math.floor(expectedPoints * 0.8)); // 80% coverage

    // Check each ticker
    for (const ticker of tickers) {
      const companyId = companyMap.get(ticker);
      
      if (!companyId) {
        // Company doesn't exist, needs data
        tickersNeedingData.push(ticker);
        continue;
      }

      const existingCount = dataCountMap.get(companyId) || 0;
      
      if (existingCount < threshold) {
        tickersNeedingData.push(ticker);
      }
    }

    return tickersNeedingData;
  }

  /**
   * Formata data para string YYYY-MM-DD usando UTC
   * Evita problemas de timezone
   */
  private static formatDateUTC(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Calcula diferença em meses entre duas datas
   */
  private static getMonthsDifference(startDate: Date, endDate: Date): number {
    const yearsDiff = endDate.getFullYear() - startDate.getFullYear();
    const monthsDiff = endDate.getMonth() - startDate.getMonth();
    return yearsDiff * 12 + monthsDiff + 1;
  }

  /**
   * Gera array de datas mensais entre duas datas
   * Usa UTC para evitar problemas de timezone
   */
  private static getMonthlyDates(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    
    // Usar UTC para evitar problemas de timezone
    const current = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), 1));
    const end = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), 1));

    while (current <= end) {
      dates.push(new Date(current));
      current.setUTCMonth(current.getUTCMonth() + 1);
    }

    return dates;
  }

  /**
   * Calcula comparação com benchmarks (CDI e Ibovespa)
   * Usa dados reais de benchmarks do backend via benchmark-service
   */
  private static async calculateBenchmarkComparison(
    evolution: EvolutionPoint[],
    startDate: Date
  ): Promise<BenchmarkComparison[]> {
    if (evolution.length === 0) return [];

    const comparison: BenchmarkComparison[] = [];

    try {
      // Obter datas do período da evolução
      const sortedEvolution = [...evolution].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      const firstDate = new Date(sortedEvolution[0].date);
      const lastDate = new Date(sortedEvolution[sortedEvolution.length - 1].date);
      
      console.log(`📊 [BENCHMARK] Buscando dados reais de benchmarks de ${firstDate.toISOString().split('T')[0]} até ${lastDate.toISOString().split('T')[0]}`);
      
      // Buscar dados reais de benchmarks
      const benchmarkData: BenchmarkData = await fetchBenchmarkData(firstDate, lastDate);
      
      // Extrair datas da evolução para alinhamento
      const evolutionDates = sortedEvolution.map(e => e.date);
      
      // Alinhar dados de benchmarks com as datas da evolução
      const alignedCDI = alignBenchmarkDates(benchmarkData.cdi, evolutionDates);
      const alignedIBOV = alignBenchmarkDates(benchmarkData.ibov, evolutionDates);
      
      console.log(`📊 [BENCHMARK] CDI: ${alignedCDI.length} pontos alinhados, IBOV: ${alignedIBOV.length} pontos alinhados`);
      
      // Calcular aportes mensais médios baseado na evolução
      // O primeiro ponto tem o investimento inicial, depois calculamos diferenças
      // 🔧 IMPORTANTE: Usar totalInvested (bruto) para benchmarks, não invested (líquido)
      let previousTotalInvested = sortedEvolution[0].totalInvested || 0;
      const monthlyContributions: number[] = [0]; // Primeiro mês não tem aporte adicional
      
      for (let i = 1; i < sortedEvolution.length; i++) {
        const currentTotalInvested = sortedEvolution[i].totalInvested || 0;
        const contribution = Math.max(0, currentTotalInvested - previousTotalInvested);
        monthlyContributions.push(contribution);
        previousTotalInvested = currentTotalInvested;
      }
      
      // Simular investimento no CDI com aportes mensais
      const simulateCDIInvestment = (cdiData: Array<{ date: string; value: number }>) => {
        if (cdiData.length === 0 || sortedEvolution.length === 0) return [];
        
        // O Banco Central retorna o CDI como taxa diária (%)
        // Valores típicos: 0.03% a 0.06% ao dia
        // Agrupar dados por mês e calcular taxa mensal para cada mês
        // Criar um mapa de mês -> taxa mensal
        const monthlyRateMap = new Map<string, number>();
        
        // Calcular taxa média diária geral como fallback
        const avgDailyRateFallback = cdiData.length > 0
          ? cdiData.reduce((sum, item) => sum + item.value, 0) / cdiData.length
          : 0;
        const monthlyRateFallback = avgDailyRateFallback > 0
          ? Math.pow(1 + (avgDailyRateFallback / 100), 21) - 1
          : 0;
        
        // Agrupar dados CDI por mês
        const cdiByMonth = new Map<string, number[]>();
        for (const item of cdiData) {
          const monthKey = item.date.substring(0, 7); // YYYY-MM
          if (!cdiByMonth.has(monthKey)) {
            cdiByMonth.set(monthKey, []);
          }
          cdiByMonth.get(monthKey)!.push(item.value);
        }
        
        // Calcular taxa mensal para cada mês
        for (const [monthKey, values] of cdiByMonth) {
          const avgDailyRate = values.reduce((sum, v) => sum + v, 0) / values.length;
          const monthlyRate = avgDailyRate > 0
            ? Math.pow(1 + (avgDailyRate / 100), 21) - 1
            : 0;
          monthlyRateMap.set(monthKey, monthlyRate);
        }
        
        if (monthlyRateMap.size > 0) {
          const avgMonthlyRate = Array.from(monthlyRateMap.values()).reduce((sum, r) => sum + r, 0) / monthlyRateMap.size;
          console.log(`📊 [BENCHMARK CDI] Taxa mensal média: ${(avgMonthlyRate * 100).toFixed(3)}% a.m.`);
        }
        
        // Simular investimento com aportes mensais
        // 🔧 IMPORTANTE: Usar totalInvested (bruto) para simulação de benchmarks
        let accumulatedValue = sortedEvolution[0].totalInvested || 0;
        const results: number[] = [accumulatedValue];
        
        for (let i = 1; i < sortedEvolution.length; i++) {
          // Buscar taxa mensal do período entre o ponto anterior e o atual
          // Usar o mês do ponto atual (que representa o final do período)
          const evolutionDate = sortedEvolution[i].date;
          const monthKey = evolutionDate.substring(0, 7); // YYYY-MM
          
          // Tentar usar taxa do mês atual, se não houver, usar do mês anterior ou fallback
          let monthlyRate = monthlyRateMap.get(monthKey);
          
          // Se não encontrou, tentar mês anterior
          if (monthlyRate === undefined && i > 0) {
            const prevDate = sortedEvolution[i - 1].date;
            const prevMonthKey = prevDate.substring(0, 7);
            monthlyRate = monthlyRateMap.get(prevMonthKey);
          }
          
          // Se ainda não encontrou, usar fallback
          if (monthlyRate === undefined) {
            monthlyRate = monthlyRateFallback;
          }
          
          // Aplicar rendimento CDI mensal sobre saldo atual
          accumulatedValue = accumulatedValue * (1 + monthlyRate);
          
          // Adicionar novo aporte após rendimento
          accumulatedValue += monthlyContributions[i] || 0;
          
          results.push(accumulatedValue);
        }
        
        return results;
      };
      
      // Simular investimento no IBOV com aportes mensais
      const simulateIBOVInvestment = (ibovData: Array<{ date: string; value: number }>) => {
        if (ibovData.length === 0 || sortedEvolution.length === 0) return [];
        
        // IBOV é índice de preço, calculamos variação percentual mês a mês
        // 🔧 IMPORTANTE: Usar totalInvested (bruto) para simulação de benchmarks
        let accumulatedValue = sortedEvolution[0].totalInvested || 0;
        const results: number[] = [accumulatedValue];
        
        for (let i = 1; i < sortedEvolution.length; i++) {
          // Buscar valores IBOV do mês atual e anterior usando as datas
          const currentDate = sortedEvolution[i].date;
          const previousDate = sortedEvolution[i - 1].date;
          
          const currentIbov = ibovData.find(item => item.date === currentDate);
          const previousIbov = ibovData.find(item => item.date === previousDate);
          
          // Calcular retorno mensal do IBOV
          let monthReturn = 0;
          if (currentIbov && previousIbov && previousIbov.value > 0) {
            monthReturn = (currentIbov.value - previousIbov.value) / previousIbov.value;
          }
          
          // Aplicar retorno sobre saldo atual
          accumulatedValue = accumulatedValue * (1 + monthReturn);
          
          // Adicionar novo aporte
          accumulatedValue += monthlyContributions[i] || 0;
          
          results.push(accumulatedValue);
        }
        
        return results;
      };
      
      const cdiValues = simulateCDIInvestment(alignedCDI);
      const ibovValues = simulateIBOVInvestment(alignedIBOV);
      
      // Calcular retornos acumulados em percentual para cada ponto
      for (let i = 0; i < sortedEvolution.length; i++) {
        const point = sortedEvolution[i];
        // 🔧 IMPORTANTE: Usar totalInvested (bruto) para cálculos de benchmarks
        // Isso garante que benchmarks sejam comparados com o total investido, não com o líquido
        const totalInvestedBruto = point.totalInvested || 1; // Evitar divisão por zero
        
        // Retorno da carteira já está calculado em point.return
        const portfolioReturn = point.return;
        
        // Calcular retorno acumulado do CDI
        const cdiValue = cdiValues[i] || totalInvestedBruto;
        const cdiReturn = totalInvestedBruto > 0 
          ? ((cdiValue - totalInvestedBruto) / totalInvestedBruto) * 100 
          : 0;
        
        // Calcular retorno acumulado do IBOV
        const ibovValue = ibovValues[i] || totalInvestedBruto;
        const ibovReturn = totalInvestedBruto > 0 
          ? ((ibovValue - totalInvestedBruto) / totalInvestedBruto) * 100 
          : 0;
        
        comparison.push({
          date: point.date,
          portfolio: portfolioReturn,
          cdi: cdiReturn,
          ibovespa: ibovReturn
        });
      }
      
      console.log(`✅ [BENCHMARK] Comparação calculada para ${comparison.length} pontos`);
      if (comparison.length > 0) {
        const last = comparison[comparison.length - 1];
        console.log(`📊 [BENCHMARK] Último ponto - Carteira: ${last.portfolio.toFixed(2)}%, CDI: ${last.cdi.toFixed(2)}%, IBOV: ${last.ibovespa.toFixed(2)}%`);
      }
      
    } catch (error) {
      console.error('❌ [BENCHMARK] Erro ao calcular comparação com benchmarks:', error);
      // Fallback: retornar comparação vazia ou com valores zero
      // A interface espera retornos em percentual, então retornamos zeros
      for (const point of evolution) {
        comparison.push({
          date: point.date,
          portfolio: point.return,
          cdi: 0,
          ibovespa: 0
        });
      }
    }

    return comparison;
  }

  /**
   * Calcula retornos mensais
   * Cada mês mostra a variação entre pontos consecutivos
   * Se houver um ponto "hoje" no meio do mês, ele representa o retorno parcial desse mês
   */
  private static calculateMonthlyReturns(
    evolution: EvolutionPoint[]
  ): { date: string; return: number }[] {
    const monthlyReturns: { date: string; return: number }[] = [];

    console.log(`📊 [MONTHLY RETURNS] Calculando retornos mensais de ${evolution.length} pontos`);
    console.log(`📊 [MONTHLY RETURNS] Evolution completo:`, JSON.stringify(evolution.map(e => ({
      date: e.date,
      value: e.value.toFixed(2),
      invested: e.invested.toFixed(2),
      cashBalance: e.cashBalance.toFixed(2),
      return: e.return.toFixed(2) + '%',
      returnAmount: e.returnAmount.toFixed(2)
    })), null, 2));

    if (evolution.length === 0) return monthlyReturns;

    // Agrupar pontos por mês para saber quais são "início do mês" e quais são "hoje"
    const pointsByMonth = new Map<string, EvolutionPoint[]>();
    
    for (const point of evolution) {
      const monthKey = point.date.substring(0, 7); // YYYY-MM
      if (!pointsByMonth.has(monthKey)) {
        pointsByMonth.set(monthKey, []);
      }
      pointsByMonth.get(monthKey)!.push(point);
    }

    // Para cada mês, calcular retorno
    for (let i = 0; i < evolution.length; i++) {
      const currentPoint = evolution[i];
      const currentMonth = currentPoint.date.substring(0, 7);
      const nextPoint = evolution[i + 1];
      
      // Se há próximo ponto, calcular diferença
      if (nextPoint) {
        const nextMonth = nextPoint.date.substring(0, 7);
        
        // Se o próximo ponto é do MESMO mês, pular (o próximo ponto vai mostrar o retorno do mês)
        if (currentMonth === nextMonth) {
          console.log(`📅 [MONTHLY RETURNS] ${currentPoint.date}: pulando (há ponto mais recente no mesmo mês)`);
          continue;
        }
        
        // Se o próximo ponto é de outro mês, calcular retorno deste mês
        if (currentPoint.value > 0) {
          // Verificar se houve aporte/saque (mudança em invested)
          const investedChange = nextPoint.invested - currentPoint.invested;
          
          let monthReturn;
          if (investedChange !== 0) {
            // Houve aporte ou saque - ajustar o cálculo
            // Valor esperado = valor anterior + aporte/saque
            const expectedValue = currentPoint.value + investedChange;
            monthReturn = ((nextPoint.value - expectedValue) / expectedValue) * 100;
            
            console.log(`📅 [MONTHLY RETURNS] ${currentMonth}: ${monthReturn.toFixed(2)}% (${currentPoint.value.toFixed(2)} → ${nextPoint.value.toFixed(2)}, com ${investedChange > 0 ? 'aporte' : 'saque'} de R$ ${Math.abs(investedChange).toFixed(2)})`);
          } else {
            // Sem aporte/saque - cálculo simples
            monthReturn = ((nextPoint.value - currentPoint.value) / currentPoint.value) * 100;
            
            console.log(`📅 [MONTHLY RETURNS] ${currentMonth}: ${monthReturn.toFixed(2)}% (${currentPoint.value.toFixed(2)} → ${nextPoint.value.toFixed(2)})`);
          }
          
          monthlyReturns.push({
            date: currentPoint.date,
            return: monthReturn
          });
        }
      } else {
        // Último ponto (não há próximo)
        // Se é o único ponto do mês ou o mais recente do mês, mostrar retorno desde o início
        const prevPoint = evolution[i - 1];
        
        if (prevPoint && prevPoint.value > 0) {
          // Verificar se houve aporte/saque (mudança em invested)
          const investedChange = currentPoint.invested - prevPoint.invested;
          
          let monthReturn;
          if (investedChange !== 0) {
            // Houve aporte ou saque - ajustar o cálculo
            const expectedValue = prevPoint.value + investedChange;
            monthReturn = ((currentPoint.value - expectedValue) / expectedValue) * 100;
            
            console.log(`📅 [MONTHLY RETURNS] ${currentMonth}: ${monthReturn.toFixed(2)}% (${prevPoint.value.toFixed(2)} → ${currentPoint.value.toFixed(2)}, com ${investedChange > 0 ? 'aporte' : 'saque'} de R$ ${Math.abs(investedChange).toFixed(2)}, parcial até hoje)`);
          } else {
            // Sem aporte/saque - cálculo simples
            monthReturn = ((currentPoint.value - prevPoint.value) / prevPoint.value) * 100;
            
            console.log(`📅 [MONTHLY RETURNS] ${currentMonth}: ${monthReturn.toFixed(2)}% (${prevPoint.value.toFixed(2)} → ${currentPoint.value.toFixed(2)}, parcial até hoje)`);
          }
          
          monthlyReturns.push({
            date: currentPoint.date,
            return: monthReturn
          });
        }
      }
    }

    console.log(`✅ [MONTHLY RETURNS] Total de ${monthlyReturns.length} retornos mensais calculados`);

    return monthlyReturns;
  }


  /**
   * Calcula histórico de drawdown e períodos
   * Método público para ser reutilizado por PortfolioMetricsService
   * 
   * CORREÇÃO: Drawdown deve ser baseado no RETORNO da carteira, não apenas no valor absoluto
   * Uma carteira com retorno negativo SEMPRE está em drawdown, independente do valor absoluto
   */
  public static calculateDrawdown(
    evolution: EvolutionPoint[]
  ): { drawdownHistory: DrawdownPoint[]; drawdownPeriods: DrawdownPeriod[] } {
    const drawdownHistory: DrawdownPoint[] = [];
    const drawdownPeriods: DrawdownPeriod[] = [];
    
    if (evolution.length === 0) {
      return { drawdownHistory, drawdownPeriods };
    }

    // Usar o RETORNO como base para drawdown, não o valor absoluto
    let peakReturn = evolution[0].return;
    let peakDate = evolution[0].date;
    let peakValue = evolution[0].value;
    let currentDrawdownPeriod: DrawdownPeriod | null = null;
    let maxDrawdownInPeriod = 0;

    console.log(`📉 [DRAWDOWN] Calculando drawdown para ${evolution.length} pontos`);
    console.log(`📉 [DRAWDOWN] Evolution returns:`, evolution.map(e => `${e.date}: ${e.return.toFixed(2)}% (R$ ${e.value.toFixed(2)})`).join(', '));
    console.log(`📉 [DRAWDOWN] Pico inicial: ${peakReturn.toFixed(2)}% em ${peakDate}`);

    for (let i = 0; i < evolution.length; i++) {
      const point = evolution[i];
      
      // Update peak if we have a new high RETURN (não apenas valor)
      if (point.return > peakReturn) {
        // End current drawdown period if recovering
        if (currentDrawdownPeriod && !currentDrawdownPeriod.recovered) {
          currentDrawdownPeriod.endDate = point.date;
          currentDrawdownPeriod.duration = i - evolution.findIndex(p => p.date === currentDrawdownPeriod!.startDate);
          currentDrawdownPeriod.recovered = true;
          console.log(`✅ [DRAWDOWN] Recuperação em ${point.date} após ${currentDrawdownPeriod.duration} meses (retorno: ${point.return.toFixed(2)}%)`);
        }
        
        peakReturn = point.return;
        peakValue = point.value;
        peakDate = point.date;
        currentDrawdownPeriod = null;
        maxDrawdownInPeriod = 0;
      }
      
      // Calculate current drawdown baseado no RETORNO
      // Drawdown = queda desde o pico de retorno
      const drawdown = peakReturn - point.return; // Diferença em pontos percentuais
      const isInDrawdown = drawdown > 0.01 || point.return < 0; // Em drawdown se caiu do pico OU se retorno é negativo
      
      // Start new drawdown period if entering drawdown
      if (isInDrawdown && !currentDrawdownPeriod) {
        currentDrawdownPeriod = {
          startDate: point.date,
          endDate: null,
          duration: 0,
          depth: drawdown,
          recovered: false
        };
        maxDrawdownInPeriod = drawdown;
        drawdownPeriods.push(currentDrawdownPeriod);
        console.log(`📉 [DRAWDOWN] Início do drawdown em ${point.date}: -${drawdown.toFixed(2)}pp (retorno atual: ${point.return.toFixed(2)}%, pico: ${peakReturn.toFixed(2)}%)`);
      }
      
      // Update drawdown period depth
      if (currentDrawdownPeriod && drawdown > maxDrawdownInPeriod) {
        maxDrawdownInPeriod = drawdown;
        currentDrawdownPeriod.depth = drawdown;
      }
      
      drawdownHistory.push({
        date: point.date,
        drawdown: -drawdown, // Negativo para o gráfico (mostra queda)
        isInDrawdown,
        peak: peakValue, // Valor do pico (para referência)
        value: point.value
      });
    }

    // If still in drawdown at the end, update duration
    if (currentDrawdownPeriod && !currentDrawdownPeriod.recovered) {
      currentDrawdownPeriod.duration = evolution.length - evolution.findIndex(p => p.date === currentDrawdownPeriod!.startDate);
      console.log(`⚠️ [DRAWDOWN] Ainda em drawdown: ${currentDrawdownPeriod.duration} meses, profundidade: -${currentDrawdownPeriod.depth.toFixed(2)}pp`);
    }

    console.log(`📊 [DRAWDOWN] Total de ${drawdownPeriods.length} períodos de drawdown identificados`);

    return { drawdownHistory, drawdownPeriods };
  }

  /**
   * Calcula estatísticas resumidas
   */
  private static calculateSummary(
    evolution: EvolutionPoint[],
    benchmarkComparison: BenchmarkComparison[],
    monthlyReturns: { date: string; return: number }[],
    drawdownHistory: DrawdownPoint[],
    drawdownPeriods: DrawdownPeriod[]
  ) {
    if (evolution.length === 0) {
      return {
        totalReturn: 0,
        cdiReturn: 0,
        ibovespaReturn: 0,
        outperformanceCDI: 0,
        outperformanceIbovespa: 0,
        bestMonth: { date: '', return: 0 },
        worstMonth: { date: '', return: 0 },
        averageMonthlyReturn: 0,
        volatility: 0,
        currentDrawdown: 0,
        maxDrawdownDepth: 0,
        averageRecoveryTime: 0,
        drawdownCount: 0
      };
    }

    const lastEvolution = evolution[evolution.length - 1];
    const lastBenchmark = benchmarkComparison[benchmarkComparison.length - 1];

    // Find best and worst months
    // Se só há 1 mês com dados, mostrar apenas esse (não duplicar)
    let bestMonth = monthlyReturns[0] || { date: '', return: 0 };
    let worstMonth = monthlyReturns.length > 1 ? monthlyReturns[0] : { date: '', return: 0 };

    for (const month of monthlyReturns) {
      if (month.return > bestMonth.return) bestMonth = month;
      if (monthlyReturns.length > 1 && month.return < worstMonth.return) worstMonth = month;
    }
    
    // Se só há um mês, o pior é vazio (evitar duplicação)
    if (monthlyReturns.length === 1) {
      worstMonth = { date: '', return: 0 };
    }

    // Calculate average monthly return
    const avgMonthlyReturn = monthlyReturns.length > 0
      ? monthlyReturns.reduce((sum, m) => sum + m.return, 0) / monthlyReturns.length
      : 0;

    // Calculate volatility MENSAL (standard deviation of monthly returns)
    // Nota: Esta é a volatilidade MENSAL para análise detalhada
    let volatility = 0;
    if (monthlyReturns.length > 1) {
      const variance = monthlyReturns.reduce((sum, m) => {
        const diff = m.return - avgMonthlyReturn;
        return sum + diff * diff;
      }, 0) / monthlyReturns.length;
      volatility = Math.sqrt(variance);
    }

    // Calculate drawdown metrics
    const currentDrawdown = drawdownHistory.length > 0 
      ? Math.abs(drawdownHistory[drawdownHistory.length - 1].drawdown)
      : 0;
    
    const maxDrawdownDepth = drawdownPeriods.length > 0
      ? Math.max(...drawdownPeriods.map(p => p.depth))
      : 0;
    
    const recoveredPeriods = drawdownPeriods.filter(p => p.recovered);
    const averageRecoveryTime = recoveredPeriods.length > 0
      ? recoveredPeriods.reduce((sum, p) => sum + p.duration, 0) / recoveredPeriods.length
      : 0;

    return {
      totalReturn: lastEvolution.return,
      cdiReturn: lastBenchmark?.cdi || 0,
      ibovespaReturn: lastBenchmark?.ibovespa || 0,
      outperformanceCDI: lastEvolution.return - (lastBenchmark?.cdi || 0),
      outperformanceIbovespa: lastEvolution.return - (lastBenchmark?.ibovespa || 0),
      bestMonth,
      worstMonth,
      averageMonthlyReturn: avgMonthlyReturn,
      volatility,
      currentDrawdown,
      maxDrawdownDepth,
      averageRecoveryTime,
      drawdownCount: drawdownPeriods.length
    };
  }

  /**
   * Retorna analytics vazio para carteiras sem transações
   */
  private static getEmptyAnalytics(): PortfolioAnalytics {
    return {
      evolution: [],
      benchmarkComparison: [],
      monthlyReturns: [],
      drawdownHistory: [],
      drawdownPeriods: [],
      summary: {
        totalReturn: 0,
        cdiReturn: 0,
        ibovespaReturn: 0,
        outperformanceCDI: 0,
        outperformanceIbovespa: 0,
        bestMonth: { date: '', return: 0 },
        worstMonth: { date: '', return: 0 },
        averageMonthlyReturn: 0,
        volatility: 0,
        currentDrawdown: 0,
        maxDrawdownDepth: 0,
        averageRecoveryTime: 0,
        drawdownCount: 0
      }
    };
  }
}

