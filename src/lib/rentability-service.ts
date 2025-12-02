/**
 * Serviço de Resolução de Rentabilidade
 * 
 * Resolve a taxa de rentabilidade esperada baseada em diferentes fontes:
 * - FIXED_RATE: Taxa manual (Free)
 * - PORTFOLIO: Média ponderada da carteira (PRO)
 * - RANKING: Estratégia de ranking (PRO)
 * - MANUAL_TICKERS: Tickers manuais (PRO)
 */

import { prisma } from './prisma'
import { PortfolioMetricsService } from './portfolio-metrics-service'
import { getCompaniesData } from './rank-builder-service'
import { toNumber } from './strategies/base-strategy'

export type StrategySource = 'FIXED_RATE' | 'PORTFOLIO' | 'RANKING' | 'MANUAL_TICKERS'

export interface RentabilityResult {
  annualRate: number // Taxa anual (ex: 0.12 = 12%)
  source: StrategySource
  details?: {
    portfolioId?: string
    portfolioName?: string
    rankingId?: string
    rankingName?: string
    tickers?: string[]
    averageDividendYield?: number
    averageCAGR?: number
  }
}

/**
 * Obtém rentabilidade média ponderada da carteira do usuário
 */
export async function getPortfolioAverageReturn(
  userId: string,
  portfolioId?: string
): Promise<RentabilityResult> {
  try {
    // Se portfolioId fornecido, usar ele; senão buscar primeira carteira ativa
    let portfolio
    if (portfolioId) {
      portfolio = await prisma.portfolioConfig.findFirst({
        where: {
          id: portfolioId,
          userId,
          isActive: true
        },
        include: {
          assets: {
            where: { isActive: true }
          },
          metrics: true
        }
      })
    } else {
      portfolio = await prisma.portfolioConfig.findFirst({
        where: {
          userId,
          isActive: true
        },
        include: {
          assets: {
            where: { isActive: true }
          },
          metrics: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    }

    if (!portfolio || portfolio.assets.length === 0) {
      throw new Error('Nenhuma carteira encontrada ou carteira vazia')
    }

    // Tentar usar annualizedReturn das métricas se disponível
    if (portfolio.metrics && portfolio.metrics.annualizedReturn) {
      const annualReturn = toNumber(portfolio.metrics.annualizedReturn)
      if (annualReturn && annualReturn > 0) {
        return {
          annualRate: annualReturn,
          source: 'PORTFOLIO',
          details: {
            portfolioId: portfolio.id,
            portfolioName: portfolio.name
          }
        }
      }
    }

    // Calcular métricas atualizadas
    const metrics = await PortfolioMetricsService.getMetrics(portfolio.id, userId)
    
    if (metrics && metrics.annualizedReturn && metrics.annualizedReturn > 0) {
      return {
        annualRate: metrics.annualizedReturn,
        source: 'PORTFOLIO',
        details: {
          portfolioId: portfolio.id,
          portfolioName: portfolio.name
        }
      }
    }

    // Fallback: calcular média ponderada baseada em dividend yield + CAGR esperado
    // Buscar dados das empresas
    const companiesData = await getCompaniesData()
    const tickerMap = new Map(companiesData.map(c => [c.ticker, c]))

    let totalAllocation = 0
    let weightedReturn = 0

    for (const asset of portfolio.assets) {
      const allocation = toNumber(asset.targetAllocation) || 0
      totalAllocation += allocation

      const company = tickerMap.get(asset.ticker)
      if (company) {
        const financials = company.financials
        const dy = toNumber(financials.dividendYield12m) || 0
        const cagr = toNumber(financials.cagrLucros5a) || toNumber(financials.crescimentoLucros) || 0
        
        // Estimativa conservadora: DY + CAGR (máximo 15% ao ano)
        const estimatedReturn = Math.min(0.15, dy + Math.max(0, cagr * 0.5))
        weightedReturn += allocation * estimatedReturn
      }
    }

    if (totalAllocation === 0) {
      throw new Error('Carteira sem alocações válidas')
    }

    const averageReturn = weightedReturn / totalAllocation

    return {
      annualRate: Math.max(0.05, averageReturn), // Mínimo 5% ao ano
      source: 'PORTFOLIO',
      details: {
        portfolioId: portfolio.id,
        portfolioName: portfolio.name
      }
    }
  } catch (error) {
    console.error('Erro ao calcular rentabilidade da carteira:', error)
    throw error
  }
}

/**
 * Obtém rentabilidade baseada em ranking de estratégia
 */
export async function getRankingReturn(
  userId: string,
  rankingId: string
): Promise<RentabilityResult> {
  try {
    const ranking = await prisma.rankingHistory.findFirst({
      where: {
        id: rankingId,
        userId
      }
    })

    if (!ranking) {
      throw new Error('Ranking não encontrado')
    }

    const params = ranking.params as any
    const results = ranking.results as any[]

    if (!results || results.length === 0) {
      throw new Error('Ranking sem resultados')
    }

    // Calcular média de rentabilidade esperada dos top 10 resultados
    const topResults = results.slice(0, Math.min(10, results.length))
    const companiesData = await getCompaniesData()
    const tickerMap = new Map(companiesData.map(c => [c.ticker, c]))

    let totalReturn = 0
    let count = 0

    for (const result of topResults) {
      const ticker = result.ticker
      const company = tickerMap.get(ticker)
      
      if (company) {
        const financials = company.financials
        const dy = toNumber(financials.dividendYield12m) || 0
        const cagr = toNumber(financials.cagrLucros5a) || toNumber(financials.crescimentoLucros) || 0
        
        // Estimativa: DY + CAGR
        const estimatedReturn = Math.min(0.20, dy + Math.max(0, cagr * 0.5))
        totalReturn += estimatedReturn
        count++
      }
    }

    if (count === 0) {
      throw new Error('Nenhum resultado válido no ranking')
    }

    const averageReturn = totalReturn / count

    return {
      annualRate: Math.max(0.05, averageReturn),
      source: 'RANKING',
      details: {
        rankingId: ranking.id,
        rankingName: ranking.model,
        averageDividendYield: averageReturn * 0.4, // Estimativa
        averageCAGR: averageReturn * 0.6
      }
    }
  } catch (error) {
    console.error('Erro ao calcular rentabilidade do ranking:', error)
    throw error
  }
}

/**
 * Obtém rentabilidade média de tickers manuais
 */
export async function getTickersReturn(
  tickers: string[]
): Promise<RentabilityResult> {
  try {
    if (!tickers || tickers.length === 0) {
      throw new Error('Lista de tickers vazia')
    }

    // Remover duplicatas e normalizar
    const uniqueTickers = [...new Set(tickers.map(t => t.toUpperCase().trim()))]
    
    const companiesData = await getCompaniesData()
    const tickerMap = new Map(companiesData.map(c => [c.ticker, c]))

    let totalReturn = 0
    let count = 0
    const validTickers: string[] = []

    for (const ticker of uniqueTickers) {
      const company = tickerMap.get(ticker)
      
      if (company) {
        const financials = company.financials
        const dy = toNumber(financials.dividendYield12m) || 0
        const cagr = toNumber(financials.cagrLucros5a) || toNumber(financials.crescimentoLucros) || 0
        
        // Estimativa: DY + CAGR
        const estimatedReturn = Math.min(0.20, dy + Math.max(0, cagr * 0.5))
        totalReturn += estimatedReturn
        count++
        validTickers.push(ticker)
      }
    }

    if (count === 0) {
      throw new Error('Nenhum ticker válido encontrado')
    }

    const averageReturn = totalReturn / count

    return {
      annualRate: Math.max(0.05, averageReturn),
      source: 'MANUAL_TICKERS',
      details: {
        tickers: validTickers,
        averageDividendYield: averageReturn * 0.4,
        averageCAGR: averageReturn * 0.6
      }
    }
  } catch (error) {
    console.error('Erro ao calcular rentabilidade dos tickers:', error)
    throw error
  }
}

/**
 * Resolve rentabilidade baseada na estratégia configurada
 */
export async function resolveRentability(params: {
  strategyType: StrategySource
  userId?: string
  manualRate?: number
  portfolioId?: string
  rankingId?: string
  manualTickers?: string[]
}): Promise<RentabilityResult> {
  const { strategyType, userId, manualRate, portfolioId, rankingId, manualTickers } = params

  switch (strategyType) {
    case 'FIXED_RATE':
      if (!manualRate || manualRate <= 0) {
        throw new Error('Taxa manual deve ser maior que zero')
      }
      return {
        annualRate: manualRate,
        source: 'FIXED_RATE'
      }

    case 'PORTFOLIO':
      if (!userId) {
        throw new Error('userId é obrigatório para estratégia PORTFOLIO')
      }
      return await getPortfolioAverageReturn(userId, portfolioId)

    case 'RANKING':
      if (!userId || !rankingId) {
        throw new Error('userId e rankingId são obrigatórios para estratégia RANKING')
      }
      return await getRankingReturn(userId, rankingId)

    case 'MANUAL_TICKERS':
      if (!manualTickers || manualTickers.length === 0) {
        throw new Error('Lista de tickers é obrigatória para estratégia MANUAL_TICKERS')
      }
      return await getTickersReturn(manualTickers)

    default:
      throw new Error(`Estratégia desconhecida: ${strategyType}`)
  }
}

