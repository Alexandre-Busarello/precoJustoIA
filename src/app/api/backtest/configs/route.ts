import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma-wrapper';
import { upsertBacktestConfig } from '@/lib/adaptive-backtest-service';
import { getCurrentUser } from '@/lib/user-service';

// GET /api/backtest/configs - Listar configurações do usuário
export async function GET(request: NextRequest) {
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

    // Parâmetros de paginação
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Contar total de configurações
    const total = await prisma.backtestConfig.count({
      where: { userId: currentUser.id }
    });

    const configs = await prisma.backtestConfig.findMany({
      where: { userId: currentUser.id },
      include: { 
        assets: true, 
        results: {
          orderBy: { calculatedAt: 'desc' } // Mais recente primeiro
        },
        transactions: {
          orderBy: [{ month: 'asc' }, { id: 'asc' }] // Ordenar por month e depois por ID (ordem de criação)
        }
      },
      orderBy: { createdAt: 'desc' }, // Mais recentes primeiro, independente de ter resultados
      skip,
      take: limit
    });

    const totalPages = Math.ceil(total / limit);

    // Converter Decimals para numbers. O DY médio salvo é legado: a simulação usa os proventos reais (DividendHistory).
    const processedConfigs = configs.map(config => ({
      ...config,
      initialCapital: Number(config.initialCapital),
      monthlyContribution: Number(config.monthlyContribution),
      assets: config.assets.map(({ averageDividendYield: _legacyDividendYield, ...asset }) => ({
        ...asset,
        targetAllocation: Number(asset.targetAllocation)
      })),
      results: config.results.map(result => ({
        ...result,
        totalReturn: Number(result.totalReturn),
        annualizedReturn: Number(result.annualizedReturn),
        volatility: Number(result.volatility),
        sharpeRatio: result.sharpeRatio ? Number(result.sharpeRatio) : null,
        maxDrawdown: Number(result.maxDrawdown),
        totalInvested: Number(result.totalInvested),
        finalValue: Number(result.finalValue),
        finalCashReserve: (result as any).finalCashReserve ? Number((result as any).finalCashReserve) : 0,
        totalDividendsReceived: (result as any).totalDividendsReceived ? Number((result as any).totalDividendsReceived) : 0,
        // Os campos JSON já vêm como objetos/arrays
        monthlyReturns: result.monthlyReturns,
        assetPerformance: result.assetPerformance,
        portfolioEvolution: result.portfolioEvolution
      })),
        transactions: config.transactions?.map(transaction => ({
          ...transaction,
          contribution: Number(transaction.contribution),
          price: Number(transaction.price),
          sharesAdded: Number(transaction.sharesAdded),
          totalShares: Number(transaction.totalShares),
          totalInvested: Number(transaction.totalInvested),
          cashReserved: transaction.cashReserved ? Number(transaction.cashReserved) : null,
          totalContribution: Number(transaction.totalContribution),
          portfolioValue: Number(transaction.portfolioValue),
          cashBalance: Number(transaction.cashBalance)
        })) || []
    }));


    return NextResponse.json({ 
      configs: processedConfigs,
      total,
      totalPages,
      page,
      limit
    });

  } catch (error) {
    console.error('Erro ao buscar configurações de backtest:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/backtest/configs - Criar nova configuração
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    
    // Validar dados de entrada
    const validationErrors = validateBacktestConfigData(body);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validationErrors },
        { status: 400 }
      );
    }

    // Reaproveita a configuração do usuário com o mesmo nome e os mesmos ativos (sem duplicar a cada execução)
    const { id } = await upsertBacktestConfig(currentUser.id, {
      name: body.name,
      description: body.description,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      initialCapital: Number(body.initialCapital),
      monthlyContribution: Number(body.monthlyContribution),
      rebalanceFrequency: body.rebalanceFrequency || 'monthly',
      assets: body.assets.map((asset: { ticker: string; allocation: number }) => ({
        ticker: asset.ticker,
        allocation: Number(asset.allocation)
      }))
    });
    const config = await prisma.backtestConfig.findUnique({ where: { id }, include: { assets: true } });

    return NextResponse.json({ config });

  } catch (error) {
    console.error('Erro ao criar configuração de backtest:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Função de validação
function validateBacktestConfigData(data: any): string[] {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Nome é obrigatório');
  }

  if (!data.startDate || !data.endDate) {
    errors.push('Datas de início e fim são obrigatórias');
  }

  if (data.startDate && data.endDate && new Date(data.startDate) >= new Date(data.endDate)) {
    errors.push('Data de início deve ser anterior à data de fim');
  }

  if ((!data.initialCapital && data.initialCapital !== 0) || data.initialCapital < 0) {
    errors.push('Capital inicial deve ser positivo');
  }

  if ((!data.monthlyContribution && data.monthlyContribution !== 0) || data.monthlyContribution < 0) {
    errors.push('Aporte mensal deve ser positivo');
  }

  if (!data.assets || !Array.isArray(data.assets) || data.assets.length === 0) {
    errors.push('Pelo menos um ativo é obrigatório');
  }

  if (data.assets && data.assets.length > 20) {
    errors.push('Máximo 20 ativos por carteira');
  }

  if (data.assets && Array.isArray(data.assets)) {
    const totalAllocation = data.assets.reduce((sum: number, asset: any) => {
      if (!asset.ticker || typeof asset.ticker !== 'string') {
        errors.push('Ticker do ativo é obrigatório');
        return sum;
      }
      if (!asset.allocation || asset.allocation <= 0 || asset.allocation > 1) {
        errors.push(`Alocação inválida para ${asset.ticker}`);
        return sum;
      }
      return sum + asset.allocation;
    }, 0);

    if (Math.abs(totalAllocation - 1) > 0.01) {
      errors.push('Alocações devem somar 100%');
    }
  }

  if (data.rebalanceFrequency && !['monthly', 'quarterly', 'yearly'].includes(data.rebalanceFrequency)) {
    errors.push('Frequência de rebalanceamento inválida');
  }

  return errors;
}
