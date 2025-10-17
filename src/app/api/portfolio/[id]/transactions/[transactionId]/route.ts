/**
 * Individual Transaction API
 * 
 * PATCH /api/portfolio/[id]/transactions/[transactionId] - Update transaction
 * DELETE /api/portfolio/[id]/transactions/[transactionId] - Delete transaction
 * POST /api/portfolio/[id]/transactions/[transactionId]/confirm - Confirm transaction
 * POST /api/portfolio/[id]/transactions/[transactionId]/reject - Reject transaction
 * POST /api/portfolio/[id]/transactions/[transactionId]/revert - Revert transaction to pending
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

/**
 * PATCH /api/portfolio/[id]/transactions/[transactionId]
 * Update transaction
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
    
    const updates: any = {};
    if (body.date) updates.date = new Date(body.date);
    if (body.amount) updates.amount = Number(body.amount);
    if (body.price !== undefined) updates.price = body.price ? Number(body.price) : null;
    if (body.quantity !== undefined) updates.quantity = body.quantity ? Number(body.quantity) : null;
    if (body.notes !== undefined) updates.notes = body.notes;

    await PortfolioTransactionService.updateTransaction(
      resolvedParams.transactionId,
      currentUser.id,
      updates
    );

    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      message: 'Transação atualizada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar transação:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar transação' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portfolio/[id]/transactions/[transactionId]
 * Delete transaction
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    await PortfolioTransactionService.deleteTransaction(
      resolvedParams.transactionId,
      currentUser.id
    );

    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      message: 'Transação excluída com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir transação:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao excluir transação' },
      { status: 500 }
    );
  }
}

