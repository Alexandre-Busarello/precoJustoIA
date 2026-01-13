/**
 * API: Get Index Composition
 * GET /api/indices/[ticker]/composition
 * 
 * Retorna composição atual do índice
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
      include: {
        composition: {
          orderBy: { assetTicker: 'asc' }
        }
      }
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

    // Buscar dados detalhados dos ativos
    const compositionWithDetails = await Promise.all(
      index.composition.map(async (comp, compIndex) => {
        const company = await prisma.company.findUnique({
          where: { ticker: comp.assetTicker },
          select: {
            name: true,
            logoUrl: true,
            sector: true,
            financialData: {
              orderBy: { year: 'desc' },
              take: 1,
              select: {
                dy: true
              }
            }
          }
        });

        // CORREÇÃO: Buscar preço de entrada do primeiro snapshot onde o ativo aparece
        // Este é o preço de entrada real do ativo no índice
        // Buscar todos os pontos históricos ordenados por data
        const historyPoints = await prisma.indexHistoryPoints.findMany({
          where: {
            indexId: index.id
          },
          orderBy: { date: 'asc' },
          select: {
            compositionSnapshot: true
          }
        });

        // Filtrar pontos onde o ticker estava presente (mesma lógica da Performance Individual)
        const relevantPoints = historyPoints.filter(point => {
          if (!point.compositionSnapshot) return false;
          const snapshot = point.compositionSnapshot as any;
          return snapshot[comp.assetTicker] !== undefined;
        });

        // CORREÇÃO: Sempre usar entryPrice do primeiro snapshot onde o ativo aparece
        let entryPrice = comp.entryPrice; // Fallback para preço de index_compositions
        let entryDate = comp.entryDate; // Fallback para data de index_compositions
        if (relevantPoints.length > 0) {
          const firstPoint = relevantPoints[0];
          const firstSnapshot = firstPoint.compositionSnapshot as any;
          const firstEntryData = firstSnapshot[comp.assetTicker];
          if (firstEntryData?.entryPrice) {
            entryPrice = firstEntryData.entryPrice;
            entryDate = new Date(firstEntryData.entryDate);
          }
        }

        // Buscar preço atual
        const { getTickerPrice } = await import('@/lib/quote-service');
        const priceData = await getTickerPrice(comp.assetTicker);
        const currentPrice = priceData?.price || entryPrice;

        // Calcular variação desde entrada usando preço correto
        const entryReturn = ((currentPrice - entryPrice) / entryPrice) * 100;

        const result = {
          ticker: comp.assetTicker,
          name: company?.name || comp.assetTicker,
          logoUrl: company?.logoUrl || null,
          sector: company?.sector || null,
          targetWeight: comp.targetWeight,
          entryPrice, // Usar preço do primeiro snapshot
          entryDate: entryDate.toISOString().split('T')[0], // Usar data do primeiro snapshot
          currentPrice,
          entryReturn,
          dividendYield: company?.financialData[0]?.dy 
            ? Number(company.financialData[0].dy) * 100 
            : null
        };

        // Se não for premium, ofuscar dados mas manter estrutura
        if (!isPremium) {
          // Usar hash simples baseado no índice para valores determinísticos mas ofuscados
          const hash = (compIndex * 7919 + 997) % 1000; // Número primo para distribuição
          const variation = (hash / 1000 - 0.5) * 0.15; // Variação de -7.5% a +7.5%
          
          return {
            ticker: `MOCK${compIndex + 1}`,
            name: 'Empresa Ocultada',
            logoUrl: null,
            sector: null,
            targetWeight: Math.round((comp.targetWeight * (1 + variation * 0.1)) * 1000) / 1000,
            entryPrice: Math.round(entryPrice * (1 + variation) * 100) / 100,
            entryDate: result.entryDate,
            currentPrice: Math.round(currentPrice * (1 + variation * 0.8) * 100) / 100,
            entryReturn: Math.round((entryReturn + variation * 25) * 10) / 10,
            dividendYield: result.dividendYield ? Math.round((result.dividendYield + variation * 3) * 10) / 10 : null,
            isObfuscated: true
          };
        }

        return {
          ...result,
          isObfuscated: false
        };
      })
    );

    return NextResponse.json({
      success: true,
      composition: compositionWithDetails,
      isObfuscated: !isPremium
    });
  } catch (error) {
    const { ticker: tickerParam } = await params;
    console.error(`❌ [API INDICES] Error getting composition for ${tickerParam}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar composição'
      },
      { status: 500 }
    );
  }
}

