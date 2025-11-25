import { NextRequest, NextResponse } from 'next/server';
import { DividendRadarService } from '@/lib/dividend-radar-service';
import { prisma } from '@/lib/prisma';

interface HistoricalDividend {
  month: number;
  year: number;
  exDate: Date;
  amount: number;
}

/**
 * GET /api/dividend-radar/projections/[ticker]
 * Retorna projeções de dividendos para um ticker específico + histórico dos últimos 6 meses
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker: tickerParam } = await params;
    const ticker = tickerParam.toUpperCase();

    // Buscar ou gerar projeções
    const projections = await DividendRadarService.getOrGenerateProjections(ticker);

    // Buscar histórico completo de dividendos (todos os dividendos pagos)
    const now = new Date();
    
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        id: true,
        dividendHistory: {
          orderBy: { exDate: 'desc' },
          select: {
            exDate: true,
            amount: true,
          },
        },
      },
    });

    // Histórico completo
    const allHistoricalDividends: HistoricalDividend[] = [];
    if (company?.dividendHistory) {
      company.dividendHistory.forEach((div) => {
        const divDate = new Date(div.exDate);
        allHistoricalDividends.push({
          month: divDate.getMonth() + 1,
          year: divDate.getFullYear(),
          exDate: divDate,
          amount: Number(div.amount),
        });
      });
    }

    // Histórico dos últimos 4 meses (para visualização resumida)
    const historicalCutoffDate = new Date(now.getFullYear(), now.getMonth() - 4, 1);
    const recentHistoricalDividends = allHistoricalDividends.filter(
      (h) => new Date(h.exDate) >= historicalCutoffDate && new Date(h.exDate) <= now
    );

    return NextResponse.json({
      success: true,
      ticker,
      projections, // Todas as projeções completas
      historicalDividends: recentHistoricalDividends, // Últimos 4 meses para visualização resumida
      allHistoricalDividends, // Histórico completo
      count: projections.length,
      historicalCount: recentHistoricalDividends.length,
      allHistoricalCount: allHistoricalDividends.length,
    });
  } catch (error) {
    console.error(`❌ [DIVIDEND RADAR API] Erro ao buscar projeções:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

