import 'server-only'

/**
 * Liquidez: volume financeiro médio diário (R$/dia) calculado no banco, com cache em memória de 1 hora.
 * Fonte primária: `HistoricalPrice` diário (fechamento × volume) dos últimos pregões; fallback:
 * `PriceOscillations.tradedVolumePerDay` mais recente. Regras puras (limites, `isIlliquid`) em `./liquidity-rules`.
 */

import { prisma } from '@/lib/prisma'
import { toFiniteNumber } from './utils'

export { LIQUIDITY_DEFAULTS, isIlliquid, toLiquidityAssetType, type LiquidityAssetType } from './liquidity-rules'

export type LiquiditySource = 'historical_prices' | 'price_oscillations'

export interface AverageDailyTradedValue {
  companyId: number
  /** Volume financeiro médio diário em R$, ou `null` sem dado em nenhuma fonte. */
  value: number | null
  /** Pregões usados na média (0 quando veio do fallback ou não há dado). */
  days: number
  source: LiquiditySource | null
}

export interface AverageDailyTradedValueOptions {
  /** Mínimo de pregões com volume para aceitar a média de `HistoricalPrice`. Padrão: 21. */
  minDays?: number
  /** Máximo de pregões mais recentes considerados. Padrão: 60. */
  maxDays?: number
}

const CACHE_TTL_MS = 60 * 60 * 1000
const cache = new Map<string, { data: AverageDailyTradedValue; expiresAt: number }>()

function cacheKey(companyId: number, minDays: number, maxDays: number): string {
  return `${companyId}:${minDays}:${maxDays}`
}

/** Limpa o cache em memória (útil em testes e após atualizar preços). */
export function clearLiquidityCache(): void {
  cache.clear()
}

interface HistoricalRow {
  company_id: number
  avg_value: number | null
  days: number
}

/**
 * Volume financeiro médio diário (R$) por empresa, em uma única consulta agrupada para todos os ids.
 * Empresas com menos de `minDays` pregões em `HistoricalPrice` usam o `tradedVolumePerDay` mais recente.
 */
export async function getAverageDailyTradedValue(
  companyIds: readonly number[],
  { minDays = 21, maxDays = 60 }: AverageDailyTradedValueOptions = {}
): Promise<Map<number, AverageDailyTradedValue>> {
  const result = new Map<number, AverageDailyTradedValue>()
  const now = Date.now()
  const pending: number[] = []

  for (const id of new Set(companyIds.filter((v) => Number.isInteger(v) && v > 0))) {
    const hit = cache.get(cacheKey(id, minDays, maxDays))
    if (hit && hit.expiresAt > now) result.set(id, hit.data)
    else pending.push(id)
  }
  if (pending.length === 0) return result

  // Janela em dias corridos com folga para fins de semana e feriados.
  const since = new Date(now - maxDays * 2 * 86_400_000)
  const rows = await prisma.$queryRaw<HistoricalRow[]>`
    SELECT company_id, AVG(close * volume)::float8 AS avg_value, COUNT(*)::int AS days
    FROM (
      SELECT company_id, close, volume,
             ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY date DESC) AS rn
      FROM historical_prices
      WHERE interval = '1d'
        AND company_id = ANY(${pending})
        AND date >= ${since}
        AND volume > 0
        AND close > 0
    ) recent
    WHERE rn <= ${maxDays}
    GROUP BY company_id
  `

  const fresh = new Map<number, AverageDailyTradedValue>()
  for (const row of rows) {
    const value = toFiniteNumber(row.avg_value)
    if (value !== null && value > 0 && row.days >= minDays) {
      fresh.set(row.company_id, { companyId: row.company_id, value, days: row.days, source: 'historical_prices' })
    }
  }

  const missing = pending.filter((id) => !fresh.has(id))
  if (missing.length > 0) {
    const oscillations = await prisma.priceOscillations.findMany({
      where: { companyId: { in: missing }, tradedVolumePerDay: { not: null } },
      orderBy: [{ companyId: 'asc' }, { extractionDate: 'desc' }],
      distinct: ['companyId'],
      select: { companyId: true, tradedVolumePerDay: true },
    })
    for (const row of oscillations) {
      const value = toFiniteNumber(row.tradedVolumePerDay)
      if (value !== null && value > 0) {
        fresh.set(row.companyId, { companyId: row.companyId, value, days: 0, source: 'price_oscillations' })
      }
    }
  }

  const expiresAt = now + CACHE_TTL_MS
  for (const id of pending) {
    const data = fresh.get(id) ?? { companyId: id, value: null, days: 0, source: null }
    cache.set(cacheKey(id, minDays, maxDays), { data, expiresAt })
    result.set(id, data)
  }
  return result
}
