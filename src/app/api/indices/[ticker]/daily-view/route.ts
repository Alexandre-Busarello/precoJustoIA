/**
 * API: Get Daily View Data
 * GET /api/indices/[ticker]/daily-view
 * 
 * Retorna dados diários do índice com variação e contribuições por ativo
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    const dailyData = historyPoints.map((point, dayIndex) => {
      const contributions = point.dailyContributionsByTicker as Record<string, number> | null;
      const contributionsArray = contributions 
        ? Object.entries(contributions).map(([ticker, contribution]) => ({
            ticker,
            contribution: contribution // Já está em porcentagem
          }))
        : [];

      // Calcular soma das contribuições
      const contributionsSum = contributionsArray.reduce((sum, item) => sum + item.contribution, 0);

      const baseData = {
        date: point.date.toISOString().split('T')[0],
        points: point.points,
        dailyChange: point.dailyChange, // Já está em porcentagem
        contributionsSum: contributionsSum,
        contributions: contributionsArray.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)), // Ordenar por maior contribuição absoluta
        hasContributions: contributionsArray.length > 0
      };

      // Se não for premium, ofuscar contribuições detalhadas mas manter estrutura
      if (!isPremium && baseData.hasContributions) {
        // Gerar contribuições mockadas com mesma quantidade e estrutura
        // Usar hash baseado no índice do dia para valores determinísticos mas ofuscados
        const dayHash = (dayIndex * 7919 + 997) % 1000;
        const baseVariation = (dayHash / 1000 - 0.5) * 0.15;
        
        const mockContributions = contributionsArray.map((contrib, i) => {
          const itemHash = (i * 7919 + dayHash) % 1000;
          const itemVariation = (itemHash / 1000 - 0.5) * 0.2;
          return {
            ticker: `MOCK${i + 1}`,
            contribution: Math.round((contrib.contribution * (1 + baseVariation + itemVariation)) * 100) / 100,
            isObfuscated: true
          };
        }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

        // Recalcular soma das contribuições mockadas
        const mockContributionsSum = mockContributions.reduce((sum, item) => sum + item.contribution, 0);

        return {
          ...baseData,
          contributionsSum: Math.round(mockContributionsSum * 100) / 100,
          contributions: mockContributions,
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
      dailyData,
      isObfuscated: !isPremium
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


