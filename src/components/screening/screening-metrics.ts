import type { ScreeningFilter } from "@/lib/strategies/types"
import type { ExtendedScreeningParams } from "@/lib/strategies/screening-strategy"
import { LIQUIDITY_DEFAULTS } from "@/lib/finance/liquidity-rules"
import {
  formatBRL,
  formatBRLCompact,
  formatDeltaPct,
  formatMultiple,
  formatNumber,
  formatPct,
} from "@/lib/format"
import { marginOfSafety } from "@/lib/valuation-metrics"

/** Parâmetros do formulário de screening de FIIs (enviados ao modelo `fiiScreening`). */
export interface FiiScreeningFormParams {
  tipoFii: "papel" | "tijolo" | "both"
  /** Fração (0,08 = 8%). */
  minDY?: number
  maxPVP?: number
  /** Volume médio diário mínimo (R$/dia). `undefined`: padrão de R$ 500 mil; `null`: inclui FIIs com baixa liquidez. */
  minLiquidity?: number | null
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
  /** Em pontos percentuais (24,6 = 24,6%), como vem da API. Na UI vale a margem de segurança (`resultMargin`). */
  upside: number | null
  marginOfSafety: number | null
  rational: string
  key_metrics?: Record<string, number | null>
  fairValueModel?: string | null
  /** Volume médio diário (R$/dia). */
  averageDailyTradedValue?: number | null
  /** Abaixo do limite de liquidez, mantido porque o usuário incluiu ativos com baixa liquidez. */
  lowLiquidity?: boolean
}

export interface ScreeningResponse {
  model: string
  rational: string
  results: ScreeningResult[]
  /** Total real encontrado (antes do limite do plano gratuito). */
  count: number
  /** Com "Queda com fundamentos intactos": empresas fora só por falta de histórico. */
  insufficientData?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Métricas exibidas nos resultados
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unidade de cada métrica, conforme vem da API:
 * - `multiple`: múltiplo (P/L 9,05 → "9,1x")
 * - `ratio`: número simples com 2 casas (liquidez corrente)
 * - `pct`: fração (0,177 → "17,7%")
 * - `pctPoints`: pontos percentuais (24,6 → "+24,6%"), usado no potencial (upside) por modelo
 * - `pctDelta`: fração com sinal (−0,12 → "−12,0%"), usado em variações e descontos
 * - `ratio2`: número com 2 casas (PEG)
 * - `brl` / `brlCompact`: reais
 * - `score`: pontuação 0–100
 */
export type MetricKind = "multiple" | "ratio" | "pct" | "pctPoints" | "pctDelta" | "brl" | "brlCompact" | "score"

interface MetricDefinition {
  label: string
  kind: MetricKind
  /** Ajuda exibida no cabeçalho da coluna. */
  hint?: string
}

/** Potencial = preço justo ÷ preço − 1, por modelo. Definição em /metodologia#definicoes. */
const POTENTIAL_HINT =
  "Quanto o preço justo do modelo está acima (ou abaixo) do preço atual: preço justo ÷ preço − 1. É uma estimativa e não é recomendação."

export const METRICS: Record<string, MetricDefinition> = {
  pl: { label: "P/L", kind: "multiple" },
  pvp: { label: "P/VP", kind: "multiple" },
  evEbitda: { label: "EV/EBITDA", kind: "multiple" },
  psr: { label: "PSR", kind: "multiple" },
  roe: { label: "ROE", kind: "pct" },
  roic: { label: "ROIC", kind: "pct" },
  roa: { label: "ROA", kind: "pct" },
  dy: {
    label: "DY 12m",
    kind: "pct",
    hint: "Proventos brutos (dividendos e JCP) com data-com nos últimos 12 meses, divididos pelo preço atual.",
  },
  peg: {
    label: "PEG",
    kind: "ratio",
    hint: "P/L dividido pelo crescimento anual do lucro por ação em % (CAGR de 5 anos, até 25%). Não se aplica a bancos, seguradoras, commodities cíclicas, empresas com prejuízo ou sem crescimento.",
  },
  bazinCeiling: {
    label: "Preço-teto (Bazin)",
    kind: "brl",
    hint: "Média dos proventos dos últimos anos completos dividida pelo DY alvo (padrão 6%). É uma estimativa.",
  },
  bazinDiscount: { label: "Desconto vs. teto Bazin", kind: "pctDelta", hint: "1 − preço ÷ preço-teto Bazin." },
  priceVsSma200: { label: "Preço vs. MM200", kind: "pctDelta" },
  drawdown52w: { label: "Queda da máx. 52 semanas", kind: "pctDelta" },
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
  grahamUpside: { label: "Potencial Graham", kind: "pctPoints", hint: POTENTIAL_HINT },
  fcdUpside: { label: "Potencial FCD", kind: "pctPoints", hint: POTENTIAL_HINT },
  gordonUpside: { label: "Potencial Gordon", kind: "pctPoints", hint: POTENTIAL_HINT },
  lpa: { label: "LPA", kind: "brl" },
  vpa: { label: "VPA", kind: "brl" },
  overallScore: { label: "Score geral", kind: "score" },
  technicalScore: { label: "Score técnico", kind: "score" },
  magicScore: { label: "Score Fórmula Mágica", kind: "score" },
  pjFiiScore: { label: "Score PJ-FII", kind: "score" },
  liquidez: {
    label: "Volume médio diário",
    kind: "brlCompact",
    hint: "Volume financeiro médio negociado por dia nos pregões recentes.",
  },
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
  "peg",
  "bazinCeiling",
  "bazinDiscount",
  "liquidez",
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

export function metricHint(key: string): string | undefined {
  return METRICS[key]?.hint
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
    case "pctDelta":
      return formatDeltaPct(value)
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

/** Verde/vermelho só para o potencial (resultado de valuation), nunca para múltiplos ou preço. */
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

/** Variação do ROE abaixo de 1 p.p. é descrita como estável. */
const ROE_STABLE_PP = 0.01

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

/**
 * Motivo de um ativo entrar em "Queda com fundamentos intactos", a partir das métricas da API:
 * "−12% vs. MM200 · −24% da máx. 52s · lucro 12m +4% · ROE estável". `null` sem as métricas do filtro.
 */
export function dipReason(keyMetrics: Record<string, number | null> | undefined): string | null {
  if (!keyMetrics || !("priceVsSma200" in keyMetrics)) return null
  const parts: string[] = []
  const { priceVsSma200, drawdown52w, netIncomeChange, roeChange } = keyMetrics
  if (finite(priceVsSma200)) parts.push(`${formatDeltaPct(priceVsSma200, { digits: 0 })} vs. MM200`)
  if (finite(drawdown52w)) parts.push(`${formatDeltaPct(drawdown52w, { digits: 0 })} da máx. 52s`)
  if (finite(netIncomeChange)) parts.push(`lucro 12m ${formatDeltaPct(netIncomeChange, { digits: 0 })}`)
  if (finite(roeChange)) {
    parts.push(
      Math.abs(roeChange) < ROE_STABLE_PP
        ? "ROE estável"
        : `ROE ${formatDeltaPct(roeChange, { digits: 1 }).replace("%", " p.p.")}`
    )
  }
  return parts.length > 0 ? parts.join(" · ") : null
}

/**
 * Margem de segurança como fração (`1 − preço / preço justo`), recalculada a partir dos valores brutos. É a mesma
 * métrica do cabeçalho do ativo e do ranking, para o mesmo preço justo dar o mesmo número em todas as telas.
 */
export function resultMargin(result: Pick<ScreeningResult, "currentPrice" | "fairValue">): number | null {
  return marginOfSafety(result.currentPrice, result.fairValue)
}

// ─────────────────────────────────────────────────────────────────────────────
// Ordenação dos cards no mobile
// ─────────────────────────────────────────────────────────────────────────────

export type MobileSortKey = "relevance" | "margin" | "pl" | "peg" | "dy" | "marketCap" | "pjFiiScore" | "pvp"

function sortValue(result: ScreeningResult, key: MobileSortKey): number | null {
  if (key === "margin") return resultMargin(result)
  const value = result.key_metrics?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** Direção natural de cada critério: múltiplos baratos primeiro, o resto do maior para o menor. */
const ASCENDING: ReadonlySet<MobileSortKey> = new Set(["pl", "pvp", "peg"])

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
  "bazinDiscountFilter",
  "pegFilter",
] as const

export type StockRangeFilterKey = (typeof STOCK_RANGE_FILTER_KEYS)[number]

export function isFilterActive(filter: ScreeningFilter | undefined): boolean {
  return !!filter?.enabled && (filter.min !== undefined || filter.max !== undefined)
}

export function countActiveStockFilters(params: ExtendedScreeningParams): number {
  let count = STOCK_RANGE_FILTER_KEYS.filter((key) => isFilterActive(params[key])).length
  if (params.companySize && params.companySize !== "all") count++
  if (params.selectedSectors && params.selectedSectors.length > 0) count++
  if (params.selectedIndustries && params.selectedIndustries.length > 0) count++
  if (params.dipWithIntactFundamentals) count++
  // Liquidez conta só quando sai do padrão (outro limite ou ativos com baixa liquidez incluídos).
  if (params.minLiquidity !== undefined) count++
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

export function defaultStockParams(assetTypeFilter: StockAssetType): ExtendedScreeningParams {
  return { companySize: "all", useTechnicalAnalysis: true, assetTypeFilter }
}

/** Faixas que o plano gratuito aplica (espelha `/api/rank-builder`, que descarta as demais fora do Premium). */
const FREE_STOCK_RANGE_KEYS = ["plFilter", "pvpFilter", "evEbitdaFilter", "psrFilter", "grahamUpsideFilter"] as const

/**
 * Remove os filtros Premium (ex.: vindos de um link compartilhado) para quem não tem Premium,
 * para o painel não mostrar como ativo um filtro que o backend ignora.
 */
export function stripPremiumStockParams(params: ExtendedScreeningParams): ExtendedScreeningParams {
  const next: ExtendedScreeningParams = {
    companySize: params.companySize ?? "all",
    useTechnicalAnalysis: params.useTechnicalAnalysis,
    assetTypeFilter: params.assetTypeFilter,
  }
  if (params.minLiquidity !== undefined) next.minLiquidity = params.minLiquidity
  for (const key of FREE_STOCK_RANGE_KEYS) {
    if (params[key] !== undefined) next[key] = params[key]
  }
  return next
}

export const DEFAULT_FII_PARAMS: FiiScreeningFormParams = { tipoFii: "both" }

// ─────────────────────────────────────────────────────────────────────────────
// Liquidez
// ─────────────────────────────────────────────────────────────────────────────

export type LiquidityAssetKind = "stock" | "fii"

/** Limites oferecidos no filtro (R$/dia); o padrão do tipo de ativo vem de `LIQUIDITY_DEFAULTS`. */
export const LIQUIDITY_OPTIONS = [500_000, 1_000_000, 2_000_000, 10_000_000] as const

export function defaultLiquidity(kind: LiquidityAssetKind): number {
  return LIQUIDITY_DEFAULTS[kind]
}

/** "≥ R$ 1 mi/dia" ou "≥ R$ 500 mil/dia". */
export function formatLiquidityOption(value: number): string {
  if (value >= 1_000_000) return `≥ ${formatBRLCompact(value, { digits: 0 })}/dia`
  return `≥ R$ ${formatNumber(value / 1000, { digits: 0 })} mil/dia`
}

/** Limite efetivo mostrado no controle: o escolhido ou o padrão do tipo (com ativos ilíquidos incluídos, o padrão). */
export function effectiveLiquidity(minLiquidity: number | null | undefined, kind: LiquidityAssetKind): number {
  return typeof minLiquidity === "number" ? minLiquidity : defaultLiquidity(kind)
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros na URL (links compartilháveis)
// ─────────────────────────────────────────────────────────────────────────────

/** Nome do parâmetro na URL de cada filtro de faixa (`plFilter` → `pl`). Valores na unidade salva (frações). */
function rangeParamName(key: StockRangeFilterKey): string {
  return key.replace(/Filter$/, "")
}

const COMPANY_SIZES = ["all", "small_caps", "mid_caps", "blue_chips"] as const
const LIQUIDITY_ALL = "todos"

function serializeRange(filter: ScreeningFilter): string {
  return `${filter.min ?? ""}~${filter.max ?? ""}`
}

function parseNumber(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === "") return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

function parseRange(raw: string | null): ScreeningFilter | undefined {
  if (!raw || !raw.includes("~")) return undefined
  const [minRaw, maxRaw] = raw.split("~")
  const min = parseNumber(minRaw)
  const max = parseNumber(maxRaw)
  if (min === undefined && max === undefined) return undefined
  return { enabled: true, ...(min !== undefined && { min }), ...(max !== undefined && { max }) }
}

function parseLiquidity(raw: string | null): number | null | undefined {
  if (raw === LIQUIDITY_ALL) return null
  const value = parseNumber(raw)
  return value !== undefined && value >= 0 ? value : undefined
}

function writeLiquidity(query: URLSearchParams, value: number | null | undefined) {
  if (value === null) query.set("liq", LIQUIDITY_ALL)
  else if (value !== undefined) query.set("liq", String(value))
}

/** Filtros de ações → query string (só o que difere do padrão). */
export function stockParamsToQuery(params: ExtendedScreeningParams): URLSearchParams {
  const query = new URLSearchParams()
  // Só B3 é o padrão do hub (sem `assetType` na URL).
  if (params.assetTypeFilter === "both" || params.assetTypeFilter === "bdr") query.set("assetType", params.assetTypeFilter)
  for (const key of STOCK_RANGE_FILTER_KEYS) {
    const filter = params[key]
    if (isFilterActive(filter)) query.set(rangeParamName(key), serializeRange(filter as ScreeningFilter))
  }
  if (params.bazinTargetYield !== undefined) query.set("bazinDy", String(params.bazinTargetYield))
  if (params.dipWithIntactFundamentals) query.set("queda", "1")
  writeLiquidity(query, params.minLiquidity)
  if (params.companySize && params.companySize !== "all") query.set("porte", params.companySize)
  if (params.useTechnicalAnalysis === false) query.set("sobrevenda", "0")
  for (const sector of params.selectedSectors ?? []) query.append("setor", sector)
  for (const industry of params.selectedIndustries ?? []) query.append("industria", industry)
  return query
}

/** Query string → filtros de ações (valores inválidos são ignorados). */
export function stockParamsFromQuery(query: URLSearchParams, assetTypeFilter: StockAssetType): ExtendedScreeningParams {
  const params: ExtendedScreeningParams = defaultStockParams(assetTypeFilter)
  for (const key of STOCK_RANGE_FILTER_KEYS) {
    const filter = parseRange(query.get(rangeParamName(key)))
    if (filter) params[key] = filter
  }
  const bazinDy = parseNumber(query.get("bazinDy"))
  if (bazinDy !== undefined && bazinDy > 0 && bazinDy <= 1) params.bazinTargetYield = bazinDy
  if (query.get("queda") === "1") params.dipWithIntactFundamentals = true
  const liquidity = parseLiquidity(query.get("liq"))
  if (liquidity !== undefined) params.minLiquidity = liquidity
  const size = query.get("porte")
  if (size && (COMPANY_SIZES as readonly string[]).includes(size)) params.companySize = size as (typeof COMPANY_SIZES)[number]
  if (query.get("sobrevenda") === "0") params.useTechnicalAnalysis = false
  const sectors = query.getAll("setor").filter(Boolean)
  if (sectors.length > 0) params.selectedSectors = sectors
  const industries = query.getAll("industria").filter(Boolean)
  if (industries.length > 0) params.selectedIndustries = industries
  return params
}

const FII_TYPES = ["papel", "tijolo", "both"] as const

/** Filtros de FIIs → query string. */
export function fiiParamsToQuery(params: FiiScreeningFormParams): URLSearchParams {
  const query = new URLSearchParams()
  if (params.tipoFii !== "both") query.set("tipo", params.tipoFii)
  if (params.minDY !== undefined) query.set("dy", String(params.minDY))
  if (params.maxPVP !== undefined) query.set("pvp", String(params.maxPVP))
  writeLiquidity(query, params.minLiquidity)
  if (params.minQtdImoveis !== undefined) query.set("imoveis", String(params.minQtdImoveis))
  if (params.maxVacancia !== undefined) query.set("vacancia", String(params.maxVacancia))
  if (params.segmento) query.set("segmento", params.segmento)
  return query
}

/** Query string → filtros de FIIs. */
export function fiiParamsFromQuery(query: URLSearchParams): FiiScreeningFormParams {
  const tipo = query.get("tipo")
  const params: FiiScreeningFormParams = {
    tipoFii: tipo && (FII_TYPES as readonly string[]).includes(tipo) ? (tipo as FiiScreeningFormParams["tipoFii"]) : "both",
  }
  const minDY = parseNumber(query.get("dy"))
  if (minDY !== undefined) params.minDY = minDY
  const maxPVP = parseNumber(query.get("pvp"))
  if (maxPVP !== undefined) params.maxPVP = maxPVP
  const liquidity = parseLiquidity(query.get("liq"))
  if (liquidity !== undefined) params.minLiquidity = liquidity
  const imoveis = parseNumber(query.get("imoveis"))
  if (imoveis !== undefined) params.minQtdImoveis = Math.round(imoveis)
  const vacancia = parseNumber(query.get("vacancia"))
  if (vacancia !== undefined) params.maxVacancia = vacancia
  const segmento = query.get("segmento")
  if (segmento) params.segmento = segmento
  return params
}

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
