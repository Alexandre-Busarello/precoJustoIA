/**
 * PORTFOLIO ANALYTICS SERVICE
 *
 * Calcula dados analíticos avançados para carteiras:
 * - Evolução mensal do valor da carteira
 * - Rentabilidade por cota (TWR), TIR (XIRR) e retorno sobre o capital investido
 * - Comparação com benchmarks (CDI, Ibovespa, IPCA, IPCA + 6%)
 * - Volatilidade, Sharpe com CDI e quedas desde o pico
 */

import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import { HistoricalDataService } from './historical-data-service';
import { getLatestPrices as getQuotes, pricesToNumberMap } from './quote-service';
import {
  annualizeReturn,
  annualizedVolatility,
  cdiLevel,
  computeTwr,
  daysBetween,
  fetchBenchmarkData,
  ipcaLevel,
  priceLevel,
  returnBetween,
  sharpeRatio,
  toIsoDate,
  xirr,
  type BenchmarkLevel,
  type ValuationPoint,
  type XirrFlow,
} from './benchmark-service';

/** Juro real do benchmark IPCA + 6% a.a. (referência de NTN-B longa). */
export const IPCA_PLUS_REAL_RATE = 0.06;
/** Período mínimo, em dias, para um retorno contar como mês nas estatísticas mensais. */
const MIN_FULL_PERIOD_DAYS = 25;

/**
 * Ponto de evolução da carteira
 */
export interface EvolutionPoint {
  date: string; // YYYY-MM-DD
  value: number; // Valor total da carteira
  invested: number; // Capital líquido investido (aportes - saques) para exibição no gráfico
  totalInvested: number; // Total bruto investido (aportes totais) para cálculos de benchmarks
  cashBalance: number; // Saldo em caixa
  return: number; // Retorno sobre o capital investido (%)
  returnAmount: number; // Retorno em reais
}

type BenchmarkKey = 'cdi' | 'ibovespa' | 'ipca' | 'ipcaPlus6';

/**
 * Retorno acumulado desde o início do período, em pontos percentuais (12,3 = 12,3%).
 * A carteira é medida por cota (TWR); `null` quando o benchmark não tem dados.
 */
export interface BenchmarkComparison {
  date: string;
  portfolio: number;
  cdi: number | null;
  ibovespa: number | null;
  ipca: number | null;
  ipcaPlus6: number | null;
}

/** Métricas de rentabilidade do período, em frações (0,12 = 12%). */
export interface PerformanceSummary {
  startDate: string;
  endDate: string;
  days: number;
  /** Rentabilidade por cota (TWR) acumulada. */
  twr: number;
  /** TWR anualizado; `null` com menos de um ano. */
  twrAnnualized: number | null;
  /** TIR anual dos aportes e resgates (XIRR). */
  xirr: number | null;
  /** Retorno sobre o capital investido: (patrimônio + resgates − aportes) / aportes. */
  capitalReturn: number;
  /** Volatilidade anualizada dos retornos mensais por cota. */
  volatility: number | null;
  /** Sharpe com o CDI do mesmo período. */
  sharpe: number | null;
  /** `false` quando o CDI não pôde ser obtido (o Sharpe fica `null` por falta de dado, não por falta de histórico). */
  riskFreeAvailable: boolean;
  /** Retorno acumulado de cada benchmark no período; `null` sem dados. */
  benchmarks: Record<BenchmarkKey, number | null>;
}

export interface PerformanceResult {
  benchmarkComparison: BenchmarkComparison[];
  /** Retorno por cota de cada mês, em pontos percentuais, rotulado no início do mês. */
  monthlyReturns: Array<{ date: string; return: number }>;
  summary: PerformanceSummary;
}

function emptyPerformance(): PerformanceResult {
  return {
    benchmarkComparison: [],
    monthlyReturns: [],
    summary: {
      startDate: '',
      endDate: '',
      days: 0,
      twr: 0,
      twrAnnualized: null,
      xirr: null,
      capitalReturn: 0,
      volatility: null,
      sharpe: null,
      riskFreeAvailable: true,
      benchmarks: { cdi: null, ibovespa: null, ipca: null, ipcaPlus6: null },
    },
  };
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
  /** Retorno por cota de cada mês (pontos percentuais). */
  monthlyReturns: {
    date: string;
    return: number;
  }[];
  drawdownHistory: DrawdownPoint[];
  drawdownPeriods: DrawdownPeriod[];
  /** TWR, XIRR, Sharpe com CDI e benchmarks do período (frações). */
  performance: PerformanceSummary;
  /** Valores em pontos percentuais (12,3 = 12,3%). */
  summary: {
    totalReturn: number; // Retorno sobre o capital investido (%)
    cdiReturn: number; // CDI acumulado no período (%)
    ibovespaReturn: number; // Ibovespa acumulado no período (%)
    outperformanceCDI: number; // TWR − CDI (p.p.)
    outperformanceIbovespa: number; // TWR − Ibovespa (p.p.)
    bestMonth: {
      date: string;
      return: number;
    };
    worstMonth: {
      date: string;
      return: number;
    };
    averageMonthlyReturn: number;
    volatility: number; // Desvio padrão mensal dos retornos por cota (%)
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

    const evolution = await this.calculateEvolution(portfolioId, transactions, portfolio.assets);
    const performance = await this.calculatePerformance(evolution, transactions);
    const { drawdownHistory, drawdownPeriods } = this.calculateDrawdown(evolution);
    const summary = this.calculateSummary(evolution, performance, drawdownHistory, drawdownPeriods);

    return {
      evolution,
      benchmarkComparison: performance.benchmarkComparison,
      monthlyReturns: performance.monthlyReturns,
      drawdownHistory,
      drawdownPeriods,
      performance: performance.summary,
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
   * Rentabilidade por cota (TWR), TIR (XIRR), volatilidade, Sharpe com CDI e comparação com CDI, Ibovespa, IPCA e
   * IPCA + 6%, todos no mesmo período da evolução.
   *
   * Os fluxos externos de cada ponto são a variação do capital líquido investido (aportes − resgates); proventos ficam
   * dentro da carteira e contam como retorno. Aportes entre dois pontos mensais entram no ponto seguinte.
   * A cota começa no primeiro ponto com capital investido.
   * Método público para ser reutilizado por PortfolioMetricsService.
   */
  public static async calculatePerformance(
    fullEvolution: EvolutionPoint[],
    transactions: Array<{ date: Date | string; type: string; amount: unknown }>
  ): Promise<PerformanceResult> {
    // A cota começa no primeiro ponto com capital investido (proventos lançados antes do 1º aporte não têm base)
    const firstInvested = fullEvolution.findIndex(point => point.invested > 0);
    if (firstInvested === -1) return emptyPerformance();
    const evolution = fullEvolution.slice(firstInvested);

    const points: ValuationPoint[] = evolution.map((point, index) => ({
      date: point.date,
      value: point.value,
      flow: point.invested - (index > 0 ? evolution[index - 1].invested : 0),
    }));
    const twr = computeTwr(points);
    const startDate = evolution[0].date;
    const endDate = evolution[evolution.length - 1].date;
    const days = daysBetween(startDate, endDate);

    const benchmarkData = await fetchBenchmarkData(new Date(`${startDate}T00:00:00Z`), new Date(`${endDate}T00:00:00Z`), {
      ipca: true,
    });
    const levels: Record<BenchmarkKey, BenchmarkLevel> = {
      cdi: cdiLevel(benchmarkData.cdi),
      ibovespa: priceLevel(benchmarkData.ibov),
      ipca: ipcaLevel(benchmarkData.ipca),
      ipcaPlus6: ipcaLevel(benchmarkData.ipca, IPCA_PLUS_REAL_RATE),
    };
    const cumulative = (key: BenchmarkKey, date: string) => returnBetween(levels[key], startDate, date);
    const toPoints = (value: number | null) => (value === null ? null : value * 100);

    const benchmarkComparison: BenchmarkComparison[] = twr.quotas.map(({ date, quota }) => ({
      date,
      portfolio: (quota - 1) * 100,
      cdi: toPoints(cumulative('cdi', date)),
      ibovespa: toPoints(cumulative('ibovespa', date)),
      ipca: toPoints(cumulative('ipca', date)),
      ipcaPlus6: toPoints(cumulative('ipcaPlus6', date)),
    }));

    // Retornos por período rotulados no início do período (o mês medido)
    const previousDate = new Map(evolution.slice(1).map((point, index) => [point.date, evolution[index].date]));
    // Só meses completos entram nas estatísticas mensais (o mês em andamento entra apenas na rentabilidade acumulada):
    // um período de poucos dias tratado como mês distorce melhor/pior mês, volatilidade e a anualização do Sharpe.
    const periods = twr.periodReturns
      .map(({ date, return: value }) => ({ from: previousDate.get(date), to: date, value }))
      .filter((period): period is { from: string; to: string; value: number } => period.from !== undefined)
      .filter((period) => daysBetween(period.from, period.to) >= MIN_FULL_PERIOD_DAYS);
    const monthlyReturns = periods.map((period) => ({ date: period.from, return: period.value * 100 }));

    const portfolioReturns = periods.map((period) => period.value);
    const cdiReturns = periods.map((period) => returnBetween(levels.cdi, period.from, period.to));
    const sharpe = cdiReturns.every((value): value is number => value !== null)
      ? sharpeRatio(portfolioReturns, cdiReturns)
      : null;

    const externalFlows: XirrFlow[] = [];
    for (const tx of transactions) {
      const amount = Number(tx.amount);
      if (!Number.isFinite(amount) || amount === 0) continue;
      const date = toIsoDate(tx.date instanceof Date ? tx.date : new Date(tx.date));
      if (tx.type === 'CASH_CREDIT' || tx.type === 'MONTHLY_CONTRIBUTION') externalFlows.push({ date, amount: -amount });
      else if (tx.type === 'CASH_DEBIT') externalFlows.push({ date, amount });
    }
    const last = evolution[evolution.length - 1];
    const lastFlowDate = externalFlows.reduce((max, flow) => (flow.date > max ? flow.date : max), endDate);
    const internalRate = xirr([...externalFlows, { date: lastFlowDate, amount: last.value }]);

    return {
      benchmarkComparison,
      monthlyReturns,
      summary: {
        startDate,
        endDate,
        days,
        twr: twr.cumulative,
        twrAnnualized: annualizeReturn(twr.cumulative, days),
        xirr: internalRate,
        capitalReturn: last.return / 100,
        volatility: annualizedVolatility(portfolioReturns),
        sharpe,
        riskFreeAvailable: benchmarkData.cdi.length > 0,
        benchmarks: {
          cdi: cumulative('cdi', endDate),
          ibovespa: cumulative('ibovespa', endDate),
          ipca: cumulative('ipca', endDate),
          ipcaPlus6: cumulative('ipcaPlus6', endDate),
        },
      },
    };
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
   * Calcula estatísticas resumidas (em pontos percentuais)
   */
  private static calculateSummary(
    evolution: EvolutionPoint[],
    performance: PerformanceResult,
    drawdownHistory: DrawdownPoint[],
    drawdownPeriods: DrawdownPeriod[]
  ): PortfolioAnalytics['summary'] {
    const monthlyReturns = performance.monthlyReturns;
    if (evolution.length === 0) return emptySummary();

    const lastEvolution = evolution[evolution.length - 1];
    const { twr, benchmarks } = performance.summary;
    const toPoints = (value: number | null) => (value ?? 0) * 100;

    // Melhor e pior mês; com um único mês, só o melhor é exibido
    let bestMonth = monthlyReturns[0] || { date: '', return: 0 };
    let worstMonth = monthlyReturns.length > 1 ? monthlyReturns[0] : { date: '', return: 0 };
    for (const month of monthlyReturns) {
      if (month.return > bestMonth.return) bestMonth = month;
      if (monthlyReturns.length > 1 && month.return < worstMonth.return) worstMonth = month;
    }

    const avgMonthlyReturn = monthlyReturns.length > 0
      ? monthlyReturns.reduce((sum, m) => sum + m.return, 0) / monthlyReturns.length
      : 0;

    // Volatilidade MENSAL (desvio padrão dos retornos mensais por cota)
    let volatility = 0;
    if (monthlyReturns.length > 1) {
      const variance = monthlyReturns.reduce((sum, m) => sum + (m.return - avgMonthlyReturn) ** 2, 0) / (monthlyReturns.length - 1);
      volatility = Math.sqrt(variance);
    }

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
      cdiReturn: toPoints(benchmarks.cdi),
      ibovespaReturn: toPoints(benchmarks.ibovespa),
      outperformanceCDI: (twr - (benchmarks.cdi ?? 0)) * 100,
      outperformanceIbovespa: (twr - (benchmarks.ibovespa ?? 0)) * 100,
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
      performance: emptyPerformance().summary,
      summary: emptySummary()
    };
  }
}

function emptySummary(): PortfolioAnalytics['summary'] {
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
