/**
 * Confirm/Reject Suggestion API
 * POST /api/portfolio/[id]/transactions/suggestions/confirm
 * Creates a pending transaction from a suggestion and confirms/rejects it
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioTransactionService, SuggestedTransaction } from '@/lib/portfolio-transaction-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';
import { portfolioCache } from '@/lib/portfolio-cache';
import { revalidateTag } from 'next/cache';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { suggestion, action } = body; // action: 'confirm' | 'reject'

    if (!suggestion || !action || (action !== 'confirm' && action !== 'reject')) {
      return NextResponse.json(
        { error: 'Sugestão e ação (confirm/reject) são obrigatórios' },
        { status: 400 }
      );
    }

    // Convert suggestion to SuggestedTransaction format
    const suggestedTransaction: SuggestedTransaction = {
      date: new Date(suggestion.date),
      type: suggestion.type,
      ticker: suggestion.ticker,
      amount: suggestion.amount,
      price: suggestion.price,
      quantity: suggestion.quantity,
      reason: suggestion.notes || suggestion.reason || '',
      cashBalanceBefore: suggestion.cashBalanceBefore ?? 0,
      cashBalanceAfter: suggestion.cashBalanceAfter ?? 0,
    };

    // Create pending transaction first
    const transactionId = await PortfolioTransactionService.createSinglePendingTransaction(
      resolvedParams.id,
      currentUser.id,
      suggestedTransaction
    );

    // Now confirm or reject it
    if (action === 'confirm') {
      await PortfolioTransactionService.confirmTransaction(
        transactionId,
        currentUser.id
      );
    } else {
      await PortfolioTransactionService.rejectTransaction(
        transactionId,
        currentUser.id
      );
    }

    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    // Invalidate caches
    portfolioCache.invalidateAll(resolvedParams.id);
    revalidateTag(`portfolio-${resolvedParams.id}`);
    revalidateTag(`portfolio-metrics-${resolvedParams.id}`);
    revalidateTag(`portfolio-transactions-${resolvedParams.id}`);
    revalidateTag(`portfolio-analytics-${resolvedParams.id}`);

    return NextResponse.json({
      success: true,
      message: `Transação ${action === 'confirm' ? 'confirmada' : 'rejeitada'} com sucesso`,
      transactionId
    });

  } catch (error) {
    console.error('Erro ao processar sugestão:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao processar sugestão' },
      { status: 500 }
    );
  }
}

