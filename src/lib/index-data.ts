/**
 * Helper functions para buscar dados de índices no Server Side
 * Usado para Server Components e metadata generation
 */

import { prisma } from '@/lib/prisma'

export interface IndexListItem {
  id: string
  ticker: string
  name: string
  description: string
  color: string
  currentPoints: number
  accumulatedReturn: number
  dailyChange: number | null
  currentYield: number | null
  assetCount: number
  lastUpdate: Date | null
  sparklineData?: Array<{ date: string; points: number }> | null
}

export async function getIndicesList(): Promise<IndexListItem[]> {
  const indices = await prisma.indexDefinition.findMany({
    include: {
      history: {
        orderBy: { date: 'desc' },
        take: 1
      },
      composition: {
        include: {
          definition: false
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  // Buscar histórico para sparkline de cada índice em paralelo
  const mappedIndices = await Promise.all(
    indices.map(async (index) => {
      // Buscar últimos 30 pontos históricos para o sparkline
      const sparklineHistory = await prisma.indexHistoryPoints.findMany({
        where: { indexId: index.id },
        orderBy: { date: 'desc' }, // Mais recentes primeiro
        take: 30, // Últimos 30 dias
        select: {
          date: true,
          points: true,
        },
      })

      const latestPoint = index.history[0]
      const initialPoints = 100.0
      const currentPoints = latestPoint?.points || initialPoints
      const accumulatedReturn = ((currentPoints - initialPoints) / initialPoints) * 100
      const dailyChange = latestPoint?.dailyChange ?? null

      // Formatar dados do sparkline (inverter ordem para cronológica: mais antigo -> mais recente)
      const sparklineData = sparklineHistory
        .reverse() // Inverter para ordem cronológica
        .map(point => ({
          date: point.date.toISOString().split('T')[0], // Formato YYYY-MM-DD
          points: point.points,
        }))

      return {
        id: index.id,
        ticker: index.ticker,
        name: index.name,
        description: index.description,
        color: index.color,
        currentPoints,
        accumulatedReturn,
        dailyChange,
        currentYield: latestPoint?.currentYield || null,
        assetCount: index.composition.length,
        lastUpdate: latestPoint?.date || null,
        sparklineData: sparklineData.length > 0 ? sparklineData : null,
      }
    }),
  )

  // Ordenar por retorno acumulado (maior primeiro)
  return mappedIndices.sort(
    (a, b) => b.accumulatedReturn - a.accumulatedReturn
  )
}

export async function getIndexByTicker(ticker: string) {
  const index = await prisma.indexDefinition.findUnique({
    where: { ticker: ticker.toUpperCase() },
    include: {
      history: {
        orderBy: { date: 'desc' },
        take: 1
      },
      composition: {
        orderBy: { assetTicker: 'asc' }
      }
    }
  })

  if (!index) {
    return null
  }

  const latestPoint = index.history[0]
  const initialPoints = 100.0
  const currentPoints = latestPoint?.points || initialPoints
  const accumulatedReturn = ((currentPoints - initialPoints) / initialPoints) * 100

  const totalDividendsResult = await prisma.indexHistoryPoints.aggregate({
    where: { indexId: index.id },
    _sum: {
      dividendsReceived: true
    }
  })
  const totalDividendsReceived = totalDividendsResult._sum.dividendsReceived 
    ? Number(totalDividendsResult._sum.dividendsReceived) 
    : 0

  return {
    id: index.id,
    ticker: index.ticker,
    name: index.name,
    description: index.description,
    color: index.color,
    methodology: index.methodology,
    config: index.config,
    currentPoints,
    accumulatedReturn,
    currentYield: latestPoint?.currentYield || null,
    dailyChange: latestPoint?.dailyChange || null,
    lastUpdate: latestPoint?.date || null,
    totalDividendsReceived,
    composition: index.composition
  }
}

