import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, safeQueryWithParams, safeTransaction } from '@/lib/prisma-wrapper';
import { getCurrentUser } from '@/lib/user-service';
import { BacktestService, type BacktestParams } from '@/lib/backtest-service';

// Interface para request
interface RunBacktestRequest {
  configId?: string; // Opcional: usar config salva
  params?: BacktestParams; // Ou parâmetros diretos
}

// POST /api/backtest/run - Executar simulação
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

    const body: RunBacktestRequest = await request.json();
    
    let params: BacktestParams;
    let configId: string | undefined;

    if (body.configId && body.params) {
      // Configuração existente com parâmetros atualizados - atualizar a config primeiro
      const existingConfig = await safeQueryWithParams('get-backtest-config', () =>
        prisma.backtestConfig.findFirst({
          where: { id: body.configId, userId: currentUser.id },
          include: { assets: true }
        }),
        { id: body.configId, userId: currentUser.id }
      );
      
      if (!existingConfig) {
        return NextResponse.json(
          { error: 'Configuração não encontrada' },
          { status: 404 }
        );
      }

      // Usar parâmetros da tela (atualizados)
      params = {
        ...body.params,
        startDate: new Date(body.params.startDate),
        endDate: new Date(body.params.endDate),
        initialCapital: Number(body.params.initialCapital)
      };
      configId = body.configId;

      // Atualizar configuração no banco com os novos parâmetros
      console.log('🔄 Atualizando configuração existente com novos parâmetros...');
      await safeTransaction('update-backtest-config', async () => {
        // Atualizar dados principais da configuração
        await prisma.backtestConfig.update({
          where: { id: body.configId },
          data: {
            startDate: params.startDate,
            endDate: params.endDate,
            initialCapital: params.initialCapital,
            monthlyContribution: params.monthlyContribution,
            rebalanceFrequency: params.rebalanceFrequency
          }
        });

        // Remover ativos antigos
        await prisma.backtestAsset.deleteMany({
          where: { backtestId: body.configId }
        });

        // Adicionar novos ativos
        await prisma.backtestAsset.createMany({
          data: params.assets.map(asset => ({
            backtestId: body.configId!,
            ticker: asset.ticker,
            targetAllocation: asset.allocation,
            averageDividendYield: asset.averageDividendYield || null
          }))
        });
      }, { affectedTables: ['backtest_assets', 'backtest_configs'] });

    } else if (body.configId) {
      // Apenas configId - usar configuração salva sem alterações
      const config = await safeQueryWithParams('get-backtest-config', () =>
        prisma.backtestConfig.findFirst({
          where: { id: body.configId, userId: currentUser.id },
          include: { assets: true }
        }),
        { id: body.configId, userId: currentUser.id }
      );
      
      if (!config) {
        return NextResponse.json(
          { error: 'Configuração não encontrada' },
          { status: 404 }
        );
      }

      params = {
        assets: config.assets.map(a => ({
          ticker: a.ticker,
          allocation: Number(a.targetAllocation),
          averageDividendYield: (a as any).averageDividendYield ? Number((a as any).averageDividendYield) : undefined
        })),
        startDate: config.startDate,
        endDate: config.endDate,
        initialCapital: Number(config.initialCapital),
        monthlyContribution: Number(config.monthlyContribution),
        rebalanceFrequency: config.rebalanceFrequency as any
      };
      configId = config.id;

    } else if (body.params) {
      // Usar parâmetros diretos
      params = {
        ...body.params,
        startDate: new Date(body.params.startDate),
        endDate: new Date(body.params.endDate),
        initialCapital: Number(body.params.initialCapital)
      };

    } else {
      return NextResponse.json(
        { error: 'Parâmetros ou ID de configuração são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar parâmetros
    const validationErrors = validateBacktestParams(params);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos', details: validationErrors },
        { status: 400 }
      );
    }

    console.log('🚀 Iniciando backtesting para usuário:', currentUser.email);

    // Executar backtesting usando serviço base
    const backtestService = new BacktestService();
    const result = await backtestService.runBacktest(params);

    // Salvar configuração e resultado automaticamente
    let finalConfigId = configId;
    
    try {
      // Se não há configId, criar uma configuração temporária
      if (!finalConfigId) {
        console.log('💾 Criando configuração temporária para salvar resultado...');
        
        finalConfigId = await safeTransaction('create-temp-backtest-config', () =>
          backtestService.saveBacktestConfig(
            currentUser.id,
            params,
            `Backtest ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
            `Simulação executada em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`
          ),
          { affectedTables: ['backtest_configs'] }
        );
        
        console.log('✅ Configuração temporária criada:', finalConfigId);
      }

      // Salvar resultado
      if (finalConfigId) {
        console.log('💾 Salvando resultado do backtest...');
        
        await safeTransaction('save-backtest-result', () =>
          backtestService.saveBacktestResult(finalConfigId!, result),
          { affectedTables: ['backtest_results'] }
        );
        
        console.log('✅ Resultado salvo com sucesso');
      }
      
    } catch (saveError) {
      console.error('Erro ao salvar configuração/resultado do backtest:', saveError);
      // Não falhar a request se não conseguir salvar, mas logar o erro
    }

    console.log('✅ Backtesting concluído com sucesso');

    return NextResponse.json({ 
      result,
      configId: finalConfigId || null,
      saved: !!finalConfigId
    });

  } catch (error) {
    console.error('Erro ao executar backtesting:', error);
    
    // Retornar erro mais específico se possível
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Função de validação de parâmetros
function validateBacktestParams(params: BacktestParams): string[] {
  const errors: string[] = [];

  if (!params.assets || params.assets.length === 0) {
    errors.push('Pelo menos um ativo é obrigatório');
  }

  if (params.assets && params.assets.length > 20) {
    errors.push('Máximo 20 ativos por carteira');
  }

  if (params.assets) {
    const totalAllocation = params.assets.reduce((sum: number, a: { allocation: number }) => sum + a.allocation, 0);
    if (Math.abs(totalAllocation - 1) > 0.01) {
      errors.push('Alocações devem somar 100%');
    }

    // Validar tickers
    for (const asset of params.assets) {
      if (!asset.ticker || typeof asset.ticker !== 'string') {
        errors.push('Ticker inválido');
      }
      if (!asset.allocation || asset.allocation <= 0 || asset.allocation > 1) {
        errors.push(`Alocação inválida para ${asset.ticker}`);
      }
    }
  }

  if (!params.initialCapital || params.initialCapital <= 0) {
    errors.push('Capital inicial deve ser positivo');
  }

  if (!params.monthlyContribution || params.monthlyContribution <= 0) {
    errors.push('Aporte mensal deve ser positivo');
  }

  if (!params.startDate || !params.endDate) {
    errors.push('Datas de início e fim são obrigatórias');
  }

  if (params.startDate && params.endDate && params.startDate >= params.endDate) {
    errors.push('Data de início deve ser anterior à data de fim');
  }

  if (params.startDate && params.endDate) {
    const monthsDiff = (params.endDate.getTime() - params.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsDiff < 12) {
      errors.push('Período mínimo de 12 meses');
    }
  }

  if (params.rebalanceFrequency && !['monthly', 'quarterly', 'yearly'].includes(params.rebalanceFrequency)) {
    errors.push('Frequência de rebalanceamento inválida');
  }

  return errors;
}
