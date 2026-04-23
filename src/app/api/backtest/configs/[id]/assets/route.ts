import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, safeTransaction, safeWrite } from '@/lib/prisma-wrapper';
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

    const tickerUpper = body.ticker.toUpperCase();
    const companyForAsset = await prisma.company.findUnique({
      where: { ticker: tickerUpper },
      select: { assetType: true },
    });
    if (companyForAsset?.assetType === 'FII') {
      return NextResponse.json(
        { error: 'Backtest indisponível para FIIs (sem histórico de preços diário adequado)' },
        { status: 400 }
      );
    }

    // Verificar se a configuração existe e pertence ao usuário
    let config = await prisma.backtestConfig.findFirst({
      where: {
        id: configId,
        userId: currentUser.id
      },
      include: {
        assets: true
      }
    });

    // Se a configuração não existe, criar uma nova com dados básicos
    if (!config) {
      console.log(`📝 Configuração ${configId} não existe, criando uma nova...`);
      
      // Validar dados obrigatórios para criar a configuração
      if (!body.configData) {
        return NextResponse.json(
          { error: 'Dados da configuração são obrigatórios para criar uma nova configuração' },
          { status: 400 }
        );
      }

      const { name, description, startDate, endDate, initialCapital, monthlyContribution, rebalanceFrequency } = body.configData;

      // Criar nova configuração
      config = await safeWrite('create-backtest-config-with-first-asset', () =>
        prisma.backtestConfig.create({
          data: {
            id: configId,
            userId: currentUser.id,
            name: name || 'Nova Configuração',
            description: description || '',
            startDate: startDate ? new Date(startDate) : new Date(new Date().getFullYear() - 5, 0, 1),
            endDate: endDate ? new Date(endDate) : new Date(),
            initialCapital: initialCapital || 10000,
            monthlyContribution: monthlyContribution || 0,
            rebalanceFrequency: rebalanceFrequency || 'MONTHLY'
          },
          include: {
            assets: true
          }
        }),
        ['backtest_configs']
      );

      console.log(`✅ Configuração ${configId} criada com sucesso`);
    }

    // Verificar se o ativo já existe na configuração
    const existingAsset = config.assets.find((asset) => asset.ticker === tickerUpper);
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
      const calculatedYield = await calculateAverageDividendYield(body.ticker);
      // Aplicar cap de 10% no dividend yield
      averageDividendYield = calculatedYield !== null ? Math.min(calculatedYield, 0.10) : null;
      console.log(`✅ DY médio para ${body.ticker}: ${averageDividendYield ? (averageDividendYield * 100).toFixed(2) + '%' : 'N/A'}${calculatedYield && calculatedYield > 0.10 ? ' (limitado a 10%)' : ''}`);
    } catch (error) {
      console.error(`❌ Erro ao buscar DY médio para ${body.ticker}:`, error);
    }

    // Calcular alocação para o novo ativo
    let newAssetAllocation: number;
    let updatedAssets: Array<{ id: string; targetAllocation: number }> = [];

    // Se é o primeiro ativo, alocação é 100%
    if (config.assets.length === 0) {
      newAssetAllocation = 1.0;
      console.log(`📊 Primeiro ativo da configuração: ${body.ticker} com 100% de alocação`);
    } else {
      // Se já existem ativos, calcular diluição proporcional
      const totalAssets = config.assets.length + 1;
      newAssetAllocation = body.targetAllocation || (1 / totalAssets);

      // Validar que a alocação está entre 0 e 1
      if (newAssetAllocation <= 0 || newAssetAllocation > 1) {
        return NextResponse.json(
          { error: 'Alocação deve estar entre 0% e 100%' },
          { status: 400 }
        );
      }

      // Calcular total de alocação dos ativos existentes
      const currentTotalAllocation = config.assets.reduce((sum, asset) => 
        sum + parseFloat(asset.targetAllocation.toString()), 0
      );

      console.log(`📊 Estado antes de adicionar ${body.ticker}:`);
      config.assets.forEach(asset => {
        const allocation = parseFloat(asset.targetAllocation.toString());
        console.log(`   - ${asset.ticker}: ${(allocation * 100).toFixed(2)}%`);
      });
      console.log(`   Total: ${(currentTotalAllocation * 100).toFixed(2)}%`);

      // Distribuir proporcionalmente a alocação restante entre os ativos existentes
      // Mantém as proporções relativas entre os ativos existentes
      // Exemplo: se temos 3 ativos com 50%, 30%, 20% e adicionamos um 4º com 20%,
      // os existentes ficam: 40%, 24%, 16% (mantendo a proporção 5:3:2)
      const remainingAllocation = 1 - newAssetAllocation;
      const dilutionFactor = currentTotalAllocation > 0 ? remainingAllocation / currentTotalAllocation : 0;

      console.log(`📊 Cálculo de diluição:`);
      console.log(`   - Alocação do novo ativo (${body.ticker}): ${(newAssetAllocation * 100).toFixed(2)}%`);
      console.log(`   - Alocação restante para existentes: ${(remainingAllocation * 100).toFixed(2)}%`);
      console.log(`   - Fator de diluição: ${(dilutionFactor * 100).toFixed(2)}%`);

      // Preparar atualizações para os ativos existentes (diluindo proporcionalmente)
      updatedAssets = config.assets.map(asset => {
        const currentAllocation = parseFloat(asset.targetAllocation.toString());
        const newAllocation = currentTotalAllocation > 0 
          ? currentAllocation * dilutionFactor
          : remainingAllocation / config.assets.length;
        
        console.log(`   - ${asset.ticker}: ${(currentAllocation * 100).toFixed(2)}% → ${(newAllocation * 100).toFixed(2)}%`);
        
        return {
          id: asset.id,
          targetAllocation: newAllocation
        };
      });
    }

    // Executar transação para adicionar o novo ativo e rebalancear os existentes
    const result = await safeTransaction('add-asset-to-config', async () => {
      // Adicionar novo ativo
      const newAsset = await prisma.backtestAsset.create({
        data: {
          backtestId: configId,
          ticker: body.ticker.toUpperCase(),
          targetAllocation: newAssetAllocation,
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
    const updatedConfig = await prisma.backtestConfig.findUnique({
      where: { id: configId },
      include: {
        assets: true,
        results: {
          orderBy: { calculatedAt: 'desc' },
          take: 1
        }
      }
    });

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
    const config = await prisma.backtestConfig.findFirst({
      where: {
        id: configId,
        userId: currentUser.id
      },
      include: {
        assets: true
      }
    });

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

    // Calcular redistribuição das alocações (apenas se houver outros ativos)
    const remainingAssets = config.assets.filter(asset => asset.id !== assetToRemove.id);
    const isLastAsset = remainingAssets.length === 0;

    let updatedAssets: Array<{ id: string; targetAllocation: number }> = [];

    if (!isLastAsset) {
      const removedAllocation = parseFloat(assetToRemove.targetAllocation.toString());
      const currentRemainingTotal = remainingAssets.reduce((sum, asset) => 
        sum + parseFloat(asset.targetAllocation.toString()), 0
      );

      // Redistribuir proporcionalmente mantendo as proporções relativas
      updatedAssets = remainingAssets.map(asset => ({
        id: asset.id,
        targetAllocation: currentRemainingTotal > 0 
          ? (parseFloat(asset.targetAllocation.toString()) / currentRemainingTotal) * (currentRemainingTotal + removedAllocation)
          : 1 / remainingAssets.length
      }));

      console.log(`📊 Removendo ${ticker} e redistribuindo alocação:`);
      updatedAssets.forEach(asset => {
        const original = config.assets.find(a => a.id === asset.id);
        console.log(`   - ${original?.ticker}: ${(parseFloat(original!.targetAllocation.toString()) * 100).toFixed(2)}% → ${(asset.targetAllocation * 100).toFixed(2)}%`);
      });
    } else {
      console.log(`📊 Removendo último ativo ${ticker} da configuração`);
    }

    // Executar transação para remover o ativo e rebalancear os restantes
    await safeTransaction('remove-asset-from-config', async () => {
      // Remover ativo
      await prisma.backtestAsset.delete({
        where: { id: assetToRemove.id }
      });

      // Atualizar alocações dos ativos restantes (se houver)
      if (!isLastAsset) {
        for (const asset of updatedAssets) {
          await prisma.backtestAsset.update({
            where: { id: asset.id },
            data: { targetAllocation: asset.targetAllocation }
          });
        }
      }

      // Atualizar timestamp da configuração
      await prisma.backtestConfig.update({
        where: { id: configId },
        data: { updatedAt: new Date() }
      });
    }, { affectedTables: ['backtest_assets', 'backtest_configs'] });

    // Buscar configuração atualizada
    const updatedConfig = await prisma.backtestConfig.findUnique({
      where: { id: configId },
      include: {
        assets: true,
        results: {
          orderBy: { calculatedAt: 'desc' },
          take: 1
        }
      }
    });

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
