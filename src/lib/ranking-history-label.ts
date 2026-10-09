/**
 * Rótulos do histórico de rankings (puro, sem rede): título legível a partir dos parâmetros salvos e
 * agrupamento de execuções repetidas.
 *
 * - Screening com filtros: os 2 filtros mais restritivos, ex.: "P/L ≤ 10 · DY ≥ 6%".
 * - Sem filtros: o nome do modelo, com os primeiros tickers do resultado no detalhe ("CMIG4, BBAS3 e mais 23").
 * - Execuções consecutivas com os mesmos parâmetros no mesmo dia viram uma linha com contagem ("×3").
 */

import { formatBRLCompact, formatNumber, formatPct } from './format'

/** Formato do valor salvo de cada filtro do screening. */
type FilterUnit =
  /** Fração (0,06 = 6%). */
  | 'pct'
  /** Pontos percentuais (20 = 20%), como o potencial Graham. */
  | 'pctPoints'
  /** Número simples (múltiplos, score, índices). */
  | 'number'
  /** Reais. */
  | 'brl'

/** Filtros do screening de ações, na ordem de desempate (a mesma do configurador). */
const SCREENING_FILTERS: ReadonlyArray<{ key: string; label: string; unit: FilterUnit }> = [
  { key: 'plFilter', label: 'P/L', unit: 'number' },
  { key: 'pvpFilter', label: 'P/VP', unit: 'number' },
  { key: 'evEbitdaFilter', label: 'EV/EBITDA', unit: 'number' },
  { key: 'psrFilter', label: 'PSR', unit: 'number' },
  { key: 'dyFilter', label: 'DY', unit: 'pct' },
  { key: 'grahamUpsideFilter', label: 'Potencial Graham', unit: 'pctPoints' },
  { key: 'overallScoreFilter', label: 'Score', unit: 'number' },
  { key: 'roeFilter', label: 'ROE', unit: 'pct' },
  { key: 'roicFilter', label: 'ROIC', unit: 'pct' },
  { key: 'roaFilter', label: 'ROA', unit: 'pct' },
  { key: 'margemLiquidaFilter', label: 'Margem líquida', unit: 'pct' },
  { key: 'margemEbitdaFilter', label: 'Margem EBITDA', unit: 'pct' },
  { key: 'cagrLucros5aFilter', label: 'CAGR lucros', unit: 'pct' },
  { key: 'cagrReceitas5aFilter', label: 'CAGR receitas', unit: 'pct' },
  { key: 'payoutFilter', label: 'Payout', unit: 'pct' },
  { key: 'dividaLiquidaPlFilter', label: 'Dív. líq./PL', unit: 'pct' },
  { key: 'dividaLiquidaEbitdaFilter', label: 'Dív. líq./EBITDA', unit: 'number' },
  { key: 'liquidezCorrenteFilter', label: 'Liquidez corrente', unit: 'number' },
  { key: 'marketCapFilter', label: 'Valor de mercado', unit: 'brl' },
]

const COMPANY_SIZE_LABEL: Record<string, string> = {
  small_caps: 'Small caps',
  mid_caps: 'Mid caps',
  blue_chips: 'Large caps',
}

/** Descrição genérica que a API devolve quando não sabe resumir os parâmetros. */
const GENERIC_DESCRIPTION = 'Parâmetros personalizados'

const MAX_TITLE_FILTERS = 2
const TOP_TICKERS = 2

export interface RankingHistoryEntry {
  id: string
  model: string
  /** Nome do modelo já resolvido para exibição. */
  modelLabel: string
  /** Resumo dos parâmetros vindo da API (pode ser o genérico "Parâmetros personalizados"). */
  description?: string | null
  resultCount: number
  createdAt: string | Date
  params?: Record<string, unknown> | null
  results?: unknown
}

export interface RankingHistoryLabel {
  /** Linha principal, que distingue uma execução da outra. */
  title: string
  /** Contexto curto (modelo, parâmetros, primeiros tickers) ou `null`. */
  detail: string | null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function formatPctValue(fraction: number): string {
  const points = fraction * 100
  const digits = Math.abs(points - Math.round(points)) < 1e-6 ? 0 : 1
  return formatPct(fraction, { digits })
}

function formatFilterValue(value: number, unit: FilterUnit): string {
  switch (unit) {
    case 'pct':
      return formatPctValue(value)
    case 'pctPoints':
      return formatPctValue(value / 100)
    case 'brl':
      return formatBRLCompact(value)
    case 'number':
      return formatNumber(value)
  }
}

interface FilterPart {
  text: string
  /** Quantos limites o filtro define (faixa fechada = 2). */
  bounds: number
  order: number
}

function screeningFilterParts(params: Record<string, unknown>): FilterPart[] {
  const parts: FilterPart[] = []
  SCREENING_FILTERS.forEach(({ key, label, unit }, order) => {
    const filter = params[key]
    if (!filter || typeof filter !== 'object') return
    const { enabled, min, max } = filter as { enabled?: unknown; min?: unknown; max?: unknown }
    if (enabled !== true) return
    const hasMin = isFiniteNumber(min)
    const hasMax = isFiniteNumber(max)
    if (hasMin && hasMax) {
      parts.push({ text: `${label} ${formatFilterValue(min, unit)}–${formatFilterValue(max, unit)}`, bounds: 2, order })
    } else if (hasMin) {
      parts.push({ text: `${label} ≥ ${formatFilterValue(min, unit)}`, bounds: 1, order })
    } else if (hasMax) {
      parts.push({ text: `${label} ≤ ${formatFilterValue(max, unit)}`, bounds: 1, order })
    }
  })
  return parts.sort((a, b) => b.bounds - a.bounds || a.order - b.order)
}

/** Setores, indústrias e porte: usados quando o screening tem menos de 2 filtros numéricos. */
function screeningScopeParts(params: Record<string, unknown>): string[] {
  const parts: string[] = []
  const names = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string' && name.length > 0) : []
  const sectors = names(params.selectedSectors)
  if (sectors.length === 1 || sectors.length === 2) parts.push(sectors.join(' e '))
  else if (sectors.length > 2) parts.push(`${sectors.length} setores`)
  const industries = names(params.selectedIndustries)
  if (industries.length === 1 || industries.length === 2) parts.push(industries.join(' e '))
  else if (industries.length > 2) parts.push(`${industries.length} indústrias`)
  const size = typeof params.companySize === 'string' ? COMPANY_SIZE_LABEL[params.companySize] : undefined
  if (size) parts.push(size)
  return parts
}

/** Título com os filtros mais restritivos do screening, ou `null` quando não há filtros. */
export function screeningFiltersTitle(params: Record<string, unknown> | null | undefined): string | null {
  if (!params) return null
  const parts = [...screeningFilterParts(params).map((part) => part.text), ...screeningScopeParts(params)]
  return parts.length > 0 ? parts.slice(0, MAX_TITLE_FILTERS).join(' · ') : null
}

/** Primeiros tickers do resultado: "CMIG4, BBAS3 e mais 23", "CMIG4 e BBAS3" ou `null`. */
export function topTickersLabel(results: unknown, resultCount: number): string | null {
  if (!Array.isArray(results)) return null
  const tickers = results
    .map((item) => (item && typeof item === 'object' ? (item as { ticker?: unknown }).ticker : undefined))
    .filter((ticker): ticker is string => typeof ticker === 'string' && ticker.length > 0)
  if (tickers.length === 0) return null
  const total = Math.max(resultCount, tickers.length)
  const shown = tickers.slice(0, TOP_TICKERS)
  const rest = total - shown.length
  if (rest > 0) return `${shown.join(', ')} e mais ${rest}`
  return shown.length === 2 ? `${shown[0]} e ${shown[1]}` : shown[0]
}

/** Título e detalhe de uma linha do histórico. */
export function rankingHistoryLabel(entry: RankingHistoryEntry): RankingHistoryLabel {
  const tickers = topTickersLabel(entry.results, entry.resultCount)
  const description = entry.description && entry.description !== GENERIC_DESCRIPTION ? entry.description : null

  const filters = entry.model === 'screening' ? screeningFiltersTitle(entry.params) : null
  if (filters) {
    return { title: filters, detail: [entry.modelLabel, tickers].filter(Boolean).join(' · ') }
  }

  const detail = [description, tickers].filter(Boolean).join(' · ')
  return { title: entry.modelLabel, detail: detail || null }
}

/** JSON com as chaves ordenadas (parâmetros iguais em ordem diferente geram a mesma chave). */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function dayKey(date: string | Date): string {
  const parsed = typeof date === 'string' ? new Date(date) : date
  return Number.isNaN(parsed.getTime()) ? String(date) : DAY_FORMAT.format(parsed)
}

export type CollapsedRankingHistory<T> = T & {
  /** Quantas execuções iguais a linha representa (1 = sem repetição). */
  repeatCount: number
}

/**
 * Agrupa execuções consecutivas do mesmo modelo, com os mesmos parâmetros, no mesmo dia (horário de Brasília).
 * Mantém a primeira da sequência (a mais recente, na ordem da API) e soma as repetições.
 */
export function collapseRankingHistory<T extends Pick<RankingHistoryEntry, 'model' | 'params' | 'createdAt'>>(
  entries: readonly T[]
): CollapsedRankingHistory<T>[] {
  const collapsed: CollapsedRankingHistory<T>[] = []
  let lastKey: string | null = null
  for (const entry of entries) {
    const key = `${entry.model}|${dayKey(entry.createdAt)}|${stableStringify(entry.params ?? null)}`
    const previous = collapsed[collapsed.length - 1]
    if (previous && key === lastKey) {
      previous.repeatCount += 1
    } else {
      collapsed.push({ ...entry, repeatCount: 1 })
      lastKey = key
    }
  }
  return collapsed
}
