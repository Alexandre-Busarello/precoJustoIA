import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { AIReportsService } from '@/lib/ai-reports-service'
import { cache } from '@/lib/cache-service'

const CACHE_TTL = 4 * 60 * 60; // 4 horas em segundos

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const resolvedParams = await params
    const ticker = resolvedParams.ticker.toUpperCase()
    
    // Verificar autenticação
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    // Verificar se é Premium
    const user = await getCurrentUser()
    if (!user?.isPremium) {
      return NextResponse.json(
        { error: 'Histórico disponível apenas para usuários Premium' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Criar chave de cache considerando ticker e limit
    const cacheKey = `ai-reports-history:${ticker}:${limit}`;

    // Verificar cache
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Buscar histórico de relatórios
    const reports = await AIReportsService.getReportHistory(ticker, limit)

    const response = {
      success: true,
      reports,
      count: reports.length
    };

    // Salvar no cache
    await cache.set(cacheKey, response, { ttl: CACHE_TTL });

    return NextResponse.json(response)

  } catch (error) {
    console.error('Erro ao buscar histórico:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

