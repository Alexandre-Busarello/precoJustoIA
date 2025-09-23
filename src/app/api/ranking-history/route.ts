import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/user-service';

// Função helper simplificada para retry
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`Tentativa ${attempt}/${maxRetries} falhou:`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Pequena pausa entre tentativas
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  throw new Error('Todas as tentativas falharam');
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.log('❌ /ranking-history: Usuário não autorizado')
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Usar o serviço centralizado para obter o usuário válido
    const currentUser = await getCurrentUser();
    
    if (!currentUser?.id) {
      console.log('❌ /ranking-history: Usuário não encontrado pelo serviço centralizado')
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Buscar histórico do usuário ordenado por data mais recente com retry
    const history = await withRetry(() =>
      prisma.rankingHistory.findMany({
        where: {
          userId: currentUser.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10, // Limitar a 10 resultados mais recentes
        select: {
          id: true,
          model: true,
          params: true,
          results: true, // Incluir resultados cached
          resultCount: true,
          createdAt: true,
        }
      })
    );

    // Transformar dados para melhor apresentação
    const formattedHistory = history.map(item => ({
      id: item.id,
      model: item.model,
      params: item.params,
      results: item.results, // Incluir resultados cached
      resultCount: item.resultCount,
      createdAt: item.createdAt,
      modelName: getModelDisplayName(item.model),
      description: generateHistoryDescription(item.model, item.params as Record<string, unknown>)
    }));

    // Debug apenas quando necessário
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 /ranking-history: Retornando', formattedHistory.length, 'itens para', currentUser.email)
    }

    return NextResponse.json({
      history: formattedHistory,
      count: history.length
    });

  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    
    // Retornar histórico vazio em caso de erro
    return NextResponse.json({
      history: [],
      count: 0
    });
  }
}

function getModelDisplayName(model: string): string {
  switch (model) {
    case 'ai':
      return '🤖 IA Premium';
    case 'gordon':
      return 'Fórmula de Gordon';
    case 'graham':
      return 'Fórmula de Graham';
    case 'dividendYield':
      return 'Dividend Yield';
    case 'lowPE':
      return 'Value Investing';
    case 'magicFormula':
      return 'Fórmula Mágica';
    case 'fcd':
      return 'Fluxo de Caixa Descontado';
    case 'fundamentalist':
      return 'Fundamentalista 3+1';      
    default:
      return model;
  }
}

function generateHistoryDescription(model: string, params: Record<string, unknown>): string {
  switch (model) {
    case 'ai':
      const riskTolerance = params.riskTolerance as string || 'Moderado';
      const timeHorizon = params.timeHorizon as string || 'Longo Prazo';
      const focus = params.focus as string || 'Crescimento e Valor';
      return `Risco: ${riskTolerance}, Horizonte: ${timeHorizon}, Foco: ${focus}`;
    case 'gordon':
      const discountRate = ((params.discountRate as number || 0.10) * 100).toFixed(1);
      const dividendGrowthRate = ((params.dividendGrowthRate as number || 0.03) * 100).toFixed(1);
      return `Taxa desconto: ${discountRate}%, Crescimento div: ${dividendGrowthRate}%`;
    case 'graham':
      return `Margem de segurança: ${((params.marginOfSafety as number) * 100).toFixed(0)}%`;
    case 'dividendYield':
      return `Yield mínimo: ${((params.minYield as number) * 100).toFixed(1)}%`;
    case 'lowPE':
      return `P/L máx: ${params.maxPE}, ROE min: ${((params.minROE as number) * 100).toFixed(0)}%`;
    case 'magicFormula':
      return `Top ${params.limit || 10} empresas`;
    case 'fcd':
      const growthRate = ((params.growthRate as number || 0.025) * 100).toFixed(1);
      const discountRateFcd = ((params.discountRate as number || 0.10) * 100).toFixed(1);
      return `Crescimento: ${growthRate}%, Taxa: ${discountRateFcd}%`;
    default:
      return 'Parâmetros personalizados';
  }
}

// POST handler removido - agora usamos redirecionamento direto com sessionStorage
