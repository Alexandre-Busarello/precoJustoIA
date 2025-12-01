import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, safeTransaction } from '@/lib/prisma-wrapper';
import { getCurrentUser } from '@/lib/user-service';

// GET /api/backtest/configs/[id] - Buscar configuração específica
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

    // Buscar configuração completa
    const config = await prisma.backtestConfig.findFirst({
      where: { 
        id: configId,
        userId: currentUser.id 
      },
      include: { 
        assets: true,
        results: {
          orderBy: { calculatedAt: 'desc' },
          take: 1 // Pegar apenas o último resultado
        },
        transactions: {
          orderBy: [{ month: 'asc' }, { id: 'asc' }]
        }
      }
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Configuração não encontrada' },
        { status: 404 }
      );
    }

    console.log(`📊 Config encontrada: ${config.name} com ${config.assets.length} ativos, ${(config as any).results?.length || 0} resultados e ${config.transactions?.length || 0} transações`);

    // Converter Decimals para numbers e aplicar cap de 10% no DY
    const processedConfig = {
      ...config,
      initialCapital: Number(config.initialCapital),
      monthlyContribution: Number(config.monthlyContribution),
      assets: config.assets.map(asset => {
        const dy = (asset as any).averageDividendYield ? Number((asset as any).averageDividendYield) : null;
        return {
          ...asset,
          targetAllocation: Number(asset.targetAllocation),
          // Aplicar cap de 10% no dividend yield ao retornar
          averageDividendYield: dy !== null ? Math.min(dy, 0.10) : null
        };
      }),
      results: (config as any).results?.map((result: any) => ({
        ...result,
        totalReturn: Number(result.totalReturn),
        annualizedReturn: Number(result.annualizedReturn),
        volatility: Number(result.volatility),
        sharpeRatio: result.sharpeRatio ? Number(result.sharpeRatio) : null,
        maxDrawdown: Number(result.maxDrawdown),
        positiveMonths: result.positiveMonths,
        negativeMonths: result.negativeMonths,
        totalInvested: Number(result.totalInvested),
        finalValue: Number(result.finalValue),
        finalCashReserve: result.finalCashReserve ? Number(result.finalCashReserve) : 0,
        totalDividendsReceived: result.totalDividendsReceived ? Number(result.totalDividendsReceived) : 0,
        monthlyReturns: result.monthlyReturns,
        assetPerformance: result.assetPerformance,
        portfolioEvolution: result.portfolioEvolution
      })) || [],
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
    };

    return NextResponse.json({ config: processedConfig });

  } catch (error) {
    console.error('Erro ao buscar configuração:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/backtest/configs/[id] - Atualizar configuração existente
export async function PUT(
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
    const body = await request.json();

    // Validar dados de entrada
    const validationErrors = validateBacktestConfigData(body);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validationErrors },
        { status: 400 }
      );
    }

    // UPSERT: Atualizar ou criar configuração dentro de uma transação
    const upsertedConfig = await safeTransaction('upsert-backtest-config', async () => {
      // 1. Verificar se a config existe e pertence ao usuário
      const existingConfig = await prisma.backtestConfig.findFirst({
        where: { 
          id: configId,
          userId: currentUser.id 
        }
      });

      // 2. UPSERT: Atualizar se existe, criar se não existe
      const config = await prisma.backtestConfig.upsert({
        where: { id: configId },
        update: {
          name: body.name,
          description: body.description,
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          initialCapital: body.initialCapital,
          monthlyContribution: body.monthlyContribution,
          rebalanceFrequency: body.rebalanceFrequency
        },
        create: {
          id: configId, // Manter o ID fornecido pelo frontend
          userId: currentUser.id,
          name: body.name,
          description: body.description,
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          initialCapital: body.initialCapital,
          monthlyContribution: body.monthlyContribution,
          rebalanceFrequency: body.rebalanceFrequency
        }
      });

      // 3. Remover ativos antigos (se existirem)
      await prisma.backtestAsset.deleteMany({
        where: { backtestId: configId }
      });

      // 4. Criar novos ativos
      await prisma.backtestAsset.createMany({
        data: body.assets.map((asset: any) => ({
          backtestId: configId,
          ticker: asset.ticker.toUpperCase(),
          targetAllocation: asset.allocation,
          averageDividendYield: asset.averageDividendYield || null
        }))
      });

      // 5. Buscar configuração completa
      return await prisma.backtestConfig.findUnique({
        where: { id: configId },
        include: { assets: true }
      });
    }, {
      affectedTables: ['backtest_configs', 'backtest_assets']
    });

    const action = await prisma.backtestConfig.findFirst({
      where: { id: configId },
      select: { createdAt: true, updatedAt: true }
    });

    const wasCreated = action && action.createdAt.getTime() === action.updatedAt.getTime();
    
    console.log(`✅ Configuração ${configId} ${wasCreated ? 'criada' : 'atualizada'} com sucesso`);

    return NextResponse.json({ 
      config: upsertedConfig,
      configId: configId,
      message: `Configuração ${wasCreated ? 'criada' : 'atualizada'} com sucesso`
    });

  } catch (error) {
    console.error('Erro ao atualizar configuração:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/backtest/configs/[id] - Deletar configuração
export async function DELETE(
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

    // Verificar se a configuração existe e pertence ao usuário
    const config = await prisma.backtestConfig.findFirst({
      where: {
        id: configId,
        userId: currentUser.id
      }
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Configuração não encontrada' },
        { status: 404 }
      );
    }

    // Deletar configuração e todos os dados relacionados dentro de uma transação
    await safeTransaction('delete-backtest-config', async () => {
      // Deletar transações relacionadas
      await prisma.backtestTransaction.deleteMany({
        where: { backtestId: configId }
      });

      // Deletar resultados relacionados
      await prisma.backtestResult.deleteMany({
        where: { backtestId: configId }
      });

      // Deletar ativos relacionados
      await prisma.backtestAsset.deleteMany({
        where: { backtestId: configId }
      });

      // Deletar a configuração
      await prisma.backtestConfig.delete({
        where: { id: configId }
      });
    }, {
      affectedTables: ['backtest_configs', 'backtest_assets', 'backtest_results', 'backtest_transactions']
    });

    console.log(`✅ Configuração ${configId} deletada com sucesso`);

    return NextResponse.json({ 
      message: 'Configuração deletada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar configuração:', error);
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
    errors.push('Nome da configuração é obrigatório');
  }

  if (!Array.isArray(data.assets)) {
    errors.push('Lista de ativos deve ser um array (pode ser vazio)');
  }

  if (data.assets && data.assets.length > 20) {
    errors.push('Máximo de 20 ativos por configuração');
  }

  if (!data.startDate || !data.endDate) {
    errors.push('Datas de início e fim são obrigatórias');
  }

  if (data.initialCapital !== undefined && data.initialCapital <= 0) {
    errors.push('Capital inicial deve ser maior que zero');
  }

  if (data.monthlyContribution !== undefined && data.monthlyContribution < 0) {
    errors.push('Aporte mensal não pode ser negativo');
  }

  if (data.rebalanceFrequency && !['monthly', 'quarterly', 'yearly'].includes(data.rebalanceFrequency)) {
    errors.push('Frequência de rebalanceamento inválida');
  }

  // Validar alocações
  if (data.assets && Array.isArray(data.assets)) {
    const totalAllocation = data.assets.reduce((sum: number, asset: any) => sum + (asset.allocation || 0), 0);
    if (Math.abs(totalAllocation - 1) > 0.01) {
      errors.push('A soma das alocações deve ser 100%');
    }

    data.assets.forEach((asset: any, index: number) => {
      if (!asset.ticker || typeof asset.ticker !== 'string') {
        errors.push(`Ativo ${index + 1}: Ticker é obrigatório`);
      }
      if (asset.allocation === undefined || asset.allocation < 0 || asset.allocation > 1) {
        errors.push(`Ativo ${index + 1}: Alocação deve estar entre 0 e 1`);
      }
    });
  }

  return errors;
}
