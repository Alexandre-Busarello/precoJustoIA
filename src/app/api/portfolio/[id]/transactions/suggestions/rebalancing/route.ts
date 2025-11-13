/**
 * Rebalancing Suggestions API
 * 
 * GET /api/portfolio/[id]/transactions/suggestions/rebalancing - Get rebalancing suggestions
 * POST /api/portfolio/[id]/transactions/suggestions/rebalancing - Create pending transactions from rebalancing suggestions
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
 * GET /api/portfolio/[id]/transactions/suggestions/rebalancing
 * Generate and return rebalancing suggestions
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const suggestions = await PortfolioTransactionService.getRebalancingSuggestions(
      resolvedParams.id,
      currentUser.id
    );

    return NextResponse.json({
      suggestions,
      count: suggestions.length
    });

  } catch (error) {
    console.error('Erro ao gerar sugestões de rebalanceamento:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar sugestões de rebalanceamento' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portfolio/[id]/transactions/suggestions/rebalancing
 * Create pending transactions from rebalancing suggestions
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const suggestions = await PortfolioTransactionService.getRebalancingSuggestions(
      resolvedParams.id,
      currentUser.id
    );

    if (suggestions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma sugestão de rebalanceamento para criar'
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
      message: `${transactionIds.length} sugestões de rebalanceamento criadas`
    });

  } catch (error) {
    console.error('Erro ao criar sugestões de rebalanceamento:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar sugestões de rebalanceamento' },
      { status: 500 }
    );
  }
}

