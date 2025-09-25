import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, safeQuery } from '@/lib/prisma-wrapper';
import { getCurrentUser } from '@/lib/user-service';

// GET /api/backtest/configs/[id] - Buscar configuração específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const configId = params.id;

    // Buscar configuração completa
    const config = await safeQuery('get-backtest-config-full', () =>
      prisma.backtestConfig.findFirst({
        where: { 
          id: configId,
          userId: currentUser.id 
        },
        include: { 
          assets: true,
          transactions: {
            orderBy: [{ month: 'asc' }, { id: 'asc' }]
          }
        }
      })
    );

    if (!config) {
      return NextResponse.json(
        { error: 'Configuração não encontrada' },
        { status: 404 }
      );
    }

    console.log(`📊 Config encontrada: ${config.name} com ${config.assets.length} ativos e ${config.transactions?.length || 0} transações`);

    // Converter Decimals para numbers
    const processedConfig = {
      ...config,
      initialCapital: Number(config.initialCapital),
      monthlyContribution: Number(config.monthlyContribution),
      assets: config.assets.map(asset => ({
        ...asset,
        targetAllocation: Number(asset.targetAllocation),
        averageDividendYield: (asset as any).averageDividendYield ? Number((asset as any).averageDividendYield) : null
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
