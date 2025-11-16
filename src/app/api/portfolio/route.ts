/**
 * Portfolio API Routes
 * 
 * POST /api/portfolio - Create new portfolio
 * GET /api/portfolio - List user's portfolios
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isCurrentUserPremium } from '@/lib/user-service';
import { PortfolioService } from '@/lib/portfolio-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';
import { validateTicker } from '@/lib/quote-service';
import { AssetRegistrationService } from '@/lib/asset-registration-service';

/**
 * POST /api/portfolio
 * Create a new portfolio
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Check portfolio limit for FREE users
    const isPremium = await isCurrentUserPremium();
    
    if (!isPremium) {
      const portfolioCount = await PortfolioService.countUserPortfolios(currentUser.id);
      
      if (portfolioCount >= 1) {
        return NextResponse.json(
          {
            error: 'Usuários gratuitos estão limitados a 1 carteira. Faça upgrade para Premium para carteiras ilimitadas.',
            requiresPremium: true
          },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    
    // Validate required fields (assets is optional - can be added later)
    if (!body.name || !body.startDate || !body.monthlyContribution) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando: name, startDate, monthlyContribution' },
        { status: 400 }
      );
    }

    // Validate assets array (can be empty - assets can be added later)
    if (body.assets !== undefined && !Array.isArray(body.assets)) {
      return NextResponse.json(
        { error: 'Campo assets deve ser um array' },
        { status: 400 }
      );
    }

    // Default to empty array if assets not provided
    const assetsArray = Array.isArray(body.assets) ? body.assets : [];

    // Normalize allocations if there are assets
    let normalizedAssets: any[] = [];
    
    if (assetsArray.length > 0) {
      normalizedAssets = assetsArray.map((a: any) => ({
        ticker: a.ticker.toUpperCase().trim(),
        targetAllocation: Number(a.targetAllocation) || 0
      }));
      
      const totalAllocation = normalizedAssets.reduce((sum: number, a: any) => sum + a.targetAllocation, 0);
      
      // If no allocation provided or doesn't sum to 100%, distribute equally
      if (totalAllocation === 0 || Math.abs(totalAllocation - 1.0) > 0.01) {
        const equalAllocation = 1 / normalizedAssets.length;
        normalizedAssets = normalizedAssets.map((a: any) => ({
          ...a,
          targetAllocation: equalAllocation
        }));
      } else if (totalAllocation !== 1.0) {
        // Normalize to exactly 100%
        normalizedAssets = normalizedAssets.map((a: any) => ({
          ...a,
          targetAllocation: a.targetAllocation / totalAllocation
        }));
      }

      // Validate all tickers before creating portfolio
      const invalidTickers: string[] = [];
      for (const asset of normalizedAssets) {
        const ticker = asset.ticker;
        
        try {
          await validateTicker(ticker);
          
          // Register asset if it doesn't exist
          const registrationResult = await AssetRegistrationService.registerAsset(ticker);
          if (!registrationResult.success) {
            invalidTickers.push(ticker);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Ticker inválido';
          console.error(`❌ [PORTFOLIO CREATE] Ticker inválido: ${ticker} - ${errorMessage}`);
          invalidTickers.push(ticker);
        }
      }

      if (invalidTickers.length > 0) {
        return NextResponse.json(
          { 
            error: `Os seguintes tickers não foram encontrados no Yahoo Finance: ${invalidTickers.join(', ')}`,
            invalidTickers,
            code: 'INVALID_TICKERS'
          },
          { status: 400 }
        );
      }
    }

    // Create portfolio
    const portfolioId = await PortfolioService.createPortfolio(currentUser.id, {
      name: body.name,
      description: body.description,
      startDate: new Date(body.startDate),
      monthlyContribution: Number(body.monthlyContribution),
      rebalanceFrequency: body.rebalanceFrequency || 'monthly',
      assets: normalizedAssets,
      sourceBacktestId: body.sourceBacktestId
    });

    // Initialize metrics with zeros
    await PortfolioMetricsService.updateMetrics(portfolioId, currentUser.id);

    return NextResponse.json({
      success: true,
      portfolioId,
      message: 'Carteira criada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao criar carteira:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar carteira' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/portfolio
 * List user's portfolios with basic metrics
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const portfolios = await PortfolioService.getUserPortfolios(currentUser.id);

    // Enrich with basic metrics (from cached metrics table)
    const enriched = await Promise.all(
      portfolios.map(async (portfolio: any) => {
        try {
          const metrics = await PortfolioMetricsService.getMetrics(portfolio.id, currentUser.id);
          
          return {
            id: portfolio.id,
            name: portfolio.name,
            description: portfolio.description,
            startDate: portfolio.startDate,
            monthlyContribution: Number(portfolio.monthlyContribution),
            rebalanceFrequency: portfolio.rebalanceFrequency,
            trackingStarted: portfolio.trackingStarted, // Add this field
            createdAt: portfolio.createdAt,
            assetCount: portfolio.assets.length,
            metrics: metrics ? {
              currentValue: metrics.currentValue,
              totalInvested: metrics.totalInvested,
              totalReturn: metrics.totalReturn,
              cashBalance: metrics.cashBalance
            } : null
          };
        } catch (error) {
          // If metrics don't exist yet, return without them
          return {
            id: portfolio.id,
            name: portfolio.name,
            description: portfolio.description,
            startDate: portfolio.startDate,
            monthlyContribution: Number(portfolio.monthlyContribution),
            rebalanceFrequency: portfolio.rebalanceFrequency,
            trackingStarted: portfolio.trackingStarted, // Add this field
            createdAt: portfolio.createdAt,
            assetCount: portfolio.assets.length,
            metrics: null
          };
        }
      })
    );

    return NextResponse.json({
      portfolios: enriched,
      count: enriched.length
    });

  } catch (error) {
    console.error('Erro ao listar carteiras:', error);
    return NextResponse.json(
      { error: 'Erro ao listar carteiras' },
      { status: 500 }
    );
  }
}

