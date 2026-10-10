import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma-wrapper';
import { upsertBacktestConfig } from '@/lib/adaptive-backtest-service';
import { getCurrentUser } from '@/lib/user-service';

// POST /api/backtest/config - Criar (ou reaproveitar) uma configuração
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
    const { id, reused } = await upsertBacktestConfig(currentUser.id, {
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

    return NextResponse.json({ 
      configId: id,
      config,
      message: reused ? 'Configuração atualizada' : 'Configuração criada'
    });

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
