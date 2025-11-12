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

      // Verificar dividendos existentes no banco antes de buscar
      const existingDividends = await prisma.dividendHistory.findMany({
        where: {
          companyId: company.id,
          exDate: {
            gte: startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 5)),
          },
        },
        orderBy: { exDate: "desc" },
      });

      console.log(
        `📊 [DIVIDENDS] ${ticker}: ${existingDividends.length} dividendos já existem no banco para o período`
      );

      // Log dos dividendos existentes de 2025 para comparação
      const existing2025 = existingDividends.filter(
        (d) => d.exDate.getFullYear() === 2025
      );
      if (existing2025.length > 0) {
        console.log(`📊 [DIVIDENDS] ${ticker}: Dividendos de 2025 no banco:`);
        existing2025.forEach((d) => {
          console.log(
            `  - ${d.exDate.toISOString().split('T')[0]}: R$ ${Number(d.amount).toFixed(4)}`
          );
        });
      }

      // Fetch dividends from Yahoo Finance
      const dividends = await this.fetchDividendsFromYahoo(ticker, startDate);

      // Comparar com o que já existe no banco
      const yahoo2025 = dividends.filter((d) => d.date.getFullYear() === 2025);
      if (yahoo2025.length !== existing2025.length) {
        console.log(
          `⚠️ [DIVIDENDS] ${ticker}: DISCREPÂNCIA detectada!`
        );
        console.log(
          `  Banco: ${existing2025.length} dividendos de 2025`
        );
        console.log(
          `  Yahoo: ${yahoo2025.length} dividendos de 2025`
        );
        console.log(
          `  Diferença: ${existing2025.length - yahoo2025.length} dividendos faltando no Yahoo`
        );
      }

      if (dividends.length === 0) {
        console.log(`⚠️ [DIVIDENDS] ${ticker}: Nenhum dividendo encontrado no Yahoo`);
        // Se não encontrou nada no Yahoo mas tem no banco, retornar sucesso com contagem do banco
        if (existingDividends.length > 0) {
          console.log(
            `✅ [DIVIDENDS] ${ticker}: Usando ${existingDividends.length} dividendos existentes no banco`
          );
          const existingResult = {
            success: true,
            dividendsCount: existingDividends.length,
            message: "Using existing dividends from database",
          };
          await cache.set(cacheKey, existingResult, { ttl: 14400 });
          return existingResult;
        }

        const noDataResult = {
          success: true,
          dividendsCount: 0,
          message: "No dividends found",
        };

        // Cache "no dividends" result for 4 hours
        await cache.set(cacheKey, noDataResult, { ttl: 14400 });
        return noDataResult;
      }

      // IMPORTANTE: Não sobrescrever dividendos existentes no banco
      // O Yahoo Finance pode não retornar todos os tipos (ex: JCP)
      // Vamos apenas ADICIONAR novos dividendos, não remover os existentes
      // Save only new dividends to database (avoid unnecessary writes)
      await this.saveDividendsToDatabase(company.id, dividends);
      
      // Log final: comparar total no banco após salvamento
      const finalDividends = await prisma.dividendHistory.findMany({
        where: {
          companyId: company.id,
          exDate: {
            gte: startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 5)),
          },
        },
        orderBy: { exDate: "desc" },
      });
      
      const final2025 = finalDividends.filter((d) => d.exDate.getFullYear() === 2025);
      console.log(
        `📊 [DIVIDENDS] ${ticker}: Após atualização - ${finalDividends.length} dividendos no banco (${final2025.length} de 2025)`
      );

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
      // IMPORTANTE: Buscar até 1 ano no futuro para capturar dividendos futuros/projetados
      // O Yahoo Finance pode ter dividendos anunciados mas ainda não pagos
      const period2 = new Date();
      period2.setFullYear(period2.getFullYear() + 1); // 1 ano à frente para capturar dividendos futuros

      console.log(
        `📅 [YAHOO] ${ticker}: Buscando dividendos de ${period1.toISOString().split('T')[0]} até ${period2.toISOString().split('T')[0]} (incluindo futuros)`
      );

      // Use chart() com events para obter dividendos
      // Tentar buscar todos os eventos disponíveis para capturar JCP e outros tipos
      // IMPORTANTE: Usar interval menor pode ajudar a capturar mais dividendos
      // Tentar primeiro com "1d" para capturar todos os dividendos, incluindo futuros
      let result;
      try {
        result = await yahooFinance.chart(yahooSymbol, {
          period1,
          period2,
          interval: "1d", // Intervalo diário para capturar todos os dividendos
          events: "dividends", // Importante: solicitar eventos de dividendos
          // Nota: Yahoo Finance pode não diferenciar JCP de dividendos normais
          // Ambos aparecem como "dividends" na API
          return: "array",
        });
        console.log(`✅ [YAHOO] ${ticker}: Busca com interval "1d" bem-sucedida`);
      } catch (error) {
        console.log(`⚠️ [YAHOO] ${ticker}: Erro com interval "1d", tentando "1mo":`, error);
        // Fallback para intervalo mensal se diário falhar
        result = await yahooFinance.chart(yahooSymbol, {
          period1,
          period2,
          interval: "1mo",
          events: "dividends",
          return: "array",
        });
      }

      // Tentar também buscar via quoteSummary para ver se há mais informações
      let quoteSummaryDividends: any = null;
      try {
        const quoteSummary = await yahooFinance.quoteSummary(yahooSymbol, {
          modules: ['summaryDetail', 'defaultKeyStatistics', 'calendarEvents']
        });
        quoteSummaryDividends = quoteSummary;
        console.log(
          `🔍 [YAHOO] ${ticker}: QuoteSummary retornado:`,
          JSON.stringify({
            hasSummaryDetail: !!quoteSummary?.summaryDetail,
            hasDefaultKeyStatistics: !!quoteSummary?.defaultKeyStatistics,
            hasCalendarEvents: !!quoteSummary?.calendarEvents,
            dividendYield: quoteSummary?.summaryDetail?.dividendYield,
            trailingAnnualDividendRate: quoteSummary?.summaryDetail?.trailingAnnualDividendRate,
            trailingAnnualDividendYield: quoteSummary?.summaryDetail?.trailingAnnualDividendYield,
            exDividendDate: quoteSummary?.calendarEvents?.exDividendDate,
            dividendDate: quoteSummary?.calendarEvents?.dividendDate,
          }, null, 2)
        );
        
        // Tentar extrair dividendos futuros do calendarEvents se disponível
        if (quoteSummary?.calendarEvents?.exDividendDate) {
          console.log(
            `📅 [YAHOO] ${ticker}: Ex-Dividend Date encontrado no calendarEvents:`,
            quoteSummary.calendarEvents.exDividendDate
          );
        }
      } catch (quoteError) {
        console.log(`⚠️ [YAHOO] ${ticker}: Não foi possível buscar quoteSummary:`, quoteError);
      }

      // Log da estrutura completa retornada para debug
      console.log(
        `🔍 [YAHOO] ${ticker}: Estrutura retornada:`,
        JSON.stringify({
          hasResult: !!result,
          hasEvents: !!(result && result.events),
          hasDividends: !!(result && result.events && result.events.dividends),
          dividendType: result?.events?.dividends
            ? Array.isArray(result.events.dividends)
              ? "array"
              : typeof result.events.dividends === "object"
              ? "object"
              : typeof result.events.dividends
            : "null",
          dividendCount: Array.isArray(result?.events?.dividends)
            ? result.events.dividends.length
            : typeof result?.events?.dividends === "object"
            ? Object.keys(result.events.dividends).length
            : 0,
          availableEvents: result?.events ? Object.keys(result.events) : [],
        }, null, 2)
      );

      // Log detalhado dos primeiros e últimos dividendos retornados para debug
      if (result?.events?.dividends) {
        const allDividends = Array.isArray(result.events.dividends)
          ? result.events.dividends
          : Object.values(result.events.dividends);
        
        // Ordenar por data para pegar os mais recentes
        const sortedDividends = allDividends
          .map((div: any) => ({
            date: div.date instanceof Date ? div.date : new Date(div.date),
            amount: div.amount,
          }))
          .sort((a: any, b: any) => b.date.getTime() - a.date.getTime());
        
        console.log(
          `🔍 [YAHOO] ${ticker}: Amostra dos primeiros 5 dividendos (mais recentes):`,
          JSON.stringify(sortedDividends.slice(0, 5).map((d: any) => ({
            date: d.date.toISOString().split('T')[0],
            amount: d.amount,
          })), null, 2)
        );
        
        // Log dos dividendos futuros (após hoje)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const futureDividends = sortedDividends.filter((d: any) => d.date > today);
        if (futureDividends.length > 0) {
          console.log(
            `🔮 [YAHOO] ${ticker}: ${futureDividends.length} dividendos FUTUROS encontrados:`,
            JSON.stringify(futureDividends.map((d: any) => ({
              date: d.date.toISOString().split('T')[0],
              amount: d.amount,
            })), null, 2)
          );
        } else {
          console.log(`⚠️ [YAHOO] ${ticker}: Nenhum dividendo futuro encontrado na resposta da API`);
        }
      }

      // Extrair dividendos dos eventos
      const dividends: DividendData[] = [];

      if (result && result.events && result.events.dividends) {
        const dividendEvents = result.events.dividends;

        // Se for um array
        if (Array.isArray(dividendEvents)) {
          console.log(`📋 [YAHOO] ${ticker}: Processando ${dividendEvents.length} dividendos (formato: array)`);
          
          // Log de TODOS os dividendos antes de filtrar para debug
          const allRawDividends = dividendEvents.map((div: any, index: number) => ({
            index,
            raw: div,
            date: div.date,
            dateType: typeof div.date,
            amount: div.amount,
            amountType: typeof div.amount,
          }));
          
          console.log(
            `🔍 [YAHOO] ${ticker}: TODOS os ${dividendEvents.length} dividendos retornados (antes de filtrar):`,
            JSON.stringify(allRawDividends.slice(0, 20), null, 2) // Primeiros 20 para não poluir logs
          );
          
          for (const div of dividendEvents) {
            if (div.date && div.amount && div.amount > 0) {
              const divDate = div.date instanceof Date ? div.date : new Date(div.date);
              
              // Log se o dividendo é futuro
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (divDate > today) {
                console.log(
                  `🔮 [YAHOO] ${ticker}: Dividendo FUTURO encontrado: ${divDate.toISOString().split('T')[0]} = R$ ${Number(div.amount).toFixed(4)}`
                );
              }
              
              dividends.push({
                date: divDate,
                amount: Number(div.amount),
              });
            } else {
              // Log dividendos que foram filtrados
              console.log(
                `⚠️ [YAHOO] ${ticker}: Dividendo filtrado (sem data ou valor):`,
                JSON.stringify(div)
              );
            }
          }
        }
        // Se for um objeto (mapeado por timestamp)
        else if (typeof dividendEvents === "object") {
          const entries = Object.entries(dividendEvents);
          console.log(`📋 [YAHOO] ${ticker}: Processando ${entries.length} dividendos (formato: object)`);
          for (const [timestamp, div] of entries) {
            const divData = div as any;
            if (divData.amount && divData.amount > 0) {
              const divDate = divData.date instanceof Date
                ? divData.date
                : new Date(divData.date || Number(timestamp) * 1000);
              dividends.push({
                date: divDate,
                amount: Number(divData.amount),
              });
            }
          }
        }
      }

      // Agrupar dividendos por ano para log detalhado
      const dividendsByYear = new Map<number, DividendData[]>();
      dividends.forEach((div) => {
        const year = div.date.getFullYear();
        if (!dividendsByYear.has(year)) {
          dividendsByYear.set(year, []);
        }
        dividendsByYear.get(year)!.push(div);
      });

      // Log detalhado por ano
      console.log(`📊 [YAHOO] ${ticker}: ${dividends.length} dividendos encontrados no total`);
      const sortedYears = Array.from(dividendsByYear.keys()).sort((a, b) => b - a);
      sortedYears.forEach((year) => {
        const yearDividends = dividendsByYear.get(year)!;
        const dates = yearDividends.map((d) => d.date.toISOString().split('T')[0]).join(', ');
        console.log(
          `  📅 ${year}: ${yearDividends.length} dividendo(s) - Datas: ${dates}`
        );
      });

      // Log especial para 2025
      const dividends2025 = dividendsByYear.get(2025) || [];
      if (dividends2025.length > 0) {
        console.log(`🎯 [YAHOO] ${ticker}: Dividendos de 2025 encontrados:`);
        dividends2025.forEach((div) => {
          console.log(
            `  - ${div.date.toISOString().split('T')[0]}: R$ ${div.amount.toFixed(4)}`
          );
        });
      } else {
        console.log(`⚠️ [YAHOO] ${ticker}: Nenhum dividendo encontrado para 2025`);
      }

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
   * Busca apenas o último dividendo de uma empresa sem salvar no banco
   * Método otimizado para uso durante rankings para evitar sobrecarga
   */
  static async fetchLatestDividendOnly(ticker: string): Promise<{
    success: boolean;
    latestDividend?: DividendInfo;
    error?: string;
  }> {
    try {
      console.log(
        `📊 [DIVIDEND LIGHT] Buscando último dividendo para ${ticker}`
      );

      // Buscar dividendos do Yahoo Finance
      const dividends = await this.fetchDividendsFromYahoo(ticker);

      if (!dividends || dividends.length === 0) {
        return {
          success: false,
          error: "Nenhum dividendo encontrado",
        };
      }

      // Retornar apenas o mais recente
      const latestDividend = dividends[0];

      console.log(
        `✅ [DIVIDEND LIGHT] Último dividendo ${ticker}: R$ ${latestDividend.amount} (${latestDividend.date})`
      );

      return {
        success: true,
        latestDividend: {
          ticker,
          date: latestDividend.date,
          amount: latestDividend.amount,
          exDate: latestDividend.date,
          paymentDate: undefined,
          type: undefined,
        },
      };
    } catch (error) {
      console.error(
        `❌ [DIVIDEND LIGHT] Erro ao buscar dividendo para ${ticker}:`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Processa dividendos para múltiplas empresas de forma SEQUENCIAL
   * Evita sobrecarga do pool de conexões processando uma por vez
   */
  static async fetchLatestDividendsSequential(
    tickers: string[],
    delayMs: number = 500
  ): Promise<
    Map<
      string,
      { success: boolean; latestDividend?: DividendInfo; error?: string }
    >
  > {
    const results = new Map<
      string,
      { success: boolean; latestDividend?: DividendInfo; error?: string }
    >();

    console.log(
      `📊 [DIVIDENDS SEQUENTIAL] Iniciando processamento sequencial de ${tickers.length} empresas`
    );

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];

      console.log(
        `📊 [DIVIDENDS SEQUENTIAL] Processando ${i + 1}/${
          tickers.length
        }: ${ticker}`
      );

      try {
        const result = await this.fetchLatestDividendOnly(ticker);
        
        if (result.success && result.latestDividend) {
          // Salvar no banco de dados
          await this.saveLatestDividendToDatabase(ticker, result.latestDividend);
          console.log(
            `✅ [DIVIDENDS SEQUENTIAL] ${ticker}: R$ ${result.latestDividend.amount} (salvo no banco)`
          );
        } else {
          console.log(`⚠️ [DIVIDENDS SEQUENTIAL] ${ticker}: ${result.error}`);
        }
        
        results.set(ticker, result);
      } catch (error) {
        console.error(
          `❌ [DIVIDENDS SEQUENTIAL] Erro ao processar ${ticker}:`,
          error
        );
        results.set(ticker, {
          success: false,
          error: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }

      // Delay entre processamentos para não sobrecarregar
      if (i < tickers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    const successCount = Array.from(results.values()).filter(
      (r) => r.success
    ).length;
    console.log(
      `✅ [DIVIDENDS SEQUENTIAL] Processamento concluído: ${successCount}/${tickers.length} sucessos`
    );

    return results;
  }

  /**
   * Salva o último dividendo encontrado no banco de dados
   * Atualiza tanto a tabela Company quanto FinancialData (ano atual)
   */
  static async saveLatestDividendToDatabase(
    ticker: string,
    dividendInfo: DividendInfo
  ): Promise<void> {
    try {
      console.log(`💾 [SAVE DIVIDEND] Salvando último dividendo para ${ticker}: R$ ${dividendInfo.amount}`);
      
      // Buscar a empresa
      const company = await prisma.company.findUnique({
        where: { ticker },
        select: { id: true }
      });
      
      if (!company) {
        console.warn(`⚠️ [SAVE DIVIDEND] Empresa ${ticker} não encontrada`);
        return;
      }
      
      const currentYear = new Date().getFullYear();
      
      // Atualizar Company com último dividendo
      await safeWrite(
        "update-company-dividend",
        () => prisma.company.update({
          where: { id: company.id },
          data: {
            ultimoDividendo: dividendInfo.amount,
            dataUltimoDividendo: dividendInfo.date
          }
        }),
        ["companies"]
      );
      
      // Atualizar FinancialData do ano atual (se existir)
      const currentYearFinancialData = await prisma.financialData.findUnique({
        where: {
          companyId_year: {
            companyId: company.id,
            year: currentYear
          }
        }
      });
      
      if (currentYearFinancialData) {
        await safeWrite(
          "update-financial-data-dividend",
          () => prisma.financialData.update({
            where: {
              companyId_year: {
                companyId: company.id,
                year: currentYear
              }
            },
            data: {
              ultimoDividendo: dividendInfo.amount,
              dataUltimoDividendo: dividendInfo.date
            }
          }),
          ["financial_data"]
        );
        console.log(`✅ [SAVE DIVIDEND] ${ticker}: Atualizado Company e FinancialData ${currentYear}`);
      } else {
        console.log(`✅ [SAVE DIVIDEND] ${ticker}: Atualizado Company (FinancialData ${currentYear} não existe)`);
      }
      
    } catch (error) {
      console.error(`❌ [SAVE DIVIDEND] Erro ao salvar dividendo para ${ticker}:`, error);
      // Não propagar o erro para não quebrar o processamento sequencial
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
