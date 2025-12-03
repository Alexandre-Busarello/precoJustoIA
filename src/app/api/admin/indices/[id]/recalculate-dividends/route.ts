import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/user-service';
import { recalculateIndexWithDividends } from '@/lib/index-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id: indexId } = await params;
    const body = await request.json();
    const startDate = body.startDate ? new Date(body.startDate) : undefined;
    const dryRun = body.dryRun === true;

    // Verificar se o índice existe
    const index = await prisma.indexDefinition.findUnique({
      where: { id: indexId },
      select: { id: true, ticker: true, name: true }
    });

    if (!index) {
      return NextResponse.json(
        { error: 'Índice não encontrado' },
        { status: 404 }
      );
    }

    if (dryRun) {
      // Simular recálculo sem salvar
      // Por enquanto, apenas retornar informações sobre o que seria recalculado
      const allPoints = await prisma.indexHistoryPoints.findMany({
        where: { indexId },
        orderBy: { date: 'asc' }
      });

      const pointsToRecalculate = startDate
        ? allPoints.filter(p => new Date(p.date) >= startDate)
        : allPoints;

      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Simulação: ${pointsToRecalculate.length} pontos seriam recalculados`,
        wouldRecalculate: pointsToRecalculate.length,
        startDate: startDate?.toISOString(),
        index: {
          id: index.id,
          ticker: index.ticker,
          name: index.name
        }
      });
    }

    // Executar recálculo
    const result = await recalculateIndexWithDividends(indexId, startDate);

    return NextResponse.json({
      success: result.success,
      recalculated: result.recalculated,
      dividendsFound: result.dividendsFound,
      newPoints: result.newPoints,
      errors: result.errors,
      index: {
        id: index.id,
        ticker: index.ticker,
        name: index.name
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN INDICES] Error recalculating dividends:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao recalcular dividendos'
      },
      { status: 500 }
    );
  }
}

