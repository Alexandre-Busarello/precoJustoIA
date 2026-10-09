/**
 * Helpers puros da vitrine de backtests (sem Prisma nem React): janela, período comum, redução da série mensal,
 * resumo serializável de cada resultado e a regra "tudo ou nada". Usados pelo cálculo, pela UI e pelos testes.
 */
import { formatMonthYear, quickPeriod } from '@/lib/backtest/quick-backtest'
import { SHOWCASE_MIN_MONTHS, SHOWCASE_YEARS, type ShowcaseDefinition, type ShowcaseRebalance } from './definitions'

/** Pontos máximos da série mensal enviada à página (5 anos = 60 meses cabem inteiros). */
export const SHOWCASE_MAX_POINTS = 72

export interface ShowcasePoint {
  /** Mês do ponto, `YYYY-MM`. */
  month: string
  portfolio: number
  cdi: number
  ibov: number
}

/** Resumo de uma vitrine. Valores em reais; retornos, drawdown, volatilidade e custo como **fração** (0,12 = 12%). */
export interface ShowcaseSummary {
  id: string
  title: string
  why: string
  tickers: string[]
  /** Pesos (fração, soma 1), na ordem de `tickers`. */
  allocations: number[]
  initialCapital: number
  monthlyContribution: number
  rebalanceFrequency: ShowcaseRebalance
  /** Primeiro e último mês simulados, `YYYY-MM`. */
  firstMonth: string
  lastMonth: string
  months: number
  finalValue: number
  totalInvested: number
  /** (valor final − aportado) ÷ aportado. */
  totalReturn: number
  /** Retorno anualizado pela cota, sem o efeito dos aportes. */
  annualizedReturn: number
  /** Saldo com os mesmos aportes no CDI e no Ibovespa (índice de preço, sem proventos). */
  cdiFinalValue: number
  ibovFinalValue: number
  cdiReturn: number
  ibovReturn: number
  /** Maior queda do pico ao vale (fração positiva: 0,37 = queda de 37%). */
  maxDrawdown: number
  /** Volatilidade anualizada. */
  volatility: number
  tradingCostRate: number
  totalTradingCosts: number
  series: ShowcasePoint[]
}

export interface ShowcaseBlock {
  /** ISO do momento do cálculo. */
  computedAt: string
  /** Janela pedida (`YYYY-MM-DD`, 1º dia do mês). */
  windowStart: string
  windowEnd: string
  /** true quando o histórico de algum ativo encurtou a janela de todas as carteiras. */
  shortenedWindow: boolean
  items: ShowcaseSummary[]
}

/** Subconjunto do resultado do motor (`AdaptiveBacktestResult`) usado pelo resumo. */
export interface ShowcaseEngineResult {
  finalValue: number
  totalInvested: number
  totalReturn: number
  annualizedReturn: number
  maxDrawdown: number
  volatility: number
  monthlyReturns: ReadonlyArray<{ date: string; portfolioValue: number; cdiValue?: number; ibovValue?: number }>
  assumptions?: { tradingCostRate: number; totalTradingCosts: number }
}

export interface ShowcaseWindow {
  startDate: Date
  endDate: Date
}

/** Últimos 5 anos completos, terminando no 1º dia do mês corrente em Brasília (meia-noite UTC). */
export function showcaseWindow(now: Date = new Date()): ShowcaseWindow {
  return quickPeriod(now, SHOWCASE_YEARS)
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function monthsBetweenUtc(start: Date, end: Date): number {
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth())
}

/**
 * Início comum a todas as carteiras: o mais tardio entre os inícios com dados. Abaixo de 36 meses até o fim da janela,
 * não há vitrine (`null`).
 */
export function commonStart(window: ShowcaseWindow, starts: readonly Date[]): { startDate: Date; shortened: boolean } | null {
  const windowStart = Date.UTC(window.startDate.getUTCFullYear(), window.startDate.getUTCMonth(), 1)
  const latest = starts.reduce((max, date) => Math.max(max, Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)), windowStart)
  const startDate = new Date(latest)
  if (monthsBetweenUtc(startDate, window.endDate) < SHOWCASE_MIN_MONTHS) return null
  return { startDate, shortened: latest > windowStart }
}

/** Reduz a série para no máximo `max` pontos, igualmente espaçados, mantendo sempre o primeiro e o último. */
export function downsample<T>(points: readonly T[], max: number = SHOWCASE_MAX_POINTS): T[] {
  if (points.length <= max) return [...points]
  if (max < 2) return points.length > 0 ? [points[points.length - 1]] : []
  const last = points.length - 1
  return Array.from({ length: max }, (_, i) => points[Math.round((i * last) / (max - 1))])
}

/** Tudo ou nada: se qualquer vitrine faltar, nenhuma aparece (sem vitrine parcial). */
export function allOrNothing<T>(items: ReadonlyArray<T | null | undefined>): T[] | null {
  if (items.length === 0) return null
  return items.every((item): item is T => item !== null && item !== undefined) ? [...items] : null
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Resumo serializável de um resultado. `null` quando falta algo que o card precisa mostrar (meses simulados,
 * CDI ou Ibovespa de algum mês, métricas não numéricas ou nada aportado).
 */
export function summarizeShowcase(
  definition: ShowcaseDefinition,
  allocations: readonly number[],
  result: ShowcaseEngineResult
): ShowcaseSummary | null {
  const months = result.monthlyReturns
  if (months.length === 0) return null
  if (!months.every((m) => finite(m.portfolioValue) && finite(m.cdiValue) && finite(m.ibovValue))) return null
  const metrics = [result.finalValue, result.totalInvested, result.totalReturn, result.annualizedReturn, result.maxDrawdown, result.volatility]
  if (!metrics.every(finite) || result.totalInvested <= 0) return null
  if (!result.assumptions || !finite(result.assumptions.tradingCostRate) || !finite(result.assumptions.totalTradingCosts)) return null

  const last = months[months.length - 1]
  const cdiFinalValue = last.cdiValue as number
  const ibovFinalValue = last.ibovValue as number
  const series = downsample(
    months.map((m) => ({ month: m.date.slice(0, 7), portfolio: m.portfolioValue, cdi: m.cdiValue as number, ibov: m.ibovValue as number }))
  )

  return {
    id: definition.id,
    title: definition.title,
    why: definition.why,
    tickers: [...definition.tickers],
    allocations: [...allocations],
    initialCapital: definition.initialCapital,
    monthlyContribution: definition.monthlyContribution,
    rebalanceFrequency: definition.rebalanceFrequency,
    firstMonth: months[0].date.slice(0, 7),
    lastMonth: last.date.slice(0, 7),
    months: months.length,
    finalValue: result.finalValue,
    totalInvested: result.totalInvested,
    totalReturn: result.totalReturn,
    annualizedReturn: result.annualizedReturn,
    cdiFinalValue,
    ibovFinalValue,
    cdiReturn: cdiFinalValue / result.totalInvested - 1,
    ibovReturn: ibovFinalValue / result.totalInvested - 1,
    maxDrawdown: result.maxDrawdown,
    volatility: result.volatility,
    tradingCostRate: result.assumptions.tradingCostRate,
    totalTradingCosts: result.assumptions.totalTradingCosts,
    series,
  }
}

function monthDate(month: string): Date {
  const [year, m] = month.split('-').map(Number)
  return new Date(Date.UTC(year, m - 1, 1))
}

/** `('2021-10', '2026-09')` → "out. 2021 a set. 2026". */
export function formatShowcasePeriod(firstMonth: string, lastMonth: string): string {
  return `${formatMonthYear(monthDate(firstMonth))} a ${formatMonthYear(monthDate(lastMonth))}`
}

/** "mar. 2022" a partir de `YYYY-MM`. */
export function formatShowcaseMonth(month: string): string {
  return formatMonthYear(monthDate(month))
}
