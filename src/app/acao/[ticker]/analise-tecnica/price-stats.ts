import { prisma } from '@/lib/prisma'
import { formatBRL, formatDeltaPct } from '@/lib/format'
import type { AssetPriceStat } from './asset-price-header'

export interface PriceStats {
  price: number | null
  /** Variação do dia como fração. */
  dayChange: number | null
  low12m: number | null
  high12m: number | null
  /** Variação em 12 meses como fração (fechamento mensal de 12 meses atrás). */
  change12m: number | null
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Preço, variação do dia e faixa de 12 meses (preços mensais) de um ativo. Só leitura. */
export async function getPriceStats(companyId: number): Promise<PriceStats> {
  const [quotes, monthly] = await Promise.all([
    prisma.dailyQuote.findMany({
      where: { companyId },
      orderBy: { date: 'desc' },
      take: 2,
      select: { price: true },
    }),
    prisma.historicalPrice.findMany({
      where: { companyId, interval: '1mo' },
      orderBy: { date: 'desc' },
      take: 13,
      select: { high: true, low: true, close: true },
    }),
  ])

  const price = toNumber(quotes[0]?.price)
  const previous = toNumber(quotes[1]?.price)
  const lastYear = monthly.slice(0, 12)
  const highs = lastYear.map((m) => toNumber(m.high)).filter((v): v is number => v !== null)
  const lows = lastYear.map((m) => toNumber(m.low)).filter((v): v is number => v !== null)
  const yearAgoClose = monthly.length === 13 ? toNumber(monthly[12].close) : null

  // A faixa inclui o preço atual (o mês corrente pode ainda não estar no histórico mensal).
  const withPrice = (values: number[]) => (price !== null ? [...values, price] : values)
  const low12m = lows.length > 0 ? Math.min(...withPrice(lows)) : null
  const high12m = highs.length > 0 ? Math.max(...withPrice(highs)) : null

  return {
    price,
    dayChange: price !== null && previous !== null ? price / previous - 1 : null,
    low12m,
    high12m,
    change12m: price !== null && yearAgoClose !== null ? price / yearAgoClose - 1 : null,
  }
}

/** Indicadores de preço do cabeçalho: Preço (hoje) · Mínima 12m · Máxima 12m · Variação 12m. */
export function priceStatItems(stats: PriceStats): AssetPriceStat[] {
  const change = stats.change12m
  return [
    { label: 'Preço', value: formatBRL(stats.price), delta: stats.dayChange, deltaLabel: 'hoje' },
    { label: 'Mínima 12 meses', value: formatBRL(stats.low12m) },
    { label: 'Máxima 12 meses', value: formatBRL(stats.high12m) },
    {
      label: 'Variação 12 meses',
      value: formatDeltaPct(change),
      tone: change === null || Math.round(Math.abs(change) * 1000) === 0 ? 'default' : change > 0 ? 'positive' : 'negative',
    },
  ]
}
