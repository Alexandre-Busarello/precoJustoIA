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
  currentYield: number | null
  assetCount: number
  lastUpdate: Date | null
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

  return indices.map(index => {
    const latestPoint = index.history[0]
    const initialPoints = 100.0
    const currentPoints = latestPoint?.points || initialPoints
    const accumulatedReturn = ((currentPoints - initialPoints) / initialPoints) * 100

    return {
      id: index.id,
      ticker: index.ticker,
      name: index.name,
      description: index.description,
      color: index.color,
      currentPoints,
      accumulatedReturn,
      currentYield: latestPoint?.currentYield || null,
      assetCount: index.composition.length,
      lastUpdate: latestPoint?.date || null
    }
  })
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

