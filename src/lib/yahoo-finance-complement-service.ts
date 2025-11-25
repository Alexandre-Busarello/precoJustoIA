/**
 * YAHOO FINANCE COMPLEMENT SERVICE
 * 
 * Complementa dados de empresas usando yahoo-finance2
 * Como ÚLTIMA fonte (após Ward, Fundamentus, Brapi)
 * 
 * Extrai TODOS os dados possíveis e disponibiliza para complementar
 * campos que não foram preenchidos pelas outras fontes
 */

import { prisma } from '@/lib/prisma';
import { safeWrite } from '@/lib/prisma-wrapper';
import type { AssetType } from '@prisma/client';

// Yahoo Finance instance (lazy-loaded)
let yahooFinanceInstance: any = null;

async function getYahooFinance() {
  if (!yahooFinanceInstance) {
    const module = await import('yahoo-finance2');
    const YahooFinance = module.default;
    yahooFinanceInstance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
  }
  return yahooFinanceInstance;
}

export interface YahooFinanceCompleteData {
  // === Dados Básicos ===
  ticker: string;
  name: string;
  assetType: AssetType;
  
  // === Quote Data ===
  quote: {
    sharesOutstanding?: number;
    bookValue?: number;
    marketCap?: number;
    forwardPE?: number;
    priceToBook?: number;
    dividendRate?: number;
    dividendYield?: number;
    trailingAnnualDividendRate?: number;
    trailingAnnualDividendYield?: number;
    epsTrailingTwelveMonths?: number;
    epsForward?: number;
    trailingPE?: number;
    fiftyDayAverage?: number;
    twoHundredDayAverage?: number;
    fiftyTwoWeekLow?: number;
    fiftyTwoWeekHigh?: number;
    averageDailyVolume3Month?: number;
    regularMarketVolume?: number;
    beta?: number;
  };
  
  // === Summary Detail ===
  summaryDetail?: {
    dividendRate?: number;
    dividendYield?: number;
    exDividendDate?: Date;
    payoutRatio?: number;
    beta?: number;
    trailingPE?: number;
    marketCap?: number;
    fiftyTwoWeekLow?: number;
    fiftyTwoWeekHigh?: number;
    allTimeHigh?: number;
    allTimeLow?: number;
    priceToSalesTrailing12Months?: number;
    fiftyDayAverage?: number;
    twoHundredDayAverage?: number;
    fiftyTwoWeekChange?: number;
  };
  
  // === Asset Profile ===
  assetProfile?: {
    address1?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    phone?: string;
    website?: string;
    industry?: string;
    sector?: string;
    longBusinessSummary?: string;
    fullTimeEmployees?: number;
  };
  
  // === Financial Data ===
  financialData?: {
    currentPrice?: number;
    targetHighPrice?: number;
    targetLowPrice?: number;
    targetMeanPrice?: number;
    recommendationMean?: number;
    recommendationKey?: string;
    numberOfAnalystOpinions?: number;
    totalCash?: number;
    totalCashPerShare?: number;
    ebitda?: number;
    totalDebt?: number;
    quickRatio?: number;
    currentRatio?: number;
    totalRevenue?: number;
    debtToEquity?: number;
    revenuePerShare?: number;
    returnOnAssets?: number;
    returnOnEquity?: number;
    grossProfits?: number;
    freeCashflow?: number;
    operatingCashflow?: number;
    earningsGrowth?: number;
    revenueGrowth?: number;
    grossMargins?: number;
    ebitdaMargins?: number;
    operatingMargins?: number;
    profitMargins?: number;
  };
  
  // === Default Key Statistics ===
  defaultKeyStatistics?: {
    enterpriseValue?: number;
    forwardPE?: number;
    profitMargins?: number;
    floatShares?: number;
    sharesOutstanding?: number;
    sharesShort?: number;
    sharesShortPriorMonth?: number;
    sharesShortPreviousMonthDate?: Date;
    dateShortInterest?: Date;
    sharesPercentSharesOut?: number;
    heldPercentInsiders?: number;
    heldPercentInstitutions?: number;
    shortRatio?: number;
    shortPercentOfFloat?: number;
    impliedSharesOutstanding?: number;
    bookValue?: number;
    priceToBook?: number;
    lastFiscalYearEnd?: Date;
    nextFiscalYearEnd?: Date;
    mostRecentQuarter?: Date;
    earningsQuarterlyGrowth?: number;
    netIncomeToCommon?: number;
    trailingEps?: number;
    forwardEps?: number;
    pegRatio?: number;
    lastSplitFactor?: string;
    lastSplitDate?: Date;
    enterpriseToRevenue?: number;
    enterpriseToEbitda?: number;
    "52WeekChange"?: number;
    SandP52WeekChange?: number;
    lastDividendValue?: number;
    lastDividendDate?: Date;
  };
  
  // === Dividends (from chart) ===
  dividends: Array<{
    date: Date;
    amount: number;
  }>;
  
  // === ETF Specific Data ===
  etfData?: {
    netAssets?: number;
    netExpenseRatio?: number;
    ytdReturn?: number;
    category?: string;
    totalAssets?: number;
  };
  
  // === FII Specific Data ===
  fiiData?: {
    netAssets?: number;
    patrimonioLiquido?: number;
    valorPatrimonial?: number;
  };
}

/**
 * Yahoo Finance Complement Service
 */
export class YahooFinanceComplementService {
  
  /**
   * Busca TODOS os dados disponíveis do Yahoo Finance para um ativo
   */
  static async fetchCompleteData(ticker: string): Promise<YahooFinanceCompleteData | null> {
    try {
      const yahooFinance = await getYahooFinance();
      const symbol = ticker.toUpperCase().endsWith('.SA') ? ticker.toUpperCase() : `${ticker.toUpperCase()}.SA`;
      
      console.log(`🔍 [YAHOO] Buscando dados completos para ${symbol}...`);
      
      // Parallel fetch for performance
      const [quoteData, quoteSummaryData, chartData] = await Promise.all([
        // 1. Quote (dados principais)
        yahooFinance.quote(symbol).catch((e: any) => {
          console.warn(`⚠️ [YAHOO] Erro ao buscar quote: ${e.message}`);
          return null;
        }),
        
        // 2. QuoteSummary (dados detalhados)
        yahooFinance.quoteSummary(symbol, {
          modules: ['summaryDetail', 'assetProfile', 'financialData', 'defaultKeyStatistics', 'price']
        }).catch((e: any) => {
          console.warn(`⚠️ [YAHOO] Erro ao buscar quoteSummary: ${e.message}`);
          return null;
        }),
        
        // 3. Chart (histórico + dividendos)
        yahooFinance.chart(symbol, {
          period1: new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000), // 10 anos
          period2: new Date(),
          interval: '1mo',
          events: 'dividends'
        }).catch((e: any) => {
          console.warn(`⚠️ [YAHOO] Erro ao buscar chart: ${e.message}`);
          return null;
        })
      ]);
      
      if (!quoteData) {
        console.log(`❌ [YAHOO] ${symbol}: Nenhum dado encontrado`);
        return null;
      }
      
      // Determinar asset type
      const assetType = this.determineAssetType(ticker, quoteData);
      
      // Extract dividends from chart
      const dividends = this.extractDividends(chartData);
      
      // Build complete data object
      const completeData: YahooFinanceCompleteData = {
        ticker: ticker.toUpperCase().replace('.SA', ''),
        name: quoteData.longName || quoteData.shortName || ticker,
        assetType,
        
        quote: {
          sharesOutstanding: quoteData.sharesOutstanding,
          bookValue: quoteData.bookValue,
          marketCap: quoteData.marketCap,
          forwardPE: quoteData.forwardPE,
          priceToBook: quoteData.priceToBook,
          dividendRate: quoteData.dividendRate,
          dividendYield: quoteData.dividendYield,
          trailingAnnualDividendRate: quoteData.trailingAnnualDividendRate,
          trailingAnnualDividendYield: quoteData.trailingAnnualDividendYield,
          epsTrailingTwelveMonths: quoteData.epsTrailingTwelveMonths,
          epsForward: quoteData.epsForward,
          trailingPE: quoteData.trailingPE,
          fiftyDayAverage: quoteData.fiftyDayAverage,
          twoHundredDayAverage: quoteData.twoHundredDayAverage,
          fiftyTwoWeekLow: quoteData.fiftyTwoWeekLow,
          fiftyTwoWeekHigh: quoteData.fiftyTwoWeekHigh,
          averageDailyVolume3Month: quoteData.averageDailyVolume3Month,
          regularMarketVolume: quoteData.regularMarketVolume,
          beta: quoteData.beta
        },
        
        summaryDetail: quoteSummaryData?.summaryDetail ? {
          dividendRate: quoteSummaryData.summaryDetail.dividendRate,
          dividendYield: quoteSummaryData.summaryDetail.dividendYield,
          exDividendDate: quoteSummaryData.summaryDetail.exDividendDate ? new Date(quoteSummaryData.summaryDetail.exDividendDate) : undefined,
          payoutRatio: quoteSummaryData.summaryDetail.payoutRatio,
          beta: quoteSummaryData.summaryDetail.beta,
          trailingPE: quoteSummaryData.summaryDetail.trailingPE,
          marketCap: quoteSummaryData.summaryDetail.marketCap,
          fiftyTwoWeekLow: quoteSummaryData.summaryDetail.fiftyTwoWeekLow,
          fiftyTwoWeekHigh: quoteSummaryData.summaryDetail.fiftyTwoWeekHigh,
          allTimeHigh: quoteSummaryData.summaryDetail.allTimeHigh,
          allTimeLow: quoteSummaryData.summaryDetail.allTimeLow,
          priceToSalesTrailing12Months: quoteSummaryData.summaryDetail.priceToSalesTrailing12Months,
          fiftyDayAverage: quoteSummaryData.summaryDetail.fiftyDayAverage,
          twoHundredDayAverage: quoteSummaryData.summaryDetail.twoHundredDayAverage,
          fiftyTwoWeekChange: quoteSummaryData.summaryDetail.fiftyTwoWeekChange
        } : undefined,
        
        assetProfile: quoteSummaryData?.assetProfile ? {
          address1: quoteSummaryData.assetProfile.address1,
          city: quoteSummaryData.assetProfile.city,
          state: quoteSummaryData.assetProfile.state,
          zip: quoteSummaryData.assetProfile.zip,
          country: quoteSummaryData.assetProfile.country,
          phone: quoteSummaryData.assetProfile.phone,
          website: quoteSummaryData.assetProfile.website,
          industry: quoteSummaryData.assetProfile.industry,
          sector: quoteSummaryData.assetProfile.sector,
          longBusinessSummary: quoteSummaryData.assetProfile.longBusinessSummary,
          fullTimeEmployees: quoteSummaryData.assetProfile.fullTimeEmployees
        } : undefined,
        
        financialData: quoteSummaryData?.financialData ? {
          currentPrice: quoteSummaryData.financialData.currentPrice,
          targetHighPrice: quoteSummaryData.financialData.targetHighPrice,
          targetLowPrice: quoteSummaryData.financialData.targetLowPrice,
          targetMeanPrice: quoteSummaryData.financialData.targetMeanPrice,
          recommendationMean: quoteSummaryData.financialData.recommendationMean,
          recommendationKey: quoteSummaryData.financialData.recommendationKey,
          numberOfAnalystOpinions: quoteSummaryData.financialData.numberOfAnalystOpinions,
          totalCash: quoteSummaryData.financialData.totalCash,
          totalCashPerShare: quoteSummaryData.financialData.totalCashPerShare,
          ebitda: quoteSummaryData.financialData.ebitda,
          totalDebt: quoteSummaryData.financialData.totalDebt,
          quickRatio: quoteSummaryData.financialData.quickRatio,
          currentRatio: quoteSummaryData.financialData.currentRatio,
          totalRevenue: quoteSummaryData.financialData.totalRevenue,
          debtToEquity: quoteSummaryData.financialData.debtToEquity,
          revenuePerShare: quoteSummaryData.financialData.revenuePerShare,
          returnOnAssets: quoteSummaryData.financialData.returnOnAssets,
          returnOnEquity: quoteSummaryData.financialData.returnOnEquity,
          grossProfits: quoteSummaryData.financialData.grossProfits,
          freeCashflow: quoteSummaryData.financialData.freeCashflow,
          operatingCashflow: quoteSummaryData.financialData.operatingCashflow,
          earningsGrowth: quoteSummaryData.financialData.earningsGrowth,
          revenueGrowth: quoteSummaryData.financialData.revenueGrowth,
          grossMargins: quoteSummaryData.financialData.grossMargins,
          ebitdaMargins: quoteSummaryData.financialData.ebitdaMargins,
          operatingMargins: quoteSummaryData.financialData.operatingMargins,
          profitMargins: quoteSummaryData.financialData.profitMargins
        } : undefined,
        
        defaultKeyStatistics: quoteSummaryData?.defaultKeyStatistics,
        
        dividends,
        
        // Asset-specific data será preenchido depois se necessário
        etfData: assetType === 'ETF' ? {} : undefined,
        fiiData: assetType === 'FII' ? {} : undefined
      };
      
      console.log(`✅ [YAHOO] ${symbol}: Dados completos extraídos (${dividends.length} dividendos)`);
      
      return completeData;
      
    } catch (error: any) {
      console.error(`❌ [YAHOO] Erro ao buscar dados completos para ${ticker}:`, error.message);
      return null;
    }
  }
  
  /**
   * Extrai dividendos do objeto chart
   */
  private static extractDividends(chartData: any): Array<{ date: Date; amount: number }> {
    const dividends: Array<{ date: Date; amount: number }> = [];
    
    if (!chartData || !chartData.events || !chartData.events.dividends) {
      return dividends;
    }
    
    const dividendEvents = chartData.events.dividends;
    
    // Se for array
    if (Array.isArray(dividendEvents)) {
      for (const div of dividendEvents) {
        if (div.date && div.amount && div.amount > 0) {
          dividends.push({
            date: div.date instanceof Date ? div.date : new Date(div.date),
            amount: Number(div.amount)
          });
        }
      }
    }
    // Se for objeto (mapeado por timestamp)
    else if (typeof dividendEvents === 'object') {
      for (const [timestamp, div] of Object.entries(dividendEvents)) {
        const divData = div as any;
        if (divData.amount && divData.amount > 0) {
          dividends.push({
            date: divData.date instanceof Date ? divData.date : new Date(divData.date || Number(timestamp) * 1000),
            amount: Number(divData.amount)
          });
        }
      }
    }
    
    return dividends.sort((a, b) => b.date.getTime() - a.date.getTime());
  }
  
  /**
   * Determina o tipo de ativo baseado no ticker e dados do quote
   */
  private static determineAssetType(ticker: string, quoteData: any): AssetType {
    const tickerUpper = ticker.toUpperCase();
    
    // FIIs: Geralmente terminam em 11
    if (tickerUpper.match(/11$/)) {
      return 'FII';
    }
    
    // BDRs: Geralmente terminam em 34 ou 35
    if (tickerUpper.match(/3[45]$/)) {
      return 'BDR';
    }
    
    // ETFs: Verificar no quoteType ou nome
    if (quoteData.quoteType === 'ETF' || quoteData.longName?.toLowerCase().includes('etf')) {
      return 'ETF';
    }
    
    // Default: STOCK
    return 'STOCK';
  }
  
  /**
   * Complementa dados de uma empresa existente
   * Salva APENAS campos que NÃO estão preenchidos (exceto sector/industry)
   * Atualiza data_source adicionando "+yahoo"
   */
  static async complementCompanyData(
    companyId: number,
    ticker: string,
    preserveSector: boolean = true,
    preserveIndustry: boolean = true
  ): Promise<boolean> {
    try {
      console.log(`🔄 [YAHOO COMPLEMENT] Complementando dados de ${ticker}...`);
      
      // Fetch complete data from Yahoo
      const yahooData = await this.fetchCompleteData(ticker);
      
      if (!yahooData) {
        console.log(`❌ [YAHOO COMPLEMENT] Nenhum dado disponível para ${ticker}`);
        return false;
      }
      
      // Get existing company data to see what's missing
      const existingCompany = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          description: true,
          website: true,
          address: true,
          city: true,
          state: true,
          zip: true,
          phone: true,
          country: true,
          fullTimeEmployees: true,
          sector: true,
          industry: true
        }
      });
      
      if (!existingCompany) {
        console.log(`❌ [YAHOO COMPLEMENT] Empresa ${companyId} não encontrada`);
        return false;
      }
      
      // Build update object with ONLY missing fields
      const updateData: any = {};
      let fieldsComplemented = 0;
      
      if (!existingCompany.description && yahooData.assetProfile?.longBusinessSummary) {
        updateData.description = yahooData.assetProfile.longBusinessSummary.substring(0, 1000);
        fieldsComplemented++;
      }
      
      if (!existingCompany.website && yahooData.assetProfile?.website) {
        updateData.website = yahooData.assetProfile.website;
        fieldsComplemented++;
      }
      
      if (!existingCompany.address && yahooData.assetProfile?.address1) {
        updateData.address = yahooData.assetProfile.address1;
        fieldsComplemented++;
      }
      
      if (!existingCompany.city && yahooData.assetProfile?.city) {
        updateData.city = yahooData.assetProfile.city;
        fieldsComplemented++;
      }
      
      if (!existingCompany.state && yahooData.assetProfile?.state) {
        updateData.state = yahooData.assetProfile.state;
        fieldsComplemented++;
      }
      
      if (!existingCompany.zip && yahooData.assetProfile?.zip) {
        updateData.zip = yahooData.assetProfile.zip;
        fieldsComplemented++;
      }
      
      if (!existingCompany.phone && yahooData.assetProfile?.phone) {
        updateData.phone = yahooData.assetProfile.phone;
        fieldsComplemented++;
      }
      
      if (!existingCompany.country && yahooData.assetProfile?.country) {
        updateData.country = yahooData.assetProfile.country;
        fieldsComplemented++;
      }
      
      if (!existingCompany.fullTimeEmployees && yahooData.assetProfile?.fullTimeEmployees) {
        updateData.fullTimeEmployees = yahooData.assetProfile.fullTimeEmployees;
        fieldsComplemented++;
      }
      
      // Sector e Industry: apenas se não existirem E a flag permitir
      if (!preserveSector && !existingCompany.sector && yahooData.assetProfile?.sector) {
        updateData.sector = yahooData.assetProfile.sector;
        fieldsComplemented++;
      }
      
      if (!preserveIndustry && !existingCompany.industry && yahooData.assetProfile?.industry) {
        updateData.industry = yahooData.assetProfile.industry;
        fieldsComplemented++;
      }
      
      // Update company if there are changes
      if (fieldsComplemented > 0) {
        await safeWrite(
          'yahoo-complement-company',
          () => prisma.company.update({
            where: { id: companyId },
            data: {
              ...updateData,
              yahooLastUpdatedAt: new Date(),
              updatedAt: new Date()
            }
          }),
          ['companies']
        );
        
        console.log(`✅ [YAHOO COMPLEMENT] ${ticker}: ${fieldsComplemented} campos complementados`);
      } else {
        console.log(`ℹ️ [YAHOO COMPLEMENT] ${ticker}: Nenhum campo da Company a complementar`);
      }
      
      // Save dividends if available
      if (yahooData.dividends.length > 0) {
        await this.saveDividends(companyId, yahooData.dividends);
      }
      
      // Complement financial data (FinancialData table)
      await this.complementFinancialData(companyId, ticker, yahooData);
      
      // Update asset-specific data
      if (yahooData.assetType === 'ETF' && yahooData.etfData) {
        await this.updateEtfData(companyId, yahooData);
      } else if (yahooData.assetType === 'FII' && yahooData.fiiData) {
        await this.updateFiiData(companyId, yahooData);
      }
      
      // Always update yahooLastUpdatedAt to track that we processed this asset
      if (fieldsComplemented === 0) {
        await safeWrite(
          'yahoo-update-timestamp',
          () => prisma.company.update({
            where: { id: companyId },
            data: {
              yahooLastUpdatedAt: new Date()
            }
          }),
          ['companies']
        );
      }
      
      return true;
      
    } catch (error: any) {
      console.error(`❌ [YAHOO COMPLEMENT] Erro ao complementar dados de ${ticker}:`, error.message);
      return false;
    }
  }
  
  /**
   * Busca a última data de dividendos salvos para uma empresa
   */
  private static async getLastDividendDate(companyId: number): Promise<Date | null> {
    try {
      const lastDividend = await prisma.dividendHistory.findFirst({
        where: { companyId },
        orderBy: { exDate: 'desc' },
        select: { exDate: true }
      });
      
      return lastDividend?.exDate || null;
    } catch (error: any) {
      console.error(`❌ [DIVIDENDS] Erro ao buscar última data:`, error.message);
      return null;
    }
  }
  
  /**
   * Salva dividendos históricos na tabela dividend_history
   * Atualização incremental: filtra apenas dividendos mais recentes que o último salvo
   */
  private static async saveDividends(
    companyId: number,
    dividends: Array<{ date: Date; amount: number }>
  ): Promise<void> {
    if (dividends.length === 0) return;
    
    try {
      // Get last dividend date to filter only new ones
      const lastDividendDate = await this.getLastDividendDate(companyId);
      
      // Filter only new dividends
      let dividendsToSave = dividends;
      if (lastDividendDate) {
        dividendsToSave = dividends.filter(d => d.date > lastDividendDate);
        
        if (dividendsToSave.length === 0) {
          console.log(`✅ [DIVIDENDS] Nenhum dividendo novo para companyId ${companyId} (última data: ${lastDividendDate.toISOString().split('T')[0]})`);
          return;
        }
        
        console.log(`📊 [DIVIDENDS] ${dividendsToSave.length} novos dividendos (de ${dividends.length} totais) para companyId ${companyId}`);
      }
      
      // Batch upsert (50 per batch to avoid connection pool issues)
      // Upsert baseado em companyId + exDate + amount
      // Permite múltiplos dividendos na mesma data (ex: JCP e dividendos ordinários)
      const BATCH_SIZE = 50;
      for (let i = 0; i < dividendsToSave.length; i += BATCH_SIZE) {
        const batch = dividendsToSave.slice(i, i + BATCH_SIZE);
        
        await Promise.all(
          batch.map(dividend =>
            prisma.dividendHistory.upsert({
              where: {
                companyId_exDate_amount: {
                  companyId,
                  exDate: dividend.date,
                  amount: dividend.amount
                }
              },
              update: {
                updatedAt: new Date()
              },
              create: {
                companyId,
                exDate: dividend.date,
                amount: dividend.amount,
                source: 'yahoo'
              }
            })
          )
        );
      }
      
      // Update company with latest dividend
      const latestDividend = dividends[0]; // Already sorted descending
      await safeWrite(
        'update-company-latest-dividend-companies',
        () => prisma.company.update({
          where: { id: companyId },
          data: {
            ultimoDividendo: latestDividend.amount,
            dataUltimoDividendo: latestDividend.date
          }
        }),
        ['companies']
      );
      
      console.log(`💰 [DIVIDENDS] Salvos ${dividendsToSave.length} dividendos para companyId ${companyId}`);
      
    } catch (error: any) {
      console.error(`❌ [DIVIDENDS] Erro ao salvar dividendos:`, error.message);
    }
  }
  
  /**
   * Atualiza dados específicos de ETF
   */
  private static async updateEtfData(companyId: number, yahooData: YahooFinanceCompleteData): Promise<void> {
    try {
      // Buscar último dividendo de dividend_history se não disponível no quote
      let lastDividendValue = yahooData.quote.dividendRate;
      let lastDividendDate = yahooData.summaryDetail?.exDividendDate;
      
      if (!lastDividendValue || !lastDividendDate) {
        const lastDividend = await prisma.dividendHistory.findFirst({
          where: { companyId },
          orderBy: { exDate: 'desc' },
          select: { amount: true, exDate: true }
        });
        
        if (lastDividend) {
          lastDividendValue = lastDividendValue || Number(lastDividend.amount);
          lastDividendDate = lastDividendDate || lastDividend.exDate;
          console.log(`💡 [ETF DATA] Usando último dividendo de dividend_history: ${lastDividend.amount} em ${lastDividend.exDate.toISOString().split('T')[0]}`);
        }
      }
      
      await safeWrite(
        'yahoo-upsert-etf-data',
        () => prisma.etfData.upsert({
          where: { companyId },
          update: {
            netAssets: yahooData.quote.marketCap,
            dividendYield: yahooData.quote.dividendYield || yahooData.summaryDetail?.dividendYield,
            ytdReturn: yahooData.summaryDetail?.fiftyTwoWeekChange,
            totalAssets: yahooData.summaryDetail?.marketCap,
            updatedAt: new Date()
          },
          create: {
            companyId,
            netAssets: yahooData.quote.marketCap,
            dividendYield: yahooData.quote.dividendYield || yahooData.summaryDetail?.dividendYield,
            ytdReturn: yahooData.summaryDetail?.fiftyTwoWeekChange,
            totalAssets: yahooData.summaryDetail?.marketCap
          }
        }),
        ['etf_data']
      );
      
      console.log(`📊 [ETF DATA] Atualizado para companyId ${companyId}`);
      
    } catch (error: any) {
      console.error(`❌ [ETF DATA] Erro ao atualizar:`, error.message);
    }
  }
  
  /**
   * Atualiza dados específicos de FII
   */
  private static async updateFiiData(companyId: number, yahooData: YahooFinanceCompleteData): Promise<void> {
    try {
      // Buscar último dividendo de dividend_history se não disponível no quote
      let lastDividendValue = yahooData.quote.dividendRate;
      let lastDividendDate = yahooData.summaryDetail?.exDividendDate;
      
      if (!lastDividendValue || !lastDividendDate) {
        const lastDividend = await prisma.dividendHistory.findFirst({
          where: { companyId },
          orderBy: { exDate: 'desc' },
          select: { amount: true, exDate: true }
        });
        
        if (lastDividend) {
          lastDividendValue = lastDividendValue || Number(lastDividend.amount);
          lastDividendDate = lastDividendDate || lastDividend.exDate;
          console.log(`💡 [FII DATA] Usando último dividendo de dividend_history: ${lastDividend.amount} em ${lastDividend.exDate.toISOString().split('T')[0]}`);
        }
      }
      
      await safeWrite(
        'yahoo-upsert-fii-data',
        () => prisma.fiiData.upsert({
          where: { companyId },
          update: {
            netAssets: yahooData.quote.marketCap,
            dividendYield: yahooData.quote.dividendYield || yahooData.summaryDetail?.dividendYield,
            lastDividendValue: lastDividendValue,
            lastDividendDate: lastDividendDate,
            patrimonioLiquido: yahooData.quote.marketCap,
            valorPatrimonial: yahooData.quote.bookValue,
            updatedAt: new Date()
          },
          create: {
            companyId,
            netAssets: yahooData.quote.marketCap,
            dividendYield: yahooData.quote.dividendYield || yahooData.summaryDetail?.dividendYield,
            lastDividendValue: lastDividendValue,
            lastDividendDate: lastDividendDate,
            patrimonioLiquido: yahooData.quote.marketCap,
            valorPatrimonial: yahooData.quote.bookValue
          }
        }),
        ['fii_data']
      );
      
      console.log(`🏢 [FII DATA] Atualizado para companyId ${companyId}`);
      
    } catch (error: any) {
      console.error(`❌ [FII DATA] Erro ao atualizar:`, error.message);
    }
  }
  
  /**
   * Complementa dados financeiros da tabela FinancialData
   * Busca módulos adicionais do Yahoo Finance se necessário
   * Atualiza dataSource com "+yahoo"
   */
  private static async complementFinancialData(
    companyId: number,
    ticker: string,
    yahooData: YahooFinanceCompleteData
  ): Promise<void> {
    try {
      // Get current year
      const currentYear = new Date().getFullYear();
      
      // Check if financial data exists for current year
      const existingFinancialData = await prisma.financialData.findFirst({
        where: {
          companyId,
          year: currentYear
        }
      });
      
      if (!existingFinancialData) {
        console.log(`ℹ️ [FINANCIAL DATA] ${ticker}: Nenhum dado financeiro existente para ${currentYear}`);
        return;
      }
      
      // Build update object with ONLY missing fields
      const updateData: any = {};
      let fieldsComplemented = 0;
      
      // --- Market Data (from quote) ---
      if (!existingFinancialData.marketCap && yahooData.quote.marketCap) {
        updateData.marketCap = yahooData.quote.marketCap;
        fieldsComplemented++;
      }
      
      if (!existingFinancialData.sharesOutstanding && yahooData.quote.sharesOutstanding) {
        updateData.sharesOutstanding = yahooData.quote.sharesOutstanding;
        fieldsComplemented++;
      }
      
      if (!existingFinancialData.forwardPE && yahooData.quote.forwardPE) {
        updateData.forwardPE = yahooData.quote.forwardPE;
        fieldsComplemented++;
      }
      
      if (!existingFinancialData.pl && yahooData.quote.trailingPE) {
        updateData.pl = yahooData.quote.trailingPE;
        fieldsComplemented++;
      }
      
      if (!existingFinancialData.pvp && yahooData.quote.priceToBook) {
        updateData.pvp = yahooData.quote.priceToBook;
        fieldsComplemented++;
      }
      
      if (!existingFinancialData.trailingEps && yahooData.quote.epsTrailingTwelveMonths) {
        updateData.trailingEps = yahooData.quote.epsTrailingTwelveMonths;
        fieldsComplemented++;
      }
      
      if (!existingFinancialData.dividendYield12m && yahooData.quote.dividendYield) {
        updateData.dividendYield12m = yahooData.quote.dividendYield;
        fieldsComplemented++;
      }
      
      // --- Financial Data (from financialData module) ---
      if (yahooData.financialData) {
        if (!existingFinancialData.totalCaixa && yahooData.financialData.totalCash) {
          updateData.totalCaixa = yahooData.financialData.totalCash;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.caixaPorAcao && yahooData.financialData.totalCashPerShare) {
          updateData.caixaPorAcao = yahooData.financialData.totalCashPerShare;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.ebitda && yahooData.financialData.ebitda) {
          updateData.ebitda = yahooData.financialData.ebitda;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.totalDivida && yahooData.financialData.totalDebt) {
          updateData.totalDivida = yahooData.financialData.totalDebt;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.liquidezRapida && yahooData.financialData.quickRatio) {
          updateData.liquidezRapida = yahooData.financialData.quickRatio;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.liquidezCorrente && yahooData.financialData.currentRatio) {
          updateData.liquidezCorrente = yahooData.financialData.currentRatio;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.receitaTotal && yahooData.financialData.totalRevenue) {
          updateData.receitaTotal = yahooData.financialData.totalRevenue;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.debtToEquity && yahooData.financialData.debtToEquity) {
          updateData.debtToEquity = yahooData.financialData.debtToEquity;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.receitaPorAcao && yahooData.financialData.revenuePerShare) {
          updateData.receitaPorAcao = yahooData.financialData.revenuePerShare;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.roa && yahooData.financialData.returnOnAssets) {
          updateData.roa = yahooData.financialData.returnOnAssets;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.roe && yahooData.financialData.returnOnEquity) {
          updateData.roe = yahooData.financialData.returnOnEquity;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.fluxoCaixaLivre && yahooData.financialData.freeCashflow) {
          updateData.fluxoCaixaLivre = yahooData.financialData.freeCashflow;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.fluxoCaixaOperacional && yahooData.financialData.operatingCashflow) {
          updateData.fluxoCaixaOperacional = yahooData.financialData.operatingCashflow;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.crescimentoLucros && yahooData.financialData.earningsGrowth) {
          updateData.crescimentoLucros = yahooData.financialData.earningsGrowth;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.crescimentoReceitas && yahooData.financialData.revenueGrowth) {
          updateData.crescimentoReceitas = yahooData.financialData.revenueGrowth;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.margemBruta && yahooData.financialData.grossMargins) {
          updateData.margemBruta = yahooData.financialData.grossMargins;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.margemEbitda && yahooData.financialData.ebitdaMargins) {
          updateData.margemEbitda = yahooData.financialData.ebitdaMargins;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.margemLiquida && yahooData.financialData.profitMargins) {
          updateData.margemLiquida = yahooData.financialData.profitMargins;
          fieldsComplemented++;
        }
      }
      
      // --- Key Statistics (from defaultKeyStatistics) ---
      if (yahooData.defaultKeyStatistics) {
        if (!existingFinancialData.enterpriseValue && yahooData.defaultKeyStatistics.enterpriseValue) {
          updateData.enterpriseValue = yahooData.defaultKeyStatistics.enterpriseValue;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.vpa && yahooData.defaultKeyStatistics.bookValue) {
          updateData.vpa = yahooData.defaultKeyStatistics.bookValue;
          fieldsComplemented++;
        }
      }
      
      // --- Summary Detail ---
      if (yahooData.summaryDetail) {
        if (!existingFinancialData.payout && yahooData.summaryDetail.payoutRatio) {
          updateData.payout = yahooData.summaryDetail.payoutRatio;
          fieldsComplemented++;
        }
        
        if (!existingFinancialData.variacao52Semanas && yahooData.summaryDetail.fiftyTwoWeekChange) {
          updateData.variacao52Semanas = yahooData.summaryDetail.fiftyTwoWeekChange;
          fieldsComplemented++;
        }
      }
      
      // Update financial data if there are changes
      if (fieldsComplemented > 0) {
        // Update dataSource to add "+yahoo"
        let newDataSource = existingFinancialData.dataSource || 'unknown';
        if (!newDataSource.includes('yahoo')) {
          newDataSource += '+yahoo';
        }
        
        updateData.dataSource = newDataSource;
        updateData.updatedAt = new Date();
        
        await safeWrite(
          'yahoo-complement-financial-data',
          () => prisma.financialData.update({
            where: {
              companyId_year: {
                companyId,
                year: currentYear
              }
            },
            data: updateData
          }),
          ['financial_data']
        );
        
        console.log(`✅ [FINANCIAL DATA] ${ticker}: ${fieldsComplemented} campos complementados (dataSource: ${newDataSource})`);
      } else {
        console.log(`ℹ️ [FINANCIAL DATA] ${ticker}: Nenhum campo da FinancialData a complementar`);
      }
      
    } catch (error: any) {
      console.error(`❌ [FINANCIAL DATA] Erro ao complementar dados financeiros:`, error.message);
    }
  }
}

