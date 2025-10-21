/**
 * PORTFOLIO ASSET UPDATE SERVICE
 * 
 * Serviço inteligente para atualização completa de dados de ativos de carteiras
 * - Busca tickers distintos de todas as carteiras
 * - Atualiza histórico de preços (incremental)
 * - Atualiza histórico de dividendos (incremental)
 * - Atualiza dados gerais do ativo
 * 
 * Designed for CRON jobs - executa periodicamente para manter dados atualizados
 */

import { prisma } from '@/lib/prisma';
import { HistoricalDataService } from './historical-data-service';
import { DividendService } from './dividend-service';
import { AssetRegistrationService } from './asset-registration-service';

export interface UpdateSummary {
  totalTickers: number;
  processedTickers: number;
  failedTickers: string[];
  updatedHistoricalPrices: number;
  updatedDividends: number;
  updatedAssets: number;
  duration: number;
  errors: Array<{ ticker: string; error: string }>;
}

/**
 * Portfolio Asset Update Service
 */
export class PortfolioAssetUpdateService {
  
  /**
   * Atualiza todos os ativos de todas as carteiras
   * - Busca dados históricos completos
   * - Atualiza dividendos
   * - Atualiza informações do ativo
   */
  static async updateAllPortfolioAssets(): Promise<UpdateSummary> {
    const startTime = Date.now();
    const summary: UpdateSummary = {
      totalTickers: 0,
      processedTickers: 0,
      failedTickers: [],
      updatedHistoricalPrices: 0,
      updatedDividends: 0,
      updatedAssets: 0,
      duration: 0,
      errors: []
    };

    try {
      console.log('🚀 [PORTFOLIO ASSETS UPDATE] Iniciando atualização de ativos...');

      // 1. Buscar tickers distintos de todas as carteiras ativas
      const tickers = await this.getDistinctPortfolioTickers();
      summary.totalTickers = tickers.length;

      console.log(`📊 [UPDATE] Encontrados ${tickers.length} ativos distintos em carteiras`);

      if (tickers.length === 0) {
        console.log('ℹ️ [UPDATE] Nenhum ativo para atualizar');
        summary.duration = Date.now() - startTime;
        return summary;
      }

      // 2. Processar cada ticker sequencialmente
      for (let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        console.log(`\n[${i + 1}/${tickers.length}] 🔄 Processando ${ticker}...`);

        try {
          const tickerSummary = await this.updateSingleAsset(ticker);
          
          summary.processedTickers++;
          summary.updatedHistoricalPrices += tickerSummary.historicalPricesUpdated;
          summary.updatedDividends += tickerSummary.dividendsUpdated;
          summary.updatedAssets += tickerSummary.assetUpdated ? 1 : 0;

          console.log(`✅ [${ticker}] Atualizado: ${tickerSummary.historicalPricesUpdated} preços, ${tickerSummary.dividendsUpdated} dividendos`);

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ [${ticker}] Erro ao atualizar:`, errorMsg);
          
          summary.failedTickers.push(ticker);
          summary.errors.push({ ticker, error: errorMsg });
        }

        // Aguardar 1 segundo entre tickers para não sobrecarregar APIs externas
        if (i < tickers.length - 1) {
          await this.delay(1000);
        }
      }

      summary.duration = Date.now() - startTime;

      console.log('\n✅ [PORTFOLIO ASSETS UPDATE] Atualização concluída!');
      console.log(`📊 Resumo:`);
      console.log(`   - Total de ativos: ${summary.totalTickers}`);
      console.log(`   - Processados: ${summary.processedTickers}`);
      console.log(`   - Falharam: ${summary.failedTickers.length}`);
      console.log(`   - Preços atualizados: ${summary.updatedHistoricalPrices}`);
      console.log(`   - Dividendos atualizados: ${summary.updatedDividends}`);
      console.log(`   - Tempo total: ${(summary.duration / 1000).toFixed(2)}s`);

      return summary;

    } catch (error) {
      console.error('❌ [PORTFOLIO ASSETS UPDATE] Erro crítico:', error);
      summary.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Atualiza um único ativo de forma inteligente (incremental)
   */
  private static async updateSingleAsset(ticker: string): Promise<{
    historicalPricesUpdated: number;
    dividendsUpdated: number;
    assetUpdated: boolean;
  }> {
    const result = {
      historicalPricesUpdated: 0,
      dividendsUpdated: 0,
      assetUpdated: false
    };

    // 1. Garantir que o ativo está registrado
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() }
    });

    if (!company) {
      console.log(`📝 [${ticker}] Cadastrando novo ativo...`);
      await AssetRegistrationService.registerAsset(ticker);
      result.assetUpdated = true;
    }

    const companyRecord = company || await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() }
    });

    if (!companyRecord) {
      throw new Error(`Failed to register asset ${ticker}`);
    }

    // 2. Atualizar dados históricos de preços (incremental)
    console.log(`📊 [${ticker}] Atualizando preços históricos...`);
    try {
      await HistoricalDataService.updateHistoricalDataIncremental(ticker, '1mo');
      result.historicalPricesUpdated = 1; // Incremental update completed
    } catch (error) {
      console.error(`⚠️ [${ticker}] Erro ao atualizar preços:`, error);
      result.historicalPricesUpdated = 0;
    }

    // 3. Atualizar histórico de dividendos (incremental)
    const dividendsResult = await DividendService.fetchAndSaveDividends(ticker);
    result.dividendsUpdated = dividendsResult.dividendsCount;

    // 4. Atualizar dados gerais do ativo (sempre atualiza para ter dados frescos)
    if (company) {
      try {
        await AssetRegistrationService.registerAsset(ticker); // Reprocessa para atualizar dados
        result.assetUpdated = true;
      } catch (error) {
        console.warn(`⚠️ [${ticker}] Não foi possível atualizar dados gerais:`, error);
      }
    }

    return result;
  }

  /**
   * Atualiza histórico de preços de forma incremental
   * Busca apenas dados que ainda não existem no banco
   */
  private static async updateHistoricalPricesIncremental(
    companyId: number,
    ticker: string
  ): Promise<number> {
    try {
      // Buscar a data mais recente que temos no banco
      const latestPrice = await prisma.historicalPrice.findFirst({
        where: {
          companyId: companyId,
          interval: '1mo'
        },
        orderBy: {
          date: 'desc'
        },
        select: {
          date: true
        }
      });

      const today = new Date();
      let startDate: Date;

      if (latestPrice) {
        // Se já temos dados, buscar apenas desde a última data + 1 mês
        startDate = new Date(latestPrice.date);
        startDate.setMonth(startDate.getMonth() + 1);
        
        console.log(`📅 [${ticker}] Última data no banco: ${latestPrice.date.toISOString().split('T')[0]}`);
      } else {
        // Se não temos nenhum dado, buscar os últimos 10 anos
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 10);
        
        console.log(`📅 [${ticker}] Sem dados no banco, buscando últimos 10 anos`);
      }

      // Se a data de início for no futuro ou igual a hoje, não há nada para buscar
      if (startDate >= today) {
        console.log(`✅ [${ticker}] Dados históricos já estão atualizados`);
        return 0;
      }

      // Buscar dados do Yahoo Finance
      const historicalData = await HistoricalDataService.fetchHistoricalFromYahoo(
        ticker,
        startDate,
        today,
        '1mo'
      );

      if (historicalData.length === 0) {
        console.log(`ℹ️ [${ticker}] Nenhum dado novo disponível`);
        return 0;
      }

      // Salvar no banco
      await HistoricalDataService.saveHistoricalData(
        companyId,
        historicalData,
        '1mo'
      );

      return historicalData.length;

    } catch (error) {
      console.error(`❌ [${ticker}] Erro ao atualizar preços históricos:`, error);
      return 0;
    }
  }

  /**
   * Busca todos os tickers distintos de todas as carteiras ativas
   * Prioriza ativos mais antigos (não atualizados ou atualizados há mais tempo)
   */
  private static async getDistinctPortfolioTickers(): Promise<string[]> {
    // Buscar ativos de todas as carteiras ativas
    const assets = await prisma.portfolioConfigAsset.findMany({
      where: {
        isActive: true,
        portfolio: {
          isActive: true
        }
      },
      select: {
        ticker: true
      },
      distinct: ['ticker']
    });

    const tickers = assets.map(a => a.ticker);
    
    console.log(`📊 [PORTFOLIO UPDATE] ${tickers.length} tickers distintos encontrados`);
    
    // Get companies with their last update dates to prioritize
    const companies = await prisma.company.findMany({
      where: {
        ticker: {
          in: tickers
        }
      },
      select: {
        ticker: true,
        yahooLastUpdatedAt: true
      }
    });
    
    // Create a map of ticker -> lastUpdated
    const lastUpdatedMap = new Map(
      companies.map(c => [c.ticker, c.yahooLastUpdatedAt?.getTime() || 0])
    );
    
    // Sort tickers: null first (never updated), then oldest first
    const sortedTickers = tickers.sort((a, b) => {
      const aTime = lastUpdatedMap.get(a) || 0;
      const bTime = lastUpdatedMap.get(b) || 0;
      return aTime - bTime; // Ascending: null/0 first, then oldest
    });
    
    // Log priority info
    const neverUpdated = sortedTickers.filter(t => !lastUpdatedMap.get(t)).length;
    console.log(`🔄 [PORTFOLIO UPDATE] Priorização: ${neverUpdated} nunca atualizados, ${sortedTickers.length - neverUpdated} a atualizar`);
    
    return sortedTickers;
  }

  /**
   * Helper para aguardar um tempo (evita rate limiting)
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Atualiza apenas preços históricos (sem dividendos)
   * Útil para execuções mais rápidas
   */
  static async updateHistoricalPricesOnly(): Promise<UpdateSummary> {
    const startTime = Date.now();
    const summary: UpdateSummary = {
      totalTickers: 0,
      processedTickers: 0,
      failedTickers: [],
      updatedHistoricalPrices: 0,
      updatedDividends: 0,
      updatedAssets: 0,
      duration: 0,
      errors: []
    };

    try {
      console.log('🚀 [HISTORICAL PRICES UPDATE] Iniciando atualização de preços...');

      const tickers = await this.getDistinctPortfolioTickers();
      summary.totalTickers = tickers.length;

      for (const ticker of tickers) {
        try {
          const company = await prisma.company.findUnique({
            where: { ticker: ticker.toUpperCase() }
          });

          if (!company) continue;

          const pricesUpdated = await this.updateHistoricalPricesIncremental(
            company.id,
            ticker
          );
          
          summary.updatedHistoricalPrices += pricesUpdated;
          summary.processedTickers++;

        } catch (error) {
          summary.failedTickers.push(ticker);
          summary.errors.push({ 
            ticker, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }

        await this.delay(500); // Menor delay para apenas preços
      }

      summary.duration = Date.now() - startTime;
      console.log(`✅ [HISTORICAL PRICES UPDATE] Concluído: ${summary.updatedHistoricalPrices} preços atualizados`);

      return summary;

    } catch (error) {
      console.error('❌ [HISTORICAL PRICES UPDATE] Erro crítico:', error);
      summary.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Atualiza apenas dividendos (sem preços históricos)
   * Útil para execuções específicas
   */
  static async updateDividendsOnly(): Promise<UpdateSummary> {
    const startTime = Date.now();
    const summary: UpdateSummary = {
      totalTickers: 0,
      processedTickers: 0,
      failedTickers: [],
      updatedHistoricalPrices: 0,
      updatedDividends: 0,
      updatedAssets: 0,
      duration: 0,
      errors: []
    };

    try {
      console.log('🚀 [DIVIDENDS UPDATE] Iniciando atualização de dividendos...');

      const tickers = await this.getDistinctPortfolioTickers();
      summary.totalTickers = tickers.length;

      for (const ticker of tickers) {
        try {
          const result = await DividendService.fetchAndSaveDividends(ticker);
          summary.updatedDividends += result.dividendsCount;
          summary.processedTickers++;

        } catch (error) {
          summary.failedTickers.push(ticker);
          summary.errors.push({ 
            ticker, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }

        await this.delay(500);
      }

      summary.duration = Date.now() - startTime;
      console.log(`✅ [DIVIDENDS UPDATE] Concluído: ${summary.updatedDividends} dividendos atualizados`);

      return summary;

    } catch (error) {
      console.error('❌ [DIVIDENDS UPDATE] Erro crítico:', error);
      summary.duration = Date.now() - startTime;
      throw error;
    }
  }
}

