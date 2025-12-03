/**
 * API: Get Index Composition
 * GET /api/indices/[ticker]/composition
 * 
 * Retorna composição atual do índice
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

    // Buscar dados detalhados dos ativos
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
      composition: compositionWithDetails
    });
  } catch (error) {
    const { ticker: tickerParam } = await params;
    console.error(`❌ [API INDICES] Error getting composition for ${tickerParam}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar composição'
      },
      { status: 500 }
    );
  }
}

