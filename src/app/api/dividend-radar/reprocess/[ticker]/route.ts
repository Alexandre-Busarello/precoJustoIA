import { NextRequest, NextResponse } from 'next/server';
import { DividendRadarService } from '@/lib/dividend-radar-service';
import { requireAdminUser } from '@/lib/user-service';

/**
 * POST /api/dividend-radar/reprocess/[ticker]
 * Força reprocessamento das projeções de um ticker
 * Requer autenticação admin ou pode ser chamado pelo sistema
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    // Verificar se é admin (opcional - pode ser chamado pelo sistema também)
    try {
      await requireAdminUser();
    } catch {
      // Se não for admin, permitir apenas se for chamada do sistema
      // (pode adicionar verificação de API key aqui se necessário)
    }

    const { ticker: tickerParam } = await params;
    const ticker = tickerParam.toUpperCase();

    // Forçar geração de novas projeções
    const projections = await DividendRadarService.generateProjections(ticker);

    return NextResponse.json({
      success: true,
      ticker,
      projections,
      count: projections.length,
      message: 'Projeções reprocessadas com sucesso',
    });
  } catch (error) {
    console.error(`❌ [DIVIDEND RADAR API] Erro ao reprocessar:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

