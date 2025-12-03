/**
 * API: Get Index Rebalance Log
 * GET /api/indices/[ticker]/rebalance-log?limit=50
 * 
 * Retorna timeline de mudanças (rebalanceamentos) do índice
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
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

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

    const logs = await prisma.indexRebalanceLog.findMany({
      where: { indexId: index.id },
      orderBy: { date: 'desc' },
      take: limit,
      select: {
        id: true,
        date: true,
        action: true,
        ticker: true,
        reason: true
      }
    });

    return NextResponse.json({
      success: true,
      logs: logs.map(log => ({
        id: log.id,
        date: log.date.toISOString().split('T')[0],
        action: log.action,
        ticker: log.ticker,
        reason: log.reason
      }))
    });
  } catch (error) {
    const { ticker: tickerParam } = await params;
    console.error(`❌ [API INDICES] Error getting rebalance log for ${tickerParam}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar log de rebalanceamento'
      },
      { status: 500 }
    );
  }
}

