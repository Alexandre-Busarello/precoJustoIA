/**
 * API: Get Daily View Data
 * GET /api/indices/[ticker]/daily-view
 * 
 * Retorna dados diários do índice com variação e contribuições por ativo
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

    // Buscar todos os pontos históricos ordenados por data (mais recente primeiro)
    const historyPoints = await prisma.indexHistoryPoints.findMany({
      where: { indexId: index.id },
      orderBy: { date: 'desc' },
      select: {
        date: true,
        points: true,
        dailyChange: true,
        compositionSnapshot: true,
        dailyContributionsByTicker: true,
        dividendsByTicker: true
      }
    });

    // Formatar dados para retorno
    const dailyData = historyPoints.map(point => {
      const contributions = point.dailyContributionsByTicker as Record<string, number> | null;
      const contributionsArray = contributions 
        ? Object.entries(contributions).map(([ticker, contribution]) => ({
            ticker,
            contribution: contribution // Já está em porcentagem
          }))
        : [];

      // Calcular soma das contribuições
      const contributionsSum = contributionsArray.reduce((sum, item) => sum + item.contribution, 0);

      return {
        date: point.date.toISOString().split('T')[0],
        points: point.points,
        dailyChange: point.dailyChange, // Já está em porcentagem
        contributionsSum: contributionsSum,
        contributions: contributionsArray.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)), // Ordenar por maior contribuição absoluta
        hasContributions: contributionsArray.length > 0
      };
    });

    return NextResponse.json({
      success: true,
      dailyData
    });
  } catch (error) {
    const { ticker: tickerParam } = await params;
    console.error(`❌ [API INDICES] Error getting daily view for ${tickerParam}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar visão diária'
      },
      { status: 500 }
    );
  }
}


