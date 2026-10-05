/**
 * Sinais de mercado puros para filtros de screening e "Onde aportar": média móvel, queda desde a máxima de 52 semanas
 * e verificação de fundamentos (últimos 4 trimestres vs 4 anteriores). Tudo em fração (−0,20 = −20%).
 * Descrevem a situação do preço e dos números; não são indicação de compra ou venda.
 */

import { formatMultiple, formatNumber, formatPct } from '@/lib/format'
import { isFiniteNumber } from './utils'

export interface PricePoint {
  date: Date
  close: number
}

function cleanPrices(prices: readonly PricePoint[]): PricePoint[] {
  return prices
    .filter((p) => p.date instanceof Date && !Number.isNaN(p.date.getTime()) && isFiniteNumber(p.close) && p.close > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Média móvel simples dos `window` fechamentos mais recentes até `at` (inclusive; padrão: o último ponto).
 * `null` com menos de `window` pontos válidos.
 */
export function smaAt(prices: readonly PricePoint[], window = 200, at?: Date): number | null {
  if (!Number.isInteger(window) || window <= 0) return null
  const series = cleanPrices(prices).filter((p) => !at || p.date.getTime() <= at.getTime())
  if (series.length < window) return null
  const slice = series.slice(-window)
  return slice.reduce((acc, p) => acc + p.close, 0) / window
}

export interface PriceVsSma {
  sma: number | null
  /** Último fechamento / média − 1. Negativo quando o preço está abaixo da média. */
  pctAbove: number | null
}

/** Posição do último fechamento em relação à média móvel de `window` pregões. Campos `null` sem dados suficientes. */
export function priceVsSma(prices: readonly PricePoint[], window = 200): PriceVsSma {
  const series = cleanPrices(prices)
  const sma = smaAt(series, window)
  if (sma === null || series.length === 0) return { sma: null, pctAbove: null }
  return { sma, pctAbove: series[series.length - 1].close / sma - 1 }
}

export interface DrawdownFromHigh {
  /** Maior fechamento nas 52 semanas até o último ponto. */
  high52w: number | null
  /** Último fechamento / máxima − 1 (0 na máxima, negativo abaixo dela). */
  drawdown: number | null
}

const WEEKS_52_MS = 364 * 86_400_000

/** Queda do último fechamento em relação à máxima de 52 semanas. Campos `null` sem preços. */
export function drawdownFrom52wHigh(prices: readonly PricePoint[]): DrawdownFromHigh {
  const series = cleanPrices(prices)
  if (series.length === 0) return { high52w: null, drawdown: null }
  const last = series[series.length - 1]
  const start = last.date.getTime() - WEEKS_52_MS
  const high52w = Math.max(...series.filter((p) => p.date.getTime() >= start).map((p) => p.close))
  return { high52w, drawdown: last.close / high52w - 1 }
}

/** Dados trimestrais usados na verificação de fundamentos. Valores monetários em R$; `roe` e `margemLiquida` em fração. */
export interface QuarterFundamentals {
  date: Date
  lucroLiquido: number | null | undefined
  roe: number | null | undefined
  margemLiquida: number | null | undefined
  /** Saldo de dívida líquida no fim do trimestre (negativo = caixa líquido). */
  dividaLiquida: number | null | undefined
  ebitda: number | null | undefined
}

/** Queda máxima tolerada do lucro líquido 12m em relação aos 12m anteriores: 15%. */
export const MAX_NET_INCOME_TTM_DROP = 0.15
/** Queda máxima tolerada do ROE 12m: 3 pontos percentuais. */
export const MAX_ROE_TTM_DROP_PP = 0.03
/** Queda máxima tolerada da margem líquida 12m: 3 pontos percentuais. */
export const MAX_NET_MARGIN_TTM_DROP_PP = 0.03
/** Alta máxima tolerada da dívida líquida/EBITDA 12m: 1,0x. */
export const MAX_NET_DEBT_EBITDA_INCREASE = 1.0

export interface FundamentalsIntactOptions {
  maxNetIncomeDrop?: number
  maxRoeDropPp?: number
  maxNetMarginDropPp?: number
  maxNetDebtEbitdaIncrease?: number
  /**
   * Base de `roe` e `margemLiquida` em cada trimestre.
   * 'ttm' (padrão, como o ROE do schema, que é anual/12 meses): cada trimestre já traz o valor acumulado de 12 meses;
   * compara o último com o de 4 trimestres antes.
   * 'quarterly': valores do próprio trimestre; ROE 12m = soma dos 4, margem 12m = média dos 4.
   */
  ratioBasis?: 'quarterly' | 'ttm'
}

export interface FundamentalsCheck {
  name: string
  passed: boolean
  detail: string
}

export interface FundamentalsIntactResult {
  intact: boolean
  checks: FundamentalsCheck[]
}

export const INSUFFICIENT_DATA_CHECK = 'dados insuficientes'

const EPSILON = 1e-9

function pct(value: number): string {
  return formatPct(value)
}

function pp(value: number): string {
  return `${formatNumber(value * 100, { digits: 1 })} p.p.`
}

function times(value: number): string {
  return formatMultiple(value, { digits: 2 })
}

function allFinite(values: readonly (number | null | undefined)[]): values is number[] {
  return values.every(isFiniteNumber)
}

function insufficient(detail: string): FundamentalsCheck {
  return { name: INSUFFICIENT_DATA_CHECK, passed: false, detail }
}

const sum4 = (values: readonly number[]) => values.reduce((a, b) => a + b, 0)

/** Intervalo aceito entre fechamentos de trimestres consecutivos, em dias (≈ 91 dias, com folga para datas de divulgação). */
const MIN_QUARTER_GAP_DAYS = 75
const MAX_QUARTER_GAP_DAYS = 110

/** `true` quando cada trimestre vem ~3 meses depois do anterior (sem trimestre faltando ou repetido). */
function areConsecutiveQuarters(sorted: readonly QuarterFundamentals[]): boolean {
  for (let i = 1; i < sorted.length; i++) {
    const gapDays = (sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / 86_400_000
    if (gapDays < MIN_QUARTER_GAP_DAYS || gapDays > MAX_QUARTER_GAP_DAYS) return false
  }
  return true
}

/**
 * Fundamentos preservados: compara os últimos 4 trimestres com os 4 anteriores (12m vs 12m anteriores). Exige 8 trimestres
 * consecutivos.
 * Critérios: lucro líquido não cai mais de 15%; ROE e margem líquida não caem mais de 3 p.p.; dívida líquida/EBITDA
 * não sobe mais de 1,0x. Dado ausente reprova com o check 'dados insuficientes' (sem benefício da dúvida).
 */
export function fundamentalsIntact(
  quarters: readonly QuarterFundamentals[],
  options: FundamentalsIntactOptions = {}
): FundamentalsIntactResult {
  const {
    maxNetIncomeDrop = MAX_NET_INCOME_TTM_DROP,
    maxRoeDropPp = MAX_ROE_TTM_DROP_PP,
    maxNetMarginDropPp = MAX_NET_MARGIN_TTM_DROP_PP,
    maxNetDebtEbitdaIncrease = MAX_NET_DEBT_EBITDA_INCREASE,
    ratioBasis = 'ttm',
  } = options

  const sorted = quarters
    .filter((q) => q.date instanceof Date && !Number.isNaN(q.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-8)

  if (sorted.length < 8) {
    return { intact: false, checks: [insufficient(`São necessários 8 trimestres; há ${sorted.length}.`)] }
  }
  if (!areConsecutiveQuarters(sorted)) {
    return { intact: false, checks: [insufficient('Os 8 trimestres precisam ser consecutivos; há trimestres faltando na série.')] }
  }

  const prev = sorted.slice(0, 4)
  const last = sorted.slice(4)
  const checks: FundamentalsCheck[] = []

  // Lucro líquido 12m
  const niPrev = prev.map((q) => q.lucroLiquido)
  const niLast = last.map((q) => q.lucroLiquido)
  if (allFinite(niPrev) && allFinite(niLast)) {
    const before = sum4(niPrev)
    const after = sum4(niLast)
    let passed: boolean
    let detail: string
    if (before > 0) {
      const change = after / before - 1
      passed = change >= -maxNetIncomeDrop - EPSILON
      detail = `Variação de ${pct(change)} no lucro 12m (limite −${pct(maxNetIncomeDrop)}).`
    } else {
      passed = after >= before
      detail = passed ? 'Lucro 12m anterior não positivo e sem piora.' : 'Lucro 12m anterior não positivo e piorou.'
    }
    checks.push({ name: 'Lucro líquido 12m', passed, detail })
  } else {
    checks.push(insufficient('Lucro líquido ausente em algum dos 8 trimestres.'))
  }

  // ROE e margem líquida 12m
  const ratioCheck = (name: string, pick: (q: QuarterFundamentals) => number | null | undefined, maxDropPp: number, aggregate: (v: number[]) => number) => {
    let before: number | null = null
    let after: number | null = null
    if (ratioBasis === 'ttm') {
      const b = pick(prev[prev.length - 1])
      const a = pick(last[last.length - 1])
      if (isFiniteNumber(b) && isFiniteNumber(a)) {
        before = b
        after = a
      }
    } else {
      const b = prev.map(pick)
      const a = last.map(pick)
      if (allFinite(b) && allFinite(a)) {
        before = aggregate(b)
        after = aggregate(a)
      }
    }
    if (before === null || after === null) {
      checks.push(insufficient(`${name} ausente em algum trimestre.`))
      return
    }
    const change = after - before
    checks.push({
      name,
      passed: change >= -maxDropPp - EPSILON,
      detail: `De ${pct(before)} para ${pct(after)} (${pp(change)}; limite −${pp(maxDropPp)}).`,
    })
  }
  ratioCheck('ROE 12m', (q) => q.roe, maxRoeDropPp, sum4)
  ratioCheck('Margem líquida 12m', (q) => q.margemLiquida, maxNetMarginDropPp, (v) => sum4(v) / v.length)

  // Dívida líquida / EBITDA 12m (saldo do fim do período sobre EBITDA acumulado)
  const ebitdaPrev = prev.map((q) => q.ebitda)
  const ebitdaLast = last.map((q) => q.ebitda)
  const debtBefore = prev[prev.length - 1].dividaLiquida
  const debtAfter = last[last.length - 1].dividaLiquida
  if (allFinite(ebitdaPrev) && allFinite(ebitdaLast) && isFiniteNumber(debtBefore) && isFiniteNumber(debtAfter)) {
    const eBefore = sum4(ebitdaPrev)
    const eAfter = sum4(ebitdaLast)
    let passed: boolean
    let detail: string
    if (eAfter <= 0) {
      passed = false
      detail = 'EBITDA 12m não positivo: alavancagem indefinida.'
    } else if (eBefore <= 0) {
      passed = true
      detail = `EBITDA 12m voltou a ser positivo; alavancagem atual ${times(debtAfter / eAfter)}.`
    } else {
      const levBefore = debtBefore / eBefore
      const levAfter = debtAfter / eAfter
      const change = levAfter - levBefore
      passed = change <= maxNetDebtEbitdaIncrease + EPSILON
      detail = `De ${times(levBefore)} para ${times(levAfter)} (limite +${times(maxNetDebtEbitdaIncrease)}).`
    }
    checks.push({ name: 'Dívida líquida/EBITDA', passed, detail })
  } else {
    checks.push(insufficient('Dívida líquida ou EBITDA ausente em algum trimestre.'))
  }

  return { intact: checks.every((c) => c.passed), checks }
}

/** Queda desde a máxima de 52 semanas a partir da qual o preço é considerado em correção: −20%. */
export const DIP_DRAWDOWN_THRESHOLD = -0.2

export interface DipContext {
  /** Série de preços diários (usada para calcular o que não vier pronto). */
  prices?: readonly PricePoint[]
  /** Trimestres (usados quando `fundamentals` não vier pronto). */
  quarters?: readonly QuarterFundamentals[]
  fundamentalsOptions?: FundamentalsIntactOptions
  /** Pré-calculado: posição vs média de 200 pregões. */
  priceVsSma200?: Pick<PriceVsSma, 'pctAbove'> | null
  /** Pré-calculado: queda desde a máxima de 52 semanas (fração). */
  drawdown52w?: number | null
  /** Pré-calculado: resultado de `fundamentalsIntact`. */
  fundamentals?: Pick<FundamentalsIntactResult, 'intact'> | null
}

/**
 * Preço em correção com fundamentos preservados:
 * (preço abaixo da média de 200 pregões OU queda ≥ 20% desde a máxima de 52 semanas) E `fundamentalsIntact`.
 * Sem dados suficientes, devolve `false`.
 */
export function dipWithIntactFundamentals(ctx: DipContext): boolean {
  const prices = ctx.prices ?? []
  const pctAbove = ctx.priceVsSma200 !== undefined ? ctx.priceVsSma200?.pctAbove ?? null : priceVsSma(prices, 200).pctAbove
  const drawdown = ctx.drawdown52w !== undefined ? ctx.drawdown52w : drawdownFrom52wHigh(prices).drawdown
  const priceDip =
    (isFiniteNumber(pctAbove) && pctAbove < 0) || (isFiniteNumber(drawdown) && drawdown <= DIP_DRAWDOWN_THRESHOLD + EPSILON)
  if (!priceDip) return false
  const fundamentals = ctx.fundamentals !== undefined ? ctx.fundamentals : fundamentalsIntact(ctx.quarters ?? [], ctx.fundamentalsOptions)
  return fundamentals?.intact === true
}
