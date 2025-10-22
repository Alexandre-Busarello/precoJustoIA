/**
 * Reject Transaction API
 * POST /api/portfolio/[id]/transactions/[transactionId]/reject
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

    await PortfolioTransactionService.rejectTransaction(
      resolvedParams.transactionId,
      currentUser.id,
      body.reason
    );

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
    // Após rejeitar uma transação, novas sugestões devem ser geradas
    try {
      // Deletar transações pendentes antigas (que podem estar desatualizadas)
      await fetch(`${process.env.NEXTAUTH_URL}/api/portfolio/${resolvedParams.id}/transactions/pending`, {
        method: 'DELETE'
      });
      
      // Gerar novas sugestões baseadas no novo estado da carteira
      await fetch(`${process.env.NEXTAUTH_URL}/api/portfolio/${resolvedParams.id}/transactions/suggestions`, {
        method: 'POST'
      });
      
      console.log('✅ Sugestões recalculadas após rejeição de transação');
    } catch (suggestionError) {
      console.error('⚠️ Erro ao recalcular sugestões:', suggestionError);
      // Não falhar a rejeição por erro nas sugestões
    }

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

