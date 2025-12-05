#!/usr/bin/env node

/**
 * Script para buscar dados históricos de cotação da BRAPI
 * Foca em dados mensais para gráficos candlestick
 * 
 * Uso:
 * npm run fetch:historical:brapi
 * npm run fetch:historical:brapi -- --tickers=PETR4,VALE3
 * npm run fetch:historical:brapi -- --range=max --interval=1mo
 */

import axios from 'axios';
import { backgroundPrisma } from './prisma-background.js';
import { TickerProcessingManager } from './ticker-processing-manager.js';

// Configurações da BRAPI
const BRAPI_TOKEN = process.env.BRAPI_TOKEN;
const BRAPI_BASE_URL = 'https://brapi.dev/api';

// Interfaces para tipagem
interface BrapiHistoricalDataPrice {
  date: number; // timestamp Unix
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose: number;
}

interface BrapiHistoricalResponse {
  results: Array<{
    symbol: string;
    shortName: string;
    longName: string;
    currency: string;
    regularMarketPrice: number;
    historicalDataPrice: BrapiHistoricalDataPrice[];
  }>;
  requestedAt: string;
  took: string;
}

interface ProcessingOptions {
  tickers?: string[];
  range?: string; // 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
  interval?: string; // 1d, 1wk, 1mo
  forceUpdate?: boolean;
}

class HistoricalPriceFetcher {
  private tickerManager: TickerProcessingManager;

  constructor() {
    this.tickerManager = new TickerProcessingManager('historical_price_fetch');
    
    // Verificar se o Prisma está disponível
    if (!backgroundPrisma) {
      throw new Error('backgroundPrisma não está disponível. Verifique a configuração do banco de dados.');
    }
  }

  /**
   * Busca dados históricos da BRAPI para um ticker
   */
  async fetchHistoricalData(
    ticker: string, 
    range: string = 'max', 
    interval: string = '1mo'
  ): Promise<BrapiHistoricalResponse['results'][0] | null> {
    try {
      console.log(`🔍 Buscando dados históricos para ${ticker} (${range}, ${interval})...`);

      if (!BRAPI_TOKEN) {
        console.log(`⚠️  BRAPI_TOKEN não configurado`);
        return null;
      }

      const headers = {
        'Authorization': `Bearer ${BRAPI_TOKEN}`,
        'User-Agent': 'analisador-acoes/1.0.0'
      };

      const response = await axios.get<BrapiHistoricalResponse>(
        `${BRAPI_BASE_URL}/quote/${ticker}`,
        {
          headers,
          params: {
            range,
            interval
          },
          timeout: 30000
        }
      );

      if (response.status === 200 && response.data.results && response.data.results.length > 0) {
        const data = response.data.results[0];
        console.log(`✅ ${data.historicalDataPrice?.length || 0} registros históricos obtidos para ${ticker}`);
        return data;
      } else {
        console.log(`⚠️  Nenhum dado histórico encontrado para ${ticker}`);
        return null;
      }

    } catch (error: any) {
      if (error.response?.status === 401) {
        console.error(`❌ Token inválido para ${ticker}`);
      } else if (error.response?.status === 402) {
        console.error(`❌ Limite de requisições atingido para ${ticker}`);
      } else if (error.response?.status === 404) {
        console.error(`❌ Ticker ${ticker} não encontrado`);
      } else {
        console.error(`❌ Erro ao buscar dados históricos para ${ticker}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Processa e salva dados históricos no banco usando Yahoo Finance como fonte primária
   * ATUALIZADO: Agora usa Yahoo Finance através da função centralizada que faz deduplicação por mês
   */
  async processHistoricalData(
    ticker: string,
    data: BrapiHistoricalResponse['results'][0] | null,
    interval: string = '1mo'
  ): Promise<void> {
    try {
      // Verificar se o Prisma está inicializado
      if (!backgroundPrisma) {
        throw new Error('backgroundPrisma não está inicializado');
      }

      // Buscar ou criar empresa
      let company = await backgroundPrisma.company.findUnique({
        where: { ticker }
      });

      if (!company) {
        // Se não temos dados da BRAPI, buscar nome do Yahoo Finance
        let companyName = ticker;
        try {
          const { HistoricalDataService } = await import('../src/lib/historical-data-service.js');
          const assetInfo = await HistoricalDataService.fetchAssetInfo(ticker);
          if (assetInfo) {
            companyName = assetInfo.name;
          }
        } catch (error) {
          console.warn(`⚠️  Não foi possível buscar nome da empresa para ${ticker}, usando ticker como nome`);
        }

        // Criar empresa básica se não existir
        company = await backgroundPrisma.company.create({
          data: {
            ticker,
            name: data?.longName || data?.shortName || companyName
          }
        });
        console.log(`✅ Empresa criada: ${ticker} - ${company.name}`);
      }

      console.log(`🔄 Processando preços históricos para ${ticker} usando Yahoo Finance...`);

      // Usar função centralizada do HistoricalDataService que usa Yahoo Finance como fonte primária
      // Importar dinamicamente para evitar problemas de módulo em scripts
      const { HistoricalDataService } = await import('../src/lib/historical-data-service.js');
      
      // Buscar dados desde 2000 até hoje (padrão da função centralizada)
      const result = await HistoricalDataService.fetchAndSaveHistoricalPricesFromYahoo(
        company.id,
        ticker,
        undefined, // startDate - usa padrão 2000-01-01
        undefined, // endDate - usa hoje
        interval as '1mo' | '1wk' | '1d'
      );

      console.log(`✅ ${ticker}: ${result.recordsSaved} registros salvos (${result.recordsProcessed} recebidos, ${result.recordsDeduplicated} após deduplicação)`);

    } catch (error: any) {
      console.error(`❌ Erro ao processar dados históricos para ${ticker}:`, error.message);
      throw error;
    }
  }

  /**
   * Busca lista de tickers para processar
   */
  async getTickersToProcess(specificTickers?: string[]): Promise<string[]> {
    if (specificTickers && specificTickers.length > 0) {
      return specificTickers;
    }

    // Buscar empresas existentes no banco
    const companies = await backgroundPrisma.company.findMany({
      select: { ticker: true },
      orderBy: { ticker: 'asc' }
    });

    return companies.map(c => c.ticker);
  }

  /**
   * Processa um ticker específico
   */
  async processTicker(
    ticker: string, 
    range: string = 'max', 
    interval: string = '1mo'
  ): Promise<void> {
    try {
      console.log(`\n🏢 Processando ${ticker}...`);

      await this.tickerManager.markProcessing(ticker);

      // Processar e salvar no banco usando Yahoo Finance diretamente
      // Não precisa mais buscar da BRAPI primeiro
      await this.processHistoricalData(ticker, null, interval);

      // Marcar como completo
      await this.tickerManager.updateProgress(ticker, {
        hasHistoricalData: true,
        status: 'COMPLETED'
      });

      console.log(`✅ ${ticker} processado com sucesso`);

    } catch (error: any) {
      console.error(`❌ Erro ao processar ${ticker}:`, error.message);
      await this.tickerManager.markError(ticker, error.message);
    }
  }

  /**
   * Executa o processamento principal
   */
  async run(options: ProcessingOptions = {}): Promise<void> {
    const {
      tickers: specificTickers,
      range = 'max',
      interval = '1mo',
      forceUpdate = false
    } = options;

    console.log('🚀 Iniciando busca de dados históricos do Yahoo Finance...');
    console.log(`📊 Configurações: interval=${interval} (Yahoo Finance busca desde 2000 automaticamente)`);

    try {
      // Obter lista de tickers
      const tickers = await this.getTickersToProcess(specificTickers);
      console.log(`📋 ${tickers.length} tickers para processar`);

      if (tickers.length === 0) {
        console.log('⚠️  Nenhum ticker encontrado para processar');
        return;
      }

      // Inicializar tickers no gerenciador
      await this.tickerManager.initializeTickers(tickers);

      // Processar tickers em lotes
      const batchSize = 3; // Limite para não sobrecarregar a API
      let processedCount = 0;

      for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize);
        
        console.log(`\n📦 Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(tickers.length / batchSize)}: ${batch.join(', ')}`);

        // Processar lote em paralelo
        const batchPromises = batch.map(ticker => 
          this.processTicker(ticker, range, interval)
        );

        await Promise.allSettled(batchPromises);
        processedCount += batch.length;

        console.log(`📊 Progresso: ${processedCount}/${tickers.length} tickers processados`);

        // Delay entre lotes para respeitar rate limits
        if (i + batchSize < tickers.length) {
          console.log('⏳ Aguardando 2 segundos...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Resumo final
      const summary = await this.tickerManager.getProcessingSummary();
      console.log('\n📊 Resumo do processamento:');
      console.log(this.tickerManager.getFormattedSummary(summary));

      console.log('\n🎉 Processamento de dados históricos concluído!');

    } catch (error: any) {
      console.error('❌ Erro no processamento:', error.message);
      throw error;
    }
  }
}

// Função principal
async function main() {
  try {
    // Parse dos argumentos da linha de comando
    const args = process.argv.slice(2);
    const options: ProcessingOptions = {};

    args.forEach(arg => {
      if (arg.startsWith('--tickers=')) {
        options.tickers = arg.split('=')[1].split(',').map(t => t.trim().toUpperCase());
      } else if (arg.startsWith('--range=')) {
        options.range = arg.split('=')[1];
      } else if (arg.startsWith('--interval=')) {
        options.interval = arg.split('=')[1];
      } else if (arg === '--force') {
        options.forceUpdate = true;
      }
    });

    const fetcher = new HistoricalPriceFetcher();
    await fetcher.run(options);

  } catch (error: any) {
    console.error('❌ Erro fatal:', error.message);
    process.exit(1);
  } finally {
    await backgroundPrisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

export { HistoricalPriceFetcher };
