import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, safeQuery } from '@/lib/prisma-wrapper';
import { getCurrentUser } from '@/lib/user-service';

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
    const rankingsToday = await safeQuery('rankings-today', () => 
      prisma.rankingHistory.count({
        where: {
          userId: currentUser.id,
          createdAt: {
            gte: startOfToday,
            lte: endOfToday
          }
        }
      })
    );

    console.log('📊 Buscando total de rankings...')
    const totalRankings = await safeQuery('total-rankings', () =>
      prisma.rankingHistory.count({
        where: {
          userId: currentUser.id
        }
      })
    );

    console.log('📊 Buscando total de empresas...')
    const totalCompanies = await safeQuery('total-companies', () => 
      prisma.company.count()
    );

    console.log('📊 Verificando se usuário já usou Backtest...')
    const backtestCount = await safeQuery('backtest-count', () =>
      prisma.backtestConfig.count({
        where: {
          userId: currentUser.id
        }
      })
    );
    const hasUsedBacktest = backtestCount > 0;

    // Contar modelos disponíveis baseado na subscription
    const isPremium = session.user.subscriptionTier === 'PREMIUM';
    const availableModels = isPremium ? 7 : 1; // Premium: 7 modelos, Free: 1 modelo

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
