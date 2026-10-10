/**
 * Builders do contexto do Ben. Puros (sem banco, sem rede): rodam no cliente com os dados que a página já tem
 * e no servidor para o contexto mínimo da rota.
 */

import type {
  BenAgendaContext,
  BenAlertsContext,
  BenAllocationContext,
  BenAssetContext,
  BenAssetSection,
  BenAssetType,
  BenBacktestContext,
  BenPageContext,
  BenPortfolioContext,
  BenRankingContext,
  BenScreeningContext,
  BenValuationItem,
} from './types'

/** Quantos itens de cada lista entram no contexto (o serializador ainda corta pelo tamanho). */
export const BEN_CONTEXT_LIMITS = {
  tickers: 10,
  holdings: 8,
  valuations: 12,
  allocations: 10,
  events: 5,
  filters: 12,
  conditions: 6,
} as const

const TICKER_RE = /^[A-Z0-9]{3,8}$/

export function normalizeTicker(value: string | null | undefined): string | null {
  if (!value) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return null // "%" solto na URL ou no corpo: sem ticker, em vez de erro 500
  }
  const ticker = decoded.trim().toUpperCase()
  return TICKER_RE.test(ticker) ? ticker : null
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function uniqueTickers(values: (string | null | undefined)[], max: number = BEN_CONTEXT_LIMITS.tickers): string[] {
  const out: string[] = []
  for (const value of values) {
    const ticker = normalizeTicker(value)
    if (ticker && !out.includes(ticker)) out.push(ticker)
    if (out.length >= max) break
  }
  return out
}

const ASSET_ROUTES: Record<string, BenAssetType> = { acao: 'stock', bdr: 'bdr', fii: 'fii', etf: 'etf', indices: 'index' }

const SECTION_ROUTES: Record<string, BenAssetSection> = {
  'analise-tecnica': 'technical',
  relatorios: 'reports',
}

/**
 * Contexto mínimo a partir da rota: tipo de página e o que a URL diz (ticker, id da carteira, tickers do
 * comparador). Os pontos "Perguntar ao Ben" e as páginas completam com os dados da tela.
 */
export function contextFromPath(pathname: string | null | undefined): BenPageContext {
  const path = (pathname || '/').split(/[?#]/)[0]
  const segments = path.split('/').filter(Boolean)
  const [first, second, third] = segments

  if (!first) return { kind: 'dashboard' }

  if (first in ASSET_ROUTES && second) {
    const ticker = normalizeTicker(second)
    if (ticker) {
      const section = third ? SECTION_ROUTES[third] : undefined
      return { kind: 'asset', ticker, assetType: ASSET_ROUTES[first], ...(section ? { section } : {}) }
    }
  }

  if (first === 'radar-dividendos' && second) {
    const ticker = normalizeTicker(second)
    if (ticker) return { kind: 'asset', ticker, assetType: 'stock', section: 'dividends' }
  }

  if (first === 'carteira' && second && second !== 'nova' && second !== 'tutorial') {
    return { kind: 'portfolio', id: second, holdings: [] }
  }

  if (first === 'ranking') return { kind: 'ranking', model: '', tickers: [] }
  if (first === 'screening-acoes') return { kind: 'screening', assetClass: 'acoes', filters: [], resultCount: null, tickers: [] }
  if (first === 'screening-fiis') return { kind: 'screening', assetClass: 'fiis', filters: [], resultCount: null, tickers: [] }
  if (first === 'compara-acoes') return { kind: 'comparador', tickers: uniqueTickers(segments.slice(1)) }
  if (first === 'comparador' || first === 'compara-etfs') return { kind: 'comparador', tickers: [] }
  if (first === 'onde-aportar') return { kind: 'onde-aportar', amount: null, allocations: [] }
  if (first === 'backtest' || first === 'backtesting-carteiras') return { kind: 'backtest' }
  if (first === 'agenda-proventos') return { kind: 'agenda', events: [] }
  if (first === 'dashboard' && second === 'monitoramentos-customizados') return { kind: 'alerts' }
  if (first === 'dashboard' && !second) return { kind: 'dashboard' }

  return { kind: 'generic', path: path.slice(0, 120) }
}

/**
 * Junta o contexto da rota com o da tela. Mesmo tipo: a tela completa a rota (ex.: o ticker do ativo vem da
 * URL quando a tabela de valuation não o conhece). Tipos diferentes: vale o da tela.
 */
export function mergeWithRoute(route: BenPageContext, provided: Partial<BenPageContext> | null | undefined): BenPageContext {
  if (!provided || !provided.kind) return route
  if (provided.kind !== route.kind) return provided as BenPageContext
  const merged: Record<string, unknown> = { ...route }
  for (const [key, value] of Object.entries(provided)) {
    if (value !== undefined && value !== '') merged[key] = value
  }
  return merged as unknown as BenPageContext
}

/** Remove o foco (o item clicado) para guardar o contexto como contexto da página. */
export function withoutFocus(context: BenPageContext): BenPageContext {
  if (!context.focus) return context
  const rest = { ...context }
  delete rest.focus
  return rest
}

// ─────────────────────────────────────────────────────────────────────────────
// Builders por superfície
// ─────────────────────────────────────────────────────────────────────────────

export interface AssetContextInput {
  ticker?: string | null
  assetType?: BenAssetType
  companyName?: string | null
  price?: number | null
  valuations?: BenValuationItem[]
  score?: number | null
  focus?: string
}

/** Ativo. Sem `ticker`, o ticker da URL entra no merge com a rota (`mergeWithRoute`). */
export function buildAssetContext(input: AssetContextInput): Partial<BenAssetContext> & { kind: 'asset' } {
  const ticker = normalizeTicker(input.ticker)
  return {
    kind: 'asset',
    ...(ticker ? { ticker } : {}),
    ...(input.assetType ? { assetType: input.assetType } : {}),
    ...(input.companyName ? { companyName: input.companyName } : {}),
    price: finiteOrNull(input.price),
    valuations: (input.valuations ?? []).slice(0, BEN_CONTEXT_LIMITS.valuations).map((item) => ({
      model: item.model,
      fairValue: finiteOrNull(item.fairValue),
      margin: finiteOrNull(item.margin),
      ...(item.score !== undefined ? { score: finiteOrNull(item.score) } : {}),
    })),
    ...(input.score !== undefined ? { score: finiteOrNull(input.score) } : {}),
    ...(input.focus ? { focus: input.focus } : {}),
  }
}

export interface PortfolioContextInput {
  id: string
  name?: string | null
  holdings: { ticker: string; weight?: number | null; value?: number | null }[]
  returnPct?: number | null
  focus?: string
}

/** Carteira: as maiores posições pelo peso (ou pelo valor, quando o peso não vem). */
export function buildPortfolioContext(input: PortfolioContextInput): BenPortfolioContext {
  const total = input.holdings.reduce((sum, h) => sum + (finiteOrNull(h.value) ?? 0), 0)
  const withWeight = input.holdings
    .map((h) => ({
      ticker: normalizeTicker(h.ticker),
      weight: finiteOrNull(h.weight) ?? (total > 0 && finiteOrNull(h.value) !== null ? (h.value as number) / total : null),
    }))
    .filter((h): h is { ticker: string; weight: number | null } => h.ticker !== null)
    .sort((a, b) => (b.weight ?? -1) - (a.weight ?? -1))
  return {
    kind: 'portfolio',
    id: input.id,
    ...(input.name ? { name: input.name } : {}),
    holdings: withWeight.slice(0, BEN_CONTEXT_LIMITS.holdings),
    holdingsCount: withWeight.length,
    ...(input.returnPct !== undefined ? { returnPct: finiteOrNull(input.returnPct) } : {}),
    ...(input.focus ? { focus: input.focus } : {}),
  }
}

export interface RankingContextInput {
  model: string
  universe?: string
  params?: string
  tickers: (string | null | undefined)[]
  resultCount?: number | null
  focus?: string
}

export function buildRankingContext(input: RankingContextInput): BenRankingContext {
  return {
    kind: 'ranking',
    model: input.model,
    ...(input.universe ? { universe: input.universe } : {}),
    ...(input.params ? { params: input.params } : {}),
    tickers: uniqueTickers(input.tickers),
    resultCount: finiteOrNull(input.resultCount) ?? input.tickers.length,
    ...(input.focus ? { focus: input.focus } : {}),
  }
}

export interface ScreeningContextInput {
  assetClass: 'acoes' | 'fiis'
  filters: string[]
  resultCount: number | null
  tickers: (string | null | undefined)[]
  focus?: string
}

export function buildScreeningContext(input: ScreeningContextInput): BenScreeningContext {
  return {
    kind: 'screening',
    assetClass: input.assetClass,
    filters: input.filters.slice(0, BEN_CONTEXT_LIMITS.filters),
    resultCount: finiteOrNull(input.resultCount),
    tickers: uniqueTickers(input.tickers),
    ...(input.focus ? { focus: input.focus } : {}),
  }
}

export interface AllocationContextInput {
  amount: number | null
  universe?: string
  allocations: { ticker: string; value: number; pctOfAmount?: number | null }[]
  leftover?: number | null
  focus?: string
}

export function buildAllocationContext(input: AllocationContextInput): BenAllocationContext {
  return {
    kind: 'onde-aportar',
    amount: finiteOrNull(input.amount),
    ...(input.universe ? { universe: input.universe } : {}),
    allocations: input.allocations
      .map((row) => ({ ticker: normalizeTicker(row.ticker), value: finiteOrNull(row.value) ?? 0, pct: finiteOrNull(row.pctOfAmount) }))
      .filter((row): row is { ticker: string; value: number; pct: number | null } => row.ticker !== null)
      .slice(0, BEN_CONTEXT_LIMITS.allocations),
    ...(input.leftover !== undefined ? { leftover: finiteOrNull(input.leftover) } : {}),
    ...(input.focus ? { focus: input.focus } : {}),
  }
}

export function buildBacktestContext(input: Omit<BenBacktestContext, 'kind'>): BenBacktestContext {
  return {
    kind: 'backtest',
    ...(input.config ? { config: input.config } : {}),
    totalReturn: finiteOrNull(input.totalReturn),
    cdiReturn: finiteOrNull(input.cdiReturn),
    ibovReturn: finiteOrNull(input.ibovReturn),
    ...(input.focus ? { focus: input.focus } : {}),
  }
}

/** Agenda: os próximos eventos a partir de hoje, em ordem de data. */
export function buildAgendaContext(
  events: { ticker: string; type: string; date: string; amount?: number | null }[],
  today: string = new Date().toISOString().slice(0, 10)
): BenAgendaContext {
  return {
    kind: 'agenda',
    events: events
      .map((event) => ({ ...event, ticker: normalizeTicker(event.ticker), date: event.date.slice(0, 10) }))
      .filter((event): event is { ticker: string; type: string; date: string; amount?: number | null } => event.ticker !== null && event.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, BEN_CONTEXT_LIMITS.events)
      .map((event) => ({ ticker: event.ticker, type: event.type, date: event.date, amount: finiteOrNull(event.amount) })),
  }
}

export interface AlertContextInput {
  ticker: string
  conditions: string[]
  lastTriggeredAt?: Date | string | null
  active?: boolean
}

export function buildAlertContext(input: AlertContextInput): BenAlertsContext {
  const ticker = normalizeTicker(input.ticker)
  if (!ticker) return { kind: 'alerts' }
  const last = input.lastTriggeredAt ? new Date(input.lastTriggeredAt) : null
  return {
    kind: 'alerts',
    focus: `Alerta de ${ticker}`,
    alert: {
      ticker,
      conditions: input.conditions.slice(0, BEN_CONTEXT_LIMITS.conditions),
      lastTriggeredAt: last && !Number.isNaN(last.getTime()) ? last.toISOString() : null,
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros em texto
// ─────────────────────────────────────────────────────────────────────────────

/** Chaves que não descrevem um filtro escolhido pelo usuário. */
const IGNORED_FILTER_KEYS = new Set(['useTechnicalAnalysis', 'limit', 'offset', 'sortBy', 'sortOrder'])
const NEUTRAL_VALUES = new Set(['all', 'both', ''])

function rangeText(min: unknown, max: unknown): string | null {
  const lo = typeof min === 'number' && Number.isFinite(min) ? min : null
  const hi = typeof max === 'number' && Number.isFinite(max) ? max : null
  if (lo !== null && hi !== null) return `${lo} a ${hi}`
  if (lo !== null) return `≥ ${lo}`
  if (hi !== null) return `≤ ${hi}`
  return null
}

/**
 * Resume um objeto de filtros (screening) em textos curtos ("plFilter 5 a 15", "companySize: large").
 * Ignora faixas desligadas, valores neutros ("all", "both") e listas vazias.
 */
export function summarizeFilters(params: object | null | undefined): string[] {
  if (!params) return []
  const out: string[] = []
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (IGNORED_FILTER_KEYS.has(key) || value === undefined || value === null || value === false) continue
    if (typeof value === 'string') {
      if (!NEUTRAL_VALUES.has(value)) out.push(`${key}: ${value}`)
    } else if (typeof value === 'number') {
      if (Number.isFinite(value)) out.push(`${key}: ${value}`)
    } else if (value === true) {
      out.push(key)
    } else if (Array.isArray(value)) {
      if (value.length > 0) out.push(`${key}: ${value.slice(0, 5).join(', ')}${value.length > 5 ? '…' : ''}`)
    } else if (typeof value === 'object') {
      const range = value as { enabled?: boolean; min?: unknown; max?: unknown }
      if (range.enabled === false) continue
      const text = rangeText(range.min, range.max)
      if (text) out.push(`${key} ${text}`)
    }
    if (out.length >= BEN_CONTEXT_LIMITS.filters) break
  }
  return out
}
