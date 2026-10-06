import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, safeQueryWithParams } from '@/lib/prisma-wrapper';
import { getCurrentUser } from '@/lib/user-service';
import { STOCK_VALUATION_MODELS_COUNT } from '@/lib/site-constants';

// Função helper removida pois não é usada

export async function GET() {
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

    // Data de hoje (início e fim do dia)
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    // Executar queries sequencialmente para evitar sobrecarga do pgbouncer
    console.log('📊 Buscando rankings de hoje...')
    const rankingsToday = await safeQueryWithParams('rankings-today', () => 
      prisma.rankingHistory.count({
        where: {
          userId: currentUser.id,
          createdAt: {
            gte: startOfToday,
            lte: endOfToday
          }
        }
      }),
      {
        userId: currentUser.id,
        date: startOfToday.toISOString().split('T')[0]
      }
    );

    console.log('📊 Buscando total de rankings...')
    const totalRankings = await safeQueryWithParams('total-rankings', () =>
      prisma.rankingHistory.count({
        where: {
          userId: currentUser.id
        }
      }),
      {
        userId: currentUser.id
      }
    );

    console.log('📊 Buscando total de empresas...')
    const totalCompanies = await safeQueryWithParams('total-companies', () => 
      prisma.company.count(),
      {
        type: 'all'
      }
    );

    console.log('📊 Verificando se usuário já usou Backtest...')
    const backtestCount = await safeQueryWithParams('backtest-count', () =>
      prisma.backtestConfig.count({
        where: {
          userId: currentUser.id
        }
      }),
      {
        userId: currentUser.id
      }
    );
    const hasUsedBacktest = backtestCount > 0;

    // Contar modelos disponíveis baseado na subscription
    const isPremium = currentUser.isPremium;
    const availableModels = isPremium ? STOCK_VALUATION_MODELS_COUNT : 1; // Free: só Graham

    return NextResponse.json({
      rankingsToday,
      totalRankings,
      totalCompanies,
      availableModels,
      isPremium,
      hasUsedBacktest // ← Novo campo
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    
    // Retornar dados padrão em caso de erro
    return NextResponse.json({
      rankingsToday: 0,
      totalRankings: 0,
      totalCompanies: 0,
      availableModels: 1, // Padrão para usuários não logados
      isPremium: false,
      hasUsedBacktest: false
    });
  }
}
