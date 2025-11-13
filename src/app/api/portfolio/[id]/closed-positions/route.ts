/**
 * Portfolio Closed Positions API
 * GET /api/portfolio/[id]/closed-positions - Get closed positions with realized returns
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Get closed positions (assets that were fully sold)
    const closedPositions = await PortfolioMetricsService.getClosedPositions(resolvedParams.id);

    return NextResponse.json({
      closedPositions: closedPositions.map(pos => ({
        ...pos,
        closedDate: pos.closedDate.toISOString().split('T')[0] // Format date as YYYY-MM-DD
      })),
      count: closedPositions.length
    });

  } catch (error) {
    console.error('Erro ao buscar posições encerradas:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar posições encerradas' },
      { status: 500 }
    );
  }
}

