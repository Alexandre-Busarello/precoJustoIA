/**
 * Portfolio Suggestions API
 * GET /api/portfolio/[id]/suggestions?type=rebalancing|contribution|dividends
 * 
 * Returns dynamic suggestions without saving to database
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
 * GET /api/portfolio/[id]/suggestions
 * Get dynamic suggestions for portfolio (rebalancing or contribution)
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'rebalancing';

    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    if (type === 'rebalancing') {
      // First check if there are contribution/buy suggestions
      // Rebalancing should only be shown AFTER contributions/buys are handled
      const contributionSuggestions = await PortfolioTransactionService.getContributionSuggestions(
        resolvedParams.id,
        currentUser.id
      );

      // Only show rebalancing if there are no contribution/buy suggestions
      if (contributionSuggestions.length > 0) {
        return NextResponse.json({
          type: 'rebalancing',
          suggestions: [],
          count: 0,
          message: 'Complete as transações de aporte e compra antes de rebalancear',
        });
      }

      // Get rebalancing suggestions (dynamic, not saved)
      const suggestions = await PortfolioTransactionService.getRebalancingSuggestions(
        resolvedParams.id,
        currentUser.id
      );

      // Group rebalancing suggestions into combined pairs (sell + buy)
      const combinedSuggestions = PortfolioTransactionService.combineRebalancingSuggestions(suggestions);

      // Convert Date objects to ISO strings for JSON serialization
      const formattedSuggestions = combinedSuggestions.map((suggestion: any) => ({
        ...suggestion,
        date: suggestion.date instanceof Date 
          ? suggestion.date.toISOString().split('T')[0]
          : suggestion.date,
        sellTransaction: suggestion.sellTransaction ? {
          ...suggestion.sellTransaction,
        } : null,
        sellTransactions: suggestion.sellTransactions ? suggestion.sellTransactions.map((st: any) => ({
          ...st,
          date: st.date instanceof Date 
            ? st.date.toISOString().split('T')[0]
            : st.date,
        })) : undefined,
        buyTransactions: suggestion.buyTransactions ? suggestion.buyTransactions.map((bt: any) => ({
          ...bt,
          date: bt.date instanceof Date 
            ? bt.date.toISOString().split('T')[0]
            : bt.date,
        })) : [],
      }));

      return NextResponse.json({
        type: 'rebalancing',
        suggestions: formattedSuggestions,
        count: formattedSuggestions.length,
      });
    } else if (type === 'contribution') {
      // Get contribution suggestions (dynamic, not saved)
      const suggestions = await PortfolioTransactionService.getContributionSuggestions(
        resolvedParams.id,
        currentUser.id
      );

      // Convert Date objects to ISO strings for JSON serialization
      const formattedSuggestions = suggestions.map(suggestion => ({
        ...suggestion,
        date: suggestion.date instanceof Date 
          ? suggestion.date.toISOString().split('T')[0]
          : suggestion.date,
      }));

      return NextResponse.json({
        type: 'contribution',
        suggestions: formattedSuggestions,
        count: formattedSuggestions.length,
      });
    } else if (type === 'dividends') {
      // Get dividend suggestions (dynamic, not saved)
      const suggestions = await PortfolioTransactionService.getDividendSuggestions(
        resolvedParams.id,
        currentUser.id
      );

      // Convert Date objects to ISO strings for JSON serialization
      const formattedSuggestions = suggestions.map(suggestion => ({
        ...suggestion,
        date: suggestion.date instanceof Date 
          ? suggestion.date.toISOString().split('T')[0]
          : suggestion.date,
      }));

      return NextResponse.json({
        type: 'dividends',
        suggestions: formattedSuggestions,
        count: formattedSuggestions.length,
      });
    } else {
      return NextResponse.json(
        { error: 'Tipo de sugestão inválido. Use "rebalancing", "contribution" ou "dividends"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Erro ao buscar sugestões:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro ao buscar sugestões',
      },
      { status: 500 }
    );
  }
}

