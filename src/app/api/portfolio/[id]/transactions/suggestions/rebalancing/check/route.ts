/**
 * Rebalancing Check API
 * 
 * GET /api/portfolio/[id]/transactions/suggestions/rebalancing/check - Check if rebalancing should be shown
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioTransactionService } from '@/lib/portfolio-transaction-service';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/portfolio/[id]/transactions/suggestions/rebalancing/check
 * Check if rebalancing should be shown based on portfolio deviation
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const threshold = searchParams.get('threshold')
      ? parseFloat(searchParams.get('threshold')!)
      : 0.05; // Default 5%

    const result = await PortfolioTransactionService.shouldShowRebalancing(
      resolvedParams.id,
      currentUser.id,
      threshold
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error('Erro ao verificar necessidade de rebalanceamento:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao verificar necessidade de rebalanceamento' },
      { status: 500 }
    );
  }
}

