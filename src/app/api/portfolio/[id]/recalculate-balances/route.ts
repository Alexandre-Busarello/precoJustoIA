/**
 * Recalculate Cash Balances API
 * POST /api/portfolio/[id]/recalculate-balances - Recalculate all transaction cash balances
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioTransactionService } from '@/lib/portfolio-transaction-service';
import { PortfolioService } from '@/lib/portfolio-service';

interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * POST /api/portfolio/[id]/recalculate-balances
 * Recalculate all transaction cash balances in chronological order
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Verify ownership
    const portfolio = await PortfolioService.getPortfolioConfig(resolvedParams.id, currentUser.id);
    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio não encontrado' }, { status: 404 });
    }

    // Recalculate all cash balances
    await PortfolioTransactionService.recalculateCashBalances(resolvedParams.id);

    return NextResponse.json({
      success: true,
      message: 'Saldos recalculados com sucesso'
    });

  } catch (error) {
    console.error('Erro ao recalcular saldos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao recalcular saldos' },
      { status: 500 }
    );
  }
}

