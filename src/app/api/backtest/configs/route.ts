import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, safeQuery, safeTransaction } from '@/lib/prisma-wrapper';
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

    const configs = await safeQuery('get-backtest-configs', () =>
      prisma.backtestConfig.findMany({
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
      })
    );

    console.log('🔍 Debug - Configs encontradas:', configs.length);
    if (configs.length > 0) {
      console.log('📊 Primeira config - Transações:', configs[0].transactions?.length || 0);
      console.log('📋 Exemplo de transação:', configs[0].transactions?.[0] || 'Nenhuma');
      console.log('🏗️ Estrutura da primeira config:', {
        id: configs[0].id,
        name: configs[0].name,
        hasAssets: !!configs[0].assets,
        assetsCount: configs[0].assets?.length || 0,
        hasResults: !!configs[0].results,
        resultsCount: configs[0].results?.length || 0,
        hasTransactions: !!configs[0].transactions,
        transactionsCount: configs[0].transactions?.length || 0
      });
      
      // Debug específico para resultados
      if (configs[0].results && configs[0].results.length > 0) {
        console.log('📈 Primeiro resultado:', {
          id: configs[0].results[0].id,
          totalReturn: configs[0].results[0].totalReturn,
          calculatedAt: configs[0].results[0].calculatedAt
        });
      } else {
        console.log('⚠️ Primeira config não tem resultados, verificando outras...');
        const configsWithResults = configs.filter(c => c.results && c.results.length > 0);
        console.log('📊 Configs com resultados:', configsWithResults.length);
        if (configsWithResults.length > 0) {
          console.log('📈 Primeira config com resultado:', {
            name: configsWithResults[0].name,
            resultsCount: configsWithResults[0].results.length
          });
        }
      }
    }

    // Converter Decimals para numbers nos resultados
    const processedConfigs = configs.map(config => ({
      ...config,
      initialCapital: Number(config.initialCapital),
      monthlyContribution: Number(config.monthlyContribution),
      assets: config.assets.map(asset => ({
        ...asset,
        targetAllocation: Number(asset.targetAllocation),
        averageDividendYield: (asset as any).averageDividendYield ? Number((asset as any).averageDividendYield) : null
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


    return NextResponse.json({ configs: processedConfigs });

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

    const config = await safeTransaction('create-backtest-config', () =>
      prisma.backtestConfig.create({
        data: {
          userId: currentUser.id,
          name: body.name,
          description: body.description,
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          initialCapital: body.initialCapital,
          monthlyContribution: body.monthlyContribution,
          rebalanceFrequency: body.rebalanceFrequency,
          assets: {
            create: body.assets.map((asset: any) => ({
              ticker: asset.ticker.toUpperCase(),
              targetAllocation: asset.allocation,
              averageDividendYield: asset.averageDividendYield || null
            }))
          }
        },
        include: { assets: true }
      })
    );

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

  if (!data.initialCapital || data.initialCapital <= 0) {
    errors.push('Capital inicial deve ser positivo');
  }

  if (!data.monthlyContribution || data.monthlyContribution <= 0) {
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
