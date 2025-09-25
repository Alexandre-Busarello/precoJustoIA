import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, safeQuery } from '@/lib/prisma-wrapper';
import { getCurrentUser } from '@/lib/user-service';

// GET /api/backtest/configs/[id]/results - Buscar resultados de uma configuração específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Usar o serviço centralizado para obter o usuário válido
    const currentUser = await getCurrentUser();
    
    if (!currentUser?.id) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se é usuário Premium
    if (!currentUser.isPremium) {
      return NextResponse.json({ 
        error: 'Backtesting exclusivo para usuários Premium',
        upgradeUrl: '/dashboard'
      }, { status: 403 });
    }

    const { id: configId } = await params;

    // Primeiro verificar se a configuração existe e pertence ao usuário
    const config = await safeQuery('get-backtest-config-ownership', () =>
      prisma.backtestConfig.findFirst({
        where: { 
          id: configId,
          userId: currentUser.id 
        },
        select: { id: true, name: true }
      })
    );

    if (!config) {
      return NextResponse.json(
        { error: 'Configuração não encontrada' },
        { status: 404 }
      );
    }

    // Buscar todos os resultados desta configuração
    const results = await safeQuery('get-backtest-results', () =>
      prisma.backtestResult.findMany({
        where: { backtestId: configId },
        orderBy: { calculatedAt: 'desc' } // Mais recente primeiro
      })
    );

    console.log(`📊 Encontrados ${results.length} resultados para config ${config.name}`);

    // Converter Decimals para numbers
    const processedResults = results.map(result => ({
      ...result,
      totalReturn: Number(result.totalReturn),
      annualizedReturn: Number(result.annualizedReturn),
      volatility: Number(result.volatility),
      sharpeRatio: result.sharpeRatio ? Number(result.sharpeRatio) : null,
      maxDrawdown: Number(result.maxDrawdown),
      totalInvested: Number(result.totalInvested),
      finalValue: Number(result.finalValue),
      finalCashReserve: result.finalCashReserve ? Number(result.finalCashReserve) : null,
      totalDividendsReceived: result.totalDividendsReceived ? Number(result.totalDividendsReceived) : null,
      // Os campos JSON já vêm como objetos/arrays
      monthlyReturns: result.monthlyReturns,
      assetPerformance: result.assetPerformance,
      portfolioEvolution: result.portfolioEvolution
    }));

    return NextResponse.json({ 
      results: processedResults,
      configName: config.name
    });

  } catch (error) {
    console.error('Erro ao buscar resultados da configuração:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
