/**
 * Dividend Suggestions API
 * 
 * GET /api/portfolio/[id]/transactions/suggestions/dividends - Get dividend suggestions
 * POST /api/portfolio/[id]/transactions/suggestions/dividends - Create pending transactions from dividend suggestions
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
 * GET /api/portfolio/[id]/transactions/suggestions/dividends
 * Generate and return dividend suggestions
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const suggestions = await PortfolioTransactionService.getDividendSuggestions(
      resolvedParams.id,
      currentUser.id
    );

    return NextResponse.json({
      suggestions,
      count: suggestions.length
    });

  } catch (error) {
    console.error('Erro ao gerar sugestões de dividendos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar sugestões de dividendos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portfolio/[id]/transactions/suggestions/dividends
 * Create pending transactions from dividend suggestions
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const suggestions = await PortfolioTransactionService.getDividendSuggestions(
      resolvedParams.id,
      currentUser.id
    );

    if (suggestions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma sugestão de dividendo para criar',
        transactionIds: []
      });
    }

    const transactionIds = await PortfolioTransactionService.createPendingTransactions(
      resolvedParams.id,
      currentUser.id,
      suggestions
    );

    return NextResponse.json({
      success: true,
      message: `${transactionIds.length} sugestão(ões) de dividendo criada(s)`,
      transactionIds
    });

  } catch (error) {
    console.error('Erro ao criar sugestões de dividendos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar sugestões de dividendos' },
      { status: 500 }
    );
  }
}

