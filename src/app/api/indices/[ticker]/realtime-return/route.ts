/**
 * API Endpoint para rentabilidade em tempo real do índice
 * GET /api/indices/[ticker]/realtime-return
 * 
 * IMPORTANTE: Quando mercado fechado, ignora cache até preço de fechamento estar disponível
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateRealTimeReturn } from '@/lib/index-realtime-return';
import { cache } from '@/lib/cache-service';

/**
 * Verifica se o mercado B3 está fechado (horário de Brasília)
 */
function isBrazilMarketClosed(): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
  
  const dayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
  };
  
  const dayOfWeek = dayMap[weekday] ?? 0;
  
  // Mercado B3: Segunda a Sexta, 10h às 18h (horário de Brasília)
  return dayOfWeek < 1 || dayOfWeek > 5 || hour < 10 || hour >= 18;
}

/**
 * Verifica se o preço de fechamento do dia atual já está disponível
 */
async function hasTodayClosingPrice(indexId: string): Promise<boolean> {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
  
  const today = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  
  const todayPoint = await prisma.indexHistoryPoints.findFirst({
    where: {
      indexId,
      date: today,
    },
    select: { id: true },
  });
  
  return !!todayPoint;
}

const CACHE_TTL = 60; // 1 minuto quando mercado aberto
const CACHE_TTL_CLOSED = 86400; // 24 horas quando mercado fechado e preço disponível

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

    const marketClosed = isBrazilMarketClosed();
    let shouldIgnoreCache = false;
    const cacheKey = `index-realtime-return-${index.id}`;
    
    // Se mercado fechado, verificar se preço de fechamento já está disponível
    if (marketClosed) {
      const hasClosingPrice = await hasTodayClosingPrice(index.id);
      shouldIgnoreCache = !hasClosingPrice;
      
      if (shouldIgnoreCache) {
        console.log(`📊 [API] ${ticker}: Mercado fechado mas preço de fechamento ainda não disponível - ignorando cache`);
      }
    }
    
    // Verificar cache apenas se não devemos ignorar
    if (!shouldIgnoreCache) {
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
        // CRÍTICO: Se mercado está aberto mas cache tem isMarketOpen=false, cache está desatualizado
        // Isso acontece quando cache foi criado quando mercado estava fechado e mercado abriu novamente
        if (!marketClosed && cachedData.isMarketOpen === false) {
          console.log(`📊 [API] ${ticker}: Mercado aberto mas cache contém isMarketOpen=false - ignorando cache desatualizado`);
          shouldIgnoreCache = true;
        } else {
          // Cache válido - retornar
          console.log(`📊 [API] ${ticker}: Retornando realtime return do cache`);
          return NextResponse.json(
            {
              ...cachedData,
              cached: true,
              marketClosed,
              hasClosingPrice: !shouldIgnoreCache,
            }
          );
        }
      }
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

    // Salvar no cache apenas se não estamos ignorando cache
    if (!shouldIgnoreCache) {
      const cacheTTL = marketClosed ? CACHE_TTL_CLOSED : CACHE_TTL;
      await cache.set(cacheKey, responseData, { ttl: cacheTTL });
    }

    // Converter para formato JSON-friendly
    return NextResponse.json(
      {
        ...responseData,
        cached: false,
        timestamp: new Date().toISOString(),
        marketClosed,
        hasClosingPrice: !shouldIgnoreCache,
      }
    );
  } catch (error) {
    console.error('Erro ao calcular rentabilidade em tempo real:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

