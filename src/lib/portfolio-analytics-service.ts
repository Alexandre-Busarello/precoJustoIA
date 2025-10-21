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

/**
 * Ponto de evolução da carteira
 */
export interface EvolutionPoint {
  date: string; // YYYY-MM-DD
  value: number; // Valor total da carteira
  invested: number; // Total investido até a data
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
    console.log('calculateEvolution', transactions)
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
      const firstTransactionDate = transactions[0].date;
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
    const firstTx = transactions[0].date;
    const startDate = new Date(Date.UTC(
      firstTx.getFullYear(),
      firstTx.getMonth(),
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
        
        // Stop if transaction is after current processing date
        if (tx.date > txProcessingDate) break;

        // Process this transaction
        if (tx.type === 'CASH_CREDIT') {
          cashBalance += Number(tx.amount);
          totalInvested += Number(tx.amount);
        } else if (tx.type === 'DIVIDEND') {
          cashBalance += Number(tx.amount);
          // Dividends are returns, not investments
        } else if (tx.type === 'CASH_DEBIT') {
          cashBalance -= Number(tx.amount);
        } else if (tx.type === 'BUY' || tx.type === 'BUY_REBALANCE') {
          cashBalance -= Number(tx.amount);
          const quantity = Number(tx.quantity || 0);
          holdings.set(tx.ticker!, (holdings.get(tx.ticker!) || 0) + quantity);
        } else if (tx.type === 'SELL_REBALANCE' || tx.type === 'SELL_WITHDRAWAL') {
          cashBalance += Number(tx.amount);
          const quantity = Number(tx.quantity || 0);
          holdings.set(tx.ticker!, (holdings.get(tx.ticker!) || 0) - quantity);
          
          if (tx.type === 'SELL_WITHDRAWAL') {
            totalInvested -= Number(tx.amount);
          }
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
      
      // Calculate total withdrawals (to add back to return calculation)
      const totalWithdrawals = transactions
        .slice(0, lastProcessedTxIndex)
        .filter(tx => tx.type === 'CASH_DEBIT' || tx.type === 'SELL_WITHDRAWAL')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      
      // Calculate total dividends received (for debugging)
      const totalDividends = transactions
        .slice(0, lastProcessedTxIndex)
        .filter(tx => tx.type === 'DIVIDEND')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      
      // Total return = (current value + withdrawals) - invested
      // Dividends are already included in cashBalance (if not withdrawn)
      const returnAmount = totalValue + totalWithdrawals - totalInvested;
      const returnPercent = totalInvested > 0 ? (returnAmount / totalInvested) : 0;
      
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
          totalDividends: totalDividends.toFixed(2),
          returnAmount: returnAmount.toFixed(2),
          returnPercent: (returnPercent * 100).toFixed(2) + '%'
        });
      }

      // Skip months before any transactions were processed (avoid empty months)
      // Only add evolution point if we've processed at least one transaction
      // OR if this is not the very first month
      if (lastProcessedTxIndex > 0 || evolution.length > 0) {
        evolution.push({
          date: this.formatDateUTC(date),
          value: totalValue,
          invested: totalInvested,
          cashBalance,
          return: returnPercent * 100,
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
   */
  private static async calculateBenchmarkComparison(
    evolution: EvolutionPoint[],
    startDate: Date
  ): Promise<BenchmarkComparison[]> {
    if (evolution.length === 0) return [];

    const comparison: BenchmarkComparison[] = [];
    const initialValue = evolution[0].invested || 100; // Base inicial

    // Taxas aproximadas (anualizadas)
    const CDI_ANNUAL_RATE = 0.1175; // ~11.75% ao ano (média recente)
    const IBOV_ANNUAL_RATE = 0.08; // ~8% ao ano (média histórica)

    const CDI_MONTHLY_RATE = Math.pow(1 + CDI_ANNUAL_RATE, 1/12) - 1;
    const IBOV_MONTHLY_RATE = Math.pow(1 + IBOV_ANNUAL_RATE, 1/12) - 1;

    for (let i = 0; i < evolution.length; i++) {
      const point = evolution[i];
      const monthsElapsed = i;

      // Cálculo de retorno acumulado com juros compostos
      const cdiAccumulated = (Math.pow(1 + CDI_MONTHLY_RATE, monthsElapsed) - 1) * 100;
      const ibovAccumulated = (Math.pow(1 + IBOV_MONTHLY_RATE, monthsElapsed) - 1) * 100;

      comparison.push({
        date: point.date,
        portfolio: point.return,
        cdi: cdiAccumulated,
        ibovespa: ibovAccumulated
      });
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
   */
  public static calculateDrawdown(
    evolution: EvolutionPoint[]
  ): { drawdownHistory: DrawdownPoint[]; drawdownPeriods: DrawdownPeriod[] } {
    const drawdownHistory: DrawdownPoint[] = [];
    const drawdownPeriods: DrawdownPeriod[] = [];
    
    if (evolution.length === 0) {
      return { drawdownHistory, drawdownPeriods };
    }

    let peak = evolution[0].value;
    let peakDate = evolution[0].date;
    let currentDrawdownPeriod: DrawdownPeriod | null = null;
    let maxDrawdownInPeriod = 0;

    console.log(`📉 [DRAWDOWN] Calculando drawdown para ${evolution.length} pontos`);
    console.log(`📉 [DRAWDOWN] Evolution values:`, evolution.map(e => `${e.date}: R$ ${e.value.toFixed(2)}`).join(', '));
    console.log(`📉 [DRAWDOWN] Pico inicial: R$ ${peak.toFixed(2)} em ${peakDate}`);

    for (let i = 0; i < evolution.length; i++) {
      const point = evolution[i];
      
      // Update peak if we have a new high
      if (point.value > peak) {
        // End current drawdown period if recovering
        if (currentDrawdownPeriod && !currentDrawdownPeriod.recovered) {
          currentDrawdownPeriod.endDate = point.date;
          currentDrawdownPeriod.duration = i - evolution.findIndex(p => p.date === currentDrawdownPeriod!.startDate);
          currentDrawdownPeriod.recovered = true;
          console.log(`✅ [DRAWDOWN] Recuperação em ${point.date} após ${currentDrawdownPeriod.duration} meses`);
        }
        
        peak = point.value;
        peakDate = point.date;
        currentDrawdownPeriod = null;
        maxDrawdownInPeriod = 0;
      }
      
      // Calculate current drawdown
      const drawdown = peak > 0 ? ((peak - point.value) / peak) * 100 : 0;
      const isInDrawdown = drawdown > 0.01; // Considera drawdown se > 0.01%
      
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
        console.log(`📉 [DRAWDOWN] Início do drawdown em ${point.date}: -${drawdown.toFixed(2)}%`);
      }
      
      // Update drawdown period depth
      if (currentDrawdownPeriod && drawdown > maxDrawdownInPeriod) {
        maxDrawdownInPeriod = drawdown;
        currentDrawdownPeriod.depth = drawdown;
      }
      
      drawdownHistory.push({
        date: point.date,
        drawdown: -drawdown, // Negativo para o gráfico
        isInDrawdown,
        peak,
        value: point.value
      });
    }

    // If still in drawdown at the end, update duration
    if (currentDrawdownPeriod && !currentDrawdownPeriod.recovered) {
      currentDrawdownPeriod.duration = evolution.length - evolution.findIndex(p => p.date === currentDrawdownPeriod!.startDate);
      console.log(`⚠️ [DRAWDOWN] Ainda em drawdown: ${currentDrawdownPeriod.duration} meses, profundidade: -${currentDrawdownPeriod.depth.toFixed(2)}%`);
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

