/**
 * Revert Transaction API
 * POST /api/portfolio/[id]/transactions/[transactionId]/revert
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioTransactionService } from '@/lib/portfolio-transaction-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';

interface RouteContext {
  params: Promise<{
    id: string;
    transactionId: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    await PortfolioTransactionService.revertTransaction(
      resolvedParams.transactionId,
      currentUser.id
    );

    // OPTIONAL: Recalculate cash balance history for auditing
    // Note: This is expensive (O(n) with N writes) but keeps cashBalanceBefore/After accurate
    // The actual cash balance is calculated via fast aggregation in getCurrentCashBalance()
    // This can be removed if historical balance tracking is not needed
    await PortfolioTransactionService.recalculateCashBalances(resolvedParams.id);

    // Recalculate metrics since we're reverting a confirmed transaction
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      message: 'Transação revertida para pendente com sucesso'
    });

  } catch (error) {
    console.error('Erro ao reverter transação:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao reverter transação' },
      { status: 500 }
    );
  }
}

