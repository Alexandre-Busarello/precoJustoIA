/**
 * PORTFOLIO SERVICE
 * 
 * Core service for managing portfolio configurations and assets.
 * Handles CRUD operations for portfolios (Carteira) feature.
 */

import { prisma } from '@/lib/prisma';
import { Prisma, PortfolioConfig } from '@prisma/client';
import { safeWrite } from '@/lib/prisma-wrapper';

// Types
export interface CreatePortfolioInput {
  name: string;
  description?: string;
  startDate: Date;
  monthlyContribution: number;
  rebalanceFrequency: 'monthly' | 'quarterly' | 'yearly';
  assets: {
    ticker: string;
    targetAllocation: number; // 0.25 = 25%
  }[];
  sourceBacktestId?: string;
}

export interface UpdatePortfolioInput {
  name?: string;
  description?: string;
  monthlyContribution?: number;
  rebalanceFrequency?: 'monthly' | 'quarterly' | 'yearly';
}

export interface PortfolioWithAssets extends PortfolioConfig {
  assets: {
    id: string;
    ticker: string;
    targetAllocation: number;
    isActive: boolean;
  }[];
}

/**
 * Portfolio Service
 */
export class PortfolioService {
  
  /**
   * Create a new portfolio
   */
  static async createPortfolio(
    userId: string,
    input: CreatePortfolioInput
  ): Promise<string> {
    // Validate total allocation within tolerance (99.5% to 100.5%)
    const totalAllocation = input.assets.reduce((sum, a) => sum + a.targetAllocation, 0);
    
    if (totalAllocation < 0.995 || totalAllocation > 1.005) {
      throw new Error(`Total allocation must be between 99.5% and 100.5%. Current: ${(totalAllocation * 100).toFixed(2)}%`);
    }

    // Validate at least one asset
    if (input.assets.length === 0) {
      throw new Error('Portfolio must have at least one asset');
    }

    // Normalize allocations to exactly 100% if within tolerance
    let normalizedAssets = input.assets;
    if (totalAllocation !== 1.0) {
      const adjustmentFactor = 1.0 / totalAllocation;
      normalizedAssets = input.assets.map(asset => ({
        ...asset,
        targetAllocation: asset.targetAllocation * adjustmentFactor
      }));
      console.log(`📊 Normalized allocations from ${(totalAllocation * 100).toFixed(2)}% to 100.00%`);
    }

    // Create portfolio with assets
    // Start tracking automatically when portfolio is created
    const portfolio = await safeWrite(
      'create-portfolio-config',
      () => prisma.portfolioConfig.create({
        data: {
          userId,
          name: input.name,
          description: input.description,
          startDate: input.startDate,
          monthlyContribution: input.monthlyContribution,
          rebalanceFrequency: input.rebalanceFrequency,
          sourceBacktestId: input.sourceBacktestId,
          trackingStarted: true, // Start tracking automatically
          lastTransactionDate: new Date(), // Set to now to start suggestions from next month
          assets: {
            create: normalizedAssets.map(asset => ({
              ticker: asset.ticker.toUpperCase(),
              targetAllocation: asset.targetAllocation,
            }))
          }
        },
        include: {
          assets: true
        }
      }),
      ['portfolio_configs', 'portfolio_config_assets']
    );

    console.log(`✅ Portfolio created: ${portfolio.id} with ${input.assets.length} assets`);
    
    return portfolio.id;
  }

  /**
   * Start tracking (enable auto suggestions)
   */
  static async startTracking(
    portfolioId: string,
    userId: string
  ): Promise<void> {
    const portfolio = await this.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    await safeWrite(
      'update-portfolio_config-tracking',
      () => prisma.portfolioConfig.update({
        where: { id: portfolioId },
        data: {
          trackingStarted: true,
          lastTransactionDate: new Date() // Set to now to start suggestions from next month
        }
      }),
      ['portfolio_configs']
    );

    console.log(`✅ Tracking started for portfolio: ${portfolioId}`);
  }

  /**
   * Get portfolio configuration with assets
   */
  static async getPortfolioConfig(
    portfolioId: string,
    userId: string
  ): Promise<PortfolioWithAssets | null> {
    // NO CACHE - Read directly from Prisma for now
    const portfolio = await prisma.portfolioConfig.findFirst({
      where: {
        id: portfolioId,
        userId,
        isActive: true
      },
      include: {
        assets: {
          where: {
            isActive: true
          },
          select: {
            id: true,
            ticker: true,
            targetAllocation: true,
            isActive: true,
            addedAt: true
          }
        }
      }
    });

    if (!portfolio) return null;

    return {
      ...portfolio,
      assets: portfolio.assets.map((a: any) => ({
        id: a.id,
        ticker: a.ticker,
        targetAllocation: Number(a.targetAllocation),
        isActive: a.isActive
      }))
    };
  }

  /**
   * Get all user portfolios
   */
  static async getUserPortfolios(userId: string): Promise<PortfolioWithAssets[]> {
    // NO CACHE - Read directly from Prisma for now
    const portfolios = await prisma.portfolioConfig.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        assets: {
          where: {
            isActive: true
          },
          select: {
            id: true,
            ticker: true,
            targetAllocation: true,
            isActive: true
          }
        },
        metrics: {
          select: {
            currentValue: true,
            totalInvested: true,
            totalReturn: true,
            cashBalance: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return portfolios.map((p: any) => ({
      ...p,
      assets: p.assets.map((a: any) => ({
        id: a.id,
        ticker: a.ticker,
        targetAllocation: Number(a.targetAllocation),
        isActive: a.isActive
      }))
    }));
  }

  /**
   * Count active portfolios for a user
   */
  static async countUserPortfolios(userId: string): Promise<number> {
    // NO CACHE - Read directly from Prisma for now
    return await prisma.portfolioConfig.count({
      where: {
        userId,
        isActive: true
      }
    });
  }

  /**
   * Update portfolio configuration
   */
  static async updatePortfolio(
    portfolioId: string,
    userId: string,
    updates: UpdatePortfolioInput
  ): Promise<void> {
    // Verify ownership
    const portfolio = await this.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    await safeWrite(
      'update-portfolio-config',
      () => prisma.portfolioConfig.update({
        where: {
          id: portfolioId
        },
        data: updates
      }),
      ['portfolio_configs']
    );

    console.log(`✅ Portfolio updated: ${portfolioId}`);
  }

  /**
   * Delete portfolio (soft delete)
   */
  static async deletePortfolio(portfolioId: string, userId: string): Promise<void> {
    // Verify ownership
    const portfolio = await this.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    await safeWrite(
      'soft-delete-portfolio',
      () => prisma.portfolioConfig.update({
        where: {
          id: portfolioId
        },
        data: {
          isActive: false
        }
      }),
      ['portfolio_configs']
    );

    console.log(`✅ Portfolio soft deleted: ${portfolioId}`);
  }

  /**
   * Delete portfolio permanently (hard delete)
   * Deletes all associated data: transactions, metrics, assets
   * ⚠️ THIS ACTION IS IRREVERSIBLE
   */
  static async deletePortfolioPermanently(portfolioId: string, userId: string): Promise<void> {
    // Verify ownership
    const portfolio = await this.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    console.log(`🗑️ [HARD DELETE] Starting permanent deletion of portfolio: ${portfolioId}`);

    // Delete in order (respecting foreign key constraints)
    // 1. Delete transactions
    const deletedTransactions = await prisma.portfolioTransaction.deleteMany({
      where: { portfolioId }
    });
    console.log(`  ✅ Deleted ${deletedTransactions.count} transactions`);

    // 2. Delete metrics
    const deletedMetrics = await prisma.portfolioMetrics.deleteMany({
      where: { portfolioId }
    });
    console.log(`  ✅ Deleted ${deletedMetrics.count} metrics records`);

    // 3. Delete assets
    const deletedAssets = await prisma.portfolioConfigAsset.deleteMany({
      where: { portfolioId }
    });
    console.log(`  ✅ Deleted ${deletedAssets.count} assets`);

    // 4. Finally, delete the portfolio config
    await prisma.portfolioConfig.delete({
      where: { id: portfolioId }
    });
    console.log(`  ✅ Deleted portfolio config`);

    // 5. Invalidate dashboard cache (client-side will handle this)
    console.log(`  🗑️ Dashboard cache should be invalidated on client`);

    console.log(`🗑️ [HARD DELETE] Portfolio ${portfolioId} permanently deleted`);
  }

  /**
   * Add asset to portfolio
   */
  static async addAsset(
    portfolioId: string,
    userId: string,
    ticker: string,
    targetAllocation: number
  ): Promise<string> {
    // Verify ownership
    const portfolio = await this.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // Check if asset already exists (including inactive)
    const existingAsset = await prisma.portfolioConfigAsset.findFirst({
      where: {
        portfolioId,
        ticker: ticker.toUpperCase()
      }
    });

    let assetId: string;

    if (existingAsset) {
      // Reactivate if was inactive
      const asset = await safeWrite(
        'reactivate-portfolio-asset',
        () => prisma.portfolioConfigAsset.update({
          where: {
            id: existingAsset.id
          },
          data: {
            isActive: true,
            targetAllocation,
            removedAt: null
          }
        }),
        ['portfolio_config_assets']
      );
      assetId = asset.id;
    } else {
      // Create new asset
      const asset = await safeWrite(
        'add-portfolio-asset',
        () => prisma.portfolioConfigAsset.create({
          data: {
            portfolioId,
            ticker: ticker.toUpperCase(),
            targetAllocation
          }
        }),
        ['portfolio_config_assets']
      );
      assetId = asset.id;
    }

    console.log(`✅ Asset added to portfolio: ${ticker} (${portfolioId})`);
    
    return assetId;
  }

  /**
   * Remove asset from portfolio (soft delete)
   */
  static async removeAsset(
    portfolioId: string,
    userId: string,
    ticker: string
  ): Promise<void> {
    // Verify ownership
    const portfolio = await this.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    await safeWrite(
      'remove-portfolio-asset',
      () => prisma.portfolioConfigAsset.updateMany({
        where: {
          portfolioId,
          ticker: ticker.toUpperCase(),
          isActive: true
        },
        data: {
          isActive: false,
          removedAt: new Date()
        }
      }),
      ['portfolio_config_assets']
    );

    console.log(`✅ Asset removed from portfolio: ${ticker} (${portfolioId})`);
  }

  /**
   * Update asset allocation
   */
  static async updateAssetAllocation(
    portfolioId: string,
    userId: string,
    ticker: string,
    targetAllocation: number
  ): Promise<void> {
    // Verify ownership
    const portfolio = await this.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    await safeWrite(
      'update-asset-allocation',
      () => prisma.portfolioConfigAsset.updateMany({
        where: {
          portfolioId,
          ticker: ticker.toUpperCase(),
          isActive: true
        },
        data: {
          targetAllocation
        }
      }),
      ['portfolio_config_assets']
    );

    console.log(`✅ Asset allocation updated: ${ticker} -> ${(targetAllocation * 100).toFixed(2)}%`);
  }

  /**
   * Get portfolio with full details (assets, metrics, recent transactions)
   */
  static async getPortfolioDetails(portfolioId: string, userId: string) {
    // NO CACHE - Read directly from Prisma for now
    const portfolio = await prisma.portfolioConfig.findFirst({
      where: {
        id: portfolioId,
        userId,
        isActive: true
      },
      include: {
        assets: {
          where: {
            isActive: true
          },
          orderBy: {
            targetAllocation: 'desc'
          }
        },
        metrics: true,
        transactions: {
          where: {
            status: {
              in: ['PENDING', 'CONFIRMED']
            }
          },
          orderBy: {
            date: 'desc'
          },
          take: 10
        }
      }
    });

    if (!portfolio) return null;

    return {
      ...portfolio,
      assets: portfolio.assets.map((a: any) => ({
        ...a,
        targetAllocation: Number(a.targetAllocation)
      })),
      transactions: portfolio.transactions.map((t: any) => ({
        ...t,
        amount: Number(t.amount),
        price: t.price ? Number(t.price) : null,
        quantity: t.quantity ? Number(t.quantity) : null,
        cashBalanceBefore: Number(t.cashBalanceBefore),
        cashBalanceAfter: Number(t.cashBalanceAfter),
        portfolioValueAfter: t.portfolioValueAfter ? Number(t.portfolioValueAfter) : null
      }))
    };
  }

  /**
   * Update last transaction date
   */
  static async updateLastTransactionDate(
    portfolioId: string,
    date: Date
  ): Promise<void> {
    await safeWrite(
      'update-last-transaction-date',
      () => prisma.portfolioConfig.update({
        where: {
          id: portfolioId
        },
        data: {
          lastTransactionDate: date
        }
      }),
      ['portfolio_configs']
    );
  }
}

