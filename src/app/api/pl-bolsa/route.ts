import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  calculateAggregatedPL,
  getAvailableSectors,
  getPLStatistics,
  PLBolsaFilters,
} from '@/lib/pl-bolsa-service'
import { cache } from '@/lib/cache-service'

const CACHE_TTL = 4 * 60 * 60; // 4 horas em segundos

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Revalidar a cada hora

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    // Verificar se há sessão válida com usuário autenticado
    const isLoggedIn = !!(session?.user?.id || session?.user?.email)

    const searchParams = request.nextUrl.searchParams

    // Parse parâmetros
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const sector = searchParams.get('sector') || undefined
    const minScoreStr = searchParams.get('minScore')

    // Validar e parsear datas
    let startDate: Date | undefined
    let endDate: Date | undefined

    if (startDateStr) {
      startDate = new Date(startDateStr)
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: 'Data inicial inválida' },
          { status: 400 }
        )
      }
    }

    if (endDateStr) {
      endDate = new Date(endDateStr)
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Data final inválida' },
          { status: 400 }
        )
      }
    }

    // Se usuário não está logado, limitar data final ao ano anterior
    const currentYear = new Date().getFullYear()
    const lastYearEnd = new Date(currentYear - 1, 11, 31) // 31 de dezembro do ano anterior

    // Aplicar limitação apenas se usuário NÃO está logado
    if (!isLoggedIn) {
      // Se não há data final especificada ou se a data final é maior que o limite, aplicar limite
      if (!endDate || endDate > lastYearEnd) {
        endDate = lastYearEnd
      }
    }

    // Validar score
    let minScore: number | undefined
    if (minScoreStr) {
      minScore = parseInt(minScoreStr, 10)
      if (isNaN(minScore) || minScore < 0 || minScore > 100) {
        return NextResponse.json(
          { error: 'Score mínimo deve estar entre 0 e 100' },
          { status: 400 }
        )
      }
    }

    // Criar chave de cache considerando todos os parâmetros
    const cacheKeyParts = [
      'pl-bolsa',
      startDateStr || 'no-start',
      endDateStr || 'no-end',
      sector || 'all-sectors',
      minScoreStr || 'no-min-score',
      isLoggedIn ? 'logged' : 'anon',
    ]
    const cacheKey = cacheKeyParts.join(':')

    // Verificar cache
    const cachedData = await cache.get(cacheKey)
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // Montar filtros
    const filters: PLBolsaFilters = {
      startDate,
      endDate,
      sector,
      minScore,
    }

    // Buscar dados
    const [data, statistics, sectors] = await Promise.all([
      calculateAggregatedPL(filters),
      getPLStatistics(filters),
      getAvailableSectors(),
    ])

    const response = {
      data,
      statistics,
      sectors,
      filters: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        sector,
        minScore,
      },
      requiresLogin: !isLoggedIn && (!endDateStr || new Date(endDateStr) > lastYearEnd),
    }

    // Salvar no cache
    await cache.set(cacheKey, response, { ttl: CACHE_TTL })

    return NextResponse.json(response)
  } catch (error) {
    console.error('Erro ao buscar P/L histórico da bolsa:', error)
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}

