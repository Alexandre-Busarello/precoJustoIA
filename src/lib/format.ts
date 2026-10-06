/**
 * Formatação numérica e de datas em pt-BR — fonte única de verdade da UI.
 *
 * Regras:
 * - Negativos usam sempre o sinal U+2212 (`−`), inclusive no BRL: `−R$ 500,00`.
 * - Toda função aceita `null`/`undefined`/`NaN`/`Infinity` e devolve `—` (travessão), nunca "N/A" ou "R$ " vazio.
 * - Percentuais recebem **fração** (0,126 = 12,6%). Se o dado vier em pontos percentuais (12,6), divida por 100 antes.
 * - Use sempre com `tabular-nums` (ou dentro de `table`/`[data-num]`, que já aplicam o recurso globalmente).
 */

export const EMPTY_VALUE = '—'
const MINUS = '−'
const LOCALE = 'pt-BR'
const TIME_ZONE = 'America/Sao_Paulo'

type Maybe<T> = T | null | undefined

function isFiniteNumber(value: Maybe<number>): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

const numberFormatCache = new Map<string, Intl.NumberFormat>()
function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options)
  let fmt = numberFormatCache.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE, options)
    numberFormatCache.set(key, fmt)
  }
  return fmt
}

/** Formata com Intl e troca o hífen de negativo por U+2212, para o sinal ser igual em todas as funções. */
function formatIntl(options: Intl.NumberFormatOptions, value: number): string {
  return numberFormat(options).format(value).replace('-', MINUS)
}

/** Evita "-0,0%" quando o valor arredondado é zero. */
function normalizeZero(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(Math.abs(value) * factor) === 0 ? 0 : value
}

/** `formatBRL(48.56)` → `R$ 48,56`. */
export function formatBRL(value: Maybe<number>, { digits = 2 }: { digits?: number } = {}): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE
  return formatIntl(
    { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits },
    normalizeZero(value, digits)
  )
}

const COMPACT_STEPS: Array<{ limit: number; suffix: string }> = [
  { limit: 1e12, suffix: 'tri' },
  { limit: 1e9, suffix: 'bi' },
  { limit: 1e6, suffix: 'mi' },
]

/** Número compacto com sufixo pt-BR: `formatCompact(625_680_000_000)` → `625,7 bi`. Abaixo de 1 milhão usa o número inteiro. */
export function formatCompact(value: Maybe<number>, { digits = 1 }: { digits?: number } = {}): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE
  const abs = Math.abs(value)
  let index = COMPACT_STEPS.findIndex((s) => abs >= s.limit)
  // 999.999,6 arredonda para 1.000.000: nesse caso já usa o sufixo `mi`.
  if (index === -1 && Math.round(abs) >= 1e6) index = COMPACT_STEPS.length - 1
  if (index === -1) return formatNumber(value, { digits: 0 })
  // Sobe de sufixo quando o arredondamento chega a 1.000: 999.950.000 vira `1,0 bi`, não `1.000,0 mi`.
  const factor = 10 ** digits
  if (index > 0 && Math.round((abs / COMPACT_STEPS[index].limit) * factor) / factor >= 1000) index -= 1
  const step = COMPACT_STEPS[index]
  const scaled = numberFormat({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(abs / step.limit)
  return `${value < 0 ? MINUS : ''}${scaled} ${step.suffix}`
}

/** `formatBRLCompact(625_680_000_000)` → `R$ 625,7 bi` (mi/bi/tri). Abaixo de 1 milhão equivale a `formatBRL`. */
export function formatBRLCompact(value: Maybe<number>, { digits = 1 }: { digits?: number } = {}): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE
  // Abaixo de 1 milhão usa BRL cheio, a menos que o arredondamento em centavos chegue a 1.000.000,00.
  if (Math.round(Math.abs(value) * 100) < 1e8) return formatBRL(value)
  const compact = formatCompact(Math.abs(value), { digits })
  return `${value < 0 ? MINUS : ''}R$ ${compact}`
}

/** `formatPct(0.126)` → `12,6%`. Recebe **fração**. */
export function formatPct(fraction: Maybe<number>, { digits = 1 }: { digits?: number } = {}): string {
  if (!isFiniteNumber(fraction)) return EMPTY_VALUE
  return formatIntl(
    { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits },
    normalizeZero(fraction * 100, digits) / 100
  )
}

/** `formatDeltaPct(-0.2159)` → `−21,6%`; `formatDeltaPct(0.05)` → `+5,0%`. Sempre com sinal (U+2212 para negativo), exceto zero. */
export function formatDeltaPct(fraction: Maybe<number>, { digits = 1 }: { digits?: number } = {}): string {
  if (!isFiniteNumber(fraction)) return EMPTY_VALUE
  const normalized = normalizeZero(fraction * 100, digits) / 100
  const body = formatPct(Math.abs(normalized), { digits })
  if (normalized > 0) return `+${body}`
  if (normalized < 0) return `${MINUS}${body}`
  return body
}

/** `formatMultiple(10.82)` → `10,8x` (P/L, P/VP, EV/EBITDA...). */
export function formatMultiple(value: Maybe<number>, { digits = 1 }: { digits?: number } = {}): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE
  return `${formatIntl({ minimumFractionDigits: digits, maximumFractionDigits: digits }, normalizeZero(value, digits))}x`
}

/**
 * Número simples em pt-BR. Com `digits`, fixa as casas; sem, usa até 2 casas.
 * `formatNumber(1234.5)` → `1.234,5`; `formatNumber(1234.5, { digits: 2 })` → `1.234,50`.
 */
export function formatNumber(value: Maybe<number>, { digits }: { digits?: number } = {}): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE
  const options: Intl.NumberFormatOptions =
    digits === undefined ? { maximumFractionDigits: 2 } : { minimumFractionDigits: digits, maximumFractionDigits: digits }
  return formatIntl(options, normalizeZero(value, digits ?? 2))
}

type DateInput = Date | string | number

function toDate(value: Maybe<DateInput>): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const dateParts = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE })
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIME_ZONE })
const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })

function shortDate(d: Date): string {
  const parts = dateParts.formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')} ${get('month')} ${get('year')}`
}

const RELATIVE_STEPS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: 365 * 24 * 3600 },
  { unit: 'month', seconds: 30 * 24 * 3600 },
  { unit: 'day', seconds: 24 * 3600 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
]

function relativeDate(d: Date, now: Date): string {
  const diffSeconds = (d.getTime() - now.getTime()) / 1000
  const abs = Math.abs(diffSeconds)
  if (abs < 60) return 'agora'
  const step = RELATIVE_STEPS.find((s) => abs >= s.seconds) ?? RELATIVE_STEPS[RELATIVE_STEPS.length - 1]
  const amount = Math.trunc(diffSeconds / step.seconds)
  return relativeFormat.format(amount, step.unit)
}

export type DateStyle = 'short' | 'datetime' | 'relative'

/**
 * Datas no fuso de Brasília.
 * - `short` (padrão): `29 set. 2026`
 * - `datetime`: `29 set. 2026, 13:00`
 * - `relative`: `há 5 dias`, `ontem`, `em 2 horas`, `agora` (`now` opcional para testes)
 */
export function formatDate(value: Maybe<DateInput>, { style = 'short', now }: { style?: DateStyle; now?: DateInput } = {}): string {
  const d = toDate(value)
  if (!d) return EMPTY_VALUE
  if (style === 'relative') return relativeDate(d, toDate(now) ?? new Date())
  if (style === 'datetime') return `${shortDate(d)}, ${timeFormat.format(d)}`
  return shortDate(d)
}

/** `formatNullable(null, formatBRL)` → `—`; caso contrário aplica `fn`. */
export function formatNullable<T>(value: T | null | undefined, fn: (value: T) => string): string {
  if (value === null || value === undefined) return EMPTY_VALUE
  if (typeof value === 'number' && !Number.isFinite(value)) return EMPTY_VALUE
  return fn(value)
}
