import 'server-only'

/**
 * Carrega o contexto de cada ativo para o motor do "Onde aportar", pelo MESMO caminho da página do ativo:
 * ações via `calculateCompanyOverallScore` (o serviço por trás de `/api/company-analysis/[ticker]`, com todos os
 * modelos, como um assinante vê) e FIIs com o preço-teto calculado como em `/fii/[ticker]`. Assim os preços justos
 * mostrados aqui batem com os da página do ativo.
 *
 * O contexto não depende dos modelos escolhidos, então o cache é por ativo e por dia (e, no modo "Todo o mercado",
 * da tabela inteira de candidatos por dia e tipos de ativo). Só os modelos com preço justo entram; Lynch e Barsi não.
 */

import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache-service'
import { calculateCompanyOverallScore } from '@/lib/calculate-company-score-service'
import { computeFiiListingValuation } from '@/lib/fii-listing-valuation'
import { getCachedFiiOverallScore } from '@/lib/fii-score-loader'
import { getAverageDailyTradedValue, LIQUIDITY_DEFAULTS, toLiquidityAssetType } from '@/lib/finance/liquidity'
import { getMacroAssumptions, keFromMacro } from '@/lib/finance/macro'
import { isFinancial } from '@/lib/finance/sector-classification'
import { toFiniteNumber } from '@/lib/finance/utils'
import type { StrategyAnalysis } from '@/lib/strategies'
import { fundamentalsStatus, type AnnualFundamentals } from './fundamentals'
import type { AllocationAssetType, AllocationMeta, AssetContext, DataCoverage, FairValueModelId } from './types'

const ASSET_TTL_SECONDS = 4 * 60 * 60
const MARKET_TTL_SECONDS = 6 * 60 * 60
const CONCURRENCY = 6

const PRISMA_TYPE: Record<AllocationAssetType, 'STOCK' | 'FII' | 'ETF' | 'BDR'> = {
  stock: 'STOCK',
  fii: 'FII',
  etf: 'ETF',
  bdr: 'BDR',
}

function fromPrismaType(type: string): AllocationAssetType | null {
  if (type === 'STOCK') return 'stock'
  if (type === 'FII') return 'fii'
  if (type === 'ETF') return 'etf'
  if (type === 'BDR') return 'bdr'
  return null
}

/** Dia corrente em São Paulo (YYYY-MM-DD): o cache vira junto com o pregão. */
function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      out[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return out
}

/** Parte do contexto que vem da análise do ativo (cacheada por ticker e dia). */
interface Valuation {
  price: number | null
  fairValues: Partial<Record<FairValueModelId, number | null>>
  margins: Partial<Record<FairValueModelId, number | null>>
  qualityScore: number | null
  coverage: DataCoverage | null
}

const EMPTY_VALUATION: Valuation = { price: null, fairValues: {}, margins: {}, qualityScore: null, coverage: null }

const STOCK_MODEL_KEYS = ['graham', 'fcd', 'gordon', 'bazin', 'bankPvp'] as const satisfies readonly FairValueModelId[]

function fairValueOf(strategy: StrategyAnalysis | null | undefined): number | null {
  const value = strategy?.fairValue
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

async function stockValuation(ticker: string): Promise<Valuation> {
  return cache.wrap(
    `allocation:stock:v1:${ticker}:${todayKey()}`,
    async () => {
      const result = await calculateCompanyOverallScore(ticker, { isPremium: true, isLoggedIn: true, includeStrategies: true })
      if (!result) return EMPTY_VALUATION
      const fairValues: Valuation['fairValues'] = {}
      const margins: Valuation['margins'] = {}
      for (const key of STOCK_MODEL_KEYS) {
        const strategy = result.strategies?.[key]
        fairValues[key] = fairValueOf(strategy)
        margins[key] = toFiniteNumber(strategy?.discount)
      }
      return {
        price: result.currentPrice > 0 ? result.currentPrice : null,
        fairValues,
        margins,
        qualityScore: toFiniteNumber(result.overallScore?.score),
        coverage: result.overallScore?.dataCoverage ?? null,
      }
    },
    { ttl: ASSET_TTL_SECONDS }
  )
}

interface CompanyRow {
  id: number
  ticker: string
  name: string
  sector: string | null
  industry: string | null
  assetType: string
  logoUrl: string | null
  dailyQuotes: { date: Date; price: unknown }[]
  fiiData: { dividendYield: unknown; pvp: unknown; valorPatrimonial: unknown; cotacao: unknown; isPapel: boolean | null; lastDividendValue: unknown } | null
}

/** Preço-teto do FII exatamente como a página `/fii/[ticker]` calcula (histórico vazio, DY de 12 meses do FiiData). */
async function fiiValuation(company: CompanyRow): Promise<Valuation> {
  return cache.wrap(
    `allocation:fii:v1:${company.ticker}:${todayKey()}`,
    async () => {
      const price = toFiniteNumber(company.dailyQuotes[0]?.price)
      const fd = company.fiiData
      if (!fd || price === null || price <= 0) return { ...EMPTY_VALUATION, price }
      const valuation = computeFiiListingValuation(
        {
          ticker: company.ticker,
          name: company.name,
          sector: company.sector,
          currentPrice: price,
          logoUrl: company.logoUrl,
          financials: { dy: fd.dividendYield, pvp: fd.pvp, vpa: fd.valorPatrimonial, fiiCotacao: fd.cotacao },
          ultimoDividendo: toFiniteNumber(fd.lastDividendValue) ?? undefined,
          dividendHistory: [],
        },
        { isPapel: fd.isPapel ?? null }
      )
      const score = await getCachedFiiOverallScore(company.ticker)
      return {
        price,
        fairValues: { fiiCeiling: valuation.fairValue },
        margins: {},
        qualityScore: toFiniteNumber(score?.score),
        coverage: null,
      }
    },
    { ttl: ASSET_TTL_SECONDS }
  )
}

async function loadCompanies(where: { tickers?: string[]; types?: AllocationAssetType[] }): Promise<CompanyRow[]> {
  const rows = await prisma.company.findMany({
    where: {
      ...(where.tickers ? { ticker: { in: where.tickers } } : { isActive: true }),
      ...(where.types ? { assetType: { in: where.types.map((t) => PRISMA_TYPE[t]) } } : {}),
    },
    select: {
      id: true,
      ticker: true,
      name: true,
      sector: true,
      industry: true,
      assetType: true,
      logoUrl: true,
      dailyQuotes: { orderBy: { date: 'desc' }, take: 1, select: { date: true, price: true } },
      fiiData: { select: { dividendYield: true, pvp: true, valorPatrimonial: true, cotacao: true, isPapel: true, lastDividendValue: true } },
    },
    orderBy: { ticker: 'asc' },
  })
  return rows as unknown as CompanyRow[]
}

/** Os dois últimos anos de cada ação, para a checagem de fundamentos. Uma consulta para todas. */
async function loadAnnualFundamentals(companyIds: number[]): Promise<Map<number, AnnualFundamentals[]>> {
  const map = new Map<number, AnnualFundamentals[]>()
  if (companyIds.length === 0) return map
  const rows = await prisma.financialData.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: [{ companyId: 'asc' }, { year: 'desc' }],
    select: { companyId: true, year: true, lucroLiquido: true, roe: true, margemLiquida: true, ebitda: true, dividaLiquidaEbitda: true },
  })
  for (const row of rows) {
    const list = map.get(row.companyId) ?? []
    if (list.length >= 2) continue
    list.push({
      year: row.year,
      lucroLiquido: toFiniteNumber(row.lucroLiquido),
      roe: toFiniteNumber(row.roe),
      margemLiquida: toFiniteNumber(row.margemLiquida),
      ebitda: toFiniteNumber(row.ebitda),
      dividaLiquidaEbitda: toFiniteNumber(row.dividaLiquidaEbitda),
    })
    map.set(row.companyId, list)
  }
  return map
}

function isoDay(date: Date | null | undefined): string | null {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null
}

/** Contexto completo de um ativo (análise + liquidez + fundamentos). ETFs e BDRs só levam cotação e liquidez. */
async function buildContext(
  company: CompanyRow,
  liquidity: number | null,
  annual: AnnualFundamentals[] | undefined
): Promise<AssetContext | null> {
  const assetType = fromPrismaType(company.assetType)
  if (!assetType) return null
  const quotePrice = toFiniteNumber(company.dailyQuotes[0]?.price)
  let valuation: Valuation = { ...EMPTY_VALUATION, price: quotePrice }
  try {
    if (assetType === 'stock') valuation = await stockValuation(company.ticker)
    else if (assetType === 'fii') valuation = await fiiValuation(company)
  } catch (error) {
    console.error(`[allocation] falha ao analisar ${company.ticker}:`, error)
  }
  const financial = isFinancial(company.sector, company.industry)
  return {
    ticker: company.ticker,
    name: company.name,
    assetType,
    sector: assetType === 'fii' ? 'Fundos Imobiliários' : company.sector,
    price: valuation.price ?? quotePrice,
    fairValues: valuation.fairValues,
    margins: valuation.margins,
    qualityScore: valuation.qualityScore,
    coverage: valuation.coverage,
    liquidity,
    fundamentals: assetType === 'stock' ? fundamentalsStatus({ annual, financial }) : { intact: null },
  }
}

export interface LoadedUniverse {
  contexts: AssetContext[]
  /** Tickers pedidos que não existem na base. */
  unknown: string[]
  dataDate: string | null
}

/** Contexto dos tickers informados (universo digitado, carteira ou radar). */
export async function loadAssetContexts(tickers: readonly string[]): Promise<LoadedUniverse> {
  const wanted = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))]
  if (wanted.length === 0) return { contexts: [], unknown: [], dataDate: null }
  const companies = await loadCompanies({ tickers: wanted })
  const ids = companies.map((c) => c.id)
  const [liquidity, annual] = await Promise.all([
    getAverageDailyTradedValue(ids),
    loadAnnualFundamentals(companies.filter((c) => c.assetType === 'STOCK').map((c) => c.id)),
  ])
  const contexts = (
    await mapPool(companies, CONCURRENCY, (c) => buildContext(c, liquidity.get(c.id)?.value ?? null, annual.get(c.id)))
  ).filter((c): c is AssetContext => c !== null)
  const found = new Set(companies.map((c) => c.ticker))
  const dataDate = companies.map((c) => isoDay(c.dailyQuotes[0]?.date)).filter((d): d is string => d !== null).sort().pop() ?? null
  return { contexts, unknown: wanted.filter((t) => !found.has(t)), dataDate }
}

/**
 * Universo da plataforma para "Todo o mercado". Ativos abaixo da liquidez mínima do tipo entram só com a liquidez
 * (o motor os exclui na etapa de liquidez) e não passam pela análise: é o que mantém a resposta rápida.
 * A tabela inteira fica em cache por dia e tipos de ativo.
 */
export async function loadMarketContexts(types: readonly AllocationAssetType[]): Promise<LoadedUniverse> {
  const sorted = [...new Set(types)].sort()
  return cache.wrap(
    `allocation:market:v1:${todayKey()}:${sorted.join(',')}`,
    async () => {
      const companies = await loadCompanies({ types: sorted })
      const liquidity = await getAverageDailyTradedValue(companies.map((c) => c.id))
      const liquid = companies.filter((c) => {
        const value = liquidity.get(c.id)?.value
        const type = fromPrismaType(c.assetType)
        return type !== null && type !== 'etf' && type !== 'bdr' && typeof value === 'number' && value >= LIQUIDITY_DEFAULTS[toLiquidityAssetType(type)]
      })
      const liquidIds = new Set(liquid.map((c) => c.id))
      const annual = await loadAnnualFundamentals(liquid.filter((c) => c.assetType === 'STOCK').map((c) => c.id))
      const contexts = (
        await mapPool(companies, CONCURRENCY, async (c) => {
          const value = liquidity.get(c.id)?.value ?? null
          if (liquidIds.has(c.id)) return buildContext(c, value, annual.get(c.id))
          const assetType = fromPrismaType(c.assetType)
          if (!assetType) return null
          const context: AssetContext = {
            ticker: c.ticker,
            name: c.name,
            assetType,
            sector: assetType === 'fii' ? 'Fundos Imobiliários' : c.sector,
            price: toFiniteNumber(c.dailyQuotes[0]?.price),
            fairValues: {},
            qualityScore: null,
            coverage: null,
            liquidity: value,
            fundamentals: { intact: null },
          }
          return context
        })
      ).filter((c): c is AssetContext => c !== null)
      const dataDate = companies.map((c) => isoDay(c.dailyQuotes[0]?.date)).filter((d): d is string => d !== null).sort().pop() ?? null
      return { contexts, unknown: [], dataDate }
    },
    { ttl: MARKET_TTL_SECONDS }
  )
}

/** Data dos dados e premissas macro usadas (Selic e Ke de mercado com beta 1). */
export async function loadAllocationMeta(dataDate: string | null): Promise<AllocationMeta> {
  const macro = await getMacroAssumptions()
  return { dataDate, macro: { selic: macro.selic, ke: keFromMacro(macro) } }
}
