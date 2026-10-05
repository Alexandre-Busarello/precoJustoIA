/**
 * Projeções de proventos puras (sem banco): usadas pelo DividendRadarService e testáveis sem carregar o Prisma.
 */

import type { DividendEvent } from "@/lib/finance/dividends";
import { projectionConfidence, seasonalProjectionsFrom, toDateKey } from "@/app/agenda-proventos/agenda-model";

/** Método das projeções gravadas; cache sem ele (projeções antigas, feitas por IA) é recalculado. */
export const DIVIDEND_PROJECTION_METHOD = "seasonal";
/** Rótulo exibido junto dos valores projetados. */
export const DIVIDEND_PROJECTION_LABEL = "estimativa estatística";

export interface DividendProjection {
  month: number; // 1-12
  year: number;
  projectedExDate: string; // YYYY-MM-DD
  projectedAmount: number;
  /** 80 quando houve data ex no mês nos 3 últimos anos; 65 quando em 2 deles. */
  confidence: number;
  /** Tipo mais frequente no mês ('JCP', 'DIVIDENDO'…), ou `null`. */
  type?: string | null;
  method?: typeof DIVIDEND_PROJECTION_METHOD;
}

export interface DividendRadarProjections {
  projections: DividendProjection[];
  lastProcessedAt: string; // ISO date string
  lastDividendDate: string | null; // ISO date string
}

/**
 * Projeções do mês corrente aos 11 seguintes a partir do histórico. Pura e determinística: mesmo histórico e mesmo dia,
 * mesmo resultado.
 */
export function buildDividendProjections(events: readonly DividendEvent[], today: Date): DividendProjection[] {
  return seasonalProjectionsFrom(events, today).map((p) => ({
    month: p.exDate.getUTCMonth() + 1,
    year: p.exDate.getUTCFullYear(),
    projectedExDate: toDateKey(p.exDate),
    projectedAmount: p.amount,
    confidence: projectionConfidence(p.occurrences),
    type: p.type,
    method: DIVIDEND_PROJECTION_METHOD,
  }));
}

/** `true` quando o cache de projeções precisa ser recalculado (ver `hasStaleProjections`). */
export function isProjectionCacheStale(
  projections: unknown,
  lastProcessedAt: Date | null,
  today: Date
): boolean {
  if (!Array.isArray(projections)) return true;
  const monthStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
  if (!lastProcessedAt || lastProcessedAt.getTime() < monthStart) return true;
  const currentMonth = toDateKey(today).slice(0, 7);
  return (projections as DividendProjection[]).some(
    (p) => p?.method !== DIVIDEND_PROJECTION_METHOD || typeof p.projectedExDate !== "string" || p.projectedExDate.slice(0, 7) < currentMonth
  );
}
