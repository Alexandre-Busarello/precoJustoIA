/**
 * Contribution Suggestions API
 * 
 * GET /api/portfolio/[id]/transactions/suggestions/contributions - Get contribution suggestions (monthly contributions + buy transactions)
 * POST /api/portfolio/[id]/transactions/suggestions/contributions - Create pending transactions from contribution suggestions
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
 * GET /api/portfolio/[id]/transactions/suggestions/contributions
 * Generate and return contribution suggestions (monthly contributions + buy transactions)
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const suggestions = await PortfolioTransactionService.getContributionSuggestions(
      resolvedParams.id,
      currentUser.id
    );

    return NextResponse.json({
      suggestions,
      count: suggestions.length
    });

  } catch (error) {
    console.error('Erro ao gerar sugestões de contribuição:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar sugestões de contribuição' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portfolio/[id]/transactions/suggestions/contributions
 * Create pending transactions from contribution suggestions
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Get debug info before generating suggestions
    const { prisma } = await import('@/lib/prisma');
    const portfolio = await prisma.portfolioConfig.findUnique({
      where: { id: resolvedParams.id },
      select: {
        trackingStarted: true,
        monthlyContribution: true,
        assets: { select: { ticker: true, targetAllocation: true } },
        lastSuggestionsGeneratedAt: true
      }
    });

    const cashBalance = await PortfolioTransactionService.getCurrentCashBalance(resolvedParams.id);
    
    const suggestions = await PortfolioTransactionService.getContributionSuggestions(
      resolvedParams.id,
      currentUser.id
    );

    // Get debug info from the service
    const debugInfo = PortfolioTransactionService.getContributionSuggestionsDebug(resolvedParams.id);
    
    console.log('🔍 [API_DEBUG] Debug info retrieved:', debugInfo);

    if (suggestions.length === 0) {
      // Return debug info when no suggestions are generated
      const response = {
        success: true,
        message: 'Nenhuma sugestão de contribuição para criar',
        debug: {
          cashBalance,
          hasCashAvailable: cashBalance > 0.01,
          trackingStarted: portfolio?.trackingStarted,
          assetsCount: portfolio?.assets?.length || 0,
          monthlyContribution: portfolio?.monthlyContribution,
          lastSuggestionsGeneratedAt: portfolio?.lastSuggestionsGeneratedAt?.toISOString() || null,
          suggestionsGenerated: 0,
          // Merge debug info if available
          ...(debugInfo ? {
            nextDatesLength: debugInfo.nextDatesLength,
            monthlyContributionDecided: debugInfo.monthlyContributionDecided,
            shouldGenerateBuys: debugInfo.shouldGenerateBuys,
            portfolioAssets: debugInfo.portfolioAssets,
            holdingsCount: debugInfo.holdingsCount,
            pricesCount: debugInfo.pricesCount,
            suggestionsBeforeFilter: debugInfo.suggestionsBeforeFilter,
            suggestionsAfterFilter: debugInfo.suggestionsAfterFilter,
            currentMonthContribution: debugInfo.currentMonthContribution
          } : {
            debugInfoAvailable: false,
            note: 'Debug info not available - check server logs'
          })
        }
      };
      
      console.log('📤 [API_RESPONSE] Returning response with debug:', JSON.stringify(response.debug, null, 2));
      
      // Clear debug info after use
      PortfolioTransactionService.clearContributionSuggestionsDebug(resolvedParams.id);
      
      return NextResponse.json(response);
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
      message: `${transactionIds.length} sugestões de contribuição criadas`,
      debug: {
        cashBalance,
        hasCashAvailable: cashBalance > 0.01,
        suggestionsGenerated: suggestions.length,
        suggestionsCreated: transactionIds.length
      }
    });

  } catch (error) {
    console.error('Erro ao criar sugestões de contribuição:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar sugestões de contribuição' },
      { status: 500 }
    );
  }
}

