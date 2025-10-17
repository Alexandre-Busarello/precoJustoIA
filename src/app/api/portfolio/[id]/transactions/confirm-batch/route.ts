/**
 * Batch Confirm Transactions API
 * POST /api/portfolio/[id]/transactions/confirm-batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioTransactionService } from '@/lib/portfolio-transaction-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';

interface RouteContext {
  params: Promise<{
    id: string;
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

    const body = await request.json();
    
    if (!body.transactionIds || !Array.isArray(body.transactionIds)) {
      return NextResponse.json(
        { error: 'transactionIds (array) é obrigatório' },
        { status: 400 }
      );
    }

    await PortfolioTransactionService.confirmBatchTransactions(
      body.transactionIds,
      currentUser.id
    );

    // CRITICAL: Recalculate cash balances after batch confirmation
    await PortfolioTransactionService.recalculateCashBalances(resolvedParams.id);

    // Recalculate metrics once
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      count: body.transactionIds.length,
      message: `${body.transactionIds.length} transações confirmadas com sucesso`
    });

  } catch (error) {
    console.error('Erro ao confirmar transações em lote:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao confirmar transações em lote' },
      { status: 500 }
    );
  }
}

