import type { ScreeningFilter, ScreeningParams } from "@/lib/strategies/types"
import {
  formatBRL,
  formatBRLCompact,
  formatDeltaPct,
  formatMultiple,
  formatNumber,
  formatPct,
} from "@/lib/format"
import { upside } from "@/lib/valuation-metrics"

/** Parâmetros do formulário de screening de FIIs (enviados ao modelo `fiiScreening`). */
export interface FiiScreeningFormParams {
  tipoFii: "papel" | "tijolo" | "both"
  /** Fração (0,08 = 8%). */
  minDY?: number
  maxPVP?: number
  /** Reais por dia. */
  minLiquidity?: number
  minQtdImoveis?: number
  /** Fração (0,15 = 15%). */
  maxVacancia?: number
  segmento?: string
}

export type StockAssetType = "b3" | "bdr" | "both"

export interface ScreeningResult {
  ticker: string
  name: string
  sector: string | null
  currentPrice: number
  logoUrl?: string | null
  fairValue: number | null
  /** Em pontos percentuais (24,6 = 24,6%), como vem da API. Prefira `resultUpside`. */
  upside: number | null
  marginOfSafety: number | null
  rational: string
  key_metrics?: Record<string, number | null>
  fairValueModel?: string | null
}

export interface ScreeningResponse {
  model: string
  rational: string
  results: ScreeningResult[]
  /** Total real encontrado (antes do limite do plano gratuito). */
  count: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Métricas exibidas nos resultados
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unidade de cada métrica, conforme vem da API:
 * - `multiple`: múltiplo (P/L 9,05 → "9,1x")
 * - `ratio`: número simples com 2 casas (liquidez corrente)
 * - `pct`: fração (0,177 → "17,7%")
 * - `pctPoints`: pontos percentuais (24,6 → "+24,6%"), usado nos upsides por modelo
 * - `brl` / `brlCompact`: reais
 * - `score`: pontuação 0–100
 */
export type MetricKind = "multiple" | "ratio" | "pct" | "pctPoints" | "brl" | "brlCompact" | "score"

interface MetricDefinition {
  label: string
  kind: MetricKind
}

export const METRICS: Record<string, MetricDefinition> = {
  pl: { label: "P/L", kind: "multiple" },
  pvp: { label: "P/VP", kind: "multiple" },
  evEbitda: { label: "EV/EBITDA", kind: "multiple" },
  psr: { label: "PSR", kind: "multiple" },
  roe: { label: "ROE", kind: "pct" },
  roic: { label: "ROIC", kind: "pct" },
  roa: { label: "ROA", kind: "pct" },
  dy: { label: "Dividend yield", kind: "pct" },
  payout: { label: "Payout", kind: "pct" },
  margemLiquida: { label: "Margem líquida", kind: "pct" },
  margemEbitda: { label: "Margem EBITDA", kind: "pct" },
  cagrReceitas: { label: "CAGR receitas 5a", kind: "pct" },
  cagrLucros: { label: "CAGR lucros 5a", kind: "pct" },
  crescimentoReceitas: { label: "Crescimento de receitas", kind: "pct" },
  crescimentoLucros: { label: "Crescimento de lucros", kind: "pct" },
  earningsYield: { label: "Earnings yield", kind: "pct" },
  dividaLiquidaPl: { label: "Dív. líq./PL", kind: "pct" },
  dividaLiquidaEbitda: { label: "Dív. líq./EBITDA", kind: "multiple" },
  liquidezCorrente: { label: "Liquidez corrente", kind: "ratio" },
  marketCap: { label: "Valor de mercado", kind: "brlCompact" },
  grahamUpside: { label: "Upside Graham", kind: "pctPoints" },
  fcdUpside: { label: "Upside FCD", kind: "pctPoints" },
  gordonUpside: { label: "Upside Gordon", kind: "pctPoints" },
  lpa: { label: "LPA", kind: "brl" },
  vpa: { label: "VPA", kind: "brl" },
  overallScore: { label: "Score geral", kind: "score" },
  technicalScore: { label: "Score técnico", kind: "score" },
  magicScore: { label: "Score Fórmula Mágica", kind: "score" },
  pjFiiScore: { label: "Score PJ-FII", kind: "score" },
  liquidez: { label: "Liquidez diária", kind: "brlCompact" },
  vacancia: { label: "Vacância", kind: "pct" },
  capRate: { label: "Cap rate", kind: "pct" },
  precoTetoDY: { label: "Preço teto (DY)", kind: "brl" },
}

/** Ordem de exibição das métricas por tipo de screening. Chaves fora do registro nunca aparecem na UI. */
export const STOCK_METRIC_ORDER = [
  "pl",
  "pvp",
  "roe",
  "dy",
  "roic",
  "margemLiquida",
  "cagrReceitas",
  "dividaLiquidaPl",
  "liquidezCorrente",
  "marketCap",
  "grahamUpside",
  "fcdUpside",
  "gordonUpside",
]

export const FII_METRIC_ORDER = ["pjFiiScore", "dy", "pvp", "liquidez", "vacancia", "capRate"]

/** "grahamUpside" → "Graham upside": fallback legível para chaves que ainda não estão no registro. */
function humanizeKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function translateMetricName(key: string): string {
  return METRICS[key]?.label ?? humanizeKey(key)
}

export function formatMetricValue(key: string, value: number | null | undefined): string {
  const kind = METRICS[key]?.kind
  switch (kind) {
    case "multiple":
      return formatMultiple(value)
    case "ratio":
      return formatNumber(value, { digits: 2 })
    case "pct":
      return formatPct(value)
    case "pctPoints":
      return formatDeltaPct(typeof value === "number" ? value / 100 : value)
    case "brl":
      return formatBRL(value)
    case "brlCompact":
      return formatBRLCompact(value)
    case "score":
      return formatNumber(value, { digits: 0 })
    default:
      return formatNumber(value)
  }
}

export type MetricTone = "positive" | "negative" | "neutral"

/** Verde/vermelho só para upside (resultado de valuation), nunca para múltiplos ou preço. */
export function metricTone(key: string, value: number | null | undefined): MetricTone {
  if (METRICS[key]?.kind !== "pctPoints" || typeof value !== "number" || !Number.isFinite(value)) return "neutral"
  if (value > 0) return "positive"
  if (value < 0) return "negative"
  return "neutral"
}

/** Métricas presentes nos resultados, na ordem de exibição, ignorando chaves desconhecidas. */
export function visibleMetricKeys(results: ScreeningResult[], order: string[]): string[] {
  const present = new Set<string>()
  for (const result of results) {
    for (const key of Object.keys(result.key_metrics ?? {})) present.add(key)
  }
  return order.filter((key) => present.has(key) && key in METRICS)
}

/** Upside como fração (`preço justo / preço − 1`), recalculado a partir dos valores brutos. */
export function resultUpside(result: Pick<ScreeningResult, "currentPrice" | "fairValue">): number | null {
  return upside(result.currentPrice, result.fairValue)
}

// ─────────────────────────────────────────────────────────────────────────────
// Ordenação dos cards no mobile
// ─────────────────────────────────────────────────────────────────────────────

export type MobileSortKey = "relevance" | "upside" | "pl" | "dy" | "marketCap" | "pjFiiScore" | "pvp"

function sortValue(result: ScreeningResult, key: MobileSortKey): number | null {
  if (key === "upside") return resultUpside(result)
  const value = result.key_metrics?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** Direção natural de cada critério: múltiplos baratos primeiro, o resto do maior para o menor. */
const ASCENDING: ReadonlySet<MobileSortKey> = new Set(["pl", "pvp"])

/** Ordena sem alterar o array original; valores ausentes vão para o fim. `relevance` mantém a ordem da API. */
export function sortResults(results: ScreeningResult[], key: MobileSortKey): ScreeningResult[] {
  if (key === "relevance") return results
  const factor = ASCENDING.has(key) ? 1 : -1
  return results
    .map((result, index) => ({ result, index, value: sortValue(result, key) }))
    .sort((a, b) => {
      if (a.value === null && b.value === null) return a.index - b.index
      if (a.value === null) return 1
      if (b.value === null) return -1
      return (a.value - b.value) * factor || a.index - b.index
    })
    .map((entry) => entry.result)
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros ativos
// ─────────────────────────────────────────────────────────────────────────────

export const STOCK_RANGE_FILTER_KEYS = [
  "plFilter",
  "pvpFilter",
  "evEbitdaFilter",
  "psrFilter",
  "roeFilter",
  "roicFilter",
  "roaFilter",
  "margemLiquidaFilter",
  "margemEbitdaFilter",
  "cagrLucros5aFilter",
  "cagrReceitas5aFilter",
  "dyFilter",
  "payoutFilter",
  "dividaLiquidaPlFilter",
  "liquidezCorrenteFilter",
  "dividaLiquidaEbitdaFilter",
  "marketCapFilter",
  "overallScoreFilter",
  "grahamUpsideFilter",
] as const

export type StockRangeFilterKey = (typeof STOCK_RANGE_FILTER_KEYS)[number]

export function isFilterActive(filter: ScreeningFilter | undefined): boolean {
  return !!filter?.enabled && (filter.min !== undefined || filter.max !== undefined)
}

export function countActiveStockFilters(params: ScreeningParams): number {
  let count = STOCK_RANGE_FILTER_KEYS.filter((key) => isFilterActive(params[key])).length
  if (params.companySize && params.companySize !== "all") count++
  if (params.selectedSectors && params.selectedSectors.length > 0) count++
  if (params.selectedIndustries && params.selectedIndustries.length > 0) count++
  return count
}

export function countActiveFiiFilters(params: FiiScreeningFormParams): number {
  let count = 0
  if (params.tipoFii !== "both") count++
  if (params.minDY !== undefined) count++
  if (params.maxPVP !== undefined) count++
  if (params.minLiquidity !== undefined) count++
  if (params.minQtdImoveis !== undefined) count++
  if (params.maxVacancia !== undefined) count++
  if (params.segmento) count++
  return count
}

export function defaultStockParams(assetTypeFilter: StockAssetType): ScreeningParams {
  return { companySize: "all", useTechnicalAnalysis: true, assetTypeFilter }
}

export const DEFAULT_FII_PARAMS: FiiScreeningFormParams = { tipoFii: "both" }

// ─────────────────────────────────────────────────────────────────────────────
// Campos numéricos (aceitam vírgula decimal)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Número digitado em pt-BR → number; "" ou texto inválido → undefined.
 * - Vírgula é o separador decimal: "8,5" → 8.5; "1.000,5" → 1000.5.
 * - Pontos em grupos de três dígitos são separador de milhar: "1.000.000" → 1000000; "500.000" → 500000.
 * - Um ponto fora desse padrão é decimal (quem digita no padrão americano): "1.5" → 1.5.
 * - Separador sobrando no fim da digitação é ignorado: "1.000." → 1000; "8," → 8.
 */
export function parseDecimal(input: string): number | undefined {
  const trimmed = input.trim().replace(/\s/g, "")
  if (trimmed === "") return undefined
  let normalized: string
  if (trimmed.includes(",")) {
    if ((trimmed.match(/,/g) ?? []).length > 1) return undefined
    const [intPart, decPart] = trimmed.split(",")
    if (intPart.includes(".") && !/^-?\d{1,3}(\.\d{3})+$/.test(intPart)) return undefined
    normalized = `${intPart.replace(/\./g, "")}.${decPart}`
  } else {
    const withoutTrailingDot = trimmed.replace(/\.$/, "")
    if (/^-?\d{1,3}(\.\d{3})+$/.test(withoutTrailingDot)) normalized = withoutTrailingDot.replace(/\./g, "")
    else if ((withoutTrailingDot.match(/\./g) ?? []).length > 1) return undefined
    else normalized = withoutTrailingDot
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(normalized)) return undefined
  const value = Number(normalized)
  return Number.isFinite(value) ? value : undefined
}

/** 8.5 → "8,5"; remove ruído de ponto flutuante (0.15 × 100 = 15.000000000000002 → "15"). */
export function formatDecimalInput(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return ""
  return String(Number(value.toPrecision(10))).replace(".", ",")
}
