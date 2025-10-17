/**
 * Confirm Transaction API
 * POST /api/portfolio/[id]/transactions/[transactionId]/confirm
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioTransactionService } from '@/lib/portfolio-transaction-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';

interface RouteContext {
  params: {
    id: string;
    transactionId: string;
  };
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
    
    const updates: any = {};
    if (body.amount) updates.amount = Number(body.amount);
    if (body.price) updates.price = Number(body.price);
    if (body.quantity) updates.quantity = Number(body.quantity);

    await PortfolioTransactionService.confirmTransaction(
      resolvedParams.transactionId,
      currentUser.id,
      Object.keys(updates).length > 0 ? updates : undefined
    );

    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      message: 'Transação confirmada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao confirmar transação:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao confirmar transação' },
      { status: 500 }
    );
  }
}

