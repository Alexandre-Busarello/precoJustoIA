/**
 * API: Get All Assets Performance
 * GET /api/indices/[ticker]/asset-performance
 * 
 * Retorna performance individual de todos os ativos que passaram pelo índice
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listAllAssetsPerformance } from '@/lib/index-engine';
import { getCurrentUser } from '@/lib/user-service';

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

    // Verificar se usuário é premium
    const user = await getCurrentUser();
    const isPremium = user?.isPremium || false;

    const performances = await listAllAssetsPerformance(index.id);

    const mappedPerformances = performances.map((perf, perfIndex) => {
        const baseData = {
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
        };

        // Se não for premium, ofuscar dados mas manter estrutura
        if (!isPremium) {
          // Usar hash simples baseado no índice para valores determinísticos mas ofuscados
          const hash = (perfIndex * 7919 + 997) % 1000;
          const variation = (hash / 1000 - 0.5) * 0.2; // Variação de -10% a +10%
          
          return {
            ...baseData,
            ticker: `MOCK${perfIndex + 1}`,
            entryPrice: Math.round(perf.entryPrice * (1 + variation) * 100) / 100,
            exitPrice: perf.exitPrice ? Math.round(perf.exitPrice * (1 + variation * 0.9) * 100) / 100 : null,
            totalReturn: Math.round((perf.totalReturn + variation * 35) * 10) / 10,
            contributionToIndex: Math.round((perf.contributionToIndex + variation * 2.5) * 100) / 100,
            averageWeight: Math.round((perf.averageWeight * (1 + variation * 0.15)) * 1000) / 1000,
            isObfuscated: true
          };
        }

        return {
          ...baseData,
          isObfuscated: false
        };
      });

    return NextResponse.json({
      success: true,
      performances: mappedPerformances,
      isObfuscated: !isPremium
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

