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
import { toDividendEvents } from "@/lib/finance/dividends";
import { subtractMonthsUTC } from "@/lib/finance/utils";
import { PROJECTION_HISTORY_MONTHS, todayInBrazil } from "@/app/agenda-proventos/agenda-model";

import {
  buildDividendProjections,
  isProjectionCacheStale,
  type DividendProjection,
} from "@/lib/dividend-projections";

export {
  DIVIDEND_PROJECTION_METHOD,
  DIVIDEND_PROJECTION_LABEL,
  buildDividendProjections,
  isProjectionCacheStale,
  type DividendProjection,
  type DividendRadarProjections,
} from "@/lib/dividend-projections";

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

