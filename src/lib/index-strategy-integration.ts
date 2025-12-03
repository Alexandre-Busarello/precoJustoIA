/**
 * Index Strategy Integration Service
 * 
 * Integra com estratégias existentes para calcular fairValue, upside e outros indicadores
 * necessários para o screening de índices.
 */

import { prisma } from '@/lib/prisma';
import { getTickerPrice, getLatestPrices } from '@/lib/quote-service';
import { executeCompanyAnalysis } from '@/lib/company-analysis-service';
import { toNumber } from '@/lib/strategies/base-strategy';

export interface CompanyUpsideData {
  ticker: string;
  currentPrice: number;
  fairValue: number | null;
  upside: number | null; // (fairValue - currentPrice) / currentPrice
  overallScore: number | null;
  dividendYield: number | null;
}

export interface AverageVolumeData {
  ticker: string;
  averageDailyVolume: number; // Volume médio em R$
  days: number; // Número de dias considerados
}

/**
 * Calcula upside usando estratégias existentes
 * Tenta múltiplas estratégias e retorna o melhor resultado
 */
export async function calculateUpside(ticker: string): Promise<CompanyUpsideData | null> {
  try {
    // 1. Buscar preço atual
    const priceData = await getTickerPrice(ticker);
    if (!priceData) {
      console.warn(`⚠️ [INDEX INTEGRATION] No price found for ${ticker}`);
      return null;
    }

    const currentPrice = priceData.price;

    // 2. Buscar dados completos da empresa
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 1
        }
      }
    });

    if (!company || !company.financialData || company.financialData.length === 0) {
      console.warn(`⚠️ [INDEX INTEGRATION] No financial data found for ${ticker}`);
      return null;
    }

    const latestFinancials = company.financialData[0];

    // 3. Executar análise completa da empresa
    const analysisResult = await executeCompanyAnalysis({
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      currentPrice,
      financials: latestFinancials as any,
      historicalFinancials: company.financialData.map(fd => ({
        year: fd.year,
        roe: toNumber(fd.roe),
        roic: toNumber(fd.roic),
        pl: toNumber(fd.pl),
        pvp: toNumber(fd.pvp),
        dy: toNumber(fd.dy),
        margemLiquida: toNumber(fd.margemLiquida),
        margemEbitda: toNumber(fd.margemEbitda),
        margemBruta: toNumber(fd.margemBruta),
        liquidezCorrente: toNumber(fd.liquidezCorrente),
        liquidezRapida: toNumber(fd.liquidezRapida),
        dividaLiquidaPl: toNumber(fd.dividaLiquidaPl),
        dividaLiquidaEbitda: toNumber(fd.dividaLiquidaEbitda),
        lpa: toNumber(fd.lpa),
        vpa: toNumber(fd.vpa),
        marketCap: toNumber(fd.marketCap),
        earningsYield: toNumber(fd.earningsYield),
        evEbitda: toNumber(fd.evEbitda),
        roa: toNumber(fd.roa),
        passivoAtivos: toNumber(fd.passivoAtivos)
      }))
    }, {
      isLoggedIn: true, // Para índices, sempre usar análise completa
      isPremium: true, // Para índices, sempre usar análise completa
      includeStatements: false, // Não precisa de demonstrações para cálculo de upside
      includeBreakdown: false
    });

    // 4. Tentar calcular fairValue usando múltiplas estratégias
    let bestFairValue: number | null = null;
    let bestUpside: number | null = null;

    // Tentar Graham primeiro (sempre disponível)
    if (analysisResult.strategies.graham?.fairValue) {
      const grahamFairValue = analysisResult.strategies.graham.fairValue;
      const grahamUpside = grahamFairValue ? ((grahamFairValue - currentPrice) / currentPrice) * 100 : null;
      
      if (grahamFairValue && grahamUpside !== null) {
        bestFairValue = grahamFairValue;
        bestUpside = grahamUpside;
      }
    }

    // Tentar FCD (se disponível)
    if (analysisResult.strategies.fcd?.fairValue) {
      const fcdFairValue = analysisResult.strategies.fcd.fairValue;
      const fcdUpside = fcdFairValue ? ((fcdFairValue - currentPrice) / currentPrice) * 100 : null;
      
      if (fcdFairValue && fcdUpside !== null && (bestUpside === null || fcdUpside > bestUpside)) {
        bestFairValue = fcdFairValue;
        bestUpside = fcdUpside;
      }
    }

    // Tentar Gordon (se disponível)
    if (analysisResult.strategies.gordon?.fairValue) {
      const gordonFairValue = analysisResult.strategies.gordon.fairValue;
      const gordonUpside = gordonFairValue ? ((gordonFairValue - currentPrice) / currentPrice) * 100 : null;
      
      if (gordonFairValue && gordonUpside !== null && (bestUpside === null || gordonUpside > bestUpside)) {
        bestFairValue = gordonFairValue;
        bestUpside = gordonUpside;
      }
    }

    // 5. Extrair dividend yield
    const dividendYield = toNumber(latestFinancials.dy);

    // 6. Extrair overall score
    const overallScore = analysisResult.overallScore?.score || null;

    return {
      ticker,
      currentPrice,
      fairValue: bestFairValue,
      upside: bestUpside,
      overallScore,
      dividendYield: dividendYield ? dividendYield * 100 : null // Converter para porcentagem
    };
  } catch (error) {
    console.error(`❌ [INDEX INTEGRATION] Error calculating upside for ${ticker}:`, error);
    return null;
  }
}

/**
 * Calcula volume médio diário em R$ para um ticker
 * Usa dados históricos dos últimos N dias úteis
 */
export async function getAverageDailyVolume(
  ticker: string,
  days: number = 30
): Promise<AverageVolumeData | null> {
  try {
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      select: { id: true }
    });

    if (!company) {
      return null;
    }

    // Buscar preços históricos dos últimos N dias
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days * 2); // Multiplicar por 2 para compensar fins de semana

    const historicalPrices = await prisma.historicalPrice.findMany({
      where: {
        companyId: company.id,
        date: {
          gte: startDate,
          lte: endDate
        },
        interval: '1d' // Apenas dados diários
      },
      orderBy: {
        date: 'desc'
      },
      take: days
    });

    if (historicalPrices.length === 0) {
      // Fallback: tentar buscar de daily_quotes (mas não temos volume lá)
      // Por enquanto, retornar null e deixar o screening decidir
      console.log(`    ⚠️ ${ticker}: No historical prices found for volume calculation`);
      return null;
    }

    // Calcular volume médio em R$
    // Volume está em unidades, precisamos multiplicar pelo preço médio
    let totalVolumeBRL = 0;
    let validDays = 0;

    for (const price of historicalPrices) {
      const volume = Number(price.volume);
      const closePrice = Number(price.close) || Number(price.high) || Number(price.low);
      
      if (!closePrice || closePrice <= 0) {
        continue;
      }
      
      // Usar preço de fechamento como proxy se não tiver high/low
      const avgPrice = (Number(price.high) && Number(price.low)) 
        ? (Number(price.high) + Number(price.low)) / 2 
        : closePrice;
      
      const volumeBRL = volume * avgPrice;
      
      if (volumeBRL > 0 && !isNaN(volumeBRL) && isFinite(volumeBRL)) {
        totalVolumeBRL += volumeBRL;
        validDays++;
      }
    }

    if (validDays === 0) {
      console.log(`    ⚠️ ${ticker}: No valid volume data found`);
      return null;
    }

    const averageDailyVolume = totalVolumeBRL / validDays;

    if (averageDailyVolume <= 0 || !isFinite(averageDailyVolume)) {
      return null;
    }

    return {
      ticker,
      averageDailyVolume,
      days: validDays
    };
  } catch (error) {
    console.error(`❌ [INDEX INTEGRATION] Error calculating average volume for ${ticker}:`, error);
    return null;
  }
}

/**
 * Busca dados financeiros completos de uma empresa
 */
export async function getCompanyFinancials(ticker: string): Promise<any | null> {
  try {
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 7 // Últimos 7 anos para análise histórica
        }
      }
    });

    return company;
  } catch (error) {
    console.error(`❌ [INDEX INTEGRATION] Error fetching financials for ${ticker}:`, error);
    return null;
  }
}

/**
 * Calcula upside para múltiplos tickers em paralelo
 */
export async function calculateUpsideBatch(tickers: string[]): Promise<Map<string, CompanyUpsideData>> {
  const results = new Map<string, CompanyUpsideData>();
  
  const promises = tickers.map(async (ticker) => {
    const data = await calculateUpside(ticker);
    if (data) {
      results.set(ticker, data);
    }
  });

  await Promise.all(promises);
  
  return results;
}

/**
 * Calcula volume médio para múltiplos tickers em paralelo
 */
export async function getAverageDailyVolumeBatch(
  tickers: string[],
  days: number = 30
): Promise<Map<string, AverageVolumeData>> {
  const results = new Map<string, AverageVolumeData>();
  
  const promises = tickers.map(async (ticker) => {
    const data = await getAverageDailyVolume(ticker, days);
    if (data) {
      results.set(ticker, data);
    }
  });

  await Promise.all(promises);
  
  return results;
}

