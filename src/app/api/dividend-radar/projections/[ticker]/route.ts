import { NextRequest, NextResponse } from 'next/server';
import { DIVIDEND_PROJECTION_LABEL, DividendRadarService } from '@/lib/dividend-radar-service';
import { prisma } from '@/lib/prisma';
import { dividendTypeLabel, type DividendTypeLabel } from '@/app/agenda-proventos/agenda-model';

interface HistoricalDividend {
  month: number;
  year: number;
  exDate: Date;
  paymentDate: Date | null;
  amount: number;
  type: DividendTypeLabel;
}

/**
 * GET /api/dividend-radar/projections/[ticker]
 * Retorna projeções de dividendos (estimativa estatística, sem IA) para um ticker + histórico de proventos
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
            paymentDate: true,
            amount: true,
            type: true,
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
          month: divDate.getUTCMonth() + 1,
          year: divDate.getUTCFullYear(),
          exDate: divDate,
          paymentDate: div.paymentDate,
          amount: Number(div.amount),
          type: dividendTypeLabel(div.type),
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
      projectionMethod: DIVIDEND_PROJECTION_LABEL,
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

