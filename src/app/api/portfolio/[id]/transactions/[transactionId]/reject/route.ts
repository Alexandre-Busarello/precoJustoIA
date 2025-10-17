/**
 * Reject Transaction API
 * POST /api/portfolio/[id]/transactions/[transactionId]/reject
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

    const body = await request.json().catch(() => ({}));

    await PortfolioTransactionService.rejectTransaction(
      resolvedParams.transactionId,
      currentUser.id,
      body.reason
    );

    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      message: 'Transação rejeitada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao rejeitar transação:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao rejeitar transação' },
      { status: 500 }
    );
  }
}

