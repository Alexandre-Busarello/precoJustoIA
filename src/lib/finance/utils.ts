/**
 * Utilitários numéricos compartilhados pelos helpers de `src/lib/finance`. Puros, sem dependências de servidor.
 */

type Maybe<T> = T | null | undefined

/** Converte number, string ou Prisma `Decimal` (via `valueOf`/`toString`) em número finito; senão `null`. */
export function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** `true` para número finito. */
export function isFiniteNumber(value: Maybe<number>): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** `true` para número finito e > 0. */
export function isPositiveNumber(value: Maybe<number>): value is number {
  return isFiniteNumber(value) && value > 0
}

/** Arredonda para `decimals` casas, eliminando ruído de ponto flutuante (0,1 × 12 → 1,2). */
export function roundTo(value: number, decimals = 6): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** Mediana de uma lista; `null` se vazia. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Soma arredondada a 6 casas (a precisão de `DividendHistory.amount`). */
export function sum(values: readonly number[]): number {
  return roundTo(values.reduce((acc, v) => acc + v, 0))
}

/** Minúsculas, sem acentos e com espaços normalizados, para comparações por dicionário. */
export function normalizeText(value: Maybe<string>): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Mesmo instante, `months` meses antes (em UTC). Dia 31 que não existe no mês de destino cai no último dia do mês. */
export function subtractMonthsUTC(date: Date, months: number): Date {
  const result = new Date(date.getTime())
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() - months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}
