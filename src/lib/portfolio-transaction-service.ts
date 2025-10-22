/**
 * PORTFOLIO TRANSACTION SERVICE
 *
 * Manages portfolio transactions including:
 * - Automatic transaction suggestions
 * - Transaction confirmation/rejection
 * - Manual transaction entry
 * - Transaction history and queries
 */

import { prisma } from "@/lib/prisma";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { safeWrite } from "@/lib/prisma-wrapper";
import { PortfolioService } from "./portfolio-service";
import {
  getLatestPrices as getQuotes,
  pricesToNumberMap,
} from "./quote-service";
import { DividendService } from "./dividend-service";
// import { AssetRegistrationService } from './asset-registration-service'; // Not used currently

// Types
export interface TransactionInput {
  date: Date;
  type: TransactionType;
  ticker?: string;
  amount: number;
  price?: number;
  quantity?: number;
  notes?: string;
}

export interface TransactionFilters {
  status?: TransactionStatus | TransactionStatus[];
  type?: TransactionType | TransactionType[];
  startDate?: Date;
  endDate?: Date;
  ticker?: string;
}

export interface SuggestedTransaction {
  date: Date;
  type: TransactionType;
  ticker?: string;
  amount: number;
  price?: number;
  quantity?: number;
  reason: string;
  cashBalanceBefore: number;
  cashBalanceAfter: number;
}

/**
 * Portfolio Transaction Service
 */
export class PortfolioTransactionService {
  /**
   * Get all transactions for a portfolio
   */
  static async getPortfolioTransactions(
    portfolioId: string,
    userId: string,
    filters?: TransactionFilters
  ) {
    // Verify ownership
    const portfolio = await PortfolioService.getPortfolioConfig(
      portfolioId,
      userId
    );
    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    const where: any = {
      portfolioId,
    };

    if (filters) {
      if (filters.status) {
        where.status = Array.isArray(filters.status)
          ? { in: filters.status }
          : filters.status;
      }
      if (filters.type) {
        where.type = Array.isArray(filters.type)
          ? { in: filters.type }
          : filters.type;
      }
      if (filters.ticker) {
        where.ticker = filters.ticker.toUpperCase();
      }
      if (filters.startDate || filters.endDate) {
        where.date = {};
        if (filters.startDate) where.date.gte = filters.startDate;
        if (filters.endDate) where.date.lte = filters.endDate;
      }
    }

    // NO CACHE - Read directly from Prisma for now
    const transactions = await prisma.portfolioTransaction.findMany({
      where,
      orderBy: {
        date: "desc",
      },
    });

    return transactions.map((t: any) => ({
      ...t,
      amount: Number(t.amount),
      price: t.price ? Number(t.price) : null,
      quantity: t.quantity ? Number(t.quantity) : null,
      cashBalanceBefore: Number(t.cashBalanceBefore),
      cashBalanceAfter: Number(t.cashBalanceAfter),
      portfolioValueAfter: t.portfolioValueAfter
        ? Number(t.portfolioValueAfter)
        : null,
    }));
  }

  /**
   * Generate suggested transactions for pending months
   */
  static async getSuggestedTransactions(
    portfolioId: string,
    userId: string
  ): Promise<SuggestedTransaction[]> {
    // Verify ownership
    const portfolio = await PortfolioService.getPortfolioConfig(
      portfolioId,
      userId
    );
    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    // Don't generate suggestions if tracking hasn't started
    if (!portfolio.trackingStarted) {
      return [];
    }

    console.log(`🚀 [SUGGESTIONS] Starting parallel data fetch...`);
    const startTime = Date.now();

    // 🧹 AUTO-CLEANUP: Remove PENDING transactions from past months
    // This ensures that when a new month starts, old suggestions are removed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    const deletedOldPending = await prisma.portfolioTransaction.deleteMany({
      where: {
        portfolioId,
        status: "PENDING",
        isAutoSuggested: true,
        date: {
          lt: startOfCurrentMonth, // Delete PENDING transactions from before this month
        },
      },
    });

    if (deletedOldPending.count > 0) {
      console.log(
        `🧹 [AUTO-CLEANUP] Removed ${deletedOldPending.count} outdated PENDING transactions from previous months`
      );
    }

    // OPTIMIZATION: Parallelize independent operations
    const [holdings, prices, nextDates, existingTransactions] =
      await Promise.all([
        this.getCurrentHoldings(portfolioId),
        this.getLatestPrices(portfolio.assets.map((a) => a.ticker)),
        this.calculateNextTransactionDates(portfolioId),
        // Get existing transactions (PENDING, CONFIRMED, REJECTED) to avoid duplicates
        prisma.portfolioTransaction.findMany({
          where: {
            portfolioId,
            status: { in: ["PENDING", "CONFIRMED", "REJECTED"] },
            isAutoSuggested: true,
          },
          select: {
            date: true,
            type: true,
            ticker: true,
            status: true,
            amount: true,
          },
        }),
      ]);

    const fetchTime = Date.now() - startTime;
    console.log(
      `⚡ [PERFORMANCE] Data fetched in ${fetchTime}ms (parallelized)`
    );

    // Create a Set of existing transactions for fast lookup
    // Include PENDING, CONFIRMED, and REJECTED to avoid re-suggesting
    const existingTransactionKeys = new Set(
      existingTransactions.map(
        (tx) =>
          `${tx.date.toISOString().split("T")[0]}_${tx.type}_${
            tx.ticker || "null"
          }`
      )
    );

    // Create a Map for dividend amount checking (to avoid suggesting same dividend amount)
    const existingDividendMap = new Map<
      string,
      { amount: number; status: string }
    >();
    existingTransactions
      .filter((tx) => tx.type === "DIVIDEND" && tx.ticker)
      .forEach((tx) => {
        const key = `${tx.date.toISOString().split("T")[0]}_${tx.ticker}`;
        existingDividendMap.set(key, {
          amount: Number(tx.amount),
          status: tx.status,
        });
      });

    if (existingTransactionKeys.size > 0) {
      console.log(
        `🔍 [DEDUP CHECK] Found ${existingTransactionKeys.size} existing transactions (PENDING/CONFIRMED/REJECTED)`
      );
    }

    const suggestions: SuggestedTransaction[] = [];

    if (nextDates.length > 0) {
      console.log(
        `📅 [PENDING CONTRIBUTIONS] ${nextDates.length} pending monthly contributions`
      );

      // Generate suggestions for each missing month (includes rebalancing if needed)
      for (const date of nextDates) {
        const monthSuggestions = await this.generateMonthTransactions(
          portfolio,
          date,
          holdings,
          prices
        );

        suggestions.push(...monthSuggestions);

        // Update holdings with suggested transactions for next iteration
        this.updateHoldingsWithSuggestions(holdings, monthSuggestions);
      }
    } else {
      // No pending monthly contributions, check if immediate rebalancing is needed
      console.log(
        `📊 [NO PENDING MONTHS] Checking if rebalancing is needed...`
      );
      
      console.log(`🔍 [DEBUG] Portfolio data:`, {
        portfolioId: portfolio.id,
        assetsCount: portfolio.assets?.length || 0,
        assets: portfolio.assets?.map((a: any) => `${a.ticker}: ${(Number(a.targetAllocation) * 100).toFixed(1)}%`) || [],
        holdingsCount: holdings.size,
        holdings: Array.from(holdings.entries()).map(([ticker, holding]) => 
          `${ticker}: ${holding.quantity} shares (R$ ${holding.totalInvested.toFixed(2)} invested)`
        ),
        pricesCount: prices.size,
        prices: Array.from(prices.entries()).map(([ticker, price]) => `${ticker}: R$ ${price.toFixed(2)}`)
      });

      const rebalancingSuggestions = await this.generateRebalancingSuggestions(
        portfolio,
        holdings,
        prices
      );

      if (rebalancingSuggestions.length > 0) {
        console.log(
          `⚖️ [REBALANCING NEEDED] ${rebalancingSuggestions.length} rebalancing transactions suggested`
        );
        suggestions.push(...rebalancingSuggestions);
      } else {
        console.log(`✅ [PORTFOLIO BALANCED] No rebalancing needed`);
      }
    }

    // DIVIDEND SUGGESTIONS: Check for pending dividends in current month
    console.log(`💰 [DIVIDENDS] Checking for pending dividend payments...`);
    const dividendSuggestions = await this.generateDividendSuggestions(
      portfolioId,
      holdings,
      prices
    );

    if (dividendSuggestions.length > 0) {
      console.log(
        `💵 [DIVIDENDS] ${dividendSuggestions.length} dividend transactions suggested`
      );
      suggestions.push(...dividendSuggestions);
    } else {
      console.log(`✅ [DIVIDENDS] No pending dividends for current month`);
    }

    // INTELLIGENCE: Filter out suggestions that already exist
    const filteredSuggestions = suggestions.filter((suggestion) => {
      const key = `${suggestion.date.toISOString().split("T")[0]}_${
        suggestion.type
      }_${suggestion.ticker || "null"}`;

      // Check for exact match (any status)
      if (existingTransactionKeys.has(key)) {
        console.log(
          `⏩ [SKIP DUPLICATE] ${suggestion.type} ${
            suggestion.ticker || ""
          } on ${suggestion.date.toISOString().split("T")[0]} already exists`
        );
        return false;
      }

      // Special handling for dividends - check for similar amounts
      if (suggestion.type === "DIVIDEND" && suggestion.ticker) {
        const dividendKey = `${suggestion.date.toISOString().split("T")[0]}_${
          suggestion.ticker
        }`;
        const existingDividend = existingDividendMap.get(dividendKey);

        if (existingDividend) {
          const amountDiff = Math.abs(
            existingDividend.amount - suggestion.amount
          );
          const tolerance = Math.max(0.01, suggestion.amount * 0.05); // 5% tolerance or R$ 0.01 minimum

          if (amountDiff <= tolerance) {
            console.log(
              `⏩ [SKIP SIMILAR DIVIDEND] ${suggestion.ticker} on ${
                suggestion.date.toISOString().split("T")[0]
              }: R$ ${suggestion.amount.toFixed(
                2
              )} vs existing R$ ${existingDividend.amount.toFixed(2)} (${
                existingDividend.status
              })`
            );
            return false;
          }
        }
      }

      return true;
    });

    const skippedCount = suggestions.length - filteredSuggestions.length;

    if (skippedCount > 0) {
      console.log(
        `🛡️ [DEDUP] Skipped ${skippedCount} suggestions (already exist as PENDING)`
      );
    }

    const totalTime = Date.now() - startTime;
    console.log(
      `✅ [TOTAL SUGGESTIONS] ${filteredSuggestions.length} unique transactions suggested (${totalTime}ms total)`
    );

    return filteredSuggestions;
  }

  /**
   * Calculate next transaction dates based on rebalance frequency
   * Only returns FUTURE dates (today or later) that are due for contribution
   */
  private static async calculateNextTransactionDates(
    portfolioId: string
  ): Promise<Date[]> {
    const portfolio = await prisma.portfolioConfig.findUnique({
      where: { id: portfolioId },
      select: {
        startDate: true,
        rebalanceFrequency: true,
      },
    });

    if (!portfolio) return [];

    // Get the REAL last transaction date from actual transactions
    const lastTransaction = await prisma.portfolioTransaction.findFirst({
      where: {
        portfolioId,
        status: { in: ["CONFIRMED", "EXECUTED"] },
        type: "CASH_CREDIT", // Last monthly contribution
      },
      orderBy: {
        date: "desc",
      },
      select: {
        date: true,
      },
    });

    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const startDate = lastTransaction?.date || portfolio.startDate;
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    console.log(
      `📆 [DATE CALC] Last contribution: ${
        startDate.toISOString().split("T")[0]
      }, Today: ${today.toISOString().split("T")[0]}`
    );

    // Calculate frequency in months
    const frequencyMonths =
      portfolio.rebalanceFrequency === "monthly"
        ? 1
        : portfolio.rebalanceFrequency === "quarterly"
        ? 3
        : 12;

    // Calculate next contribution date after last transaction
    currentDate.setMonth(currentDate.getMonth() + frequencyMonths);

    // Only include if date is today or in the past (overdue)
    // But we'll use today's date for overdue contributions
    if (currentDate <= today) {
      // Contribution is overdue, suggest it for today
      dates.push(new Date(today));
      console.log(
        `📅 [PENDING] Contribution overdue (expected ${
          currentDate.toISOString().split("T")[0]
        }), suggesting for TODAY (${today.toISOString().split("T")[0]})`
      );
    }
    // Future date - not yet due
    else {
      console.log(
        `⏰ [NOT DUE] Next contribution scheduled for ${
          currentDate.toISOString().split("T")[0]
        }`
      );
    }

    return dates;
  }

  /**
   * Get current holdings from executed/confirmed transactions
   */
  private static async getCurrentHoldings(
    portfolioId: string
  ): Promise<Map<string, { quantity: number; totalInvested: number }>> {
    const transactions = await prisma.portfolioTransaction.findMany({
      where: {
        portfolioId,
        status: {
          in: ["CONFIRMED", "EXECUTED"],
        },
        ticker: {
          not: null,
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    console.log(`\n📊 [GET HOLDINGS] Processing ${transactions.length} transactions...`);

    const holdings = new Map<
      string,
      { quantity: number; totalInvested: number }
    >();

    for (const tx of transactions) {
      if (!tx.ticker) continue;

      const current = holdings.get(tx.ticker) || {
        quantity: 0,
        totalInvested: 0,
      };

      const before = { ...current };

      if (tx.type === "BUY" || tx.type === "BUY_REBALANCE") {
        current.quantity += Number(tx.quantity || 0);
        current.totalInvested += Number(tx.amount);
      } else if (
        tx.type === "SELL_REBALANCE" ||
        tx.type === "SELL_WITHDRAWAL"
      ) {
        const quantitySold = Number(tx.quantity || 0);
        const quantityBefore = current.quantity;
        const investedBefore = current.totalInvested;
        
        // Calculate average cost per share BEFORE the sale
        const averageCost = quantityBefore > 0 ? investedBefore / quantityBefore : 0;
        
        // Reduce quantity and totalInvested by the COST of shares sold (not sale value)
        current.quantity -= quantitySold;
        const costReduction = averageCost * quantitySold;
        current.totalInvested -= costReduction;
        
        console.log(`  📉 [SELL] ${tx.ticker}: Sold ${quantitySold} shares, cost reduction: R$ ${costReduction.toFixed(2)}`);
      }

      console.log(`  ${tx.type === 'BUY' || tx.type === 'BUY_REBALANCE' ? '📈' : '📉'} [${tx.date.toISOString().split('T')[0]}] ${tx.type} ${tx.ticker}: ${before.quantity} → ${current.quantity} shares, R$ ${before.totalInvested.toFixed(2)} → R$ ${current.totalInvested.toFixed(2)}`);

      holdings.set(tx.ticker, current);
    }

    console.log(`\n✅ [HOLDINGS SUMMARY]:`);
    for (const [ticker, holding] of holdings) {
      if (holding.quantity > 0) {
        console.log(`  ${ticker}: ${holding.quantity} shares, R$ ${holding.totalInvested.toFixed(2)} invested`);
      }
    }
    console.log('');

    return holdings;
  }

  /**
   * Get holdings as of a specific date (for dividend eligibility checks)
   * Only includes BUY and SELL transactions, NOT rebalancing transactions
   * This ensures dividends are only suggested for assets held in custody, not rebalancing purchases
   */
  private static async getHoldingsAsOfDate(
    portfolioId: string,
    asOfDate: Date
  ): Promise<Map<string, { quantity: number; totalInvested: number }>> {
    const transactions = await prisma.portfolioTransaction.findMany({
      where: {
        portfolioId,
        status: {
          in: ["CONFIRMED", "EXECUTED"],
        },
        ticker: {
          not: null,
        },
        date: {
          lte: asOfDate,
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    const holdings = new Map<
      string,
      { quantity: number; totalInvested: number }
    >();

    for (const tx of transactions) {
      if (!tx.ticker) continue;

      const current = holdings.get(tx.ticker) || {
        quantity: 0,
        totalInvested: 0,
      };

      // Only count regular BUY/SELL transactions, not rebalancing
      if (tx.type === "BUY" || tx.type === "BUY_REBALANCE") {
        current.quantity += Number(tx.quantity || 0);
        current.totalInvested += Number(tx.amount);
      } else if (
        tx.type === "SELL_REBALANCE" ||
        tx.type === "SELL_WITHDRAWAL"
      ) {
        current.quantity -= Number(tx.quantity || 0);
        current.totalInvested -= Number(tx.amount);
      }

      holdings.set(tx.ticker, current);
    }

    return holdings;
  }

  /**
   * Get latest prices for tickers
   * Uses Yahoo Finance with fallback to database
   */
  private static async getLatestPrices(
    tickers: string[]
  ): Promise<Map<string, number>> {
    const priceMap = await getQuotes(tickers);
    return pricesToNumberMap(priceMap);
  }

  /**
   * Calculate total portfolio value (holdings + cash)
   */
  private static calculatePortfolioValue(
    holdings: Map<string, { quantity: number; totalInvested: number }>,
    prices: Map<string, number>
  ): number {
    let totalValue = 0;
    
    for (const [ticker, holding] of holdings) {
      const price = prices.get(ticker) || 0;
      const currentValue = holding.quantity * price;
      totalValue += currentValue;
    }
    
    return totalValue;
  }


  /**
   * Generate immediate rebalancing suggestions (if portfolio is unbalanced)
   */
  private static async generateRebalancingSuggestions(
    portfolio: any,
    holdings: Map<string, { quantity: number; totalInvested: number }>,
    prices: Map<string, number>
  ): Promise<SuggestedTransaction[]> {
    console.log(`🔄 [REBALANCING] Starting rebalancing analysis...`);
    
    const suggestions: SuggestedTransaction[] = [];

    // 💰 Calcular valores do portfólio
    const currentCash = await this.getCurrentCashBalance(portfolio.id);
    const holdingsValue = this.calculatePortfolioValue(holdings, prices);
    
    // 🔧 CORREÇÃO: Considera tambem o saldo em caixa para rebalancear
    const portfolioValueForAllocation = holdingsValue + currentCash;
    
    console.log(`💰 [REBALANCING] Portfolio breakdown:`, {
      holdingsValue: holdingsValue.toFixed(2),
      currentCash: currentCash.toFixed(2),
      totalValue: (holdingsValue + currentCash).toFixed(2),
      note: 'Alocações calculadas sobre holdings apenas (sem caixa)'
    });

    if (portfolioValueForAllocation === 0) {
      console.log("⚠️ [REBALANCING] Portfolio value is 0, no rebalancing needed");
      return [];
    }

    const currentAllocations = this.calculateCurrentAllocations(
      holdings,
      prices,
      portfolioValueForAllocation
    );

    // Check if rebalancing is needed
    // Criteria: >2 percentage points absolute OR >15% relative deviation
    const deviations: Array<{
      ticker: string;
      current: number;
      target: number;
      diff: number;
    }> = [];

    for (const asset of portfolio.assets) {
      const currentAlloc = currentAllocations.get(asset.ticker) || 0;
      const targetAlloc = Number(asset.targetAllocation);
      const diff = currentAlloc - targetAlloc;

      const absoluteDiff = Math.abs(diff);
      const relativeDeviation =
        targetAlloc > 0 ? Math.abs(diff / targetAlloc) : 0;

      // Needs rebalancing if absolute diff > 2% OR relative deviation > 15%
      if (absoluteDiff > 0.02 || relativeDeviation > 0.15) {
        deviations.push({
          ticker: asset.ticker,
          current: currentAlloc,
          target: targetAlloc,
          diff,
        });
      }
    }

    // 🚨 CRÍTICO: Detectar ativos NÃO CONFIGURADOS na alocação
    const configuredTickers = new Set(portfolio.assets.map((asset: any) => asset.ticker));
    const unconfiguredAssets: Array<{
      ticker: string;
      current: number;
      shouldSell: boolean;
    }> = [];

    for (const [ticker, holding] of holdings) {
      if (!configuredTickers.has(ticker) && holding.quantity > 0) {
        const currentValue = holding.quantity * (prices.get(ticker) || 0);
        const currentAlloc = portfolioValueForAllocation > 0 ? currentValue / portfolioValueForAllocation : 0;
        
        unconfiguredAssets.push({
          ticker,
          current: currentAlloc,
          shouldSell: true
        });
        
        console.log(`🚨 [UNCONFIGURED ASSET] ${ticker}: ${(currentAlloc * 100).toFixed(2)}% (R$ ${currentValue.toFixed(2)}) - NOT in allocation config`);
      }
    }

    const totalPortfolioValue = holdingsValue + currentCash;
    const cashPercentage = totalPortfolioValue > 0 ? currentCash / totalPortfolioValue : 0;
    
    console.log(`💰 [CASH ANALYSIS] Available cash: R$ ${currentCash.toFixed(2)} (${(cashPercentage * 100).toFixed(1)}% of portfolio)`);

    // Determinar se precisa de rebalanceamento
    const needsRebalancing = deviations.length > 0 || unconfiguredAssets.length > 0 || cashPercentage > 0.05;

    if (!needsRebalancing) {
      console.log("✅ Portfolio is balanced, no rebalancing needed");
      return [];
    }

    console.log("⚖️ Portfolio needs rebalancing:");
    
    if (deviations.length > 0) {
      console.log("📊 Configured assets deviations:", deviations.map(
        (d) =>
          `${d.ticker}: ${(d.current * 100).toFixed(2)}% vs ${(
            d.target * 100
          ).toFixed(2)}% (${d.diff > 0 ? "+" : ""}${(d.diff * 100).toFixed(
            2
          )}%)`
      ));
    }
    
    if (unconfiguredAssets.length > 0) {
      console.log("🚨 Unconfigured assets to sell:", unconfiguredAssets.map(
        (a) => `${a.ticker}: ${(a.current * 100).toFixed(2)}%`
      ));
    }
    
    if (cashPercentage > 0.05) {
      console.log(`💰 Significant cash to invest: ${(cashPercentage * 100).toFixed(1)}%`);
    }

    const today = new Date();
    let availableCash = currentCash; // Já calculado acima

    // 🚨 PASSO 1: Vender ativos NÃO CONFIGURADOS na alocação
    for (const unconfiguredAsset of unconfiguredAssets) {
      const holding = holdings.get(unconfiguredAsset.ticker);
      const price = prices.get(unconfiguredAsset.ticker);
      
      if (holding && price && holding.quantity > 0) {
        const sellValue = holding.quantity * price;
        
        suggestions.push({
          date: today,
          type: 'SELL_WITHDRAWAL',
          ticker: unconfiguredAsset.ticker,
          amount: sellValue,
          price: price,
          quantity: holding.quantity,
          reason: `Venda de ${unconfiguredAsset.ticker}: ativo não está configurado na alocação da carteira (${(unconfiguredAsset.current * 100).toFixed(1)}% atual)`,
          cashBalanceBefore: availableCash,
          cashBalanceAfter: availableCash + sellValue
        });
        
        availableCash += sellValue;
        console.log(`💸 [SELL UNCONFIGURED] ${unconfiguredAsset.ticker}: ${holding.quantity} shares × R$ ${price.toFixed(2)} = R$ ${sellValue.toFixed(2)}`);
      }
    }

    // 🎯 PASSO 2 & 3: Rebalanceamento completo (vendas + compras)
    // Se há desvios de alocação OU caixa disponível, fazer rebalanceamento
    if (deviations.length > 0 || availableCash > 0) {
      console.log(`💰 [REBALANCING] Starting rebalancing with:`, {
        availableCash: availableCash.toFixed(2),
        portfolioValueForAllocation: portfolioValueForAllocation.toFixed(2),
        deviationsCount: deviations.length,
        assetsCount: portfolio.assets.length
      });
      
      const rebalanceSuggestions = this.generateRebalanceTransactions(
        portfolio.assets,
        holdings,
        prices,
        portfolioValueForAllocation,
        currentAllocations,
        availableCash,
        today
      );

      console.log(`✅ [REBALANCING] Generated ${rebalanceSuggestions.length} suggestions`);
      suggestions.push(...rebalanceSuggestions);
    }

    return suggestions;
  }

  /**
   * Generate transactions for a specific month
   */
  private static async generateMonthTransactions(
    portfolio: any,
    date: Date,
    holdings: Map<string, { quantity: number; totalInvested: number }>,
    prices: Map<string, number>
  ): Promise<SuggestedTransaction[]> {
    const suggestions: SuggestedTransaction[] = [];

    // Calculate current cash balance
    const cashBalance = await this.getCurrentCashBalance(portfolio.id);

    // 1. Suggest CASH_CREDIT (monthly contribution)
    suggestions.push({
      date,
      type: "CASH_CREDIT",
      amount: Number(portfolio.monthlyContribution),
      reason: `Aporte mensal de R$ ${Number(
        portfolio.monthlyContribution
      ).toFixed(2)}`,
      cashBalanceBefore: cashBalance,
      cashBalanceAfter: cashBalance + Number(portfolio.monthlyContribution),
    });

    const currentCash = cashBalance + Number(portfolio.monthlyContribution);

    // 2. Calculate portfolio value and current allocations
    const portfolioValue = this.calculatePortfolioValue(holdings, prices);
    const currentAllocations = this.calculateCurrentAllocations(
      holdings,
      prices,
      portfolioValue
    );

    // 3. Check if rebalancing is needed (>5% deviation)
    const rebalancingNeeded = portfolio.assets.some((asset: any) => {
      const currentAlloc = currentAllocations.get(asset.ticker) || 0;
      const targetAlloc = Number(asset.targetAllocation);
      return Math.abs(currentAlloc - targetAlloc) > 0.05;
    });

    if (rebalancingNeeded) {
      // Generate rebalancing transactions
      const rebalanceSuggestions = this.generateRebalanceTransactions(
        portfolio.assets,
        holdings,
        prices,
        portfolioValue,
        currentAllocations,
        currentCash,
        date
      );
      suggestions.push(...rebalanceSuggestions);
    } else {
      // Generate regular buy transactions
      const buySuggestions = this.generateBuyTransactions(
        portfolio.assets,
        currentCash,
        prices,
        date
      );
      suggestions.push(...buySuggestions);
    }

    return suggestions;
  }

  /**
   * Get current cash balance using FAST aggregation (O(1) complexity)
   *
   * This is the PRIMARY method for getting cash balance.
   * It calculates balance by summing credits and debits without updating database.
   *
   * Use recalculateCashBalances() only for:
   * - Auditing/debugging
   * - Generating historical cash balance timeline
   * - One-time data migration/fixes
   */
  private static async getCurrentCashBalance(
    portfolioId: string
  ): Promise<number> {
    // Single query to get all transaction types and amounts
    const transactions = await prisma.portfolioTransaction.findMany({
      where: {
        portfolioId,
        status: {
          in: ["CONFIRMED", "EXECUTED"],
        },
      },
      select: {
        id: true,
        date: true,
        type: true,
        ticker: true,
        amount: true,
        status: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    let balance = 0;
    const credits = { total: 0, items: [] as any[] };
    const debits = { total: 0, items: [] as any[] };

    console.log(
      `\n💰 [CASH BALANCE] Calculating for ${transactions.length} transactions...`
    );

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      const dateStr = tx.date.toISOString().split("T")[0];

      // Credits increase cash
      if (
        tx.type === "CASH_CREDIT" ||
        tx.type === "DIVIDEND" ||
        tx.type === "SELL_REBALANCE" ||
        tx.type === "SELL_WITHDRAWAL"
      ) {
        balance += amount;
        credits.total += amount;
        credits.items.push({
          date: dateStr,
          type: tx.type,
          ticker: tx.ticker,
          amount: amount.toFixed(2),
          status: tx.status,
        });
        console.log(
          `  ✅ [${dateStr}] ${tx.type} ${
            tx.ticker || "-"
          }: +R$ ${amount.toFixed(2)} | Balance: R$ ${balance.toFixed(2)}`
        );
      }
      // Debits decrease cash
      else if (
        tx.type === "CASH_DEBIT" ||
        tx.type === "BUY" ||
        tx.type === "BUY_REBALANCE"
      ) {
        balance -= amount;
        debits.total += amount;
        debits.items.push({
          date: dateStr,
          type: tx.type,
          ticker: tx.ticker,
          amount: amount.toFixed(2),
          status: tx.status,
        });
        console.log(
          `  ❌ [${dateStr}] ${tx.type} ${
            tx.ticker || "-"
          }: -R$ ${amount.toFixed(2)} | Balance: R$ ${balance.toFixed(2)}`
        );
      }
    }

    console.log(`\n📊 [SUMMARY]`);
    console.log(
      `  💵 Credits: R$ ${credits.total.toFixed(2)} (${
        credits.items.length
      } transactions)`
    );
    console.log(
      `  💸 Debits: R$ ${debits.total.toFixed(2)} (${
        debits.items.length
      } transactions)`
    );
    console.log(`  = Final Balance: R$ ${balance.toFixed(2)}\n`);

    return balance;
  }

  /**
   * Recalculate all cash balances for portfolio transactions in chronological order
   *
   * ⚠️ EXPENSIVE OPERATION - O(n) complexity with N database writes!
   *
   * This method updates cashBalanceBefore/cashBalanceAfter for ALL transactions.
   * It's NOT needed for normal operations since getCurrentCashBalance() uses aggregation.
   *
   * Use only for:
   * - Auditing/debugging cash balance history
   * - Generating timeline visualization
   * - One-time data migration/fixes
   * - Manual user request ("Recalcular Saldos" button)
   *
   * For normal operations, getCurrentCashBalance() is sufficient and much faster.
   */
  static async recalculateCashBalances(portfolioId: string): Promise<void> {
    console.log(
      `🔄 [EXPENSIVE] Recalculating cash balances for portfolio ${portfolioId}...`
    );

    // Get all confirmed/executed transactions in chronological order
    const transactions = await prisma.portfolioTransaction.findMany({
      where: {
        portfolioId,
        status: {
          in: ["CONFIRMED", "EXECUTED"],
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    if (transactions.length === 0) {
      console.log("✅ No transactions to recalculate");
      return;
    }

    let runningBalance = 0;

    // Recalculate cash balance for each transaction in order
    for (const tx of transactions) {
      const cashBalanceBefore = runningBalance;
      let cashBalanceAfter = runningBalance;

      // Apply transaction to running balance
      if (tx.type === "CASH_CREDIT" || tx.type === "DIVIDEND") {
        cashBalanceAfter += Number(tx.amount);
      } else if (
        tx.type === "CASH_DEBIT" ||
        tx.type === "BUY" ||
        tx.type === "BUY_REBALANCE"
      ) {
        cashBalanceAfter -= Number(tx.amount);
      } else if (
        tx.type === "SELL_REBALANCE" ||
        tx.type === "SELL_WITHDRAWAL"
      ) {
        cashBalanceAfter += Number(tx.amount);
      }

      console.log(
        `💵 [${tx.date.toISOString().split("T")[0]}] ${tx.type} ${
          tx.ticker || "-"
        }: R$ ${Number(tx.amount).toFixed(
          2
        )} | Before: R$ ${cashBalanceBefore.toFixed(
          2
        )} → After: R$ ${cashBalanceAfter.toFixed(2)}`
      );

      // Update transaction with corrected balances
      await prisma.portfolioTransaction.update({
        where: { id: tx.id },
        data: {
          cashBalanceBefore,
          cashBalanceAfter,
        },
      });

      runningBalance = cashBalanceAfter;
    }

    console.log(
      `\n✅ Recalculated ${
        transactions.length
      } transactions. Final balance: R$ ${runningBalance.toFixed(2)}`
    );

    // Summary by transaction type
    const summary = {
      CASH_CREDIT: 0,
      BUY: 0,
      BUY_REBALANCE: 0,
      SELL_REBALANCE: 0,
      SELL_WITHDRAWAL: 0,
      DIVIDEND: 0,
    };

    for (const tx of transactions) {
      if (tx.type === "CASH_CREDIT") summary.CASH_CREDIT += Number(tx.amount);
      else if (tx.type === "BUY") summary.BUY += Number(tx.amount);
      else if (tx.type === "BUY_REBALANCE")
        summary.BUY_REBALANCE += Number(tx.amount);
      else if (tx.type === "SELL_REBALANCE")
        summary.SELL_REBALANCE += Number(tx.amount);
      else if (tx.type === "SELL_WITHDRAWAL")
        summary.SELL_WITHDRAWAL += Number(tx.amount);
      else if (tx.type === "DIVIDEND") summary.DIVIDEND += Number(tx.amount);
    }

    console.log("📋 Transaction Summary:");
    console.log(`   💰 Cash Credits: R$ ${summary.CASH_CREDIT.toFixed(2)}`);
    console.log(`   📉 Purchases (BUY): R$ ${summary.BUY.toFixed(2)}`);
    console.log(
      `   📉 Purchases (Rebalance): R$ ${summary.BUY_REBALANCE.toFixed(2)}`
    );
    console.log(
      `   📈 Sales (Rebalance): R$ ${summary.SELL_REBALANCE.toFixed(2)}`
    );
    console.log(
      `   📈 Sales (Withdrawal): R$ ${summary.SELL_WITHDRAWAL.toFixed(2)}`
    );
    console.log(`   💵 Dividends: R$ ${summary.DIVIDEND.toFixed(2)}`);
    console.log(`   = Final Cash: R$ ${runningBalance.toFixed(2)}\n`);
  }

  /**
   * Calculate total portfolio value
   */
  // private static calculatePortfolioValue(
  //   holdings: Map<string, { quantity: number; totalInvested: number }>,
  //   prices: Map<string, number>
  // ): number {
  //   let total = 0;

  //   for (const [ticker, holding] of holdings) {
  //     const price = prices.get(ticker) || 0;
  //     total += holding.quantity * price;
  //   }

  //   return total;
  // }

  /**
   * Calculate current allocations
   */
  private static calculateCurrentAllocations(
    holdings: Map<string, { quantity: number; totalInvested: number }>,
    prices: Map<string, number>,
    portfolioValue: number
  ): Map<string, number> {
    const allocations = new Map<string, number>();

    if (portfolioValue === 0) return allocations;

    for (const [ticker, holding] of holdings) {
      const price = prices.get(ticker) || 0;
      const value = holding.quantity * price;
      allocations.set(ticker, value / portfolioValue);
    }

    return allocations;
  }

  /**
   * Generate dividend suggestions for assets in custody
   * Only suggests dividends that:
   * 1. Are in the current month
   * 2. Ex-date has already passed
   * 3. User had position in custody BEFORE the ex-date (not from rebalancing purchases)
   */
  private static async generateDividendSuggestions(
    portfolioId: string,
    holdings: Map<string, { quantity: number; totalInvested: number }>,
    _prices: Map<string, number> // Not used currently but kept for future enhancements
  ): Promise<SuggestedTransaction[]> {
    const suggestions: SuggestedTransaction[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get current portfolio cash balance
    const latestTransaction = await prisma.portfolioTransaction.findFirst({
      where: {
        portfolioId,
        status: { in: ["CONFIRMED", "EXECUTED"] },
      },
      orderBy: {
        date: "desc",
      },
      select: {
        cashBalanceAfter: true,
      },
    });

    let cashBalance = Number(latestTransaction?.cashBalanceAfter || 0);

    // Check each asset in holdings for dividends
    for (const [ticker, holding] of holdings) {
      if (holding.quantity <= 0) continue; // Skip if no position

      // First, ensure we have dividend data for this asset
      // This will fetch from Yahoo if not present
      try {
        await DividendService.fetchAndSaveDividends(ticker);
      } catch (error) {
        console.log(
          `⚠️ [DIVIDEND] Error fetching dividends for ${ticker}:`,
          error
        );
        continue;
      }

      // Get dividends in current month that have already been paid
      const pendingDividends = await DividendService.getCurrentMonthDividends(
        ticker
      );

      for (const dividend of pendingDividends) {
        // Only suggest if ex-date has passed
        if (dividend.exDate > today) {
          console.log(
            `⏰ [DIVIDEND SKIP] ${ticker}: Ex-date ${
              dividend.exDate.toISOString().split("T")[0]
            } hasn't passed yet`
          );
          continue;
        }

        // Check if user had position in custody BEFORE the ex-date
        // This ensures dividends are only suggested for assets held in custody, not rebalancing purchases
        const holdingsBeforeExDate = await this.getHoldingsAsOfDate(
          portfolioId,
          dividend.exDate
        );
        const holdingBeforeExDate = holdingsBeforeExDate.get(ticker);

        if (!holdingBeforeExDate || holdingBeforeExDate.quantity <= 0) {
          console.log(
            `⏰ [DIVIDEND SKIP] ${ticker}: No position held on ex-date ${
              dividend.exDate.toISOString().split("T")[0]
            }`
          );
          continue;
        }

        // Use the quantity held on ex-date for dividend calculation, not current quantity
        const quantityOnExDate = holdingBeforeExDate.quantity;
        const totalDividendAmount = dividend.amount * quantityOnExDate;

        if (totalDividendAmount <= 0) continue;

        const dividendDate = dividend.paymentDate || dividend.exDate;

        suggestions.push({
          date: dividendDate,
          type: "DIVIDEND" as TransactionType,
          ticker: ticker,
          amount: totalDividendAmount,
          quantity: quantityOnExDate, // Store quantity held on ex-date
          price: dividend.amount, // Store per-share dividend amount as price
          reason: `Dividendo de ${ticker}: R$ ${dividend.amount.toFixed(
            4
          )}/ação × ${quantityOnExDate} ações = R$ ${totalDividendAmount.toFixed(
            2
          )}`,
          cashBalanceBefore: cashBalance,
          cashBalanceAfter: cashBalance + totalDividendAmount,
        });

        cashBalance += totalDividendAmount; // Update for next iteration

        console.log(
          `💵 [DIVIDEND FOUND] ${ticker}: ${quantityOnExDate} shares × R$ ${
            dividend.amount
          } = R$ ${totalDividendAmount.toFixed(2)}`
        );
      }
    }

    return suggestions;
  }

  /**
   * Generate rebalancing transactions
   * Prioritizes selling profitable assets first to avoid selling assets with negative returns
   */
  private static generateRebalanceTransactions(
    assets: any[],
    holdings: Map<string, { quantity: number; totalInvested: number }>,
    prices: Map<string, number>,
    portfolioValue: number,
    currentAllocations: Map<string, number>,
    availableCash: number,
    date: Date
  ): SuggestedTransaction[] {
    const suggestions: SuggestedTransaction[] = [];
    let cashBalance = availableCash;

    // Calculate profitability for each holding
    const profitability = new Map<string, number>();
    for (const [ticker, holding] of holdings) {
      const currentValue = holding.quantity * (prices.get(ticker) || 0);
      const profit = currentValue - holding.totalInvested;
      const profitPercent =
        holding.totalInvested > 0 ? profit / holding.totalInvested : 0;
      profitability.set(ticker, profitPercent);
    }

    // Identify overallocated assets and sort by profitability (highest first)
    // Using 2% threshold instead of 5% for more responsive rebalancing
    const overallocatedAssets = assets
      .map((asset) => ({
        ...asset,
        currentAlloc: currentAllocations.get(asset.ticker) || 0,
        targetAlloc: Number(asset.targetAllocation),
        profitability: profitability.get(asset.ticker) || 0,
      }))
      .filter((asset) => asset.currentAlloc > asset.targetAlloc + 0.02)
      .sort((a, b) => b.profitability - a.profitability); // Sort by profitability DESC

    // Separate positive and negative profitability assets
    const positiveAssets = overallocatedAssets.filter(
      (a) => a.profitability >= 0
    );
    const negativeAssets = overallocatedAssets.filter(
      (a) => a.profitability < 0
    );

    // Sell positive profitability assets first
    for (const asset of positiveAssets) {
      const price = prices.get(asset.ticker);
      if (!price) continue;

      const holding = holdings.get(asset.ticker);
      if (!holding || holding.quantity === 0) continue;

      const excessValue =
        (asset.currentAlloc - asset.targetAlloc) * portfolioValue;
      const sharesToSell = Math.floor(excessValue / price);

      // Only sell if we can sell at least 1 share
      if (sharesToSell >= 1) {
        const actualSellAmount = sharesToSell * price;
        const profitText =
          asset.profitability >= 0
            ? `+${(asset.profitability * 100).toFixed(1)}%`
            : `${(asset.profitability * 100).toFixed(1)}%`;

        suggestions.push({
          date,
          type: "SELL_REBALANCE",
          ticker: asset.ticker,
          amount: actualSellAmount,
          price,
          quantity: sharesToSell,
          reason: `Rebalanceamento: venda de ${sharesToSell} ações (alocação atual ${(
            asset.currentAlloc * 100
          ).toFixed(1)}% > alvo ${(asset.targetAlloc * 100).toFixed(
            1
          )}%, rentabilidade: ${profitText})`,
          cashBalanceBefore: cashBalance,
          cashBalanceAfter: cashBalance + actualSellAmount,
        });

        cashBalance += actualSellAmount;
      }
    }

    // Only sell negative profitability assets if no positive alternatives remain
    // This avoids crystallizing losses unnecessarily
    if (positiveAssets.length === 0 && negativeAssets.length > 0) {
      console.warn(
        "⚠️ REBALANCING: No profitable overallocated assets available. Selling negative profitability assets as last resort."
      );

      for (const asset of negativeAssets) {
        const price = prices.get(asset.ticker);
        if (!price) continue;

        const holding = holdings.get(asset.ticker);
        if (!holding || holding.quantity === 0) continue;

        const excessValue =
          (asset.currentAlloc - asset.targetAlloc) * portfolioValue;
        const sharesToSell = Math.floor(excessValue / price);

        // Only sell if we can sell at least 1 share
        if (sharesToSell >= 1) {
          const actualSellAmount = sharesToSell * price;
          const profitText = `${(asset.profitability * 100).toFixed(1)}%`;

          suggestions.push({
            date,
            type: "SELL_REBALANCE",
            ticker: asset.ticker,
            amount: actualSellAmount,
            price,
            quantity: sharesToSell,
            reason: `Rebalanceamento: venda de ${sharesToSell} ações (alocação atual ${(
              asset.currentAlloc * 100
            ).toFixed(1)}% > alvo ${(asset.targetAlloc * 100).toFixed(
              1
            )}%, rentabilidade: ${profitText})`,
            cashBalanceBefore: cashBalance,
            cashBalanceAfter: cashBalance + actualSellAmount,
          });

          cashBalance += actualSellAmount;
        }
      }
    }

    // Then, buy underallocated assets
    // 🔧 CORREÇÃO: Usar caixa disponível para comprar ativos conforme alocação target
    // Se há caixa disponível, devemos investir conforme a alocação target
    if (cashBalance > 0) {
      console.log(`💰 [REBALANCING - BUY] Starting buy phase:`, {
        availableCash: cashBalance.toFixed(2),
        portfolioValue: portfolioValue.toFixed(2),
        assetsCount: assets.length
      });
      
      // 🔧 ESTRATÉGIA: Distribuir o caixa disponível conforme alocação target
      // Isso funciona tanto para rebalanceamento quanto para investimento inicial
      const initialCash = cashBalance;
      
      for (const asset of assets) {
        if (cashBalance <= 0) break; // No more cash available
        
        const currentAlloc = currentAllocations.get(asset.ticker) || 0;
        const targetAlloc = Number(asset.targetAllocation);
        const price = prices.get(asset.ticker);
        
        if (!price) {
          console.log(`⚠️ [SKIP] ${asset.ticker}: No price available`);
          continue;
        }

        console.log(`🔍 [ANALYZING] ${asset.ticker}:`, {
          currentAlloc: (currentAlloc * 100).toFixed(2) + '%',
          targetAlloc: (targetAlloc * 100).toFixed(2) + '%',
          price: price.toFixed(2)
        });

        // 🔧 CORREÇÃO: Sempre comprar se há caixa disponível
        // Distribuir o caixa inicial conforme a alocação target
        const targetAmount = initialCash * targetAlloc;
        const sharesToBuy = Math.floor(targetAmount / price);

        console.log(`💡 [CALCULATION] ${asset.ticker}:`, {
          targetAmount: targetAmount.toFixed(2),
          sharesToBuy,
          wouldCost: (sharesToBuy * price).toFixed(2)
        });

        // Only buy if we can buy at least 1 share
        if (sharesToBuy >= 1) {
          const actualBuyAmount = sharesToBuy * price;

          suggestions.push({
            date,
            type: "BUY_REBALANCE",
            ticker: asset.ticker,
            amount: actualBuyAmount,
            price,
            quantity: sharesToBuy,
            reason: `Rebalanceamento: compra de ${sharesToBuy} ações (alocação atual ${(
              currentAlloc * 100
            ).toFixed(1)}% → alvo ${(targetAlloc * 100).toFixed(1)}%)`,
            cashBalanceBefore: cashBalance,
            cashBalanceAfter: cashBalance - actualBuyAmount,
          });

          cashBalance -= actualBuyAmount;
          
          console.log(`✅ [BUY REBALANCE] ${asset.ticker}: ${sharesToBuy} shares × R$ ${price.toFixed(2)} = R$ ${actualBuyAmount.toFixed(2)}`);
        } else {
          console.log(`⏩ [SKIP] ${asset.ticker}: Not enough cash for 1 share (need R$ ${price.toFixed(2)})`);
        }
      }
      
      if (cashBalance > 0) {
        console.log(`💵 [REMAINING CASH] R$ ${cashBalance.toFixed(2)} (not enough for 1 share of any asset)`);
      }
    } else {
      console.log(`⚠️ [NO CASH] No cash available for buying`);
    }

    // Validate rebalancing transactions (sells should generate buys)
    const sells = suggestions.filter((s) => s.type === "SELL_REBALANCE");
    const buys = suggestions.filter((s) => s.type === "BUY_REBALANCE");
    const totalSold = sells.reduce((sum, s) => sum + s.amount, 0);
    const totalBought = buys.reduce((sum, s) => sum + s.amount, 0);

    if (sells.length > 0 && buys.length === 0) {
      console.warn("⚠️ REBALANCING: Generated sells without buys!", {
        totalSold,
        sellCount: sells.length,
        availableCash: cashBalance,
      });
    } else if (sells.length > 0 && buys.length > 0) {
      console.log(`✅ REBALANCING: Paired transactions generated`, {
        sells: sells.length,
        buys: buys.length,
        totalSold: totalSold.toFixed(2),
        totalBought: totalBought.toFixed(2),
      });
    }

    return suggestions;
  }

  /**
   * Generate regular buy transactions (for monthly contributions)
   */
  private static generateBuyTransactions(
    assets: any[],
    availableCash: number,
    prices: Map<string, number>,
    date: Date
  ): SuggestedTransaction[] {
    const suggestions: SuggestedTransaction[] = [];
    let cashBalance = availableCash;

    for (const asset of assets) {
      const price = prices.get(asset.ticker);
      if (!price || cashBalance <= 0) continue;

      const targetAmount = availableCash * Number(asset.targetAllocation);
      const sharesToBuy = Math.floor(targetAmount / price);

      if (sharesToBuy > 0) {
        const actualAmount = sharesToBuy * price;

        suggestions.push({
          date,
          type: "BUY",
          ticker: asset.ticker,
          amount: actualAmount,
          price,
          quantity: sharesToBuy,
          reason: `Compra de ${sharesToBuy} ações conforme alocação de ${(
            Number(asset.targetAllocation) * 100
          ).toFixed(1)}%`,
          cashBalanceBefore: cashBalance,
          cashBalanceAfter: cashBalance - actualAmount,
        });

        cashBalance -= actualAmount;
      }
    }

    return suggestions;
  }

  /**
   * Generate buy transactions for rebalancing (uses BUY_REBALANCE type)
   */
  private static generateBuyTransactionsForRebalancing(
    assets: any[],
    availableCash: number,
    prices: Map<string, number>,
    date: Date
  ): SuggestedTransaction[] {
    const suggestions: SuggestedTransaction[] = [];
    let cashBalance = availableCash;

    for (const asset of assets) {
      const price = prices.get(asset.ticker);
      if (!price || cashBalance <= 0) continue;

      const targetAmount = availableCash * Number(asset.targetAllocation);
      const sharesToBuy = Math.floor(targetAmount / price);

      if (sharesToBuy > 0) {
        const actualAmount = sharesToBuy * price;

        suggestions.push({
          date,
          type: "BUY_REBALANCE",
          ticker: asset.ticker,
          amount: actualAmount,
          price,
          quantity: sharesToBuy,
          reason: `Rebalanceamento: compra de ${sharesToBuy} ações (alocação alvo ${(
            Number(asset.targetAllocation) * 100
          ).toFixed(1)}%)`,
          cashBalanceBefore: cashBalance,
          cashBalanceAfter: cashBalance - actualAmount,
        });

        cashBalance -= actualAmount;
      }
    }

    return suggestions;
  }

  /**
   * Update holdings with suggested transactions (for multi-month simulation)
   */
  private static updateHoldingsWithSuggestions(
    holdings: Map<string, { quantity: number; totalInvested: number }>,
    suggestions: SuggestedTransaction[]
  ): void {
    for (const suggestion of suggestions) {
      if (!suggestion.ticker) continue;

      const current = holdings.get(suggestion.ticker) || {
        quantity: 0,
        totalInvested: 0,
      };

      if (suggestion.type === "BUY" || suggestion.type === "BUY_REBALANCE") {
        current.quantity += suggestion.quantity || 0;
        current.totalInvested += suggestion.amount;
      } else if (
        suggestion.type === "SELL_REBALANCE" ||
        suggestion.type === "SELL_WITHDRAWAL"
      ) {
        const quantitySold = suggestion.quantity || 0;
        const averageCost =
          current.quantity > 0 ? current.totalInvested / current.quantity : 0;

        current.quantity -= quantitySold;
        // Reduce by COST of shares sold, not sale value
        current.totalInvested -= averageCost * quantitySold;
      }

      holdings.set(suggestion.ticker, current);
    }
  }

  /**
   * Check if a similar transaction already exists
   * Special handling for dividends to avoid suggesting same dividend with similar amounts
   */
  private static async checkSimilarTransactionExists(
    portfolioId: string,
    suggestion: SuggestedTransaction
  ): Promise<{ exists: boolean; existingTransaction?: any }> {
    // For dividends, check for similar amounts in the same month
    if (suggestion.type === "DIVIDEND" && suggestion.ticker) {
      const startOfMonth = new Date(
        suggestion.date.getFullYear(),
        suggestion.date.getMonth(),
        1
      );
      const endOfMonth = new Date(
        suggestion.date.getFullYear(),
        suggestion.date.getMonth() + 1,
        0
      );

      const existingDividend = await prisma.portfolioTransaction.findFirst({
        where: {
          portfolioId,
          type: "DIVIDEND",
          ticker: suggestion.ticker,
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          status: { in: ["PENDING", "CONFIRMED", "REJECTED"] },
          isAutoSuggested: true,
        },
      });

      if (existingDividend) {
        const amountDiff = Math.abs(
          Number(existingDividend.amount) - suggestion.amount
        );
        const tolerance = Math.max(0.01, suggestion.amount * 0.05); // 5% tolerance or R$ 0.01 minimum

        if (amountDiff <= tolerance) {
          return { exists: true, existingTransaction: existingDividend };
        }
      }
    }

    // For other transaction types, check exact match
    const existingTransaction = await prisma.portfolioTransaction.findFirst({
      where: {
        portfolioId,
        date: suggestion.date,
        type: suggestion.type,
        ticker: suggestion.ticker,
        status: { in: ["PENDING", "CONFIRMED", "REJECTED"] },
        isAutoSuggested: true,
      },
    });

    return {
      exists: !!existingTransaction,
      existingTransaction,
    };
  }

  /**
   * Create pending transactions from suggestions
   */
  static async createPendingTransactions(
    portfolioId: string,
    userId: string,
    suggestions: SuggestedTransaction[]
  ): Promise<string[]> {
    // Verify ownership
    const portfolio = await PortfolioService.getPortfolioConfig(
      portfolioId,
      userId
    );
    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    const transactionIds: string[] = [];
    let createdCount = 0;
    let skippedCount = 0;

    for (const suggestion of suggestions) {
      // Check if a similar transaction already exists (with smart duplicate detection)
      const { exists, existingTransaction } =
        await this.checkSimilarTransactionExists(portfolioId, suggestion);

      if (exists && existingTransaction) {
        // Skip creating duplicate
        const reasonText =
          suggestion.type === "DIVIDEND"
            ? `similar dividend amount (R$ ${Number(
                existingTransaction.amount
              ).toFixed(2)} vs R$ ${suggestion.amount.toFixed(2)})`
            : "exact match";

        console.log(
          `⏩ Skipping duplicate transaction: ${suggestion.type} ${
            suggestion.ticker || ""
          } on ${suggestion.date.toISOString().split("T")[0]} (status: ${
            existingTransaction.status
          }, reason: ${reasonText})`
        );

        // Only add to list if it's PENDING (user can still act on it)
        if (existingTransaction.status === "PENDING") {
          transactionIds.push(existingTransaction.id);
        }

        skippedCount++;
        continue;
      }

      // Create new PENDING transaction
      const transaction = await safeWrite(
        "create-pending-transaction",
        () =>
          prisma.portfolioTransaction.create({
            data: {
              portfolioId,
              date: suggestion.date,
              type: suggestion.type,
              ticker: suggestion.ticker,
              amount: suggestion.amount,
              price: suggestion.price,
              quantity: suggestion.quantity,
              cashBalanceBefore: suggestion.cashBalanceBefore,
              cashBalanceAfter: suggestion.cashBalanceAfter,
              status: "PENDING",
              isAutoSuggested: true,
              notes: suggestion.reason,
            },
          }),
        ["portfolio_transactions"]
      );

      transactionIds.push(transaction.id);
      createdCount++;
    }

    console.log(
      `✅ Pending transactions: ${createdCount} created, ${skippedCount} skipped (duplicates) for portfolio ${portfolioId}`
    );

    return transactionIds;
  }

  /**
   * Confirm a transaction
   */
  static async confirmTransaction(
    transactionId: string,
    userId: string,
    updates?: Partial<TransactionInput>
  ): Promise<void> {
    const transaction = await prisma.portfolioTransaction.findUnique({
      where: { id: transactionId },
      include: {
        portfolio: true,
      },
    });

    if (!transaction || transaction.portfolio.userId !== userId) {
      throw new Error("Transaction not found");
    }

    if (transaction.status !== "PENDING") {
      throw new Error("Only pending transactions can be confirmed");
    }

    await safeWrite(
      "confirm-transaction",
      () =>
        prisma.portfolioTransaction.update({
          where: { id: transactionId },
          data: {
            ...updates,
            status: "CONFIRMED",
            confirmedAt: new Date(),
          },
        }),
      ["portfolio_transactions"]
    );

    // Update last transaction date
    await PortfolioService.updateLastTransactionDate(
      transaction.portfolioId,
      updates?.date || transaction.date
    );

    console.log(`✅ Transaction confirmed: ${transactionId}`);
  }

  /**
   * Reject a transaction
   */
  static async rejectTransaction(
    transactionId: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    const transaction = await prisma.portfolioTransaction.findUnique({
      where: { id: transactionId },
      include: {
        portfolio: true,
      },
    });

    if (!transaction || transaction.portfolio.userId !== userId) {
      throw new Error("Transaction not found");
    }

    if (transaction.status !== "PENDING") {
      throw new Error("Only pending transactions can be rejected");
    }

    await safeWrite(
      "reject-transaction",
      () =>
        prisma.portfolioTransaction.update({
          where: { id: transactionId },
          data: {
            status: "REJECTED",
            rejectedAt: new Date(),
            rejectionReason: reason,
          },
        }),
      ["portfolio_transactions"]
    );

    console.log(`✅ Transaction rejected: ${transactionId}`);
  }

  /**
   * Revert a transaction (confirmed -> pending or rejected -> pending)
   */
  static async revertTransaction(
    transactionId: string,
    userId: string
  ): Promise<void> {
    const transaction = await prisma.portfolioTransaction.findUnique({
      where: { id: transactionId },
      include: {
        portfolio: true,
      },
    });

    if (!transaction || transaction.portfolio.userId !== userId) {
      throw new Error("Transaction not found");
    }

    if (
      transaction.status !== "CONFIRMED" &&
      transaction.status !== "REJECTED"
    ) {
      throw new Error(
        "Only confirmed or rejected transactions can be reverted"
      );
    }

    await safeWrite(
      "revert-transaction",
      () =>
        prisma.portfolioTransaction.update({
          where: { id: transactionId },
          data: {
            status: "PENDING",
            revertedAt: new Date(),
            confirmedAt: null,
            rejectedAt: null,
            rejectionReason: null,
          },
        }),
      ["portfolio_transactions"]
    );

    console.log(`✅ Transaction reverted to pending: ${transactionId}`);
  }

  /**
   * Confirm multiple transactions in batch
   */
  static async confirmBatchTransactions(
    transactionIds: string[],
    userId: string
  ): Promise<void> {
    // Verify all transactions belong to user
    const transactions = await prisma.portfolioTransaction.findMany({
      where: {
        id: {
          in: transactionIds,
        },
        portfolio: {
          userId,
        },
        status: "PENDING",
      },
    });

    if (transactions.length !== transactionIds.length) {
      throw new Error("Some transactions not found or already processed");
    }

    await safeWrite(
      "confirm-batch-transactions",
      () =>
        prisma.portfolioTransaction.updateMany({
          where: {
            id: {
              in: transactionIds,
            },
          },
          data: {
            status: "CONFIRMED",
            confirmedAt: new Date(),
          },
        }),
      ["portfolio_transactions"]
    );

    // Update last transaction date (use the latest date from the batch)
    const latestDate = transactions.reduce(
      (latest, tx) => (tx.date > latest ? tx.date : latest),
      transactions[0].date
    );

    if (transactions.length > 0) {
      await PortfolioService.updateLastTransactionDate(
        transactions[0].portfolioId,
        latestDate
      );
    }

    console.log(`✅ Confirmed ${transactionIds.length} transactions in batch`);
  }

  /**
   * Create manual transaction with automatic cash credit if needed
   */
  static async createTransactionWithAutoCashCredit(
    portfolioId: string,
    userId: string,
    input: TransactionInput,
    cashCreditAmount: number
  ): Promise<{ transactionId: string; cashCreditId: string }> {
    // Verify ownership
    const portfolio = await PortfolioService.getPortfolioConfig(
      portfolioId,
      userId
    );
    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    // Get current cash balance
    const currentCashBalance = await this.getCurrentCashBalance(portfolioId);

    // 1. Create CASH_CREDIT transaction first (same date as the purchase)
    const cashCreditTransaction = await safeWrite(
      "create-cash-credit-auto",
      () =>
        prisma.portfolioTransaction.create({
          data: {
            portfolioId,
            date: input.date,
            type: "CASH_CREDIT",
            amount: cashCreditAmount,
            cashBalanceBefore: currentCashBalance,
            cashBalanceAfter: currentCashBalance + cashCreditAmount,
            status: "EXECUTED",
            isAutoSuggested: false,
            notes: `Aporte automático para compra de ${
              input.ticker || "ativo"
            }`,
          },
        }),
      ["portfolio_transactions"]
    );

    // 2. Now create the purchase transaction with updated cash balance
    const newCashBalance = currentCashBalance + cashCreditAmount;
    let cashBalanceAfter = newCashBalance;

    if (input.type === "BUY" || input.type === "BUY_REBALANCE") {
      cashBalanceAfter -= input.amount;
    }

    const transaction = await safeWrite(
      "create-purchase-after-credit",
      () =>
        prisma.portfolioTransaction.create({
          data: {
            portfolioId,
            date: input.date,
            type: input.type,
            ticker: input.ticker?.toUpperCase(),
            amount: input.amount,
            price: input.price,
            quantity: input.quantity,
            cashBalanceBefore: newCashBalance,
            cashBalanceAfter,
            status: "EXECUTED",
            isAutoSuggested: false,
            notes: input.notes,
          },
        }),
      ["portfolio_transactions"]
    );

    // Update last transaction date
    await PortfolioService.updateLastTransactionDate(portfolioId, input.date);

    console.log(
      `✅ Created auto cash credit + purchase: ${cashCreditTransaction.id}, ${transaction.id}`
    );

    return {
      cashCreditId: cashCreditTransaction.id,
      transactionId: transaction.id,
    };
  }

  /**
   * Create manual transaction
   */
  static async createManualTransaction(
    portfolioId: string,
    userId: string,
    input: TransactionInput
  ): Promise<string> {
    // Verify ownership
    const portfolio = await PortfolioService.getPortfolioConfig(
      portfolioId,
      userId
    );
    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    // For retroactive or out-of-order transactions, we'll validate AFTER recalculation
    // For now, just create with temporary balance values
    const transaction = await safeWrite(
      "create-manual-transaction",
      () =>
        prisma.portfolioTransaction.create({
          data: {
            portfolioId,
            date: input.date,
            type: input.type,
            ticker: input.ticker?.toUpperCase(),
            amount: input.amount,
            price: input.price,
            quantity: input.quantity,
            cashBalanceBefore: 0, // Will be recalculated
            cashBalanceAfter: 0, // Will be recalculated
            status: "EXECUTED",
            isAutoSuggested: false,
            notes: input.notes,
          },
        }),
      ["portfolio_transactions"]
    );

    // Update last transaction date
    await PortfolioService.updateLastTransactionDate(portfolioId, input.date);

    // Validate the final balance using fast aggregation
    const finalBalance = await this.getCurrentCashBalance(portfolioId);
    if (finalBalance < -0.01) {
      // Allow tiny rounding errors
      // Rollback the transaction
      await safeWrite(
        "rollback-transaction",
        () =>
          prisma.portfolioTransaction.delete({
            where: { id: transaction.id },
          }),
        ["portfolio_transactions"]
      );

      const error: any = new Error("INSUFFICIENT_CASH");
      error.code = "INSUFFICIENT_CASH";
      error.details = {
        currentCashBalance: finalBalance,
        transactionAmount: input.amount,
        insufficientAmount: Math.abs(finalBalance),
        message: `Saldo insuficiente. Você precisa de R$ ${Math.abs(
          finalBalance
        ).toFixed(2)} adicionais em caixa.`,
      };
      throw error;
    }

    console.log(`✅ Manual transaction created: ${transaction.id}`);

    return transaction.id;
  }

  /**
   * Delete a transaction
   */
  static async deleteTransaction(
    transactionId: string,
    userId: string
  ): Promise<void> {
    const transaction = await prisma.portfolioTransaction.findUnique({
      where: { id: transactionId },
      include: {
        portfolio: true,
      },
    });

    if (!transaction || transaction.portfolio.userId !== userId) {
      throw new Error("Transaction not found");
    }

    // Only allow deleting PENDING or manually created EXECUTED transactions
    if (transaction.status === "CONFIRMED" && transaction.isAutoSuggested) {
      throw new Error(
        "Cannot delete confirmed auto-suggested transactions. Revert to pending first."
      );
    }

    await safeWrite(
      "delete-transaction",
      () =>
        prisma.portfolioTransaction.delete({
          where: { id: transactionId },
        }),
      ["portfolio_transactions"]
    );

    console.log(`✅ Transaction deleted: ${transactionId}`);
  }

  /**
   * Update a transaction
   */
  static async updateTransaction(
    transactionId: string,
    userId: string,
    updates: Partial<TransactionInput>
  ): Promise<void> {
    const transaction = await prisma.portfolioTransaction.findUnique({
      where: { id: transactionId },
      include: {
        portfolio: true,
      },
    });

    if (!transaction || transaction.portfolio.userId !== userId) {
      throw new Error("Transaction not found");
    }

    const portfolioId = transaction.portfolioId;

    // Store original values for potential rollback
    const originalValues = {
      date: transaction.date,
      type: transaction.type,
      ticker: transaction.ticker,
      amount: transaction.amount,
      price: transaction.price,
      quantity: transaction.quantity,
      notes: transaction.notes,
    };

    await safeWrite(
      "update-transaction",
      () =>
        prisma.portfolioTransaction.update({
          where: { id: transactionId },
          data: {
            ...updates,
            ticker: updates.ticker?.toUpperCase(),
          },
        }),
      ["portfolio_transactions"]
    );

    // Validate the final balance using fast aggregation
    const finalBalance = await this.getCurrentCashBalance(portfolioId);
    if (finalBalance < -0.01) {
      // Allow tiny rounding errors
      // Rollback to original values
      await safeWrite(
        "rollback-transaction-update",
        () =>
          prisma.portfolioTransaction.update({
            where: { id: transactionId },
            data: originalValues,
          }),
        ["portfolio_transactions"]
      );

      throw new Error(
        `Atualização resultaria em saldo de caixa negativo: R$ ${finalBalance.toFixed(
          2
        )}. Adicione mais fundos primeiro.`
      );
    }

    console.log(`✅ Transaction updated: ${transactionId}`);
  }
}
