/**
 * DIVIDEND SERVICE
 *
 * Gerencia a extração, armazenamento e processamento de dividendos históricos
 * usando yahoo-finance2 para todos os tipos de ativos.
 */

import { prisma } from "@/lib/prisma";
import { safeWrite, safeQueryWithParams } from "@/lib/prisma-wrapper";
import { cache } from "@/lib/cache-service";

// Yahoo Finance instance (lazy-loaded)
let yahooFinanceInstance: any = null;

async function getYahooFinance() {
  if (!yahooFinanceInstance) {
    const yahooModule = await import("yahoo-finance2");
    const YahooFinance = yahooModule.default;
    yahooFinanceInstance = new YahooFinance({
      suppressNotices: ["yahooSurvey", "ripHistorical"],
    });
  }
  return yahooFinanceInstance;
}

/**
 * Interface para dividendos extraídos do Yahoo Finance
 */
export interface DividendData {
  date: Date;
  amount: number;
}

/**
 * Interface para dividendos com informações adicionais
 */
export interface DividendInfo extends DividendData {
  ticker: string;
  exDate: Date;
  paymentDate?: Date;
  type?: string;
}

/**
 * Dividend Service
 */
export class DividendService {
  /**
   * Busca e salva o histórico completo de dividendos de um ativo
   * Atualiza também os campos ultimoDividendo e dataUltimoDividendo na Company
   *
   * CACHE: TTL de 4 horas para evitar buscas repetidas do mesmo ativo
   */
  static async fetchAndSaveDividends(
    ticker: string,
    startDate?: Date
  ): Promise<{
    success: boolean;
    dividendsCount: number;
    latestDividend?: DividendInfo;
    message?: string;
  }> {
    // Generate cache key based on ticker and startDate
    const startDateStr = startDate
      ? startDate.toISOString().split("T")[0]
      : "all";
    const cacheKey = `dividends:fetch:${ticker}:${startDateStr}`;

    try {
      // Check cache first (TTL: 4 hours = 14400 seconds)
      const cachedResult = await cache.get(cacheKey);
      if (cachedResult) {
        console.log(
          `📦 [DIVIDENDS CACHE HIT] ${ticker}: Retornando resultado em cache`
        );
        return cachedResult;
      }

      console.log(`📊 [DIVIDENDS] Buscando dividendos para ${ticker}...`);

      // Get company from database
      const company = await prisma.company.findUnique({
        where: { ticker },
      });

      if (!company) {
        const errorResult = {
          success: false,
          dividendsCount: 0,
          message: `Company ${ticker} not found`,
        };

        // Cache error result for shorter time (1 hour) to avoid repeated failed lookups
        await cache.set(cacheKey, errorResult, { ttl: 3600 });
        return errorResult;
      }

      // Fetch dividends from Yahoo Finance
      const dividends = await this.fetchDividendsFromYahoo(ticker, startDate);

      if (dividends.length === 0) {
        console.log(`⚠️ [DIVIDENDS] ${ticker}: Nenhum dividendo encontrado`);
        const noDataResult = {
          success: true,
          dividendsCount: 0,
          message: "No dividends found",
        };

        // Cache "no dividends" result for 4 hours
        await cache.set(cacheKey, noDataResult, { ttl: 14400 });
        return noDataResult;
      }

      // Save only new dividends to database (avoid unnecessary writes)
      await this.saveDividendsToDatabase(company.id, dividends);

      // Find the latest dividend
      const latestDividend = dividends.reduce((latest, current) => {
        return current.date > latest.date ? current : latest;
      });

      // Update Company with latest dividend info
      await safeWrite(
        "update-companies-latest-dividend",
        () =>
          prisma.company.update({
            where: { id: company.id },
            data: {
              ultimoDividendo: latestDividend.amount,
              dataUltimoDividendo: latestDividend.date,
            },
          }),
        ["companies"]
      );

      console.log(
        `✅ [DIVIDENDS] ${ticker}: ${dividends.length} dividendos salvos`
      );

      const result = {
        success: true,
        dividendsCount: dividends.length,
        latestDividend: {
          ticker,
          date: latestDividend.date,
          amount: latestDividend.amount,
          exDate: latestDividend.date,
        },
      };

      // Cache successful result for 4 hours (14400 seconds)
      await cache.set(cacheKey, result, { ttl: 14400 });
      console.log(
        `💾 [DIVIDENDS CACHE SET] ${ticker}: Resultado cacheado por 4 horas`
      );

      return result;
    } catch (error) {
      console.error(`❌ [DIVIDENDS] Erro ao processar ${ticker}:`, error);
      const errorResult = {
        success: false,
        dividendsCount: 0,
        message: error instanceof Error ? error.message : "Unknown error",
      };

      // Cache error result for shorter time (30 minutes) to allow retry sooner
      await cache.set(cacheKey, errorResult, { ttl: 1800 });
      return errorResult;
    }
  }

  /**
   * Extrai dividendos históricos do Yahoo Finance
   * Usa o módulo chart() que inclui eventos de dividendos
   */
  static async fetchDividendsFromYahoo(
    ticker: string,
    startDate?: Date
  ): Promise<DividendData[]> {
    try {
      const yahooFinance = await getYahooFinance();
      const yahooSymbol = `${ticker}.SA`;

      // Default: buscar o máximo disponível (10 anos atrás)
      const defaultStartDate = new Date();
      defaultStartDate.setFullYear(defaultStartDate.getFullYear() - 10);

      const period1 = startDate || defaultStartDate;
      const period2 = new Date(); // Até hoje

      // Use chart() com events para obter dividendos
      const result = await yahooFinance.chart(yahooSymbol, {
        period1,
        period2,
        interval: "1mo",
        events: "dividends", // Importante: solicitar eventos de dividendos
        return: "array",
      });

      // Extrair dividendos dos eventos
      const dividends: DividendData[] = [];

      if (result && result.events && result.events.dividends) {
        const dividendEvents = result.events.dividends;

        // Se for um array
        if (Array.isArray(dividendEvents)) {
          for (const div of dividendEvents) {
            if (div.date && div.amount && div.amount > 0) {
              dividends.push({
                date: div.date instanceof Date ? div.date : new Date(div.date),
                amount: Number(div.amount),
              });
            }
          }
        }
        // Se for um objeto (mapeado por timestamp)
        else if (typeof dividendEvents === "object") {
          for (const [timestamp, div] of Object.entries(dividendEvents)) {
            const divData = div as any;
            if (divData.amount && divData.amount > 0) {
              dividends.push({
                date:
                  divData.date instanceof Date
                    ? divData.date
                    : new Date(divData.date || Number(timestamp) * 1000),
                amount: Number(divData.amount),
              });
            }
          }
        }
      }

      console.log(
        `📊 [YAHOO] ${ticker}: ${dividends.length} dividendos encontrados`
      );
      return dividends.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error(
        `❌ [YAHOO] Erro ao buscar dividendos de ${ticker}:`,
        error
      );
      return [];
    }
  }

  /**
   * Salva múltiplos dividendos no banco de dados
   * Usa upsert para evitar duplicatas
   */
  static async saveDividendsToDatabase(
    companyId: number,
    dividends: DividendData[]
  ): Promise<void> {
    if (dividends.length === 0) return;

    try {
      // First, get existing dividends to avoid unnecessary writes
      const existingDividends = await prisma.dividendHistory.findMany({
        where: {
          companyId: companyId,
        },
        select: {
          exDate: true,
          amount: true,
        },
      });

      // Create a Set of existing dividend keys for fast lookup
      const existingKeys = new Set(
        existingDividends.map(
          (div) =>
            `${div.exDate.toISOString().split("T")[0]}_${Number(
              div.amount
            ).toFixed(6)}`
        )
      );

      // Filter out dividends that already exist
      const newDividends = dividends.filter((dividend) => {
        const key = `${
          dividend.date.toISOString().split("T")[0]
        }_${dividend.amount.toFixed(6)}`;
        return !existingKeys.has(key);
      });

      if (newDividends.length === 0) {
        console.log(
          `✅ [DB] Todos os ${dividends.length} dividendos já existem no banco`
        );
        return;
      }

      // Save only new dividends
      await Promise.all(
        newDividends.map((dividend) =>
          safeWrite(
            "create-dividend_history",
            () =>
              prisma.dividendHistory.create({
                data: {
                  companyId: companyId,
                  exDate: dividend.date,
                  amount: dividend.amount,
                  source: "yahoo",
                },
              }),
            ["dividend_history"]
          )
        )
      );

      console.log(
        `✅ [DB] Salvos ${newDividends.length} novos dividendos (${
          dividends.length - newDividends.length
        } já existiam)`
      );
    } catch (error) {
      console.error("❌ [DB] Erro ao salvar dividendos:", error);
      throw error;
    }
  }

  /**
   * Busca dividendos de um ativo em um período específico
   */
  static async getDividendsInPeriod(
    ticker: string,
    startDate: Date,
    endDate: Date
  ): Promise<DividendInfo[]> {
    const company = await prisma.company.findUnique({
      where: { ticker },
      include: {
        dividendHistory: {
          where: {
            exDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: {
            exDate: "desc",
          },
        },
      },
    });

    if (!company) {
      return [];
    }

    return company.dividendHistory.map((div) => ({
      ticker,
      date: div.exDate,
      amount: Number(div.amount),
      exDate: div.exDate,
      paymentDate: div.paymentDate || undefined,
      type: div.type || undefined,
    }));
  }

  /**
   * Busca dividendos do mês atual para um ativo
   * Útil para gerar transações sugeridas
   */
  static async getCurrentMonthDividends(
    ticker: string
  ): Promise<DividendInfo[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return this.getDividendsInPeriod(ticker, startOfMonth, endOfMonth);
  }

  /**
   * Verifica se um ativo tem dividendos pendentes de processamento no mês atual
   * Retorna dividendos que:
   * 1. Estão no mês atual
   * 2. A data ex-dividendo já passou
   * 3. O usuário tinha posição na data ex-dividendo
   */
  static async getPendingDividendsForPortfolio(
    portfolioId: string,
    ticker: string
  ): Promise<DividendInfo[]> {
    const currentMonthDividends = await this.getCurrentMonthDividends(ticker);
    const now = new Date();

    // Filtrar apenas dividendos cuja data ex já passou
    return currentMonthDividends.filter((div) => div.exDate <= now);
  }

  /**
   * Obtém o último dividendo pago por um ativo
   */
  static async getLatestDividend(ticker: string): Promise<DividendInfo | null> {
    const company = await safeQueryWithParams(
      "get-latest-dividend-companies",
      () =>
        prisma.company.findUnique({
          where: { ticker },
          select: {
            ultimoDividendo: true,
            dataUltimoDividendo: true,
            dividendHistory: {
              orderBy: {
                exDate: "desc",
              },
              take: 1,
            },
          },
        }),
      { ticker }
    );

    if (
      !company ||
      !company.dividendHistory ||
      company.dividendHistory.length === 0
    ) {
      return null;
    }

    const latestDiv = company.dividendHistory[0];

    return {
      ticker,
      date: latestDiv.exDate,
      amount: Number(latestDiv.amount),
      exDate: latestDiv.exDate,
      paymentDate: latestDiv.paymentDate || undefined,
      type: latestDiv.type || undefined,
    };
  }

  /**
   * Calcula o dividend yield anual com base nos últimos 12 meses
   */
  static async calculateDividendYield12M(
    ticker: string,
    currentPrice: number
  ): Promise<number | null> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const now = new Date();

    const dividends = await this.getDividendsInPeriod(ticker, oneYearAgo, now);

    if (dividends.length === 0 || currentPrice <= 0) {
      return null;
    }

    const totalDividends = dividends.reduce((sum, div) => sum + div.amount, 0);
    return totalDividends / currentPrice;
  }

  /**
   * Limpar cache de dividendos para um ticker específico
   * Útil quando há atualizações manuais ou correções de dados
   */
  static async clearDividendCache(ticker: string): Promise<number> {
    const pattern = `analisador-acoes:dividends:fetch:${ticker}:*`;
    const deletedKeys = await cache.clearByPattern(pattern);

    if (deletedKeys > 0) {
      console.log(
        `🧹 [DIVIDENDS CACHE] Limpo cache de ${ticker}: ${deletedKeys} chaves removidas`
      );
    }

    return deletedKeys;
  }

  /**
   * Limpar todo o cache de dividendos
   * Útil para manutenção ou quando há problemas com dados em cache
   */
  static async clearAllDividendCache(): Promise<number> {
    const pattern = `analisador-acoes:dividends:fetch:*`;
    const deletedKeys = await cache.clearByPattern(pattern);

    if (deletedKeys > 0) {
      console.log(
        `🧹 [DIVIDENDS CACHE] Limpo todo cache de dividendos: ${deletedKeys} chaves removidas`
      );
    }

    return deletedKeys;
  }

  /**
   * Obter informações sobre o cache de dividendos
   */
  static async getDividendCacheInfo(): Promise<{
    totalKeys: number;
    keys: string[];
    redisConnected: boolean;
  }> {
    const pattern = `analisador-acoes:dividends:fetch:*`;
    const keys = await cache.getKeysByPattern(pattern);

    return {
      totalKeys: keys.length,
      keys: keys.sort(),
      redisConnected: cache.isRedisConnected(),
    };
  }
}
