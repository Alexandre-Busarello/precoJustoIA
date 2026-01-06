/**
 * API Endpoint para rentabilidade em tempo real do índice
 * GET /api/indices/[ticker]/realtime-return
 * 
 * IMPORTANTE: 
 * - Cache simples: TTL fixo de 15 minutos, sem lógica complexa
 * - hasIBOVQuoteForDate usado pelo realtime-return não usa cache (sempre busca dados atualizados)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateRealTimeReturn } from '@/lib/index-realtime-return';
import { cache } from '@/lib/cache-service';

const CACHE_TTL = 900; // 15 minutos - TTL fixo e simples

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

    const cacheKey = `index-realtime-return-${index.id}`;
    
    // Verificar cache (lógica simples: apenas verificar se existe)
    const cachedData = await cache.get<{
      realTimePoints: number;
      realTimeReturn: number;
      dailyChange: number;
      lastOfficialPoints: number;
      lastOfficialDate: string;
      isMarketOpen: boolean;
      lastAvailableDailyChange?: number;
    }>(cacheKey);
    
    if (cachedData) {
      console.log(`📊 [API] ${ticker}: Retornando realtime return do cache`);
      return NextResponse.json({
        ...cachedData,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Calcular rentabilidade em tempo real
    const realTimeData = await calculateRealTimeReturn(index.id);

    if (!realTimeData) {
      return NextResponse.json(
        { error: 'Não foi possível calcular a rentabilidade em tempo real' },
        { status: 500 }
      );
    }

    const responseData = {
      realTimePoints: realTimeData.realTimePoints,
      realTimeReturn: realTimeData.realTimeReturn,
      dailyChange: realTimeData.dailyChange,
      lastOfficialPoints: realTimeData.lastOfficialPoints,
      lastOfficialDate: realTimeData.lastOfficialDate.toISOString(),
      isMarketOpen: realTimeData.isMarketOpen,
      lastAvailableDailyChange: realTimeData.lastAvailableDailyChange,
    };

    // Salvar no cache com TTL fixo de 15 minutos
    await cache.set(cacheKey, responseData, { ttl: CACHE_TTL });

    // Converter para formato JSON-friendly
    return NextResponse.json({
      ...responseData,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao calcular rentabilidade em tempo real:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

