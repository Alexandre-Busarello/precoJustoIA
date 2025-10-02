import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, safeQueryWithParams } from '@/lib/prisma-wrapper';
import { getCurrentUser } from '@/lib/user-service';

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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'ID do ranking é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar o ranking específico do usuário
    const ranking = await safeQueryWithParams('get-ranking-by-id', () =>
      prisma.rankingHistory.findFirst({
        where: {
          id: id,
          userId: currentUser.id // Garantir que o ranking pertence ao usuário
        },
        select: {
          id: true,
          model: true,
          params: true,
          results: true,
          resultCount: true,
          createdAt: true,
        }
      }),
      {
        id: id,
        userId: currentUser.id
      }
    );

    if (!ranking) {
      return NextResponse.json(
        { error: 'Ranking não encontrado' },
        { status: 404 }
      );
    }

    // Função para obter nome amigável do modelo
    const getModelDisplayName = (model: string): string => {
      const modelNames: Record<string, string> = {
        'graham': 'Fórmula de Graham',
        'dividendYield': 'Anti-Dividend Trap',
        'lowPE': 'Baixo P/L',
        'magicFormula': 'Fórmula Mágica',
        'fcd': 'Fluxo de Caixa Descontado',
        'gordon': 'Fórmula de Gordon',
        'fundamentalist': 'Fundamentalista 3+1',
        'ai': 'Análise Preditiva com IA'
      };
      return modelNames[model] || model;
    };

    // Função para gerar descrição do histórico
    const generateHistoryDescription = (model: string, params: Record<string, unknown>): string => {
      switch (model) {
        case 'graham':
          return `Margem de segurança: ${params.marginOfSafety || 15}%`;
        case 'dividendYield':
          return `Yield mínimo: ${params.minYield || 6}%`;
        case 'lowPE':
          return `P/L máximo: ${params.maxPE || 15}`;
        case 'magicFormula':
          return `ROE mínimo: ${params.minROE || 15}%`;
        case 'fcd':
          return `Taxa de crescimento: ${params.growthRate || 5}%`;
        case 'gordon':
          return `Crescimento de dividendos: ${params.dividendGrowthRate || 5}%`;
        case 'fundamentalist':
          return `ROIC mín: ${params.minROIC || 10}%, Dívida/EBITDA máx: ${params.maxDebtToEbitda || 3}`;
        case 'ai':
          return `Tolerância ao risco: ${params.riskTolerance || 'moderado'}`;
        default:
          return 'Parâmetros personalizados';
      }
    };

    // Formatar dados para resposta
    const formattedRanking = {
      id: ranking.id,
      model: ranking.model,
      params: ranking.params,
      results: ranking.results,
      resultCount: ranking.resultCount,
      createdAt: ranking.createdAt,
      modelName: getModelDisplayName(ranking.model),
      description: generateHistoryDescription(ranking.model, ranking.params as Record<string, unknown>)
    };

    return NextResponse.json({
      ranking: formattedRanking
    });

  } catch (error) {
    console.error('Erro ao buscar ranking:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
