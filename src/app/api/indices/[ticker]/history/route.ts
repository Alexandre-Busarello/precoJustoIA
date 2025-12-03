/**
 * API: Get Index History
 * GET /api/indices/[ticker]/history?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * 
 * Retorna histórico de pontos do índice
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
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Buscar índice
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

    // Construir query com filtros de data
    const whereClause: any = {
      indexId: index.id
    };

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        whereClause.date.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.date.lte = new Date(endDate);
      }
    }

    const history = await prisma.indexHistoryPoints.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
      select: {
        date: true,
        points: true,
        dailyChange: true,
        currentYield: true,
        dividendsReceived: true,
        dividendsByTicker: true
      }
    });

    return NextResponse.json({
      success: true,
      history: history.map(point => ({
        date: point.date.toISOString().split('T')[0],
        points: point.points,
        dailyChange: point.dailyChange,
        currentYield: point.currentYield,
        dividendsReceived: point.dividendsReceived ? Number(point.dividendsReceived) : null,
        dividendsByTicker: point.dividendsByTicker as Record<string, number> | null
      }))
    });
  } catch (error) {
    const { ticker: tickerParam } = await params;
    console.error(`❌ [API INDICES] Error getting history for ${tickerParam}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar histórico'
      },
      { status: 500 }
    );
  }
}

