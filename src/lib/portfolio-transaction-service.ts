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


  // Store debug info globally (per request) - will be cleared after use
  private static debugInfo: Map<string, any> = new Map();

  /**
   * Get contribution suggestions (monthly contributions + buy transactions for available cash)
   * This is separate from rebalancing - only suggests BUY transactions, prioritizing assets furthest from target
   */
  static async getContributionSuggestions(
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

    console.log(`💰 [CONTRIBUTION SUGGESTIONS] Starting...`);
    const startTime = Date.now();

    // Check if we need to regenerate suggestions (more than 30 days since last generation)
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get full portfolio config to access lastSuggestionsGeneratedAt
    const fullPortfolio = await prisma.portfolioConfig.findUnique({
      where: { id: portfolioId },
      select: { lastSuggestionsGeneratedAt: true },
    });

    const needsRegeneration = !fullPortfolio?.lastSuggestionsGeneratedAt || 
      new Date(fullPortfolio.lastSuggestionsGeneratedAt) < thirtyDaysAgo;

    if (needsRegeneration) {
      console.log(`🔄 [REGENERATION NEEDED] Last generation was ${fullPortfolio?.lastSuggestionsGeneratedAt ? new Date(fullPortfolio.lastSuggestionsGeneratedAt).toISOString() : 'never'}, cleaning old pending transactions...`);
      
      // Delete all old pending transactions
      const deletedCount = await prisma.portfolioTransaction.deleteMany({
        where: {
          portfolioId,
          status: "PENDING",
          isAutoSuggested: true,
        },
      });
      
      console.log(`🧹 [CLEANUP] Deleted ${deletedCount.count} old pending transactions`);
    }

    // Get data in parallel
    const [holdings, prices, nextDates, existingTransactions, cashBalance, pendingBuyCount] =
      await Promise.all([
        this.getCurrentHoldings(portfolioId),
        this.getLatestPrices(portfolio.assets.map((a) => a.ticker)),
        this.calculateNextTransactionDates(portfolioId),
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
            quantity: true,
          },
        }),
        this.getCurrentCashBalance(portfolioId),
        // Check if there are already PENDING buy transactions
        prisma.portfolioTransaction.count({
          where: {
            portfolioId,
            status: 'PENDING',
            type: 'BUY',
            isAutoSuggested: true
          }
        })
      ]);

    const suggestions: SuggestedTransaction[] = [];

    // Check if there's a monthly contribution for current month (any status)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );
    startOfCurrentMonth.setHours(0, 0, 0, 0);

    // Check if there's a monthly contribution in current month (any status)
    const currentMonthContribution = existingTransactions.find(
      (tx) =>
        ((tx.type as string) === "MONTHLY_CONTRIBUTION" || tx.type === "CASH_CREDIT") &&
        new Date(tx.date).getTime() >= startOfCurrentMonth.getTime()
    );

    console.log(
      `📅 [CHECK_CONTRIBUTION] Current month contribution check:`,
      currentMonthContribution
        ? `Found ${currentMonthContribution.type} with status ${currentMonthContribution.status}`
        : 'No contribution found in current month'
    );

    // Monthly contribution is "decided" only if it's CONFIRMED, REJECTED, or EXECUTED
    // PENDING means user hasn't decided yet, so we don't suggest buy transactions
    const monthlyContributionDecided = currentMonthContribution && 
      (currentMonthContribution.status === "CONFIRMED" || 
       currentMonthContribution.status === "REJECTED" ||
       currentMonthContribution.status === "EXECUTED");

    console.log(
      `📅 [SUGGESTION_LOGIC] nextDates.length=${nextDates.length}, monthlyContributionDecided=${monthlyContributionDecided}, cashBalance=${cashBalance.toFixed(2)}, portfolioAssets=${portfolio.assets?.length || 0}, holdings=${holdings.size}, prices=${prices.size}`
    );

    // 1. Generate monthly contribution suggestions FIRST (if not already decided)
    if (nextDates.length > 0 && !monthlyContributionDecided) {
      console.log(
        `📅 [CONTRIBUTIONS] ${nextDates.length} pending monthly contributions - suggesting FIRST`
      );
      console.log(`📅 [DATES] Next dates to suggest:`, nextDates.map(d => d.toISOString().split("T")[0]));

      // Calculate cash balance once (will be updated as we add contributions)
      let runningCashBalance = cashBalance;
      
      for (const date of nextDates) {
        // Suggest MONTHLY_CONTRIBUTION (monthly contribution suggested by system)
        // This should be the FIRST suggestion, before any buy transactions
        const suggestion = {
          date,
          type: "MONTHLY_CONTRIBUTION" as TransactionType,
          amount: Number(portfolio.monthlyContribution),
          reason: `Aporte mensal de R$ ${Number(
            portfolio.monthlyContribution
          ).toFixed(2)}`,
          cashBalanceBefore: runningCashBalance,
          cashBalanceAfter: runningCashBalance + Number(portfolio.monthlyContribution),
        };
        
        console.log(`📝 [SUGGESTION] Creating MONTHLY_CONTRIBUTION suggestion:`, {
          date: date.toISOString().split("T")[0],
          amount: suggestion.amount,
          cashBalanceBefore: suggestion.cashBalanceBefore,
          cashBalanceAfter: suggestion.cashBalanceAfter
        });
        
        suggestions.push(suggestion);
        
        // Update running balance for next iteration
        runningCashBalance += Number(portfolio.monthlyContribution);
      }
      
      console.log(`📊 [BEFORE_FILTER] Created ${suggestions.length} monthly contribution suggestions before deduplication`);
      
      // Filter monthly contribution suggestions (but don't return yet - we'll generate buys too)
      const monthlyContribSuggestions = suggestions.slice(); // Copy array
      const filteredMonthlyContributions = this.filterDuplicateSuggestions(
        monthlyContribSuggestions,
        existingTransactions
      );
      
      console.log(
        `✅ [MONTHLY_CONTRIBUTIONS] ${filteredMonthlyContributions.length} monthly contribution suggestions after deduplication`
      );
      console.log(`📊 [FILTERED] Filtered suggestions:`, filteredMonthlyContributions.map(s => ({
        date: s.date.toISOString().split("T")[0],
        type: s.type,
        amount: s.amount
      })));
      
      // Replace suggestions array with filtered monthly contributions
      // Then continue to generate buy suggestions below (don't return early)
      suggestions.length = 0; // Clear array
      suggestions.push(...filteredMonthlyContributions);
    } else {
      console.log(
        `⏸️ [SKIP_CONTRIBUTION] Not suggesting monthly contribution:`,
        {
          nextDatesLength: nextDates.length,
          monthlyContributionDecided,
          reason: nextDates.length === 0 
            ? 'No dates returned from calculateNextTransactionDates' 
            : 'Monthly contribution already decided'
        }
      );
    }

    // 2. Generate buy suggestions when there's cash available AND no pending buy suggestions
    // Avoid infinite loops: if there are already PENDING buy transactions, don't generate more
    // User wants to invest available cash, but we should wait for pending transactions to be confirmed/rejected
    console.log(`🔍 [BUY_LOGIC_CHECK] Checking conditions:`, {
      cashBalance: cashBalance.toFixed(2),
      cashBalanceCheck: cashBalance > 0.01,
      pendingBuyCount,
      monthlyContributionDecided,
      nextDatesLength: nextDates.length,
      shouldGenerateBuys: cashBalance > 0.01 && pendingBuyCount === 0
    });

    const shouldGenerateBuys = cashBalance > 0.01 && pendingBuyCount === 0; // Generate buys only if no pending buy suggestions exist

    if (shouldGenerateBuys) {
      const reason = monthlyContributionDecided 
        ? 'monthly contribution already decided - investing available cash' 
        : nextDates.length > 0 
          ? 'monthly contribution pending but investing available cash anyway'
          : 'no monthly contribution pending - investing available cash';
      console.log(
        `💵 [CASH AVAILABLE] R$ ${cashBalance.toFixed(2)} available for investment (${reason})`
      );

      console.log(`📊 [BEFORE_BUY_GEN] Portfolio assets: ${portfolio.assets?.length || 0}, Holdings: ${holdings.size}, Prices: ${prices.size}`);
      
      const buySuggestions = await this.generateBuyTransactionsForCash(
        portfolio,
        cashBalance,
        holdings,
        prices
      );
      
      console.log(`💰 [BUY_SUGGESTIONS] Generated ${buySuggestions.length} buy suggestions`);
      if (buySuggestions.length === 0) {
        console.log(`⚠️ [NO_BUY_SUGGESTIONS] No buy suggestions generated despite cash available. Check: assets count, prices availability, allocations`);
      }
      
      suggestions.push(...buySuggestions);
    } else {
      if (cashBalance <= 0.01) {
        console.log(`⏸️ [NO_CASH] No cash available (R$ ${cashBalance.toFixed(2)})`);
      } else if (pendingBuyCount > 0) {
        console.log(
          `⏸️ [BUY_PENDING] Cash available (R$ ${cashBalance.toFixed(2)}) but ${pendingBuyCount} pending buy suggestion(s) already exist - waiting for confirmation/rejection to avoid infinite loop`
        );
      } else {
        console.log(`⏸️ [BUY_NOT_GENERATED] Unexpected condition:`, {
          cashBalance: cashBalance.toFixed(2),
          pendingBuyCount,
          monthlyContributionDecided,
          nextDatesLength: nextDates.length
        });
      }
    }

    // Filter duplicates
    console.log(`🔍 [BEFORE_FILTER] ${suggestions.length} suggestions before deduplication`);
    const filteredSuggestions = this.filterDuplicateSuggestions(
      suggestions,
      existingTransactions
    );
    console.log(`🔍 [AFTER_FILTER] ${filteredSuggestions.length} suggestions after deduplication`);
    
    if (suggestions.length > 0 && filteredSuggestions.length === 0) {
      console.log(`⚠️ [FILTER_REMOVED_ALL] All suggestions were filtered out as duplicates!`);
      console.log(`📊 [FILTER_DEBUG] Existing transactions count: ${existingTransactions.length}`);
    }

    // Update lastSuggestionsGeneratedAt timestamp
    await prisma.portfolioConfig.update({
      where: { id: portfolioId },
      data: { lastSuggestionsGeneratedAt: now },
    });

    const totalTime = Date.now() - startTime;
    console.log(
      `✅ [CONTRIBUTION SUGGESTIONS] ${filteredSuggestions.length} suggestions generated (${totalTime}ms)`
    );

    // Store debug info for API response
    const debugData = {
      nextDatesLength: nextDates.length,
      monthlyContributionDecided,
      cashBalance,
      pendingBuyCount,
      shouldGenerateBuys: cashBalance > 0.01 && pendingBuyCount === 0,
      portfolioAssets: portfolio.assets?.length || 0,
      holdingsCount: holdings.size,
      pricesCount: prices.size,
      suggestionsBeforeFilter: suggestions.length,
      suggestionsAfterFilter: filteredSuggestions.length,
      currentMonthContribution: currentMonthContribution ? {
        type: currentMonthContribution.type,
        status: currentMonthContribution.status,
        date: currentMonthContribution.date.toISOString().split("T")[0]
      } : null
    };
    
    this.debugInfo.set(portfolioId, debugData);
    console.log(`💾 [DEBUG_STORED] Stored debug info for portfolio ${portfolioId}:`, JSON.stringify(debugData, null, 2));

    return filteredSuggestions;
  }

  /**
   * Get debug info for the last getContributionSuggestions call
   */
  static getContributionSuggestionsDebug(portfolioId: string): any {
    return this.debugInfo.get(portfolioId) || null;
  }

  /**
   * Clear debug info for a portfolio
   */
  static clearContributionSuggestionsDebug(portfolioId: string): void {
    this.debugInfo.delete(portfolioId);
  }

  /**
   * Get rebalancing suggestions (SELL_REBALANCE + BUY_REBALANCE)
   * Only generated when user explicitly requests or when portfolio deviates significantly
   */
  static async getRebalancingSuggestions(
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

    if (!portfolio.trackingStarted) {
      return [];
    }

    console.log(`⚖️ [REBALANCING SUGGESTIONS] Starting...`);
    const startTime = Date.now();

    // Get data in parallel
    const [holdings, prices, existingTransactions] = await Promise.all([
      this.getCurrentHoldings(portfolioId),
      this.getLatestPrices(portfolio.assets.map((a) => a.ticker)),
      prisma.portfolioTransaction.findMany({
        where: {
          portfolioId,
          status: { in: ["PENDING", "CONFIRMED", "REJECTED"] },
          isAutoSuggested: true,
          type: { in: ["SELL_REBALANCE", "BUY_REBALANCE"] },
        },
        select: {
          date: true,
          type: true,
          ticker: true,
          status: true,
          amount: true,
          quantity: true,
        },
      }),
    ]);

    const today = new Date();
    const portfolioValue = this.calculatePortfolioValue(holdings, prices);
    const currentAllocations = this.calculateCurrentAllocations(
      holdings,
      prices,
      portfolioValue
    );
    const cashBalance = await this.getCurrentCashBalance(portfolioId);

    // Generate rebalancing transactions
    const rebalanceSuggestions = this.generateRebalanceTransactions(
      portfolio.assets,
      holdings,
      prices,
      portfolioValue,
      currentAllocations,
      cashBalance,
      today
    );

    // Filter duplicates
    const filteredSuggestions = this.filterDuplicateSuggestions(
      rebalanceSuggestions,
      existingTransactions
    );

    const totalTime = Date.now() - startTime;
    console.log(
      `✅ [REBALANCING SUGGESTIONS] ${filteredSuggestions.length} suggestions generated (${totalTime}ms)`
    );

    return filteredSuggestions;
  }

  /**
   * Check if rebalancing should be shown (portfolio deviates significantly from targets)
   */
  static async shouldShowRebalancing(
    portfolioId: string,
    userId: string,
    threshold: number = 0.05 // 5% deviation threshold
  ): Promise<{ shouldShow: boolean; maxDeviation: number; details: string }> {
    const portfolio = await PortfolioService.getPortfolioConfig(
      portfolioId,
      userId
    );
    if (!portfolio || !portfolio.trackingStarted) {
      return { shouldShow: false, maxDeviation: 0, details: "" };
    }

    const [holdings, prices] = await Promise.all([
      this.getCurrentHoldings(portfolioId),
      this.getLatestPrices(portfolio.assets.map((a) => a.ticker)),
    ]);

    const portfolioValue = this.calculatePortfolioValue(holdings, prices);
    const currentAllocations = this.calculateCurrentAllocations(
      holdings,
      prices,
      portfolioValue
    );

    let maxDeviation = 0;
    const deviations: string[] = [];

    for (const asset of portfolio.assets) {
      const currentAlloc = currentAllocations.get(asset.ticker) || 0;
      const targetAlloc = Number(asset.targetAllocation);
      const deviation = Math.abs(currentAlloc - targetAlloc);

      if (deviation > maxDeviation) {
        maxDeviation = deviation;
      }

      if (deviation > threshold) {
        deviations.push(
          `${asset.ticker}: ${(currentAlloc * 100).toFixed(1)}% → ${(targetAlloc * 100).toFixed(1)}% (desvio: ${(deviation * 100).toFixed(1)}%)`
        );
      }
    }

    const shouldShow = maxDeviation > threshold;
    const details = deviations.length > 0
      ? `Desvios detectados: ${deviations.join("; ")}`
      : "Carteira dentro dos limites de alocação";

    return { shouldShow, maxDeviation, details };
  }

  /**
   * Generate buy transactions for available cash, prioritizing assets furthest from target allocation
   */
  private static async generateBuyTransactionsForCash(
    portfolio: any,
    availableCash: number,
    holdings: Map<string, { quantity: number; totalInvested: number }>,
    prices: Map<string, number>
  ): Promise<SuggestedTransaction[]> {
    console.log(`🔄 [GENERATE_BUY] Starting with R$ ${availableCash.toFixed(2)} available cash`);
    console.log(`📊 [GENERATE_BUY] Portfolio has ${portfolio.assets?.length || 0} assets configured`);
    console.log(`📊 [GENERATE_BUY] Holdings: ${holdings.size} tickers, Prices: ${prices.size} tickers`);
    
    const suggestions: SuggestedTransaction[] = [];
    let cashBalance = availableCash;
    const today = new Date();

    // Calculate current allocations
    const portfolioValue = this.calculatePortfolioValue(holdings, prices);
    console.log(`💰 [GENERATE_BUY] Portfolio value: R$ ${portfolioValue.toFixed(2)}`);
    
    const currentAllocations = this.calculateCurrentAllocations(
      holdings,
      prices,
      portfolioValue
    );
    
    console.log(`📊 [GENERATE_BUY] Current allocations:`, Array.from(currentAllocations.entries()).map(([ticker, alloc]) => 
      `${ticker}: ${(alloc * 100).toFixed(1)}%`
    ));

    // Calculate deviation from target for each asset (only underallocated assets)
    const assetsWithDeviation: Array<{
      ticker: string;
      targetAlloc: number;
      currentAlloc: number;
      deviation: number;
      price: number;
    }> = [];

    console.log(`🔍 [GENERATE_BUY] Checking ${portfolio.assets?.length || 0} assets for underallocation...`);
    
    for (const asset of portfolio.assets) {
      const price = prices.get(asset.ticker);
      if (!price) {
        console.log(`⚠️ [GENERATE_BUY] No price found for ${asset.ticker}, skipping`);
        continue;
      }

      const targetAlloc = Number(asset.targetAllocation);
      const currentAlloc = currentAllocations.get(asset.ticker) || 0;
      
      console.log(`  📊 [GENERATE_BUY] ${asset.ticker}: current=${(currentAlloc * 100).toFixed(1)}%, target=${(targetAlloc * 100).toFixed(1)}%, price=R$ ${price.toFixed(2)}`);
      
      // Only consider underallocated assets (we want to buy, not sell)
      if (currentAlloc < targetAlloc) {
        const deviation = targetAlloc - currentAlloc;
        assetsWithDeviation.push({
          ticker: asset.ticker,
          targetAlloc,
          currentAlloc,
          deviation,
          price,
        });
        console.log(`    ✅ [GENERATE_BUY] ${asset.ticker} is underallocated (deviation: ${(deviation * 100).toFixed(1)}%)`);
      } else {
        console.log(`    ⏸️ [GENERATE_BUY] ${asset.ticker} is not underallocated, skipping`);
      }
    }
    
    console.log(`📊 [GENERATE_BUY] Found ${assetsWithDeviation.length} underallocated assets`);

    // Sort by deviation (furthest from target first)
    assetsWithDeviation.sort((a, b) => b.deviation - a.deviation);

    console.log(
      `📊 [BUY PRIORITY] Assets sorted by deviation from target:`,
      assetsWithDeviation.map(
        (a) =>
          `${a.ticker}: ${(a.currentAlloc * 100).toFixed(1)}% → ${(a.targetAlloc * 100).toFixed(1)}% (desvio: ${(a.deviation * 100).toFixed(1)}%)`
      )
    );

    // Calculate total deviation once (outside loop for efficiency)
    const totalDeviation = assetsWithDeviation.reduce(
      (sum, a) => sum + a.deviation,
      0
    );
    
    console.log(`💰 [GENERATE_BUY] Total deviation: ${totalDeviation.toFixed(4)}, Available cash: R$ ${availableCash.toFixed(2)}`);

    // Distribute cash prioritizing assets furthest from target
    // IMPORTANT: Use cashBalance (updated) instead of availableCash to ensure we don't exceed available funds
    let remainingCash = cashBalance;
    let totalSuggested = 0;
    const suggestedTickers = new Set<string>(); // Track which tickers already have suggestions
    
    // First pass: Calculate proportional allocations for each asset
    const assetAllocations: Array<{
      asset: typeof assetsWithDeviation[0];
      targetAmount: number;
      maxNeeded: number;
      priority: number;
    }> = [];
    
    for (const asset of assetsWithDeviation) {
      const allocationWeight = asset.deviation / totalDeviation;
      const targetAmount = availableCash * allocationWeight; // Use initial availableCash for proportional calculation
      
      const currentValue = (holdings.get(asset.ticker)?.quantity || 0) * asset.price;
      const targetValue = (portfolioValue + availableCash) * asset.targetAlloc;
      const maxNeeded = Math.max(0, targetValue - currentValue);
      
      assetAllocations.push({
        asset,
        targetAmount,
        maxNeeded,
        priority: asset.deviation, // Higher deviation = higher priority
      });
    }
    
    // Sort by priority (highest deviation first)
    assetAllocations.sort((a, b) => b.priority - a.priority);
    
    console.log(`📊 [GENERATE_BUY] Calculated allocations for ${assetAllocations.length} assets`);
    
    // Second pass: Distribute cash ensuring we use as much as possible
    for (let i = 0; i < assetAllocations.length; i++) {
      const { asset, targetAmount, maxNeeded } = assetAllocations[i];
      const isLastAsset = i === assetAllocations.length - 1;
      
      if (remainingCash <= 0.01) {
        console.log(`⏸️ [GENERATE_BUY] No more cash available (R$ ${remainingCash.toFixed(2)}), stopping`);
        break;
      }

      // CRITICAL: Only suggest one buy per ticker to avoid duplicates
      if (suggestedTickers.has(asset.ticker)) {
        console.log(`⏸️ [GENERATE_BUY] ${asset.ticker}: Already has a buy suggestion, skipping to avoid duplicates`);
        continue;
      }

      // Calculate amount to invest
      // Strategy: Use proportional allocation, prioritizing using all available cash
      // We'll respect maxNeeded as a guideline, but if there's leftover cash, we'll distribute it
      let amountToInvest: number;
      
      // Calculate how much we can invest without exceeding maxNeeded
      const maxByNeeded = Math.min(targetAmount, maxNeeded);
      
      // For last asset, invest all remaining cash (even if slightly exceeds maxNeeded)
      // For other assets, use proportional allocation
      if (isLastAsset) {
        // Last asset gets ALL remaining cash (even if exceeds maxNeeded slightly)
        // This ensures we use as much cash as possible
        amountToInvest = remainingCash;
        if (amountToInvest > maxNeeded) {
          console.log(`  🎯 [GENERATE_BUY] ${asset.ticker}: Last asset - investing all remaining: R$ ${amountToInvest.toFixed(2)} (exceeds maxNeeded: R$ ${maxNeeded.toFixed(2)} by R$ ${(amountToInvest - maxNeeded).toFixed(2)})`);
        } else {
          console.log(`  🎯 [GENERATE_BUY] ${asset.ticker}: Last asset - investing all remaining: R$ ${amountToInvest.toFixed(2)} (maxNeeded: R$ ${maxNeeded.toFixed(2)})`);
        }
      } else {
        // Use proportional allocation, prioritizing using all available cash
        // Calculate how much cash will be left for remaining assets
        const remainingAssetsCount = assetAllocations.length - i - 1;
        
        if (remainingAssetsCount === 0) {
          // This is effectively the last asset, invest all remaining cash
          amountToInvest = remainingCash;
          console.log(`  🎯 [GENERATE_BUY] ${asset.ticker}: Effectively last asset - investing all remaining: R$ ${amountToInvest.toFixed(2)}`);
        } else {
          // Estimate how much cash each remaining asset will need
          const avgRemainingPerAsset = remainingCash / (remainingAssetsCount + 1);
          
          // If we have plenty of cash relative to maxNeeded, we can exceed it
          // Otherwise, use proportional allocation but don't be too restrictive
          if (avgRemainingPerAsset > maxNeeded * 1.2) {
            // We have plenty of cash, can exceed maxNeeded to use more cash
            amountToInvest = Math.min(targetAmount * 1.3, remainingCash); // Allow 30% over targetAmount
            console.log(`  💰 [GENERATE_BUY] ${asset.ticker}: Plenty of cash - investing R$ ${amountToInvest.toFixed(2)} (targetAmount: R$ ${targetAmount.toFixed(2)}, maxNeeded: R$ ${maxNeeded.toFixed(2)})`);
          } else {
            // Use proportional allocation, but be more generous
            amountToInvest = Math.min(targetAmount, remainingCash);
            // If maxNeeded is very restrictive, still use at least targetAmount
            if (amountToInvest < targetAmount * 0.8 && remainingCash > targetAmount) {
              amountToInvest = Math.min(targetAmount, remainingCash);
            }
          }
        }
      }

      console.log(`  💰 [GENERATE_BUY] ${asset.ticker}: targetAmount=R$ ${targetAmount.toFixed(2)}, maxNeeded=R$ ${maxNeeded.toFixed(2)}, amountToInvest=R$ ${amountToInvest.toFixed(2)}, remainingCash=R$ ${remainingCash.toFixed(2)}`);

      if (amountToInvest > 0.01) {
        const sharesToBuy = Math.floor(amountToInvest / asset.price);

        if (sharesToBuy > 0) {
          const actualAmount = sharesToBuy * asset.price;
          
          // Double-check: don't exceed remaining cash
          if (actualAmount > remainingCash) {
            console.log(`⚠️ [GENERATE_BUY] ${asset.ticker}: actualAmount (R$ ${actualAmount.toFixed(2)}) exceeds remainingCash (R$ ${remainingCash.toFixed(2)}), skipping`);
            continue;
          }

          suggestions.push({
            date: today,
            type: "BUY",
            ticker: asset.ticker,
            amount: actualAmount,
            price: asset.price,
            quantity: sharesToBuy,
            reason: `Compra de ${sharesToBuy} ações (alocação atual ${(asset.currentAlloc * 100).toFixed(1)}% → alvo ${(asset.targetAlloc * 100).toFixed(1)}%, prioridade por desvio)`,
            cashBalanceBefore: remainingCash,
            cashBalanceAfter: remainingCash - actualAmount,
          });

          suggestedTickers.add(asset.ticker); // Mark this ticker as having a suggestion
          totalSuggested += actualAmount;
          remainingCash -= actualAmount;
          
          console.log(`  ✅ [GENERATE_BUY] ${asset.ticker}: Added suggestion for R$ ${actualAmount.toFixed(2)} (${sharesToBuy} shares), remaining cash: R$ ${remainingCash.toFixed(2)}`);
        } else {
          console.log(`  ⏸️ [GENERATE_BUY] ${asset.ticker}: Not enough to buy even 1 share (amountToInvest: R$ ${amountToInvest.toFixed(2)}, price: R$ ${asset.price.toFixed(2)})`);
        }
      }
    }
    
    // If there's still remaining cash after all allocations, distribute it proportionally
    // This ensures we use as much cash as possible
    if (remainingCash > 0.01 && assetAllocations.length > 0) {
      console.log(`💰 [GENERATE_BUY] Distributing remaining cash: R$ ${remainingCash.toFixed(2)}`);
      
      // Distribute remaining cash proportionally among ALL assets that have suggestions
      // Use the same proportional weights based on deviation
      const assetsWithSuggestions = assetAllocations.filter(({ asset }) => 
        suggestedTickers.has(asset.ticker)
      );
      
      if (assetsWithSuggestions.length > 0) {
        // Calculate total deviation for assets with suggestions
        const totalDeviationForSuggested = assetsWithSuggestions.reduce(
          (sum, { asset }) => sum + asset.deviation,
          0
        );
        
        // Distribute remaining cash proportionally
        for (const { asset } of assetsWithSuggestions) {
          if (remainingCash <= 0.01) break;
          
          const allocationWeight = asset.deviation / totalDeviationForSuggested;
          const additionalAmount = Math.min(remainingCash * allocationWeight, remainingCash);
          
          if (additionalAmount > 0.01) {
            const sharesToBuy = Math.floor(additionalAmount / asset.price);
            if (sharesToBuy > 0) {
              const actualAmount = sharesToBuy * asset.price;
              
              // Update existing suggestion
              const index = suggestions.findIndex(s => s.ticker === asset.ticker);
              if (index >= 0 && suggestions[index]) {
                suggestions[index].amount += actualAmount;
                suggestions[index].quantity = (suggestions[index].quantity || 0) + sharesToBuy;
                suggestions[index].reason = (suggestions[index].reason || '') + ` + ${sharesToBuy} ações (saldo restante)`;
                totalSuggested += actualAmount;
                remainingCash -= actualAmount;
                console.log(`  🔄 [GENERATE_BUY] ${asset.ticker}: Updated suggestion + R$ ${actualAmount.toFixed(2)} (${sharesToBuy} shares), remaining: R$ ${remainingCash.toFixed(2)}`);
              }
            }
          }
        }
      }
      
      // If still have remaining cash (due to rounding), give it all to the last asset
      if (remainingCash > 0.01 && assetAllocations.length > 0) {
        const lastAllocation = assetAllocations[assetAllocations.length - 1];
        const { asset } = lastAllocation;
        
        const sharesToBuy = Math.floor(remainingCash / asset.price);
        if (sharesToBuy > 0) {
          const actualAmount = sharesToBuy * asset.price;
          const beforeRemaining = remainingCash;
          remainingCash -= actualAmount;
          
          const existingSuggestion = suggestions.find(s => s.ticker === asset.ticker);
          if (existingSuggestion) {
            // Update existing suggestion
            const index = suggestions.findIndex(s => s.ticker === asset.ticker);
            if (index >= 0 && suggestions[index]) {
              suggestions[index].amount += actualAmount;
              suggestions[index].quantity = (suggestions[index].quantity || 0) + sharesToBuy;
              suggestions[index].reason = (suggestions[index].reason || '') + ` + ${sharesToBuy} ações (saldo final)`;
              totalSuggested += actualAmount;
              console.log(`  🎯 [GENERATE_BUY] ${asset.ticker}: Added final leftover: R$ ${actualAmount.toFixed(2)} (${sharesToBuy} shares), remaining: R$ ${remainingCash.toFixed(2)}`);
            }
          } else {
            // Create new suggestion
            suggestions.push({
              date: today,
              type: "BUY",
              ticker: asset.ticker,
              amount: actualAmount,
              price: asset.price,
              quantity: sharesToBuy,
              reason: `Compra de ${sharesToBuy} ações (saldo final restante)`,
              cashBalanceBefore: beforeRemaining,
              cashBalanceAfter: remainingCash,
            });
            suggestedTickers.add(asset.ticker);
            totalSuggested += actualAmount;
            console.log(`  🎯 [GENERATE_BUY] ${asset.ticker}: Added final leftover cash: R$ ${actualAmount.toFixed(2)} (${sharesToBuy} shares), remaining: R$ ${remainingCash.toFixed(2)}`);
          }
        }
      }
    }
    
    console.log(`💰 [GENERATE_BUY] Total suggested: R$ ${totalSuggested.toFixed(2)} / Available cash: R$ ${availableCash.toFixed(2)}`);
    if (totalSuggested > availableCash + 0.01) {
      console.error(`❌ [GENERATE_BUY] ERROR: Total suggested (R$ ${totalSuggested.toFixed(2)}) exceeds available cash (R$ ${availableCash.toFixed(2)})!`);
    }
    
    // Final safety check: ensure no duplicate tickers
    const tickerCounts = new Map<string, number>();
    suggestions.forEach(s => {
      if (s.ticker) {
        tickerCounts.set(s.ticker, (tickerCounts.get(s.ticker) || 0) + 1);
      }
    });
    
    const duplicates = Array.from(tickerCounts.entries()).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      console.error(`❌ [GENERATE_BUY] ERROR: Found duplicate tickers in suggestions:`, duplicates);
      // Remove duplicates, keeping only the first occurrence
      const seenTickers = new Set<string>();
      const deduplicatedSuggestions = suggestions.filter(s => {
        if (!s.ticker) return true;
        if (seenTickers.has(s.ticker)) {
          console.log(`🧹 [GENERATE_BUY] Removing duplicate suggestion for ${s.ticker}`);
          return false;
        }
        seenTickers.add(s.ticker);
        return true;
      });
      console.log(`🧹 [GENERATE_BUY] Removed ${suggestions.length - deduplicatedSuggestions.length} duplicate suggestions`);
      return deduplicatedSuggestions;
    }

    return suggestions;
  }

  /**
   * Filter duplicate suggestions based on existing transactions
   */
  private static filterDuplicateSuggestions(
    suggestions: SuggestedTransaction[],
    existingTransactions: any[]
  ): SuggestedTransaction[] {
    const existingTransactionKeys = new Set(
      existingTransactions.map((tx) => {
        const dateStr = tx.date.toISOString().split("T")[0];
        const ticker = tx.ticker || "null";
        const amount = Number(tx.amount).toFixed(2);
        const quantity = tx.quantity ? Number(tx.quantity).toFixed(6) : "null";

        if (
          tx.type === "BUY" ||
          tx.type === "SELL_REBALANCE" ||
          tx.type === "BUY_REBALANCE" ||
          tx.type === "SELL_WITHDRAWAL"
        ) {
          return `${dateStr}_${tx.type}_${ticker}_${quantity}`;
        } else {
          return `${dateStr}_${tx.type}_${ticker}_${amount}`;
        }
      })
    );

    console.log(`🔍 [FILTER_DEDUP] Checking ${suggestions.length} suggestions against ${existingTransactionKeys.size} existing transactions`);
    if (existingTransactionKeys.size > 0) {
      console.log(`🔍 [FILTER_DEDUP] Existing transaction keys:`, Array.from(existingTransactionKeys).slice(0, 10));
    }

    const filtered = suggestions.filter((suggestion) => {
      const dateStr = suggestion.date.toISOString().split("T")[0];
      const ticker = suggestion.ticker || "null";
      const amount = suggestion.amount.toFixed(2);
      const quantity = suggestion.quantity
        ? suggestion.quantity.toFixed(6)
        : "null";

      let key: string;
      if (
        suggestion.type === "BUY" ||
        suggestion.type === "SELL_REBALANCE" ||
        suggestion.type === "BUY_REBALANCE" ||
        suggestion.type === "SELL_WITHDRAWAL"
      ) {
        key = `${dateStr}_${suggestion.type}_${ticker}_${quantity}`;
      } else {
        key = `${dateStr}_${suggestion.type}_${ticker}_${amount}`;
      }

      const isDuplicate = existingTransactionKeys.has(key);
      if (isDuplicate) {
        console.log(`🚫 [FILTER_DEDUP] Filtered out duplicate: ${key} (type: ${suggestion.type}, date: ${dateStr}, amount: ${amount})`);
      }
      return !isDuplicate;
    });

    console.log(`✅ [FILTER_DEDUP] Filtered ${suggestions.length} suggestions → ${filtered.length} remaining`);
    return filtered;
  }

  /**
   * Calculate next transaction dates based on rebalance frequency
   * Always suggests contribution for the current month if no CASH_CREDIT exists in current month
   * (regardless of whether previous month's contribution was accepted or rejected)
   */
  private static async calculateNextTransactionDates(
    portfolioId: string
  ): Promise<Date[]> {
    console.log(`📅 [CALC_DATES] Starting calculateNextTransactionDates for portfolio ${portfolioId}`);
    
    const portfolio = await prisma.portfolioConfig.findUnique({
      where: { id: portfolioId },
      select: {
        startDate: true,
        rebalanceFrequency: true,
      },
    });

    if (!portfolio) {
      console.log(`❌ [CALC_DATES] Portfolio not found`);
      return [];
    }

    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    // Get start of current month
    const startOfCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );
    startOfCurrentMonth.setHours(0, 0, 0, 0);
    
    console.log(`📅 [CALC_DATES] Today: ${today.toISOString().split("T")[0]}, Start of month: ${startOfCurrentMonth.toISOString().split("T")[0]}`);

    // Check if there's already a PENDING MONTHLY_CONTRIBUTION or CASH_CREDIT transaction in the current month
    // Only PENDING transactions prevent suggesting (user hasn't decided yet)
    // CONFIRMED/REJECTED/EXECUTED don't prevent - we can suggest again if needed
    const currentMonthPendingTransaction = await prisma.portfolioTransaction.findFirst({
      where: {
        portfolioId,
        status: "PENDING",
        type: { in: ["MONTHLY_CONTRIBUTION", "CASH_CREDIT"] as any },
        date: {
          gte: startOfCurrentMonth, // Within current month
        },
      },
      select: {
        date: true,
        status: true,
        type: true,
      },
    });

    console.log(
      `📅 [CHECK_MONTH] Current month PENDING transaction check:`,
      currentMonthPendingTransaction 
        ? `Found ${currentMonthPendingTransaction.type} with status ${currentMonthPendingTransaction.status} on ${currentMonthPendingTransaction.date.toISOString().split("T")[0]}`
        : 'No PENDING transaction found in current month'
    );

    // If there's a PENDING transaction, don't suggest again (user hasn't decided yet)
    if (currentMonthPendingTransaction) {
      console.log(
        `⏸️ [PENDING_EXISTS] PENDING contribution already exists for current month, not suggesting again`
      );
      return dates; // Return empty array - don't suggest
    }

    // If no PENDING transaction exists in current month, suggest for first day of current month
    // This ensures we always suggest the monthly contribution for the current month
    dates.push(new Date(startOfCurrentMonth));
    console.log(
      `📅 [SUGGEST] No PENDING contribution in current month (${startOfCurrentMonth.toISOString().split("T")[0]}), suggesting for first day of month`
    );
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

    console.log(
      `\n📊 [GET HOLDINGS] Processing ${transactions.length} transactions...`
    );

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
        const averageCost =
          quantityBefore > 0 ? investedBefore / quantityBefore : 0;

        // Reduce quantity and totalInvested by the COST of shares sold (not sale value)
        current.quantity -= quantitySold;
        const costReduction = averageCost * quantitySold;
        current.totalInvested -= costReduction;

        console.log(
          `  📉 [SELL] ${
            tx.ticker
          }: Sold ${quantitySold} shares, cost reduction: R$ ${costReduction.toFixed(
            2
          )}`
        );
      }

      console.log(
        `  ${tx.type === "BUY" || tx.type === "BUY_REBALANCE" ? "📈" : "📉"} [${
          tx.date.toISOString().split("T")[0]
        }] ${tx.type} ${tx.ticker}: ${before.quantity} → ${
          current.quantity
        } shares, R$ ${before.totalInvested.toFixed(
          2
        )} → R$ ${current.totalInvested.toFixed(2)}`
      );

      holdings.set(tx.ticker, current);
    }

    console.log(`\n✅ [HOLDINGS SUMMARY]:`);
    for (const [ticker, holding] of holdings) {
      if (holding.quantity > 0) {
        console.log(
          `  ${ticker}: ${
            holding.quantity
          } shares, R$ ${holding.totalInvested.toFixed(2)} invested`
        );
      }
    }
    console.log("");

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
  static async getCurrentCashBalance(
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
        (tx.type as string) === "MONTHLY_CONTRIBUTION" ||
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
      if (tx.type === "CASH_CREDIT" || (tx.type as string) === "MONTHLY_CONTRIBUTION" || tx.type === "DIVIDEND") {
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
      if (tx.type === "CASH_CREDIT" || (tx.type as string) === "MONTHLY_CONTRIBUTION") {
        summary.CASH_CREDIT += Number(tx.amount);
      }
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

    if (portfolioValue === 0) {
      console.log(
        "⚠️ [ALLOCATION] Portfolio value is 0, returning empty allocations"
      );
      return allocations;
    }

    console.log(
      `📊 [ALLOCATION CALCULATION] Portfolio value: R$ ${portfolioValue.toFixed(
        2
      )}`
    );

    for (const [ticker, holding] of holdings) {
      const price = prices.get(ticker) || 0;
      const value = holding.quantity * price;
      const allocation = value / portfolioValue;

      allocations.set(ticker, allocation);

      console.log(
        `  ${ticker}: ${holding.quantity} shares × R$ ${price.toFixed(
          2
        )} = R$ ${value.toFixed(2)} (${(allocation * 100).toFixed(2)}%)`
      );
    }

    // Verificar se as alocações somam 100%
    const totalAllocation = Array.from(allocations.values()).reduce(
      (sum, alloc) => sum + alloc,
      0
    );
    console.log(
      `📊 [ALLOCATION TOTAL] ${(totalAllocation * 100).toFixed(
        2
      )}% (should be ≤ 100%)`
    );

    return allocations;
  }

  /**
   * Get dividend suggestions (public method)
   */
  static async getDividendSuggestions(
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

    if (!portfolio.trackingStarted) {
      return [];
    }

    console.log(`💰 [DIVIDEND SUGGESTIONS] Starting...`);
    const startTime = Date.now();

    // Get data in parallel
    const [holdings, prices, existingTransactions] = await Promise.all([
      this.getCurrentHoldings(portfolioId),
      this.getLatestPrices(portfolio.assets.map((a) => a.ticker)),
      prisma.portfolioTransaction.findMany({
        where: {
          portfolioId,
          status: { in: ["PENDING", "CONFIRMED", "REJECTED"] },
          isAutoSuggested: true,
          type: "DIVIDEND",
        },
        select: {
          date: true,
          type: true,
          ticker: true,
          status: true,
          amount: true,
          quantity: true,
          price: true,
        },
      }),
    ]);

    const suggestions = await this.generateDividendSuggestions(
      portfolioId,
      holdings,
      prices
    );

    // Filter duplicates
    const filteredSuggestions = this.filterDuplicateSuggestions(
      suggestions,
      existingTransactions
    );

    const totalTime = Date.now() - startTime;
    console.log(
      `✅ [DIVIDEND SUGGESTIONS] ${filteredSuggestions.length} suggestions generated (${totalTime}ms)`
    );

    return filteredSuggestions;
  }

  /**
   * Generate dividend suggestions for assets in custody
   * 
   * INTELLIGENT CRITERIA:
   * 1. Asset must be in current holdings (quantity > 0)
   * 2. Only suggest dividends from the first transaction date of each asset onwards
   * 3. Don't suggest if same dividend amount already exists for the same month (any status)
   * 4. Don't suggest if user previously rejected the same dividend (REJECTED status)
   * 5. User had position in custody BEFORE the ex-date (not from rebalancing purchases)
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

    // Get first transaction date for each asset to determine dividend eligibility period
    const firstTransactionDates = await this.getFirstTransactionDates(portfolioId);

    // Get existing dividend transactions to avoid duplicates and respect rejections
    const existingDividendTransactions = await prisma.portfolioTransaction.findMany({
      where: {
        portfolioId,
        type: "DIVIDEND",
        ticker: { not: null },
      },
      select: {
        ticker: true,
        date: true,
        amount: true,
        status: true,
        price: true, // Per-share dividend amount
      },
    });

    // Create maps for quick lookup - handle both automatic and manual dividend entries
    // Manual entries may not have per-share amount (price field), so we need to check both ways
    const existingDividendsByMonth = new Map<string, Array<{
      amount: number;
      status: string;
      perShareAmount: number;
      date: Date;
      isManual: boolean;
    }>>();

    existingDividendTransactions.forEach(tx => {
      if (!tx.ticker) return;
      
      const perShareAmount = Number(tx.price || 0);
      const totalAmount = Number(tx.amount);
      const isManual = perShareAmount === 0; // Manual entries typically don't have per-share amount
      
      // Group by ticker and month for comparison
      const monthKey = `${tx.ticker}_${tx.date.getFullYear()}_${tx.date.getMonth()}`;
      
      if (!existingDividendsByMonth.has(monthKey)) {
        existingDividendsByMonth.set(monthKey, []);
      }
      
      existingDividendsByMonth.get(monthKey)!.push({
        amount: totalAmount,
        status: tx.status,
        perShareAmount: perShareAmount,
        date: tx.date,
        isManual: isManual,
      });
    });

    console.log(`🔍 [DIVIDEND DEDUP] Loaded ${existingDividendTransactions.length} existing dividend transactions for deduplication`);
    if (existingDividendTransactions.length > 0) {
      const tickerCounts = new Map<string, number>();
      let manualCount = 0;
      let autoCount = 0;
      
      existingDividendTransactions.forEach(tx => {
        if (tx.ticker) {
          tickerCounts.set(tx.ticker, (tickerCounts.get(tx.ticker) || 0) + 1);
          if (Number(tx.price || 0) === 0) {
            manualCount++;
          } else {
            autoCount++;
          }
        }
      });
      
      console.log(`📊 [DIVIDEND SUMMARY] ${manualCount} manual + ${autoCount} auto transactions by ticker:`, 
        Array.from(tickerCounts.entries()).map(([ticker, count]) => `${ticker}: ${count}`).join(', ')
      );
    }

    // Check each asset in holdings for dividends
    for (const [ticker, holding] of holdings) {
      if (holding.quantity <= 0) continue; // Skip if no position

      // Get first transaction date for this asset
      const firstTransactionDate = firstTransactionDates.get(ticker);
      if (!firstTransactionDate) {
        console.log(`⚠️ [DIVIDEND SKIP] ${ticker}: No transaction history found`);
        continue;
      }

      console.log(`📅 [DIVIDEND] ${ticker}: First transaction on ${firstTransactionDate.toISOString().split('T')[0]}`);

      // First, ensure we have dividend data for this asset
      try {
        await DividendService.fetchAndSaveDividends(ticker, firstTransactionDate);
      } catch (error) {
        console.log(
          `⚠️ [DIVIDEND] Error fetching dividends for ${ticker}:`,
          error
        );
        continue;
      }

      // Get all dividends from first transaction date until today
      const eligibleDividends = await DividendService.getDividendsInPeriod(
        ticker,
        firstTransactionDate,
        today
      );

      for (const dividend of eligibleDividends) {
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

        // Use the quantity held on ex-date for dividend calculation
        const quantityOnExDate = holdingBeforeExDate.quantity;
        const totalDividendAmount = dividend.amount * quantityOnExDate;

        if (totalDividendAmount <= 0) continue;

        // Check for existing dividend transactions in the same month
        const dividendDate = dividend.paymentDate || dividend.exDate;
        const monthKey = `${ticker}_${dividendDate.getFullYear()}_${dividendDate.getMonth()}`;
        const existingDividendsInMonth = existingDividendsByMonth.get(monthKey) || [];

        // Check if this dividend already exists (compare both per-share and total amounts)
        // Only skip if transaction is CONFIRMED or EXECUTED (not PENDING or REJECTED)
        let shouldSkip = false;
        let skipReason = '';
        let matchedTransaction = null;

        for (const existing of existingDividendsInMonth) {
          let isMatch = false;
          
          if (existing.isManual) {
            // Manual transaction: compare total amounts with tolerance
            const totalAmountDiff = Math.abs(existing.amount - totalDividendAmount);
            const tolerance = Math.max(0.01, totalDividendAmount * 0.02); // 2% tolerance or R$ 0.01 minimum
            
            if (totalAmountDiff <= tolerance) {
              isMatch = true;
              console.log(`🔍 [DIVIDEND MATCH] Manual transaction found: R$ ${existing.amount.toFixed(2)} vs suggested R$ ${totalDividendAmount.toFixed(2)} (diff: R$ ${totalAmountDiff.toFixed(2)})`);
            }
          } else {
            // Automatic transaction: compare per-share amounts with high precision
            const perShareDiff = Math.abs(existing.perShareAmount - dividend.amount);
            const tolerance = Math.max(0.0001, dividend.amount * 0.01); // 1% tolerance or R$ 0.0001 minimum
            
            if (perShareDiff <= tolerance) {
              isMatch = true;
              console.log(`🔍 [DIVIDEND MATCH] Auto transaction found: R$ ${existing.perShareAmount.toFixed(4)}/share vs suggested R$ ${dividend.amount.toFixed(4)}/share (diff: R$ ${perShareDiff.toFixed(4)})`);
            }
          }

          if (isMatch) {
            matchedTransaction = existing;
            
            // Only skip if transaction is CONFIRMED or EXECUTED (same asset, same month, same value)
            // REJECTED transactions can be suggested again (user might want to reconsider)
            // PENDING transactions are already shown, so we skip to avoid duplicates
            if (existing.status === 'CONFIRMED' || existing.status === 'EXECUTED') {
              shouldSkip = true;
              skipReason = `Already processed (${existing.status}) - same asset, same month, same value`;
            } else if (existing.status === 'PENDING') {
              shouldSkip = true;
              skipReason = `Already pending`;
            } else if (existing.status === 'REJECTED') {
              // Don't skip rejected transactions - allow user to reconsider
              console.log(`🔄 [DIVIDEND REJECTED] ${ticker}: Previously rejected, but allowing re-suggestion`);
            }
            break;
          }
        }

        if (shouldSkip && matchedTransaction) {
          console.log(
            `⏩ [DIVIDEND SKIP] ${ticker} ${dividendDate.toISOString().split('T')[0]}: ${skipReason} - ${matchedTransaction.isManual ? 'Manual' : 'Auto'} entry (${matchedTransaction.isManual ? `R$ ${matchedTransaction.amount.toFixed(2)} total` : `R$ ${matchedTransaction.perShareAmount.toFixed(4)}/share`})`
          );
          continue;
        }

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
          )} (Ex-date: ${dividend.exDate.toISOString().split('T')[0]})`,
          cashBalanceBefore: cashBalance,
          cashBalanceAfter: cashBalance + totalDividendAmount,
        });

        cashBalance += totalDividendAmount; // Update for next iteration

        console.log(
          `💵 [DIVIDEND SUGGESTED] ${ticker}: ${quantityOnExDate} shares × R$ ${
            dividend.amount.toFixed(4)
          } = R$ ${totalDividendAmount.toFixed(2)} (Ex-date: ${dividend.exDate.toISOString().split('T')[0]}, Payment: ${dividendDate.toISOString().split('T')[0]})`
        );
      }
    }

    return suggestions;
  }

  /**
   * Get the first transaction date for each asset in the portfolio
   * This determines from when we should start suggesting dividends
   */
  private static async getFirstTransactionDates(
    portfolioId: string
  ): Promise<Map<string, Date>> {
    const firstTransactions = await prisma.portfolioTransaction.findMany({
      where: {
        portfolioId,
        status: { in: ["CONFIRMED", "EXECUTED"] },
        ticker: { not: null },
        type: { in: ["BUY", "BUY_REBALANCE"] }, // Only consider buy transactions
      },
      select: {
        ticker: true,
        date: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    const firstDates = new Map<string, Date>();
    
    for (const tx of firstTransactions) {
      if (!tx.ticker) continue;
      
      if (!firstDates.has(tx.ticker)) {
        firstDates.set(tx.ticker, tx.date);
      }
    }

    return firstDates;
  }

  /**
   * Generate rebalancing transactions using NET POSITION calculation
   * Avoids selling and buying the same asset by calculating net changes needed
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

    console.log(`🔄 [NET REBALANCING] Starting net position calculation...`);

    // 🔧 ESTRATÉGIA HÍBRIDA: 
    // 1. Calcular targets baseado no valor atual (para identificar sobrealocados)
    // 2. Considerar caixa disponível para investir em subalocados
    const currentPortfolioValue = portfolioValue;
    const totalValueWithCash = portfolioValue + availableCash;

    console.log(`💰 [REBALANCING VALUES]:`, {
      currentPortfolioValue: currentPortfolioValue.toFixed(2),
      availableCash: availableCash.toFixed(2),
      totalValueWithCash: totalValueWithCash.toFixed(2),
      strategy: "Hybrid: current value for sells, total value for buys",
    });

    // Calculate profitability for prioritizing sells
    const profitability = new Map<string, number>();
    for (const [ticker, holding] of holdings) {
      const currentValue = holding.quantity * (prices.get(ticker) || 0);
      const profit = currentValue - holding.totalInvested;
      const profitPercent =
        holding.totalInvested > 0 ? profit / holding.totalInvested : 0;
      profitability.set(ticker, profitPercent);
    }

    // Calculate net position changes needed for each asset
    const netChanges: Array<{
      ticker: string;
      currentQuantity: number;
      targetQuantity: number;
      netQuantityChange: number;
      netValueChange: number;
      price: number;
      profitability: number;
      targetAlloc: number;
      currentAlloc: number;
    }> = [];

    for (const asset of assets) {
      const price = prices.get(asset.ticker);
      if (!price) {
        console.log(`⚠️ [SKIP] ${asset.ticker}: No price available`);
        continue;
      }

      const currentHolding = holdings.get(asset.ticker) || { quantity: 0, totalInvested: 0 };
      const currentQuantity = currentHolding.quantity;
      const targetAlloc = Number(asset.targetAllocation);
      const currentAlloc = currentAllocations.get(asset.ticker) || 0;

      // 🔧 ESTRATÉGIA HÍBRIDA: Calcular target baseado no contexto
      // Para identificar sobrealocados: usar valor atual do portfólio
      // Para investir caixa: considerar valor total (portfólio + caixa)
      const currentTargetValue = currentPortfolioValue * targetAlloc;
      
      // Se ativo está sobrealocado, usar target atual (para venda)
      // Se ativo está subalocado, considerar caixa disponível (para compra)
      const isOverallocated = currentAlloc > targetAlloc;
      const targetValue = isOverallocated ? currentTargetValue : totalValueWithCash * targetAlloc;
      const targetQuantity = Math.floor(targetValue / price);
      
      const netQuantityChange = targetQuantity - currentQuantity;
      const netValueChange = netQuantityChange * price;

      netChanges.push({
        ticker: asset.ticker,
        currentQuantity,
        targetQuantity,
        netQuantityChange,
        netValueChange,
        price,
        profitability: profitability.get(asset.ticker) || 0,
        targetAlloc,
        currentAlloc,
      });

      console.log(`📊 [NET CALC] ${asset.ticker}:`, {
        current: `${currentQuantity} shares (${(currentAlloc * 100).toFixed(1)}%)`,
        target: `${targetQuantity} shares (${(targetAlloc * 100).toFixed(1)}%)`,
        netChange: `${netQuantityChange > 0 ? '+' : ''}${netQuantityChange} shares`,
        netValue: `${netValueChange > 0 ? '+' : ''}R$ ${netValueChange.toFixed(2)}`,
        profitability: `${((profitability.get(asset.ticker) || 0) * 100).toFixed(1)}%`,
        targetValue: `R$ ${targetValue.toFixed(2)}`,
        currentValue: `R$ ${(currentQuantity * price).toFixed(2)}`,
        action: netQuantityChange > 0 ? 'BUY' : netQuantityChange < 0 ? 'SELL' : 'HOLD',
        strategy: isOverallocated ? 'SELL_BASED_ON_CURRENT' : 'BUY_WITH_CASH',
      });
    }

    // Separate sells and buys, prioritizing profitable sells
    const sellChanges = netChanges
      .filter(change => change.netQuantityChange < 0)
      .sort((a, b) => b.profitability - a.profitability); // Most profitable first

    const buyChanges = netChanges
      .filter(change => change.netQuantityChange > 0);

    console.log(`🔍 [REBALANCING ANALYSIS]:`, {
      totalAssets: netChanges.length,
      sellCandidates: sellChanges.length,
      buyCandidates: buyChanges.length,
      sellTickers: sellChanges.map(c => `${c.ticker}(${c.netQuantityChange})`),
      buyTickers: buyChanges.map(c => `${c.ticker}(+${c.netQuantityChange})`),
    });

    // Process sells first (generate cash)
    for (const change of sellChanges) {
      const sharesToSell = Math.abs(change.netQuantityChange);
      const sellValue = sharesToSell * change.price;
      const profitText = change.profitability >= 0 
        ? `+${(change.profitability * 100).toFixed(1)}%`
        : `${(change.profitability * 100).toFixed(1)}%`;

      suggestions.push({
        date,
        type: "SELL_REBALANCE",
        ticker: change.ticker,
        amount: sellValue,
        price: change.price,
        quantity: sharesToSell,
        reason: `Rebalanceamento: venda de ${sharesToSell} ações (alocação atual ${(
          change.currentAlloc * 100
        ).toFixed(1)}% → alvo ${(change.targetAlloc * 100).toFixed(
          1
        )}%, rentabilidade: ${profitText})`,
        cashBalanceBefore: cashBalance,
        cashBalanceAfter: cashBalance + sellValue,
      });

      cashBalance += sellValue;

      console.log(
        `📉 [SELL NET] ${change.ticker}: ${sharesToSell} shares × R$ ${change.price.toFixed(
          2
        )} = R$ ${sellValue.toFixed(2)} (profit: ${profitText})`
      );
    }

    // Process buys (use available cash)
    for (const change of buyChanges) {
      const sharesToBuy = change.netQuantityChange;
      const buyValue = sharesToBuy * change.price;

      // Check if we have enough cash
      if (buyValue <= cashBalance) {
        suggestions.push({
          date,
          type: "BUY_REBALANCE",
          ticker: change.ticker,
          amount: buyValue,
          price: change.price,
          quantity: sharesToBuy,
          reason: `Rebalanceamento: compra de ${sharesToBuy} ações (alocação atual ${(
            change.currentAlloc * 100
          ).toFixed(1)}% → alvo ${(change.targetAlloc * 100).toFixed(1)}%)`,
          cashBalanceBefore: cashBalance,
          cashBalanceAfter: cashBalance - buyValue,
        });

        cashBalance -= buyValue;

        console.log(
          `📈 [BUY NET] ${change.ticker}: ${sharesToBuy} shares × R$ ${change.price.toFixed(
            2
          )} = R$ ${buyValue.toFixed(2)}`
        );
      } else {
        console.log(
          `⚠️ [INSUFFICIENT CASH] ${change.ticker}: Need R$ ${buyValue.toFixed(
            2
          )} but only R$ ${cashBalance.toFixed(2)} available`
        );
      }
    }

    // 💰 INVESTIR CAIXA RESTANTE: Se ainda há caixa significativo, consolidar com transações existentes
    if (cashBalance > 100) { // Só se houver mais de R$ 100 restantes
      console.log(`💵 [REMAINING CASH INVESTMENT] Distributing remaining R$ ${cashBalance.toFixed(2)}`);
      
      // Encontrar ativos que ainda podem receber investimento adicional
      const assetsForAdditionalInvestment = assets.filter(asset => {
        const currentAlloc = currentAllocations.get(asset.ticker) || 0;
        const targetAlloc = Number(asset.targetAllocation);
        return currentAlloc < targetAlloc; // Ainda subalocados
      });

      if (assetsForAdditionalInvestment.length > 0) {
        // Distribuir caixa restante proporcionalmente entre ativos subalocados
        for (const asset of assetsForAdditionalInvestment) {
          if (cashBalance <= 0) break;
          
          const price = prices.get(asset.ticker);
          if (!price) continue;
          
          const targetAlloc = Number(asset.targetAllocation);
          const proportionalCash = cashBalance * (targetAlloc / assetsForAdditionalInvestment.reduce((sum, a) => sum + Number(a.targetAllocation), 0));
          const additionalShares = Math.floor(proportionalCash / price);
          
          if (additionalShares >= 1) {
            const additionalValue = additionalShares * price;
            
            // 🔧 CONSOLIDAR: Verificar se já existe uma transação de compra para este ativo
            const existingBuyIndex = suggestions.findIndex(s => 
              s.type === "BUY_REBALANCE" && s.ticker === asset.ticker
            );
            
            if (existingBuyIndex >= 0) {
              // Consolidar com transação existente
              const existingSuggestion = suggestions[existingBuyIndex];
              const newQuantity = (existingSuggestion.quantity || 0) + additionalShares;
              const newAmount = (existingSuggestion.amount || 0) + additionalValue;
              
              suggestions[existingBuyIndex] = {
                ...existingSuggestion,
                amount: newAmount,
                quantity: newQuantity,
                reason: `Rebalanceamento: compra de ${newQuantity} ações (alocação atual ${(currentAllocations.get(asset.ticker) || 0) * 100}% → alvo ${targetAlloc * 100}%, inclui investimento de caixa restante)`,
                cashBalanceAfter: cashBalance - additionalValue,
              };
              
              console.log(`🔄 [CONSOLIDATED] ${asset.ticker}: Updated existing buy from ${existingSuggestion.quantity || 0} to ${newQuantity} shares (+${additionalShares} from remaining cash)`);
            } else {
              // Criar nova transação se não existir
              suggestions.push({
                date,
                type: "BUY_REBALANCE",
                ticker: asset.ticker,
                amount: additionalValue,
                price: price,
                quantity: additionalShares,
                reason: `Investimento de caixa restante: compra de ${additionalShares} ações adicionais`,
                cashBalanceBefore: cashBalance,
                cashBalanceAfter: cashBalance - additionalValue,
              });
              
              console.log(`💰 [ADDITIONAL INVESTMENT] ${asset.ticker}: +${additionalShares} shares (R$ ${additionalValue.toFixed(2)})`);
            }
            
            cashBalance -= additionalValue;
          }
        }
      }
    }

    // Summary
    const sells = suggestions.filter((s) => s.type === "SELL_REBALANCE");
    const buys = suggestions.filter((s) => s.type === "BUY_REBALANCE");
    const totalSold = sells.reduce((sum, s) => sum + s.amount, 0);
    const totalBought = buys.reduce((sum, s) => sum + s.amount, 0);

    console.log(`✅ [NET REBALANCING SUMMARY]:`, {
      sells: sells.length,
      buys: buys.length,
      totalSold: totalSold.toFixed(2),
      totalBought: totalBought.toFixed(2),
      remainingCash: cashBalance.toFixed(2),
      netCashChange: (totalSold - totalBought).toFixed(2),
      cashUtilization: `${(((availableCash - cashBalance) / availableCash) * 100).toFixed(1)}%`,
    });

    // Validate: no asset should appear in both sell and buy
    const sellTickers = new Set(sells.map(s => s.ticker));
    const buyTickers = new Set(buys.map(s => s.ticker));
    const overlap = [...sellTickers].filter(ticker => buyTickers.has(ticker));
    
    if (overlap.length > 0) {
      console.error(`🚨 [LOGIC ERROR] Assets appear in both sell and buy:`, overlap);
    } else {
      console.log(`✅ [VALIDATION] No asset appears in both sell and buy operations`);
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

    // For other transaction types, check exact match including quantity/amount
    // This allows multiple transactions of same asset on same day with different quantities
    const whereCondition: any = {
      portfolioId,
      date: suggestion.date,
      type: suggestion.type,
      ticker: suggestion.ticker,
      status: { in: ["PENDING", "CONFIRMED", "REJECTED"] },
      isAutoSuggested: true,
    };

    // For BUY/SELL transactions, also match quantity to allow multiple purchases with different amounts
    if (
      suggestion.type === "BUY" ||
      suggestion.type === "SELL_REBALANCE" ||
      suggestion.type === "BUY_REBALANCE" ||
      suggestion.type === "SELL_WITHDRAWAL"
    ) {
      if (suggestion.quantity !== undefined) {
        whereCondition.quantity = suggestion.quantity;
      }
    } else {
      // For other transactions (CASH_CREDIT, CASH_DEBIT), match amount
      whereCondition.amount = suggestion.amount;
    }

    const existingTransaction = await prisma.portfolioTransaction.findFirst({
      where: whereCondition,
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

    // Update lastSuggestionsGeneratedAt when creating pending transactions
    if (createdCount > 0) {
      await prisma.portfolioConfig.update({
        where: { id: portfolioId },
        data: { lastSuggestionsGeneratedAt: new Date() },
      });
    }

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

    // Validate ticker if provided (for BUY, SELL, DIVIDEND transactions)
    if (input.ticker && (input.type === 'BUY' || input.type === 'BUY_REBALANCE' || 
        input.type === 'SELL_REBALANCE' || input.type === 'SELL_WITHDRAWAL' || 
        input.type === 'DIVIDEND')) {
      try {
        const { validateTicker } = await import('./quote-service');
        await validateTicker(input.ticker);
      } catch (error) {
        throw new Error(`Invalid ticker: ${input.ticker} not found`);
      }
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

    // Validate ticker if provided (for BUY, SELL, DIVIDEND transactions)
    if (input.ticker && (input.type === 'BUY' || input.type === 'BUY_REBALANCE' || 
        input.type === 'SELL_REBALANCE' || input.type === 'SELL_WITHDRAWAL' || 
        input.type === 'DIVIDEND')) {
      try {
        const { validateTicker } = await import('./quote-service');
        await validateTicker(input.ticker);
      } catch (error) {
        throw new Error(`Invalid ticker: ${input.ticker} not found`);
      }
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
