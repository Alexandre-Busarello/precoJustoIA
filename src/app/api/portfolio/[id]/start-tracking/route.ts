import { NextRequest, NextResponse } from 'next/server';
import { PortfolioService } from '@/lib/portfolio-service';
import { getCurrentUser } from '@/lib/user-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const portfolioId = resolvedParams.id;

    await PortfolioService.startTracking(portfolioId, user.id);

    return NextResponse.json({
      success: true,
      message: 'Acompanhamento iniciado. Sugestões automáticas serão geradas a partir de agora.'
    });
  } catch (error) {
    console.error('Erro ao iniciar tracking:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao iniciar acompanhamento' },
      { status: 500 }
    );
  }
}

