/**
 * API: Get Index Details
 * GET /api/indices/[ticker]
 * 
 * Retorna detalhes completos de um índice específico
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker: tickerParam } = await params;
    const ticker = tickerParam.toUpperCase();

    const index = await prisma.indexDefinition.findUnique({
      where: { ticker },
      include: {
        history: {
          orderBy: { date: 'desc' },
          take: 1
        },
        composition: {
          orderBy: { assetTicker: 'asc' }
        }
      }
    });

    if (!index) {
      return NextResponse.json(
        { success: false, error: 'Índice não encontrado' },
        { status: 404 }
      );
    }

    const latestPoint = index.history[0];
    const initialPoints = 100.0;
    const currentPoints = latestPoint?.points || initialPoints;
    const accumulatedReturn = ((currentPoints - initialPoints) / initialPoints) * 100;

    // Calcular total de dividendos recebidos desde o início
    const totalDividendsResult = await prisma.indexHistoryPoints.aggregate({
      where: { indexId: index.id },
      _sum: {
        dividendsReceived: true
      }
    });
    const totalDividendsReceived = totalDividendsResult._sum.dividendsReceived 
      ? Number(totalDividendsResult._sum.dividendsReceived) 
      : 0;

    // Buscar dados dos ativos na composição
    const compositionWithDetails = await Promise.all(
      index.composition.map(async (comp) => {
        const company = await prisma.company.findUnique({
          where: { ticker: comp.assetTicker },
          select: {
            name: true,
            logoUrl: true,
            sector: true,
            financialData: {
              orderBy: { year: 'desc' },
              take: 1,
              select: {
                dy: true
              }
            }
          }
        });

        // Buscar preço atual
        const { getTickerPrice } = await import('@/lib/quote-service');
        const priceData = await getTickerPrice(comp.assetTicker);
        const currentPrice = priceData?.price || comp.entryPrice;

        // Calcular variação desde entrada
        const entryReturn = ((currentPrice - comp.entryPrice) / comp.entryPrice) * 100;

        return {
          ticker: comp.assetTicker,
          name: company?.name || comp.assetTicker,
          logoUrl: company?.logoUrl || null,
          sector: company?.sector || null,
          targetWeight: comp.targetWeight,
          entryPrice: comp.entryPrice,
          entryDate: comp.entryDate,
          currentPrice,
          entryReturn,
          dividendYield: company?.financialData[0]?.dy 
            ? Number(company.financialData[0].dy) * 100 
            : null
        };
      })
    );

    return NextResponse.json({
      success: true,
      index: {
        id: index.id,
        ticker: index.ticker,
        name: index.name,
        description: index.description,
        color: index.color,
        methodology: index.methodology,
        config: index.config,
        currentPoints,
        accumulatedReturn,
        currentYield: latestPoint?.currentYield || null,
        dailyChange: latestPoint?.dailyChange || null,
        lastUpdate: latestPoint?.date || null,
        totalDividendsReceived,
        composition: compositionWithDetails,
        createdAt: index.createdAt
      }
    });
  } catch (error) {
    const { ticker: tickerParam } = await params;
    console.error(`❌ [API INDICES] Error getting index ${tickerParam}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar índice'
      },
      { status: 500 }
    );
  }
}

