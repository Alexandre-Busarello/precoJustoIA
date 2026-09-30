import 'server-only'

/**
 * Sincronização das séries macro do BCB SGS com `EconomicIndicatorHistory` (usada pelo cron `/api/cron/macro-indicators`).
 * Grava o valor como o BCB publica (em %); a conversão para fração acontece em `getMacroAssumptions`.
 */

import { prisma } from '@/lib/prisma'
import { MACRO_SYMBOLS, SGS_CODES, fetchSgsSeries, getMacroAssumptions, type SgsPoint } from './macro'

export interface MacroSeriesConfig {
  code: number
  symbol: string
  /** Janela buscada em dias corridos. */
  lookbackDays: number
}

/**
 * Séries sincronizadas. Selic e CDI: últimos 90 dias. IPCA: 400 dias, porque o IPCA esperado é o acumulado de
 * 12 meses (a série é mensal e 90 dias trariam só 3 pontos).
 */
export const MACRO_SERIES: readonly MacroSeriesConfig[] = [
  { code: SGS_CODES.selic, symbol: MACRO_SYMBOLS.selic, lookbackDays: 90 },
  { code: SGS_CODES.cdi, symbol: MACRO_SYMBOLS.cdi, lookbackDays: 90 },
  { code: SGS_CODES.ipca, symbol: MACRO_SYMBOLS.ipca, lookbackDays: 400 },
]

const UPSERT_CHUNK = 50

/**
 * Upsert de pontos de uma série em `EconomicIndicatorHistory` (interval '1d'), usando o símbolo também como
 * `indicatorName` para não colidir com os indicadores legados ('SELIC', 'CDI', 'IPCA'). Devolve quantas linhas gravou.
 */
export async function upsertMacroSeries(symbol: string, points: readonly SgsPoint[]): Promise<number> {
  const interval = '1d'
  for (let i = 0; i < points.length; i += UPSERT_CHUNK) {
    const chunk = points.slice(i, i + UPSERT_CHUNK)
    await prisma.$transaction(
      chunk.map((point) =>
        prisma.economicIndicatorHistory.upsert({
          where: { indicatorName_date_interval: { indicatorName: symbol, date: point.date, interval } },
          create: { indicatorName: symbol, symbol, date: point.date, interval, value: point.value },
          update: { symbol, value: point.value },
        })
      )
    )
  }
  return points.length
}

export interface MacroSyncResult {
  symbol: string
  code: number
  upserted: number
  /** Data (YYYY-MM-DD) e valor do ponto mais recente gravado. */
  latest: { date: string; value: number } | null
  error?: string
}

/**
 * Busca cada série do BCB e grava no banco. Uma série com erro não interrompe as demais.
 * Ao final, invalida o cache de premissas macro para refletir os novos dados.
 */
export async function syncMacroIndicators({
  now = new Date(),
  fetcher = fetchSgsSeries,
}: { now?: Date; fetcher?: typeof fetchSgsSeries } = {}): Promise<MacroSyncResult[]> {
  const results: MacroSyncResult[] = []
  for (const series of MACRO_SERIES) {
    try {
      const from = new Date(now.getTime() - series.lookbackDays * 86_400_000)
      // A série da meta Selic traz datas futuras (a meta vigente até a próxima reunião do Copom): grava só até hoje.
      const points = (await fetcher(series.code, from)).filter((p) => p.date.getTime() <= now.getTime())
      const upserted = await upsertMacroSeries(series.symbol, points)
      const last = points[points.length - 1]
      results.push({
        symbol: series.symbol,
        code: series.code,
        upserted,
        latest: last ? { date: last.date.toISOString().slice(0, 10), value: last.value } : null,
      })
    } catch (error: unknown) {
      results.push({
        symbol: series.symbol,
        code: series.code,
        upserted: 0,
        latest: null,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  await getMacroAssumptions({ force: true })
  return results
}
