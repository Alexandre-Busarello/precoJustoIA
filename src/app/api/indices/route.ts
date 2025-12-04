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

    // Calcular performance acumulada para cada índice
    const indicesWithPerformance = indices.map(index => {
      const latestPoint = index.history[0];
      const initialPoints = 100.0; // Base 100
      const currentPoints = latestPoint?.points || initialPoints;
      const accumulatedReturn = ((currentPoints - initialPoints) / initialPoints) * 100;

      return {
        id: index.id,
        ticker: index.ticker,
        name: index.name,
        description: index.description,
        color: index.color,
        currentPoints: currentPoints,
        accumulatedReturn: accumulatedReturn,
        currentYield: latestPoint?.currentYield || null,
        assetCount: index.composition.length,
        lastUpdate: latestPoint?.date || null
      };
    });

    // Ordenar por retorno acumulado (maior primeiro)
    const sortedIndices = indicesWithPerformance.sort(
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

