/**
 * HISTORICAL DATA SERVICE
 * 
 * Extrai dados históricos sob demanda usando yahoo-finance2
 * Funciona para todos os tipos de ativos (Ações, ETFs, FIIs, BDRs)
 * 
 * Features:
 * - Garante que dados históricos existem antes de cálculos de métricas
 * - Extrai dados do Yahoo Finance quando não disponíveis no banco
 * - Salva automaticamente no banco para consultas futuras
 * - Suporta múltiplos intervalos (1mo, 1wk, 1d)
 */

import { prisma } from '@/lib/prisma';
import { safeWrite } from '@/lib/prisma-wrapper';

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

// Types
export interface HistoricalPriceData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose: number;
}

export interface AssetInfo {
  ticker: string;
  name: string;
  assetType: 'STOCK' | 'ETF' | 'FII' | 'BDR' | 'INDEX' | 'OTHER';
  currency?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  description?: string;
  marketCap?: number;
  quote?: any;
  quoteSummary?: any;
}

/**
 * Historical Data Service
 */
export class HistoricalDataService {
  
  /**
   * Busca a última data de dados históricos salvos para um ativo
   */
  static async getLastHistoricalDate(
    companyId: number,
    interval: string = '1mo'
  ): Promise<Date | null> {
    try {
      const lastRecord = await prisma.historicalPrice.findFirst({
        where: {
          companyId,
          interval
        },
        orderBy: {
          date: 'desc'
        },
        select: {
          date: true
        }
      });
      
      return lastRecord?.date || null;
    } catch (error: any) {
      console.error(`❌ [HISTORICAL] Erro ao buscar última data:`, error.message);
      return null;
    }
  }
  
  /**
   * Atualiza dados históricos incrementalmente (apenas novos dados)
   */
  static async updateHistoricalDataIncremental(
    ticker: string,
    interval: '1mo' | '1wk' | '1d' = '1mo'
  ): Promise<void> {
    try {
      console.log(`🔄 [HISTORICAL] Atualizando dados incrementais de ${ticker}...`);
      
      // Get company ID
      const company = await prisma.company.findUnique({
        where: { ticker: ticker.toUpperCase().replace('.SA', '') },
        select: { id: true }
      });
      
      if (!company) {
        console.log(`⚠️ [HISTORICAL] ${ticker}: Empresa não encontrada`);
        return;
      }
      
      // Get last historical date
      const lastDate = await this.getLastHistoricalDate(company.id, interval);
      
      if (!lastDate) {
        // No historical data exists, fetch all
        console.log(`📊 [HISTORICAL] ${ticker}: Sem dados históricos, buscando completo...`);
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 5); // 5 years back
        await this.ensureHistoricalData(ticker, startDate, new Date(), interval);
        return;
      }
      
      // Fetch only from last date to today
      const today = new Date();
      const daysSinceLastUpdate = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastUpdate < 1) {
        console.log(`✅ [HISTORICAL] ${ticker}: Dados já atualizados (última atualização: ${lastDate.toISOString().split('T')[0]})`);
        return;
      }
      
      console.log(`📊 [HISTORICAL] ${ticker}: Atualizando desde ${lastDate.toISOString().split('T')[0]} (${daysSinceLastUpdate} dias)`);
      
      // Start from day after last record
      const startDate = new Date(lastDate);
      startDate.setDate(startDate.getDate() + 1);
      
      await this.ensureHistoricalData(ticker, startDate, today, interval);
      
      console.log(`✅ [HISTORICAL] ${ticker}: Dados incrementais atualizados`);
      
    } catch (error: any) {
      console.error(`❌ [HISTORICAL] Erro ao atualizar incrementalmente ${ticker}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Busca e salva o máximo de dados históricos disponíveis para um ativo
   * Útil quando queremos garantir que temos todo o histórico disponível
   */
  static async fetchMaximumHistoricalData(
    ticker: string,
    interval: '1mo' | '1wk' | '1d' = '1mo'
  ): Promise<void> {
    const endDate = new Date(); // Até hoje
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 20); // 20 anos atrás
    
    console.log(`📊 [MAX HISTORICAL] Buscando MÁXIMO de dados disponíveis para ${ticker}...`);
    
    await this.ensureHistoricalData(ticker, startDate, endDate, interval, true);
  }
  
  /**
   * Garante que dados históricos existem para um ativo
   * Se não existirem, extrai do Yahoo Finance e salva no banco
   * 
   * @param fetchMaximumAvailable - Se true, busca o máximo de dados disponíveis (padrão: false)
   */
  static async ensureHistoricalData(
    ticker: string,
    startDate: Date,
    endDate: Date,
    interval: '1mo' | '1wk' | '1d' = '1mo',
    fetchMaximumAvailable: boolean = false
  ): Promise<void> {
    console.log(`🔍 [HISTORICAL] Verificando dados históricos para ${ticker}...`);
    
    // Check if company exists
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      select: { id: true, ticker: true }
    });

    if (!company) {
      console.log(`⚠️ [HISTORICAL] ${ticker}: Empresa não cadastrada, cadastrando...`);
      // If company doesn't exist, we need to register it first
      // This will be handled by AssetRegistrationService
      return;
    }

    // Se fetchMaximumAvailable, ajustar startDate para buscar o máximo disponível
    // Yahoo Finance geralmente tem dados de até 10-20 anos atrás
    if (fetchMaximumAvailable) {
      const maxStartDate = new Date();
      maxStartDate.setFullYear(maxStartDate.getFullYear() - 20); // Buscar últimos 20 anos
      if (startDate > maxStartDate) {
        console.log(`📅 [HISTORICAL] Ajustando startDate de ${startDate.toISOString().split('T')[0]} para ${maxStartDate.toISOString().split('T')[0]} (máximo disponível)`);
        startDate = maxStartDate;
      }
    }

    // Check if we have historical data in the database
    const existingData = await prisma.historicalPrice.count({
      where: {
        companyId: company.id,
        interval: interval,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Calculate expected number of data points
    const monthsDiff = this.getMonthsDifference(startDate, endDate);
    const expectedPoints = interval === '1mo' ? monthsDiff : 
                          interval === '1wk' ? monthsDiff * 4 : 
                          monthsDiff * 30;
    const threshold = Math.floor(expectedPoints * 0.8);

    // If we have at least 80% of expected data, consider it sufficient
    const hasEnoughData = existingData >= threshold;

    console.log(`📊 [HISTORICAL] ${ticker}: ${existingData} pontos existentes de ${expectedPoints} esperados (threshold: ${threshold}, período: ${startDate.toISOString().split('T')[0]} a ${endDate.toISOString().split('T')[0]})`);

    if (hasEnoughData) {
      console.log(`✅ [HISTORICAL] ${ticker}: Dados suficientes já disponíveis`);
      return;
    }

    console.log(`📥 [HISTORICAL] ${ticker}: Buscando dados do Yahoo Finance...`);
    
    // Fetch from Yahoo Finance
    const historicalData = await this.fetchHistoricalFromYahoo(
      ticker,
      startDate,
      endDate,
      interval
    );

    if (historicalData.length === 0) {
      console.log(`⚠️ [HISTORICAL] ${ticker}: Nenhum dado encontrado no Yahoo Finance`);
      return;
    }

    // Save to database
    await this.saveHistoricalData(company.id, historicalData, interval);
    
    console.log(`✅ [HISTORICAL] ${ticker}: ${historicalData.length} pontos salvos no banco`);
  }

  /**
   * Extrai dados históricos do Yahoo Finance usando chart()
   */
  static async fetchHistoricalFromYahoo(
    ticker: string,
    startDate: Date,
    endDate: Date,
    interval: '1mo' | '1wk' | '1d'
  ): Promise<HistoricalPriceData[]> {
    try {
      const yahooFinance = await getYahooFinance();
      const yahooSymbol = `${ticker}.SA`;

      // Use chart() instead of deprecated historical()
      const result = await yahooFinance.chart(yahooSymbol, {
        period1: startDate,
        period2: endDate,
        interval: interval,
        return: 'array'
      });

      if (!result || !result.quotes || result.quotes.length === 0) {
        console.log(`⚠️ [YAHOO] ${ticker}: Sem dados no período solicitado`);
        return [];
      }

      // Convert to our format
      return result.quotes
        .filter((q: any) => q.close !== null && q.close > 0)
        .map((q: any) => ({
          date: q.date,
          open: q.open || q.close,
          high: q.high || q.close,
          low: q.low || q.close,
          close: q.close,
          volume: q.volume || 0,
          adjustedClose: q.adjclose || q.close
        }));

    } catch (error) {
      console.error(`❌ [YAHOO] Erro ao buscar dados para ${ticker}:`, error);
      return [];
    }
  }

  /**
   * Salva dados históricos no banco em lotes para evitar esgotar o pool de conexões
   * Otimizado: verifica quais datas já existem antes de fazer upserts
   */
  static async saveHistoricalData(
    companyId: number,
    data: HistoricalPriceData[],
    interval: string = '1mo'
  ): Promise<void> {
    if (data.length === 0) return;

    try {
      // Primeiro, verificar quais datas já existem
      const existingDates = await prisma.historicalPrice.findMany({
        where: {
          companyId: companyId,
          interval: interval,
          date: {
            in: data.map(d => d.date)
          }
        },
        select: {
          date: true
        }
      });

      const existingDateSet = new Set(existingDates.map(d => d.date.getTime()));
      
      // Filtrar apenas dados que não existem
      const newData = data.filter(point => !existingDateSet.has(point.date.getTime()));

      if (newData.length === 0) {
        console.log(`ℹ️ [DB] Todos os ${data.length} pontos já existem, nada a salvar`);
        return;
      }

      console.log(`💾 [DB] Salvando ${newData.length} novos pontos (${data.length - newData.length} já existiam)`);

      // Processar em lotes de 50 para não esgotar o pool de conexões
      const BATCH_SIZE = 50;
      let processedCount = 0;

      for (let i = 0; i < newData.length; i += BATCH_SIZE) {
        const batch = newData.slice(i, i + BATCH_SIZE);
        
        // Processar batch em paralelo (createMany é mais eficiente que múltiplos upserts)
        await prisma.historicalPrice.createMany({
          data: batch.map(point => ({
            companyId: companyId,
            date: point.date,
            interval: interval,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: BigInt(point.volume),
            adjustedClose: point.adjustedClose
          })),
          skipDuplicates: true
        });
        
        processedCount += batch.length;
        if (newData.length > BATCH_SIZE) {
          console.log(`📊 [DB] Processados ${processedCount}/${newData.length} pontos históricos`);
        }
      }

      console.log(`✅ [DB] Salvos ${newData.length} pontos históricos no banco`);
    } catch (error) {
      console.error(`❌ [SAVE] Erro ao salvar dados históricos:`, error);
      throw error;
    }
  }

  /**
   * Extrai informações completas de um ativo (quote + quoteSummary)
   */
  static async fetchAssetInfo(ticker: string): Promise<AssetInfo | null> {
    try {
      const yahooFinance = await getYahooFinance();
      const yahooSymbol = `${ticker}.SA`;

      // Get quote (basic info)
      const quote = await yahooFinance.quote(yahooSymbol);
      
      if (!quote) {
        console.log(`⚠️ [ASSET INFO] ${ticker}: Não encontrado no Yahoo Finance`);
        return null;
      }

      // Get quoteSummary (detailed info)
      let quoteSummary: any = null;
      try {
        quoteSummary = await yahooFinance.quoteSummary(yahooSymbol, {
          modules: ['price', 'summaryDetail', 'assetProfile']
        });
      } catch (error) {
        console.log(`⚠️ [ASSET INFO] ${ticker}: QuoteSummary não disponível`);
      }

      // Determine asset type based on ticker pattern and data
      const assetType = this.determineAssetType(ticker, quote, quoteSummary);

      return {
        ticker: ticker.toUpperCase(),
        name: quote.longName || quote.shortName || ticker,
        assetType,
        currency: quote.currency,
        exchange: quote.exchange,
        sector: quoteSummary?.assetProfile?.sector,
        industry: quoteSummary?.assetProfile?.industry,
        description: quoteSummary?.assetProfile?.longBusinessSummary,
        marketCap: quote.marketCap,
        quote,
        quoteSummary
      };

    } catch (error) {
      console.error(`❌ [ASSET INFO] Erro ao buscar informações de ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Determina o tipo do ativo baseado no ticker e dados
   */
  private static determineAssetType(
    ticker: string,
    quote: any,
    quoteSummary: any
  ): 'STOCK' | 'ETF' | 'FII' | 'BDR' | 'INDEX' | 'OTHER' {
    
    // FIIs geralmente terminam com 11
    if (ticker.match(/11$/)) {
      // Check if it's actually an ETF (like BOVA11, IVVB11)
      const name = (quote.longName || quote.shortName || '').toLowerCase();
      if (name.includes('etf') || name.includes('exchange traded') || name.includes('ishares')) {
        return 'ETF';
      }
      // Check if it's a real estate fund
      if (name.includes('fundo') && name.includes('imobil')) {
        return 'FII';
      }
      const sector = quoteSummary?.assetProfile?.sector?.toLowerCase() || '';
      const industry = quoteSummary?.assetProfile?.industry?.toLowerCase() || '';
      if (sector.includes('real estate') || industry.includes('reit')) {
        return 'FII';
      }
      // Default to FII for *11 tickers
      return 'FII';
    }

    // BDRs geralmente terminam com 34
    if (ticker.match(/34$/)) {
      return 'BDR';
    }

    // ETFs podem ser identificados pelo nome ou quoteType
    const name = (quote.longName || quote.shortName || '').toLowerCase();
    if (name.includes('etf') || name.includes('exchange traded') || name.includes('ishares')) {
      return 'ETF';
    }

    // Check for index
    if (quote.quoteType === 'INDEX') {
      return 'INDEX';
    }

    // Default to STOCK
    return 'STOCK';
  }

  /**
   * Calcula diferença em meses entre duas datas
   */
  private static getMonthsDifference(startDate: Date, endDate: Date): number {
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                   (endDate.getMonth() - startDate.getMonth());
    return Math.max(1, months);
  }

  /**
   * Limpa dados históricos antigos (opcional, para manutenção)
   */
  static async cleanOldHistoricalData(olderThanDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.historicalPrice.deleteMany({
      where: {
        date: {
          lt: cutoffDate
        }
      }
    });

    return result.count;
  }
}

