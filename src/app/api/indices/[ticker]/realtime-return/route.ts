/**
 * API Endpoint para rentabilidade em tempo real do índice
 * GET /api/indices/[ticker]/realtime-return
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateRealTimeReturn } from '@/lib/index-realtime-return';

export const revalidate = 30; // Revalidar a cada 30 segundos

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker: tickerParam } = await params;
    const ticker = tickerParam.toUpperCase();

    // Buscar índice pelo ticker
    const index = await prisma.indexDefinition.findUnique({
      where: { ticker },
      select: { id: true },
    });

    if (!index) {
      return NextResponse.json(
        { error: 'Índice não encontrado' },
        { status: 404 }
      );
    }

    // Calcular rentabilidade em tempo real
    const realTimeData = await calculateRealTimeReturn(index.id);

    if (!realTimeData) {
      return NextResponse.json(
        { error: 'Não foi possível calcular a rentabilidade em tempo real' },
        { status: 500 }
      );
    }

    // Converter para formato JSON-friendly
    return NextResponse.json({
      realTimePoints: realTimeData.realTimePoints,
      realTimeReturn: realTimeData.realTimeReturn,
      dailyChange: realTimeData.dailyChange,
      lastOfficialPoints: realTimeData.lastOfficialPoints,
      lastOfficialDate: realTimeData.lastOfficialDate.toISOString(),
      isMarketOpen: realTimeData.isMarketOpen,
    });
  } catch (error) {
    console.error('Erro ao calcular rentabilidade em tempo real:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

