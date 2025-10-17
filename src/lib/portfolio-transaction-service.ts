/**
 * PORTFOLIO TRANSACTION SERVICE
 * 
 * Manages portfolio transactions including:
 * - Automatic transaction suggestions
 * - Transaction confirmation/rejection
 * - Manual transaction entry
 * - Transaction history and queries
 */

import { prisma } from '@/lib/prisma';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { safeWrite } from '@/lib/prisma-wrapper';
import { PortfolioService } from './portfolio-service';
import { getLatestPrices as getQuotes, pricesToNumberMap } from './quote-service';

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
    const portfolio = await PortfolioService.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const where: any = {
      portfolioId
    };

    if (filters) {
      if (filters.status) {
        where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
      }
      if (filters.type) {
        where.type = Array.isArray(filters.type) ? { in: filters.type } : filters.type;
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
        date: 'desc'
      }
    });

    return transactions.map((t: any) => ({
      ...t,
      amount: Number(t.amount),
      price: t.price ? Number(t.price) : null,
      quantity: t.quantity ? Number(t.quantity) : null,
      cashBalanceBefore: Number(t.cashBalanceBefore),
      cashBalanceAfter: Number(t.cashBalanceAfter),
      portfolioValueAfter: t.portfolioValueAfter ? Number(t.portfolioValueAfter) : null
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
    const portfolio = await PortfolioService.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // Don't generate suggestions if tracking hasn't started
    if (!portfolio.trackingStarted) {
      return [];
    }

    console.log(`🚀 [SUGGESTIONS] Starting parallel data fetch...`);
    const startTime = Date.now();

    // OPTIMIZATION: Parallelize independent operations
    const [holdings, prices, nextDates, existingPending] = await Promise.all([
      this.getCurrentHoldings(portfolioId),
      this.getLatestPrices(portfolio.assets.map(a => a.ticker)),
      this.calculateNextTransactionDates(portfolioId),
      // Get existing PENDING transactions to avoid duplicates
      prisma.portfolioTransaction.findMany({
        where: {
          portfolioId,
          status: 'PENDING',
          isAutoSuggested: true
        },
        select: {
          date: true,
          type: true,
          ticker: true
        }
      })
    ]);

    const fetchTime = Date.now() - startTime;
    console.log(`⚡ [PERFORMANCE] Data fetched in ${fetchTime}ms (parallelized)`);

    // Create a Set of existing PENDING transactions for fast lookup
    const existingPendingKeys = new Set(
      existingPending.map(tx => 
        `${tx.date.toISOString().split('T')[0]}_${tx.type}_${tx.ticker || 'null'}`
      )
    );

    if (existingPendingKeys.size > 0) {
      console.log(`🔍 [DEDUP CHECK] Found ${existingPendingKeys.size} existing PENDING transactions`);
    }

    const suggestions: SuggestedTransaction[] = [];
    
    if (nextDates.length > 0) {
      console.log(`📅 [PENDING CONTRIBUTIONS] ${nextDates.length} pending monthly contributions`);
      
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
      console.log(`📊 [NO PENDING MONTHS] Checking if rebalancing is needed...`);
      
      const rebalancingSuggestions = await this.generateRebalancingSuggestions(
        portfolio,
        holdings,
        prices
      );
      
      if (rebalancingSuggestions.length > 0) {
        console.log(`⚖️ [REBALANCING NEEDED] ${rebalancingSuggestions.length} rebalancing transactions suggested`);
        suggestions.push(...rebalancingSuggestions);
      } else {
        console.log(`✅ [PORTFOLIO BALANCED] No rebalancing needed`);
      }
    }

    // INTELLIGENCE: Filter out suggestions that already exist as PENDING
    const filteredSuggestions = suggestions.filter(suggestion => {
      const key = `${suggestion.date.toISOString().split('T')[0]}_${suggestion.type}_${suggestion.ticker || 'null'}`;
      const exists = existingPendingKeys.has(key);
      
      if (exists) {
        console.log(`⏩ [SKIP DUPLICATE] ${suggestion.type} ${suggestion.ticker || ''} on ${suggestion.date.toISOString().split('T')[0]} already exists as PENDING`);
      }
      
      return !exists;
    });

    const skippedCount = suggestions.length - filteredSuggestions.length;
    
    if (skippedCount > 0) {
      console.log(`🛡️ [DEDUP] Skipped ${skippedCount} suggestions (already exist as PENDING)`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ [TOTAL SUGGESTIONS] ${filteredSuggestions.length} unique transactions suggested (${totalTime}ms total)`);
    
    return filteredSuggestions;
  }

  /**
   * Calculate next transaction dates based on rebalance frequency
   * Only returns FUTURE dates (today or later) that are due for contribution
   */
  private static async calculateNextTransactionDates(portfolioId: string): Promise<Date[]> {
    const portfolio = await prisma.portfolioConfig.findUnique({
      where: { id: portfolioId },
      select: {
        startDate: true,
        rebalanceFrequency: true
      }
    });

    if (!portfolio) return [];

    // Get the REAL last transaction date from actual transactions
    const lastTransaction = await prisma.portfolioTransaction.findFirst({
      where: {
        portfolioId,
        status: { in: ['CONFIRMED', 'EXECUTED'] },
        type: 'CASH_CREDIT' // Last monthly contribution
      },
      orderBy: {
        date: 'desc'
      },
      select: {
        date: true
      }
    });

    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const startDate = lastTransaction?.date || portfolio.startDate;
    let currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    
    console.log(`📆 [DATE CALC] Last contribution: ${startDate.toISOString().split('T')[0]}, Today: ${today.toISOString().split('T')[0]}`);
    
    // Calculate frequency in months
    const frequencyMonths = portfolio.rebalanceFrequency === 'monthly' ? 1 :
                           portfolio.rebalanceFrequency === 'quarterly' ? 3 : 12;
    
    // Calculate next contribution date after last transaction
    currentDate.setMonth(currentDate.getMonth() + frequencyMonths);
    
    // Only include if date is today or in the past (overdue)
    // But we'll use today's date for overdue contributions
    if (currentDate <= today) {
      // Contribution is overdue, suggest it for today
      dates.push(new Date(today));
      console.log(`📅 [PENDING] Contribution overdue (expected ${currentDate.toISOString().split('T')[0]}), suggesting for TODAY (${today.toISOString().split('T')[0]})`);
    }
    // Future date - not yet due
    else {
      console.log(`⏰ [NOT DUE] Next contribution scheduled for ${currentDate.toISOString().split('T')[0]}`);
    }

    return dates;
  }

  /**
   * Get current holdings from executed/confirmed transactions
   */
  private static async getCurrentHoldings(portfolioId: string): Promise<Map<string, { quantity: number; totalInvested: number }>> {
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

    const holdings = new Map<string, { quantity: number; totalInvested: number }>();

    for (const tx of transactions) {
      if (!tx.ticker) continue;

      const current = holdings.get(tx.ticker) || { quantity: 0, totalInvested: 0 };
      
      if (tx.type === 'BUY' || tx.type === 'BUY_REBALANCE') {
        current.quantity += Number(tx.quantity || 0);
        current.totalInvested += Number(tx.amount);
      } else if (tx.type === 'SELL_REBALANCE' || tx.type === 'SELL_WITHDRAWAL') {
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
  private static async getLatestPrices(tickers: string[]): Promise<Map<string, number>> {
    const priceMap = await getQuotes(tickers);
    return pricesToNumberMap(priceMap);
  }

  /**
   * Generate immediate rebalancing suggestions (if portfolio is unbalanced)
   */
  private static async generateRebalancingSuggestions(
    portfolio: any,
    holdings: Map<string, { quantity: number; totalInvested: number }>,
    prices: Map<string, number>
  ): Promise<SuggestedTransaction[]> {
    const suggestions: SuggestedTransaction[] = [];
    
    // Calculate portfolio value and current allocations
    const portfolioValue = this.calculatePortfolioValue(holdings, prices);
    
    if (portfolioValue === 0) {
      console.log('⚠️ Portfolio value is 0, no rebalancing needed');
      return [];
    }
    
    const currentAllocations = this.calculateCurrentAllocations(holdings, prices, portfolioValue);
    
    // Check if rebalancing is needed (>5% deviation from target)
    const deviations: Array<{ ticker: string; current: number; target: number; diff: number }> = [];
    
    for (const asset of portfolio.assets) {
      const currentAlloc = currentAllocations.get(asset.ticker) || 0;
      const targetAlloc = Number(asset.targetAllocation);
      const diff = currentAlloc - targetAlloc;
      
      if (Math.abs(diff) > 0.05) { // More than 5% deviation
        deviations.push({
          ticker: asset.ticker,
          current: currentAlloc,
          target: targetAlloc,
          diff
        });
      }
    }
    
    if (deviations.length === 0) {
      console.log('✅ Portfolio is balanced, no rebalancing needed');
      return [];
    }
    
    console.log('⚖️ Portfolio needs rebalancing:', deviations.map(d => 
      `${d.ticker}: ${(d.current * 100).toFixed(2)}% vs ${(d.target * 100).toFixed(2)}% (${d.diff > 0 ? '+' : ''}${(d.diff * 100).toFixed(2)}%)`
    ));
    
    // Get current cash balance
    const currentCash = await this.getCurrentCashBalance(portfolio.id);
    const today = new Date();
    
    // Generate rebalancing transactions for today
    const rebalanceSuggestions = this.generateRebalanceTransactions(
      portfolio.assets,
      holdings,
      prices,
      portfolioValue,
      currentAllocations,
      currentCash,
      today
    );
    
    suggestions.push(...rebalanceSuggestions);
    
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
      type: 'CASH_CREDIT',
      amount: Number(portfolio.monthlyContribution),
      reason: `Aporte mensal de R$ ${Number(portfolio.monthlyContribution).toFixed(2)}`,
      cashBalanceBefore: cashBalance,
      cashBalanceAfter: cashBalance + Number(portfolio.monthlyContribution)
    });

    let currentCash = cashBalance + Number(portfolio.monthlyContribution);

    // 2. Calculate portfolio value and current allocations
    const portfolioValue = this.calculatePortfolioValue(holdings, prices);
    const currentAllocations = this.calculateCurrentAllocations(holdings, prices, portfolioValue);

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
   * Get current cash balance
   */
  private static async getCurrentCashBalance(portfolioId: string): Promise<number> {
    const lastCashTransaction = await prisma.portfolioTransaction.findFirst({
      where: {
        portfolioId,
        status: {
          in: ['CONFIRMED', 'EXECUTED']
        }
      },
      orderBy: {
        date: 'desc'
      },
      select: {
        cashBalanceAfter: true
      }
    });

    return lastCashTransaction ? Number(lastCashTransaction.cashBalanceAfter) : 0;
  }

  /**
   * Recalculate all cash balances for portfolio transactions in chronological order
   * This is needed when retroactive transactions are added
   */
  static async recalculateCashBalances(portfolioId: string): Promise<void> {
    console.log(`🔄 Recalculating cash balances for portfolio ${portfolioId}...`);

    // Get all confirmed/executed transactions in chronological order
    const transactions = await prisma.portfolioTransaction.findMany({
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

    if (transactions.length === 0) {
      console.log('✅ No transactions to recalculate');
      return;
    }

    let runningBalance = 0;

    // Recalculate cash balance for each transaction in order
    for (const tx of transactions) {
      const cashBalanceBefore = runningBalance;
      let cashBalanceAfter = runningBalance;

      // Apply transaction to running balance
      if (tx.type === 'CASH_CREDIT' || tx.type === 'DIVIDEND') {
        cashBalanceAfter += Number(tx.amount);
      } else if (tx.type === 'CASH_DEBIT' || tx.type === 'BUY' || tx.type === 'BUY_REBALANCE') {
        cashBalanceAfter -= Number(tx.amount);
      } else if (tx.type === 'SELL_REBALANCE' || tx.type === 'SELL_WITHDRAWAL') {
        cashBalanceAfter += Number(tx.amount);
      }

      // Update transaction with corrected balances
      await prisma.portfolioTransaction.update({
        where: { id: tx.id },
        data: {
          cashBalanceBefore,
          cashBalanceAfter
        }
      });

      runningBalance = cashBalanceAfter;
    }

    console.log(`✅ Recalculated ${transactions.length} transactions. Final balance: R$ ${runningBalance.toFixed(2)}`);
  }

  /**
   * Calculate total portfolio value
   */
  private static calculatePortfolioValue(
    holdings: Map<string, { quantity: number; totalInvested: number }>,
    prices: Map<string, number>
  ): number {
    let total = 0;
    
    for (const [ticker, holding] of holdings) {
      const price = prices.get(ticker) || 0;
      total += holding.quantity * price;
    }
    
    return total;
  }

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
   * Generate rebalancing transactions
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

    // First, sell overallocated assets
    for (const asset of assets) {
      const currentAlloc = currentAllocations.get(asset.ticker) || 0;
      const targetAlloc = Number(asset.targetAllocation);
      
      if (currentAlloc > targetAlloc + 0.05) {
        const price = prices.get(asset.ticker);
        if (!price) continue;

        const holding = holdings.get(asset.ticker);
        if (!holding || holding.quantity === 0) continue;

        const excessValue = (currentAlloc - targetAlloc) * portfolioValue;
        const sharesToSell = Math.floor(excessValue / price);
        
        if (sharesToSell > 0) {
          const actualSellAmount = sharesToSell * price;
          
          suggestions.push({
            date,
            type: 'SELL_REBALANCE',
            ticker: asset.ticker,
            amount: actualSellAmount,
            price,
            quantity: sharesToSell,
            reason: `Rebalanceamento: venda de ${sharesToSell} ações (alocação atual ${(currentAlloc * 100).toFixed(1)}% > alvo ${(targetAlloc * 100).toFixed(1)}%)`,
            cashBalanceBefore: cashBalance,
            cashBalanceAfter: cashBalance + actualSellAmount
          });
          
          cashBalance += actualSellAmount;
        }
      }
    }

    // Then, buy underallocated assets
    for (const asset of assets) {
      const currentAlloc = currentAllocations.get(asset.ticker) || 0;
      const targetAlloc = Number(asset.targetAllocation);
      
      if (currentAlloc < targetAlloc - 0.05 && cashBalance > 0) {
        const price = prices.get(asset.ticker);
        if (!price) continue;

        const deficitValue = Math.min((targetAlloc - currentAlloc) * portfolioValue, cashBalance);
        const sharesToBuy = Math.floor(deficitValue / price);
        
        if (sharesToBuy > 0) {
          const actualBuyAmount = sharesToBuy * price;
          
          suggestions.push({
            date,
            type: 'BUY_REBALANCE',
            ticker: asset.ticker,
            amount: actualBuyAmount,
            price,
            quantity: sharesToBuy,
            reason: `Rebalanceamento: compra de ${sharesToBuy} ações (alocação atual ${(currentAlloc * 100).toFixed(1)}% < alvo ${(targetAlloc * 100).toFixed(1)}%)`,
            cashBalanceBefore: cashBalance,
            cashBalanceAfter: cashBalance - actualBuyAmount
          });
          
          cashBalance -= actualBuyAmount;
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate regular buy transactions
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
          type: 'BUY',
          ticker: asset.ticker,
          amount: actualAmount,
          price,
          quantity: sharesToBuy,
          reason: `Compra de ${sharesToBuy} ações conforme alocação de ${(Number(asset.targetAllocation) * 100).toFixed(1)}%`,
          cashBalanceBefore: cashBalance,
          cashBalanceAfter: cashBalance - actualAmount
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

      const current = holdings.get(suggestion.ticker) || { quantity: 0, totalInvested: 0 };
      
      if (suggestion.type === 'BUY' || suggestion.type === 'BUY_REBALANCE') {
        current.quantity += suggestion.quantity || 0;
        current.totalInvested += suggestion.amount;
      } else if (suggestion.type === 'SELL_REBALANCE' || suggestion.type === 'SELL_WITHDRAWAL') {
        current.quantity -= suggestion.quantity || 0;
        current.totalInvested -= suggestion.amount;
      }

      holdings.set(suggestion.ticker, current);
    }
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
    const portfolio = await PortfolioService.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const transactionIds: string[] = [];
    let createdCount = 0;
    let skippedCount = 0;

    for (const suggestion of suggestions) {
      // Check if a similar PENDING transaction already exists (deduplication)
      const existingTransaction = await prisma.portfolioTransaction.findFirst({
        where: {
          portfolioId,
          date: suggestion.date,
          type: suggestion.type,
          ticker: suggestion.ticker,
          status: 'PENDING',
          isAutoSuggested: true
        }
      });

      if (existingTransaction) {
        // Skip creating duplicate, but add to the list
        console.log(`⏩ Skipping duplicate PENDING transaction: ${suggestion.type} ${suggestion.ticker || ''} on ${suggestion.date.toISOString().split('T')[0]}`);
        transactionIds.push(existingTransaction.id);
        skippedCount++;
        continue;
      }

      // Create new PENDING transaction
      const transaction = await safeWrite(
        'create-pending-transaction',
        () => prisma.portfolioTransaction.create({
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
            status: 'PENDING',
            isAutoSuggested: true,
            notes: suggestion.reason
          }
        }),
        ['portfolio_transactions']
      );

      transactionIds.push(transaction.id);
      createdCount++;
    }

    console.log(`✅ Pending transactions: ${createdCount} created, ${skippedCount} skipped (duplicates) for portfolio ${portfolioId}`);
    
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
        portfolio: true
      }
    });

    if (!transaction || transaction.portfolio.userId !== userId) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'PENDING') {
      throw new Error('Only pending transactions can be confirmed');
    }

    await safeWrite(
      'confirm-transaction',
      () => prisma.portfolioTransaction.update({
        where: { id: transactionId },
        data: {
          ...updates,
          status: 'CONFIRMED',
          confirmedAt: new Date()
        }
      }),
      ['portfolio_transactions']
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
        portfolio: true
      }
    });

    if (!transaction || transaction.portfolio.userId !== userId) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'PENDING') {
      throw new Error('Only pending transactions can be rejected');
    }

    await safeWrite(
      'reject-transaction',
      () => prisma.portfolioTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectionReason: reason
        }
      }),
      ['portfolio_transactions']
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
        portfolio: true
      }
    });

    if (!transaction || transaction.portfolio.userId !== userId) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'CONFIRMED' && transaction.status !== 'REJECTED') {
      throw new Error('Only confirmed or rejected transactions can be reverted');
    }

    await safeWrite(
      'revert-transaction',
      () => prisma.portfolioTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'PENDING',
          revertedAt: new Date(),
          confirmedAt: null,
          rejectedAt: null,
          rejectionReason: null
        }
      }),
      ['portfolio_transactions']
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
          in: transactionIds
        },
        portfolio: {
          userId
        },
        status: 'PENDING'
      }
    });

    if (transactions.length !== transactionIds.length) {
      throw new Error('Some transactions not found or already processed');
    }

    await safeWrite(
      'confirm-batch-transactions',
      () => prisma.portfolioTransaction.updateMany({
        where: {
          id: {
            in: transactionIds
          }
        },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date()
        }
      }),
      ['portfolio_transactions']
    );

    // Update last transaction date (use the latest date from the batch)
    const latestDate = transactions.reduce((latest, tx) => 
      tx.date > latest ? tx.date : latest
    , transactions[0].date);

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
    const portfolio = await PortfolioService.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // Get current cash balance
    const currentCashBalance = await this.getCurrentCashBalance(portfolioId);

    // 1. Create CASH_CREDIT transaction first (same date as the purchase)
    const cashCreditTransaction = await safeWrite(
      'create-cash-credit-auto',
      () => prisma.portfolioTransaction.create({
        data: {
          portfolioId,
          date: input.date,
          type: 'CASH_CREDIT',
          amount: cashCreditAmount,
          cashBalanceBefore: currentCashBalance,
          cashBalanceAfter: currentCashBalance + cashCreditAmount,
          status: 'EXECUTED',
          isAutoSuggested: false,
          notes: `Aporte automático para compra de ${input.ticker || 'ativo'}`
        }
      }),
      ['portfolio_transactions']
    );

    // 2. Now create the purchase transaction with updated cash balance
    const newCashBalance = currentCashBalance + cashCreditAmount;
    let cashBalanceAfter = newCashBalance;

    if (input.type === 'BUY' || input.type === 'BUY_REBALANCE') {
      cashBalanceAfter -= input.amount;
    }

    const transaction = await safeWrite(
      'create-purchase-after-credit',
      () => prisma.portfolioTransaction.create({
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
          status: 'EXECUTED',
          isAutoSuggested: false,
          notes: input.notes
        }
      }),
      ['portfolio_transactions']
    );

    // Update last transaction date
    await PortfolioService.updateLastTransactionDate(portfolioId, input.date);

    console.log(`✅ Created auto cash credit + purchase: ${cashCreditTransaction.id}, ${transaction.id}`);
    
    return {
      cashCreditId: cashCreditTransaction.id,
      transactionId: transaction.id
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
    const portfolio = await PortfolioService.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // Calculate cash balance
    const currentCashBalance = await this.getCurrentCashBalance(portfolioId);
    let cashBalanceAfter = currentCashBalance;

    if (input.type === 'CASH_CREDIT' || input.type === 'DIVIDEND') {
      cashBalanceAfter += input.amount;
    } else if (input.type === 'CASH_DEBIT' || input.type === 'BUY' || input.type === 'BUY_REBALANCE') {
      cashBalanceAfter -= input.amount;
    } else if (input.type === 'SELL_REBALANCE' || input.type === 'SELL_WITHDRAWAL') {
      cashBalanceAfter += input.amount;
    }

    // Validate: prevent negative cash balance
    if (cashBalanceAfter < 0) {
      const insufficientAmount = Math.abs(cashBalanceAfter);
      const error: any = new Error('INSUFFICIENT_CASH');
      error.code = 'INSUFFICIENT_CASH';
      error.details = {
        currentCashBalance,
        transactionAmount: input.amount,
        insufficientAmount,
        message: `Saldo insuficiente. Você precisa de R$ ${insufficientAmount.toFixed(2)} adicionais em caixa.`
      };
      throw error;
    }

    const transaction = await safeWrite(
      'create-manual-transaction',
      () => prisma.portfolioTransaction.create({
        data: {
          portfolioId,
          date: input.date,
          type: input.type,
          ticker: input.ticker?.toUpperCase(),
          amount: input.amount,
          price: input.price,
          quantity: input.quantity,
          cashBalanceBefore: currentCashBalance,
          cashBalanceAfter,
          status: 'EXECUTED',
          isAutoSuggested: false,
          notes: input.notes
        }
      }),
      ['portfolio_transactions']
    );

    // Update last transaction date
    await PortfolioService.updateLastTransactionDate(portfolioId, input.date);

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
        portfolio: true
      }
    });

    if (!transaction || transaction.portfolio.userId !== userId) {
      throw new Error('Transaction not found');
    }

    // Only allow deleting PENDING or manually created EXECUTED transactions
    if (transaction.status === 'CONFIRMED' && transaction.isAutoSuggested) {
      throw new Error('Cannot delete confirmed auto-suggested transactions. Revert to pending first.');
    }

    await safeWrite(
      'delete-transaction',
      () => prisma.portfolioTransaction.delete({
        where: { id: transactionId }
      }),
      ['portfolio_transactions']
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
        portfolio: true
      }
    });

    if (!transaction || transaction.portfolio.userId !== userId) {
      throw new Error('Transaction not found');
    }

    // Only allow updating PENDING or EXECUTED (manual) transactions
    if (transaction.status === 'CONFIRMED' && transaction.isAutoSuggested) {
      throw new Error('Cannot edit confirmed auto-suggested transactions. Revert to pending first.');
    }

    await safeWrite(
      'update-transaction',
      () => prisma.portfolioTransaction.update({
        where: { id: transactionId },
        data: {
          ...updates,
          ticker: updates.ticker?.toUpperCase()
        }
      }),
      ['portfolio_transactions']
    );

    console.log(`✅ Transaction updated: ${transactionId}`);
  }
}

