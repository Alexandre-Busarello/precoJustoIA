import 'server-only'

/**
 * Orquestra uma simulação do "Onde aportar": regras de acesso por plano, carga do universo (tickers digitados,
 * carteira, radar ou todo o mercado) e o motor puro. Também registra as compras simuladas como transações PENDENTES
 * na carteira (nunca confirma sozinho).
 */

import { prisma } from '@/lib/prisma'
import { PortfolioService } from '@/lib/portfolio-service'
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service'
import { PortfolioTransactionService } from '@/lib/portfolio-transaction-service'
import {
  ALL_MODELS,
  DEFAULT_ALLOCATION_OPTIONS,
  DEFAULT_MARKET_OPTIONS,
  FREE_MAX_TICKERS,
  FREE_MODELS,
  getPreset,
} from './constants'
import { maskResult, runAllocation, runMarketAllocation } from './engine'
import { loadAllocationMeta, loadAssetContexts, loadMarketContexts } from './load-context'
import type { SimulateRequest } from './schema'
import type { AllocationOptions, AllocationResult, AssetContext, MarketOptions } from './types'

export type AllocationTier = 'anon' | 'free' | 'premium'

export interface AllocationViewer {
  userId: string | null
  isPremium: boolean
}

export type LockReason = 'login' | 'premium-tickers' | 'premium-universe' | 'premium-market'

export interface SimulateResponse {
  tier: AllocationTier
  /** Resultado real, ou prévia mascarada quando `locked`. */
  result: AllocationResult
  locked: LockReason | null
  /** Rótulo do universo usado ("Carteira Dividendos", "Meu radar", "3 tickers", "Todo o mercado"). */
  universeLabel: string
  unknownTickers: string[]
  /** Carteira usada (para "Registrar compras"). */
  portfolioId: string | null
}

export class AllocationError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

function tierOf(viewer: AllocationViewer): AllocationTier {
  if (viewer.isPremium) return 'premium'
  return viewer.userId ? 'free' : 'anon'
}

function buildOptions(request: SimulateRequest, premium: boolean, hasTargets: boolean): AllocationOptions {
  const preset = getPreset(request.preset)
  const requested = request.models && request.models.length > 0 ? request.models : ALL_MODELS
  const models = premium ? requested : requested.filter((m) => FREE_MODELS.includes(m))
  return {
    ...DEFAULT_ALLOCATION_OPTIONS,
    models: models.length > 0 ? models : FREE_MODELS,
    weights: request.weights ?? preset.weights,
    maxPerAssetPct: request.maxPerAssetPct ?? DEFAULT_ALLOCATION_OPTIONS.maxPerAssetPct,
    maxPortfolioPct: request.maxPortfolioPct ?? DEFAULT_ALLOCATION_OPTIONS.maxPortfolioPct,
    allowFractional: request.allowFractional ?? DEFAULT_ALLOCATION_OPTIONS.allowFractional,
    respectTargets: hasTargets && (request.preset === 'pesos' || (request.respectTargets ?? true)),
    revealQuality: premium,
  }
}

interface PortfolioUniverse {
  name: string
  contexts: AssetContext[]
  unknown: string[]
  dataDate: string | null
  hasTargets: boolean
}

/** Carteira do usuário: ativos com peso-alvo + posições atuais (quantidade × cotação usada no motor). */
async function loadPortfolioUniverse(portfolioId: string, userId: string): Promise<PortfolioUniverse> {
  const portfolio = await PortfolioService.getPortfolioConfig(portfolioId, userId)
  if (!portfolio) throw new AllocationError('Carteira não encontrada.', 404)
  const holdings = await PortfolioMetricsService.getCurrentHoldings(portfolioId).catch(() => [])
  const quantities = new Map(holdings.filter((h) => h.quantity > 0).map((h) => [h.ticker.toUpperCase(), h.quantity]))
  const targets = new Map(portfolio.assets.map((a) => [a.ticker.toUpperCase(), Number(a.targetAllocation)]))
  const tickers = [...new Set([...targets.keys(), ...quantities.keys()])]
  const loaded = await loadAssetContexts(tickers)
  const contexts = loaded.contexts.map((c) => {
    const quantity = quantities.get(c.ticker) ?? 0
    return {
      ...c,
      holding: quantity > 0 ? { quantity, value: quantity * (c.price ?? 0) } : null,
      targetWeight: targets.get(c.ticker) ?? 0,
    }
  })
  return {
    name: portfolio.name,
    contexts,
    unknown: loaded.unknown,
    dataDate: loaded.dataDate,
    hasTargets: [...targets.values()].some((t) => t > 0),
  }
}

async function loadRadarTickers(userId: string): Promise<string[]> {
  const radar = await prisma.radarConfig.findUnique({ where: { userId }, select: { tickers: true } })
  return Array.isArray(radar?.tickers) ? (radar.tickers as unknown[]).filter((t): t is string => typeof t === 'string') : []
}

/** Carteira para "Complementar minha carteira": valor por ticker e setor. */
async function loadComplementPortfolio(portfolioId: string, userId: string): Promise<MarketOptions['portfolio']> {
  const portfolio = await PortfolioService.getPortfolioConfig(portfolioId, userId)
  if (!portfolio) return []
  const holdings = (await PortfolioMetricsService.getCurrentHoldings(portfolioId).catch(() => [])).filter((h) => h.quantity > 0)
  if (holdings.length === 0) return []
  const companies = await prisma.company.findMany({
    where: { ticker: { in: holdings.map((h) => h.ticker.toUpperCase()) } },
    select: { ticker: true, sector: true, assetType: true },
  })
  const sectorOf = new Map(companies.map((c) => [c.ticker, c.assetType === 'FII' ? 'Fundos Imobiliários' : c.sector]))
  return holdings.map((h) => ({ ticker: h.ticker.toUpperCase(), sector: sectorOf.get(h.ticker.toUpperCase()) ?? null, value: h.currentValue }))
}

export async function simulateAllocation(request: SimulateRequest, viewer: AllocationViewer): Promise<SimulateResponse> {
  const tier = tierOf(viewer)
  const premium = tier === 'premium'
  const universe = request.universe

  if (universe.kind === 'market') {
    const loaded = await loadMarketContexts(universe.assetTypes)
    const meta = await loadAllocationMeta(loaded.dataDate)
    const market: MarketOptions = {
      maxAssets: universe.maxAssets ?? DEFAULT_MARKET_OPTIONS.maxAssets,
      sectorMaxAssets: universe.sectorMaxAssets ?? DEFAULT_MARKET_OPTIONS.sectorMaxAssets,
      sectorMaxPct: universe.sectorMaxPct ?? DEFAULT_MARKET_OPTIONS.sectorMaxPct,
      complementPortfolio: premium && !!universe.complementPortfolioId && (universe.complementPortfolio ?? true),
      portfolio:
        premium && viewer.userId && universe.complementPortfolioId
          ? await loadComplementPortfolio(universe.complementPortfolioId, viewer.userId)
          : undefined,
    }
    const result = runMarketAllocation({
      amount: request.amount,
      assets: loaded.contexts,
      options: buildOptions(request, true, false),
      market,
      meta,
      excludeTickers: universe.excludeTickers,
    })
    return {
      tier,
      result: premium ? result : maskResult(result, { hideTickers: true }),
      locked: premium ? null : 'premium-market',
      universeLabel: 'Todo o mercado',
      unknownTickers: [],
      portfolioId: null,
    }
  }

  if (universe.kind === 'portfolio' || universe.kind === 'radar') {
    if (!viewer.userId) {
      return {
        tier,
        result: runAllocation({ amount: request.amount, assets: [], options: buildOptions(request, false, false), meta: await loadAllocationMeta(null) }),
        locked: 'login',
        universeLabel: universe.kind === 'portfolio' ? 'Minha carteira' : 'Meu radar',
        unknownTickers: [],
        portfolioId: null,
      }
    }
    if (universe.kind === 'portfolio') {
      const loaded = await loadPortfolioUniverse(universe.portfolioId, viewer.userId)
      const options = buildOptions(request, premium, loaded.hasTargets)
      const result = runAllocation({ amount: request.amount, assets: loaded.contexts, options, meta: await loadAllocationMeta(loaded.dataDate) })
      return {
        tier,
        result: premium ? result : maskResult(result, { hideTickers: false }),
        locked: premium ? null : 'premium-universe',
        universeLabel: loaded.name,
        unknownTickers: loaded.unknown,
        portfolioId: universe.portfolioId,
      }
    }
    const loaded = await loadAssetContexts(await loadRadarTickers(viewer.userId))
    const result = runAllocation({ amount: request.amount, assets: loaded.contexts, options: buildOptions(request, premium, false), meta: await loadAllocationMeta(loaded.dataDate) })
    return {
      tier,
      result: premium ? result : maskResult(result, { hideTickers: false }),
      locked: premium ? null : 'premium-universe',
      universeLabel: 'Meu radar',
      unknownTickers: loaded.unknown,
      portfolioId: null,
    }
  }

  const loaded = await loadAssetContexts(universe.tickers)
  const options = buildOptions(request, premium, false)
  const result = runAllocation({ amount: request.amount, assets: loaded.contexts, options, meta: await loadAllocationMeta(loaded.dataDate) })
  const overLimit = !premium && universe.tickers.length > FREE_MAX_TICKERS
  return {
    tier,
    result: overLimit ? maskResult(result, { hideTickers: false }) : result,
    locked: overLimit ? 'premium-tickers' : null,
    universeLabel: `${universe.tickers.length} ${universe.tickers.length === 1 ? 'ticker' : 'tickers'}`,
    unknownTickers: loaded.unknown,
    portfolioId: null,
  }
}

/** Data de hoje (meia-noite UTC do dia em São Paulo), no formato das colunas `@db.Date`. */
function todayDate(): Date {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  return new Date(`${day}T00:00:00.000Z`)
}

export const REGISTER_NOTE_PREFIX = 'Onde aportar'

/**
 * Refaz a simulação no servidor (os números não vêm do cliente) e grava um aporte (CASH_CREDIT) e as compras (BUY)
 * como PENDENTES na carteira. O usuário confirma ou descarta cada uma em Sugestões.
 */
export async function registerAllocationPurchases(
  request: SimulateRequest,
  viewer: AllocationViewer
): Promise<{ created: number; portfolioId: string }> {
  if (!viewer.userId || !viewer.isPremium) throw new AllocationError('Registrar compras na carteira é um recurso Premium.', 403)
  if (request.universe.kind !== 'portfolio') throw new AllocationError('Escolha uma carteira para registrar as compras.', 400)
  const { portfolioId } = request.universe
  const simulation = await simulateAllocation(request, viewer)
  const allocations = simulation.result.allocations
  if (allocations.length === 0) throw new AllocationError('A simulação não tem compras para registrar.', 400)

  const date = todayDate()
  const total = simulation.result.totalAllocated
  const cashBefore = await PortfolioTransactionService.getCurrentCashBalance(portfolioId)
  let running = cashBefore + total
  const rows = [
    {
      portfolioId,
      date,
      type: 'CASH_CREDIT' as const,
      amount: total,
      cashBalanceBefore: cashBefore,
      cashBalanceAfter: running,
      status: 'PENDING' as const,
      isAutoSuggested: false,
      notes: `${REGISTER_NOTE_PREFIX}: aporte para ${allocations.length} ${allocations.length === 1 ? 'compra simulada' : 'compras simuladas'}`,
    },
    ...allocations.map((row) => {
      const before = running
      running -= row.value
      return {
        portfolioId,
        date,
        type: 'BUY' as const,
        ticker: row.ticker,
        amount: row.value,
        price: row.price,
        quantity: row.qty,
        cashBalanceBefore: before,
        cashBalanceAfter: running,
        status: 'PENDING' as const,
        isAutoSuggested: false,
        notes: `${REGISTER_NOTE_PREFIX}: ${row.reasons.slice(0, 2).join(' · ')}`,
      }
    }),
  ]
  await prisma.portfolioTransaction.createMany({ data: rows })
  return { created: rows.length, portfolioId }
}
