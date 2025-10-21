/**
 * Portfolio Analytics API Endpoint
 * 
 * GET /api/portfolio/[id]/analytics
 * 
 * Returns comprehensive analytics data including:
 * - Monthly evolution of portfolio value
 * - Benchmark comparison (CDI, Ibovespa)
 * - Performance statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioAnalyticsService } from '@/lib/portfolio-analytics-service';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/portfolio/[id]/analytics
 * Get analytics data for a portfolio
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Verify authentication
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get portfolio ID from params
    const { id: portfolioId } = await context.params;

    if (!portfolioId) {
      return NextResponse.json(
        { error: 'Portfolio ID is required' },
        { status: 400 }
      );
    }

    console.log(`📊 [ANALYTICS API] Calculating analytics for portfolio ${portfolioId}...`);
    const startTime = Date.now();

    // Calculate analytics
    const analytics = await PortfolioAnalyticsService.calculateAnalytics(
      portfolioId,
      currentUser.id
    );

    const duration = Date.now() - startTime;
    console.log(`✅ [ANALYTICS API] Analytics calculated in ${duration}ms`);

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('[ANALYTICS API ERROR]:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Portfolio not found') {
        return NextResponse.json(
          { error: 'Portfolio not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to calculate analytics' },
      { status: 500 }
    );
  }
}

