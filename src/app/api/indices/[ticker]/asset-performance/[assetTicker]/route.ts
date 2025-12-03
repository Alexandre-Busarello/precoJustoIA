/**
 * API: Get Single Asset Performance
 * GET /api/indices/[ticker]/asset-performance/[assetTicker]
 * 
 * Retorna performance detalhada de um ativo específico no índice
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateAssetPerformance } from '@/lib/index-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string; assetTicker: string }> }
) {
  try {
    const { ticker: tickerParam, assetTicker: assetTickerParam } = await params;
    const ticker = tickerParam.toUpperCase();
    const assetTicker = assetTickerParam.toUpperCase();

    const index = await prisma.indexDefinition.findUnique({
      where: { ticker },
      select: { id: true }
    });

    if (!index) {
      return NextResponse.json(
        { success: false, error: 'Índice não encontrado' },
        { status: 404 }
      );
    }

    const performance = await calculateAssetPerformance(index.id, assetTicker);

    if (!performance) {
      return NextResponse.json(
        { success: false, error: 'Ativo não encontrado no histórico do índice' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      performance: {
        ticker: performance.ticker,
        entryDate: performance.entryDate.toISOString().split('T')[0],
        exitDate: performance.exitDate ? performance.exitDate.toISOString().split('T')[0] : null,
        entryPrice: performance.entryPrice,
        exitPrice: performance.exitPrice,
        daysInIndex: performance.daysInIndex,
        totalReturn: performance.totalReturn,
        contributionToIndex: performance.contributionToIndex,
        averageWeight: performance.averageWeight,
        status: performance.status,
        firstSnapshotDate: performance.firstSnapshotDate.toISOString().split('T')[0],
        lastSnapshotDate: performance.lastSnapshotDate.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    const { assetTicker: assetTickerParam } = await params;
    console.error(`❌ [API INDICES] Error getting asset performance for ${assetTickerParam}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar performance do ativo'
      },
      { status: 500 }
    );
  }
}

