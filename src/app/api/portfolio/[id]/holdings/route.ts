/**
 * Portfolio Holdings API
 * GET /api/portfolio/[id]/holdings - Get current holdings with prices
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';
import { getCompanyBriefs } from '@/lib/company-brief';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Get current holdings with real-time prices from Yahoo Finance
    // This always fetches fresh prices, not cached
    const rawHoldings = await PortfolioMetricsService.getCurrentHoldings(resolvedParams.id);

    // Nome, logo e tipo do ativo para a lista (só leitura; sem cadastro, a UI mostra o monograma)
    const briefs = await getCompanyBriefs(rawHoldings.map((h) => h.ticker));
    const holdings = rawHoldings.map((h) => {
      const brief = briefs.get(h.ticker.toUpperCase());
      return { ...h, companyName: brief?.name ?? null, logoUrl: brief?.logoUrl ?? null, assetType: brief?.assetType ?? null };
    });

    return NextResponse.json({
      holdings,
      count: holdings.length
    });

  } catch (error) {
    console.error('Erro ao buscar posições:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar posições' },
      { status: 500 }
    );
  }
}

