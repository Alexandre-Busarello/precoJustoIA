/**
 * BDR DATA SERVICE
 *
 * Serviço para buscar e processar dados de BDRs (Brazilian Depositary Receipts)
 * usando Yahoo Finance API, seguindo o mesmo padrão dos dados salvos pelo fetch-data-ward.ts
 */

import { prisma } from "@/lib/prisma";

// Lista dos principais BDRs da B3
export const MAIN_BDRS = [
  "AMZO34.SA",
  "AAPL34.SA",
  "MSFT34.SA",
  "GOGL34.SA",
  "M1TA34.SA",
  "NVDC34.SA",
  "NFLX34.SA",
  "TSLA34.SA",
  "ADBE34.SA",
  "SSFO34.SA",
  "ORCL34.SA",
  "PYPL34.SA",
  "Z1OM34.SA",
  "S2QU34.SA",
  "S2HO34.SA",
  "R1OK34.SA",
  "MELI34.SA",
  "BABA34.SA",
  "TSMC34.SA",
  "P2LT34.SA",
  "C2OI34.SA",
  "STOC34.SA",
  "AIRB34.SA",
  "BKNG34.SA",
  "U1BE34.SA",
  "S1PO34.SA",
  "S2NW34.SA",
  "D2OG34.SA",
  "N2ET34.SA",
  "R2BL34.SA",
  "P1IN34.SA",
  "T1TW34.SA",
  "ATVI34.SA",
  "EAIN34.SA",
  "JDCO34.SA",
  "PDD34.SA",
  "BIDU34.SA",
  "JPMC34.SA",
  "BOAC34.SA",
  "WFCO34.SA",
  "GSGI34.SA",
  "MSCO34.SA",
  "VISA34.SA",
  "MSCD34.SA",
  "AXPB34.SA",
  "BERK34.SA",
  "CTGP34.SA",
  "ROXO34.SA",
  "BLAK34.SA",
  "CMEB34.SA",
  "I1CE34.SA",
  "SCHW34.SA",
  "MCOR34.SA",
  "SPGI34.SA",
  "AIGB34.SA",
  "JNJB34.SA",
  "PFIZ34.SA",
  "UNHH34.SA",
  "ABBV34.SA",
  "MRCK34.SA",
  "BMYB34.SA",
  "LILY34.SA",
  "GILD34.SA",
  "AMGN34.SA",
  "BIIB34.SA",
  "ABTT34.SA",
  "CVSH34.SA",
  "TMOS34.SA",
  "ISRG34.SA",
  "M2RN34.SA",
  "DHER34.SA",
  "VRTX34.SA",
  "REGN34.SA",
  "Z1TS34.SA",
  "COCA34.SA",
  "PEPB34.SA",
  "WMTB34.SA",
  "MCDC34.SA",
  "SBUB34.SA",
  "NIKE34.SA",
  "DISB34.SA",
  "HOME34.SA",
  "LOWC34.SA",
  "TGTB34.SA",
  "COWC34.SA",
  "PGCO34.SA",
  "ULEV34.SA",
  "COLG34.SA",
  "ABUD34.SA",
  "LVMH34.SA",
  "MDLZ34.SA",
  "PHMO34.SA",
  "FDMO34.SA",
  "GMCO34.SA",
  "TMCO34.SA",
  "HDBI34.SA",
  "STLA34.SA",
  "RACE34.SA",
  "KHCB34.SA",
  "ELCI34.SA",
  "YUMR34.SA",
  "TJXC34.SA",
  "W1BD34.SA",
  "XOMM34.SA",
  "CHVX34.SA",
  "COPH34.SA",
  "SLBG34.SA",
  "HALI34.SA",
  "FCXO34.SA",
  "BHPG34.SA",
  "RIOB34.SA",
  "BPXB34.SA",
  "SHEL34.SA",
  "TTEB34.SA",
  "GLEN34.SA",
  "VALE34.SA",
  "N1EM34.SA",
  "BOEI34.SA",
  "CATP34.SA",
  "GEOO34.SA",
  "MMMC34.SA",
  "H1ON34.SA",
  "UPSS34.SA",
  "FDXB34.SA",
  "LMTB34.SA",
  "RYTT34.SA",
  "N1OC34.SA",
  "ACNB34.SA",
  "DEEC34.SA",
  "UPAC34.SA",
  "W1MC34.SA",
  "ATTB34.SA",
  "VERZ34.SA",
  "T1MU34.SA",
  "CMCS34.SA",
  "NEXT34.SA",
  "DUKB34.SA",
  "T1SO34.SA",
  "D1OM34.SA",
  "T1OW34.SA",
  "P1LD34.SA",
  "C1CI34.SA",
  "EQIX34.SA",
  "SIMN34.SA",
  "ITLC34.SA",
  "A1MD34.SA",
  "QCOM34.SA",
  "CSCO34.SA",
  "IBMB34.SA",
  "AVGO34.SA",
  "TEXA34.SA",
  "MUTC34.SA",
  "A1MT34.SA",
  "L1RC34.SA",
  "ASML34.SA",
  "SAPP34.SA",
  "SNEC34.SA",
];

// Interface para dados do Yahoo Finance (baseada no JSON de exploração)
interface YahooFinanceQuote {
  symbol?: string;
  shortName?: string;
  longName?: string;
  currency?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  averageDailyVolume3Month?: number;
  marketCap?: number;
  sharesOutstanding?: number;
  bookValue?: number;
  priceToBook?: number;
  trailingPE?: number;
  forwardPE?: number;
  trailingEps?: number;
  forwardEps?: number;
  dividendYield?: number;
  exDividendDate?: number;
  dividendDate?: number;
  payoutRatio?: number;
  beta?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  trailingAnnualDividendRate?: number;
  trailingAnnualDividendYield?: number;
  enterpriseValue?: number;
  profitMargins?: number;
  floatShares?: number;
  heldPercentInsiders?: number;
  heldPercentInstitutions?: number;
  impliedSharesOutstanding?: number;
  lastDividendValue?: number;
  lastDividendDate?: number;
}

interface YahooFinanceDefaultKeyStatistics {
  symbol?: string;
  enterpriseValue?: number;
  forwardPE?: number;
  profitMargins?: number;
  sharesOutstanding?: number;
  bookValue?: number;
  priceToBook?: number;
  mostRecentQuarter?: string;
  earningsQuarterlyGrowth?: number;
  earningsAnnualGrowth?: number;
  trailingEps?: number;
  enterpriseToRevenue?: number;
  enterpriseToEbitda?: number;
  "52WeekChange"?: number;
  ytdReturn?: number;
  lastDividendValue?: number;
  lastDividendDate?: string;
  dividendYield?: number;
  totalAssets?: number;
  beta?: number;
  heldPercentInsiders?: number;
  heldPercentInstitutions?: number;
  floatShares?: number;
  impliedSharesOutstanding?: number;
}

interface YahooFinanceFinancialData {
  symbol?: string;
  currentPrice?: number;
  ebitda?: number;
  quickRatio?: number;
  currentRatio?: number;
  debtToEquity?: number;
  revenuePerShare?: number;
  returnOnAssets?: number;
  returnOnEquity?: number;
  earningsGrowth?: number;
  revenueGrowth?: number;
  grossMargins?: number;
  ebitdaMargins?: number;
  operatingMargins?: number;
  profitMargins?: number;
  totalCash?: number;
  totalCashPerShare?: number;
  totalDebt?: number;
  totalRevenue?: number;
  grossProfits?: number;
  operatingCashflow?: number;
  freeCashflow?: number;
  financialCurrency?: string;
}

interface YahooFinanceSummaryProfile {
  address1?: string;
  address2?: string;
  address3?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  fax?: string;
  website?: string;
  industry?: string;
  industryKey?: string;
  industryDisp?: string;
  sector?: string;
  sectorKey?: string;
  sectorDisp?: string;
  longBusinessSummary?: string;
  fullTimeEmployees?: number;
  companyOfficers?: Array<{
    maxAge?: number;
    name?: string;
    age?: number;
    title?: string;
    yearBorn?: number;
    fiscalYear?: number;
    totalPay?: number;
    exercisedValue?: number;
    unexercisedValue?: number;
  }>;
}

interface YahooFinanceSummaryDetail {
  maxAge?: number;
  priceHint?: number;
  previousClose?: number;
  open?: number;
  dayLow?: number;
  dayHigh?: number;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  regularMarketDayLow?: number;
  regularMarketDayHigh?: number;
  payoutRatio?: number;
  beta?: number;
  trailingPE?: number;
  volume?: number;
  regularMarketVolume?: number;
  averageVolume?: number;
  averageVolume10days?: number;
  averageDailyVolume10Day?: number;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
  marketCap?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  allTimeHigh?: number;
  allTimeLow?: number;
  priceToSalesTrailing12Months?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  trailingAnnualDividendRate?: number;
  trailingAnnualDividendYield?: number;
  currency?: string;
  fromCurrency?: string;
  toCurrency?: string;
  lastMarket?: string;
  coinMarketCapLink?: string;
  algorithm?: string;
  tradeable?: boolean;
}

interface YahooFinanceData {
  quote?: YahooFinanceQuote;
  defaultKeyStatistics?: YahooFinanceDefaultKeyStatistics;
  financialData?: YahooFinanceFinancialData;
  summaryDetail?: YahooFinanceSummaryDetail;
  summaryProfile?: YahooFinanceSummaryProfile;
  balanceSheetHistory?: any[];
  incomeStatementHistory?: any[];
  cashflowStatementHistory?: any[];
  earnings?: any;
  earningsHistory?: any[];
  earningsTrend?: any;
  price?: any;
  quoteType?: any;
  assetProfile?: any;
  calendarEvents?: any;
  fundOwnership?: any;
  institutionOwnership?: any;
  majorHoldersBreakdown?: any;
  recommendationTrend?: any;
  fundamentalsTimeSeries?: any; // Dados históricos anuais completos
}

/**
 * Serviço para buscar dados de BDRs do Yahoo Finance
 */
export class BDRDataService {
  /**
   * Verifica se um ticker é um BDR
   */
  static isBDR(ticker: string): boolean {
    const normalizedTicker = ticker.toUpperCase();

    // BDRs terminam com 34.SA ou 35.SA
    if (
      normalizedTicker.endsWith("34.SA") ||
      normalizedTicker.endsWith("35.SA")
    ) {
      return true;
    }

    // Alguns ETFs internacionais também são considerados BDRs para nosso propósito
    const internationalETFs = ["IVVB11.SA", "SPXI11.SA"];
    return internationalETFs.includes(normalizedTicker);
  }

  /**
   * Remove o sufixo .SA do ticker para salvar no banco
   */
  static cleanTickerForDB(ticker: string): string {
    return ticker.replace(".SA", "");
  }

  /**
   * Adiciona o sufixo .SA ao ticker para buscar no Yahoo Finance
   */
  static addSuffixForYahoo(ticker: string): string {
    return ticker.endsWith(".SA") ? ticker : `${ticker}.SA`;
  }

  /**
   * Busca dados completos de um BDR do Yahoo Finance (incluindo históricos)
   */
  static async fetchBDRData(
    ticker: string,
    includeHistorical: boolean = false
  ): Promise<YahooFinanceData | null> {
    try {
      console.log(
        `🔍 [BDR] Buscando dados do Yahoo Finance para ${ticker}${
          includeHistorical ? " (com históricos)" : ""
        }...`
      );

      // Importar yahoo-finance2 dinamicamente
      const yahooModule = await import("yahoo-finance2");
      const YahooFinance = yahooModule.default;
      const yahooFinance = new YahooFinance({
        suppressNotices: ["yahooSurvey"],
      });

      const result: YahooFinanceData = {};

      // 1. Buscar Quote básico
      try {
        const quote = await (yahooFinance as any).quote(ticker);
        result.quote = quote as any;
        console.log(
          `  ✅ Quote obtido: ${quote.shortName || quote.longName || ticker}`
        );
      } catch (error: any) {
        console.log(`  ⚠️ Erro no Quote: ${error.message}`);
      }

      // 2. Buscar módulos do QuoteSummary mais importantes
      const modules = [
        "defaultKeyStatistics",
        "financialData",
        "summaryDetail",
        "summaryProfile",
      ];

      for (const moduleName of modules) {
        try {
          const moduleData = await (yahooFinance as any).quoteSummary(ticker, {
            modules: [moduleName as any],
          });
          if (moduleData && moduleData[moduleName]) {
            (result as any)[moduleName] = moduleData[moduleName];
            console.log(`  ✅ ${moduleName}: dados obtidos`);
          }
        } catch (error: any) {
          if (!error.message.includes("No fundamentals data found")) {
            console.log(`  ⚠️ ${moduleName}: ${error.message}`);
          }
        }

        // Delay para evitar rate limiting
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // 3. Buscar dados históricos se solicitado
      if (includeHistorical) {
        console.log(`  📊 Buscando dados históricos para ${ticker}...`);

        // Buscar históricos de balanços, DREs e DFCs
        const historicalModules = [
          "balanceSheetHistory",
          "incomeStatementHistory",
          "cashflowStatementHistory",
        ];

        for (const moduleName of historicalModules) {
          try {
            const moduleData = await (yahooFinance as any).quoteSummary(
              ticker,
              {
                modules: [moduleName as any],
              }
            );
            if (moduleData && moduleData[moduleName]) {
              (result as any)[moduleName] = moduleData[moduleName];
              console.log(`  ✅ ${moduleName}: dados históricos obtidos`);
            }
          } catch (error: any) {
            console.log(`  ⚠️ ${moduleName}: ${error.message}`);
          }

          // Delay maior para dados históricos
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // 4. Buscar FundamentalsTimeSeries se solicitado
        if (includeHistorical) {
          console.log(
            `  💰 Coletando FundamentalsTimeSeries para ${ticker}...`
          );

          const configs = [
            { type: "annual", module: "all" },
            { type: "annual", module: "balance-sheet" },
            { type: "annual", module: "financials" },
            { type: "annual", module: "cash-flow" },
            { type: "quarterly", module: "all" },
          ];

          for (const config of configs) {
            try {
              const data = await (yahooFinance as any).fundamentalsTimeSeries(
                ticker,
                {
                  period1: "2020-01-01",
                  ...config,
                }
              );

              if (data && data.length > 0) {
                if (!result.fundamentalsTimeSeries) {
                  result.fundamentalsTimeSeries = {};
                }
                result.fundamentalsTimeSeries[
                  `${config.type}_${config.module}`
                ] = data;
                console.log(
                  `    ✅ ${config.type} ${config.module}: ${data.length} registros`
                );
              }
            } catch (configError: any) {
              // Tenta extrair dados do erro de validação
              if (
                configError.message.includes(
                  "Failed Yahoo Schema validation"
                ) &&
                configError.result
              ) {
                if (!result.fundamentalsTimeSeries) {
                  result.fundamentalsTimeSeries = {};
                }
                result.fundamentalsTimeSeries[
                  `${config.type}_${config.module}_validation_error`
                ] = {
                  error: configError.message,
                  data: configError.result,
                };
                console.log(
                  `    ⚠️ ${config.type} ${config.module}: dados extraídos do erro de validação`
                );
              } else {
                console.log(
                  `    ❌ ${config.type} ${config.module}: ${configError.message}`
                );
              }
            }

            // Delay entre configurações para evitar rate limiting
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        // 5. Buscar dados adicionais básicos
        try {
          const additionalModules = [
            "earnings",
            "earningsHistory",
            "earningsTrend",
          ];

          for (const moduleName of additionalModules) {
            try {
              const moduleData = await (yahooFinance as any).quoteSummary(
                ticker,
                {
                  modules: [moduleName as any],
                }
              );
              if (moduleData && moduleData[moduleName]) {
                (result as any)[moduleName] = moduleData[moduleName];
                console.log(`  ✅ ${moduleName}: dados obtidos`);
              }
            } catch (error: any) {
              console.log(`  ⚠️ ${moduleName}: ${error.message}`);
            }

            // Delay entre módulos
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        } catch (error: any) {
          console.log(`  ⚠️ Dados adicionais: ${error.message}`);
        }
      }

      console.log(`✅ [BDR] Dados coletados para ${ticker}`);
      return result;
    } catch (error: any) {
      console.error(
        `❌ [BDR] Erro ao buscar dados para ${ticker}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Converte dados do Yahoo Finance para o formato do banco (compatível com fetch-data-ward.ts)
   * Mapeia TODOS os campos disponíveis seguindo exatamente o padrão do fetch-data-ward.ts
   */
  static convertYahooDataToFinancialData(
    yahooData: YahooFinanceData,
    ticker: string,
    year: number = new Date().getFullYear()
  ): any {
    const quote = yahooData.quote;
    const keyStats = yahooData.defaultKeyStatistics;
    const financialData = yahooData.financialData;
    const summaryDetail = yahooData.summaryDetail;

    // Função auxiliar para converter valores
    const convertValue = (value: any): number | null => {
      if (value === null || value === undefined || isNaN(Number(value))) {
        return null;
      }
      return Number(value);
    };

    // Função auxiliar para converter percentuais (Yahoo já retorna em decimal)
    const convertPercentage = (value: any): number | null => {
      const num = convertValue(value);
      return num !== null ? num : null;
    };

    // === EXTRAIR DADOS DOS FUNDAMENTALS TIME SERIES ===
    let fundamentalsData: any = {};
    if (yahooData.fundamentalsTimeSeries) {
      fundamentalsData = this.extractLatestFundamentalsData(
        yahooData.fundamentalsTimeSeries
      );
    }

    // === CÁLCULOS DERIVADOS ===

    // Calcular earnings yield
    let earningsYield = null;
    if (quote?.trailingPE && quote.trailingPE > 0) {
      earningsYield = 1 / quote.trailingPE;
    } else if (
      (quote as any)?.epsTrailingTwelveMonths &&
      quote?.regularMarketPrice &&
      quote.regularMarketPrice > 0
    ) {
      earningsYield =
        (quote as any)?.epsTrailingTwelveMonths / quote.regularMarketPrice;
    }

    // Calcular PSR (Price to Sales Ratio)
    let psr = convertValue(summaryDetail?.priceToSalesTrailing12Months);
    if (
      !psr &&
      quote?.marketCap &&
      financialData?.totalRevenue &&
      financialData.totalRevenue > 0
    ) {
      psr = quote.marketCap / financialData.totalRevenue;
    }

    // Calcular P/Ativos usando dados do FundamentalsTimeSeries
    let pAtivos = null;
    const totalAssets = fundamentalsData.totalAssets || keyStats?.totalAssets;
    if (quote?.marketCap && totalAssets && totalAssets > 0) {
      pAtivos = quote.marketCap / totalAssets;
    }

    // Calcular Giro de Ativos
    let giroAtivos = null;
    if (financialData?.totalRevenue && totalAssets && totalAssets > 0) {
      giroAtivos = financialData.totalRevenue / totalAssets;
    }

    // Calcular P/EBIT usando dados mais precisos
    let pEbit = null;
    const ebit =
      fundamentalsData.EBIT ||
      (financialData?.totalRevenue && financialData?.operatingMargins
        ? financialData.totalRevenue * financialData.operatingMargins
        : null);
    if (quote?.marketCap && ebit && ebit > 0) {
      pEbit = quote.marketCap / ebit;
    }

    // Calcular EV/EBIT
    let evEbit = null;
    if (keyStats?.enterpriseValue && ebit && ebit > 0) {
      evEbit = keyStats.enterpriseValue / ebit;
    }

    // Calcular Dívida Líquida/EBITDA usando dados mais precisos
    let dividaLiquidaEbitda = null;
    const totalDebt = fundamentalsData.totalDebt || financialData?.totalDebt;
    const totalCash =
      fundamentalsData.cashAndCashEquivalents || financialData?.totalCash;
    const ebitda = fundamentalsData.EBITDA || financialData?.ebitda;

    if (totalDebt && totalCash && ebitda && ebitda > 0) {
      const dividaLiquida = totalDebt - totalCash;
      if (dividaLiquida > 0) {
        dividaLiquidaEbitda = dividaLiquida / ebitda;
      } else {
        dividaLiquidaEbitda = 0; // Empresa tem mais caixa que dívida
      }
    }

    // Calcular Dívida Líquida/PL usando dados do FundamentalsTimeSeries
    let dividaLiquidaPl = null;
    const patrimonioLiquido =
      fundamentalsData.stockholdersEquity ||
      fundamentalsData.totalStockholderEquity;
    if (totalDebt && totalCash && patrimonioLiquido && patrimonioLiquido > 0) {
      const dividaLiquida = totalDebt - totalCash;
      if (dividaLiquida > 0) {
        dividaLiquidaPl = dividaLiquida / patrimonioLiquido;
      } else {
        dividaLiquidaPl = 0; // Empresa tem mais caixa que dívida
      }
    }

    // Calcular Lucro Líquido mais preciso
    let lucroLiquido =
      fundamentalsData.netIncome ||
      fundamentalsData.netIncomeCommonStockholders;
    if (
      !lucroLiquido &&
      financialData?.totalRevenue &&
      financialData?.profitMargins
    ) {
      lucroLiquido = financialData.totalRevenue * financialData.profitMargins;
    }

    // Calcular P/Capital de Giro usando dados do balanço
    let pCapGiro = null;
    const ativoCirculante = fundamentalsData.currentAssets;
    const passivoCirculante = fundamentalsData.currentLiabilities;
    if (quote?.marketCap && ativoCirculante && passivoCirculante) {
      const capitalGiro = ativoCirculante - passivoCirculante;
      if (capitalGiro > 0) {
        pCapGiro = quote.marketCap / capitalGiro;
      }
    }

    // Calcular Passivo/Ativos usando dados reais
    let passivoAtivos = null;
    const totalLiabilities =
      fundamentalsData.totalLiabilitiesNetMinorityInterest;
    if (totalAssets && totalLiabilities && totalAssets > 0) {
      passivoAtivos = totalLiabilities / totalAssets;
    }

    return {
      year: year,

      // === INDICADORES DE VALUATION ===
      pl: convertValue(quote?.trailingPE || summaryDetail?.trailingPE),
      forwardPE: convertValue(keyStats?.forwardPE),
      earningsYield: earningsYield,
      pvp: convertValue(
        quote?.priceToBook ||
          keyStats?.priceToBook ||
          (summaryDetail as any)?.priceToBook
      ),
      dy:
        (this.calculateDividendYield(quote, keyStats, summaryDetail) || 0) /
        100,
      evEbitda: convertValue(keyStats?.enterpriseToEbitda),
      evEbit: evEbit,
      evRevenue: convertValue(keyStats?.enterpriseToRevenue),
      psr: psr,
      pAtivos: pAtivos,
      pCapGiro: pCapGiro,
      pEbit: pEbit,
      lpa: convertValue(
        (quote as any)?.epsTrailingTwelveMonths || keyStats?.trailingEps
      ),
      trailingEps: convertValue(
        (quote as any)?.epsTrailingTwelveMonths || keyStats?.trailingEps
      ),
      vpa: convertValue(quote?.bookValue || keyStats?.bookValue),

      // === DADOS DE MERCADO E AÇÕES ===
      marketCap: convertValue(quote?.marketCap || summaryDetail?.marketCap),
      enterpriseValue: convertValue(keyStats?.enterpriseValue),
      sharesOutstanding: convertValue(
        quote?.sharesOutstanding ||
          keyStats?.sharesOutstanding ||
          keyStats?.impliedSharesOutstanding
      ),
      totalAssets: convertValue(totalAssets),

      // === INDICADORES DE ENDIVIDAMENTO E LIQUIDEZ ===
      dividaLiquidaPl: dividaLiquidaPl,
      dividaLiquidaEbitda: dividaLiquidaEbitda,
      liquidezCorrente: convertValue(financialData?.currentRatio),
      liquidezRapida: convertValue(financialData?.quickRatio),
      passivoAtivos: passivoAtivos,
      debtToEquity: convertValue(financialData?.debtToEquity),

      // === INDICADORES DE RENTABILIDADE ===
      roe: convertPercentage(financialData?.returnOnEquity),
      roic: this.calculateROIC(financialData, keyStats, fundamentalsData),
      roa: convertPercentage(financialData?.returnOnAssets),
      margemBruta: convertPercentage(financialData?.grossMargins),
      margemEbitda: convertPercentage(financialData?.ebitdaMargins),
      margemLiquida: convertPercentage(
        financialData?.profitMargins || keyStats?.profitMargins
      ),
      giroAtivos: giroAtivos,

      // === INDICADORES DE CRESCIMENTO ===
      cagrLucros5a: null, // Seria necessário calcular com dados históricos
      cagrReceitas5a: null, // Seria necessário calcular com dados históricos
      crescimentoLucros: convertPercentage(
        financialData?.earningsGrowth ||
          keyStats?.earningsAnnualGrowth ||
          keyStats?.earningsQuarterlyGrowth
      ),
      crescimentoReceitas: convertPercentage(financialData?.revenueGrowth),

      // === DADOS DE DIVIDENDOS ===
      dividendYield12m: convertPercentage(
        quote?.trailingAnnualDividendYield ||
          summaryDetail?.trailingAnnualDividendYield
      ),
      ultimoDividendo: convertValue(
        quote?.trailingAnnualDividendRate ||
          summaryDetail?.trailingAnnualDividendRate
      ),
      dataUltimoDividendo: keyStats?.lastDividendDate
        ? new Date(keyStats.lastDividendDate)
        : null,
      payout: convertPercentage(summaryDetail?.payoutRatio),

      // === PERFORMANCE E VARIAÇÕES ===
      variacao52Semanas: convertPercentage(
        keyStats?.["52WeekChange"] || (quote as any)?.fiftyTwoWeekChangePercent
      ),
      retornoAnoAtual: convertPercentage(keyStats?.ytdReturn),

      // === DADOS FINANCEIROS OPERACIONAIS ===
      ebitda: convertValue(ebitda),
      receitaTotal: convertValue(
        financialData?.totalRevenue || fundamentalsData.totalRevenue
      ),
      lucroLiquido: convertValue(lucroLiquido),
      fluxoCaixaOperacional: convertValue(
        financialData?.operatingCashflow || fundamentalsData.operatingCashFlow
      ),
      fluxoCaixaInvestimento: convertValue(fundamentalsData.investingCashFlow),
      fluxoCaixaFinanciamento: convertValue(fundamentalsData.financingCashFlow),
      fluxoCaixaLivre: convertValue(
        financialData?.freeCashflow || fundamentalsData.freeCashFlow
      ),
      totalCaixa: convertValue(totalCash),
      totalDivida: convertValue(totalDebt),
      receitaPorAcao: convertValue(financialData?.revenuePerShare),
      caixaPorAcao: convertValue(financialData?.totalCashPerShare),

      // === DADOS DO BALANÇO PATRIMONIAL ===
      ativoCirculante: convertValue(ativoCirculante),
      ativoTotal: convertValue(totalAssets),
      passivoCirculante: convertValue(passivoCirculante),
      passivoTotal: convertValue(totalLiabilities),
      patrimonioLiquido: convertValue(patrimonioLiquido),
      caixa: convertValue(totalCash),
      estoques: convertValue(fundamentalsData.inventory),
      contasReceber: convertValue(
        fundamentalsData.accountsReceivable || fundamentalsData.receivables
      ),
      imobilizado: convertValue(
        fundamentalsData.netPPE || fundamentalsData.propertyPlantEquipment
      ),
      intangivel: convertValue(
        fundamentalsData.goodwillAndOtherIntangibleAssets ||
          fundamentalsData.otherIntangibleAssets
      ),
      dividaCirculante: convertValue(fundamentalsData.currentLiabilities),
      dividaLongoPrazo: convertValue(
        fundamentalsData.longTermDebt ||
          fundamentalsData.longTermDebtAndCapitalLeaseObligation
      ),

      // === DADOS DE DIVIDENDOS DETALHADOS ===
      dividendoMaisRecente: convertValue(keyStats?.lastDividendValue),
      dataDividendoMaisRecente: keyStats?.lastDividendDate
        ? new Date(keyStats.lastDividendDate)
        : null,
      historicoUltimosDividendos: null, // Seria necessário módulo específico de dividendos

      // === METADADOS ===
      dataSource: "yahoo_finance_bdr",
    };
  }

  /**
   * Extrai os dados mais recentes do FundamentalsTimeSeries
   */
  static extractLatestFundamentalsData(fundamentalsTimeSeries: any): any {
    const latestData: any = {};

    // Processar todas as configurações disponíveis
    for (const [_configKey, configData] of Object.entries(
      fundamentalsTimeSeries
    )) {
      let dataToProcess = configData;

      // Se for erro de validação, extrair dados
      if ((configData as any)?.error && (configData as any)?.data) {
        dataToProcess = (configData as any).data;
      }

      if (Array.isArray(dataToProcess) && dataToProcess.length > 0) {
        // Pegar o registro mais recente (último do array)
        const latestRecord = dataToProcess[dataToProcess.length - 1];

        if (latestRecord && typeof latestRecord === "object") {
          // Mesclar todos os campos disponíveis
          Object.entries(latestRecord).forEach(([key, value]) => {
            if (
              key !== "date" &&
              key !== "periodType" &&
              key !== "TYPE" &&
              value !== null &&
              value !== undefined
            ) {
              latestData[key] = value;
            }
          });
        }
      }
    }

    return latestData;
  }

  /**
   * Processa dados históricos completos do FundamentalsTimeSeries para Financial Data
   */
  static async processHistoricalFinancialDataFromFundamentals(
    companyId: number,
    ticker: string,
    fundamentalsTimeSeries: any
  ): Promise<void> {
    console.log(
      `📊 [BDR] Processando dados históricos completos do FundamentalsTimeSeries...`
    );

    try {
      // Agrupar dados por ano
      const dataByYear: { [year: number]: any } = {};

      // Processar todas as configurações disponíveis
      for (const [configKey, configData] of Object.entries(
        fundamentalsTimeSeries
      )) {
        let dataToProcess = configData;

        // Se for erro de validação, extrair dados
        if ((configData as any)?.error && (configData as any)?.data) {
          dataToProcess = (configData as any).data;
        }

        if (Array.isArray(dataToProcess) && dataToProcess.length > 0) {
          console.log(
            `  📈 Processando ${configKey}: ${dataToProcess.length} registros`
          );

          for (const record of dataToProcess) {
            if (record && record.date && typeof record === "object") {
              // Converter timestamp para ano
              const timestamp = record.date;
              const year =
                timestamp > 2000000000
                  ? new Date(timestamp).getFullYear()
                  : new Date(timestamp * 1000).getFullYear();

              // Validar ano
              if (year >= 2000 && year <= new Date().getFullYear()) {
                if (!dataByYear[year]) {
                  dataByYear[year] = {};
                }

                // Mesclar dados do registro
                Object.entries(record).forEach(([key, value]) => {
                  if (
                    key !== "date" &&
                    key !== "periodType" &&
                    key !== "TYPE" &&
                    value !== null &&
                    value !== undefined
                  ) {
                    dataByYear[year][key] = value;
                  }
                });
              }
            }
          }
        }
      }

      // Processar cada ano
      let processedYears = 0;
      const currentYear = new Date().getFullYear();

      for (const [yearStr, yearData] of Object.entries(dataByYear)) {
        const year = parseInt(yearStr);

        if (year !== currentYear && Object.keys(yearData).length > 0) {
          try {
            console.log(
              `    📅 Processando ano ${year} com ${
                Object.keys(yearData).length
              } campos...`
            );

            // Converter dados do FundamentalsTimeSeries para Financial Data
            const historicalFinancialData =
              this.convertFundamentalsToFinancialData(yearData, ticker, year);

            // Salvar dados históricos
            await this.saveBDRFinancialData(
              companyId,
              ticker,
              historicalFinancialData
            );
            processedYears++;

            console.log(`      ✅ Ano ${year} processado com dados completos`);
          } catch (error: any) {
            console.warn(
              `      ⚠️ Erro ao processar ano ${year}:`,
              error.message
            );
          }
        }
      }

      if (processedYears > 0) {
        console.log(
          `✅ [BDR] ${processedYears} anos históricos processados com dados completos do FundamentalsTimeSeries`
        );
      } else {
        console.log(
          `⚠️ [BDR] Nenhum ano histórico válido encontrado no FundamentalsTimeSeries`
        );
      }
    } catch (error: any) {
      console.error(
        `❌ [BDR] Erro ao processar dados históricos do FundamentalsTimeSeries:`,
        error.message
      );
    }
  }

  /**
   * Converte dados do FundamentalsTimeSeries para formato Financial Data
   */
  static convertFundamentalsToFinancialData(
    fundamentalsData: any | null | undefined,
    ticker: string,
    year: number
  ): any {
    // Verificar se fundamentalsData é válido
    if (!fundamentalsData || typeof fundamentalsData !== "object") {
      return {
        year,
        dataSource: "yahoo_finance_bdr_fundamentals_historical",
      };
    }

    // Função auxiliar para converter valores
    const convertValue = (value: any): number => {
      if (value === null || value === undefined || isNaN(Number(value))) {
        return 0;
      }
      return Number(value);
    };

    // Extrair dados principais
    const totalRevenue = convertValue(
      fundamentalsData.totalRevenue || fundamentalsData.operatingRevenue
    );
    const netIncome = convertValue(
      fundamentalsData.netIncome || fundamentalsData.netIncomeCommonStockholders
    );
    const totalAssets = convertValue(fundamentalsData.totalAssets);
    const stockholdersEquity = convertValue(
      fundamentalsData.stockholdersEquity || fundamentalsData.commonStockEquity
    );
    const totalDebt = convertValue(
      fundamentalsData.totalDebt ||
        fundamentalsData.longTermDebtAndCapitalLeaseObligation
    );
    const cashAndEquivalents = convertValue(
      fundamentalsData.cashAndCashEquivalents
    );
    const currentAssets = convertValue(fundamentalsData.currentAssets);
    const currentLiabilities = convertValue(
      fundamentalsData.currentLiabilities
    );
    const ebitda = convertValue(
      fundamentalsData.EBITDA || fundamentalsData.normalizedEBITDA
    );
    const ebit = convertValue(fundamentalsData.EBIT);
    const operatingCashFlow = convertValue(
      fundamentalsData.operatingCashFlow ||
        fundamentalsData.cashFlowFromContinuingOperatingActivities
    );
    const investingCashFlow = convertValue(
      fundamentalsData.investingCashFlow ||
        fundamentalsData.cashFlowFromContinuingInvestingActivities
    );
    const financingCashFlow = convertValue(
      fundamentalsData.financingCashFlow ||
        fundamentalsData.cashFlowFromContinuingFinancingActivities
    );
    const freeCashFlow = convertValue(fundamentalsData.freeCashFlow);

    // Calcular indicadores derivados
    let margemLiquida = null;
    if (netIncome && totalRevenue && totalRevenue > 0) {
      margemLiquida = netIncome / totalRevenue;
    }

    let margemEbitda = null;
    if (ebitda && totalRevenue && totalRevenue > 0) {
      margemEbitda = ebitda / totalRevenue;
    }

    let margemBruta = null;
    const grossProfit = convertValue(fundamentalsData.grossProfit);
    if (grossProfit && totalRevenue && totalRevenue > 0) {
      margemBruta = grossProfit / totalRevenue;
    }

    // margemOperacional removido - não existe no schema

    let roe = null;
    if (netIncome && stockholdersEquity && stockholdersEquity > 0) {
      roe = netIncome / stockholdersEquity;
    }

    let roa = null;
    if (netIncome && totalAssets && totalAssets > 0) {
      roa = netIncome / totalAssets;
    }

    let liquidezCorrente = null;
    if (currentAssets && currentLiabilities && currentLiabilities > 0) {
      liquidezCorrente = currentAssets / currentLiabilities;
    }

    let liquidezRapida = null;
    const inventory = convertValue(fundamentalsData?.inventory);
    const quickAssets =
      currentAssets && inventory ? currentAssets - inventory : currentAssets;
    if (quickAssets && currentLiabilities && currentLiabilities > 0) {
      liquidezRapida = quickAssets / currentLiabilities;
    }

    let debtToEquity = null;
    if (totalDebt && stockholdersEquity && stockholdersEquity > 0) {
      debtToEquity = (totalDebt / stockholdersEquity) * 100; // Em percentual
    }

    let dividaLiquidaEbitda = null;
    if (totalDebt && cashAndEquivalents && ebitda && ebitda > 0) {
      const dividaLiquida = totalDebt - cashAndEquivalents;
      if (dividaLiquida > 0) {
        dividaLiquidaEbitda = dividaLiquida / ebitda;
      } else {
        dividaLiquidaEbitda = 0;
      }
    }

    let dividaLiquidaPl = null;
    if (
      totalDebt &&
      cashAndEquivalents &&
      stockholdersEquity &&
      stockholdersEquity > 0
    ) {
      const dividaLiquida = totalDebt - cashAndEquivalents;
      if (dividaLiquida > 0) {
        dividaLiquidaPl = dividaLiquida / stockholdersEquity;
      } else {
        dividaLiquidaPl = 0;
      }
    }

    let giroAtivos = null;
    if (totalRevenue && totalAssets && totalAssets > 0) {
      giroAtivos = totalRevenue / totalAssets;
    }

    let passivoAtivos = null;
    const totalLiabilities = convertValue(
      fundamentalsData.totalLiabilitiesNetMinorityInterest
    );
    if (totalLiabilities && totalAssets && totalAssets > 0) {
      passivoAtivos = totalLiabilities / totalAssets;
    }

    // P/Capital de Giro não pode ser calculado sem market cap atual para anos históricos
    const pCapGiro = null;

    let roic = null;
    const investedCapital = convertValue(fundamentalsData.investedCapital);
    if (ebit && investedCapital && investedCapital > 0) {
      roic = ebit / investedCapital;
    } else if (ebit && stockholdersEquity && totalDebt) {
      const estimatedInvestedCapital = stockholdersEquity + totalDebt;
      if (estimatedInvestedCapital > 0) {
        roic = ebit / estimatedInvestedCapital;
      }
    }

    // Calcular crescimento de receitas (se temos dados de anos anteriores)
    const crescimentoReceitas = null;
    // Não podemos calcular crescimento sem dados do ano anterior - deixar NULL

    // Calcular crescimento de lucros (se temos dados de anos anteriores)
    const crescimentoLucros = null;
    // Não podemos calcular crescimento sem dados do ano anterior - deixar NULL

    return {
      year: year,

      // === DADOS FINANCEIROS OPERACIONAIS ===
      receitaTotal: totalRevenue,
      lucroLiquido: netIncome,
      ebitda: ebitda,
      fluxoCaixaOperacional: operatingCashFlow,
      fluxoCaixaInvestimento: investingCashFlow,
      fluxoCaixaFinanciamento: financingCashFlow,
      fluxoCaixaLivre: freeCashFlow,

      // === DADOS DO BALANÇO PATRIMONIAL ===
      ativoTotal: totalAssets,
      ativoCirculante: currentAssets,
      passivoCirculante: currentLiabilities,
      patrimonioLiquido: stockholdersEquity,
      totalCaixa: cashAndEquivalents,
      caixa: cashAndEquivalents,
      totalDivida: totalDebt,
      estoques: convertValue(fundamentalsData.inventory),
      contasReceber: convertValue(
        fundamentalsData.accountsReceivable || fundamentalsData.receivables
      ),
      imobilizado: convertValue(fundamentalsData.netPPE),
      intangivel: convertValue(
        fundamentalsData.goodwillAndOtherIntangibleAssets ||
          fundamentalsData.otherIntangibleAssets
      ),
      dividaLongoPrazo: convertValue(fundamentalsData.longTermDebt),

      // === INDICADORES DE RENTABILIDADE ===
      roe: roe,
      roa: roa,
      roic: roic,
      margemBruta: margemBruta,
      margemEbitda: margemEbitda,
      margemLiquida: margemLiquida,
      giroAtivos: giroAtivos,

      // === INDICADORES DE ENDIVIDAMENTO E LIQUIDEZ ===
      liquidezCorrente: liquidezCorrente,
      liquidezRapida: liquidezRapida,
      debtToEquity: debtToEquity,
      dividaLiquidaEbitda: dividaLiquidaEbitda,
      dividaLiquidaPl: dividaLiquidaPl,
      passivoAtivos: passivoAtivos,

      // === INDICADORES DE CRESCIMENTO ===
      crescimentoReceitas: crescimentoReceitas,
      crescimentoLucros: crescimentoLucros,

      // === INDICADORES DE VALUATION (NULL para anos históricos) ===
      pl: null, // Precisa do preço atual da ação
      forwardPE: null, // Projeção futura
      earningsYield: null, // Precisa do preço atual
      pvp: null, // Precisa do preço atual
      dy: null, // Precisa de dados de dividendos específicos do ano
      evEbitda: null, // Precisa do Enterprise Value atual
      evEbit: null, // Precisa do Enterprise Value atual
      evRevenue: null, // Precisa do Enterprise Value atual
      psr: null, // Precisa do Market Cap atual
      pAtivos: null, // Precisa do Market Cap atual
      pCapGiro: pCapGiro, // NULL para anos históricos
      pEbit: null, // Precisa do Market Cap atual

      // === DADOS DE MERCADO (NULL para anos históricos) ===
      marketCap: null, // Valor de mercado atual
      enterpriseValue: null, // Valor atual
      // Calcular LPA corretamente usando lucro líquido e ações em circulação
      lpa: (() => {
        if (!fundamentalsData) return null;
        const data = fundamentalsData as any;
        const shares = data.shareIssued || data.ordinarySharesNumber;
        if (netIncome && shares) {
          return netIncome / convertValue(shares);
        }
        const eps = data.basicEPS || data.dilutedEPS;
        return convertValue(eps);
      })(),
      trailingEps: (() => {
        if (!fundamentalsData) return null;
        const data = fundamentalsData as any;
        const shares = data.shareIssued || data.ordinarySharesNumber;
        if (netIncome && shares) {
          return netIncome / convertValue(shares);
        }
        const eps = data.basicEPS || data.dilutedEPS;
        return convertValue(eps);
      })(),
      vpa: (() => {
        if (!fundamentalsData) return null;
        const data = fundamentalsData as any;
        const shares = data.shareIssued;
        if (stockholdersEquity && shares) {
          return stockholdersEquity / convertValue(shares);
        }
        return null;
      })(),
      sharesOutstanding: (() => {
        if (!fundamentalsData) return null;
        const data = fundamentalsData as any;
        return convertValue(data.shareIssued || data.ordinarySharesNumber);
      })(),

      // === METADADOS ===
      dataSource: "yahoo_finance_bdr_fundamentals_historical",
    };
  }

  /**
   * Cria ou atualiza empresa BDR no banco de dados
   */
  static async createOrUpdateBDRCompany(
    ticker: string,
    yahooData: YahooFinanceData
  ): Promise<{ id: number; ticker: string; name: string } | null> {
    try {
      // Limpar ticker para salvar no banco (remover .SA)
      const cleanTicker = this.cleanTickerForDB(ticker);
      console.log(
        `🏢 [BDR] Verificando empresa ${cleanTicker} no banco (Yahoo: ${ticker})...`
      );

      // Verificar se a empresa já existe com retry
      let company = null;
      let retries = 3;

      while (retries > 0 && !company) {
        try {
          company = await prisma.company.findUnique({
            where: { ticker: cleanTicker.toUpperCase() },
          });
          break;
        } catch (error: any) {
          retries--;
          if (error.message.includes("Timed out") && retries > 0) {
            console.log(
              `⚠️ [BDR] Timeout na consulta, tentando novamente... (${retries} tentativas restantes)`
            );
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } else {
            throw error;
          }
        }
      }

      const quote = yahooData.quote;
      const profile = yahooData.summaryProfile;

      const companyName = quote?.longName || quote?.shortName || cleanTicker;

      if (company) {
        console.log(
          `✅ [BDR] Empresa ${cleanTicker} já existe: ${company.name}`
        );

        // Sempre atualizar o campo de controle BDR
        const updateData: any = {
          yahooLastBdrUpdatedAt: new Date(),
        };

        // Atualizar dados básicos se necessário
        if (!company.description && profile?.longBusinessSummary) {
          updateData.description = profile.longBusinessSummary;
          updateData.sector = profile?.sector || profile?.sectorDisp;
          updateData.industry = profile?.industry || profile?.industryDisp;
          updateData.website = profile?.website;
          updateData.address = profile?.address1;
          updateData.city = profile?.city;
          updateData.state = profile?.state;
          updateData.country = profile?.country;
          updateData.phone = profile?.phone;
          updateData.fullTimeEmployees = profile?.fullTimeEmployees;
        }

        await prisma.company.update({
          where: { id: company.id },
          data: updateData,
        });

        console.log(
          `📝 [BDR] Campo de controle atualizado para ${cleanTicker}`
        );
        return company;
      }

      // Criar nova empresa BDR com retry
      console.log(`🆕 [BDR] Criando nova empresa ${cleanTicker}...`);

      retries = 3;
      while (retries > 0 && !company) {
        try {
          company = await prisma.company.create({
            data: {
              ticker: cleanTicker.toUpperCase(),
              name: companyName,
              assetType: "BDR", // Definir como BDR
              sector: profile?.sector || profile?.sectorDisp || "BDR",
              industry:
                profile?.industry ||
                profile?.industryDisp ||
                "Brazilian Depositary Receipt",
              description:
                profile?.longBusinessSummary ||
                `BDR representando ações de ${companyName}`,
              website: profile?.website || null,

              // Dados de localização (empresa original, não brasileira)
              address: profile?.address1 || null,
              address2: profile?.address2 || null,
              address3: profile?.address3 || null,
              city: profile?.city || null,
              state: profile?.state || null,
              country: profile?.country || "US", // Maioria dos BDRs são de empresas americanas
              zip: profile?.zip || null,

              // Dados de contato
              phone: profile?.phone || null,
              fax: profile?.fax || null,

              // Dados corporativos
              fullTimeEmployees: profile?.fullTimeEmployees || null,
              industryKey: profile?.industryKey || null,
              industryDisp: profile?.industryDisp || null,
              sectorKey: profile?.sectorKey || null,
              sectorDisp: profile?.sectorDisp || null,

              // Campo de controle BDR
              yahooLastBdrUpdatedAt: new Date(),

              logoUrl: null, // Yahoo Finance não fornece logo diretamente
            },
          });
          break;
        } catch (error: any) {
          retries--;
          if (error.message.includes("Timed out") && retries > 0) {
            console.log(
              `⚠️ [BDR] Timeout na criação, tentando novamente... (${retries} tentativas restantes)`
            );
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } else {
            throw error;
          }
        }
      }

      if (!company) {
        throw new Error("Falha ao criar empresa após múltiplas tentativas");
      }

      console.log(
        `✅ [BDR] Empresa criada: ${company.ticker} - ${company.name}`
      );
      if (company.sector) {
        console.log(`🏭 [BDR] Setor: ${company.sector}`);
      }

      // Criar cotação atual se disponível
      if (quote?.regularMarketPrice) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.dailyQuote.upsert({
          where: {
            companyId_date: {
              companyId: company.id,
              date: today,
            },
          },
          update: {
            price: quote.regularMarketPrice,
          },
          create: {
            companyId: company.id,
            date: today,
            price: quote.regularMarketPrice,
          },
        });

        console.log(
          `💰 [BDR] Cotação criada: ${ticker} - R$ ${quote.regularMarketPrice}`
        );
      }

      return company;
    } catch (error: any) {
      console.error(
        `❌ [BDR] Erro ao criar/atualizar empresa ${ticker}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Calcula múltiplos históricos usando preços históricos
   */
  static async calculateHistoricalMultiples(
    companyId: number,
    ticker: string
  ): Promise<void> {
    try {
      console.log(`📈 [BDR] Calculando múltiplos históricos para ${ticker}...`);

      // Buscar dados financeiros históricos (últimos 5 anos)
      const currentYear = new Date().getFullYear();
      const startYear = currentYear - 5;

      const financialDataList = await prisma.financialData.findMany({
        where: {
          companyId: companyId,
          year: {
            gte: startYear,
            lt: currentYear, // Excluir ano atual (já tem múltiplos atuais)
          },
        },
        orderBy: {
          year: "desc",
        },
      });

      if (financialDataList.length === 0) {
        console.log(
          `⚠️ [BDR] Nenhum dado financeiro histórico encontrado para ${ticker}`
        );
        return;
      }

      // Buscar preços históricos (final de cada ano)
      for (const financialData of financialDataList) {
        const year = financialData.year;

        // Buscar preço mais próximo do final do ano
        // Primeiro tentar buscar no final do ano (dezembro)
        let historicalPrice = await prisma.historicalPrice.findFirst({
          where: {
            companyId: companyId,
            date: {
              gte: new Date(year, 11, 1), // 1º de dezembro
              lte: new Date(year, 11, 31), // 31 de dezembro
            },
          },
          orderBy: {
            date: "desc", // Pegar o mais recente
          },
        });

        // Se não encontrar em dezembro, buscar o preço mais próximo do ano
        if (!historicalPrice) {
          historicalPrice = await prisma.historicalPrice.findFirst({
            where: {
              companyId: companyId,
              date: {
                gte: new Date(year, 0, 1), // 1º de janeiro
                lte: new Date(year, 11, 31), // 31 de dezembro
              },
            },
            orderBy: {
              date: "desc", // Pegar o mais recente do ano
            },
          });
        }

        if (!historicalPrice) {
          console.log(
            `⚠️ [BDR] Preço histórico não encontrado para ${ticker} em ${year}`
          );
          continue;
        }

        const price = Number(historicalPrice.close);
        const sharesOutstanding = financialData.sharesOutstanding
          ? Number(financialData.sharesOutstanding)
          : null;

        if (!sharesOutstanding || sharesOutstanding <= 0) {
          console.log(
            `⚠️ [BDR] Ações em circulação não disponíveis para ${ticker} em ${year}`
          );
          continue;
        }

        // Calcular Market Cap histórico
        const marketCap = price * sharesOutstanding;

        // Calcular múltiplos históricos
        const updates: any = {
          marketCap: marketCap,
        };

        // P/L (Price to Earnings)
        if (financialData.lpa && Number(financialData.lpa) > 0) {
          updates.pl = price / Number(financialData.lpa);
        }

        // P/VPA (Price to Book Value)
        if (financialData.vpa && Number(financialData.vpa) > 0) {
          updates.pvp = price / Number(financialData.vpa);
        }

        // Earnings Yield (inverso do P/L)
        if (updates.pl && updates.pl > 0) {
          updates.earningsYield = 1 / updates.pl;
        }

        // P/S (Price to Sales)
        if (
          financialData.receitaTotal &&
          Number(financialData.receitaTotal) > 0
        ) {
          const revenuePerShare =
            Number(financialData.receitaTotal) / sharesOutstanding;
          if (revenuePerShare > 0) {
            updates.psr = price / revenuePerShare;
          }
        }

        // P/Ativos (Price to Assets)
        if (financialData.ativoTotal && Number(financialData.ativoTotal) > 0) {
          updates.pAtivos = marketCap / Number(financialData.ativoTotal);
        }

        // EV/EBITDA (Enterprise Value to EBITDA)
        if (
          financialData.ebitda &&
          Number(financialData.ebitda) > 0 &&
          financialData.totalDivida &&
          financialData.caixa
        ) {
          const enterpriseValue =
            marketCap +
            Number(financialData.totalDivida) -
            Number(financialData.caixa);
          updates.enterpriseValue = enterpriseValue;
          updates.evEbitda = enterpriseValue / Number(financialData.ebitda);
        }

        // Atualizar dados financeiros com múltiplos históricos
        await prisma.financialData.update({
          where: {
            companyId_year: {
              companyId: companyId,
              year: year,
            },
          },
          data: updates,
        });

        console.log(
          `✅ [BDR] Múltiplos históricos calculados para ${ticker} (${year}): P/L=${updates.pl?.toFixed(
            2
          )}, P/VPA=${updates.pvp?.toFixed(2)}, P/S=${updates.psr?.toFixed(2)}`
        );
      }

      console.log(
        `📈 [BDR] Múltiplos históricos calculados para ${ticker} (${financialDataList.length} anos)`
      );
    } catch (error: any) {
      console.error(
        `❌ [BDR] Erro ao calcular múltiplos históricos para ${ticker}:`,
        error.message
      );
    }
  }

  /**
   * Salva dados financeiros de BDR no banco (compatível com fetch-data-ward.ts)
   */
  static async saveBDRFinancialData(
    companyId: number,
    ticker: string,
    financialData: any
  ): Promise<void> {
    try {
      console.log(`💾 [BDR] Salvando dados financeiros para ${ticker}...`);

      // Verificar se já existe dados para este ano
      const existingData = await prisma.financialData.findUnique({
        where: {
          companyId_year: {
            companyId: companyId,
            year: financialData.year,
          },
        },
      });

      if (existingData) {
        // Atualizar dados existentes
        await prisma.financialData.update({
          where: {
            companyId_year: {
              companyId: companyId,
              year: financialData.year,
            },
          },
          data: {
            // Remover campos que não devem ser atualizados
            ...Object.fromEntries(
              Object.entries(financialData).filter(
                ([key]) => key !== "year" && key !== "companyId"
              )
            ),
          },
        });
        console.log(
          `📊 [BDR] Dados financeiros atualizados para ${ticker} (${financialData.year})`
        );
      } else {
        // Criar novos dados
        await prisma.financialData.create({
          data: {
            companyId: companyId,
            ...financialData,
          },
        });
        console.log(
          `📊 [BDR] Dados financeiros criados para ${ticker} (${financialData.year})`
        );
      }
    } catch (error: any) {
      console.error(
        `❌ [BDR] Erro ao salvar dados financeiros para ${ticker}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Processa um BDR completo (busca dados + salva no banco)
   */
  static async processBDR(
    ticker: string,
    includeHistorical: boolean = false
  ): Promise<boolean> {
    try {
      console.log(
        `\n🔄 [BDR] Processando ${ticker}${
          includeHistorical ? " (completo com históricos)" : ""
        }...`
      );

      // 1. Buscar dados do Yahoo Finance
      const yahooData = await this.fetchBDRData(ticker, includeHistorical);
      if (!yahooData) {
        console.log(`❌ [BDR] Não foi possível obter dados para ${ticker}`);
        return false;
      }

      // 2. Criar/atualizar empresa
      const company = await this.createOrUpdateBDRCompany(ticker, yahooData);
      if (!company) {
        console.log(
          `❌ [BDR] Não foi possível criar/atualizar empresa para ${ticker}`
        );
        return false;
      }

      // 3. Converter e salvar dados financeiros do ano atual
      const currentYear = new Date().getFullYear();
      const financialData = this.convertYahooDataToFinancialData(
        yahooData,
        ticker,
        currentYear
      );

      await this.saveBDRFinancialData(company.id, ticker, financialData);

      // 4. Processar dados históricos usando FundamentalsTimeSeries
      if (yahooData.fundamentalsTimeSeries) {
        console.log(`📊 PROCESSANDO DADOS DO FUNDAMENTALSTIMESERIES:`);
        await this.processFundamentalsTimeSeries(
          company.id,
          ticker,
          yahooData.fundamentalsTimeSeries
        );

        // Processar dados específicos para Balance Sheets e Cashflow Statements
        await this.processFundamentalsToBalanceSheets(
          company.id,
          ticker,
          yahooData.fundamentalsTimeSeries
        );
        await this.processFundamentalsToCashflowStatements(
          company.id,
          ticker,
          yahooData.fundamentalsTimeSeries
        );
      }

      // 5. Processar Key Statistics se disponível
      if (yahooData.defaultKeyStatistics) {
        console.log(`📊 PROCESSANDO KEY STATISTICS:`);
        await this.processKeyStatistics(
          company.id,
          ticker,
          yahooData.defaultKeyStatistics
        );
      }

      // 5. Processar dados históricos usando earnings se disponível
      if (yahooData.earnings) {
        console.log(`📊 [BDR] Processando dados de earnings para ${ticker}...`);
        // Processar earnings data se necessário
      }

      // 6. Processar dados históricos completos usando FundamentalsTimeSeries
      if (yahooData.fundamentalsTimeSeries) {
        console.log(
          `📊 [BDR] Processando dados históricos completos do FundamentalsTimeSeries para ${ticker}...`
        );
        await this.processHistoricalFinancialDataFromFundamentals(
          company.id,
          ticker,
          yahooData.fundamentalsTimeSeries
        );
      }

      // 7. Processar dados históricos básicos se disponíveis (earnings chart como fallback)
      if (yahooData.earnings?.financialsChart?.yearly) {
        console.log(
          `📊 [BDR] Processando dados históricos básicos (earnings chart) para ${ticker}...`
        );

        const yearlyData = yahooData.earnings.financialsChart.yearly;
        let historicalCount = 0;

        for (const yearData of yearlyData) {
          if (yearData.date && yearData.date !== currentYear) {
            try {
              // Criar dados financeiros básicos para anos históricos
              const historicalFinancialData = {
                year: yearData.date,
                receitaTotal: this.convertValue(yearData.revenue),
                lucroLiquido: this.convertValue(yearData.earnings),
                // Calcular margem líquida se possível
                margemLiquida:
                  yearData.revenue && yearData.earnings && yearData.revenue > 0
                    ? yearData.earnings / yearData.revenue
                    : null,
                dataSource: "yahoo_finance_bdr_historical",
              };

              await this.saveBDRFinancialData(
                company.id,
                ticker,
                historicalFinancialData
              );
              historicalCount++;
            } catch (error: any) {
              console.warn(
                `⚠️ [BDR] Erro ao salvar dados históricos de ${yearData.date} para ${ticker}:`,
                error.message
              );
            }
          }
        }

        if (historicalCount > 0) {
          console.log(
            `📈 [BDR] ${historicalCount} anos históricos básicos processados para ${ticker}`
          );
        }
      }

      // 6. Processar dados históricos completos se solicitado
      if (includeHistorical) {
        console.log(
          `🔍 [BDR] Processando dados históricos completos para ${ticker}...`
        );

        // Processar balanços históricos
        if (yahooData.balanceSheetHistory) {
          await this.processHistoricalBalanceSheets(
            company.id,
            ticker,
            yahooData.balanceSheetHistory
          );
        }

        // Processar DREs históricas
        if (yahooData.incomeStatementHistory) {
          await this.processHistoricalIncomeStatements(
            company.id,
            ticker,
            yahooData.incomeStatementHistory
          );
        }

        // Processar DFCs históricos
        if (yahooData.cashflowStatementHistory) {
          await this.processHistoricalCashflowStatements(
            company.id,
            ticker,
            yahooData.cashflowStatementHistory
          );
        }

        // Processar preços históricos
        await this.processHistoricalPrices(company.id, ticker);

        // Calcular múltiplos históricos usando preços históricos
        await this.calculateHistoricalMultiples(company.id, ticker);

        // Processar dividendos históricos
        await this.processHistoricalDividends(company.id, ticker);

        console.log(
          `📊 [BDR] Dados históricos completos processados para ${ticker}`
        );
      }

      console.log(`✅ [BDR] ${ticker} processado com sucesso`);
      return true;
    } catch (error: any) {
      console.error(`❌ [BDR] Erro ao processar ${ticker}:`, error.message);
      return false;
    }
  }

  /**
   * Função auxiliar para converter valores (reutilizada)
   */
  private static convertValue = (value: any): number | null => {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return null;
    }
    return Number(value);
  };

  /**
   * Calcula ROIC (Return on Invested Capital) usando dados disponíveis
   */
  static calculateROIC(
    financialData: any,
    keyStats: any,
    fundamentalsData?: any
  ): number | null {
    try {
      // ROIC = EBIT / Invested Capital

      let ebit = null;

      // Tentar obter EBIT de diferentes fontes (mais precisas primeiro)
      if (fundamentalsData?.EBIT) {
        ebit = fundamentalsData.EBIT;
      } else if (financialData?.ebit) {
        ebit = financialData.ebit;
      } else if (
        financialData?.totalRevenue &&
        financialData?.operatingMargins
      ) {
        // EBIT = Revenue * Operating Margin
        ebit = financialData.totalRevenue * financialData.operatingMargins;
      }

      // Calcular Invested Capital usando dados mais precisos
      let investedCapital = null;

      // Método 1: Usar dados do FundamentalsTimeSeries (mais preciso)
      if (fundamentalsData?.investedCapital) {
        investedCapital = fundamentalsData.investedCapital;
      }
      // Método 2: Calcular como Patrimônio Líquido + Dívida Total
      else if (
        fundamentalsData?.stockholdersEquity &&
        fundamentalsData?.totalDebt
      ) {
        investedCapital =
          fundamentalsData.stockholdersEquity + fundamentalsData.totalDebt;
      }
      // Método 3: Usar total assets menos current liabilities (mais conservador)
      else if (
        fundamentalsData?.totalAssets &&
        fundamentalsData?.currentLiabilities
      ) {
        investedCapital =
          fundamentalsData.totalAssets - fundamentalsData.currentLiabilities;
      }
      // Método 4: Fallback para dados básicos
      else if (keyStats?.totalAssets) {
        investedCapital = keyStats.totalAssets;
      }
      // Método 5: Estimar usando debt-to-equity ratio
      else if (
        financialData?.totalDebt &&
        financialData?.debtToEquity &&
        financialData.debtToEquity > 0
      ) {
        const patrimonioLiquido =
          financialData.totalDebt / (financialData.debtToEquity / 100);
        investedCapital = patrimonioLiquido + financialData.totalDebt;
      }

      // Calcular ROIC se temos ambos os valores
      if (ebit && investedCapital && investedCapital > 0) {
        return ebit / investedCapital;
      }

      return null;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Calcula Dividend Yield usando dados disponíveis
   */
  static calculateDividendYield(
    quote: any,
    keyStats: any,
    summaryDetail: any
  ): number | null {
    try {
      // Tentar diferentes fontes de dividend yield
      let dividendYield = null;

      // 1. Dividend yield direto do quote
      if (quote?.dividendYield && quote.dividendYield > 0) {
        dividendYield = quote.dividendYield;
      }
      // 2. Trailing annual dividend yield
      else if (
        quote?.trailingAnnualDividendYield &&
        quote.trailingAnnualDividendYield > 0
      ) {
        dividendYield = quote.trailingAnnualDividendYield;
      }
      // 3. Key statistics dividend yield
      else if (keyStats?.dividendYield && keyStats.dividendYield > 0) {
        dividendYield = keyStats.dividendYield;
      }
      // 4. Calcular manualmente se temos dividend rate e preço
      else if (
        quote?.trailingAnnualDividendRate &&
        quote?.regularMarketPrice &&
        quote.regularMarketPrice > 0
      ) {
        dividendYield =
          quote.trailingAnnualDividendRate / quote.regularMarketPrice;
      }
      // 5. Usar summary detail
      else if (
        summaryDetail?.dividendYield &&
        summaryDetail.dividendYield > 0
      ) {
        dividendYield = summaryDetail.dividendYield;
      }

      // Converter para decimal se necessário (Yahoo às vezes retorna em percentual)
      if (dividendYield && dividendYield > 1) {
        dividendYield = dividendYield / 100;
      }

      return dividendYield;
    } catch (error: any) {
      console.warn("Erro ao calcular dividend yield:", error.message);
      return null;
    }
  }

  /**
   * Processa dados do FundamentalsTimeSeries (dados históricos anuais completos)
   */
  static async processFundamentalsTimeSeries(
    companyId: number,
    ticker: string,
    fundamentalsTimeSeries: any
  ): Promise<void> {
    if (!fundamentalsTimeSeries) return;

    console.log(
      `📊 [BDR] Processando FundamentalsTimeSeries para ${ticker}...`
    );
    console.log(
      "fundamentalsTimeSeries2->",
      JSON.stringify(fundamentalsTimeSeries)
    );
    let processedYears = 0;

    try {
      // Processar cada configuração de dados disponível
      for (const [configKey, configData] of Object.entries(
        fundamentalsTimeSeries
      )) {
        if (Array.isArray(configData)) {
          console.log(
            `  📈 Processando ${configKey}: ${configData.length} registros`
          );

          // Agrupar dados por ano
          const dataByYear: { [year: number]: any } = {};

          for (const dataPoint of configData) {
            // Verificar tanto 'date' quanto 'asOfDate' para compatibilidade
            const dateField = dataPoint.date || dataPoint.asOfDate;
            if (dateField) {
              const year = new Date(dateField).getFullYear();
              if (!dataByYear[year]) {
                dataByYear[year] = {};
              }

              // Extrair todas as métricas disponíveis do dataPoint
              let extractedCount = 0;
              for (const [metricName, metricValue] of Object.entries(
                dataPoint
              )) {
                if (
                  metricName !== "date" &&
                  metricName !== "asOfDate" &&
                  metricName !== "periodType" &&
                  metricName !== "TYPE"
                ) {
                  const value = this.extractMetricValue(metricValue);
                  if (value !== null) {
                    dataByYear[year][metricName] = value;
                    extractedCount++;
                  }
                }
              }

              if (extractedCount > 0) {
                console.log(
                  `      📊 Ano ${year}: ${extractedCount} métricas extraídas`
                );
              }
            }
          }

          // Salvar dados agrupados por ano
          for (const [yearStr, yearData] of Object.entries(dataByYear)) {
            const year = parseInt(yearStr);
            if (year && year > 2000 && year <= new Date().getFullYear()) {
              try {
                const rawFieldCount = Object.keys(yearData).length;
                console.log(
                  `    📅 Processando ano ${year}: ${rawFieldCount} campos brutos`
                );

                // Mapear métricas do Yahoo Finance para campos do schema
                const mappedData = this.mapFundamentalsToSchema(
                  yearData,
                  year,
                  configKey
                );

                const mappedFieldCount = Object.keys(mappedData).length - 2; // Excluir year e dataSource
                if (mappedFieldCount > 0) {
                  console.log(
                    `      ✅ ${mappedFieldCount} campos mapeados para o schema`
                  );
                  await this.saveBDRFinancialData(
                    companyId,
                    ticker,
                    mappedData
                  );
                  processedYears++;
                } else {
                  console.log(`      ⚠️ Nenhum campo válido após mapeamento`);
                }
              } catch (error: any) {
                console.warn(
                  `  ⚠️ Erro ao salvar dados de ${year} (${configKey}):`,
                  error.message
                );
              }
            }
          }
        } else if (
          configKey.includes("validation_error") &&
          (configData as any)?.data
        ) {
          // Processar dados extraídos de erros de validação
          console.log(
            `  🔧 Processando dados de erro de validação: ${configKey}`
          );

          try {
            const errorData = (configData as any).data;
            if (Array.isArray(errorData)) {
              // Processar da mesma forma que dados normais
              for (const dataPoint of errorData) {
                // Verificar tanto 'date' quanto 'asOfDate' para compatibilidade
                const dateField = dataPoint.date || dataPoint.asOfDate;
                if (dateField) {
                  const year = new Date(dateField).getFullYear();
                  const yearData: any = {};

                  for (const [metricName, metricValue] of Object.entries(
                    dataPoint
                  )) {
                    if (
                      metricName !== "date" &&
                      metricName !== "asOfDate" &&
                      metricName !== "periodType" &&
                      metricName !== "TYPE"
                    ) {
                      const value = this.extractMetricValue(metricValue);
                      if (value !== null) {
                        yearData[metricName] = value;
                      }
                    }
                  }

                  if (Object.keys(yearData).length > 0) {
                    const rawFieldCount = Object.keys(yearData).length;
                    console.log(
                      `    📅 Processando ano ${year} (erro validação): ${rawFieldCount} campos brutos`
                    );

                    const mappedData = this.mapFundamentalsToSchema(
                      yearData,
                      year,
                      configKey
                    );

                    const mappedFieldCount = Object.keys(mappedData).length - 2; // Excluir year e dataSource
                    if (mappedFieldCount > 0) {
                      console.log(
                        `      ✅ ${mappedFieldCount} campos mapeados para o schema`
                      );
                      await this.saveBDRFinancialData(
                        companyId,
                        ticker,
                        mappedData
                      );
                      processedYears++;
                    } else {
                      console.log(
                        `      ⚠️ Nenhum campo válido após mapeamento`
                      );
                    }
                  }
                }
              }
            }
          } catch (error: any) {
            console.warn(
              `  ⚠️ Erro ao processar dados de validação (${configKey}):`,
              error.message
            );
          }
        }
      }

      if (processedYears > 0) {
        console.log(
          `✅ [BDR] FundamentalsTimeSeries: ${processedYears} registros processados para ${ticker}`
        );
      } else {
        console.log(
          `⚠️ [BDR] Nenhum dado válido encontrado no FundamentalsTimeSeries para ${ticker}`
        );
      }
    } catch (error: any) {
      console.error(
        `❌ [BDR] Erro ao processar FundamentalsTimeSeries para ${ticker}:`,
        error.message
      );
    }
  }

  /**
   * Extrai valor de uma métrica, lidando com diferentes formatos
   */
  static extractMetricValue(metricValue: any): number | null {
    if (metricValue === null || metricValue === undefined) {
      return null;
    }

    // Se é um objeto com propriedade raw
    if (typeof metricValue === "object" && metricValue.raw !== undefined) {
      return this.convertValue(metricValue.raw);
    }

    // Se é um número direto
    if (typeof metricValue === "number") {
      return metricValue;
    }

    // Se é string que pode ser convertida
    if (typeof metricValue === "string") {
      const num = parseFloat(metricValue);
      return isNaN(num) ? null : num;
    }

    return null;
  }

  /**
   * Mapeia métricas do FundamentalsTimeSeries para campos do schema
   */
  static mapFundamentalsToSchema(
    yearData: any,
    year: number,
    configKey?: string
  ): any {
    const mapped: any = {
      year,
      dataSource: `yahoo_finance_fundamentals_${configKey || "timeseries"}`,
    };

    // Mapear receitas (múltiplos formatos possíveis)
    const revenueFields = [
      "TotalRevenue",
      "totalRevenue",
      "Revenue",
      "revenue",
    ];
    for (const field of revenueFields) {
      if (yearData[field] !== undefined) {
        mapped.receitaTotal = yearData[field];
        break;
      }
    }

    // Mapear lucros (múltiplos formatos possíveis)
    const netIncomeFields = [
      "NetIncome",
      "netIncome",
      "NetIncomeCommonStockholders",
    ];
    for (const field of netIncomeFields) {
      if (yearData[field] !== undefined) {
        mapped.lucroLiquido = yearData[field];
        break;
      }
    }

    // Nota: lucroOperacional não existe no schema FinancialData, removido

    // Nota: lucroBruto não existe no schema FinancialData, removido

    // Mapear ativos (múltiplos formatos possíveis)
    const totalAssetsFields = ["TotalAssets", "totalAssets"];
    for (const field of totalAssetsFields) {
      if (yearData[field] !== undefined) {
        mapped.ativoTotal = yearData[field];
        break;
      }
    }

    const currentAssetsFields = ["CurrentAssets", "currentAssets"];
    for (const field of currentAssetsFields) {
      if (yearData[field] !== undefined) {
        mapped.ativoCirculante = yearData[field];
        break;
      }
    }

    // Mapear passivos (múltiplos formatos possíveis)
    const totalLiabilitiesFields = [
      "TotalLiabilitiesNetMinorityInterest",
      "TotalLiabilities",
      "totalLiabilities",
    ];
    for (const field of totalLiabilitiesFields) {
      if (yearData[field] !== undefined) {
        mapped.passivoTotal = yearData[field];
        break;
      }
    }

    const currentLiabilitiesFields = [
      "CurrentLiabilities",
      "currentLiabilities",
    ];
    for (const field of currentLiabilitiesFields) {
      if (yearData[field] !== undefined) {
        mapped.passivoCirculante = yearData[field];
        break;
      }
    }

    // Mapear patrimônio líquido (múltiplos formatos possíveis)
    const equityFields = [
      "StockholdersEquity",
      "stockholdersEquity",
      "TotalEquityGrossMinorityInterest",
    ];
    for (const field of equityFields) {
      if (yearData[field] !== undefined) {
        mapped.patrimonioLiquido = yearData[field];
        break;
      }
    }

    // Mapear fluxo de caixa (múltiplos formatos possíveis)
    const operatingCashFlowFields = [
      "OperatingCashFlow",
      "operatingCashFlow",
      "CashFlowFromContinuingOperatingActivities",
    ];
    for (const field of operatingCashFlowFields) {
      if (yearData[field] !== undefined) {
        mapped.fluxoCaixaOperacional = yearData[field];
        break;
      }
    }

    // Mapear EBITDA (múltiplos formatos possíveis)
    const ebitdaFields = ["EBITDA", "ebitda", "NormalizedEBITDA"];
    for (const field of ebitdaFields) {
      if (yearData[field] !== undefined) {
        mapped.ebitda = yearData[field];
        break;
      }
    }

    // Mapear campos adicionais específicos do FundamentalsTimeSeries
    // Apenas campos que existem no schema FinancialData
    const additionalMappings = {
      // Caixa
      CashAndCashEquivalents: "caixa",
      cashAndCashEquivalents: "caixa",

      // Dívidas
      TotalDebt: "totalDivida",
      totalDebt: "totalDivida",
      LongTermDebt: "dividaLongoPrazo",
      longTermDebt: "dividaLongoPrazo",
    };

    for (const [sourceField, targetField] of Object.entries(
      additionalMappings
    )) {
      if (yearData[sourceField] !== undefined) {
        (mapped as any)[targetField] = yearData[sourceField];
      }
    }

    // Calcular margens se possível
    if (mapped.receitaTotal && mapped.receitaTotal > 0) {
      if (mapped.lucroLiquido !== undefined) {
        mapped.margemLiquida = mapped.lucroLiquido / mapped.receitaTotal;
      }
      if (mapped.ebitda !== undefined) {
        mapped.margemEbitda = mapped.ebitda / mapped.receitaTotal;
      }

      // Calcular margem bruta se temos gross profit nos dados brutos
      const grossProfit = yearData.grossProfit || yearData.GrossProfit;
      if (grossProfit !== undefined) {
        mapped.margemBruta = grossProfit / mapped.receitaTotal;
      }
    }

    // Calcular indicadores se possível
    if (mapped.ativoTotal && mapped.ativoTotal > 0) {
      if (mapped.lucroLiquido !== undefined) {
        mapped.roa = mapped.lucroLiquido / mapped.ativoTotal;
      }
    }

    if (mapped.patrimonioLiquido && mapped.patrimonioLiquido > 0) {
      if (mapped.lucroLiquido !== undefined) {
        mapped.roe = mapped.lucroLiquido / mapped.patrimonioLiquido;
      }
    }

    if (
      mapped.ativoCirculante &&
      mapped.passivoCirculante &&
      mapped.passivoCirculante > 0
    ) {
      mapped.liquidezCorrente =
        mapped.ativoCirculante / mapped.passivoCirculante;
    }

    return mapped;
  }

  /**
   * Processa dados do FundamentalsTimeSeries para Balance Sheets
   * Usando a mesma lógica que funcionou no fix-bdr-mapping.ts
   */
  static async processFundamentalsToBalanceSheets(
    companyId: number,
    ticker: string,
    fundamentalsTimeSeries: any
  ): Promise<void> {
    console.log(`🏦 PROCESSANDO BALANCE SHEETS:`);

    try {
      // Procurar dados de balanço em TODAS as configurações disponíveis
      const allConfigs = Object.keys(fundamentalsTimeSeries);
      console.log(`  📋 Configurações disponíveis: ${allConfigs.join(', ')}`);
      
      const balanceConfigs = [
        "annual_all", 
        "annual_balance-sheet", 
        "annual_all_validation_error",
        "annual_balance-sheet_validation_error"
      ];

      let totalProcessed = 0;

      for (const configKey of balanceConfigs) {
        let configData = fundamentalsTimeSeries[configKey];
        
        if (!configData) {
          console.log(`  ⚠️ ${configKey}: não encontrado`);
          continue;
        }

        // Se for um erro de validação, extrair os dados do campo 'data'
        if (
          configData &&
          configData.error &&
          configData.data &&
          Array.isArray(configData.data)
        ) {
          console.log(`  🔧 ${configKey}: extraindo dados de erro de validação`);
          configData = configData.data;
        }

        if (Array.isArray(configData)) {
          console.log(`  📊 ${configKey}: ${configData.length} registros`);

          for (const dataPoint of configData) {
            // Verificar tanto 'date' quanto 'asOfDate' para compatibilidade
            const dateField = dataPoint.date || dataPoint.asOfDate;
            const hasBalanceData = this.hasBalanceSheetData(dataPoint);
            
            console.log(`    🔍 Data: ${dateField}, hasBalanceData: ${hasBalanceData}`);
            if (hasBalanceData) {
              console.log(`      📊 Campos de balanço encontrados: ${Object.keys(dataPoint).filter(k => 
                ['totalAssets', 'stockholdersEquity', 'currentAssets', 'currentLiabilities', 'cashAndCashEquivalents'].includes(k)
              ).join(', ')}`);
            }
            
            if (dateField && hasBalanceData) {
              // Converter timestamp Unix ou string para data válida
              let endDate: Date;
              if (typeof dateField === "string") {
                endDate = new Date(dateField);
              } else {
                const timestamp = dateField;
                endDate =
                  timestamp > 2000000000
                    ? new Date(timestamp)
                    : new Date(timestamp * 1000);
              }

              const year = endDate.getFullYear();

              // Validar se a data é razoável (entre 2000 e ano atual + 1)
              if (year < 2000 || year > new Date().getFullYear() + 1) {
                console.warn(
                  `    ⚠️ Ano inválido ${year} para Balance Sheet, pulando...`
                );
                continue;
              }

              try {
                // Contar campos disponíveis
                const availableFields = Object.keys(dataPoint).filter(
                  (key) =>
                    key !== "date" &&
                    key !== "periodType" &&
                    key !== "TYPE" &&
                    dataPoint[key] !== null &&
                    dataPoint[key] !== undefined
                ).length;

                const mainFields = {
                  totalAssets: dataPoint.totalAssets,
                  stockholdersEquity: dataPoint.stockholdersEquity,
                };

                console.log(`    📅 Processando ano ${year}:`);
                console.log(`      Campos disponíveis: ${availableFields}`);
                console.log(
                  `      Principais: totalAssets=${mainFields.totalAssets}, stockholdersEquity=${mainFields.stockholdersEquity}`
                );

                const balanceSheetData = {
                  companyId,
                  period: "YEARLY" as const,
                  endDate,
                  // Ativos
                  totalAssets: this.convertValue(dataPoint.totalAssets),
                  totalCurrentAssets: this.convertValue(
                    dataPoint.currentAssets || dataPoint.totalCurrentAssets
                  ),
                  cash: this.convertValue(
                    dataPoint.cashAndCashEquivalents || dataPoint.cash
                  ),
                  shortTermInvestments: this.convertValue(
                    dataPoint.shortTermInvestments || dataPoint.otherShortTermInvestments
                  ),

                  // inventory: this.convertValue(dataPoint.inventory), // inventory doesn't exist in schema
                  otherAssets: this.convertValue(
                    dataPoint.otherCurrentAssets || dataPoint.otherAssets || dataPoint.otherNonCurrentAssets
                  ),
                  // totalNonCurrentAssets: this.convertValue( // doesn't exist in schema
                  //   dataPoint.totalNonCurrentAssets
                  // ),
                  longTermInvestments: this.convertValue(
                    dataPoint.longTermInvestments || dataPoint.investmentsAndAdvances
                  ),
                  // propertyPlantEquipment: this.convertValue( // doesn't exist in schema
                  //   dataPoint.netPPE || dataPoint.propertyPlantEquipment
                  // ),
                  goodWill: this.convertValue(dataPoint.goodwill),
                  // intangibleAssets: this.convertValue( // doesn't exist in schema
                  //   dataPoint.otherIntangibleAssets || dataPoint.intangibleAssets
                  // ),
                  
                  // Passivos
                  totalCurrentLiabilities: this.convertValue(
                    dataPoint.currentLiabilities || dataPoint.totalCurrentLiabilities
                  ),
                  totalLiab: this.convertValue(
                    dataPoint.totalLiabilitiesNetMinorityInterest || dataPoint.totalLiab
                  ),
                  // longTermDebt: this.convertValue(dataPoint.longTermDebt), // doesn't exist in schema
                  // shortLongTermDebt: this.convertValue( // doesn't exist in schema
                  //   dataPoint.longTermDebtAndCapitalLeaseObligation || dataPoint.totalDebt
                  // ),
                  // otherCurrentLiab: this.convertValue( // doesn't exist in schema
                  //   dataPoint.otherCurrentLiabilities
                  // ),
                  // totalNonCurrentLiabilities: this.convertValue( // doesn't exist in schema
                  //   dataPoint.totalNonCurrentLiabilitiesNetMinorityInterest || dataPoint.totalNonCurrentLiabilities
                  // ),
                  
                  // Patrimônio Líquido
                  totalStockholderEquity: this.convertValue(
                    dataPoint.stockholdersEquity ||
                    dataPoint.totalStockholderEquity ||
                    dataPoint.commonStockEquity
                  ),
                  commonStock: this.convertValue(dataPoint.commonStock || dataPoint.capitalStock),
                  treasuryStock: this.convertValue(dataPoint.treasuryStock),
                  
                  // Campos calculados que existem no schema
                  // workingCapital: this.convertValue(dataPoint.workingCapital), // doesn't exist in schema
                  // investedCapital: this.convertValue(dataPoint.investedCapital), // doesn't exist in schema
                  // tangibleBookValue: this.convertValue( // doesn't exist in schema
                  //   dataPoint.tangibleBookValue
                  // ),
                  netTangibleAssets: this.convertValue(
                    dataPoint.netTangibleAssets
                  ),
                };

                // Contar campos não-null que serão salvos
                const nonNullFields = Object.entries(balanceSheetData).filter(
                  ([key, value]) =>
                    key !== "companyId" &&
                    key !== "period" &&
                    key !== "endDate" &&
                    value !== null
                ).length;

                await prisma.balanceSheet.upsert({
                  where: {
                    companyId_endDate_period: {
                      companyId,
                      endDate,
                      period: "YEARLY",
                    },
                  },
                  update: balanceSheetData,
                  create: balanceSheetData,
                });

                console.log(
                  `      ✅ Balance Sheet ${year} salvo com ${nonNullFields} campos`
                );
                totalProcessed++;
              } catch (error: any) {
                console.warn(
                  `    ⚠️ Erro ao salvar Balance Sheet ${year}:`,
                  error.message
                );
              }
            }
          }
        } else {
          console.log(`  ⚠️ ${configKey}: não é um array ou está vazio`);
        }
      }
      
      console.log(`🏦 RESULTADO: ${totalProcessed} Balance Sheets processados para ${ticker}`);
    } catch (error: any) {
      console.error(
        `❌ [BDR] Erro ao processar Balance Sheets do FundamentalsTimeSeries:`,
        error.message
      );
    }
  }

  /**
   * Processa dados do FundamentalsTimeSeries para Cashflow Statements
   * Usando a mesma lógica que funcionou no fix-bdr-mapping.ts
   */
  static async processFundamentalsToCashflowStatements(
    companyId: number,
    ticker: string,
    fundamentalsTimeSeries: any
  ): Promise<void> {
    console.log(`💰 PROCESSANDO CASHFLOW STATEMENTS:`);

    try {
      // Procurar dados de fluxo de caixa em TODAS as configurações disponíveis
      const allConfigs = Object.keys(fundamentalsTimeSeries);
      console.log(`  📋 Configurações disponíveis: ${allConfigs.join(', ')}`);
      
      const cashflowConfigs = [
        "annual_cash-flow", 
        "annual_all",
        "annual_cash-flow_validation_error",
        "annual_all_validation_error"
      ];

      let totalProcessed = 0;

      for (const configKey of cashflowConfigs) {
        let configData = fundamentalsTimeSeries[configKey];
        
        if (!configData) {
          console.log(`  ⚠️ ${configKey}: não encontrado`);
          continue;
        }

        // Se for um erro de validação, extrair os dados do campo 'data'
        if (
          configData &&
          configData.error &&
          configData.data &&
          Array.isArray(configData.data)
        ) {
          console.log(`  🔧 ${configKey}: extraindo dados de erro de validação`);
          configData = configData.data;
        }

        if (Array.isArray(configData)) {
          console.log(`  💸 ${configKey}: ${configData.length} registros`);

          for (const dataPoint of configData) {
            // Verificar tanto 'date' quanto 'asOfDate' para compatibilidade
            const dateField = dataPoint.date || dataPoint.asOfDate;
            const hasCashflowData = this.hasCashflowData(dataPoint);
            
            console.log(`    🔍 Data: ${dateField}, hasCashflowData: ${hasCashflowData}`);
            if (hasCashflowData) {
              console.log(`      💸 Campos de cashflow encontrados: ${Object.keys(dataPoint).filter(k => 
                ['operatingCashFlow', 'investingCashFlow', 'financingCashFlow', 'freeCashFlow'].includes(k)
              ).join(', ')}`);
            }
            
            if (dateField && hasCashflowData) {
              // Converter timestamp Unix ou string para data válida
              let endDate: Date;
              if (typeof dateField === "string") {
                endDate = new Date(dateField);
              } else {
                const timestamp = dateField;
                endDate =
                  timestamp > 2000000000
                    ? new Date(timestamp)
                    : new Date(timestamp * 1000);
              }

              const year = endDate.getFullYear();

              // Validar se a data é razoável (entre 2000 e ano atual + 1)
              if (year < 2000 || year > new Date().getFullYear() + 1) {
                console.warn(
                  `    ⚠️ Ano inválido ${year} para Cashflow Statement, pulando...`
                );
                continue;
              }

              try {
                const cashflowData = {
                  companyId,
                  period: "YEARLY" as const,
                  endDate,
                  
                  // Fluxo de Caixa Operacional
                  operatingCashFlow: this.convertValue(
                    dataPoint.operatingCashFlow ||
                    dataPoint.totalCashFromOperatingActivities ||
                    dataPoint.cashFlowFromContinuingOperatingActivities
                  ),
                  incomeFromOperations: this.convertValue(
                    dataPoint.incomeFromOperations || dataPoint.netIncome
                  ),
                  netIncomeBeforeTaxes: this.convertValue(
                    dataPoint.netIncomeBeforeTaxes || dataPoint.pretaxIncome
                  ),
                  adjustmentsToProfitOrLoss: this.convertValue(
                    dataPoint.adjustmentsToProfitOrLoss || dataPoint.stockBasedCompensation
                  ),
                  changesInAssetsAndLiabilities: this.convertValue(
                    dataPoint.changesInAssetsAndLiabilities || dataPoint.changeInWorkingCapital
                  ),
                  otherOperatingActivities: this.convertValue(
                    dataPoint.otherOperatingActivities || dataPoint.otherNonCashItems
                  ),
                  cashGeneratedInOperations: this.convertValue(
                    dataPoint.cashGeneratedInOperations || dataPoint.operatingCashFlow
                  ),
                  
                  // Fluxo de Caixa de Investimento
                  investmentCashFlow: this.convertValue(
                    dataPoint.investingCashFlow ||
                    dataPoint.totalCashflowsFromInvestingActivities ||
                    dataPoint.cashFlowFromContinuingInvestingActivities
                  ),
                  
                  // Fluxo de Caixa de Financiamento
                  financingCashFlow: this.convertValue(
                    dataPoint.financingCashFlow ||
                    dataPoint.totalCashFromFinancingActivities ||
                    dataPoint.cashFlowFromContinuingFinancingActivities
                  ),
                  
                  // Variação de Caixa
                  increaseOrDecreaseInCash: this.convertValue(
                    dataPoint.increaseOrDecreaseInCash || 
                    dataPoint.changeInCash ||
                    dataPoint.changesInCash
                  ),
                  initialCashBalance: this.convertValue(
                    dataPoint.initialCashBalance || dataPoint.beginningCashPosition
                  ),
                  finalCashBalance: this.convertValue(
                    dataPoint.finalCashBalance || dataPoint.endCashPosition
                  ),
                };

                // Contar campos não-null que serão salvos
                const nonNullFields = Object.entries(cashflowData).filter(
                  ([key, value]) =>
                    key !== "companyId" &&
                    key !== "period" &&
                    key !== "endDate" &&
                    value !== null
                ).length;

                await prisma.cashflowStatement.upsert({
                  where: {
                    companyId_endDate_period: {
                      companyId,
                      endDate,
                      period: "YEARLY",
                    },
                  },
                  update: cashflowData,
                  create: cashflowData,
                });

                console.log(`    📅 Processando ano ${year}:`);
                console.log(
                  `      ✅ Cashflow Statement ${year} salvo com ${nonNullFields} campos`
                );
                console.log(
                  `      📊 Dados: operatingCF=${dataPoint.operatingCashFlow}, investmentCF=${dataPoint.investingCashFlow}`
                );
                totalProcessed++;
              } catch (error: any) {
                console.warn(
                  `    ⚠️ Erro ao salvar Cashflow Statement ${year}:`,
                  error.message
                );
              }
            }
          }
        } else {
          console.log(`  ⚠️ ${configKey}: não é um array ou está vazio`);
        }
      }
      
      console.log(`💰 RESULTADO: ${totalProcessed} Cashflow Statements processados para ${ticker}`);
    } catch (error: any) {
      console.error(
        `❌ [BDR] Erro ao processar Cashflow Statements do FundamentalsTimeSeries:`,
        error.message
      );
    }
  }

  /**
   * Verifica se o dataPoint tem dados de Balance Sheet
   */
  static hasBalanceSheetData(dataPoint: any): boolean {
    return !!(
      dataPoint.totalAssets ||
      dataPoint.stockholdersEquity ||
      dataPoint.totalStockholderEquity ||
      dataPoint.commonStockEquity ||
      dataPoint.currentAssets ||
      dataPoint.currentLiabilities ||
      dataPoint.cashAndCashEquivalents ||
      dataPoint.cash ||
      dataPoint.totalLiabilitiesNetMinorityInterest ||
      dataPoint.totalLiab ||
      dataPoint.longTermDebt ||
      dataPoint.commonStock ||
      dataPoint.inventory ||
      dataPoint.accountsReceivable ||
      dataPoint.receivables ||
      dataPoint.netPPE ||
      dataPoint.propertyPlantEquipment ||
      dataPoint.goodwill ||
      dataPoint.otherIntangibleAssets ||
      dataPoint.workingCapital ||
      dataPoint.investedCapital ||
      dataPoint.tangibleBookValue ||
      dataPoint.netTangibleAssets
    );
  }

  /**
   * Verifica se o dataPoint tem dados de Cashflow
   */
  static hasCashflowData(dataPoint: any): boolean {
    return !!(
      dataPoint.operatingCashFlow ||
      dataPoint.totalCashFromOperatingActivities ||
      dataPoint.cashFlowFromContinuingOperatingActivities ||
      dataPoint.investingCashFlow ||
      dataPoint.totalCashflowsFromInvestingActivities ||
      dataPoint.cashFlowFromContinuingInvestingActivities ||
      dataPoint.financingCashFlow ||
      dataPoint.totalCashFromFinancingActivities ||
      dataPoint.cashFlowFromContinuingFinancingActivities ||
      dataPoint.freeCashFlow ||
      dataPoint.capitalExpenditures ||
      dataPoint.capitalExpenditure ||
      dataPoint.purchaseOfPPE ||
      dataPoint.netInvestmentPurchaseAndSale ||
      dataPoint.netCommonStockIssuance ||
      dataPoint.commonStockPayments ||
      dataPoint.repurchaseOfCapitalStock ||
      dataPoint.issuanceOfDebt ||
      dataPoint.repaymentOfDebt ||
      dataPoint.longTermDebtIssuance ||
      dataPoint.longTermDebtPayments ||
      dataPoint.changesInCash ||
      dataPoint.changeInCash ||
      dataPoint.increaseOrDecreaseInCash ||
      dataPoint.beginningCashPosition ||
      dataPoint.endCashPosition ||
      dataPoint.initialCashBalance ||
      dataPoint.finalCashBalance
    );
  }

  /**
   * Processa Key Statistics usando a mesma lógica que funcionou no fix-bdr-mapping.ts
   */
  static async processKeyStatistics(
    companyId: number,
    ticker: string,
    keyStatistics: any
  ): Promise<void> {
    try {
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      const keyStatsData = {
        companyId,
        period: "YEARLY" as const,
        endDate: currentDate,
        enterpriseValue: this.convertValue(keyStatistics.enterpriseValue),
        forwardPE: this.convertValue(keyStatistics.forwardPE),
        profitMargins: this.convertValue(keyStatistics.profitMargins),
        bookValue: this.convertValue(keyStatistics.bookValue),
        priceToBook: this.convertValue(keyStatistics.priceToBook),
      };

      // Contar campos não-null que serão salvos
      const nonNullFields = Object.entries(keyStatsData).filter(
        ([key, value]) =>
          key !== "companyId" &&
          key !== "period" &&
          key !== "endDate" &&
          value !== null
      ).length;

      await prisma.keyStatistics.upsert({
        where: {
          companyId_endDate_period: {
            companyId,
            endDate: currentDate,
            period: "YEARLY",
          },
        },
        update: keyStatsData,
        create: keyStatsData,
      });

      console.log(
        `  ✅ Key Statistics ${currentDate.getFullYear()} salvo com ${nonNullFields} campos`
      );
    } catch (error: any) {
      console.error(
        `❌ [BDR] Erro ao processar Key Statistics:`,
        error.message
      );
    }
  }

  /**
   * Processa dados históricos completos de balanços patrimoniais
   */
  static async processHistoricalBalanceSheets(
    companyId: number,
    ticker: string,
    balanceSheetHistory: any
  ): Promise<void> {
    if (!balanceSheetHistory?.balanceSheetStatements) return;

    console.log(
      `📊 [BDR] Processando ${balanceSheetHistory.balanceSheetStatements.length} balanços históricos para ${ticker}...`
    );

    for (const statement of balanceSheetHistory.balanceSheetStatements) {
      if (!statement.endDate) continue;

      try {
        const endDate = new Date(statement.endDate);

        // Verificar se temos dados válidos antes de salvar
        const hasValidData =
          statement.totalAssets ||
          statement.totalCurrentAssets ||
          statement.cash ||
          statement.totalStockholderEquity ||
          statement.totalCurrentLiabilities ||
          statement.totalLiab;

        if (hasValidData) {
          await prisma.balanceSheet.upsert({
            where: {
              companyId_endDate_period: {
                companyId,
                endDate,
                period: "YEARLY",
              },
            },
            update: {
              // Mapear apenas campos disponíveis no schema BalanceSheet
              totalAssets: this.convertValue(statement.totalAssets),
              totalCurrentAssets: this.convertValue(
                statement.totalCurrentAssets
              ),
              cash: this.convertValue(
                statement.cash || statement.cashAndCashEquivalents
              ),
              totalCurrentLiabilities: this.convertValue(
                statement.totalCurrentLiabilities
              ),
              totalLiab: this.convertValue(
                statement.totalLiab ||
                  statement.totalLiabilitiesNetMinorityInterest
              ),
              totalStockholderEquity: this.convertValue(
                statement.totalStockholderEquity || statement.stockholdersEquity
              ),
              commonStock: this.convertValue(statement.commonStock),
              goodWill: this.convertValue(
                statement.goodWill || statement.goodwill
              ),
              netTangibleAssets: this.convertValue(statement.netTangibleAssets),
              treasuryStock: this.convertValue(statement.treasuryStock),
              shortTermInvestments: this.convertValue(
                statement.shortTermInvestments
              ),
              longTermInvestments: this.convertValue(
                statement.longTermInvestments
              ),
              otherAssets: this.convertValue(statement.otherAssets),
            },
            create: {
              companyId,
              period: "YEARLY",
              endDate,
              totalAssets: this.convertValue(statement.totalAssets),
              totalCurrentAssets: this.convertValue(
                statement.totalCurrentAssets
              ),
              cash: this.convertValue(
                statement.cash || statement.cashAndCashEquivalents
              ),
              totalCurrentLiabilities: this.convertValue(
                statement.totalCurrentLiabilities
              ),
              totalLiab: this.convertValue(
                statement.totalLiab ||
                  statement.totalLiabilitiesNetMinorityInterest
              ),
              totalStockholderEquity: this.convertValue(
                statement.totalStockholderEquity || statement.stockholdersEquity
              ),
              commonStock: this.convertValue(statement.commonStock),
              goodWill: this.convertValue(
                statement.goodWill || statement.goodwill
              ),
              netTangibleAssets: this.convertValue(statement.netTangibleAssets),
              treasuryStock: this.convertValue(statement.treasuryStock),
              shortTermInvestments: this.convertValue(
                statement.shortTermInvestments
              ),
              longTermInvestments: this.convertValue(
                statement.longTermInvestments
              ),
              otherAssets: this.convertValue(statement.otherAssets),
            },
          });
          console.log(
            `  ✅ Balanço ${endDate.getFullYear()} processado com dados válidos`
          );
        } else {
          console.log(
            `  ⚠️ Balanço ${endDate.getFullYear()} pulado - sem dados válidos`
          );
        }

        console.log(`  ✅ Balanço ${endDate.getFullYear()} processado`);
      } catch (error: any) {
        console.error(
          `  ❌ Erro ao processar balanço de ${statement.endDate}:`,
          error.message
        );
      }
    }
  }

  /**
   * Processa dados históricos de demonstrações de resultado
   */
  static async processHistoricalIncomeStatements(
    companyId: number,
    ticker: string,
    incomeStatementHistory: any
  ): Promise<void> {
    if (!incomeStatementHistory?.incomeStatementHistory) return;

    console.log(
      `📈 [BDR] Processando ${incomeStatementHistory.incomeStatementHistory.length} DREs históricas para ${ticker}...`
    );

    for (const statement of incomeStatementHistory.incomeStatementHistory) {
      if (!statement.endDate) continue;

      try {
        const endDate = new Date(statement.endDate);

        // Verificar se temos dados válidos antes de salvar
        const hasValidData =
          statement.totalRevenue ||
          statement.netIncome ||
          statement.operatingIncome ||
          statement.grossProfit;

        if (hasValidData) {
          await prisma.incomeStatement.upsert({
            where: {
              companyId_endDate_period: {
                companyId,
                endDate,
                period: "YEARLY",
              },
            },
            update: {
              totalRevenue: this.convertValue(statement.totalRevenue),
              costOfRevenue: this.convertValue(statement.costOfRevenue),
              grossProfit: this.convertValue(statement.grossProfit),
              operatingIncome: this.convertValue(statement.operatingIncome),
              ebit: this.convertValue(statement.ebit),
              netIncome: this.convertValue(statement.netIncome),
              researchDevelopment: this.convertValue(
                statement.researchDevelopment
              ),
              sellingGeneralAdministrative: this.convertValue(
                statement.sellingGeneralAdministrative
              ),
              totalOperatingExpenses: this.convertValue(
                statement.totalOperatingExpenses
              ),
              interestExpense: this.convertValue(statement.interestExpense),
              incomeBeforeTax: this.convertValue(statement.incomeBeforeTax),
              incomeTaxExpense: this.convertValue(statement.incomeTaxExpense),
              extraordinaryItems: this.convertValue(
                statement.extraordinaryItems
              ),
              nonRecurring: this.convertValue(statement.nonRecurring),
              otherItems: this.convertValue(statement.otherItems),
              netIncomeFromContinuingOps: this.convertValue(
                statement.netIncomeFromContinuingOps
              ),
              netIncomeApplicableToCommonShares: this.convertValue(
                statement.netIncomeApplicableToCommonShares
              ),
            },
            create: {
              companyId,
              period: "YEARLY",
              endDate,
              totalRevenue: this.convertValue(statement.totalRevenue),
              costOfRevenue: this.convertValue(statement.costOfRevenue),
              grossProfit: this.convertValue(statement.grossProfit),
              operatingIncome: this.convertValue(statement.operatingIncome),
              ebit: this.convertValue(statement.ebit),
              netIncome: this.convertValue(statement.netIncome),
              researchDevelopment: this.convertValue(
                statement.researchDevelopment
              ),
              sellingGeneralAdministrative: this.convertValue(
                statement.sellingGeneralAdministrative
              ),
              totalOperatingExpenses: this.convertValue(
                statement.totalOperatingExpenses
              ),
              interestExpense: this.convertValue(statement.interestExpense),
              incomeBeforeTax: this.convertValue(statement.incomeBeforeTax),
              incomeTaxExpense: this.convertValue(statement.incomeTaxExpense),
              extraordinaryItems: this.convertValue(
                statement.extraordinaryItems
              ),
              nonRecurring: this.convertValue(statement.nonRecurring),
              otherItems: this.convertValue(statement.otherItems),
              netIncomeFromContinuingOps: this.convertValue(
                statement.netIncomeFromContinuingOps
              ),
              netIncomeApplicableToCommonShares: this.convertValue(
                statement.netIncomeApplicableToCommonShares
              ),
            },
          });
          console.log(
            `  ✅ DRE ${endDate.getFullYear()} processada com dados válidos`
          );
        } else {
          console.log(
            `  ⚠️ DRE ${endDate.getFullYear()} pulada - sem dados válidos`
          );
        }

        console.log(`  ✅ DRE ${endDate.getFullYear()} processada`);
      } catch (error: any) {
        console.error(
          `  ❌ Erro ao processar DRE de ${statement.endDate}:`,
          error.message
        );
      }
    }
  }

  /**
   * Processa dados históricos de fluxo de caixa
   */
  static async processHistoricalCashflowStatements(
    companyId: number,
    ticker: string,
    cashflowStatementHistory: any
  ): Promise<void> {
    if (!cashflowStatementHistory?.cashflowStatements) return;

    console.log(
      `💰 [BDR] Processando ${cashflowStatementHistory.cashflowStatements.length} DFCs históricos para ${ticker}...`
    );

    for (const statement of cashflowStatementHistory.cashflowStatements) {
      if (!statement.endDate) continue;

      try {
        const endDate = new Date(statement.endDate);

        // Verificar se temos dados válidos antes de salvar
        const hasValidData =
          statement.operatingCashFlow ||
          statement.investmentCashFlow ||
          statement.financingCashFlow ||
          statement.totalCashFromOperatingActivities;

        if (hasValidData) {
          await prisma.cashflowStatement.upsert({
            where: {
              companyId_endDate_period: {
                companyId,
                endDate,
                period: "YEARLY",
              },
            },
            update: {
              operatingCashFlow: this.convertValue(
                statement.operatingCashFlow ||
                  statement.totalCashFromOperatingActivities
              ),
              investmentCashFlow: this.convertValue(
                statement.investmentCashFlow ||
                  statement.totalCashflowsFromInvestingActivities
              ),
              financingCashFlow: this.convertValue(
                statement.financingCashFlow ||
                  statement.totalCashFromFinancingActivities
              ),
              incomeFromOperations: this.convertValue(
                statement.incomeFromOperations
              ),
              netIncomeBeforeTaxes: this.convertValue(
                statement.netIncomeBeforeTaxes
              ),
              adjustmentsToProfitOrLoss: this.convertValue(
                statement.adjustmentsToProfitOrLoss
              ),
              changesInAssetsAndLiabilities: this.convertValue(
                statement.changesInAssetsAndLiabilities
              ),
              otherOperatingActivities: this.convertValue(
                statement.otherOperatingActivities
              ),
              increaseOrDecreaseInCash: this.convertValue(
                statement.changeInCash || statement.increaseOrDecreaseInCash
              ),
              initialCashBalance: this.convertValue(
                statement.initialCashBalance
              ),
              finalCashBalance: this.convertValue(statement.finalCashBalance),
              cashGeneratedInOperations: this.convertValue(
                statement.cashGeneratedInOperations
              ),
            },
            create: {
              companyId,
              period: "YEARLY",
              endDate,
              operatingCashFlow: this.convertValue(
                statement.operatingCashFlow ||
                  statement.totalCashFromOperatingActivities
              ),
              investmentCashFlow: this.convertValue(
                statement.investmentCashFlow ||
                  statement.totalCashflowsFromInvestingActivities
              ),
              financingCashFlow: this.convertValue(
                statement.financingCashFlow ||
                  statement.totalCashFromFinancingActivities
              ),
              incomeFromOperations: this.convertValue(
                statement.incomeFromOperations
              ),
              netIncomeBeforeTaxes: this.convertValue(
                statement.netIncomeBeforeTaxes
              ),
              adjustmentsToProfitOrLoss: this.convertValue(
                statement.adjustmentsToProfitOrLoss
              ),
              changesInAssetsAndLiabilities: this.convertValue(
                statement.changesInAssetsAndLiabilities
              ),
              otherOperatingActivities: this.convertValue(
                statement.otherOperatingActivities
              ),
              increaseOrDecreaseInCash: this.convertValue(
                statement.changeInCash || statement.increaseOrDecreaseInCash
              ),
              initialCashBalance: this.convertValue(
                statement.initialCashBalance
              ),
              finalCashBalance: this.convertValue(statement.finalCashBalance),
              cashGeneratedInOperations: this.convertValue(
                statement.cashGeneratedInOperations
              ),
            },
          });
          console.log(
            `  ✅ DFC ${endDate.getFullYear()} processado com dados válidos`
          );
        } else {
          console.log(
            `  ⚠️ DFC ${endDate.getFullYear()} pulado - sem dados válidos`
          );
        }

        console.log(`  ✅ DFC ${endDate.getFullYear()} processado`);
      } catch (error: any) {
        console.error(
          `  ❌ Erro ao processar DFC de ${statement.endDate}:`,
          error.message
        );
      }
    }
  }

  /**
   * Processa dados históricos de preços (se disponível)
   */
  static async processHistoricalPrices(
    companyId: number,
    ticker: string
  ): Promise<void> {
    try {
      console.log(`📊 [BDR] Buscando preços históricos para ${ticker}...`);

      // Importar yahoo-finance2 dinamicamente
      const yahooModule = await import("yahoo-finance2");
      const YahooFinance = yahooModule.default;
      const yahooFinance = new YahooFinance({
        suppressNotices: ["yahooSurvey"],
      });

      // Buscar dados dos últimos 10 anos (máximo possível para análises históricas)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 10);

      const historicalData = await (yahooFinance as any).historical(ticker, {
        period1: startDate,
        period2: endDate,
        interval: "1mo", // Dados mensais
        events: "history",
      });

      if (historicalData && historicalData.length > 0) {
        console.log(
          `  📈 Processando ${historicalData.length} registros de preços históricos...`
        );

        for (const record of historicalData) {
          try {
            const date = new Date(record.date);

            const openPrice = this.convertValue(record.open);
            const highPrice = this.convertValue(record.high);
            const lowPrice = this.convertValue(record.low);
            const closePrice = this.convertValue(record.close);
            const adjustedClosePrice = this.convertValue(record.adjClose);
            const volumeValue = record.volume ? BigInt(record.volume) : null;

            if (
              openPrice !== null &&
              highPrice !== null &&
              lowPrice !== null &&
              closePrice !== null
            ) {
              const createData: any = {
                companyId,
                date,
                interval: "1mo",
                open: openPrice,
                high: highPrice,
                low: lowPrice,
                close: closePrice,
              };

              if (volumeValue !== null) {
                createData.volume = volumeValue;
              }
              if (adjustedClosePrice !== null) {
                createData.adjustedClose = adjustedClosePrice;
              }

              await prisma.historicalPrice.upsert({
                where: {
                  companyId_date_interval: {
                    companyId,
                    date,
                    interval: "1mo",
                  },
                },
                update: createData,
                create: createData,
              });
            }
          } catch (error: any) {
            console.warn(
              `  ⚠️ Erro ao salvar preço de ${record.date}:`,
              error.message
            );
          }
        }

        console.log(
          `  ✅ ${historicalData.length} preços históricos processados`
        );
      }
    } catch (error: any) {
      console.warn(
        `  ⚠️ Erro ao buscar preços históricos para ${ticker}:`,
        error.message
      );
    }
  }

  /**
   * Processa dividendos históricos (se disponível)
   */
  static async processHistoricalDividends(
    companyId: number,
    ticker: string
  ): Promise<void> {
    try {
      console.log(`💵 [BDR] Buscando dividendos históricos para ${ticker}...`);

      // Importar yahoo-finance2 dinamicamente
      const yahooModule = await import("yahoo-finance2");
      const YahooFinance = yahooModule.default;
      const yahooFinance = new YahooFinance({
        suppressNotices: ["yahooSurvey"],
      });

      // Buscar dados dos últimos 10 anos (máximo possível para análises históricas)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 10);

      const dividendData = await (yahooFinance as any).historical(ticker, {
        period1: startDate,
        period2: endDate,
        events: "dividends" as any,
      });

      if (dividendData && dividendData.length > 0) {
        console.log(
          `  💰 Processando ${dividendData.length} dividendos históricos...`
        );

        for (const dividend of dividendData) {
          try {
            const exDate = new Date(dividend.date);

            const dividendAmount = this.convertValue(dividend.dividends);

            if (dividendAmount !== null && dividendAmount > 0) {
              // Usar a tabela correta para dividendos (assumindo que existe)
              // Se não existir, comentar esta seção
              // Salvar dividendo usando a estrutura existente do sistema
              // Por enquanto, apenas log - seria necessário verificar o schema exato
              console.log(
                `  💰 Dividendo encontrado: ${
                  exDate.toISOString().split("T")[0]
                } - R$ ${dividendAmount}`
              );

              // TODO: Implementar salvamento quando schema de dividendos estiver definido
              // await DividendService.saveDividend(companyId, exDate, dividendAmount, 'DIVIDEND');
            }
          } catch (error: any) {
            console.warn(
              `  ⚠️ Erro ao salvar dividendo de ${dividend.date}:`,
              error.message
            );
          }
        }

        console.log(
          `  ✅ ${dividendData.length} dividendos históricos processados`
        );
      }
    } catch (error: any) {
      console.warn(
        `  ⚠️ Erro ao buscar dividendos históricos para ${ticker}:`,
        error.message
      );
    }
  }

  /**
   * Obtém lista única de BDRs das carteiras + lista principal
   * Ordenada por prioridade: NULL primeiro, depois mais antigos
   */
  static async getUniqueBDRList(): Promise<string[]> {
    try {
      // Buscar BDRs das carteiras
      const portfolioBDRs = await prisma.portfolioConfigAsset.findMany({
        where: {
          isActive: true,
          portfolio: {
            isActive: true,
          },
        },
        select: {
          ticker: true,
        },
        distinct: ["ticker"],
      });

      const portfolioTickers = portfolioBDRs
        .map((asset) => asset.ticker.toUpperCase())
        .filter((ticker) => this.isBDR(ticker)); // Filtrar apenas BDRs

      // Combinar com lista principal e remover duplicatas
      const allBDRTickersWithSA = [
        ...new Set([...MAIN_BDRS, ...portfolioTickers]),
      ];

      // Converter para tickers limpos (sem .SA) para buscar no banco
      const allBDRsClean = allBDRTickersWithSA.map((ticker) =>
        this.cleanTickerForDB(ticker)
      );

      console.log(
        `📊 [BDR] Lista única: ${allBDRsClean.length} BDRs (${portfolioTickers.length} das carteiras + ${MAIN_BDRS.length} principais)`
      );

      // Buscar informações de atualização no banco para ordenar por prioridade
      const companiesWithUpdateInfo = await prisma.company.findMany({
        where: {
          ticker: {
            in: allBDRsClean.map((t) => t.toUpperCase()),
          },
        },
        select: {
          ticker: true,
          yahooLastBdrUpdatedAt: true,
        },
      });

      // Criar mapa de última atualização
      const updateMap = new Map<string, Date | null>();
      companiesWithUpdateInfo.forEach((company) => {
        updateMap.set(company.ticker, company.yahooLastBdrUpdatedAt);
      });

      // Ordenar por prioridade: NULL primeiro (nunca processados), depois mais antigos
      const sortedBDRs = allBDRsClean.sort((a, b) => {
        const dateA = updateMap.get(a.toUpperCase());
        const dateB = updateMap.get(b.toUpperCase());

        // Se A é NULL e B não é, A tem prioridade
        if (dateA === null && dateB !== null) return -1;
        // Se B é NULL e A não é, B tem prioridade
        if (dateB === null && dateA !== null) return 1;
        // Se ambos são NULL, manter ordem alfabética
        if (dateA === null && dateB === null) return a.localeCompare(b);
        // Se ambos têm data, mais antigo primeiro
        if (dateA && dateB) return dateA.getTime() - dateB.getTime();

        return 0;
      });

      console.log(`🔄 [BDR] Lista ordenada por prioridade:`);
      console.log(
        `   - Nunca processados: ${
          sortedBDRs.filter(
            (t) =>
              !updateMap.has(t.toUpperCase()) ||
              updateMap.get(t.toUpperCase()) === null
          ).length
        }`
      );
      console.log(
        `   - Já processados: ${
          sortedBDRs.filter(
            (t) =>
              updateMap.has(t.toUpperCase()) &&
              updateMap.get(t.toUpperCase()) !== null
          ).length
        }`
      );

      // Retornar com sufixo .SA para compatibilidade com Yahoo Finance
      return sortedBDRs.map((ticker) => this.addSuffixForYahoo(ticker));
    } catch (error: any) {
      console.error(`❌ [BDR] Erro ao obter lista única:`, error.message);
      return MAIN_BDRS; // Fallback para lista principal
    }
  }
}
