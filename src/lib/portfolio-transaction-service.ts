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
            quantity: true,
          },
        }),
      ]);

    const fetchTime = Date.now() - startTime;
    console.log(
      `⚡ [PERFORMANCE] Data fetched in ${fetchTime}ms (parallelized)`
    );

    // Create a Set of existing transactions for fast lookup
    // Include PENDING, CONFIRMED, and REJECTED to avoid re-suggesting
    // Include amount/quantity in key to allow multiple transactions of same asset on same day
    const existingTransactionKeys = new Set(
      existingTransactions.map((tx) => {
        const dateStr = tx.date.toISOString().split("T")[0];
        const ticker = tx.ticker || "null";
        const amount = Number(tx.amount).toFixed(2);
        const quantity = tx.quantity ? Number(tx.quantity).toFixed(6) : "null";

        // For BUY/SELL transactions, include quantity in key to allow multiple purchases
        // For other transactions (DEPOSIT, DIVIDEND), include amount
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
        assets:
          portfolio.assets?.map(
            (a: any) =>
              `${a.ticker}: ${(Number(a.targetAllocation) * 100).toFixed(1)}%`
          ) || [],
        holdingsCount: holdings.size,
        holdings: Array.from(holdings.entries()).map(
          ([ticker, holding]) =>
            `${ticker}: ${
              holding.quantity
            } shares (R$ ${holding.totalInvested.toFixed(2)} invested)`
        ),
        pricesCount: prices.size,
        prices: Array.from(prices.entries()).map(
          ([ticker, price]) => `${ticker}: R$ ${price.toFixed(2)}`
        ),
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
      const dateStr = suggestion.date.toISOString().split("T")[0];
      const ticker = suggestion.ticker || "null";
      const amount = suggestion.amount.toFixed(2);
      const quantity = suggestion.quantity
        ? suggestion.quantity.toFixed(6)
        : "null";

      // Create key using same logic as existing transactions
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

      // Check for exact match (any status)
      if (existingTransactionKeys.has(key)) {
        console.log(
          `⏩ [SKIP DUPLICATE] ${suggestion.type} ${
            suggestion.ticker || ""
          } on ${dateStr} (${
            suggestion.type === "BUY" ||
            suggestion.type === "SELL_REBALANCE" ||
            suggestion.type === "BUY_REBALANCE" ||
            suggestion.type === "SELL_WITHDRAWAL"
              ? `qty: ${quantity}`
              : `amt: R$ ${amount}`
          }) already exists`
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
      note: "Alocações calculadas sobre holdings apenas (sem caixa)",
    });

    if (portfolioValueForAllocation === 0) {
      console.log(
        "⚠️ [REBALANCING] Portfolio value is 0, no rebalancing needed"
      );
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

      // 🔧 CORREÇÃO: Thresholds adaptativos baseados no tamanho da alocação
      // Para alocações pequenas, usar threshold relativo; para grandes, usar absoluto
      // ESPECIAL: Se meta é 0%, qualquer posição precisa ser vendida
      const adaptiveAbsoluteThreshold = Math.max(0.02, targetAlloc * 0.3); // Mínimo 2%, máximo 30% da alocação
      const relativeThreshold = 0.25; // 25% de desvio relativo
      
      // Special case: if target is 0% and we have any position, always needs rebalancing
      const needsRebalancing = targetAlloc === 0 
        ? currentAlloc > 0 
        : (absoluteDiff > adaptiveAbsoluteThreshold || relativeDeviation > relativeThreshold);

      console.log(`🔍 [DEVIATION ANALYSIS] ${asset.ticker}:`, {
        current: `${(currentAlloc * 100).toFixed(2)}%`,
        target: `${(targetAlloc * 100).toFixed(2)}%`,
        diff: `${diff > 0 ? "+" : ""}${(diff * 100).toFixed(2)}%`,
        absoluteDiff: `${(absoluteDiff * 100).toFixed(2)}%`,
        relativeDeviation: `${(relativeDeviation * 100).toFixed(1)}%`,
        adaptiveThreshold: `${(adaptiveAbsoluteThreshold * 100).toFixed(2)}%`,
        needsRebalancing,
      });

      if (needsRebalancing) {
        deviations.push({
          ticker: asset.ticker,
          current: currentAlloc,
          target: targetAlloc,
          diff,
        });

        console.log(
          `⚖️ [NEEDS REBALANCING] ${asset.ticker}: ${(
            currentAlloc * 100
          ).toFixed(2)}% → ${(targetAlloc * 100).toFixed(2)}%`
        );
      } else {
        console.log(`✅ [BALANCED] ${asset.ticker}: Within acceptable range`);
      }
    }

    // 🚨 CRÍTICO: Detectar ativos NÃO CONFIGURADOS na alocação
    const configuredTickers = new Set(
      portfolio.assets.map((asset: any) => asset.ticker)
    );
    const unconfiguredAssets: Array<{
      ticker: string;
      current: number;
      shouldSell: boolean;
    }> = [];

    for (const [ticker, holding] of holdings) {
      if (!configuredTickers.has(ticker) && holding.quantity > 0) {
        const currentValue = holding.quantity * (prices.get(ticker) || 0);
        const currentAlloc =
          portfolioValueForAllocation > 0
            ? currentValue / portfolioValueForAllocation
            : 0;

        unconfiguredAssets.push({
          ticker,
          current: currentAlloc,
          shouldSell: true,
        });

        console.log(
          `🚨 [UNCONFIGURED ASSET] ${ticker}: ${(currentAlloc * 100).toFixed(
            2
          )}% (R$ ${currentValue.toFixed(2)}) - NOT in allocation config`
        );
      }
    }

    const totalPortfolioValue = holdingsValue + currentCash;
    const cashPercentage =
      totalPortfolioValue > 0 ? currentCash / totalPortfolioValue : 0;

    console.log(
      `💰 [CASH ANALYSIS] Available cash: R$ ${currentCash.toFixed(2)} (${(
        cashPercentage * 100
      ).toFixed(1)}% of portfolio)`
    );

    // Determinar se precisa de rebalanceamento
    const needsRebalancing =
      deviations.length > 0 ||
      unconfiguredAssets.length > 0 ||
      cashPercentage > 0.05;

    if (!needsRebalancing) {
      console.log("✅ Portfolio is balanced, no rebalancing needed");
      return [];
    }

    console.log("⚖️ Portfolio needs rebalancing:");

    if (deviations.length > 0) {
      console.log(
        "📊 Configured assets deviations:",
        deviations.map(
          (d) =>
            `${d.ticker}: ${(d.current * 100).toFixed(2)}% vs ${(
              d.target * 100
            ).toFixed(2)}% (${d.diff > 0 ? "+" : ""}${(d.diff * 100).toFixed(
              2
            )}%)`
        )
      );
    }

    if (unconfiguredAssets.length > 0) {
      console.log(
        "🚨 Unconfigured assets to sell:",
        unconfiguredAssets.map(
          (a) => `${a.ticker}: ${(a.current * 100).toFixed(2)}%`
        )
      );
    }

    if (cashPercentage > 0.05) {
      console.log(
        `💰 Significant cash to invest: ${(cashPercentage * 100).toFixed(1)}%`
      );
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
          type: "SELL_WITHDRAWAL",
          ticker: unconfiguredAsset.ticker,
          amount: sellValue,
          price: price,
          quantity: holding.quantity,
          reason: `Venda de ${
            unconfiguredAsset.ticker
          }: ativo não está configurado na alocação da carteira (${(
            unconfiguredAsset.current * 100
          ).toFixed(1)}% atual)`,
          cashBalanceBefore: availableCash,
          cashBalanceAfter: availableCash + sellValue,
        });

        availableCash += sellValue;
        console.log(
          `💸 [SELL UNCONFIGURED] ${unconfiguredAsset.ticker}: ${
            holding.quantity
          } shares × R$ ${price.toFixed(2)} = R$ ${sellValue.toFixed(2)}`
        );
      }
    }

    // 🎯 PASSO 2 & 3: Rebalanceamento completo (vendas + compras)
    // Se há desvios de alocação OU caixa disponível, fazer rebalanceamento
    if (deviations.length > 0 || availableCash > 0) {
      console.log(`💰 [REBALANCING] Starting rebalancing with:`, {
        availableCash: availableCash.toFixed(2),
        portfolioValueForAllocation: portfolioValueForAllocation.toFixed(2),
        deviationsCount: deviations.length,
        assetsCount: portfolio.assets.length,
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

      console.log(
        `✅ [REBALANCING] Generated ${rebalanceSuggestions.length} suggestions`
      );
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
            
            if (existing.status === 'REJECTED') {
              shouldSkip = true;
              skipReason = `Previously rejected by user`;
            } else if (existing.status === 'CONFIRMED' || existing.status === 'EXECUTED') {
              shouldSkip = true;
              skipReason = `Already processed (${existing.status})`;
            } else if (existing.status === 'PENDING') {
              shouldSkip = true;
              skipReason = `Already pending`;
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
