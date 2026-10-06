/**
 * Modelo de dados do radar de dividendos: janela de meses e eventos (confirmados e projetados) por mês.
 * Funções puras, usadas pela grade do radar e pela página do ativo.
 */

export interface ConfirmedDividendInput {
  month: number
  year: number
  exDate: Date | string
  amount: number
  paymentDate?: Date | string | null
  type?: string | null
}

export interface ProjectedDividendInput {
  month: number
  year: number
  projectedExDate: string
  projectedAmount: number
  confidence: number
}

export interface DividendEvent {
  kind: 'confirmed' | 'projected'
  /** Data ex como ISO (date-only em UTC). */
  exDate: string
  paymentDate: string | null
  amount: number
  type: string | null
  /** Confiança do modelo (0–100), só em projeções. */
  confidence: number | null
}

export interface DividendMonth {
  key: string
  month: number
  year: number
  isCurrent: boolean
  isPast: boolean
  /** Eventos do mês, confirmados primeiro, em ordem de data. */
  events: DividendEvent[]
}

export const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const

/** Abreviação de 3 letras ("set"). */
export function monthShort(month: number): string {
  return MONTH_NAMES[month - 1]?.slice(0, 3) ?? ''
}

/** "Setembro de 2026". */
export function monthLabel(month: number, year: number): string {
  const name = MONTH_NAMES[month - 1] ?? ''
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${year}`
}

/** Janela padrão do calendário: 4 meses passados (o que a API traz de histórico), o mês atual e 7 à frente = 12 meses. */
export const DEFAULT_MONTH_WINDOW = { past: 4, future: 7 } as const

/** Meses à frente no calendário para o período escolhido (3, 6 ou 12 meses de projeções): no máximo o da janela padrão. */
export function monthsAheadForPeriod(period: string | number | undefined): number {
  const months = Number(period)
  if (!Number.isFinite(months) || months <= 0) return DEFAULT_MONTH_WINDOW.future
  return Math.min(Math.round(months), DEFAULT_MONTH_WINDOW.future)
}

/** Meses exibidos: `past` meses anteriores, o mês atual e `future` meses seguintes. */
export function buildMonthWindow(
  now: Date,
  { past = DEFAULT_MONTH_WINDOW.past, future = DEFAULT_MONTH_WINDOW.future }: { past?: number; future?: number } = {}
): Array<{ key: string; month: number; year: number; isCurrent: boolean; isPast: boolean }> {
  const months = []
  for (let offset = -past; offset <= future; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const month = date.getMonth() + 1
    const year = date.getFullYear()
    months.push({ key: monthKey(year, month), month, year, isCurrent: offset === 0, isPast: offset < 0 })
  }
  return months
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toEvents(
  confirmed: ConfirmedDividendInput[] = [],
  projected: ProjectedDividendInput[] = []
): Array<DividendEvent & { key: string }> {
  const events: Array<DividendEvent & { key: string }> = []
  for (const item of confirmed) {
    const exDate = toIso(item.exDate)
    if (!exDate || !Number.isFinite(item.amount)) continue
    // Datas `@db.Date` chegam como meia-noite UTC: o mês vem da data em UTC (o `month` da API usa o fuso do servidor).
    const date = new Date(exDate)
    events.push({
      key: monthKey(date.getUTCFullYear(), date.getUTCMonth() + 1),
      kind: 'confirmed',
      exDate,
      paymentDate: toIso(item.paymentDate),
      amount: item.amount,
      type: item.type ?? null,
      confidence: null,
    })
  }
  for (const item of projected) {
    const exDate = toIso(item.projectedExDate)
    if (!exDate || !Number.isFinite(item.projectedAmount)) continue
    events.push({
      key: monthKey(item.year, item.month),
      kind: 'projected',
      exDate,
      paymentDate: null,
      amount: item.projectedAmount,
      type: null,
      confidence: Number.isFinite(item.confidence) ? item.confidence : null,
    })
  }
  return events
}

function todayIso(now: Date): string {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString()
}

/**
 * Concilia confirmados e projetados: descarta a projeção de um mês que já tem provento confirmado
 * (a projeção era a estimativa desse provento) e a projeção cuja data ex estimada já passou.
 * Assim um total com estimativa nunca aparece sob o ponto de "confirmado".
 */
function reconcileEvents<E extends DividendEvent & { key: string }>(events: E[], now: Date): E[] {
  const confirmedMonths = new Set(events.filter((e) => e.kind === 'confirmed').map((e) => e.key))
  const today = todayIso(now)
  return events.filter((e) => e.kind === 'confirmed' || (!confirmedMonths.has(e.key) && e.exDate >= today))
}

function withoutKey({ kind, exDate, paymentDate, amount, type, confidence }: DividendEvent & { key: string }): DividendEvent {
  return { kind, exDate, paymentDate, amount, type, confidence }
}

function compareEvents(a: DividendEvent, b: DividendEvent): number {
  if (a.kind !== b.kind) return a.kind === 'confirmed' ? -1 : 1
  return a.exDate.localeCompare(b.exDate)
}

/**
 * Agrupa os eventos nos meses da janela. Um mês com provento confirmado mostra só os confirmados;
 * projeções vencidas (data ex estimada antes de hoje) são descartadas.
 */
export function buildDividendMonths(
  confirmed: ConfirmedDividendInput[] | undefined,
  projected: ProjectedDividendInput[] | undefined,
  now: Date = new Date(),
  window: { past?: number; future?: number } = {}
): DividendMonth[] {
  const byMonth = new Map<string, DividendEvent[]>()
  for (const event of reconcileEvents(toEvents(confirmed, projected), now)) {
    const list = byMonth.get(event.key) ?? []
    list.push(withoutKey(event))
    byMonth.set(event.key, list)
  }
  return buildMonthWindow(now, window).map((month) => ({
    ...month,
    events: (byMonth.get(month.key) ?? []).sort(compareEvents),
  }))
}

/** Estado do ponto do mês: confirmado (sólido) prevalece sobre projetado (vazado). */
export function monthDotState(month: Pick<DividendMonth, 'events'>): 'confirmed' | 'projected' | 'none' {
  if (month.events.some((e) => e.kind === 'confirmed')) return 'confirmed'
  if (month.events.length > 0) return 'projected'
  return 'none'
}

/**
 * Valor por ação do mês, do mesmo tipo do ponto: num mês confirmado soma só os confirmados
 * (nunca mistura estimativa com valor anunciado).
 */
export function monthTotal(month: Pick<DividendMonth, 'events'>): number | null {
  const state = monthDotState(month)
  if (state === 'none') return null
  return month.events.filter((e) => e.kind === state).reduce((sum, e) => sum + e.amount, 0)
}

/** Todos os eventos conciliados (sem projeções vencidas ou já confirmadas), do mais recente ao mais antigo, para tabelas. */
export function flattenEvents(
  confirmed: ConfirmedDividendInput[] | undefined,
  projected: ProjectedDividendInput[] | undefined,
  now: Date = new Date()
): DividendEvent[] {
  return reconcileEvents(toEvents(confirmed, projected), now)
    .map(withoutKey)
    .sort((a, b) => b.exDate.localeCompare(a.exDate))
}

/** Soma do valor por ação dos confirmados com data ex nos últimos 12 meses. */
export function trailingTwelveMonthsTotal(confirmed: ConfirmedDividendInput[] | undefined, now: Date = new Date()): number | null {
  if (!confirmed || confirmed.length === 0) return null
  const start = new Date(now)
  start.setFullYear(start.getFullYear() - 1)
  let total = 0
  let count = 0
  for (const item of confirmed) {
    const iso = toIso(item.exDate)
    if (!iso) continue
    const date = new Date(iso)
    if (date > start && date <= now && Number.isFinite(item.amount)) {
      total += item.amount
      count++
    }
  }
  return count > 0 ? total : null
}

/**
 * Próxima data ex a partir de hoje (inclusive): um provento já anunciado (confirmado) ou, na falta dele, uma projeção.
 * Em datas iguais, o confirmado vem primeiro.
 */
export function nextExDateEvent(
  confirmed: ConfirmedDividendInput[] | undefined,
  projected: ProjectedDividendInput[] | undefined,
  now: Date = new Date()
): DividendEvent | null {
  const today = todayIso(now)
  const upcoming = reconcileEvents(toEvents(confirmed, projected), now)
    .map(withoutKey)
    .filter((e) => e.exDate >= today)
    .sort((a, b) => a.exDate.localeCompare(b.exDate) || (a.kind === b.kind ? 0 : a.kind === 'confirmed' ? -1 : 1))
  return upcoming[0] ?? null
}

const dateOnlyFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/**
 * Data sem horário (colunas `@db.Date` chegam como meia-noite UTC): formata em UTC para não voltar um dia no fuso de Brasília.
 * `formatDateOnly('2026-08-15T00:00:00.000Z')` → `15 ago. 2026`.
 */
export function formatDateOnly(value: string | Date | null | undefined): string {
  const iso = toIso(value)
  if (!iso) return '—'
  const parts = dateOnlyFormat.formatToParts(new Date(iso))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')} ${get('month')} ${get('year')}`
}

/** Casas decimais para valor por ação: 4 abaixo de R$ 1 (proventos costumam ter frações de centavo), 2 acima. */
export function perShareDigits(amount: number): number {
  return Math.abs(amount) < 1 ? 4 : 2
}
