/**
 * API: Get All Assets Performance
 * GET /api/indices/[ticker]/asset-performance
 * 
 * Retorna performance individual de todos os ativos que passaram pelo índice
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listAllAssetsPerformance } from '@/lib/index-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker: tickerParam } = await params;
    const ticker = tickerParam.toUpperCase();

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

    const performances = await listAllAssetsPerformance(index.id);

    return NextResponse.json({
      success: true,
      performances: performances.map(perf => ({
        ticker: perf.ticker,
        entryDate: perf.entryDate.toISOString().split('T')[0],
        exitDate: perf.exitDate ? perf.exitDate.toISOString().split('T')[0] : null,
        entryPrice: perf.entryPrice,
        exitPrice: perf.exitPrice,
        daysInIndex: perf.daysInIndex,
        totalReturn: perf.totalReturn,
        contributionToIndex: perf.contributionToIndex,
        averageWeight: perf.averageWeight,
        status: perf.status,
        firstSnapshotDate: perf.firstSnapshotDate.toISOString().split('T')[0],
        lastSnapshotDate: perf.lastSnapshotDate.toISOString().split('T')[0]
      }))
    });
  } catch (error) {
    const { ticker: tickerParam } = await params;
    console.error(`❌ [API INDICES] Error getting assets performance for ${tickerParam}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar performance de ativos'
      },
      { status: 500 }
    );
  }
}

