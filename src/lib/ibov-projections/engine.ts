/**
 * Faixas estatísticas do Ibovespa a partir do comportamento histórico do índice.
 *
 * Método (determinístico, sem IA):
 * - retornos logarítmicos de cada horizonte (5, 21 e 252 pregões) em todas as janelas sobrepostas dos últimos
 *   10 anos de fechamentos diários;
 * - percentis empíricos p5, p16, p50, p84 e p95 desses retornos, aplicados ao último fechamento;
 * - ajuste de regime opcional: a dispersão em torno da mediana é multiplicada pela razão entre a volatilidade
 *   realizada de 63 pregões e a mediana dessa volatilidade no período, limitada a 0,7–1,5×;
 * - calibração: o mesmo método aplicado em datas passadas, usando só os dados disponíveis em cada data,
 *   conta quantas vezes o fechamento realizado caiu dentro de cada faixa.
 *
 * Funções puras: mesma entrada, mesmos números. Nada aqui acessa rede, banco ou relógio.
 */

export type HorizonId = 'WEEKLY' | 'MONTHLY' | 'ANNUAL'

export interface DailyClose {
  /** Data do pregão (YYYY-MM-DD, fuso de Brasília). */
  date: string
  close: number
}

export interface HorizonDefinition {
  id: HorizonId
  label: string
  /** Períodos com artigo, usado em frases ("em 58% dos meses"). */
  periodNoun: string
  tradingDays: number
}

export const METHOD_ID = 'empirical-quantiles-v1'

export const HORIZONS: readonly HorizonDefinition[] = [
  { id: 'WEEKLY', label: '1 semana', periodNoun: 'das semanas', tradingDays: 5 },
  { id: 'MONTHLY', label: '1 mês', periodNoun: 'dos meses', tradingDays: 21 },
  { id: 'ANNUAL', label: '12 meses', periodNoun: 'das janelas de 12 meses', tradingDays: 252 },
]

export const TRADING_DAYS_PER_YEAR = 252
/** Janela de dados usada para as faixas: 10 anos de pregões. */
export const LOOKBACK_DAYS = 10 * TRADING_DAYS_PER_YEAR
/** Janela da volatilidade realizada de curto prazo (3 meses). */
export const VOL_WINDOW = 63
export const VOL_SCALE_MIN = 0.7
export const VOL_SCALE_MAX = 1.5
/** Último fechamento com mais de 3 pregões de atraso é sinalizado como desatualizado. */
export const STALE_AFTER_TRADING_DAYS = 3
/** Mínimo de janelas para calcular uma faixa. */
export const MIN_WINDOWS = 250
/** Calibração: resultados realizados nos últimos 5 anos. */
export const CALIBRATION_YEARS = 5
/** Calibração: mínimo de 3 anos de dados antes de cada data avaliada. */
export const CALIBRATION_MIN_HISTORY = 3 * TRADING_DAYS_PER_YEAR
/** Distância aceitável entre a cobertura observada e a nominal (68% e 90%). */
export const CALIBRATION_TOLERANCE = { probable: 0.08, wide: 0.06 } as const
/** Prazos (em pregões) do cone do gráfico. */
export const CONE_OFFSETS = [5, 10, 21, 42, 63, 126, 189, 252] as const

export interface Quantiles {
  p5: number
  p16: number
  p50: number
  p84: number
  p95: number
}

export interface VolatilityScale {
  /** Volatilidade diária realizada nos últimos 63 pregões (desvio-padrão dos retornos log). */
  current: number | null
  /** Mediana da volatilidade de 63 pregões no período. */
  median: number | null
  /** Razão current/median sem limite. */
  ratio: number | null
  /** Fator aplicado (1 quando não há dado; senão a razão limitada a 0,7–1,5). */
  applied: number
}

export type CalibrationVerdict = 'ok' | 'too-wide' | 'too-narrow' | 'insufficient'

export interface Calibration {
  /** Datas avaliadas no backtest. */
  evaluations: number
  /** Períodos sem sobreposição contidos na amostra (o que de fato conta como observação independente). */
  independentPeriods: number
  /** Fração das avaliações em que o valor realizado ficou dentro da faixa provável (p16–p84). */
  insideProbable: number | null
  /** Idem para a faixa ampla (p5–p95). */
  insideWide: number | null
  /** Fração das avaliações em que o valor realizado ficou acima de p84 e abaixo de p16. */
  aboveProbable: number | null
  belowProbable: number | null
  verdict: CalibrationVerdict
}

export interface HorizonEstimate {
  /** Percentis do retorno logarítmico do horizonte, já com o ajuste de volatilidade. */
  logQuantiles: Quantiles
  /** Percentis sem ajuste (só para referência). */
  rawLogQuantiles: Quantiles
  /** Número de janelas usadas. */
  sampleSize: number
  /** Fração das janelas com retorno positivo. */
  positiveShare: number
  volatility: VolatilityScale
}

export interface HorizonProjection {
  id: HorizonId
  label: string
  periodNoun: string
  tradingDays: number
  status: 'ok' | 'insufficient'
  /** Janelas usadas (sobrepostas). */
  sampleSize: number
  /** Períodos sem sobreposição na amostra. */
  independentPeriods: number
  /** Níveis do índice nos percentis (pontos). */
  levels: Quantiles | null
  /** Variação simples correspondente (fração: 0,05 = +5%). */
  returns: Quantiles | null
  positiveShare: number | null
  volatility: VolatilityScale | null
  calibration: Calibration
}

export interface ConePoint {
  /** Pregões à frente do último fechamento. */
  offset: number
  levels: Quantiles
}

export interface StaleInfo {
  isStale: boolean
  /** Pregões (dias úteis, sem contar feriados) entre o último fechamento e a data de referência. */
  tradingDaysSinceClose: number
}

export interface IbovProjectionCore {
  method: typeof METHOD_ID
  status: 'ok' | 'no-data'
  lastClose: number | null
  lastCloseDate: string | null
  previousClose: number | null
  historyStart: string | null
  /** Pregões usados nas faixas (até 10 anos). */
  lookbackDays: number
  stale: StaleInfo
  volatilityAdjusted: boolean
  horizons: HorizonProjection[]
  cone: ConePoint[]
  /** Fechamentos dos últimos 12 meses, para o gráfico. */
  history: DailyClose[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Remove pontos inválidos, ordena por data e mantém o último valor de cada data repetida. */
export function sanitizeCloses(input: readonly DailyClose[]): DailyClose[] {
  const byDate = new Map<string, number>()
  for (const point of input) {
    if (!point || typeof point.date !== 'string' || !DATE_RE.test(point.date)) continue
    const close = Number(point.close)
    if (!Number.isFinite(close) || close <= 0) continue
    byDate.set(point.date, close)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, close]) => ({ date, close }))
}

/** Percentil com interpolação linear entre os pontos (mesmo critério do Excel PERCENTIL / R tipo 7). */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN
  const clamped = Math.min(1, Math.max(0, p))
  const index = clamped * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

export function quantilesOf(values: readonly number[]): Quantiles {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    p5: percentile(sorted, 0.05),
    p16: percentile(sorted, 0.16),
    p50: percentile(sorted, 0.5),
    p84: percentile(sorted, 0.84),
    p95: percentile(sorted, 0.95),
  }
}

export function median(values: readonly number[]): number {
  return percentile([...values].sort((a, b) => a - b), 0.5)
}

/** Retornos log de `horizon` pregões em todas as janelas sobrepostas de `values[start..end]`. */
export function horizonLogReturns(values: readonly number[], horizon: number, start = 0, end = values.length - 1): number[] {
  const out: number[] = []
  for (let i = Math.max(0, start); i + horizon <= end; i++) {
    out.push(Math.log(values[i + horizon] / values[i]))
  }
  return out
}

/** Desvio-padrão amostral. */
export function stdev(values: readonly number[]): number {
  const n = values.length
  if (n < 2) return Number.NaN
  const mean = values.reduce((sum, v) => sum + v, 0) / n
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1)
  return Math.sqrt(variance)
}

/**
 * Volatilidade realizada (desvio-padrão dos retornos log diários) dos `window` pregões que terminam em cada índice.
 * `null` enquanto não há `window` retornos.
 */
export function trailingVolatilities(values: readonly number[], window = VOL_WINDOW): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null)
  const returns: number[] = []
  for (let i = 1; i < values.length; i++) returns.push(Math.log(values[i] / values[i - 1]))
  let sum = 0
  let sumSq = 0
  for (let r = 0; r < returns.length; r++) {
    sum += returns[r]
    sumSq += returns[r] ** 2
    if (r >= window) {
      sum -= returns[r - window]
      sumSq -= returns[r - window] ** 2
    }
    if (r >= window - 1) {
      const mean = sum / window
      const variance = Math.max(0, (sumSq - window * mean * mean) / (window - 1))
      // retorno r termina no índice r + 1 dos preços
      out[r + 1] = Math.sqrt(variance)
    }
  }
  return out
}

/** Fator de regime: razão entre a volatilidade atual e a mediana, limitada a [0,7; 1,5]. Sem dado → 1. */
export function volatilityScale(current: number | null, medianVol: number | null): VolatilityScale {
  if (current === null || medianVol === null || !Number.isFinite(current) || !Number.isFinite(medianVol) || medianVol <= 0) {
    return { current, median: medianVol, ratio: null, applied: 1 }
  }
  const ratio = current / medianVol
  return { current, median: medianVol, ratio, applied: Math.min(VOL_SCALE_MAX, Math.max(VOL_SCALE_MIN, ratio)) }
}

/** Amplia ou reduz a dispersão em torno da mediana, mantendo a mediana. */
export function scaleQuantiles(q: Quantiles, factor: number): Quantiles {
  const at = (v: number) => q.p50 + (v - q.p50) * factor
  return { p5: at(q.p5), p16: at(q.p16), p50: q.p50, p84: at(q.p84), p95: at(q.p95) }
}

function mapQuantiles(q: Quantiles, fn: (v: number) => number): Quantiles {
  return { p5: fn(q.p5), p16: fn(q.p16), p50: fn(q.p50), p84: fn(q.p84), p95: fn(q.p95) }
}

export interface EstimateOptions {
  volatilityAdjusted: boolean
  lookback?: number
  minWindows?: number
  /** Volatilidades pré-calculadas (`trailingVolatilities(values)`), para não recalcular no backtest. */
  vols?: ReadonlyArray<number | null>
}

/**
 * Faixa do horizonte usando só os dados até `end` (inclusive): janelas dos `lookback` pregões anteriores.
 * `null` quando há menos de `minWindows` janelas.
 */
export function estimateAt(values: readonly number[], end: number, horizon: number, options: EstimateOptions): HorizonEstimate | null {
  const lookback = options.lookback ?? LOOKBACK_DAYS
  const minWindows = options.minWindows ?? MIN_WINDOWS
  const start = Math.max(0, end - lookback)
  const returns = horizonLogReturns(values, horizon, start, end)
  if (returns.length < minWindows) return null

  const rawLogQuantiles = quantilesOf(returns)
  const positiveShare = returns.filter((r) => r > 0).length / returns.length

  const vols = options.vols ?? trailingVolatilities(values)
  const history: number[] = []
  for (let i = start; i <= end; i++) {
    const v = vols[i]
    if (v !== null && v !== undefined) history.push(v)
  }
  const current = vols[end] ?? null
  const volatility = volatilityScale(current, history.length > 0 ? median(history) : null)
  const logQuantiles = options.volatilityAdjusted ? scaleQuantiles(rawLogQuantiles, volatility.applied) : rawLogQuantiles

  return { logQuantiles, rawLogQuantiles, sampleSize: returns.length, positiveShare, volatility }
}

/** Passo entre datas avaliadas na calibração: sem sobreposição até 1 mês; mensal no horizonte de 12 meses. */
export function calibrationStep(horizon: number): number {
  return Math.min(horizon, 21)
}

function verdictFor(insideProbable: number, insideWide: number, independentPeriods: number): CalibrationVerdict {
  if (independentPeriods < 10) return 'insufficient'
  const probableGap = insideProbable - 0.68
  const wideGap = insideWide - 0.9
  if (Math.abs(probableGap) <= CALIBRATION_TOLERANCE.probable && Math.abs(wideGap) <= CALIBRATION_TOLERANCE.wide) return 'ok'
  return probableGap + wideGap > 0 ? 'too-wide' : 'too-narrow'
}

/**
 * Backtest do método: para cada data passada cujo resultado realizado caiu nos últimos `years` anos, calcula a faixa
 * só com os dados até aquela data e confere se o fechamento `horizon` pregões depois ficou dentro dela.
 * As datas são ancoradas no último fechamento possível e recuam de `calibrationStep(horizon)` em `calibrationStep`.
 */
export function calibrate(
  values: readonly number[],
  horizon: number,
  options: EstimateOptions & { years?: number; minHistory?: number }
): Calibration {
  const years = options.years ?? CALIBRATION_YEARS
  const minHistory = options.minHistory ?? CALIBRATION_MIN_HISTORY
  const vols = options.vols ?? trailingVolatilities(values)
  const last = values.length - 1
  const firstOutcome = last - years * TRADING_DAYS_PER_YEAR
  const step = calibrationStep(horizon)

  let evaluations = 0
  let probable = 0
  let wide = 0
  let above = 0
  let below = 0
  for (let t = last - horizon; t >= 0 && t + horizon >= firstOutcome; t -= step) {
    if (t < minHistory) break
    const estimate = estimateAt(values, t, horizon, { ...options, vols })
    if (!estimate) continue
    const realized = Math.log(values[t + horizon] / values[t])
    const q = estimate.logQuantiles
    evaluations++
    if (realized >= q.p16 && realized <= q.p84) probable++
    if (realized >= q.p5 && realized <= q.p95) wide++
    if (realized > q.p84) above++
    if (realized < q.p16) below++
  }

  const span = Math.min(years * TRADING_DAYS_PER_YEAR, Math.max(0, last - minHistory))
  const independentPeriods = evaluations === 0 ? 0 : Math.max(1, Math.floor(span / horizon))
  if (evaluations === 0) {
    return { evaluations, independentPeriods, insideProbable: null, insideWide: null, aboveProbable: null, belowProbable: null, verdict: 'insufficient' }
  }
  const insideProbable = probable / evaluations
  const insideWide = wide / evaluations
  return {
    evaluations,
    independentPeriods,
    insideProbable,
    insideWide,
    aboveProbable: above / evaluations,
    belowProbable: below / evaluations,
    verdict: verdictFor(insideProbable, insideWide, independentPeriods),
  }
}

/** Dias úteis (segunda a sexta, sem feriados) depois de `from` até `to`, inclusive. Datas YYYY-MM-DD. */
export function weekdaysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T12:00:00Z`)
  const end = Date.parse(`${to}T12:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  let count = 0
  for (let t = start + 86_400_000; t <= end; t += 86_400_000) {
    const day = new Date(t).getUTCDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

/**
 * Atraso do último fechamento em relação à data de referência. `sessionClosed` indica se o pregão de `today`
 * já terminou: antes do fechamento, o próprio dia ainda não conta como pregão em atraso.
 */
export function staleInfo(lastCloseDate: string | null, today: string, sessionClosed: boolean): StaleInfo {
  if (!lastCloseDate) return { isStale: true, tradingDaysSinceClose: Number.POSITIVE_INFINITY }
  let days = weekdaysBetween(lastCloseDate, today)
  const todayIsWeekday = ![0, 6].includes(new Date(`${today}T12:00:00Z`).getUTCDay())
  if (!sessionClosed && todayIsWeekday && days > 0) days -= 1
  return { isStale: days > STALE_AFTER_TRADING_DAYS, tradingDaysSinceClose: days }
}

export interface BuildOptions {
  /** Data de referência (YYYY-MM-DD, Brasília). */
  today: string
  /** Se o pregão de `today` já fechou. */
  sessionClosed: boolean
  volatilityAdjusted?: boolean
}

/** Faixas, calibração e cone a partir dos fechamentos diários. */
export function buildIbovProjection(input: readonly DailyClose[], options: BuildOptions): IbovProjectionCore {
  const closes = sanitizeCloses(input)
  const volatilityAdjusted = options.volatilityAdjusted ?? true
  const values = closes.map((c) => c.close)
  const last = values.length - 1
  const lastPoint = closes[last] ?? null

  const empty = (h: HorizonDefinition): HorizonProjection => ({
    id: h.id,
    label: h.label,
    periodNoun: h.periodNoun,
    tradingDays: h.tradingDays,
    status: 'insufficient',
    sampleSize: 0,
    independentPeriods: 0,
    levels: null,
    returns: null,
    positiveShare: null,
    volatility: null,
    calibration: { evaluations: 0, independentPeriods: 0, insideProbable: null, insideWide: null, aboveProbable: null, belowProbable: null, verdict: 'insufficient' },
  })

  if (!lastPoint) {
    return {
      method: METHOD_ID,
      status: 'no-data',
      lastClose: null,
      lastCloseDate: null,
      previousClose: null,
      historyStart: null,
      lookbackDays: 0,
      stale: staleInfo(null, options.today, options.sessionClosed),
      volatilityAdjusted,
      horizons: HORIZONS.map(empty),
      cone: [],
      history: [],
    }
  }

  const vols = trailingVolatilities(values)
  const estimateOptions: EstimateOptions = { volatilityAdjusted, vols }
  const lastClose = lastPoint.close
  const toLevels = (q: Quantiles) => mapQuantiles(q, (r) => lastClose * Math.exp(r))
  const toReturns = (q: Quantiles) => mapQuantiles(q, (r) => Math.exp(r) - 1)

  const horizons = HORIZONS.map((h): HorizonProjection => {
    const estimate = estimateAt(values, last, h.tradingDays, estimateOptions)
    if (!estimate) return empty(h)
    return {
      id: h.id,
      label: h.label,
      periodNoun: h.periodNoun,
      tradingDays: h.tradingDays,
      status: 'ok',
      sampleSize: estimate.sampleSize,
      independentPeriods: Math.floor((estimate.sampleSize + h.tradingDays - 1) / h.tradingDays),
      levels: toLevels(estimate.logQuantiles),
      returns: toReturns(estimate.logQuantiles),
      positiveShare: estimate.positiveShare,
      volatility: estimate.volatility,
      calibration: calibrate(values, h.tradingDays, estimateOptions),
    }
  })

  const cone: ConePoint[] = []
  for (const offset of CONE_OFFSETS) {
    const estimate = estimateAt(values, last, offset, estimateOptions)
    if (estimate) cone.push({ offset, levels: toLevels(estimate.logQuantiles) })
  }

  return {
    method: METHOD_ID,
    status: 'ok',
    lastClose,
    lastCloseDate: lastPoint.date,
    previousClose: last > 0 ? values[last - 1] : null,
    historyStart: closes[Math.max(0, last - LOOKBACK_DAYS)].date,
    lookbackDays: Math.min(LOOKBACK_DAYS, last),
    stale: staleInfo(lastPoint.date, options.today, options.sessionClosed),
    volatilityAdjusted,
    horizons,
    cone,
    history: closes.slice(-TRADING_DAYS_PER_YEAR - 1),
  }
}
