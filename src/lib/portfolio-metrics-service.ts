/**
 * PORTFOLIO METRICS SERVICE
 * 
 * Calculates and manages portfolio metrics including:
 * - Current holdings and valuations
 * - Performance metrics (returns, volatility, Sharpe ratio)
 * - Risk metrics (max drawdown)
 * - Sector/industry allocations
 */

import { prisma } from '@/lib/prisma';
import { safeWrite } from '@/lib/prisma-wrapper';
import { PortfolioService } from './portfolio-service';
import { Prisma } from '@prisma/client';
import { getLatestPrices as getQuotes, pricesToNumberMap } from './quote-service';
import { HistoricalDataService } from './historical-data-service';
import { AssetRegistrationService } from './asset-registration-service';
import { PortfolioAnalytics, PortfolioAnalyticsService } from './portfolio-analytics-service';

// Types
export interface PortfolioHolding {
  ticker: string;
  quantity: number;
  averagePrice: number;
  totalInvested: number;
  currentPrice: number;
  currentValue: number;
  return: number;
  returnPercentage: number;
  totalDividends: number; // Total dividends received for this asset
  returnWithDividends: number; // Return including dividends
  returnWithDividendsPercentage: number; // Return percentage including dividends
  actualAllocation: number; // Current allocation
  targetAllocation: number; // Target allocation from config
  allocationDiff: number; // Difference between actual and target
  needsRebalancing: boolean; // True if absolute diff > 5% OR relative deviation > 20%
}

export interface PortfolioMetricsData {
  currentValue: number;
  cashBalance: number;
  totalInvested: number;
  totalWithdrawn: number;
  totalDividends: number;
  totalReturn: number;
  annualizedReturn: number | null;
  volatility: number | null;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
  holdings: PortfolioHolding[];
  monthlyReturns: { date: string; return: number; portfolioValue: number }[];
  evolutionData: { date: string; value: number; cashBalance: number; invested: number }[];
  sectorAllocation: { sector: string; value: number; percentage: number }[];
  industryAllocation: { industry: string; value: number; percentage: number }[];
}

/**
 * Portfolio Metrics Service
 */
export class PortfolioMetricsService {
  
  /**
   * Calculate all portfolio metrics
   */
  static async calculatePortfolioMetrics(
    portfolioId: string,
    userId: string
  ): Promise<PortfolioMetricsData> {
    // Verify ownership and get assets
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

    // NOVO: Garantir que todos os ativos da carteira estão cadastrados
    await this.ensurePortfolioAssetsRegistered(portfolioId);

    // Get all confirmed/executed transactions
    const transactions = await this.getExecutedTransactions(portfolioId);
    
    // Calculate holdings
    const holdings = await this.getCurrentHoldings(portfolioId);
    
    // Calculate cash balance
    const cashBalance = this.calculateCashBalance(transactions);
    
    // Calculate total invested and withdrawn
    const { totalInvested, totalWithdrawn, totalDividends } = this.calculateTotals(transactions);
    
    // Calculate current portfolio value
    const currentValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    
    // Calculate total return
    // Total Return = (Current Value + Cash + Withdrawn - Invested) / Invested
    const totalReturn = totalInvested > 0 
      ? (currentValue + cashBalance + totalWithdrawn - totalInvested) / totalInvested
      : 0;
    
    console.log('📊 [CALCULATE RETURN]', {
      currentValue: currentValue.toFixed(2),
      cashBalance: cashBalance.toFixed(2),
      totalWithdrawn: totalWithdrawn.toFixed(2),
      totalInvested: totalInvested.toFixed(2),
      numerator: (currentValue + cashBalance + totalWithdrawn - totalInvested).toFixed(2),
      totalReturn: (totalReturn * 100).toFixed(2) + '%'
    });

    // Calculate monthly evolution usando o MESMO método do Analytics
    const evolutionPoints = transactions && transactions.length > 0 ? await PortfolioAnalyticsService.calculateEvolution(
      portfolioId,
      transactions,
      portfolio.assets
    ) : [];
    
    // Converter para formato do Metrics
    const evolutionData = evolutionPoints.map(point => ({
      date: point.date.substring(0, 7), // YYYY-MM-DD -> YYYY-MM
      value: point.value,
      cashBalance: point.cashBalance,
      invested: point.invested
    }));
    
    console.log('📊 [METRICS EVOLUTION] Usando dados do Analytics:', evolutionData);
    
    // Calculate monthly returns
    const monthlyReturns = this.calculateMonthlyReturns(evolutionData);
    
    // Calculate risk metrics
    const volatility = this.calculateVolatility(monthlyReturns);
    const annualizedReturn = this.calculateAnnualizedReturn(totalReturn, evolutionData.length);
    const sharpeRatio = volatility && annualizedReturn ? this.calculateSharpeRatio(annualizedReturn, volatility) : null;
    
    // Calculate maxDrawdown usando o MESMO método do Analytics
    const { drawdownHistory } = PortfolioAnalyticsService.calculateDrawdown(evolutionPoints);
    const maxDrawdown = drawdownHistory.length > 0 
      ? Math.abs(Math.min(...drawdownHistory.map(d => d.drawdown)) / 100)
      : null;
    
    console.log('✅ [METRICS DRAWDOWN] Usando cálculo do Analytics:', 
      maxDrawdown ? `${(maxDrawdown * 100).toFixed(2)}%` : 'N/A');
    
    // Calculate sector/industry allocations
    const sectorAllocation = await this.getSectorAllocation(holdings);
    const industryAllocation = await this.getIndustryAllocation(holdings);
    
    const metrics: PortfolioMetricsData = {
      currentValue,
      cashBalance,
      totalInvested,
      totalWithdrawn,
      totalDividends,
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      maxDrawdown,
      holdings,
      monthlyReturns,
      evolutionData,
      sectorAllocation,
      industryAllocation
    };

    return metrics;
  }

  /**
   * Garante que todos os ativos da carteira estão cadastrados
   * e possuem dados históricos necessários
   */
  private static async ensurePortfolioAssetsRegistered(portfolioId: string): Promise<void> {
    console.log(`\n🔍 [PORTFOLIO ASSETS] Verificando cadastro dos ativos da carteira ${portfolioId}...`);
    
    // Get all assets from portfolio config
    const portfolioAssets = await prisma.portfolioConfigAsset.findMany({
      where: {
        portfolioId,
        isActive: true
      },
      select: {
        ticker: true
      }
    });

    if (portfolioAssets.length === 0) {
      console.log(`⚠️ [PORTFOLIO ASSETS] Carteira sem ativos configurados`);
      return;
    }

    const tickers = portfolioAssets.map(a => a.ticker);
    console.log(`📋 [PORTFOLIO ASSETS] Ativos na carteira: ${tickers.join(', ')}`);

    // Check which assets are not registered in companies table
    const existingCompanies = await prisma.company.findMany({
      where: {
        ticker: {
          in: tickers
        }
      },
      select: {
        ticker: true
      }
    });

    const existingTickers = new Set(existingCompanies.map(c => c.ticker));
    const missingTickers = tickers.filter(t => !existingTickers.has(t));

    if (missingTickers.length === 0) {
      console.log(`✅ [PORTFOLIO ASSETS] Todos os ativos já estão cadastrados`);
      return;
    }

    console.log(`📝 [PORTFOLIO ASSETS] Ativos não cadastrados: ${missingTickers.join(', ')}`);
    console.log(`🔄 [PORTFOLIO ASSETS] Iniciando cadastro automático...`);

    // Register missing assets
    for (const ticker of missingTickers) {
      try {
        const result = await AssetRegistrationService.registerAsset(ticker);
        if (result.success) {
          console.log(`✅ [PORTFOLIO ASSETS] ${ticker} cadastrado com sucesso (${result.assetType})`);
        } else {
          console.error(`⚠️ [PORTFOLIO ASSETS] Erro ao cadastrar ${ticker}: ${result.message}`);
        }
      } catch (error) {
        console.error(`❌ [PORTFOLIO ASSETS] Falha ao cadastrar ${ticker}:`, error);
      }

      // Add delay between registrations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✅ [PORTFOLIO ASSETS] Verificação de cadastro concluída\n`);
  }

  /**
   * Get executed transactions (CONFIRMED or EXECUTED status)
   */
  private static async getExecutedTransactions(portfolioId: string) {
    // NO CACHE - Read directly from Prisma for now
    return await prisma.portfolioTransaction.findMany({
      where: {
        portfolioId,
        status: {
          in: ['CONFIRMED', 'EXECUTED']
        }
      },
      orderBy: {
        date: 'asc'
      }
    });
  }

  /**
   * Get total dividends received for each asset
   */
  private static async getDividendsByTicker(portfolioId: string): Promise<Map<string, number>> {
    const dividendTransactions = await prisma.portfolioTransaction.findMany({
      where: {
        portfolioId,
        type: 'DIVIDEND',
        status: {
          in: ['CONFIRMED', 'EXECUTED']
        },
        ticker: {
          not: null
        }
      }
    });

    const dividendMap = new Map<string, number>();
    for (const tx of dividendTransactions) {
      if (!tx.ticker) continue;
      const current = dividendMap.get(tx.ticker) || 0;
      dividendMap.set(tx.ticker, current + Number(tx.amount));
    }

    return dividendMap;
  }

  /**
   * Calculate current holdings with prices
   */
  static async getCurrentHoldings(portfolioId: string): Promise<PortfolioHolding[]> {
    // Get portfolio config with target allocations
    const portfolio = await prisma.portfolioConfig.findUnique({
      where: { id: portfolioId },
      include: {
        assets: {
          where: { isActive: true }
        }
      }
    });

    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // Build target allocation map
    const targetAllocations = new Map<string, number>();
    for (const asset of portfolio.assets) {
      targetAllocations.set(asset.ticker, Number(asset.targetAllocation));
    }

    // Get dividends by ticker
    const dividendsByTicker = await this.getDividendsByTicker(portfolioId);

    const transactions = await prisma.portfolioTransaction.findMany({
      where: {
        portfolioId,
        status: {
          in: ['CONFIRMED', 'EXECUTED']
        },
        ticker: {
          not: null
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Build holdings map
    const holdingsMap = new Map<string, { quantity: number; totalInvested: number }>();
    
    for (const tx of transactions) {
      if (!tx.ticker) continue;
      
      const current = holdingsMap.get(tx.ticker) || { quantity: 0, totalInvested: 0 };
      
      if (tx.type === 'BUY' || tx.type === 'BUY_REBALANCE') {
        current.quantity += Number(tx.quantity || 0);
        current.totalInvested += Number(tx.amount);
      } else if (tx.type === 'SELL_REBALANCE' || tx.type === 'SELL_WITHDRAWAL') {
        const quantitySold = Number(tx.quantity || 0);
        const quantityBefore = current.quantity;
        const investedBefore = current.totalInvested;
        
        // Calculate the average cost per share BEFORE the sale
        const averageCost = quantityBefore > 0 
          ? investedBefore / quantityBefore
          : 0;
        
        // Reduce quantity and totalInvested by the COST of shares sold (not sale value)
        // This maintains the correct cost basis for remaining shares
        current.quantity -= quantitySold;
        const costReduction = averageCost * quantitySold;
        current.totalInvested -= costReduction;
        
        console.log(`📉 [SELL] ${tx.ticker}:`, {
          quantitySold,
          saleValue: Number(tx.amount).toFixed(2),
          averageCost: averageCost.toFixed(2),
          costReduction: costReduction.toFixed(2),
          before: { quantity: quantityBefore, invested: investedBefore.toFixed(2) },
          after: { quantity: current.quantity, invested: current.totalInvested.toFixed(2) }
        });
      }
      
      holdingsMap.set(tx.ticker, current);
    }

    // Get current prices
    const tickers = Array.from(holdingsMap.keys());
    const prices = await this.getLatestPrices(tickers);
    
    // Log prices for debugging
    const pricesList: { [key: string]: number } = {};
    for (const [ticker, price] of prices) {
      pricesList[ticker] = price;
    }
    console.log('📊 [METRICS] Preços atuais:', pricesList);
    
    // Calculate total portfolio value for allocation percentages
    let totalValue = 0;
    for (const [ticker, holding] of holdingsMap) {
      const price = prices.get(ticker) || 0;
      totalValue += holding.quantity * price;
    }

    // Build holdings array
    const holdings: PortfolioHolding[] = [];

    for (const [ticker, holding] of holdingsMap) {
      if (holding.quantity <= 0) continue; // Skip sold positions

      const currentPrice = prices.get(ticker) || 0;
      const currentValue = holding.quantity * currentPrice;
      const averagePrice = holding.quantity > 0 ? holding.totalInvested / holding.quantity : 0;
      const returnValue = currentValue - holding.totalInvested;
      const returnPercentage = holding.totalInvested > 0 ? (returnValue / holding.totalInvested) : 0;

      // Calculate dividend-adjusted return
      const totalDividends = dividendsByTicker.get(ticker) || 0;
      const returnWithDividends = returnValue + totalDividends;
      const returnWithDividendsPercentage = holding.totalInvested > 0 ? (returnWithDividends / holding.totalInvested) : 0;

      const actualAllocation = totalValue > 0 ? (currentValue / totalValue) : 0;
      const targetAllocation = targetAllocations.get(ticker) || 0;
      const allocationDiff = actualAllocation - targetAllocation;

      // Needs rebalancing if:
      // 1. Absolute difference > 5 percentage points (e.g., 10% vs 5%), OR
      // 2. Relative deviation > 20% of target (e.g., actual is 6% when target is 5%)
      const absoluteDiff = Math.abs(allocationDiff);
      const relativeDeviation = targetAllocation > 0
        ? Math.abs(allocationDiff / targetAllocation)
        : 0;
      const needsRebalancing = absoluteDiff > 0.05 || relativeDeviation > 0.20;

      holdings.push({
        ticker,
        quantity: holding.quantity,
        averagePrice,
        totalInvested: holding.totalInvested,
        currentPrice,
        currentValue,
        return: returnValue,
        returnPercentage,
        totalDividends,
        returnWithDividends,
        returnWithDividendsPercentage,
        actualAllocation,
        targetAllocation,
        allocationDiff,
        needsRebalancing
      });
    }

    return holdings.sort((a, b) => b.currentValue - a.currentValue);
  }

  /**
   * Get latest prices for tickers
   * Uses Yahoo Finance with fallback to database
   */
  private static async getLatestPrices(tickers: string[]): Promise<Map<string, number>> {
    const priceMap = await getQuotes(tickers);
    return pricesToNumberMap(priceMap);
  }

  /**
   * Calculate cash balance from transactions using FAST aggregation
   * Same logic as PortfolioTransactionService.getCurrentCashBalance()
   */
  private static calculateCashBalance(transactions: any[]): number {
    if (transactions.length === 0) return 0;
    
    let balance = 0;
    
    console.log(`\n💰 [METRICS - CASH BALANCE] Calculating for ${transactions.length} transactions...`);
    
    for (const tx of transactions) {
      const amount = Number(tx.amount);
      const dateStr = tx.date.toISOString().split('T')[0];
      
      // Credits increase cash
      if (tx.type === 'CASH_CREDIT' || tx.type === 'DIVIDEND' || 
          tx.type === 'SELL_REBALANCE' || tx.type === 'SELL_WITHDRAWAL') {
        balance += amount;
        console.log(`  ✅ [${dateStr}] ${tx.type} ${tx.ticker || '-'}: +R$ ${amount.toFixed(2)} → R$ ${balance.toFixed(2)}`);
      }
      // Debits decrease cash
      else if (tx.type === 'CASH_DEBIT' || tx.type === 'BUY' || tx.type === 'BUY_REBALANCE') {
        balance -= amount;
        console.log(`  ❌ [${dateStr}] ${tx.type} ${tx.ticker || '-'}: -R$ ${amount.toFixed(2)} → R$ ${balance.toFixed(2)}`);
      }
    }

    console.log(`💵 [METRICS] Final Cash Balance: R$ ${balance.toFixed(2)}\n`);
    
    return balance;
  }

  /**
   * Calculate total invested, withdrawn, and dividends
   */
  private static calculateTotals(transactions: any[]): {
    totalInvested: number;
    totalWithdrawn: number;
    totalDividends: number;
  } {
    let totalCashCredits = 0;
    let totalPurchases = 0;
    let totalWithdrawn = 0;
    let totalDividends = 0;

    for (const tx of transactions) {
      if (tx.type === 'CASH_CREDIT') {
        totalCashCredits += Number(tx.amount);
      } else if (tx.type === 'BUY' || tx.type === 'BUY_REBALANCE') {
        totalPurchases += Number(tx.amount);
      } else if (tx.type === 'CASH_DEBIT' || tx.type === 'SELL_WITHDRAWAL') {
        totalWithdrawn += Number(tx.amount);
      } else if (tx.type === 'DIVIDEND') {
        totalDividends += Number(tx.amount);
      }
    }

    // Use cash credits as totalInvested if available, otherwise use purchase amounts
    // This handles cases where users create retroactive purchases without registering contributions
    const totalInvested = totalCashCredits > 0 ? totalCashCredits : totalPurchases;

    console.log('💰 [CALCULATE TOTALS]', {
      totalCashCredits: totalCashCredits.toFixed(2),
      totalPurchases: totalPurchases.toFixed(2),
      totalWithdrawn: totalWithdrawn.toFixed(2),
      totalDividends: totalDividends.toFixed(2),
      totalInvested: totalInvested.toFixed(2)
    });

    return { totalInvested, totalWithdrawn, totalDividends };
  }

  /**
   * Calculate evolution data (monthly snapshots)
   * Agora inclui o campo 'invested' para cálculo correto de drawdown
   */
  // ✅ Métodos calculateEvolutionData e getPricesAsOf REMOVIDOS
  // Agora usamos PortfolioAnalyticsService.calculateEvolution() diretamente

  /**
   * Calculate monthly returns
   */
  private static calculateMonthlyReturns(
    evolutionData: { date: string; value: number; cashBalance: number }[]
  ): { date: string; return: number; portfolioValue: number }[] {
    const returns: { date: string; return: number; portfolioValue: number }[] = [];
    
    for (let i = 1; i < evolutionData.length; i++) {
      const current = evolutionData[i];
      const previous = evolutionData[i - 1];
      
      const monthReturn = previous.value > 0 ? (current.value - previous.value) / previous.value : 0;
      
      returns.push({
        date: current.date,
        return: monthReturn,
        portfolioValue: current.value
      });
    }

    return returns;
  }

  /**
   * Calculate volatility ANUALIZADA (annualized standard deviation)
   * 
   * IMPORTANTE: Esta volatilidade é ANUALIZADA para fins de comparação com benchmarks
   * e outras métricas de investimento que são tipicamente expressas em base anual.
   * 
   * A volatilidade em Analytics é MENSAL (não anualizada) para análise detalhada.
   * Exemplo: Mensal = 0.10%, Anualizada = 0.10% * √12 ≈ 0.34%
   */
  private static calculateVolatility(
    monthlyReturns: { date: string; return: number; portfolioValue: number }[]
  ): number | null {
    if (monthlyReturns.length < 2) return null;

    const returns = monthlyReturns.map(r => r.return);
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Annualize (monthly to yearly) - Multiplica por √12 para anualizar
    return stdDev * Math.sqrt(12);
  }

  /**
   * Calculate annualized return
   */
  private static calculateAnnualizedReturn(totalReturn: number, months: number): number | null {
    if (months < 12) return null; // Need at least 1 year
    
    const years = months / 12;
    return Math.pow(1 + totalReturn, 1 / years) - 1;
  }

  /**
   * Calculate Sharpe Ratio (risk-free rate assumed 0%)
   */
  private static calculateSharpeRatio(annualizedReturn: number, volatility: number): number {
    const riskFreeRate = 0; // Could be updated to use current Selic rate
    return (annualizedReturn - riskFreeRate) / volatility;
  }

  // ✅ Método calculateMaxDrawdown REMOVIDO
  // Agora usamos PortfolioAnalyticsService.calculateDrawdown() diretamente

  /**
   * Get sector allocation
   */
  static async getSectorAllocation(
    holdings: PortfolioHolding[]
  ): Promise<{ sector: string; value: number; percentage: number }[]> {
    const sectorMap = new Map<string, number>();
    let totalValue = 0;

    // Get company sectors
    const tickers = holdings.map(h => h.ticker);
    const companies = await prisma.company.findMany({
      where: {
        ticker: {
          in: tickers
        }
      },
      select: {
        ticker: true,
        sector: true
      }
    });

    const sectorByTicker = new Map<string, string>();
    for (const company of companies) {
      sectorByTicker.set(company.ticker, company.sector || 'Outros');
    }

    // Aggregate by sector
    for (const holding of holdings) {
      const sector = sectorByTicker.get(holding.ticker) || 'Outros';
      const current = sectorMap.get(sector) || 0;
      sectorMap.set(sector, current + holding.currentValue);
      totalValue += holding.currentValue;
    }

    // Convert to array
    const allocation = Array.from(sectorMap.entries()).map(([sector, value]) => ({
      sector,
      value,
      percentage: totalValue > 0 ? value / totalValue : 0
    }));

    return allocation.sort((a, b) => b.value - a.value);
  }

  /**
   * Get industry allocation
   */
  static async getIndustryAllocation(
    holdings: PortfolioHolding[]
  ): Promise<{ industry: string; value: number; percentage: number }[]> {
    const industryMap = new Map<string, number>();
    let totalValue = 0;

    // Get company industries
    const tickers = holdings.map(h => h.ticker);
    const companies = await prisma.company.findMany({
      where: {
        ticker: {
          in: tickers
        }
      },
      select: {
        ticker: true,
        industry: true
      }
    });

    const industryByTicker = new Map<string, string>();
    for (const company of companies) {
      industryByTicker.set(company.ticker, company.industry || 'Outros');
    }

    // Aggregate by industry
    for (const holding of holdings) {
      const industry = industryByTicker.get(holding.ticker) || 'Outros';
      const current = industryMap.get(industry) || 0;
      industryMap.set(industry, current + holding.currentValue);
      totalValue += holding.currentValue;
    }

    // Convert to array
    const allocation = Array.from(industryMap.entries()).map(([industry, value]) => ({
      industry,
      value,
      percentage: totalValue > 0 ? value / totalValue : 0
    }));

    return allocation.sort((a, b) => b.value - a.value);
  }

  /**
   * Save metrics to database
   */
  static async updateMetrics(
    portfolioId: string,
    userId: string
  ): Promise<void> {
    const metrics = await this.calculatePortfolioMetrics(portfolioId, userId);

    // Ensure all Decimal fields are valid numbers (no NaN, Infinity, or undefined)
    const safeDecimal = (value: number | null | undefined): number | null => {
      if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
        return null;
      }
      return value;
    };

    await safeWrite(
      'upsert-portfolio_metrics',
      () => prisma.portfolioMetrics.upsert({
        where: {
          portfolioId
        },
        create: {
          portfolio: {
            connect: { id: portfolioId }
          },
          currentValue: metrics.currentValue,
          cashBalance: metrics.cashBalance,
          totalInvested: metrics.totalInvested,
          totalWithdrawn: metrics.totalWithdrawn,
          totalDividends: metrics.totalDividends,
          totalReturn: safeDecimal(metrics.totalReturn) ?? 0,
          annualizedReturn: safeDecimal(metrics.annualizedReturn),
          volatility: safeDecimal(metrics.volatility),
          sharpeRatio: safeDecimal(metrics.sharpeRatio),
          maxDrawdown: safeDecimal(metrics.maxDrawdown),
          assetHoldings: metrics.holdings as unknown as Prisma.InputJsonValue,
          monthlyReturns: metrics.monthlyReturns as unknown as Prisma.InputJsonValue,
          evolutionData: metrics.evolutionData as unknown as Prisma.InputJsonValue,
          sectorAllocation: metrics.sectorAllocation as unknown as Prisma.InputJsonValue,
          industryAllocation: metrics.industryAllocation as unknown as Prisma.InputJsonValue
        },
        update: {
          currentValue: metrics.currentValue,
          cashBalance: metrics.cashBalance,
          totalInvested: metrics.totalInvested,
          totalWithdrawn: metrics.totalWithdrawn,
          totalDividends: metrics.totalDividends,
          totalReturn: safeDecimal(metrics.totalReturn) ?? 0,
          annualizedReturn: safeDecimal(metrics.annualizedReturn),
          volatility: safeDecimal(metrics.volatility),
          sharpeRatio: safeDecimal(metrics.sharpeRatio),
          maxDrawdown: safeDecimal(metrics.maxDrawdown),
          assetHoldings: metrics.holdings as unknown as Prisma.InputJsonValue,
          monthlyReturns: metrics.monthlyReturns as unknown as Prisma.InputJsonValue,
          evolutionData: metrics.evolutionData as unknown as Prisma.InputJsonValue,
          sectorAllocation: metrics.sectorAllocation as unknown as Prisma.InputJsonValue,
          industryAllocation: metrics.industryAllocation as unknown as Prisma.InputJsonValue,
          lastCalculatedAt: new Date()
        }
      }),
      ['portfolio_metrics']
    );

    console.log(`✅ Portfolio metrics updated: ${portfolioId}`);
  }

  /**
   * Get cached metrics from database
   */
  static async getMetrics(portfolioId: string, userId: string): Promise<any> {
    // Verify ownership
    const portfolio = await PortfolioService.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // NO CACHE - Read directly from Prisma for now
    const metrics = await prisma.portfolioMetrics.findUnique({
      where: {
        portfolioId
      }
    });

    if (!metrics) {
      // Calculate and save if not exists
      await this.updateMetrics(portfolioId, userId);
      return await this.getMetrics(portfolioId, userId);
    }

    return {
      ...metrics,
      currentValue: Number(metrics.currentValue),
      cashBalance: Number(metrics.cashBalance),
      totalInvested: Number(metrics.totalInvested),
      totalWithdrawn: Number(metrics.totalWithdrawn),
      totalDividends: Number(metrics.totalDividends),
      totalReturn: Number(metrics.totalReturn),
      annualizedReturn: metrics.annualizedReturn ? Number(metrics.annualizedReturn) : null,
      volatility: metrics.volatility ? Number(metrics.volatility) : null,
      sharpeRatio: metrics.sharpeRatio ? Number(metrics.sharpeRatio) : null,
      maxDrawdown: metrics.maxDrawdown ? Number(metrics.maxDrawdown) : null
    };
  }
}

