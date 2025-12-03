import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/user-service';
import { recalculateIndexWithDividends } from '@/lib/index-engine';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const startDate = body.startDate ? new Date(body.startDate) : undefined;
    const dryRun = body.dryRun === true;

    // Buscar todos os índices ativos
    const allIndices = await prisma.indexDefinition.findMany({
      select: { id: true, ticker: true, name: true },
      orderBy: { createdAt: 'asc' }
    });

    if (allIndices.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum índice encontrado',
        results: []
      });
    }

    if (dryRun) {
      // Simular para todos os índices
      const simulationResults = [];
      for (const index of allIndices) {
        const allPoints = await prisma.indexHistoryPoints.findMany({
          where: { indexId: index.id },
          orderBy: { date: 'asc' }
        });

        const pointsToRecalculate = startDate
          ? allPoints.filter(p => new Date(p.date) >= startDate)
          : allPoints;

        simulationResults.push({
          indexId: index.id,
          ticker: index.ticker,
          name: index.name,
          wouldRecalculate: pointsToRecalculate.length
        });
      }

      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Simulação: ${allIndices.length} índices seriam processados`,
        results: simulationResults
      });
    }

    // Processar um índice por vez
    const results = [];
    for (const index of allIndices) {
      try {
        console.log(`🔄 [ADMIN] Recalculating dividends for ${index.ticker}...`);
        const result = await recalculateIndexWithDividends(index.id, startDate);
        
        results.push({
          indexId: index.id,
          ticker: index.ticker,
          name: index.name,
          success: result.success,
          recalculated: result.recalculated,
          dividendsFound: result.dividendsFound,
          errors: result.errors
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({
          indexId: index.id,
          ticker: index.ticker,
          name: index.name,
          success: false,
          recalculated: 0,
          dividendsFound: 0,
          errors: [errorMsg]
        });
      }
    }

    const totalRecalculated = results.reduce((sum, r) => sum + r.recalculated, 0);
    const totalDividendsFound = results.reduce((sum, r) => sum + r.dividendsFound, 0);
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      totalIndices: allIndices.length,
      successCount,
      totalRecalculated,
      totalDividendsFound,
      results
    });
  } catch (error) {
    console.error('❌ [ADMIN INDICES] Error recalculating all dividends:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao recalcular dividendos'
      },
      { status: 500 }
    );
  }
}

