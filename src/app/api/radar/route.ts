import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { prisma, safeWrite } from '@/lib/prisma-wrapper';

const FREE_TICKER_LIMIT = 3;

/**
 * GET /api/radar - Buscar radar do usuário
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const radarConfig = await prisma.radarConfig.findUnique({
      where: { userId: currentUser.id },
      select: {
        id: true,
        tickers: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!radarConfig) {
      return NextResponse.json({
        tickers: [],
        createdAt: null,
        updatedAt: null,
      });
    }

    return NextResponse.json({
      tickers: radarConfig.tickers as string[],
      createdAt: radarConfig.createdAt,
      updatedAt: radarConfig.updatedAt,
    });

  } catch (error: any) {
    console.error('Erro ao buscar radar:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar radar' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/radar - Salvar/atualizar radar do usuário
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tickers } = body;

    if (!Array.isArray(tickers)) {
      return NextResponse.json(
        { error: 'Tickers deve ser um array' },
        { status: 400 }
      );
    }

    // Validar limite de tickers
    const tickerLimit = currentUser.isPremium ? Infinity : FREE_TICKER_LIMIT;
    if (tickers.length > tickerLimit) {
      return NextResponse.json(
        { 
          error: `Limite de ${tickerLimit} tickers excedido. ${currentUser.isPremium ? '' : 'Faça upgrade para Premium para adicionar tickers ilimitados.'}`,
          limit: tickerLimit,
          isPremium: currentUser.isPremium,
        },
        { status: 400 }
      );
    }

    // Validar que todos os tickers existem no banco
    const tickersUpper = tickers.map((t: string) => t.toUpperCase());
    const existingCompanies = await prisma.company.findMany({
      where: {
        ticker: { in: tickersUpper },
      },
      select: { ticker: true },
    });

    const existingTickers = existingCompanies.map(c => c.ticker);
    const invalidTickers = tickersUpper.filter((t: string) => !existingTickers.includes(t));

    if (invalidTickers.length > 0) {
      return NextResponse.json(
        { error: `Tickers inválidos: ${invalidTickers.join(', ')}` },
        { status: 400 }
      );
    }

    // Salvar ou atualizar radar
    const radarConfig = await safeWrite(
      'save-radar-config',
      () => prisma.radarConfig.upsert({
        where: { userId: currentUser.id },
        create: {
          userId: currentUser.id,
          tickers: tickersUpper,
        },
        update: {
          tickers: tickersUpper,
        },
      }),
      ['radar_configs']
    );

    return NextResponse.json({
      tickers: radarConfig.tickers as string[],
      createdAt: radarConfig.createdAt,
      updatedAt: radarConfig.updatedAt,
    });

  } catch (error: any) {
    console.error('Erro ao salvar radar:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar radar' },
      { status: 500 }
    );
  }
}

