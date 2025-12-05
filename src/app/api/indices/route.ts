/**
 * API: List Indices
 * GET /api/indices
 * 
 * Lista todos os índices com performance atual
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Revalidar a API a cada 60 segundos (1 minuto)
// Isso permite cache para performance, mas garante que novos índices apareçam em até 1 minuto
export const revalidate = 60;

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
        const currentPoints = latestPoint?.points || initialPoints;
        const accumulatedReturn = ((currentPoints - initialPoints) / initialPoints) * 100;
        // Usar dailyChange quando disponível (variação do dia), senão usar accumulatedReturn como fallback
        const dailyChange = latestPoint?.dailyChange ?? null;

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

