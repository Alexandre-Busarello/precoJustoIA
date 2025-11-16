/**
 * Portfolio Dashboard API
 * 
 * GET /api/portfolio/dashboard - Get all portfolios with metrics for dashboard
 * Returns portfolios sorted by total return (best first) with all necessary data
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioService } from '@/lib/portfolio-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';

/**
 * GET /api/portfolio/dashboard
 * Get all user portfolios with metrics, sorted and ready for dashboard display
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Get all user portfolios
    const portfolios = await PortfolioService.getUserPortfolios(currentUser.id);

    if (portfolios.length === 0) {
      return NextResponse.json({
        portfolios: [],
        count: 0
      });
    }

    // Fetch metrics for each portfolio in parallel
    const portfoliosWithMetrics = await Promise.all(
      portfolios.map(async (portfolio: any) => {
        try {
          // Get current metrics
          let metrics = await PortfolioMetricsService.getMetrics(portfolio.id, currentUser.id);

          // Check if metrics are outdated (older than 5 minutes) or don't exist
          const needsRefresh = !metrics || 
            !metrics.lastCalculatedAt || 
            (Date.now() - new Date(metrics.lastCalculatedAt).getTime() > 5 * 60 * 1000);

          if (needsRefresh) {
            console.log(`🔄 [DASHBOARD] Recalculating metrics for portfolio ${portfolio.id} (outdated or missing)`);
            
            // Recalculate metrics with fresh prices
            await PortfolioMetricsService.updateMetrics(portfolio.id, currentUser.id);
            
            // Get updated metrics
            metrics = await PortfolioMetricsService.getMetrics(portfolio.id, currentUser.id);
          }

          if (!metrics) {
            return null;
          }

          // Format portfolio data for dashboard
          return {
            id: portfolio.id,
            name: portfolio.name,
            currentValue: metrics.currentValue || 0,
            cashBalance: metrics.cashBalance || 0,
            totalInvested: metrics.totalInvested || 0,
            totalReturn: metrics.totalReturn || 0,
            evolutionData: (metrics.evolutionData || []).slice(-6), // Last 6 months
          };
        } catch (error) {
          console.error(`Error fetching metrics for portfolio ${portfolio.id}:`, error);
          return null;
        }
      })
    );

    // Filter out null values and sort by return (best first)
    const validPortfolios = portfoliosWithMetrics
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => b.totalReturn - a.totalReturn);

    return NextResponse.json({
      portfolios: validPortfolios,
      count: validPortfolios.length
    });

  } catch (error) {
    console.error('Erro ao buscar carteiras do dashboard:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar carteiras do dashboard' },
      { status: 500 }
    );
  }
}

