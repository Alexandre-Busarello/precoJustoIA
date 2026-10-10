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
import { formatBRL, formatNumber, formatPct } from "./format";
import { formatDateOnly } from "@/app/radar-dividendos/dividend-months";
import {
  dividendTypeLabel,
  irrfRate,
  isSameDividend,
  netPerShare,
  positionAtExDate,
  type ExistingDividendTransaction,
  type PositionTrade,
} from "@/app/agenda-proventos/agenda-model";
import { loadAssetContexts } from "@/lib/allocation/load-context";
import { runAllocation } from "@/lib/allocation/engine";
import { DEFAULT_ALLOCATION_OPTIONS, getPreset } from "@/lib/allocation/constants";
import type { AssetContext } from "@/lib/allocation/types";
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
  // Campos opcionais para análise técnica
  fairPrice?: number; // Preço justo técnico (aiFairEntryPrice)
  isAttractivePrice?: boolean; // Se preço está abaixo/igual ao justo
  priceVsFairPrice?: number; // Percentual de diferença (negativo = abaixo, positivo = acima)
  // ID da transação se for uma transação PENDING existente (para permitir rejeição)
  transactionId?: string;
}

export interface CombinedRebalancingSuggestion {
  date: Date;
  type: 'REBALANCING_COMBINED';
  sellTransaction: {
    ticker?: string;
    amount: number;
    price?: number;
    quantity?: number;
    reason?: string;
  } | null;
  sellTransactions?: SuggestedTransaction[]; // All individual sell transactions
  buyTransactions: SuggestedTransaction[];
  totalSold: number;
  totalBought: number;
  netCashChange: number;
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );
    startOfCurrentMonth.setHours(0, 0, 0, 0);

    const [holdings, prices, nextDates, existingTransactions, rejectedTransactions, pendingMonthlyContributions, cashBalance] =
      await Promise.all([
        this.getCurrentHoldings(portfolioId),
        this.getLatestPrices(portfolio.assets.map((a) => a.ticker)),
        this.calculateNextTransactionDates(portfolioId),
        prisma.portfolioTransaction.findMany({
          where: {
            portfolioId,
            status: { in: ["CONFIRMED", "EXECUTED"] },
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
        // Also fetch REJECTED transactions to check if monthly contribution was rejected this month
        prisma.portfolioTransaction.findMany({
          where: {
            portfolioId,
            status: "REJECTED",
            type: "MONTHLY_CONTRIBUTION",
            date: {
              gte: startOfCurrentMonth,
            },
          },
          select: {
            date: true,
            type: true,
            status: true,
          },
        }),
        // Fetch PENDING MONTHLY_CONTRIBUTION transactions to include in suggestions
        prisma.portfolioTransaction.findMany({
          where: {
            portfolioId,
            status: "PENDING",
            type: "MONTHLY_CONTRIBUTION",
            date: {
              gte: startOfCurrentMonth,
            },
          },
          select: {
            id: true,
            date: true,
            type: true,
            amount: true,
            cashBalanceBefore: true,
            cashBalanceAfter: true,
            notes: true,
          },
        }),
        this.getCurrentCashBalance(portfolioId),
      ]);

    const suggestions: SuggestedTransaction[] = [];

    // First, add existing PENDING MONTHLY_CONTRIBUTION transactions to suggestions
    // These need to be shown so user can confirm or reject them
    if (pendingMonthlyContributions.length > 0) {
      console.log(`📋 [PENDING_EXISTING] Found ${pendingMonthlyContributions.length} PENDING MONTHLY_CONTRIBUTION transaction(s), including in suggestions`);
      for (const pendingTx of pendingMonthlyContributions) {
        suggestions.push({
          date: pendingTx.date,
          type: "MONTHLY_CONTRIBUTION" as TransactionType,
          amount: Number(pendingTx.amount),
          reason: pendingTx.notes || `Aporte mensal de R$ ${Number(pendingTx.amount).toFixed(2)}`,
          cashBalanceBefore: Number(pendingTx.cashBalanceBefore),
          cashBalanceAfter: Number(pendingTx.cashBalanceAfter),
          // Include transaction ID so we can reject/confirm it
          transactionId: pendingTx.id,
        } as SuggestedTransaction & { transactionId?: string });
      }
    }

    // Compras registradas pelo "Onde aportar" (PENDENTES, criadas pelo usuário): aparecem para confirmar ou descartar,
    // e o valor reservado por elas não entra de novo nas compras sugeridas abaixo.
    const pendingOndeAportar = await prisma.portfolioTransaction.findMany({
      where: {
        portfolioId,
        status: "PENDING",
        isAutoSuggested: false,
        type: { in: ["CASH_CREDIT", "BUY"] },
        notes: { startsWith: "Onde aportar" },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
    for (const tx of pendingOndeAportar) {
      suggestions.push({
        date: tx.date,
        type: tx.type,
        ticker: tx.ticker ?? undefined,
        amount: Number(tx.amount),
        price: tx.price !== null ? Number(tx.price) : undefined,
        quantity: tx.quantity !== null ? Number(tx.quantity) : undefined,
        reason: tx.notes ?? "Onde aportar",
        cashBalanceBefore: Number(tx.cashBalanceBefore),
        cashBalanceAfter: Number(tx.cashBalanceAfter),
        transactionId: tx.id,
      });
    }
    const reservedByOndeAportar = Math.max(
      0,
      pendingOndeAportar.reduce((sum, tx) => sum + (tx.type === "BUY" ? Number(tx.amount) : -Number(tx.amount)), 0)
    );

    // Check if there's a monthly contribution already executed/confirmed in current month
    // Only MONTHLY_CONTRIBUTION is considered as monthly contribution (not CASH_CREDIT)
    const currentMonthContribution = existingTransactions.find(
      (tx) =>
        (tx.type as string) === "MONTHLY_CONTRIBUTION" &&
        new Date(tx.date).getTime() >= startOfCurrentMonth.getTime() &&
        (tx.status === "CONFIRMED" || tx.status === "EXECUTED")
    );

    // Check if there's a REJECTED monthly contribution in current month
    // If rejected, don't suggest again for the same month (only when month changes)
    // Only MONTHLY_CONTRIBUTION is considered as monthly contribution (not CASH_CREDIT)
    const currentMonthRejectedContribution = rejectedTransactions.length > 0 
      ? rejectedTransactions[0] 
      : null;

    console.log(
      `📅 [CHECK_CONTRIBUTION] Current month contribution check:`,
      currentMonthContribution
        ? `Found ${currentMonthContribution.type} with status ${currentMonthContribution.status}`
        : currentMonthRejectedContribution
        ? `Found REJECTED ${currentMonthRejectedContribution.type} - will not suggest again this month`
        : 'No contribution found in current month'
    );

    // Monthly contribution is "decided" if it's CONFIRMED, EXECUTED, or REJECTED
    // REJECTED means user explicitly rejected it, so don't suggest again this month
    const monthlyContributionDecided = !!currentMonthContribution || !!currentMonthRejectedContribution;

    // Always generate buy suggestions when there's cash available (from sales or contributions)
    // This ensures that any cash in the account gets investment suggestions

    // 1. Generate monthly contribution suggestions FIRST (if not already decided and monthlyContribution > 0)
    // Only suggest if monthlyContribution is configured and greater than 0
    const monthlyContributionAmount = Number(portfolio.monthlyContribution);
    
    console.log(
      `📅 [SUGGESTION_LOGIC] nextDates.length=${nextDates.length}, monthlyContributionDecided=${monthlyContributionDecided}, monthlyContributionAmount=${monthlyContributionAmount}, cashBalance=${cashBalance.toFixed(2)}, portfolioAssets=${portfolio.assets?.length || 0}, holdings=${holdings.size}, prices=${prices.size}`
    );
    console.log(
      `📅 [SUGGESTION_LOGIC] Conditions check: nextDates.length > 0 = ${nextDates.length > 0}, !monthlyContributionDecided = ${!monthlyContributionDecided}, monthlyContributionAmount > 0 = ${monthlyContributionAmount > 0}`
    );
    
    if (nextDates.length > 0 && !monthlyContributionDecided && monthlyContributionAmount > 0) {
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
          amount: monthlyContributionAmount,
          reason: `Aporte mensal de R$ ${monthlyContributionAmount.toFixed(2)}`,
          cashBalanceBefore: runningCashBalance,
          cashBalanceAfter: runningCashBalance + monthlyContributionAmount,
        };
        
        console.log(`📝 [SUGGESTION] Creating MONTHLY_CONTRIBUTION suggestion:`, {
          date: date.toISOString().split("T")[0],
          amount: suggestion.amount,
          cashBalanceBefore: suggestion.cashBalanceBefore,
          cashBalanceAfter: suggestion.cashBalanceAfter
        });
        
        suggestions.push(suggestion);
        
        // Update running balance for next iteration
        runningCashBalance += monthlyContributionAmount;
      }
      
      console.log(`📊 [BEFORE_FILTER] Created ${suggestions.length} monthly contribution suggestions before deduplication`);
      console.log(`📊 [BEFORE_FILTER] Suggestions details:`, suggestions.map(s => ({
        date: s.date.toISOString().split("T")[0],
        type: s.type,
        amount: s.amount,
        ticker: s.ticker || 'null'
      })));
      console.log(`📊 [BEFORE_FILTER] Existing transactions count: ${existingTransactions.length}`);
      console.log(`📊 [BEFORE_FILTER] Existing transactions types:`, [...new Set(existingTransactions.map(tx => tx.type))]);
      
      // Filter monthly contribution suggestions (but don't return yet - we'll generate buys too)
      const monthlyContribSuggestions = suggestions.slice(); // Copy array
      const filteredMonthlyContributions = this.filterDuplicateSuggestions(
        monthlyContribSuggestions,
        existingTransactions
      );
      
      console.log(
        `✅ [MONTHLY_CONTRIBUTIONS] ${filteredMonthlyContributions.length} monthly contribution suggestions after deduplication (filtered out ${monthlyContribSuggestions.length - filteredMonthlyContributions.length})`
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
          monthlyContributionAmount,
          reason: nextDates.length === 0 
            ? 'No dates returned from calculateNextTransactionDates' 
            : monthlyContributionAmount === 0
            ? 'Monthly contribution is 0 (not configured)'
            : 'Monthly contribution already decided'
        }
      );
    }

    // 2. ALWAYS generate buy suggestions when there's cash available (from sales or contributions)
    // This ensures that any cash in the account gets investment suggestions
    console.log(`🔍 [BUY_LOGIC_CHECK] Checking conditions:`, {
      cashBalance: cashBalance.toFixed(2),
      cashBalanceCheck: cashBalance >= 100,
      monthlyContributionDecided,
      nextDatesLength: nextDates.length,
      shouldGenerateBuys: cashBalance >= 100
    });

    const cashForBuys = cashBalance - reservedByOndeAportar;
    const shouldGenerateBuys = cashForBuys >= 100; // Always generate buys if cash >= R$ 100

    if (shouldGenerateBuys) {
      const reason = monthlyContributionDecided 
        ? 'monthly contribution already executed - investing available cash' 
        : nextDates.length > 0 
          ? 'monthly contribution pending but investing available cash anyway'
          : 'no monthly contribution pending - investing available cash';
      console.log(
        `💵 [CASH AVAILABLE] R$ ${cashBalance.toFixed(2)} available for investment (${reason})`
      );

      console.log(`📊 [BEFORE_BUY_GEN] Portfolio assets: ${portfolio.assets?.length || 0}, Holdings: ${holdings.size}, Prices: ${prices.size}`);
      
      const buySuggestions = await this.generateBuyTransactionsForCash(
        portfolio,
        cashForBuys,
        holdings,
        prices
      );
      
      console.log(`💰 [BUY_SUGGESTIONS] Generated ${buySuggestions.length} buy suggestions`);
      if (buySuggestions.length === 0) {
        console.log(`⚠️ [NO_BUY_SUGGESTIONS] No buy suggestions generated despite cash available. Check: assets count, prices availability, allocations`);
      }
      
      suggestions.push(...buySuggestions);
    } else {
      if (cashBalance < 100) {
        console.log(`⏸️ [NO_CASH] Insufficient cash for buy suggestions (R$ ${cashBalance.toFixed(2)}, minimum R$ 100.00)`);
      } else {
        console.log(`⏸️ [BUY_NOT_GENERATED] Unexpected condition:`, {
          cashBalance: cashBalance.toFixed(2),
          monthlyContributionDecided,
          nextDatesLength: nextDates.length
        });
      }
    }

    // Filter duplicates (only filters against CONFIRMED/EXECUTED, not PENDING)
    console.log(`🔍 [BEFORE_FILTER] ${suggestions.length} suggestions before deduplication (including ${pendingMonthlyContributions.length} PENDING transactions)`);
    const filteredSuggestions = this.filterDuplicateSuggestions(
      suggestions,
      existingTransactions
    );
    console.log(`🔍 [AFTER_FILTER] ${filteredSuggestions.length} suggestions after deduplication`);
    
    // Log if PENDING transactions were filtered out (they shouldn't be)
    const pendingCountAfterFilter = filteredSuggestions.filter(s => s.type === "MONTHLY_CONTRIBUTION").length;
    if (pendingMonthlyContributions.length > 0 && pendingCountAfterFilter === 0) {
      console.warn(`⚠️ [FILTER_WARNING] All PENDING MONTHLY_CONTRIBUTION transactions were filtered out! This shouldn't happen.`);
    }
    
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
      shouldGenerateBuys: cashBalance >= 100,
      portfolioAssets: portfolio.assets?.length || 0,
      holdingsCount: holdings.size,
      pricesCount: prices.size,
      suggestionsBeforeFilter: suggestions.length,
      suggestionsAfterFilter: filteredSuggestions.length,
      currentMonthContribution: currentMonthContribution ? {
        type: currentMonthContribution.type,
        status: currentMonthContribution.status,
        date: currentMonthContribution.date instanceof Date 
          ? currentMonthContribution.date.toISOString().split("T")[0]
          : new Date(currentMonthContribution.date).toISOString().split("T")[0]
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
    // Note: We no longer check for PENDING transactions since suggestions are dynamic
    const [holdings, prices] = await Promise.all([
      this.getCurrentHoldings(portfolioId),
      this.getLatestPrices(portfolio.assets.map((a) => a.ticker)),
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

    // Note: No longer filtering duplicates against PENDING transactions
    // Suggestions are now dynamic and calculated on-demand

    const totalTime = Date.now() - startTime;
    console.log(
      `✅ [REBALANCING SUGGESTIONS] ${rebalanceSuggestions.length} suggestions generated (${totalTime}ms)`
    );

    return rebalanceSuggestions;
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
   * Compras para o caixa disponível com o motor do "Onde aportar" no modo "Seguir meus pesos-alvo" (pesos-alvo +
   * desconto vs. valor estimado + qualidade): só ativos abaixo do alvo, sem passar dele, em quantidades inteiras.
   * Os dados de valuation vêm do mesmo caminho da página do ativo; sem eles, a prioridade é só a distância até o alvo.
   * O formato de `SuggestedTransaction` não mudou (as sugestões PENDENTES antigas continuam carregando).
   */
  private static async generateBuyTransactionsForCash(
    portfolio: { assets: { ticker: string; targetAllocation: unknown }[] },
    availableCash: number,
    holdings: Map<string, { quantity: number; totalInvested: number }>,
    prices: Map<string, number>
  ): Promise<SuggestedTransaction[]> {
    const targets = new Map(portfolio.assets.map((a) => [a.ticker.toUpperCase(), Number(a.targetAllocation)]));
    const heldTickers = [...holdings.entries()].filter(([, h]) => h.quantity > 0).map(([ticker]) => ticker.toUpperCase());
    const tickers = [...new Set([...targets.keys(), ...heldTickers])].filter((ticker) => (prices.get(ticker) ?? 0) > 0);
    if (tickers.length === 0 || availableCash <= 0) return [];

    let contexts = new Map<string, AssetContext>();
    try {
      const loaded = await loadAssetContexts(tickers);
      contexts = new Map(loaded.contexts.map((c) => [c.ticker, c]));
    } catch (error) {
      console.error("[GENERATE_BUY] Falha ao carregar valuation; seguindo só pelos pesos-alvo:", error);
    }

    const assets: AssetContext[] = tickers.map((ticker) => {
      const price = prices.get(ticker) as number;
      const quantity = holdings.get(ticker)?.quantity ?? 0;
      const base: AssetContext = contexts.get(ticker) ?? {
        ticker,
        name: ticker,
        assetType: "stock",
        sector: null,
        price,
        fairValues: {},
        qualityScore: null,
        coverage: null,
        liquidity: null,
        fundamentals: { intact: null },
      };
      // A cotação da carteira prevalece; a margem é recalculada a partir dela (sem a margem pronta do modelo).
      return {
        ...base,
        price,
        margins: {},
        holding: quantity > 0 ? { quantity, value: quantity * price } : null,
        targetWeight: targets.get(ticker) ?? 0,
      };
    });

    const result = runAllocation({
      amount: Math.floor(availableCash * 100) / 100,
      assets,
      options: {
        ...DEFAULT_ALLOCATION_OPTIONS,
        weights: getPreset("pesos").weights,
        respectTargets: true,
        // Os pesos-alvo do usuário já são os limites: sem teto extra por ativo ou concentração.
        maxPerAssetPct: 1,
        maxPortfolioPct: 1,
        strictData: false,
      },
      meta: { dataDate: null, macro: { selic: null, ke: null } },
    });

    const today = new Date();
    let running = availableCash;
    return result.allocations.map((row) => {
      const before = running;
      running -= row.value;
      return {
        date: today,
        type: "BUY" as TransactionType,
        ticker: row.ticker,
        amount: row.value,
        price: row.price,
        quantity: row.qty,
        reason: row.reasons.join(" · "),
        cashBalanceBefore: before,
        cashBalanceAfter: running,
        isAttractivePrice: (row.components.discount ?? 0) > 0 || undefined,
      };
    });
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
    console.log(`📅 [CALC_DATES] Searching for MONTHLY_CONTRIBUTION transactions from ${startOfCurrentMonth.toISOString().split("T")[0]} onwards`);

    // Check if there's already a PENDING MONTHLY_CONTRIBUTION transaction in the current month
    // PENDING transactions prevent suggesting (user hasn't decided yet)
    // Only MONTHLY_CONTRIBUTION is considered as monthly contribution (not CASH_CREDIT)
    const currentMonthPendingTransaction = await prisma.portfolioTransaction.findFirst({
      where: {
        portfolioId,
        status: "PENDING",
        type: "MONTHLY_CONTRIBUTION",
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

    // Check if there's a REJECTED MONTHLY_CONTRIBUTION transaction in the current month
    // REJECTED transactions prevent suggesting again in the same month (only when month changes)
    // Only MONTHLY_CONTRIBUTION is considered as monthly contribution (not CASH_CREDIT)
    const currentMonthRejectedTransaction = await prisma.portfolioTransaction.findFirst({
      where: {
        portfolioId,
        status: "REJECTED",
        type: "MONTHLY_CONTRIBUTION",
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

    // Check if there's a CONFIRMED or EXECUTED MONTHLY_CONTRIBUTION transaction in the current month
    // If already confirmed/executed, don't suggest again
    const currentMonthConfirmedTransaction = await prisma.portfolioTransaction.findFirst({
      where: {
        portfolioId,
        status: { in: ["CONFIRMED", "EXECUTED"] },
        type: "MONTHLY_CONTRIBUTION",
        date: {
          gte: startOfCurrentMonth,
        },
      },
      select: {
        date: true,
        status: true,
        type: true,
      },
    });

    console.log(
      `📅 [CHECK_MONTH] Current month transaction check:`,
      currentMonthPendingTransaction 
        ? `Found PENDING ${currentMonthPendingTransaction.type} on ${currentMonthPendingTransaction.date.toISOString().split("T")[0]}`
        : currentMonthRejectedTransaction
        ? `Found REJECTED ${currentMonthRejectedTransaction.type} on ${currentMonthRejectedTransaction.date.toISOString().split("T")[0]} - will not suggest again this month`
        : currentMonthConfirmedTransaction
        ? `Found ${currentMonthConfirmedTransaction.status} ${currentMonthConfirmedTransaction.type} on ${currentMonthConfirmedTransaction.date.toISOString().split("T")[0]} - already executed`
        : 'No MONTHLY_CONTRIBUTION transaction found in current month - will suggest'
    );

    // If there's a PENDING transaction, don't suggest again (user hasn't decided yet)
    if (currentMonthPendingTransaction) {
      console.log(
        `⏸️ [PENDING_EXISTS] PENDING contribution already exists for current month, not suggesting again`
      );
      return dates; // Return empty array - don't suggest
    }

    // If there's a REJECTED transaction, don't suggest again in the same month
    // APORTE MENSAL is the only suggestion that can be rejected, and if rejected, 
    // it should not be suggested again until the month changes
    if (currentMonthRejectedTransaction) {
      console.log(
        `⏸️ [REJECTED_EXISTS] REJECTED contribution already exists for current month, not suggesting again (will suggest again next month)`
      );
      return dates; // Return empty array - don't suggest
    }

    // If there's a CONFIRMED or EXECUTED transaction, don't suggest again (already done)
    if (currentMonthConfirmedTransaction) {
      console.log(
        `⏸️ [CONFIRMED_EXISTS] ${currentMonthConfirmedTransaction.status} contribution already exists for current month, not suggesting again`
      );
      return dates; // Return empty array - don't suggest
    }

    // If no PENDING or REJECTED transaction exists in current month, suggest for first day of current month
    // This ensures we always suggest the monthly contribution for the current month
    dates.push(new Date(startOfCurrentMonth));
    console.log(
      `📅 [SUGGEST] No PENDING or REJECTED contribution in current month (${startOfCurrentMonth.toISOString().split("T")[0]}), suggesting for first day of month. Returning ${dates.length} date(s)`
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [existingTransactions, pendingDividendTransactions] = await Promise.all([
      prisma.portfolioTransaction.findMany({
        where: {
          portfolioId,
          status: { in: ["CONFIRMED", "EXECUTED"] },
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
      // Fetch PENDING DIVIDEND transactions to include in suggestions
      // Include ALL PENDING dividends regardless of date (user needs to confirm/reject them)
      prisma.portfolioTransaction.findMany({
        where: {
          portfolioId,
          status: "PENDING",
          type: "DIVIDEND",
        },
        select: {
          id: true,
          date: true,
          type: true,
          ticker: true,
          amount: true,
          quantity: true,
          price: true,
          cashBalanceBefore: true,
          cashBalanceAfter: true,
          notes: true,
        },
        orderBy: {
          date: 'desc', // Most recent first
        },
      }),
    ]);

    const suggestions: SuggestedTransaction[] = [];

    // First, add existing PENDING DIVIDEND transactions to suggestions
    // These need to be shown so user can confirm or reject them
    if (pendingDividendTransactions.length > 0) {
      console.log(`📋 [PENDING_EXISTING] Found ${pendingDividendTransactions.length} PENDING DIVIDEND transaction(s), including in suggestions`);
      for (const pendingTx of pendingDividendTransactions) {
        suggestions.push({
          date: pendingTx.date,
          type: "DIVIDEND" as TransactionType,
          ticker: pendingTx.ticker || undefined,
          amount: Number(pendingTx.amount),
          price: pendingTx.price ? Number(pendingTx.price) : undefined,
          quantity: pendingTx.quantity ? Number(pendingTx.quantity) : undefined,
          reason: pendingTx.notes || `Dividendo de ${pendingTx.ticker || 'ativo'}`,
          cashBalanceBefore: Number(pendingTx.cashBalanceBefore),
          cashBalanceAfter: Number(pendingTx.cashBalanceAfter),
          // Include transaction ID so we can reject/confirm it
          transactionId: pendingTx.id,
        } as SuggestedTransaction & { transactionId?: string });
      }
    }

    // Generate new dividend suggestions
    const generatedSuggestions = await this.generateDividendSuggestions(portfolioId);

    // Filter duplicates against CONFIRMED/EXECUTED transactions
    const filteredAgainstConfirmed = this.filterDuplicateSuggestions(
      generatedSuggestions,
      existingTransactions
    );

    // Also filter against PENDING transactions to avoid creating duplicates
    // Convert PENDING transactions to the same format for filtering (matching existingTransactions format)
    const pendingTransactionsForFilter = pendingDividendTransactions.map(tx => ({
      date: tx.date instanceof Date ? tx.date : new Date(tx.date),
      type: tx.type,
      ticker: tx.ticker,
      status: 'PENDING' as const,
      amount: Number(tx.amount),
      quantity: tx.quantity ? Number(tx.quantity) : null,
    }));

    const filteredGeneratedSuggestions = this.filterDuplicateSuggestions(
      filteredAgainstConfirmed,
      pendingTransactionsForFilter
    );

    // Create PENDING transactions for new dividend suggestions (so they can be confirmed/rejected)
    // createPendingTransactions will check for duplicates again, so it's safe
    if (filteredGeneratedSuggestions.length > 0) {
      console.log(`📝 [DIVIDEND_PENDING] Creating ${filteredGeneratedSuggestions.length} PENDING transactions for new dividend suggestions`);
      const createdTransactionIds = await this.createPendingTransactions(
        portfolioId,
        userId,
        filteredGeneratedSuggestions
      );
      
      // Fetch the created PENDING transactions to include transactionId in suggestions
      if (createdTransactionIds.length > 0) {
        const createdPendingTransactions = await prisma.portfolioTransaction.findMany({
          where: {
            id: { in: createdTransactionIds },
          },
          select: {
            id: true,
            date: true,
            type: true,
            ticker: true,
            amount: true,
            quantity: true,
            price: true,
            cashBalanceBefore: true,
            cashBalanceAfter: true,
            notes: true,
          },
        });

        // Add created PENDING transactions to suggestions with transactionId
        for (const pendingTx of createdPendingTransactions) {
          suggestions.push({
            date: pendingTx.date,
            type: "DIVIDEND" as TransactionType,
            ticker: pendingTx.ticker || undefined,
            amount: Number(pendingTx.amount),
            price: pendingTx.price ? Number(pendingTx.price) : undefined,
            quantity: pendingTx.quantity ? Number(pendingTx.quantity) : undefined,
            reason: pendingTx.notes || `Dividendo de ${pendingTx.ticker || 'ativo'}`,
            cashBalanceBefore: Number(pendingTx.cashBalanceBefore),
            cashBalanceAfter: Number(pendingTx.cashBalanceAfter),
            transactionId: pendingTx.id,
          } as SuggestedTransaction & { transactionId?: string });
        }
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(
      `✅ [DIVIDEND SUGGESTIONS] ${suggestions.length} suggestions total (${pendingDividendTransactions.length} existing PENDING + ${filteredGeneratedSuggestions.length} new created as PENDING, ${totalTime}ms)`
    );

    return suggestions;
  }

  /**
   * Sugestões de proventos a partir do `DividendHistory` × posição na data ex (transações confirmadas).
   *
   * - Quantidade com direito: compras menos vendas com data anterior à data ex (`positionAtExDate`).
   * - JCP entra líquido de IRRF (17,5% desde 2026, 15% antes); dividendos e rendimentos, pelo valor bruto.
   * - Só proventos com data ex já passada e a partir da primeira compra do ativo.
   * - Não repete um provento que já existe (qualquer status, inclusive rejeitado) no mesmo mês para o ativo: compara o
   *   valor por ação (bruto ou líquido) dos lançamentos automáticos e o total dos manuais.
   * - Nada é confirmado aqui: as sugestões viram transações PENDING para o usuário confirmar ou rejeitar.
   */
  private static async generateDividendSuggestions(
    portfolioId: string
  ): Promise<SuggestedTransaction[]> {
    const suggestions: SuggestedTransaction[] = [];
    const today = new Date();

    const [latestTransaction, trades, existingDividendTransactions] = await Promise.all([
      prisma.portfolioTransaction.findFirst({
        where: { portfolioId, status: { in: ["CONFIRMED", "EXECUTED"] } },
        orderBy: { date: "desc" },
        select: { cashBalanceAfter: true },
      }),
      prisma.portfolioTransaction.findMany({
        where: {
          portfolioId,
          status: { in: ["CONFIRMED", "EXECUTED"] },
          ticker: { not: null },
          type: { in: ["BUY", "BUY_REBALANCE", "SELL_REBALANCE", "SELL_WITHDRAWAL"] },
        },
        select: { ticker: true, date: true, type: true, quantity: true },
        orderBy: { date: "asc" },
      }),
      prisma.portfolioTransaction.findMany({
        where: { portfolioId, type: "DIVIDEND", ticker: { not: null } },
        select: { ticker: true, date: true, amount: true, price: true },
      }),
    ]);

    let cashBalance = Number(latestTransaction?.cashBalanceAfter || 0);

    const tradesByTicker = new Map<string, PositionTrade[]>();
    const firstBuyByTicker = new Map<string, Date>();
    for (const tx of trades) {
      if (!tx.ticker) continue;
      const list = tradesByTicker.get(tx.ticker) ?? [];
      list.push({ date: tx.date, type: tx.type, quantity: Number(tx.quantity || 0) });
      tradesByTicker.set(tx.ticker, list);
      if ((tx.type === "BUY" || tx.type === "BUY_REBALANCE") && !firstBuyByTicker.has(tx.ticker)) {
        firstBuyByTicker.set(tx.ticker, tx.date);
      }
    }

    const existing: ExistingDividendTransaction[] = existingDividendTransactions
      .filter((tx) => !!tx.ticker)
      .map((tx) => ({
        ticker: tx.ticker as string,
        date: tx.date,
        amount: Number(tx.amount),
        perShare: tx.price === null ? null : Number(tx.price),
      }));

    for (const [ticker, firstBuyDate] of firstBuyByTicker) {
      // Garante o histórico de proventos do ativo (cache de 4 h no DividendService)
      await DividendService.fetchAndSaveDividends(ticker, firstBuyDate);
      const dividends = await DividendService.getDividendsInPeriod(ticker, firstBuyDate, today);
      const tickerTrades = tradesByTicker.get(ticker) ?? [];

      for (const dividend of [...dividends].sort((a, b) => a.exDate.getTime() - b.exDate.getTime())) {
        if (dividend.exDate > today) continue;

        const quantity = positionAtExDate(tickerTrades, dividend.exDate);
        if (quantity <= 0) continue;

        const type = dividendTypeLabel(dividend.type);
        const net = netPerShare(dividend.amount, type, dividend.exDate);
        const total = Math.round(quantity * net * 100) / 100;
        if (total <= 0) continue;

        const date = dividend.paymentDate || dividend.exDate;
        const candidate = { ticker, date, quantity, grossPerShare: dividend.amount, netPerShare: net, total };
        if (existing.some((tx) => isSameDividend(tx, candidate))) continue;

        const rate = irrfRate(type, dividend.exDate);
        const perShareText = rate > 0
          ? `${formatBRL(net, { digits: 4 })}/ação líquido (bruto ${formatBRL(dividend.amount, { digits: 4 })}, IRRF ${formatPct(rate)})`
          : `${formatBRL(net, { digits: 4 })}/ação`;

        suggestions.push({
          date,
          type: "DIVIDEND" as TransactionType,
          ticker,
          amount: total,
          quantity,
          price: net, // valor líquido por ação
          reason: `${type} de ${ticker}: ${perShareText} × ${formatNumber(quantity)} ações = ${formatBRL(total)} (data ex ${formatDateOnly(dividend.exDate)})`,
          cashBalanceBefore: cashBalance,
          cashBalanceAfter: cashBalance + total,
        });
        // Evita sugerir o mesmo provento duas vezes nesta rodada
        existing.push({ ticker, date, amount: total, perShare: net });
        cashBalance += total;
      }
    }

    return suggestions;
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
   * Combine rebalancing suggestions into unified transactions (sell + buy together)
   * This prevents the cash from sales from generating new buy suggestions before the rebalancing buy is executed
   */
  static combineRebalancingSuggestions(
    suggestions: SuggestedTransaction[]
  ): CombinedRebalancingSuggestion[] {
    const sells = suggestions.filter(s => s.type === 'SELL_REBALANCE');
    const buys = suggestions.filter(s => s.type === 'BUY_REBALANCE');

    // If there are no sells or buys, return empty array
    if (sells.length === 0 && buys.length === 0) {
      return [];
    }

    // Calculate initial cash balance (from first sell or buy)
    const firstTransaction = sells.length > 0 ? sells[0] : buys[0];
    const initialCashBalance = firstTransaction.cashBalanceBefore;

    // Calculate final cash balance after all transactions
    let runningCashBalance = initialCashBalance;
    for (const sell of sells) {
      runningCashBalance += sell.amount;
    }
    for (const buy of buys) {
      runningCashBalance -= buy.amount;
    }
    const finalCashBalance = runningCashBalance;

    // Calculate totals
    const totalSold = sells.reduce((sum, s) => sum + s.amount, 0);
    const totalBought = buys.reduce((sum, s) => sum + s.amount, 0);
    const netCashChange = totalSold - totalBought;

    // Create combined suggestion with all sells and buys
    const combined: CombinedRebalancingSuggestion = {
      date: firstTransaction.date,
      type: 'REBALANCING_COMBINED',
      sellTransaction: sells.length > 0 ? {
        // Summary for display
        ticker: sells.length === 1 ? sells[0].ticker : undefined, // Single ticker or undefined for multiple
        amount: totalSold,
        price: sells.length === 1 ? sells[0].price : undefined,
        quantity: sells.length === 1 ? sells[0].quantity : undefined,
        reason: sells.length === 1 
          ? sells[0].reason 
          : `Venda de ${sells.length} ativos para rebalanceamento`,
      } : null,
      sellTransactions: sells, // Keep all individual sell transactions for execution
      buyTransactions: buys,
      totalSold,
      totalBought,
      netCashChange,
      reason: `Rebalanceamento combinado: ${sells.length > 0 ? `venda de ${sells.length} ativo(s)` : ''}${sells.length > 0 && buys.length > 0 ? ' e ' : ''}${buys.length > 0 ? `compra de ${buys.length} ativo(s)` : ''}`,
      cashBalanceBefore: initialCashBalance,
      cashBalanceAfter: finalCashBalance,
    };

    return [combined];
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
   * Create a single pending transaction from a suggestion
   * Returns the created transaction ID
   */
  static async createSinglePendingTransaction(
    portfolioId: string,
    userId: string,
    suggestion: SuggestedTransaction
  ): Promise<string> {
    // Verify ownership
    const portfolio = await PortfolioService.getPortfolioConfig(
      portfolioId,
      userId
    );
    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    // Check if a similar transaction already exists
    const { exists, existingTransaction } =
      await this.checkSimilarTransactionExists(portfolioId, suggestion);

    if (exists && existingTransaction) {
      // If it exists and is PENDING, return its ID
      if (existingTransaction.status === "PENDING") {
        return existingTransaction.id;
      }
      // If it's CONFIRMED or EXECUTED, throw error
      throw new Error("Transaction already exists and was processed");
    }

    // Calculate cash balances if not provided
    let cashBalanceBefore = suggestion.cashBalanceBefore;
    let cashBalanceAfter = suggestion.cashBalanceAfter;
    
    if (cashBalanceBefore === 0 && cashBalanceAfter === 0) {
      // Calculate current cash balance
      const currentCashBalance = await this.getCurrentCashBalance(portfolioId);
      cashBalanceBefore = currentCashBalance;
      
      // Calculate cash balance after based on transaction type
      if (suggestion.type === "DIVIDEND" || suggestion.type === "CASH_CREDIT" || suggestion.type === "MONTHLY_CONTRIBUTION") {
        cashBalanceAfter = currentCashBalance + suggestion.amount;
      } else if (suggestion.type === "CASH_DEBIT" || suggestion.type === "SELL_WITHDRAWAL") {
        cashBalanceAfter = currentCashBalance - suggestion.amount;
      } else if (suggestion.type === "BUY" || suggestion.type === "BUY_REBALANCE") {
        cashBalanceAfter = currentCashBalance - suggestion.amount;
      } else if (suggestion.type === "SELL_REBALANCE") {
        cashBalanceAfter = currentCashBalance + suggestion.amount;
      } else {
        cashBalanceAfter = currentCashBalance;
      }
    }

    // Create new PENDING transaction
    const transaction = await safeWrite(
      "create-single-pending-transaction",
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
            cashBalanceBefore: cashBalanceBefore,
            cashBalanceAfter: cashBalanceAfter,
            status: "PENDING",
            isAutoSuggested: true,
            notes: suggestion.reason,
          },
        }),
      ["portfolio_transactions"]
    );

    return transaction.id;
  }

  /**
   * Recalculate contribution suggestions (Aportes e Compras)
   * Deletes all pending MONTHLY_CONTRIBUTION and BUY suggestions and regenerates them
   */
  private static async recalculateContributionSuggestions(
    portfolioId: string,
    userId: string
  ): Promise<void> {
    try {
      console.log(`🔄 [RECALCULATE] Recalculating contribution suggestions for portfolio ${portfolioId}`);

      // Delete all pending MONTHLY_CONTRIBUTION and BUY suggestions
      const deletedCount = await prisma.portfolioTransaction.deleteMany({
        where: {
          portfolioId,
          status: "PENDING",
          isAutoSuggested: true,
          type: { in: ["MONTHLY_CONTRIBUTION", "BUY"] },
        },
      });

      console.log(`🧹 [RECALCULATE] Deleted ${deletedCount.count} pending contribution suggestions`);

      // Generate new suggestions
      const newSuggestions = await this.getContributionSuggestions(portfolioId, userId);

      if (newSuggestions.length > 0) {
        // Create new pending transactions from suggestions
        await this.createPendingTransactions(portfolioId, userId, newSuggestions);
        console.log(`✅ [RECALCULATE] Created ${newSuggestions.length} new contribution suggestions`);
      } else {
        console.log(`ℹ️ [RECALCULATE] No new contribution suggestions generated`);
      }
    } catch (error) {
      console.error(`❌ [RECALCULATE] Error recalculating contribution suggestions:`, error);
      // Don't throw - we don't want to break the main operation if recalculation fails
    }
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

    // Recalculate contribution suggestions
    await this.recalculateContributionSuggestions(transaction.portfolioId, userId);
  }

  /**
   * Reject a transaction
   * IMPORTANT: Only MONTHLY_CONTRIBUTION (APORTE MENSAL) and DIVIDEND transactions can be rejected.
   * Other transaction types should be confirmed or deleted, not rejected.
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

    // Only MONTHLY_CONTRIBUTION (APORTE MENSAL) and DIVIDEND transactions can be rejected
    // CASH_CREDIT is a different type (manual contribution) and cannot be rejected
    // Other transaction types (BUY, SELL, etc.) should be confirmed or deleted
    if (transaction.type !== "MONTHLY_CONTRIBUTION" && transaction.type !== "DIVIDEND") {
      throw new Error("Apenas transações de APORTE MENSAL (MONTHLY_CONTRIBUTION) e DIVIDENDOS (DIVIDEND) podem ser rejeitadas. Outras transações devem ser confirmadas ou excluídas.");
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

    // Recalculate contribution suggestions
    await this.recalculateContributionSuggestions(transaction.portfolioId, userId);
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

    // Recalculate contribution suggestions
    await this.recalculateContributionSuggestions(transaction.portfolioId, userId);
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

      // Recalculate contribution suggestions (only once for the portfolio)
      await this.recalculateContributionSuggestions(transactions[0].portfolioId, userId);
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

    // Recalculate contribution suggestions
    await this.recalculateContributionSuggestions(portfolioId, userId);

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

    // Recalculate contribution suggestions
    await this.recalculateContributionSuggestions(portfolioId, userId);

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

    // Allow deleting any transaction (removed restriction on confirmed auto-suggested transactions)

    const portfolioId = transaction.portfolioId;

    await safeWrite(
      "delete-transaction",
      () =>
        prisma.portfolioTransaction.delete({
          where: { id: transactionId },
        }),
      ["portfolio_transactions"]
    );

    console.log(`✅ Transaction deleted: ${transactionId}`);

    // Recalculate contribution suggestions
    await this.recalculateContributionSuggestions(portfolioId, userId);
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

    // Recalculate contribution suggestions
    await this.recalculateContributionSuggestions(portfolioId, userId);
  }
}
