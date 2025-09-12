import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Data de hoje (início e fim do dia)
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    // Executar queries sequencialmente para evitar sobrecarga do pgbouncer
    console.log('📊 Buscando rankings de hoje...')
    const rankingsToday = await withRetry(() => 
      prisma.rankingHistory.count({
        where: {
          userId: session.user.id,
          createdAt: {
            gte: startOfToday,
            lte: endOfToday
          }
        }
      })
    );

    console.log('📊 Buscando total de rankings...')
    const totalRankings = await withRetry(() =>
      prisma.rankingHistory.count({
        where: {
          userId: session.user.id
        }
      })
    );

    console.log('📊 Buscando total de empresas...')
    const totalCompanies = await withRetry(() => prisma.company.count());

    // Contar modelos disponíveis baseado na subscription
    const isPremium = session.user.subscriptionTier === 'PREMIUM';
    const availableModels = isPremium ? 4 : 1; // Premium: 4 modelos, Free: 1 modelo

    return NextResponse.json({
      rankingsToday,
      totalRankings,
      totalCompanies,
      availableModels,
      isPremium
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    
    // Retornar dados padrão em caso de erro
    return NextResponse.json({
      rankingsToday: 0,
      totalRankings: 0,
      totalCompanies: 0,
      availableModels: 1, // Padrão para usuários não logados
      isPremium: false
    });
  }
}
