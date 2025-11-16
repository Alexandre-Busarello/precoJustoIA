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
    
    // Validate required fields
    if (!body.name || !body.startDate || !body.monthlyContribution || !body.assets) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando: name, startDate, monthlyContribution, assets' },
        { status: 400 }
      );
    }

    // Validate assets
    if (!Array.isArray(body.assets) || body.assets.length === 0) {
      return NextResponse.json(
        { error: 'A carteira deve ter pelo menos um ativo' },
        { status: 400 }
      );
    }

    // Validate total allocation = 100%
    const totalAllocation = body.assets.reduce((sum: number, a: any) => sum + (a.targetAllocation || 0), 0);
    if (Math.abs(totalAllocation - 1.0) > 0.01) {
      return NextResponse.json(
        { error: `Alocação total deve ser 100%. Atual: ${(totalAllocation * 100).toFixed(2)}%` },
        { status: 400 }
      );
    }

    // Validate all tickers before creating portfolio
    const invalidTickers: string[] = [];
    for (const asset of body.assets) {
      const ticker = asset.ticker.toUpperCase().trim();
      
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

    // Create portfolio
    const portfolioId = await PortfolioService.createPortfolio(currentUser.id, {
      name: body.name,
      description: body.description,
      startDate: new Date(body.startDate),
      monthlyContribution: Number(body.monthlyContribution),
      rebalanceFrequency: body.rebalanceFrequency || 'monthly',
      assets: body.assets.map((a: any) => ({
        ticker: a.ticker.toUpperCase(),
        targetAllocation: Number(a.targetAllocation)
      })),
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

