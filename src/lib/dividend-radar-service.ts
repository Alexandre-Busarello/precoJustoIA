/**
 * DIVIDEND RADAR SERVICE
 *
 * Projeção de proventos dos próximos 12 meses por estimativa estatística (sem IA): os meses em que o ativo teve data ex
 * em pelo menos 2 dos últimos 3 anos, com o valor mediano do mês (`projectSeasonal` em `@/lib/finance/dividends`).
 * O resultado fica em cache em `Company.dividendRadarProjections`.
 */

import { prisma } from "@/lib/prisma";
import { safeWrite } from "@/lib/prisma-wrapper";
import { Prisma } from "@prisma/client";
import { toDividendEvents, type DividendEvent } from "@/lib/finance/dividends";
import { subtractMonthsUTC } from "@/lib/finance/utils";
import {
  PROJECTION_HISTORY_MONTHS,
  projectionConfidence,
  seasonalProjectionsFrom,
  toDateKey,
  todayInBrazil,
} from "@/app/agenda-proventos/agenda-model";

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

/**
 * Dividend Radar Service
 */
export class DividendRadarService {
  /**
   * Calcula e grava as projeções dos próximos 12 meses (estimativa estatística a partir do `DividendHistory`).
   */
  static async generateProjections(ticker: string): Promise<DividendProjection[]> {
    const today = todayInBrazil();
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        dividendHistory: {
          where: { exDate: { gte: subtractMonthsUTC(today, PROJECTION_HISTORY_MONTHS) } },
          orderBy: { exDate: "asc" },
          select: { exDate: true, paymentDate: true, amount: true, type: true },
        },
      },
    });

    if (!company) {
      throw new Error(`Company ${ticker} not found`);
    }

    const projections = buildDividendProjections(toDividendEvents(company.dividendHistory), today);
    await this.saveProjections(ticker, projections);
    return projections;
  }

  /**
   * Projeções do cache; recalcula quando há provento novo, quando o cache é de um mês anterior ou quando foi gerado
   * pelo método antigo.
   */
  static async getOrGenerateProjections(ticker: string): Promise<DividendProjection[]> {
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: { dividendRadarProjections: true },
    });

    if (!company) {
      throw new Error(`Company ${ticker} not found`);
    }

    if (!company.dividendRadarProjections || (await this.shouldReprocessProjections(ticker))) {
      return await this.generateProjections(ticker);
    }

    return company.dividendRadarProjections as unknown as DividendProjection[];
  }

  /**
   * Cache desatualizado: gerado por outro método (IA), calculado antes do mês corrente ou com projeção de mês passado.
   */
  static async hasStaleProjections(ticker: string): Promise<boolean> {
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        dividendRadarProjections: true,
        dividendRadarLastProcessedAt: true,
      },
    });

    if (!company || !company.dividendRadarProjections) {
      return false;
    }

    return isProjectionCacheStale(
      company.dividendRadarProjections as unknown as DividendProjection[],
      company.dividendRadarLastProcessedAt,
      todayInBrazil()
    );
  }

  /**
   * Verifica se precisa reprocessar projeções
   * (quando novo dividendo confirmado não estava nas projeções OU quando há projeções em meses passados)
   */
  static async shouldReprocessProjections(ticker: string): Promise<boolean> {
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        dividendRadarLastDividendDate: true,
        dividendHistory: {
          orderBy: { exDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!company || company.dividendHistory.length === 0) {
      // Mesmo sem histórico, verificar se há projeções antigas
      return await this.hasStaleProjections(ticker);
    }

    const latestDividend = company.dividendHistory[0];
    const lastProcessedDate = company.dividendRadarLastDividendDate;

    // Se não tem data de último processamento, precisa processar
    if (!lastProcessedDate) {
      return true;
    }

    // Se o último dividendo é mais recente que o último usado no cálculo, precisa reprocessar
    if (latestDividend.exDate > lastProcessedDate) {
      console.log(
        `🔄 [DIVIDEND RADAR] ${ticker}: Novo dividendo detectado (${latestDividend.exDate.toISOString().split('T')[0]})`
      );
      return true;
    }

    // Verificar se há projeções antigas (meses passados)
    return await this.hasStaleProjections(ticker);
  }

  /**
   * Detecta novos dividendos e reprocessa se necessário
   */
  static async detectAndReprocessIfNeeded(ticker: string): Promise<void> {
    if (await this.shouldReprocessProjections(ticker)) {
      console.log(`🔄 [DIVIDEND RADAR] ${ticker}: Reprocessando após detecção de novo dividendo`);
      await this.generateProjections(ticker);
    }
  }

  /**
   * Salva projeções no banco
   */
  private static async saveProjections(
    ticker: string,
    projections: DividendProjection[]
  ): Promise<void> {
    // Buscar último dividendo para salvar a data
    const company = await prisma.company.findUnique({
      where: { ticker },
      include: {
        dividendHistory: {
          orderBy: { exDate: 'desc' },
          take: 1,
        },
      },
    });

    const lastDividendDate = company?.dividendHistory[0]?.exDate || null;

    await safeWrite(
      'update-dividend-radar-projections',
      () =>
        prisma.company.update({
          where: { ticker },
          data: {
            dividendRadarProjections: projections as unknown as Prisma.InputJsonValue,
            dividendRadarLastProcessedAt: new Date(),
            dividendRadarLastDividendDate: lastDividendDate,
          },
        }),
      ['companies']
    );

    console.log(`✅ [DIVIDEND RADAR] ${ticker}: ${projections.length} projeções salvas`);
  }
}

