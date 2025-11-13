/**
 * Batch Reject Transactions API
 * POST /api/portfolio/[id]/transactions/reject-batch
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

    // Reject all transactions
    await Promise.all(
      body.transactionIds.map((transactionId: string) =>
        PortfolioTransactionService.rejectTransaction(
          transactionId,
          currentUser.id,
          'Rejeitado em lote pelo usuário'
        )
      )
    );

    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    // 🔄 INVALIDAR CACHE
    portfolioCache.invalidateAll(resolvedParams.id);
    
    // Invalidar cache do Next.js
    revalidateTag(`portfolio-${resolvedParams.id}`);
    revalidateTag(`portfolio-metrics-${resolvedParams.id}`);
    revalidateTag(`portfolio-transactions-${resolvedParams.id}`);
    revalidateTag(`portfolio-analytics-${resolvedParams.id}`);

    return NextResponse.json({
      success: true,
      count: body.transactionIds.length,
      message: `${body.transactionIds.length} transações rejeitadas com sucesso`
    });

  } catch (error) {
    console.error('Erro ao rejeitar transações em lote:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao rejeitar transações em lote' },
      { status: 500 }
    );
  }
}

