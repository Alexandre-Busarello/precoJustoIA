/**
 * Métricas de valuation usadas em toda a UI. Fonte única para evitar fórmulas divergentes entre telas.
 *
 * - Margem de segurança = 1 − preço / preço justo (fração). PJ 100, preço 75 → 0,25.
 * - Upside = preço justo / preço − 1 (fração). PJ 100, preço 75 → 0,3333.
 */

type Maybe<T> = T | null | undefined

function isPositive(value: Maybe<number>): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** Margem de segurança como fração (`1 − price / fair`). `null` quando algum valor é ausente ou ≤ 0. */
export function marginOfSafety(price: Maybe<number>, fair: Maybe<number>): number | null {
  if (!isPositive(price) || !isPositive(fair)) return null
  return 1 - price / fair
}

/** Upside como fração (`fair / price − 1`). `null` quando algum valor é ausente ou ≤ 0. */
export function upside(price: Maybe<number>, fair: Maybe<number>): number | null {
  if (!isPositive(price) || !isPositive(fair)) return null
  return fair / price - 1
}

export type ValuationStatus = 'below' | 'within' | 'above'

/** Faixa (em fração de margem) considerada "dentro da faixa estimada". */
export const VALUATION_WITHIN_BAND = 0.05

export const VALUATION_STATUS_LABEL: Record<ValuationStatus, string> = {
  below: 'Abaixo do preço justo',
  within: 'Dentro da faixa estimada',
  above: 'Acima do preço justo',
}

/** Variante de Badge/cor semântica sugerida para cada status. */
export const VALUATION_STATUS_TONE: Record<ValuationStatus, 'positive' | 'warning' | 'negative'> = {
  below: 'positive',
  within: 'warning',
  above: 'negative',
}

/**
 * Status a partir da margem de segurança (fração):
 * `|margem| < 5%` → `within`; margem positiva → `below` (preço abaixo do justo); negativa → `above`.
 * A comparação usa a margem arredondada como é exibida (1 casa em %): 4,99% aparece como `5,0%` e já fica fora da faixa.
 */
export function valuationStatus(margin: Maybe<number>): ValuationStatus | null {
  if (typeof margin !== 'number' || !Number.isFinite(margin)) return null
  const shown = Math.round(Math.abs(margin) * 1000) / 1000
  if (shown < VALUATION_WITHIN_BAND) return 'within'
  return margin > 0 ? 'below' : 'above'
}

/** Rótulo pt-BR do status, ou `null` sem margem. */
export function valuationStatusLabel(margin: Maybe<number>): string | null {
  const status = valuationStatus(margin)
  return status ? VALUATION_STATUS_LABEL[status] : null
}
