import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
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

    // Extrair parâmetros de query
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const model = searchParams.get('model');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10); // Máximo 50 itens (10 páginas de 5 itens)

    // Construir where clause com filtros
    const whereClause: any = {
      userId: currentUser.id
    };

    // Filtro por data
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // Adicionar 23:59:59 ao endDate para incluir todo o dia
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = endDateTime;
      }
    }

    // Filtro por modelo
    if (model && model !== 'all') {
      whereClause.model = model;
    }

    // Buscar histórico do usuário ordenado por data mais recente com retry
    const [history, totalCount] = await withRetry(() =>
      Promise.all([
        prisma.rankingHistory.findMany({
          where: whereClause,
          orderBy: {
            createdAt: 'desc'
          },
          take: limit,
          skip: (page - 1) * limit,
          select: {
            id: true,
            model: true,
            params: true,
            results: true, // Incluir resultados cached
            resultCount: true,
            createdAt: true,
          }
        }),
        prisma.rankingHistory.count({
          where: whereClause
        })
      ])
    );

    // Transformar dados para melhor apresentação
    const formattedHistory = history.map(item => {
      const params = item.params as Record<string, unknown>;
      const assetTypeFilter = params.assetTypeFilter as 'b3' | 'bdr' | 'both' | undefined;
      
      return {
        id: item.id,
        model: item.model,
        params: item.params,
        results: item.results, // Incluir resultados cached
        resultCount: item.resultCount,
        createdAt: item.createdAt,
        modelName: getModelDisplayName(item.model),
        description: generateHistoryDescription(item.model, params),
        assetTypeFilter: assetTypeFilter || 'b3' // Padrão 'b3' para rankings antigos (antes da funcionalidade BDR)
      };
    });

    // Debug apenas quando necessário
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 /ranking-history: Retornando', formattedHistory.length, 'itens de', totalCount, 'total para', currentUser.email)
    }

    return NextResponse.json({
      history: formattedHistory,
      count: history.length,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      hasMore: totalCount > (page * limit)
    });

  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    
    // Retornar histórico vazio em caso de erro
    return NextResponse.json({
      history: [],
      count: 0,
      totalCount: 0,
      page: 1,
      totalPages: 0,
      hasMore: false
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
