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

export interface ClosedPosition {
  ticker: string;
  averagePrice: number; // Preço médio de compra
  totalInvested: number; // Total investido (compras)
  totalSold: number; // Total recebido com vendas
  realizedReturn: number; // Rentabilidade realizada (vendas - compras)
  realizedReturnPercentage: number; // Percentual de rentabilidade realizada
  totalDividends: number; // Total de dividendos recebidos (incluindo após sair da posição)
  totalReturn: number; // Rentabilidade total (realizada + dividendos)
  totalReturnPercentage: number; // Percentual de rentabilidade total
  closedDate: Date; // Data em que a posição foi zerada
}

export interface PortfolioMetricsData {
  currentValue: number;
  cashBalance: number;
  totalInvested: number;
  totalWithdrawn: number;
  netInvested: number; // Capital líquido investido (totalInvested - totalWithdrawn)
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
    
    // Calculate current portfolio value (holdings only, NOT including cash)
    const holdingsValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    
    // 🔧 CORREÇÃO CRÍTICA: Cálculo CORRETO do retorno total considerando saques
    // 
    // Fórmula correta: Retorno = (Valor Atual + Saques - Investido) / Investido
    // 
    // Onde:
    // - Valor Atual = Valor de mercado dos ativos + Caixa disponível
    // - Saques = Total de saques (CASH_DEBIT) - dinheiro que saiu da carteira
    // - Investido = Total de aportes (CASH_CREDIT + MONTHLY_CONTRIBUTION)
    //
    // IMPORTANTE: 
    // - Saques DEVEM ser somados ao valor atual no cálculo do retorno
    //   porque representam dinheiro que você retirou mas que faz parte do retorno total
    // - Se você investiu R$ 10.000, tem R$ 10.600 na carteira e sacou R$ 1.000,
    //   seu retorno é: (10.600 + 1.000 - 10.000) / 10.000 = 16%
    // - Se calcular sem somar saques: (10.600 - 9.000) / 9.000 = 17,78% (ERRADO!)
    
    const currentTotalValue = holdingsValue + cashBalance;
    
    // Retorno = (Valor Atual + Saques - Investido) / Investido
    // Isso garante que o retorno não aumenta artificialmente quando você saca dinheiro
    const totalReturn = totalInvested > 0 
      ? (currentTotalValue + totalWithdrawn - totalInvested) / totalInvested
      : 0;
    
    const netInvested = totalInvested - totalWithdrawn; // Capital líquido investido (para exibição)
    const totalGain = currentTotalValue + totalWithdrawn - totalInvested; // Ganho total incluindo saques
    
    console.log('📊 [CALCULATE RETURN]', {
      holdingsValue: holdingsValue.toFixed(2),
      cashBalance: cashBalance.toFixed(2),
      currentTotalValue: currentTotalValue.toFixed(2),
      totalInvested: totalInvested.toFixed(2),
      totalWithdrawn: totalWithdrawn.toFixed(2),
      netInvested: netInvested.toFixed(2),
      totalGain: totalGain.toFixed(2),
      totalReturn: (totalReturn * 100).toFixed(2) + '%',
      formula: `(${currentTotalValue.toFixed(2)} + ${totalWithdrawn.toFixed(2)} - ${totalInvested.toFixed(2)}) / ${totalInvested.toFixed(2)} = ${(totalReturn * 100).toFixed(2)}%`
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
    
    // 💰 Valor total do portfólio = holdings + caixa (para exibição)
    const currentValue = currentTotalValue; // Já calculado acima
    
    const metrics: PortfolioMetricsData = {
      currentValue,
      cashBalance,
      totalInvested,
      totalWithdrawn,
      netInvested, // Capital líquido investido (usado no cálculo do retorno)
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
   * Calculate adjusted dividends by ticker, considering partial sales
   * 
   * When you sell part of a position, the dividends received while holding those shares
   * should not be counted in the return calculation for the remaining shares.
   * 
   * This method calculates dividends proportionally to shares still held.
   * 
   * Example:
   * - You had 100 shares, received R$ 1000 in dividends (R$ 10/share)
   * - You sold 80 shares, leaving 20 shares
   * - Adjusted dividends = R$ 1000 * (20/100) = R$ 200
   * 
   * This ensures the return calculation is correct:
   * - Return with dividends = (current value - invested) + adjusted dividends
   * - Where invested is also reduced proportionally (already handled in holdings calculation)
   */
  private static async getAdjustedDividendsByTicker(
    portfolioId: string,
    currentHoldings: Map<string, { quantity: number; totalInvested: number }>
  ): Promise<Map<string, number>> {
    // Get all transactions in chronological order
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

    // Calculate adjusted dividends for each ticker
    const adjustedDividends = new Map<string, number>();
    
    for (const [ticker, holding] of currentHoldings) {
      const currentQuantity = holding.quantity;
      
      if (currentQuantity <= 0) {
        adjustedDividends.set(ticker, 0);
        continue;
      }

      // Process transactions chronologically to calculate shares held at each dividend date
      let cumulativeSharesBought = 0;
      let cumulativeSharesSold = 0;
      let totalAdjustedDividends = 0;
      
      for (const tx of transactions) {
        if (tx.ticker !== ticker) continue;
        
        if (tx.type === 'BUY' || tx.type === 'BUY_REBALANCE') {
          cumulativeSharesBought += Number(tx.quantity || 0);
        } else if (tx.type === 'SELL_REBALANCE' || tx.type === 'SELL_WITHDRAWAL') {
          cumulativeSharesSold += Number(tx.quantity || 0);
        } else if (tx.type === 'DIVIDEND') {
          // Calculate shares held at dividend date
          const sharesHeldAtDividend = cumulativeSharesBought - cumulativeSharesSold;
          
          if (sharesHeldAtDividend > 0) {
            // Calculate proportion: current shares / shares held when dividend was received
            // This proportion represents how much of the dividend should be counted
            // If you had 100 shares when dividend was paid and now have 20, count 20% of the dividend
            const proportion = Math.min(currentQuantity / sharesHeldAtDividend, 1.0);
            
            const dividendAmount = Number(tx.amount);
            const adjustedDividend = dividendAmount * proportion;
            totalAdjustedDividends += adjustedDividend;
            
            console.log(`💰 [ADJUSTED DIVIDENDS] ${ticker}:`, {
              dividendDate: tx.date.toISOString().split('T')[0],
              sharesHeldAtDividend,
              currentShares: currentQuantity,
              dividendAmount: dividendAmount.toFixed(2),
              proportion: (proportion * 100).toFixed(2) + '%',
              adjustedDividend: adjustedDividend.toFixed(2)
            });
          }
        }
      }

      adjustedDividends.set(ticker, totalAdjustedDividends);
    }

    return adjustedDividends;
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

    // Get adjusted dividends by ticker (considering partial sales)
    const dividendsByTicker = await this.getAdjustedDividendsByTicker(portfolioId, holdingsMap);

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
      // 1. Target allocation is 0% and we have any position (should always sell), OR
      // 2. Absolute difference > 5 percentage points (e.g., 10% vs 5%), OR
      // 3. Relative deviation > 20% of target (e.g., actual is 6% when target is 5%)
      const absoluteDiff = Math.abs(allocationDiff);
      const relativeDeviation = targetAllocation > 0
        ? Math.abs(allocationDiff / targetAllocation)
        : 0;
      
      // Special case: if target is 0% and we have any position, always needs rebalancing
      const needsRebalancing = targetAllocation === 0 
        ? actualAllocation > 0 
        : (absoluteDiff > 0.05 || relativeDeviation > 0.20);

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
   * Get closed positions (assets that were fully sold)
   * Calculates realized return and total return including dividends
   */
  static async getClosedPositions(portfolioId: string): Promise<ClosedPosition[]> {
    console.log(`\n🔍 [CLOSED POSITIONS] Analyzing portfolio ${portfolioId}...`);
    
    // Get all executed transactions
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

    console.log(`📊 [CLOSED POSITIONS] Found ${transactions.length} transactions`);

    // Track positions over time
    const positionHistory = new Map<string, {
      quantity: number;
      totalInvested: number;
      totalSold: number;
      lastTransactionDate: Date;
    }>();

    // Track all dividends by ticker (including after position closed)
    const allDividendsByTicker = await this.getDividendsByTicker(portfolioId);

    // Process transactions chronologically
    for (const tx of transactions) {
      if (!tx.ticker) continue;

      const ticker = tx.ticker;
      const current = positionHistory.get(ticker) || {
        quantity: 0,
        totalInvested: 0,
        totalSold: 0,
        lastTransactionDate: tx.date
      };

      if (tx.type === 'BUY' || tx.type === 'BUY_REBALANCE') {
        // Purchase: add quantity and invested amount
        const quantity = Number(tx.quantity || 0);
        const amount = Number(tx.amount);
        
        // Calculate new average price
        const totalQuantity = current.quantity + quantity;
        const totalInvested = current.totalInvested + amount;
        
        current.quantity = totalQuantity;
        current.totalInvested = totalInvested;
        current.lastTransactionDate = tx.date;
      } else if (tx.type === 'SELL_REBALANCE' || tx.type === 'SELL_WITHDRAWAL') {
        // Sale: reduce quantity and track sale proceeds
        const quantitySold = Number(tx.quantity || 0);
        const saleAmount = Number(tx.amount);
        
        if (current.quantity > 0) {
          // Calculate average cost per share
          const averageCost = current.totalInvested / current.quantity;
          
          // Reduce quantity and invested proportionally
          const costReduction = averageCost * quantitySold;
          current.quantity -= quantitySold;
          current.totalInvested -= costReduction;
          current.totalSold += saleAmount;
          current.lastTransactionDate = tx.date;
        }
      }

      positionHistory.set(ticker, current);
    }

    // Find positions that are closed (quantity = 0) but had transactions
    const closedPositions: ClosedPosition[] = [];

    console.log(`📋 [CLOSED POSITIONS] Analyzing ${positionHistory.size} tickers in position history`);

    for (const [ticker, position] of positionHistory) {
      console.log(`\n🔍 [CLOSED POSITIONS] Checking ${ticker}:`, {
        quantity: position.quantity,
        totalInvested: position.totalInvested,
        totalSold: position.totalSold
      });

      // First, check if there were any purchases for this ticker
      // This is the source of truth - if there were purchases, we can have a closed position
      let totalSharesBought = 0;
      let originalTotalInvested = 0;
      
      for (const tx of transactions) {
        if (tx.ticker !== ticker) continue;
        if (tx.type === 'BUY' || tx.type === 'BUY_REBALANCE') {
          totalSharesBought += Number(tx.quantity || 0);
          originalTotalInvested += Number(tx.amount);
        }
      }

      console.log(`  📊 [CLOSED POSITIONS] ${ticker} summary:`, {
        totalSharesBought,
        originalTotalInvested,
        currentQuantity: position.quantity,
        totalSold: position.totalSold
      });
      
      // Only include positions that:
      // 1. Are fully closed (quantity = 0 or very close to 0 due to rounding)
      // 2. Had purchases (originalTotalInvested > 0)
      // 3. Had sales (totalSold > 0) - meaning we actually sold everything
      const isClosed = Math.abs(position.quantity) < 0.01; // Allow for small rounding errors
      if (isClosed && originalTotalInvested > 0 && position.totalSold > 0) {
        console.log(`  ✅ [CLOSED POSITIONS] ${ticker} is CLOSED - adding to list`);
        // Average price = total invested / total shares bought
        const averagePrice = totalSharesBought > 0 
          ? originalTotalInvested / totalSharesBought 
          : 0;

        // Realized return = total sold - original total invested
        const realizedReturn = position.totalSold - originalTotalInvested;
        const realizedReturnPercentage = originalTotalInvested > 0 
          ? (realizedReturn / originalTotalInvested) 
          : 0;

        // Get all dividends for this ticker (including after position closed)
        const totalDividends = allDividendsByTicker.get(ticker) || 0;
        
        // Total return = realized return + dividends
        const totalReturn = realizedReturn + totalDividends;
        const totalReturnPercentage = originalTotalInvested > 0 
          ? (totalReturn / originalTotalInvested) 
          : 0;

        closedPositions.push({
          ticker,
          averagePrice,
          totalInvested: originalTotalInvested,
          totalSold: position.totalSold,
          realizedReturn,
          realizedReturnPercentage,
          totalDividends,
          totalReturn,
          totalReturnPercentage,
          closedDate: position.lastTransactionDate
        });
      } else {
        console.log(`  ⏭️ [CLOSED POSITIONS] ${ticker} is NOT closed:`, {
          isClosed,
          hasPurchases: originalTotalInvested > 0,
          hasSales: position.totalSold > 0
        });
      }
    }

    // Also check for tickers that had purchases but are not in positionHistory
    // This can happen if all shares were sold in a single transaction
    const tickersWithPurchases = new Set<string>();
    for (const tx of transactions) {
      if (tx.ticker && (tx.type === 'BUY' || tx.type === 'BUY_REBALANCE')) {
        tickersWithPurchases.add(tx.ticker);
      }
    }

    for (const ticker of tickersWithPurchases) {
      // Skip if already in closedPositions
      if (closedPositions.some(p => p.ticker === ticker)) {
        continue;
      }

      // Check if this ticker is not in positionHistory (meaning quantity is 0)
      // or if it's in positionHistory but quantity is 0
      const position = positionHistory.get(ticker);
      const isNotInHistory = !position;
      const isZeroInHistory = position && Math.abs(position.quantity) < 0.01;

      if (isNotInHistory || isZeroInHistory) {
        // Calculate totals from transactions
        let totalSharesBought = 0;
        let originalTotalInvested = 0;
        let totalSold = 0;
        let lastSaleDate: Date | null = null;

        for (const tx of transactions) {
          if (tx.ticker !== ticker) continue;
          if (tx.type === 'BUY' || tx.type === 'BUY_REBALANCE') {
            totalSharesBought += Number(tx.quantity || 0);
            originalTotalInvested += Number(tx.amount);
          } else if (tx.type === 'SELL_REBALANCE' || tx.type === 'SELL_WITHDRAWAL') {
            totalSold += Number(tx.amount);
            if (!lastSaleDate || tx.date > lastSaleDate) {
              lastSaleDate = tx.date;
            }
          }
        }

        // If we had purchases and sales, and total sold > 0, it's a closed position
        if (originalTotalInvested > 0 && totalSold > 0 && lastSaleDate) {
          console.log(`  ✅ [CLOSED POSITIONS] ${ticker} found via transaction analysis - adding to list`);

          const averagePrice = totalSharesBought > 0 
            ? originalTotalInvested / totalSharesBought 
            : 0;

          const realizedReturn = totalSold - originalTotalInvested;
          const realizedReturnPercentage = originalTotalInvested > 0 
            ? (realizedReturn / originalTotalInvested) 
            : 0;

          const totalDividends = allDividendsByTicker.get(ticker) || 0;
          const totalReturn = realizedReturn + totalDividends;
          const totalReturnPercentage = originalTotalInvested > 0 
            ? (totalReturn / originalTotalInvested) 
            : 0;

          closedPositions.push({
            ticker,
            averagePrice,
            totalInvested: originalTotalInvested,
            totalSold,
            realizedReturn,
            realizedReturnPercentage,
            totalDividends,
            totalReturn,
            totalReturnPercentage,
            closedDate: lastSaleDate
          });
        }
      }
    }

    console.log(`\n✅ [CLOSED POSITIONS] Found ${closedPositions.length} closed positions`);
    closedPositions.forEach(pos => {
      console.log(`  - ${pos.ticker}: Investido R$ ${pos.totalInvested.toFixed(2)}, Vendido R$ ${pos.totalSold.toFixed(2)}, Retorno ${(pos.realizedReturnPercentage * 100).toFixed(2)}%`);
    });

    // Sort by closed date (most recent first)
    return closedPositions.sort((a, b) => 
      b.closedDate.getTime() - a.closedDate.getTime()
    );
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
          tx.type === 'SELL_REBALANCE' || tx.type === 'SELL_WITHDRAWAL' || tx.type === 'MONTHLY_CONTRIBUTION') {
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
   * 
   * 🔧 CORREÇÃO CRÍTICA: Conceito correto de saque
   * - CASH_DEBIT: Único tipo que representa saque REAL (dinheiro sai da carteira)
   * - SELL_REBALANCE: Venda para rebalancear (dinheiro fica em caixa, NÃO é saque)
   * - SELL_WITHDRAWAL: Venda para gerar caixa (dinheiro fica em caixa, NÃO é saque)
   * 
   * O saque só acontece quando há um CASH_DEBIT explícito!
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
      if (tx.type === 'CASH_CREDIT' || tx.type === 'MONTHLY_CONTRIBUTION') {
        // 🔧 CORREÇÃO: MONTHLY_CONTRIBUTION também é um aporte (dinheiro novo na carteira)
        // Deve ser contado como investimento, não como lucro
        totalCashCredits += Number(tx.amount);
      } else if (tx.type === 'BUY' || tx.type === 'BUY_REBALANCE') {
        totalPurchases += Number(tx.amount);
      } else if (tx.type === 'CASH_DEBIT') {
        // 🔧 CORREÇÃO: Apenas CASH_DEBIT é saque real (dinheiro sai da carteira)
        // SELL_WITHDRAWAL e SELL_REBALANCE apenas movem dinheiro para caixa
        totalWithdrawn += Number(tx.amount);
      } else if (tx.type === 'DIVIDEND') {
        totalDividends += Number(tx.amount);
      }
      // SELL_REBALANCE e SELL_WITHDRAWAL não são saques (dinheiro fica em caixa)
    }

    // Use cash credits as totalInvested if available, otherwise use purchase amounts
    // This handles cases where users create retroactive purchases without registering contributions
    const totalInvested = totalCashCredits > 0 ? totalCashCredits : totalPurchases;

    console.log('💰 [CALCULATE TOTALS]', {
      totalCashCredits: totalCashCredits.toFixed(2),
      totalPurchases: totalPurchases.toFixed(2),
      totalWithdrawn: totalWithdrawn.toFixed(2),
      totalDividends: totalDividends.toFixed(2),
      totalInvested: totalInvested.toFixed(2),
      note: 'CASH_CREDIT e MONTHLY_CONTRIBUTION são aportes (investimento). Apenas CASH_DEBIT é saque real'
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

    const totalInvested = Number(metrics.totalInvested);
    const totalWithdrawn = Number(metrics.totalWithdrawn);
    const netInvested = totalInvested - totalWithdrawn;
    
    return {
      ...metrics,
      currentValue: Number(metrics.currentValue),
      cashBalance: Number(metrics.cashBalance),
      totalInvested,
      totalWithdrawn,
      netInvested, // Capital líquido investido (usado no cálculo do retorno)
      totalDividends: Number(metrics.totalDividends),
      totalReturn: Number(metrics.totalReturn),
      annualizedReturn: metrics.annualizedReturn ? Number(metrics.annualizedReturn) : null,
      volatility: metrics.volatility ? Number(metrics.volatility) : null,
      sharpeRatio: metrics.sharpeRatio ? Number(metrics.sharpeRatio) : null,
      maxDrawdown: metrics.maxDrawdown ? Number(metrics.maxDrawdown) : null
    };
  }
}

