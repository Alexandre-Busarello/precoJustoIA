/**
 * Confirm Transaction API
 * POST /api/portfolio/[id]/transactions/[transactionId]/confirm
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioTransactionService } from '@/lib/portfolio-transaction-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';
import { portfolioCache } from '@/lib/portfolio-cache';
import { revalidateTag } from 'next/cache';

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
    
    // Get transaction before confirming to check type
    const { prisma } = await import('@/lib/prisma');
    const transactionBeforeConfirm = await prisma.portfolioTransaction.findUnique({
      where: { id: resolvedParams.transactionId },
      select: { type: true, portfolioId: true }
    });
    
    const isMonthlyContribution = transactionBeforeConfirm?.type === 'MONTHLY_CONTRIBUTION';
    
    const updates: any = {};
    if (body.amount) updates.amount = Number(body.amount);
    if (body.price) updates.price = Number(body.price);
    if (body.quantity) updates.quantity = Number(body.quantity);

    await PortfolioTransactionService.confirmTransaction(
      resolvedParams.transactionId,
      currentUser.id,
      Object.keys(updates).length > 0 ? updates : undefined
    );

    // OPTIONAL: Recalculate cash balance history for auditing
    // Note: This is expensive (O(n) with N writes) but keeps cashBalanceBefore/After accurate
    // The actual cash balance is calculated via fast aggregation in getCurrentCashBalance()
    // This can be removed if historical balance tracking is not needed
    PortfolioTransactionService.recalculateCashBalances(resolvedParams.id);

    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    // 🔄 INVALIDAR CACHE E RECALCULAR SUGESTÕES
    // Invalidar todos os caches da carteira
    portfolioCache.invalidateAll(resolvedParams.id);
    
    // Invalidar cache do Next.js
    revalidateTag(`portfolio-${resolvedParams.id}`);
    revalidateTag(`portfolio-metrics-${resolvedParams.id}`);
    revalidateTag(`portfolio-transactions-${resolvedParams.id}`);
    revalidateTag(`portfolio-analytics-${resolvedParams.id}`);

    // 🎯 RECALCULAR SUGESTÕES AUTOMATICAMENTE
    // Após confirmar uma transação, novas sugestões devem ser geradas
    // Se foi um MONTHLY_CONTRIBUTION, especialmente importante gerar compras
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      
      if (isMonthlyContribution) {
        console.log('💰 [MONTHLY_CONFIRMED] Monthly contribution confirmed, will generate buy suggestions');
      }
      
      // Reset lastSuggestionsGeneratedAt to force regeneration
      // This ensures suggestions are regenerated when transactions affect cash flow
      await prisma.portfolioConfig.update({
        where: { id: resolvedParams.id },
        data: { lastSuggestionsGeneratedAt: null }, // Reset to force regeneration
      }).catch(() => {});
      
      // Deletar transações pendentes antigas (que podem estar desatualizadas)
      await fetch(`${baseUrl}/api/portfolio/${resolvedParams.id}/transactions/pending`, {
        method: 'DELETE'
      }).catch(() => {});
      
      // Wait a bit to ensure transaction is fully processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Gerar novas sugestões de contribuição baseadas no novo estado da carteira
      // This will generate buy suggestions if monthly contribution was confirmed
      await fetch(`${baseUrl}/api/portfolio/${resolvedParams.id}/transactions/suggestions/contributions`, {
        method: 'POST'
      }).catch(() => {});
      
      console.log('✅ Sugestões de contribuição recalculadas após confirmação de transação');
    } catch (suggestionError) {
      console.error('⚠️ Erro ao recalcular sugestões:', suggestionError);
      // Não falhar a confirmação por erro nas sugestões
    }

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

