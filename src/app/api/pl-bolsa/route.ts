import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  calculateAggregatedPL,
  getAvailableSectors,
  getPLStatistics,
  PLBolsaFilters,
} from '@/lib/pl-bolsa-service'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Revalidar a cada hora

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const isLoggedIn = !!session

    const searchParams = request.nextUrl.searchParams

    // Parse parâmetros
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const sector = searchParams.get('sector') || undefined
    const minScoreStr = searchParams.get('minScore')
    const excludeUnprofitableStr = searchParams.get('excludeUnprofitable')

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

    if (!isLoggedIn && (!endDate || endDate > lastYearEnd)) {
      endDate = lastYearEnd
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

    // Validar excludeUnprofitable
    const excludeUnprofitable =
      excludeUnprofitableStr === 'true' || excludeUnprofitableStr === '1'

    // Montar filtros
    const filters: PLBolsaFilters = {
      startDate,
      endDate,
      sector,
      minScore,
      excludeUnprofitable,
    }

    // Buscar dados
    const [data, statistics, sectors] = await Promise.all([
      calculateAggregatedPL(filters),
      getPLStatistics(filters),
      getAvailableSectors(),
    ])

    return NextResponse.json({
      data,
      statistics,
      sectors,
      filters: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        sector,
        minScore,
        excludeUnprofitable,
      },
      requiresLogin: !isLoggedIn && (!endDateStr || new Date(endDateStr) > lastYearEnd),
    })
  } catch (error) {
    console.error('Erro ao buscar P/L histórico da bolsa:', error)
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}

