/**
 * Portfolio Assets API Routes
 * 
 * POST /api/portfolio/[id]/assets - Add asset to portfolio
 * PATCH /api/portfolio/[id]/assets/[ticker] - Update asset allocation
 * DELETE /api/portfolio/[id]/assets/[ticker] - Remove asset
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioService } from '@/lib/portfolio-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/portfolio/[id]/assets
 * Add asset to portfolio
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    
    if (!body.ticker || !body.targetAllocation) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: ticker, targetAllocation' },
        { status: 400 }
      );
    }

    const assetId = await PortfolioService.addAsset(
      resolvedParams.id,
      currentUser.id,
      body.ticker,
      Number(body.targetAllocation)
    );

    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      assetId,
      message: 'Ativo adicionado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao adicionar ativo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao adicionar ativo' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/portfolio/[id]/assets
 * Update multiple asset allocations
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    
    if (!body.assets || !Array.isArray(body.assets)) {
      return NextResponse.json(
        { error: 'Campo obrigatório: assets (array)' },
        { status: 400 }
      );
    }

    // Update each asset allocation
    for (const asset of body.assets) {
      await PortfolioService.updateAssetAllocation(
        resolvedParams.id,
        currentUser.id,
        asset.ticker,
        Number(asset.targetAllocation)
      );
    }

    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      message: 'Alocações atualizadas com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar alocações:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar alocações' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/portfolio/[id]/assets
 * Update single asset allocation
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    
    if (!body.ticker || !body.targetAllocation) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: ticker, targetAllocation' },
        { status: 400 }
      );
    }

    await PortfolioService.updateAssetAllocation(
      resolvedParams.id,
      currentUser.id,
      body.ticker,
      Number(body.targetAllocation)
    );

    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      message: 'Alocação atualizada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar alocação:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar alocação' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portfolio/[id]/assets
 * Remove asset from portfolio
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Try to get ticker from body first, fallback to query params
    let ticker: string | null = null;
    try {
      const body = await request.json();
      ticker = body.ticker;
    } catch {
      const { searchParams } = new URL(request.url);
      ticker = searchParams.get('ticker');
    }

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker é obrigatório' },
        { status: 400 }
      );
    }

    await PortfolioService.removeAsset(resolvedParams.id, currentUser.id, ticker);

    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      message: 'Ativo removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover ativo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao remover ativo' },
      { status: 500 }
    );
  }
}

