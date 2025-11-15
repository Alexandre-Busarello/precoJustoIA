/**
 * Serviço para cálculo do P/L histórico agregado da bolsa
 * 
 * Calcula a média ponderada por market cap do P/L de todas as ações STOCK da B3
 */

import { prisma } from '@/lib/prisma'
import { toNumber } from '@/lib/strategies'
import { Decimal } from '@prisma/client/runtime/library'

export interface PLBolsaDataPoint {
  date: string // ISO date string (YYYY-MM-DD)
  pl: number // P/L agregado ponderado
  averagePl: number // Média histórica até aquela data
  companyCount: number // Número de empresas incluídas no cálculo
}

export interface PLBolsaStatistics {
  currentPL: number
  averagePL: number
  minPL: number
  maxPL: number
  lastUpdate: string
}

export interface PLBolsaFilters {
  startDate?: Date
  endDate?: Date
  sector?: string
  minScore?: number // 0-100
  excludeUnprofitable?: boolean
}

/**
 * Busca dados do cache no banco de dados
 */
async function getCachedData(
  startDate: Date,
  endDate: Date,
  sector: string | undefined,
  minScore: number | undefined,
  excludeUnprofitable: boolean
): Promise<PLBolsaDataPoint[]> {
  const start = new Date(startDate)
  start.setDate(1)
  const end = new Date(endDate)
  end.setDate(1)

  // Construir where clause corretamente para campos nullable
  const whereClause: any = {
    date: {
      gte: start,
      lte: end,
    },
    excludeUnprofitable,
  }

  // Tratar campos nullable corretamente
  if (sector !== undefined) {
    whereClause.sector = sector || null
  } else {
    whereClause.sector = null
  }

  if (minScore !== undefined) {
    whereClause.minScore = minScore ?? null
  } else {
    whereClause.minScore = null
  }

  const cached = await (prisma as any).plBolsaHistory.findMany({
    where: whereClause,
    orderBy: {
      date: 'asc',
    },
  })

  return cached.map((item: { date: Date; pl: Decimal; averagePl: Decimal; companyCount: number }) => ({
    date: item.date.toISOString().split('T')[0],
    pl: toNumber(item.pl) || 0,
    averagePl: toNumber(item.averagePl) || 0,
    companyCount: item.companyCount,
  }))
}

/**
 * Salva dados calculados no cache do banco
 */
async function saveToCache(
  data: PLBolsaDataPoint[],
  sector: string | undefined,
  minScore: number | undefined,
  excludeUnprofitable: boolean
): Promise<void> {
  // Salvar em lote para melhor performance
  const promises = data.map(async (item) => {
    const monthStart = new Date(item.date)
    monthStart.setDate(1)

    // Construir filtros para busca
    const whereClause: any = {
      date: monthStart,
      excludeUnprofitable,
    }

    // Adicionar filtros opcionais (null para "todos")
    if (sector !== undefined) {
      whereClause.sector = sector || null
    } else {
      whereClause.sector = null
    }

    if (minScore !== undefined) {
      whereClause.minScore = minScore ?? null
    } else {
      whereClause.minScore = null
    }

    // Verificar se já existe
    const existing = await (prisma as any).plBolsaHistory.findFirst({
      where: whereClause,
    })

    if (existing) {
      // Atualizar existente
      await (prisma as any).plBolsaHistory.update({
        where: { id: existing.id },
        data: {
          pl: item.pl,
          averagePl: item.averagePl,
          companyCount: item.companyCount,
          calculatedAt: new Date(),
        },
      })
    } else {
      // Criar novo
      await (prisma as any).plBolsaHistory.create({
        data: {
          date: monthStart,
          pl: item.pl,
          averagePl: item.averagePl,
          companyCount: item.companyCount,
          sector: sector || null,
          minScore: minScore ?? null,
          excludeUnprofitable,
        },
      })
    }
  })

  await Promise.all(promises)
}

/**
 * Calcula o P/L agregado para meses específicos (sem cache)
 * @param initialCumulativeSum - Soma acumulada dos P/Ls anteriores (para calcular média histórica correta)
 * @param initialCount - Contador de meses anteriores (para calcular média histórica correta)
 */
async function calculateMonthsPL(
  months: Date[],
  companyIds: number[],
  companiesWithScore: Set<number> | null,
  excludeUnprofitable: boolean,
  initialCumulativeSum: number = 0,
  initialCount: number = 0
): Promise<PLBolsaDataPoint[]> {
  const results: PLBolsaDataPoint[] = []
  let cumulativePLSum = initialCumulativeSum
  let cumulativeCount = initialCount

  // Para cada mês, calcular P/L agregado
  for (const month of months) {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)

    // Buscar preços mensais (último dia útil do mês)
    const historicalPrices = await prisma.historicalPrice.findMany({
      where: {
        companyId: { in: companyIds },
        interval: '1mo',
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        companyId: true,
        date: true,
        close: true,
      },
      orderBy: {
        date: 'desc',
      },
    })

    // Agrupar por companyId e pegar o último preço do mês
    const pricesByCompany = new Map<number, { date: Date; price: number }>()
    for (const price of historicalPrices) {
      if (!pricesByCompany.has(price.companyId)) {
        const priceValue = toNumber(price.close)
        if (priceValue !== null && priceValue > 0 && isFinite(priceValue)) {
          pricesByCompany.set(price.companyId, {
            date: price.date,
            price: priceValue,
          })
        }
      }
    }

    // Buscar dados financeiros mais recentes até o mês atual
    const financialData = await prisma.financialData.findMany({
      where: {
        companyId: { in: Array.from(pricesByCompany.keys()) },
        year: { lte: month.getFullYear() },
        ...(excludeUnprofitable && {
          lucroLiquido: { gt: 0 },
        }),
      },
      select: {
        companyId: true,
        year: true,
        pl: true,
        lpa: true,
        lucroLiquido: true,
        marketCap: true,
      },
      orderBy: {
        year: 'desc',
      },
    })

    // Agrupar por companyId e pegar o mais recente
    const latestFinancialByCompany = new Map<number, typeof financialData[0]>()
    for (const financial of financialData) {
      if (!latestFinancialByCompany.has(financial.companyId) && financial) {
        latestFinancialByCompany.set(financial.companyId, financial)
      }
    }

    // Calcular P/L agregado ponderado
    let totalWeightedPL = 0
    let totalMarketCap = 0
    let validCompanies = 0

    for (const [companyId, priceData] of pricesByCompany.entries()) {
      // Aplicar filtro de score se especificado
      if (companiesWithScore && !companiesWithScore.has(companyId)) {
        continue
      }

      const financial = latestFinancialByCompany.get(companyId)
      if (!financial) {
        continue
      }

      // Calcular P/L
      let pl: number | null = null

      // Tentar usar FinancialData.pl primeiro
      const financialPL = financial.pl ? toNumber(financial.pl) : null
      if (financialPL !== null && financialPL > 0) {
        pl = financialPL
      }
      // Se não tiver, calcular: preço / LPA
      else {
        const financialLPA = financial.lpa ? toNumber(financial.lpa) : null
        if (financialLPA !== null && financialLPA > 0 && priceData.price > 0) {
          pl = priceData.price / financialLPA
        }
      }

      if (!pl || pl <= 0 || !isFinite(pl)) {
        continue
      }

      // Market cap para ponderação
      const marketCap = financial.marketCap
        ? toNumber(financial.marketCap)
        : null

      // Se não tiver market cap, usar peso 1 (ou excluir)
      if (!marketCap || marketCap <= 0) {
        continue
      }

      totalWeightedPL += pl * marketCap
      totalMarketCap += marketCap
      validCompanies++
    }

    if (totalMarketCap > 0 && validCompanies > 0) {
      const aggregatedPL = totalWeightedPL / totalMarketCap

      // Calcular média histórica até este ponto
      cumulativePLSum += aggregatedPL
      cumulativeCount++
      const averagePL = cumulativePLSum / cumulativeCount

      results.push({
        date: monthEnd.toISOString().split('T')[0],
        pl: aggregatedPL,
        averagePl: averagePL,
        companyCount: validCompanies,
      })
    }
  }

  return results
}

/**
 * Calcula o P/L agregado da bolsa para um período específico
 * Usa cache do banco de dados para evitar reprocessamento
 */
export async function calculateAggregatedPL(
  filters: PLBolsaFilters = {}
): Promise<PLBolsaDataPoint[]> {
  const {
    startDate = new Date('2001-01-01'),
    endDate = new Date(),
    sector,
    minScore,
    excludeUnprofitable = false
  } = filters

  // Normalizar datas para primeiro dia do mês
  const start = new Date(startDate)
  start.setDate(1)
  const end = new Date(endDate)
  end.setDate(1)

  // 1. Tentar buscar do cache primeiro
  const cachedData = await getCachedData(
    start,
    end,
    sector,
    minScore,
    excludeUnprofitable
  )

  // Se temos todos os dados em cache, retornar
  const requestedMonths: Date[] = []
  const current = new Date(start)
  while (current <= end) {
    requestedMonths.push(new Date(current))
    current.setMonth(current.getMonth() + 1)
  }

  const cachedMonths = new Set(
    cachedData.map((d) => {
      const date = new Date(d.date)
      date.setDate(1)
      return date.getTime()
    })
  )

  const missingMonths = requestedMonths.filter(
    (m) => !cachedMonths.has(m.getTime())
  )

  // Se não há meses faltantes, retornar cache
  if (missingMonths.length === 0) {
    return cachedData
  }

  // 2. Buscar empresas STOCK (necessário para calcular meses faltantes)
  const companies = await prisma.company.findMany({
    where: {
      assetType: 'STOCK',
      ...(sector && { sector }),
    },
    select: {
      id: true,
      ticker: true,
      sector: true,
    },
  })

  if (companies.length === 0) {
    return cachedData
  }

  const companyIds = companies.map(c => c.id)

  // Buscar snapshots mais recentes para filtrar por score
  let companiesWithScore: Set<number> | null = null
  if (minScore !== undefined) {
    const snapshots = await prisma.assetSnapshot.findMany({
      where: {
        companyId: { in: companyIds },
        isLatest: true,
        overallScore: { gte: minScore },
      },
      select: {
        companyId: true,
      },
    })
    companiesWithScore = new Set(snapshots.map(s => s.companyId))
  }

  // 3. Calcular apenas meses faltantes
  // Se temos cache anterior, precisamos calcular a média histórica considerando os meses anteriores
  let initialCumulativeSum = 0
  let initialCount = 0
  
  if (cachedData.length > 0) {
    // Calcular soma acumulada e contador dos meses em cache anteriores aos faltantes
    const firstMissingMonth = missingMonths[0]?.getTime()
    const previousCached = cachedData.filter((d) => {
      const date = new Date(d.date)
      date.setDate(1)
      return date.getTime() < (firstMissingMonth || Infinity)
    })
    
    initialCumulativeSum = previousCached.reduce((sum, item) => sum + item.pl, 0)
    initialCount = previousCached.length
  }
  
  const calculatedData = await calculateMonthsPL(
    missingMonths,
    companyIds,
    companiesWithScore,
    excludeUnprofitable,
    initialCumulativeSum,
    initialCount
  )

  // 4. Combinar cache + novos dados calculados
  let allData: PLBolsaDataPoint[] = []
  
  if (cachedData.length > 0) {
    // Combinar e ordenar por data
    allData = [...cachedData, ...calculatedData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    // Recalcular média histórica desde o início do período solicitado
    let cumulativeSum = 0
    allData = allData.map((item, index) => {
      cumulativeSum += item.pl
      const averagePl = cumulativeSum / (index + 1)
      return {
        ...item,
        averagePl,
      }
    })
  } else {
    // Se não há cache, usar dados calculados diretamente
    allData = calculatedData
  }

  // 5. Salvar novos dados calculados no cache
  if (calculatedData.length > 0) {
    await saveToCache(calculatedData, sector, minScore, excludeUnprofitable)
    
    // Se recalculamos a média histórica, atualizar todos os registros afetados
    if (cachedData.length > 0) {
      await saveToCache(allData, sector, minScore, excludeUnprofitable)
    }
  }

  return allData
}

/**
 * Lista setores disponíveis para filtro
 */
export async function getAvailableSectors(): Promise<string[]> {
  const sectors = await prisma.company.findMany({
    where: {
      assetType: 'STOCK',
      sector: { not: null },
    },
    select: {
      sector: true,
    },
    distinct: ['sector'],
  })

  return sectors
    .map(s => s.sector)
    .filter((s): s is string => s !== null)
    .sort()
}

/**
 * Calcula estatísticas do P/L histórico
 */
export async function getPLStatistics(
  filters: PLBolsaFilters = {}
): Promise<PLBolsaStatistics> {
  const data = await calculateAggregatedPL(filters)

  if (data.length === 0) {
    return {
      currentPL: 0,
      averagePL: 0,
      minPL: 0,
      maxPL: 0,
      lastUpdate: new Date().toISOString(),
    }
  }

  const plValues = data.map(d => d.pl)
  const currentPL = data[data.length - 1].pl
  const averagePL = data[data.length - 1].averagePl
  const minPL = Math.min(...plValues)
  const maxPL = Math.max(...plValues)
  const lastUpdate = data[data.length - 1].date

  return {
    currentPL,
    averagePL,
    minPL,
    maxPL,
    lastUpdate,
  }
}

