/**
 * Transaction Suggestions API
 * 
 * GET /api/portfolio/[id]/transactions/suggestions - Get suggested transactions
 * POST /api/portfolio/[id]/transactions/suggestions - Create pending transactions from suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioTransactionService } from '@/lib/portfolio-transaction-service';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/portfolio/[id]/transactions/suggestions
 * Generate and return transaction suggestions
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const suggestions = await PortfolioTransactionService.getSuggestedTransactions(
      resolvedParams.id,
      currentUser.id
    );

    return NextResponse.json({
      suggestions,
      count: suggestions.length
    });

  } catch (error) {
    console.error('Erro ao gerar sugestões:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar sugestões' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portfolio/[id]/transactions/suggestions
 * Create pending transactions from suggestions
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const suggestions = await PortfolioTransactionService.getSuggestedTransactions(
      resolvedParams.id,
      currentUser.id
    );

    if (suggestions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma transação pendente para criar'
      });
    }

    const transactionIds = await PortfolioTransactionService.createPendingTransactions(
      resolvedParams.id,
      currentUser.id,
      suggestions
    );

    return NextResponse.json({
      success: true,
      transactionIds,
      count: transactionIds.length,
      message: `${transactionIds.length} transações pendentes criadas`
    });

  } catch (error) {
    console.error('Erro ao criar transações pendentes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar transações pendentes' },
      { status: 500 }
    );
  }
}

