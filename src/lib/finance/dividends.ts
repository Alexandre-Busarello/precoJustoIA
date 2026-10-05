/**
 * Proventos (dividendos, JCP e rendimentos de FII): funções puras sobre o histórico de `DividendHistory`.
 *
 * Convenções:
 * - valores brutos por ação/cota, em BRL (JCP bruto é o padrão de mercado; use `jcpNet`/`netAmount` para o líquido);
 * - datas comparadas em UTC (as colunas do Prisma são `@db.Date`, meia-noite UTC);
 * - somas arredondadas a 6 casas, a precisão da coluna `amount`.
 */

import { median, normalizeText, roundTo, subtractMonthsUTC, sum, toFiniteNumber } from './utils'

export interface DividendEvent {
  exDate: Date
  paymentDate?: Date | null
  amount: number
  /** Tipo como vem do banco: 'DIVIDENDO', 'JCP', 'RENDIMENTO' ou `null`. */
  type?: string | null
}

/** Linha de `DividendHistory` (ou subconjunto dela) com `amount` em Prisma `Decimal`, string ou number. */
export interface DividendHistoryRow {
  exDate: Date
  paymentDate?: Date | null
  amount: unknown
  type?: string | null
}

function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

/** Converte linhas do Prisma (`Decimal` → number), descartando valores ausentes, ≤ 0 ou datas inválidas. */
export function toDividendEvents(rows: readonly DividendHistoryRow[]): DividendEvent[] {
  const events: DividendEvent[] = []
  for (const row of rows) {
    const amount = toFiniteNumber(row.amount)
    if (amount === null || amount <= 0 || !isValidDate(row.exDate)) continue
    events.push({
      exDate: row.exDate,
      paymentDate: isValidDate(row.paymentDate) ? row.paymentDate : null,
      amount,
      type: row.type ?? null,
    })
  }
  return events
}

function validEvents(events: readonly DividendEvent[]): DividendEvent[] {
  return events.filter((e) => isValidDate(e.exDate) && Number.isFinite(e.amount) && e.amount > 0)
}

function byExDate(a: DividendEvent, b: DividendEvent): number {
  return a.exDate.getTime() - b.exDate.getTime()
}

/** Eventos com data-com na janela `(asOf − 12 meses, asOf]`. */
export function eventsTTM(events: readonly DividendEvent[], asOf: Date = new Date()): DividendEvent[] {
  const start = subtractMonthsUTC(asOf, 12).getTime()
  const end = asOf.getTime()
  return validEvents(events).filter((e) => {
    const t = e.exDate.getTime()
    return t > start && t <= end
  })
}

/**
 * Soma dos proventos (dividendos + JCP brutos) com data-com nos últimos 12 meses.
 * Ex.: 12 pagamentos mensais de R$ 0,10 → R$ 1,20.
 */
export function sumTTM(events: readonly DividendEvent[], asOf: Date = new Date()): number {
  return sum(eventsTTM(events, asOf).map((e) => e.amount))
}

/** Dividend yield TTM como fração (`sumTTM / preço`). `null` sem preço válido ou sem proventos no período. */
export function dividendYieldTTM(events: readonly DividendEvent[], price: number, asOf: Date = new Date()): number | null {
  if (!Number.isFinite(price) || price <= 0) return null
  const total = sumTTM(events, asOf)
  return total > 0 ? total / price : null
}

/** Multiplicador acima da mediana a partir do qual um pagamento é candidato a extraordinário. */
export const EXTRAORDINARY_MULTIPLIER = 2
/** Janela (dias) em torno da mesma data de outro ano usada para reconhecer um pagamento sazonal recorrente. */
export const EXTRAORDINARY_RECURRENCE_WINDOW_DAYS = 45
/** Razão máxima entre dois pagamentos sazonais para considerá-los do mesmo tipo (ex.: 0,35 e 0,19 → 1,8×). */
export const EXTRAORDINARY_RECURRENCE_RATIO = 2.5

export interface RemoveExtraordinaryOptions {
  /** Padrão: `EXTRAORDINARY_MULTIPLIER` (2). */
  multiplier?: number
  /** Padrão: `EXTRAORDINARY_RECURRENCE_WINDOW_DAYS` (45). */
  recurrenceWindowDays?: number
  /** Padrão: `EXTRAORDINARY_RECURRENCE_RATIO` (2,5). */
  recurrenceRatio?: number
}

const DAY_MS = 86_400_000
const YEAR_DAYS = 365.25

/** `other` cai perto da mesma data de `event` em outro ano (±janela), com valor de ordem de grandeza parecida. */
function isSeasonalMatch(event: DividendEvent, other: DividendEvent, windowDays: number, ratio: number): boolean {
  if (other === event) return false
  const diffDays = Math.abs(other.exDate.getTime() - event.exDate.getTime()) / DAY_MS
  const years = Math.round(diffDays / YEAR_DAYS)
  if (years < 1 || Math.abs(diffDays - years * YEAR_DAYS) > windowDays) return false
  return other.amount * ratio >= event.amount && other.amount <= event.amount * ratio
}

/**
 * Remove pagamentos extraordinários. Um pagamento é candidato quando passa de 2× a mediana de todos os pagamentos
 * informados; o candidato só é descartado quando não se repete: nenhum outro ano tem um pagamento perto da mesma data
 * (±45 dias) com valor parecido (até 2,5× de diferença).
 *
 * A checagem de recorrência evita cortar os dividendos trimestrais/semestrais regulares de quem também paga JCP e
 * dividendos mensais pequenos (bancos: a mediana fica baixa e o trimestral regular passa de 2× ela). Por isso, passe o
 * histórico de vários anos, não só a janela de 12 meses: sem anos anteriores não há como reconhecer a recorrência.
 */
export function removeExtraordinary(events: readonly DividendEvent[], options: RemoveExtraordinaryOptions = {}): DividendEvent[] {
  const {
    multiplier = EXTRAORDINARY_MULTIPLIER,
    recurrenceWindowDays = EXTRAORDINARY_RECURRENCE_WINDOW_DAYS,
    recurrenceRatio = EXTRAORDINARY_RECURRENCE_RATIO,
  } = options
  const valid = validEvents(events)
  const med = median(valid.map((e) => e.amount))
  if (med === null) return []
  const threshold = med * multiplier
  return valid.filter(
    (e) => e.amount <= threshold || valid.some((other) => isSeasonalMatch(e, other, recurrenceWindowDays, recurrenceRatio)),
  )
}

/** Pagamentos que `removeExtraordinary` descartaria (mesmos critérios). */
export function extraordinaryEvents(events: readonly DividendEvent[], options: RemoveExtraordinaryOptions = {}): DividendEvent[] {
  const kept = new Set(removeExtraordinary(events, options))
  return validEvents(events).filter((e) => !kept.has(e))
}

export interface FullYearsOptions {
  /** Quantidade de anos-calendário completos (N−1 … N−years). Padrão: 5. */
  years?: number
  /** Data de referência; o ano dela (N) é parcial e nunca entra. Padrão: agora. */
  asOf?: Date
  /**
   * Início conhecido da cobertura do histórico. Quando informado, o ano dele só conta se a cobertura começa em 1º de janeiro.
   * Sem ele, o primeiro ano com proventos é parcial quando o primeiro pagamento dele cai depois do mês em que os anos
   * seguintes costumam começar a pagar (mediana do mês do primeiro pagamento de cada ano seguinte).
   */
  coverageStart?: Date | null
}

export interface YearTotal {
  year: number
  total: number
  payments: number
}

/**
 * Totais por ano-calendário completo, do mais antigo ao mais recente. Exclui o ano corrente (parcial) e o primeiro ano
 * de cobertura quando parcial. Anos cobertos sem pagamento entram com total 0.
 */
export function fullYearTotals(events: readonly DividendEvent[], options: FullYearsOptions = {}): YearTotal[] {
  const { years = 5, asOf = new Date(), coverageStart = null } = options
  const currentYear = asOf.getUTCFullYear()
  const valid = validEvents(events).filter((e) => e.exDate.getTime() <= asOf.getTime())
  if (valid.length === 0 || years <= 0) return []

  const totals = new Map<number, YearTotal>()
  /** Mês (0–11) do primeiro pagamento de cada ano. */
  const firstMonthByYear = new Map<number, number>()
  for (const e of valid) {
    const year = e.exDate.getUTCFullYear()
    const entry = totals.get(year) ?? { year, total: 0, payments: 0 }
    entry.total += e.amount
    entry.payments += 1
    totals.set(year, entry)
    const month = e.exDate.getUTCMonth()
    firstMonthByYear.set(year, Math.min(month, firstMonthByYear.get(year) ?? month))
  }

  const firstEventYear = Math.min(...valid.map((e) => e.exDate.getUTCFullYear()))
  const firstYear = coverageStart ? coverageStart.getUTCFullYear() : firstEventYear

  let firstYearPartial: boolean
  if (coverageStart) {
    firstYearPartial = coverageStart.getTime() > Date.UTC(firstYear, 0, 1)
  } else {
    const laterFirstMonths: number[] = []
    for (let y = firstYear + 1; y < currentYear; y++) {
      const month = firstMonthByYear.get(y)
      if (month !== undefined) laterFirstMonths.push(month)
    }
    const typicalFirstMonth = median(laterFirstMonths)
    const firstMonth = firstMonthByYear.get(firstYear)
    firstYearPartial = typicalFirstMonth !== null && firstMonth !== undefined && firstMonth > typicalFirstMonth
  }

  const result: YearTotal[] = []
  for (let y = currentYear - years; y <= currentYear - 1; y++) {
    if (y < firstYear || (y === firstYear && firstYearPartial)) continue
    const entry = totals.get(y)
    result.push({ year: y, total: roundTo(entry?.total ?? 0), payments: entry?.payments ?? 0 })
  }
  return result
}

/**
 * Média anual dos proventos nos anos-calendário completos N−1 … N−years (ver `fullYearTotals`).
 * `null` quando não há nenhum ano completo coberto.
 */
export function averageFullYears(events: readonly DividendEvent[], options: FullYearsOptions = {}): number | null {
  const totals = fullYearTotals(events, options)
  if (totals.length === 0) return null
  return roundTo(totals.reduce((acc, t) => acc + t.total, 0) / totals.length)
}

/** A partir de quantos meses sem pagamento o histórico é considerado desatualizado para anualizar. */
export const STALE_DIVIDEND_MONTHS = 18

export interface AnnualizeOptions {
  /** Data de referência. Quando informada, histórico sem pagamento há mais de `staleMonths` meses não é anualizado. */
  asOf?: Date
  /** Padrão: `STALE_DIVIDEND_MONTHS` (18). */
  staleMonths?: number
}

export interface AnnualizedDividends {
  /** Proventos anualizados, ou `null` (menos de 2 datas-com, frequência indeterminável ou histórico desatualizado). */
  annual: number | null
  /** Pagamentos por ano inferidos (1 a 12), ou `null`. */
  frequency: number | null
  /** Último pagamento mais antigo que `staleMonths` em relação a `asOf`. */
  stale: boolean
  /** Data-com mais recente considerada. */
  lastExDate: Date | null
}

/**
 * Agrupa eventos com a mesma data-com (ex.: dividendo e JCP declarados juntos) em um único pagamento,
 * para que a frequência não seja distorcida por intervalos de zero dias.
 */
function groupByExDate(events: readonly DividendEvent[]): DividendEvent[] {
  const byDay = new Map<number, DividendEvent>()
  for (const e of validEvents(events)) {
    const day = Date.UTC(e.exDate.getUTCFullYear(), e.exDate.getUTCMonth(), e.exDate.getUTCDate())
    const current = byDay.get(day)
    byDay.set(day, current ? { ...current, amount: current.amount + e.amount } : { ...e })
  }
  return [...byDay.values()].sort(byExDate)
}

/**
 * Detalhes da anualização pelos (até) 12 pagamentos mais recentes (ver `annualizeFromLast12`), incluindo a frequência
 * inferida e a marcação de histórico desatualizado.
 */
export function annualizeLast12Details(events: readonly DividendEvent[], options: AnnualizeOptions = {}): AnnualizedDividends {
  const { asOf, staleMonths = STALE_DIVIDEND_MONTHS } = options
  const grouped = groupByExDate(events).filter((e) => !asOf || e.exDate.getTime() <= asOf.getTime())
  const lastExDate = grouped.length > 0 ? grouped[grouped.length - 1].exDate : null
  const stale = !!asOf && !!lastExDate && lastExDate.getTime() < subtractMonthsUTC(asOf, staleMonths).getTime()
  const empty: AnnualizedDividends = { annual: null, frequency: null, stale, lastExDate }

  const last = grouped.slice(-12)
  if (stale || last.length < 2) return empty
  const gapsInDays: number[] = []
  for (let i = 1; i < last.length; i++) {
    gapsInDays.push((last[i].exDate.getTime() - last[i - 1].exDate.getTime()) / 86_400_000)
  }
  const medianGap = median(gapsInDays)
  if (medianGap === null || medianGap <= 0) return empty
  const frequency = Math.min(12, Math.max(1, Math.round(365.25 / medianGap)))
  const averagePayment = last.reduce((acc, e) => acc + e.amount, 0) / last.length
  return { annual: roundTo(averagePayment * frequency), frequency, stale, lastExDate }
}

/**
 * Proventos anualizados a partir dos (até) 12 pagamentos mais recentes: valor médio por data-com × frequência anual,
 * inferida pela mediana do intervalo entre datas-com (mensal → 12, trimestral → 4 …). Eventos na mesma data-com
 * (dividendo + JCP) contam como um pagamento. Pensado para FIIs mensais: 12 rendimentos de R$ 0,10 → R$ 1,20.
 * `null` com menos de 2 datas-com ou, quando `asOf` é informado, se o último pagamento tem mais de 18 meses.
 */
export function annualizeFromLast12(events: readonly DividendEvent[], options: AnnualizeOptions = {}): number | null {
  return annualizeLast12Details(events, options).annual
}

/** Alíquota de IRRF sobre JCP: 15% até 31/12/2025. */
export const JCP_IRRF_RATE_UNTIL_2025 = 0.15
/** Alíquota de IRRF sobre JCP: 17,5% a partir de 01/01/2026. */
export const JCP_IRRF_RATE_FROM_2026 = 0.175
const JCP_RATE_CHANGE = Date.UTC(2026, 0, 1)

/** Alíquota de IRRF do JCP vigente na data (use a data-com ou a de pagamento, conforme a regra aplicada). */
export function jcpIrrfRate(date: Date): number {
  return date.getTime() >= JCP_RATE_CHANGE ? JCP_IRRF_RATE_FROM_2026 : JCP_IRRF_RATE_UNTIL_2025
}

/** JCP líquido de IRRF: 17,5% a partir de 2026, 15% antes. */
export function jcpNet(amount: number, date: Date): number {
  return roundTo(amount * (1 - jcpIrrfRate(date)))
}

/** `true` quando o tipo indica juros sobre capital próprio ('JCP', 'JSCP', 'Juros sobre Capital Próprio' …). */
export function isJcp(type: string | null | undefined): boolean {
  const t = normalizeText(type)
  if (!t) return false
  return /\bj\.?s?\.?c\.?p\b/.test(t) || t.includes('juros') || t.includes('interest on capital')
}

/** Valor líquido do evento: JCP descontado do IRRF (pela data-com); dividendos e rendimentos ficam como estão. */
export function netAmount(event: DividendEvent): number {
  return isJcp(event.type) ? jcpNet(event.amount, event.exDate) : event.amount
}

export interface SeasonalProjection {
  /** Mês projetado, `YYYY-MM`. */
  month: string
  /** Data-com estimada: dia mediano das datas-com históricas daquele mês. */
  exDate: Date
  /** Valor mediano do mês nos anos em que houve pagamento. */
  amount: number
  /** Em quantos dos últimos 3 anos houve data-com nesse mês (2 ou 3). */
  occurrences: number
  /** Tipo mais frequente naquele mês, ou `null`. */
  type: string | null
}

const SEASONAL_LOOKBACK_YEARS = 3
const SEASONAL_MIN_OCCURRENCES = 2

function mostFrequent(values: readonly (string | null)[]): string | null {
  const counts = new Map<string | null, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: string | null = null
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value !== null && (best === null || value < best))) {
      best = value
      bestCount = count
    }
  }
  return best
}

/**
 * Projeção estatística e determinística de proventos para os `monthsAhead` meses seguintes ao mês de `asOf`
 * (o mês corrente não entra). Olha as três janelas de 12 meses anteriores a `asOf`; um mês-calendário é projetado
 * quando teve data-com em pelo menos 2 delas, com o valor mediano daquele mês. É uma estimativa, não um anúncio.
 */
export function projectSeasonal(events: readonly DividendEvent[], asOf: Date, monthsAhead = 12): SeasonalProjection[] {
  interface MonthStats { sums: number[]; days: number[]; types: (string | null)[] }
  const byMonth = new Map<number, MonthStats>()
  const valid = validEvents(events)

  for (let w = 0; w < SEASONAL_LOOKBACK_YEARS; w++) {
    const start = subtractMonthsUTC(asOf, 12 * (w + 1)).getTime()
    const end = subtractMonthsUTC(asOf, 12 * w).getTime()
    const windowSums = new Map<number, number>()
    for (const e of valid) {
      const t = e.exDate.getTime()
      if (t <= start || t > end) continue
      const month = e.exDate.getUTCMonth()
      windowSums.set(month, (windowSums.get(month) ?? 0) + e.amount)
      const stats = byMonth.get(month) ?? { sums: [], days: [], types: [] }
      stats.days.push(e.exDate.getUTCDate())
      stats.types.push(e.type ?? null)
      byMonth.set(month, stats)
    }
    for (const [month, total] of windowSums) byMonth.get(month)?.sums.push(total)
  }

  const projections: SeasonalProjection[] = []
  for (let k = 1; k <= monthsAhead; k++) {
    const target = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + k, 1))
    const month = target.getUTCMonth()
    const stats = byMonth.get(month)
    if (!stats || stats.sums.length < SEASONAL_MIN_OCCURRENCES) continue
    const year = target.getUTCFullYear()
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const day = Math.min(lastDay, Math.round(median(stats.days) ?? 1))
    projections.push({
      month: `${year}-${String(month + 1).padStart(2, '0')}`,
      exDate: new Date(Date.UTC(year, month, day)),
      amount: roundTo(median(stats.sums) ?? 0),
      occurrences: stats.sums.length,
      type: mostFrequent(stats.types),
    })
  }
  return projections
}
