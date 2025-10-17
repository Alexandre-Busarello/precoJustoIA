/**
 * PORTFOLIO-BACKTEST INTEGRATION SERVICE
 * 
 * Handles bidirectional conversion between portfolios and backtests:
 * - Convert backtest configuration to portfolio
 * - Generate backtest from portfolio composition
 */

import { prisma } from '@/lib/prisma';
// No cache for portfolio reads for now
import { PortfolioService } from './portfolio-service';
import { BacktestService } from './backtest-service';
import { toNumber } from './strategies/base-strategy';

// Types
export interface ConvertBacktestToPortfolioOptions {
  name: string;
  description?: string;
  startDate: Date;
  monthlyContribution: number;
  importTransactionsAsTemplate?: boolean;
}

export interface GenerateBacktestFromPortfolioOptions {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  monthlyContribution: number;
}

/**
 * Portfolio-Backtest Integration Service
 */
export class PortfolioBacktestIntegrationService {
  
  /**
   * Convert a backtest configuration to a portfolio
   */
  static async convertBacktestToPortfolio(
    userId: string,
    backtestId: string,
    options: ConvertBacktestToPortfolioOptions
  ): Promise<string> {
    // Get backtest configuration - NO CACHE
    const backtest = await prisma.backtestConfig.findFirst({
      where: {
        id: backtestId,
        userId
      },
      include: {
        assets: true
      }
    });

    if (!backtest) {
      throw new Error('Backtest configuration not found');
    }

    // Convert backtest assets to portfolio assets format
    const portfolioAssets = backtest.assets.map(asset => ({
      ticker: asset.ticker,
      targetAllocation: Number(asset.targetAllocation)
    }));

    // Create portfolio
    const portfolioId = await PortfolioService.createPortfolio(userId, {
      name: options.name,
      description: options.description || `Carteira criada a partir do backtest: ${backtest.name}`,
      startDate: options.startDate,
      monthlyContribution: options.monthlyContribution,
      rebalanceFrequency: backtest.rebalanceFrequency as 'monthly' | 'quarterly' | 'yearly',
      assets: portfolioAssets,
      sourceBacktestId: backtestId
    });

    console.log(`✅ Portfolio created from backtest: ${portfolioId} (source: ${backtestId})`);

    return portfolioId;
  }

  /**
   * Generate a backtest from current portfolio composition
   */
  static async generateBacktestFromPortfolio(
    userId: string,
    portfolioId: string,
    options: GenerateBacktestFromPortfolioOptions
  ): Promise<string> {
    // Get portfolio configuration
    const portfolio = await PortfolioService.getPortfolioConfig(portfolioId, userId);
    
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    if (!portfolio.assets || portfolio.assets.length === 0) {
      throw new Error('Portfolio has no assets to backtest');
    }

    console.log(`📊 Validando ${portfolio.assets.length} ativos da carteira...`);

    // Get all tickers from portfolio
    const portfolioTickers = portfolio.assets.map(a => a.ticker);

    // Verify which assets exist in the database and get their dividend yield
    const companiesData = await prisma.company.findMany({
      where: {
        ticker: { in: portfolioTickers }
      },
      select: {
        ticker: true,
        financialData: {
          orderBy: { year: 'desc' },
          take: 3, // Last 3 years for average
          select: {
            dy: true
          }
        }
      }
    });

    const validCompanies = new Map(companiesData.map(c => [c.ticker, c]));
    const validAssets: Array<{ ticker: string; allocation: number; avgDividendYield: number }> = [];
    const invalidAssets: string[] = [];

    // Filter valid assets and calculate average dividend yield
    for (const asset of portfolio.assets) {
      const companyData = validCompanies.get(asset.ticker);
      
      if (!companyData) {
        invalidAssets.push(asset.ticker);
        console.log(`⚠️  ${asset.ticker} não encontrado na base de dados - será removido`);
        continue;
      }

      // Calculate average dividend yield from last 3 years
      // Note: dy in database is already in decimal format (e.g., 0.15 = 15%)
      const dividendYields = companyData.financialData
        .map(fd => toNumber(fd.dy))
        .filter(dy => dy !== null && dy > 0) as number[];

      const avgDividendYield = dividendYields.length > 0
        ? dividendYields.reduce((sum, dy) => sum + dy, 0) / dividendYields.length
        : 0;

      validAssets.push({
        ticker: asset.ticker,
        allocation: asset.targetAllocation,
        avgDividendYield: avgDividendYield // Already in decimal format
      });

      if (avgDividendYield > 0) {
        console.log(`✅ ${asset.ticker}: Dividend Yield médio = ${(avgDividendYield * 100).toFixed(2)}%`);
      } else {
        console.log(`✅ ${asset.ticker}: Sem dados de Dividend Yield`);
      }
    }

    if (validAssets.length === 0) {
      throw new Error('Nenhum ativo da carteira foi encontrado na base de dados');
    }

    if (invalidAssets.length > 0) {
      console.log(`\n⚠️  ${invalidAssets.length} ativo(s) removido(s): ${invalidAssets.join(', ')}`);
      console.log(`✅ ${validAssets.length} ativo(s) válido(s) mantido(s)`);
    }

    // Recalculate allocations for valid assets (normalize to 100%)
    const totalValidAllocation = validAssets.reduce((sum, a) => sum + a.allocation, 0);
    
    const backtestAssets = validAssets.map(asset => ({
      ticker: asset.ticker,
      allocation: asset.allocation / totalValidAllocation, // Normalize
      averageDividendYield: asset.avgDividendYield
    }));

    console.log('\n📊 Alocações ajustadas para backtest:');
    backtestAssets.forEach(asset => {
      console.log(`   ${asset.ticker}: ${(asset.allocation * 100).toFixed(2)}%${asset.averageDividendYield > 0 ? ` (DY: ${(asset.averageDividendYield * 100).toFixed(2)}%)` : ''}`);
    });

    // Create backtest configuration using BacktestService
    const backtestService = new BacktestService();
    
    const backtestId = await backtestService.saveBacktestConfig(userId, {
      assets: backtestAssets,
      startDate: options.startDate,
      endDate: options.endDate,
      initialCapital: options.initialCapital,
      monthlyContribution: options.monthlyContribution,
      rebalanceFrequency: portfolio.rebalanceFrequency as any
    }, options.name, options.description || `Backtest gerado a partir da carteira: ${portfolio.name}`);

    console.log(`\n✅ Backtest created from portfolio: ${backtestId} (source: ${portfolioId})`);
    if (invalidAssets.length > 0) {
      console.log(`   ⚠️  ${invalidAssets.length} ativo(s) não encontrado(s) na base e removido(s) do backtest`);
    }

    return backtestId;
  }

  /**
   * Check if a portfolio was created from a backtest
   */
  static async getPortfolioSource(portfolioId: string, userId: string): Promise<{
    hasSource: boolean;
    backtestId?: string;
    backtestName?: string;
  }> {
    // NO CACHE
    const portfolio = await prisma.portfolioConfig.findFirst({
      where: {
        id: portfolioId,
        userId
      },
      select: {
        sourceBacktestId: true
      }
    });

    if (!portfolio || !portfolio.sourceBacktestId) {
      return { hasSource: false };
    }

    // Get backtest name
    const backtest = await prisma.backtestConfig.findUnique({
      where: {
        id: portfolio.sourceBacktestId
      },
      select: {
        name: true
      }
    });

    return {
      hasSource: true,
      backtestId: portfolio.sourceBacktestId,
      backtestName: backtest?.name
    };
  }

  /**
   * Get portfolios created from a specific backtest
   */
  static async getPortfoliosFromBacktest(
    userId: string,
    backtestId: string
  ): Promise<Array<{
    id: string;
    name: string;
    createdAt: Date;
  }>> {
    // NO CACHE
    const portfolios = await prisma.portfolioConfig.findMany({
      where: {
        userId,
        sourceBacktestId: backtestId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return portfolios;
  }

  /**
   * Compare portfolio composition with its source backtest
   */
  static async compareWithSourceBacktest(
    userId: string,
    portfolioId: string
  ): Promise<{
    hasSource: boolean;
    isDifferent: boolean;
    differences?: {
      addedAssets: string[];
      removedAssets: string[];
      allocationChanges: Array<{
        ticker: string;
        backtestAllocation: number;
        portfolioAllocation: number;
        difference: number;
      }>;
    };
  }> {
    const source = await this.getPortfolioSource(portfolioId, userId);
    
    if (!source.hasSource || !source.backtestId) {
      return { hasSource: false, isDifferent: false };
    }

    // Get portfolio assets
    const portfolio = await PortfolioService.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // Get backtest assets
    const backtest = await prisma.backtestConfig.findUnique({
      where: {
        id: source.backtestId
      },
      include: {
        assets: true
      }
    });

    if (!backtest) {
      return { hasSource: true, isDifferent: false };
    }

    // Compare assets
    const portfolioTickers = new Set(portfolio.assets.map(a => a.ticker));
    const backtestTickers = new Set(backtest.assets.map(a => a.ticker));
    
    const addedAssets = Array.from(portfolioTickers).filter(t => !backtestTickers.has(t));
    const removedAssets = Array.from(backtestTickers).filter(t => !portfolioTickers.has(t));
    
    // Check allocation changes
    const allocationChanges: Array<{
      ticker: string;
      backtestAllocation: number;
      portfolioAllocation: number;
      difference: number;
    }> = [];

    for (const portfolioAsset of portfolio.assets) {
      const backtestAsset = backtest.assets.find(a => a.ticker === portfolioAsset.ticker);
      
      if (backtestAsset) {
        const backtestAlloc = Number(backtestAsset.targetAllocation);
        const portfolioAlloc = portfolioAsset.targetAllocation;
        const diff = Math.abs(backtestAlloc - portfolioAlloc);
        
        if (diff > 0.0001) { // Allow for rounding errors
          allocationChanges.push({
            ticker: portfolioAsset.ticker,
            backtestAllocation: backtestAlloc,
            portfolioAllocation: portfolioAlloc,
            difference: portfolioAlloc - backtestAlloc
          });
        }
      }
    }

    const isDifferent = addedAssets.length > 0 || removedAssets.length > 0 || allocationChanges.length > 0;

    return {
      hasSource: true,
      isDifferent,
      differences: {
        addedAssets,
        removedAssets,
        allocationChanges
      }
    };
  }

  /**
   * Sync portfolio with source backtest (update allocations to match)
   */
  static async syncWithSourceBacktest(
    userId: string,
    portfolioId: string
  ): Promise<void> {
    const source = await this.getPortfolioSource(portfolioId, userId);
    
    if (!source.hasSource || !source.backtestId) {
      throw new Error('Portfolio was not created from a backtest');
    }

    // Get backtest assets
    const backtest = await prisma.backtestConfig.findUnique({
      where: {
        id: source.backtestId
      },
      include: {
        assets: true
      }
    });

    if (!backtest) {
      throw new Error('Source backtest not found');
    }

    // Get current portfolio
    const portfolio = await PortfolioService.getPortfolioConfig(portfolioId, userId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // Remove assets not in backtest
    const backtestTickers = new Set(backtest.assets.map(a => a.ticker));
    for (const portfolioAsset of portfolio.assets) {
      if (!backtestTickers.has(portfolioAsset.ticker)) {
        await PortfolioService.removeAsset(portfolioId, userId, portfolioAsset.ticker);
      }
    }

    // Add/update assets from backtest
    const portfolioTickers = new Set(portfolio.assets.map(a => a.ticker));
    for (const backtestAsset of backtest.assets) {
      const allocation = Number(backtestAsset.targetAllocation);
      
      if (portfolioTickers.has(backtestAsset.ticker)) {
        // Update allocation
        await PortfolioService.updateAssetAllocation(portfolioId, userId, backtestAsset.ticker, allocation);
      } else {
        // Add new asset
        await PortfolioService.addAsset(portfolioId, userId, backtestAsset.ticker, allocation);
      }
    }

    // Update rebalance frequency if different
    if (portfolio.rebalanceFrequency !== backtest.rebalanceFrequency) {
      await PortfolioService.updatePortfolio(portfolioId, userId, {
        rebalanceFrequency: backtest.rebalanceFrequency as 'monthly' | 'quarterly' | 'yearly'
      });
    }

    console.log(`✅ Portfolio synced with source backtest: ${portfolioId} <- ${source.backtestId}`);
  }
}

