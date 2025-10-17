/**
 * Portfolio Holdings API
 * GET /api/portfolio/[id]/holdings - Get current holdings with prices
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Get current holdings with real-time prices from Yahoo Finance
    // This always fetches fresh prices, not cached
    const holdings = await PortfolioMetricsService.getCurrentHoldings(resolvedParams.id);

    return NextResponse.json({
      holdings,
      count: holdings.length
    });

  } catch (error) {
    console.error('Erro ao buscar posições:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar posições' },
      { status: 500 }
    );
  }
}

