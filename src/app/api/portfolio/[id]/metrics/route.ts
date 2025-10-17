/**
 * Portfolio Metrics API
 * 
 * GET /api/portfolio/[id]/metrics - Get cached metrics
 * POST /api/portfolio/[id]/metrics/recalculate - Force recalculation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';

interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * GET /api/portfolio/[id]/metrics
 * Get portfolio metrics with auto-refresh if outdated
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Get current metrics
    let metrics = await PortfolioMetricsService.getMetrics(resolvedParams.id, currentUser.id);

    // Check if metrics are outdated (older than 5 minutes) or don't exist
    const needsRefresh = !metrics || 
      !metrics.lastCalculatedAt || 
      (Date.now() - new Date(metrics.lastCalculatedAt).getTime() > 5 * 60 * 1000);

    if (needsRefresh) {
      console.log(`🔄 [METRICS] Recalculating metrics for portfolio ${resolvedParams.id} (outdated or missing)`);
      
      // Recalculate metrics with fresh prices
      await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);
      
      // Get updated metrics
      metrics = await PortfolioMetricsService.getMetrics(resolvedParams.id, currentUser.id);
      
      console.log(`✅ [METRICS] Metrics refreshed with latest prices`);
    }

    return NextResponse.json({ metrics });

  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar métricas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portfolio/[id]/metrics
 * Force recalculation of metrics
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);
    const metrics = await PortfolioMetricsService.getMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      metrics,
      message: 'Métricas recalculadas com sucesso'
    });

  } catch (error) {
    console.error('Erro ao recalcular métricas:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao recalcular métricas' },
      { status: 500 }
    );
  }
}

