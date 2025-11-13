/**
 * GET /api/portfolio/[id]/transactions/suggestions/status
 * Get suggestion generation status (lastSuggestionsGeneratedAt)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { PortfolioTransactionService } from '@/lib/portfolio-transaction-service';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const portfolio = await prisma.portfolioConfig.findUnique({
      where: { id: resolvedParams.id },
      select: { 
        lastSuggestionsGeneratedAt: true,
        userId: true,
        trackingStarted: true
      },
    });

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    if (portfolio.userId !== currentUser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const lastGenerated = portfolio.lastSuggestionsGeneratedAt 
      ? new Date(portfolio.lastSuggestionsGeneratedAt)
      : null;

    const daysSinceGeneration = lastGenerated 
      ? Math.floor((now.getTime() - lastGenerated.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Check if there's cash available in the portfolio
    let cashBalance = 0;
    let hasCashAvailable = false;
    let hasPendingBuySuggestions = false;
    
    if (portfolio.trackingStarted) {
      try {
        cashBalance = await PortfolioTransactionService.getCurrentCashBalance(resolvedParams.id);
        
        // Check if there are already PENDING buy transactions (auto-suggested)
        // If there are, we shouldn't consider cash as "available" to avoid infinite loops
        const { prisma } = await import('@/lib/prisma');
        const pendingBuyTransactions = await prisma.portfolioTransaction.count({
          where: {
            portfolioId: resolvedParams.id,
            status: 'PENDING',
            type: 'BUY',
            isAutoSuggested: true
          }
        });
        
        hasPendingBuySuggestions = pendingBuyTransactions > 0;
        
        // Cash is only "available" if:
        // 1. There's cash balance > R$ 0.01 AND
        // 2. There are NO pending buy suggestions (to avoid infinite loops)
        hasCashAvailable = cashBalance > 0.01 && !hasPendingBuySuggestions;
      } catch (error) {
        console.error('Error getting cash balance:', error);
      }
    }

    // Needs regeneration if:
    // 1. Never generated before OR
    // 2. Generated more than 30 days ago OR
    // 3. Has cash available (always suggest buys when there's cash)
    const needsRegeneration = !lastGenerated || 
      lastGenerated < thirtyDaysAgo || 
      hasCashAvailable;

    return NextResponse.json({
      lastSuggestionsGeneratedAt: lastGenerated?.toISOString() || null,
      needsRegeneration,
      daysSinceGeneration,
      isRecent: !needsRegeneration && !hasCashAvailable, // Only recent if no cash available
      cashBalance,
      hasCashAvailable,
      hasPendingBuySuggestions
    });

  } catch (error) {
    console.error('Erro ao verificar status de sugestões:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao verificar status' },
      { status: 500 }
    );
  }
}

