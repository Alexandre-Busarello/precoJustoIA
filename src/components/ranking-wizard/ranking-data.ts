import { formatBRL, formatDeltaPct, formatMultiple, formatNumber, formatPct } from '@/lib/format'
import { marginOfSafety } from '@/lib/valuation-metrics'
import type { RankingModel, RankingParamField, RankingParams } from '@/lib/ranking-models'
import { METRICS, formatMetricValue as formatScreeningMetric } from '@/components/screening/screening-metrics'
import type { EtfRankingItem } from '@/lib/strategies/etf-ranking-strategy'

/** Linha devolvida por `/api/rank-builder` (e salva no histórico). */
export interface RankingResult {
  ticker: string
  name: string
  sector: string | null
  currentPrice: number
  logoUrl?: string | null
  fairValue: number | null
  /** Pontos percentuais (24,6 = 24,6%), como vem da API. A UI recalcula a margem a partir dos preços. */
  upside: number | null
  marginOfSafety: number | null
  /** Modelo que forneceu o preço justo quando o ranking não tem um próprio (ex.: "Graham", "Teto DY 8% a.a."). */
  fairValueModel?: string | null
  rational: string
  key_metrics?: Record<string, number | null>
}

export interface RankingResponse {
  model: string
  params: RankingParams
  /** Metodologia em markdown (só vem em rankings recém-gerados). */
  rational?: string
  results: RankingResult[]
  /** Total encontrado antes do limite do plano. */
  count: number
}

export interface RankingMetric {
  key: string
  label: string
  value: string
}

export interface RankingRow {
  id: string
  position: number
  ticker: string
  name: string
  sector: string | null
  logoUrl: string | null
  href: string
  price: number | null
  fairValue: number | null
  /** Origem do preço justo quando vem de outro modelo; `null` quando é do próprio ranking. */
  fairValueSource: string | null
  /** Fração: 1 − preço / preço justo. */
  margin: number | null
  score: number | null
  metrics: RankingMetric[]
  rationale: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Métricas do detalhe da linha
// ─────────────────────────────────────────────────────────────────────────────

type RankingMetricKind = 'score' | 'pct' | 'pctPoints' | 'brl' | 'multiple' | 'number'

/** Métricas próprias dos rankings (as de screening vêm de `METRICS`). Unidades conferidas na saída da API. */
const RANKING_ONLY_METRICS: Record<string, { label: string; kind: RankingMetricKind }> = {
  qualityScore: { label: 'Score de qualidade', kind: 'score' },
  sustainabilityScore: { label: 'Score de sustentabilidade', kind: 'score' },
  valueScore: { label: 'Score de valor', kind: 'score' },
  fcdQualityScore: { label: 'Score FCD', kind: 'score' },
  compositeScore: { label: 'Score composto', kind: 'score' },
  fundamentalistScore: { label: 'Score 3+1', kind: 'score' },
  barsiScore: { label: 'Score Barsi', kind: 'score' },
  dividendYield: { label: 'Dividend yield médio', kind: 'pct' },
  cagrLucros5a: { label: 'CAGR lucros 5a', kind: 'pct' },
  ceilingPrice: { label: 'Preço-teto', kind: 'brl' },
  discountFromCeiling: { label: 'Desconto até o teto', kind: 'pctPoints' },
  averageDividend: { label: 'Dividendo médio anual', kind: 'brl' },
  impliedWACC: { label: 'WACC aplicado', kind: 'pct' },
  impliedGrowth: { label: 'Crescimento aplicado', kind: 'pct' },
  adjustedDiscountRate: { label: 'Taxa de desconto ajustada', kind: 'pct' },
  adjustedGrowthRate: { label: 'Crescimento ajustado', kind: 'pct' },
  projectionYears: { label: 'Anos de projeção', kind: 'number' },
}

/** Ordem de exibição no detalhe da linha. Chaves fora desta lista não aparecem. */
const METRIC_ORDER = [
  'qualityScore',
  'sustainabilityScore',
  'valueScore',
  'magicScore',
  'fcdQualityScore',
  'compositeScore',
  'fundamentalistScore',
  'barsiScore',
  'pjFiiScore',
  'pl',
  'pvp',
  'evEbitda',
  'roe',
  'roic',
  'roa',
  'earningsYield',
  'margemLiquida',
  'margemEbitda',
  'dy',
  'dividendYield',
  'payout',
  'averageDividend',
  'ceilingPrice',
  'discountFromCeiling',
  'precoTetoDY',
  'crescimentoReceitas',
  'crescimentoLucros',
  'cagrLucros5a',
  'dividaLiquidaPl',
  'dividaLiquidaEbitda',
  'liquidezCorrente',
  'liquidez',
  'impliedWACC',
  'impliedGrowth',
  'adjustedDiscountRate',
  'adjustedGrowthRate',
  'projectionYears',
  'grahamUpside',
  'fcdUpside',
  'gordonUpside',
]

export function rankingMetricLabel(key: string): string | null {
  return RANKING_ONLY_METRICS[key]?.label ?? METRICS[key]?.label ?? null
}

export function formatRankingMetric(key: string, value: number | null | undefined): string {
  const kind = RANKING_ONLY_METRICS[key]?.kind
  switch (kind) {
    case 'score':
      return formatNumber(value, { digits: 0 })
    case 'pct':
      return formatPct(value)
    case 'pctPoints':
      return formatDeltaPct(typeof value === 'number' ? value / 100 : value)
    case 'brl':
      return formatBRL(value)
    case 'multiple':
      return formatMultiple(value)
    case 'number':
      return formatNumber(value, { digits: 0 })
    default:
      return formatScreeningMetric(key, value)
  }
}

/** Métricas conhecidas presentes em `key_metrics`, na ordem de exibição, sem a que já está na coluna Score. */
export function rankingMetrics(keyMetrics: Record<string, number | null> | undefined, skipKey?: string): RankingMetric[] {
  if (!keyMetrics) return []
  const metrics: RankingMetric[] = []
  for (const key of METRIC_ORDER) {
    if (key === skipKey) continue
    const value = keyMetrics[key]
    const label = rankingMetricLabel(key)
    if (label === null || typeof value !== 'number' || !Number.isFinite(value)) continue
    metrics.push({ key, label, value: formatRankingMetric(key, value) })
  }
  return metrics
}

// ─────────────────────────────────────────────────────────────────────────────
// Linhas da tabela
// ─────────────────────────────────────────────────────────────────────────────

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]\s?/gu

/** Remove emoji do texto gerado pela API (a UI não usa emoji). */
export function stripEmoji(text: string): string {
  return text.replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').trim()
}

function assetHref(ticker: string, model: RankingModel | undefined): string {
  const slug = ticker.toLowerCase()
  if (model?.assetType === 'fii') return `/fii/${slug}`
  if (model?.assetType === 'etf') return `/etf/${slug}`
  return `/acao/${slug}`
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function toRankingRows(results: RankingResult[], model: RankingModel | undefined): RankingRow[] {
  return results.map((result, index) => {
    const metrics = result.key_metrics
    const ownFairValue = model?.fairValueKey ? finiteOrNull(metrics?.[model.fairValueKey]) : null
    const fairValue = model?.fairValueKey ? ownFairValue : finiteOrNull(result.fairValue)
    const price = finiteOrNull(result.currentPrice)
    return {
      id: `${result.ticker}-${index}`,
      position: index + 1,
      ticker: result.ticker,
      name: result.name,
      sector: result.sector,
      logoUrl: result.logoUrl ?? null,
      href: assetHref(result.ticker, model),
      price: price && price > 0 ? price : null,
      fairValue,
      fairValueSource: model?.fairValueKey ? null : result.fairValueModel || null,
      margin: marginOfSafety(price, fairValue),
      score: model?.score ? finiteOrNull(metrics?.[model.score.key]) : null,
      metrics: rankingMetrics(metrics, model?.score?.key),
      rationale: stripEmoji(result.rational ?? ''),
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// ETFs
// ─────────────────────────────────────────────────────────────────────────────

export interface EtfRow {
  id: string
  position: number
  ticker: string
  name: string
  logoUrl: string | null
  href: string
  benchmark: string | null
  score: number | null
  /** Fração. */
  return1y: number | null
  isEstimatedReturn: boolean
  /** Fração ao ano. */
  expenseRatio: number | null
}

/** Retorno em 12 meses; sem histórico, anualiza o de 6 meses. */
export function etfReturn1y(item: Pick<EtfRankingItem, 'return1y' | 'return6m'>): number | null {
  if (item.return1y !== null) return item.return1y
  if (item.return6m !== null) return (1 + item.return6m) ** 2 - 1
  return null
}

export function etfRowsFromApi(items: EtfRankingItem[]): EtfRow[] {
  return items.map((item, index) => ({
    id: `${item.ticker}-${index}`,
    position: index + 1,
    ticker: item.ticker,
    name: item.name,
    logoUrl: item.logoUrl,
    href: `/etf/${item.ticker.toLowerCase()}`,
    benchmark: item.benchmarkIndex,
    score: item.etfScore,
    return1y: etfReturn1y(item),
    isEstimatedReturn: item.isEstimatedReturn,
    expenseRatio: item.netExpenseRatio,
  }))
}

/** ETFs salvos no histórico (formato de `/api/rank-builder`, com as métricas em `key_metrics`). */
export function etfRowsFromHistory(results: RankingResult[]): EtfRow[] {
  return results.map((result, index) => ({
    id: `${result.ticker}-${index}`,
    position: index + 1,
    ticker: result.ticker,
    name: result.name,
    logoUrl: result.logoUrl ?? null,
    href: `/etf/${result.ticker.toLowerCase()}`,
    benchmark: result.sector,
    score: finiteOrNull(result.key_metrics?.etfScore),
    return1y: finiteOrNull(result.key_metrics?.retorno_1a),
    isEstimatedReturn: false,
    expenseRatio: finiteOrNull(result.key_metrics?.taxa_adm),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Parâmetros
// ─────────────────────────────────────────────────────────────────────────────

export function formatParamValue(field: RankingParamField, value: unknown): string {
  if (field.kind === 'switch') return value ? 'Sim' : 'Não'
  if (field.kind === 'select') {
    return field.options.find((option) => option.value === value)?.label ?? '—'
  }
  const numeric = typeof value === 'number' ? value : null
  switch (field.unit) {
    case 'pct':
      return formatPct(numeric, { digits: numeric !== null && Math.round(numeric * 1000) % 10 !== 0 ? 1 : 0 })
    case 'multiple':
      return formatMultiple(numeric, { digits: numeric !== null && Number.isInteger(numeric) ? 0 : 1 })
    case 'brl':
      return formatBRL(numeric, { digits: 0 })
    default:
      return formatNumber(numeric, { digits: 0 })
  }
}

/** Resumo de uma linha dos parâmetros (sliders e selects fora do padrão "todas"), para o gatilho do painel. */
export function summarizeParams(model: RankingModel, params: RankingParams): string {
  const parts: string[] = []
  for (const field of model.fields) {
    if (field.kind === 'switch') continue
    const value = params[field.key]
    if (field.kind === 'select' && (value === 'all' || value === 'both')) continue
    parts.push(`${field.label} ${formatParamValue(field, value)}`)
  }
  return parts.join(' · ')
}
