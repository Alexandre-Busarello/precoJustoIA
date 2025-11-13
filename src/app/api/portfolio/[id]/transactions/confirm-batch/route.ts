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

    // OPTIONAL: Recalculate cash balance history for auditing
    // Note: This is expensive (O(n) with N writes) but keeps cashBalanceBefore/After accurate
    // The actual cash balance is calculated via fast aggregation in getCurrentCashBalance()
    // This can be removed if historical balance tracking is not needed
    await PortfolioTransactionService.recalculateCashBalances(resolvedParams.id);

    // Recalculate metrics once
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    // 🔄 REGENERAR SUGESTÕES AUTOMATICAMENTE
    // Após confirmar transações (especialmente aportes), novas sugestões devem ser geradas
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      
      // Check if any of the confirmed transactions is MONTHLY_CONTRIBUTION
      const { prisma } = await import('@/lib/prisma');
      const confirmedTransactions = await prisma.portfolioTransaction.findMany({
        where: {
          id: { in: body.transactionIds },
          portfolioId: resolvedParams.id
        },
        select: { type: true }
      });
      
      const hasMonthlyContribution = confirmedTransactions.some(
        tx => tx.type === 'MONTHLY_CONTRIBUTION'
      );
      
      if (hasMonthlyContribution) {
        console.log('💰 [BATCH_MONTHLY_CONFIRMED] Monthly contribution confirmed in batch, will generate buy suggestions');
      }
      
      // Reset lastSuggestionsGeneratedAt to force regeneration
      await prisma.portfolioConfig.update({
        where: { id: resolvedParams.id },
        data: { lastSuggestionsGeneratedAt: null }, // Reset to force regeneration
      }).catch(() => {});
      
      // Deletar transações pendentes antigas (que podem estar desatualizadas)
      await fetch(`${baseUrl}/api/portfolio/${resolvedParams.id}/transactions/pending`, {
        method: 'DELETE'
      }).catch(() => {});
      
      // Wait a bit to ensure transactions are fully processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Gerar novas sugestões de contribuição baseadas no novo estado da carteira
      // This will generate buy suggestions if monthly contribution was confirmed
      await fetch(`${baseUrl}/api/portfolio/${resolvedParams.id}/transactions/suggestions/contributions`, {
        method: 'POST'
      }).catch(() => {});
      
      console.log('✅ Sugestões de contribuição recalculadas após confirmação em lote');
    } catch (suggestionError) {
      console.error('⚠️ Erro ao recalcular sugestões:', suggestionError);
      // Não falhar a confirmação por erro nas sugestões
    }

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

