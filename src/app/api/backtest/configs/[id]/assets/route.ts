import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, safeQueryWithParams, safeTransaction, safeWrite } from '@/lib/prisma-wrapper';
import { getCurrentUser } from '@/lib/user-service';
import { calculateAverageDividendYield } from '@/lib/dividend-yield-calculator';

// POST /api/backtest/configs/[id]/assets - Adicionar ativo à configuração
export async function POST(
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
    if (!body.ticker || typeof body.ticker !== 'string') {
      return NextResponse.json(
        { error: 'Ticker é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se a configuração existe e pertence ao usuário
    const config = await safeQueryWithParams('get-backtest-config', () =>
      prisma.backtestConfig.findFirst({
        where: {
          id: configId,
          userId: currentUser.id
        },
        include: {
          assets: true
        }
      }),
      {
        id: configId,
        userId: currentUser.id
      }
    );

    if (!config) {
      return NextResponse.json(
        { error: 'Configuração não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se o ativo já existe na configuração
    const existingAsset = config.assets.find(asset => asset.ticker === body.ticker.toUpperCase());
    if (existingAsset) {
      return NextResponse.json(
        { error: 'Ativo já existe nesta configuração' },
        { status: 409 }
      );
    }

    // Verificar limite de ativos (máximo 20)
    if (config.assets.length >= 20) {
      return NextResponse.json(
        { error: 'Máximo de 20 ativos por configuração' },
        { status: 400 }
      );
    }

    // Buscar dividend yield médio do novo ativo
    console.log(`📊 Buscando dividend yield médio para ${body.ticker.toUpperCase()}`);
    let averageDividendYield: number | null = null;
    try {
      averageDividendYield = await calculateAverageDividendYield(body.ticker);
      console.log(`✅ DY médio para ${body.ticker}: ${averageDividendYield ? (averageDividendYield * 100).toFixed(2) + '%' : 'N/A'}`);
    } catch (error) {
      console.error(`❌ Erro ao buscar DY médio para ${body.ticker}:`, error);
    }

    // Calcular nova alocação igualitária para todos os ativos (incluindo o novo)
    const totalAssets = config.assets.length + 1; // +1 para o novo ativo
    const equalAllocation = 1 / totalAssets;

    // Preparar atualizações para os ativos existentes
    const updatedAssets = config.assets.map(asset => ({
      id: asset.id,
      targetAllocation: equalAllocation
    }));

    // Executar transação para adicionar o novo ativo e rebalancear os existentes
    const result = await safeTransaction('add-asset-to-config', async () => {
      // Adicionar novo ativo
      const newAsset = await prisma.backtestAsset.create({
        data: {
          backtestId: configId,
          ticker: body.ticker.toUpperCase(),
          targetAllocation: equalAllocation,
          averageDividendYield: averageDividendYield
        }
      });

      // Atualizar alocações dos ativos existentes
      for (const asset of updatedAssets) {
        await prisma.backtestAsset.update({
          where: { id: asset.id },
          data: { targetAllocation: asset.targetAllocation }
        });
      }

      // Atualizar timestamp da configuração
      await prisma.backtestConfig.update({
        where: { id: configId },
        data: { updatedAt: new Date() }
      });

      return newAsset;
    }, { affectedTables: ['backtest_assets', 'backtest_configs'] });

    // Buscar configuração atualizada
    const updatedConfig = await safeQueryWithParams('get-updated-config', () =>
      prisma.backtestConfig.findUnique({
        where: { id: configId },
        include: {
          assets: true,
          results: {
            orderBy: { calculatedAt: 'desc' },
            take: 1
          }
        }
      }),
      { id: configId }
    );

    return NextResponse.json({ 
      asset: result,
      config: updatedConfig,
      message: 'Ativo adicionado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao adicionar ativo à configuração:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/backtest/configs/[id]/assets - Remover ativo da configuração
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
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se a configuração existe e pertence ao usuário
    const config = await safeQueryWithParams('get-backtest-config-for-delete', () =>
      prisma.backtestConfig.findFirst({
        where: {
          id: configId,
          userId: currentUser.id
        },
        include: {
          assets: true
        }
      }),
      { id: configId, userId: currentUser.id }
    );

    if (!config) {
      return NextResponse.json(
        { error: 'Configuração não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se o ativo existe na configuração
    const assetToRemove = config.assets.find(asset => asset.ticker === ticker.toUpperCase());
    if (!assetToRemove) {
      return NextResponse.json(
        { error: 'Ativo não encontrado nesta configuração' },
        { status: 404 }
      );
    }

    // Não permitir remover o último ativo
    if (config.assets.length <= 1) {
      return NextResponse.json(
        { error: 'Não é possível remover o último ativo da configuração' },
        { status: 400 }
      );
    }

    // Calcular redistribuição das alocações
    const removedAllocation = parseFloat(assetToRemove.targetAllocation.toString());
    const remainingAssets = config.assets.filter(asset => asset.id !== assetToRemove.id);
    const currentRemainingTotal = remainingAssets.reduce((sum, asset) => 
      sum + parseFloat(asset.targetAllocation.toString()), 0
    );

    // Redistribuir proporcionalmente
    const updatedAssets = remainingAssets.map(asset => ({
      id: asset.id,
      targetAllocation: currentRemainingTotal > 0 
        ? (parseFloat(asset.targetAllocation.toString()) / currentRemainingTotal) * (currentRemainingTotal + removedAllocation)
        : 1 / remainingAssets.length
    }));

    // Executar transação para remover o ativo e rebalancear os restantes
    await safeTransaction('remove-asset-from-config', async () => {
      // Remover ativo
      await prisma.backtestAsset.delete({
        where: { id: assetToRemove.id }
      });

      // Atualizar alocações dos ativos restantes
      for (const asset of updatedAssets) {
        await prisma.backtestAsset.update({
          where: { id: asset.id },
          data: { targetAllocation: asset.targetAllocation }
        });
      }

      // Atualizar timestamp da configuração
      await prisma.backtestConfig.update({
        where: { id: configId },
        data: { updatedAt: new Date() }
      });
    }, { affectedTables: ['backtest_assets', 'backtest_configs'] });

    // Buscar configuração atualizada
    const updatedConfig = await safeQueryWithParams('get-updated-config-after-delete', () =>
      prisma.backtestConfig.findUnique({
        where: { id: configId },
        include: {
          assets: true,
          results: {
            orderBy: { calculatedAt: 'desc' },
            take: 1
          }
        }
      }),
      { id: configId }
    );

    return NextResponse.json({ 
      config: updatedConfig,
      message: 'Ativo removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover ativo da configuração:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
