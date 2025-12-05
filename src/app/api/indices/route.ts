/**
 * API: List Indices
 * GET /api/indices
 * 
 * Lista todos os índices com performance atual
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateRealTimeReturn } from '@/lib/index-realtime-return';

// Revalidar a API a cada 30 segundos
// Reduzido para garantir que dados em tempo real sejam atualizados mais frequentemente
export const revalidate = 30;

export async function GET(request: NextRequest) {
  try {
    const indices = await prisma.indexDefinition.findMany({
      include: {
        history: {
          orderBy: { date: 'desc' },
          take: 1
        },
        composition: {
          include: {
            definition: false
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Buscar histórico para sparkline de cada índice em paralelo
    const indicesWithSparkline = await Promise.all(
      indices.map(async (index) => {
        // Buscar últimos 30 pontos históricos para o sparkline
        const sparklineHistory = await prisma.indexHistoryPoints.findMany({
          where: { indexId: index.id },
          orderBy: { date: 'desc' }, // Mais recentes primeiro
          take: 30, // Últimos 30 dias
          select: {
            date: true,
            points: true,
          },
        });

        const latestPoint = index.history[0];
        const initialPoints = 100.0; // Base 100
        
        // Verificar se há preço de fechamento do dia atual
        const today = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        
        const parts = formatter.formatToParts(today);
        const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
        const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1;
        const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
        const todayDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        
        // Comparar datas corretamente (ignorar horas)
        const latestPointDate = latestPoint ? new Date(latestPoint.date) : null;
        const latestPointDateOnly = latestPointDate 
          ? new Date(Date.UTC(
              latestPointDate.getUTCFullYear(),
              latestPointDate.getUTCMonth(),
              latestPointDate.getUTCDate(),
              0, 0, 0, 0
            ))
          : null;
        
        const hasTodayClosingPrice = latestPointDateOnly && 
          latestPointDateOnly.getTime() === todayDate.getTime();
        
        // Debug: Log das datas para verificar comparação
        console.log(`📊 [API INDICES] ${index.ticker}: latestPointDate=${latestPointDateOnly?.toISOString()}, todayDate=${todayDate.toISOString()}, hasTodayClosingPrice=${hasTodayClosingPrice}`);
        
        let currentPoints: number;
        let dailyChange: number | null;
        
        if (hasTodayClosingPrice) {
          // Tem preço de fechamento do dia atual - usar do histórico
          currentPoints = latestPoint.points;
          dailyChange = latestPoint.dailyChange ?? null;
          console.log(`📊 [API INDICES] ${index.ticker}: Usando preço de fechamento do histórico - dailyChange: ${dailyChange}%`);
        } else {
          // Não tem preço de fechamento - calcular em tempo real
          // IMPORTANTE: Mesmo quando mercado fechado, se não tem preço de fechamento ainda,
          // devemos calcular em tempo real usando os últimos preços disponíveis
          console.log(`📊 [API INDICES] ${index.ticker}: Sem preço de fechamento, calculando em tempo real...`);
          const realTimeData = await calculateRealTimeReturn(index.id);
          if (realTimeData) {
            currentPoints = realTimeData.realTimePoints;
            dailyChange = realTimeData.dailyChange;
            console.log(`📊 [API INDICES] ${index.ticker}: Calculado em tempo real - dailyChange: ${dailyChange}%, realTimePoints: ${currentPoints}, lastOfficialPoints: ${realTimeData.lastOfficialPoints}`);
          } else {
            // Fallback: usar último ponto disponível
            currentPoints = latestPoint?.points || initialPoints;
            dailyChange = latestPoint?.dailyChange ?? null;
            console.log(`📊 [API INDICES] ${index.ticker}: Fallback - usando último ponto disponível - dailyChange: ${dailyChange}%`);
          }
        }
        
        const accumulatedReturn = ((currentPoints - initialPoints) / initialPoints) * 100;

        // Formatar dados do sparkline (inverter ordem para cronológica: mais antigo -> mais recente)
        const sparklineData = sparklineHistory
          .reverse() // Inverter para ordem cronológica
          .map(point => ({
            date: point.date.toISOString().split('T')[0], // Formato YYYY-MM-DD
            points: point.points,
          }));

        return {
          id: index.id,
          ticker: index.ticker,
          name: index.name,
          description: index.description,
          color: index.color,
          currentPoints: currentPoints,
          accumulatedReturn: accumulatedReturn,
          dailyChange: dailyChange, // Variação do dia (quando disponível)
          currentYield: latestPoint?.currentYield || null,
          assetCount: index.composition.length,
          lastUpdate: latestPoint?.date || null,
          sparklineData: sparklineData, // Dados históricos para o sparkline
        };
      })
    );

    // Ordenar por retorno acumulado (maior primeiro)
    const sortedIndices = indicesWithSparkline.sort(
      (a, b) => b.accumulatedReturn - a.accumulatedReturn
    );

    return NextResponse.json({
      success: true,
      indices: sortedIndices
    });
  } catch (error) {
    console.error('❌ [API INDICES] Error listing indices:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao listar índices'
      },
      { status: 500 }
    );
  }
}

