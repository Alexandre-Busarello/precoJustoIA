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
   * Processa e salva dados históricos no banco
   */
  async processHistoricalData(
    ticker: string,
    data: BrapiHistoricalResponse['results'][0],
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
        // Criar empresa básica se não existir
        company = await backgroundPrisma.company.create({
          data: {
            ticker,
            name: data.longName || data.shortName || ticker
          }
        });
        console.log(`✅ Empresa criada: ${ticker} - ${company.name}`);
      }

      if (!data.historicalDataPrice || data.historicalDataPrice.length === 0) {
        console.log(`⚠️  Nenhum dado histórico para processar: ${ticker}`);
        return;
      }

      console.log(`🔄 Processando ${data.historicalDataPrice.length} registros históricos para ${ticker}...`);

      // Verificar dados existentes para evitar duplicatas
      const existingDates = await backgroundPrisma.historicalPrice.findMany({
        where: {
          companyId: company.id,
          interval
        },
        select: {
          date: true
        }
      }).catch(error => {
        console.error(`❌ Erro ao buscar dados existentes para ${ticker}:`, error.message);
        return [];
      });

      const existingDateSet = new Set(
        existingDates.map(d => d.date.toISOString().split('T')[0])
      );

      // Preparar dados para inserção
      const historicalRecords = data.historicalDataPrice
        .map(record => {
          const date = new Date(record.date * 1000); // Converter timestamp Unix para Date
          const dateStr = date.toISOString().split('T')[0];

          // Pular se já existe
          if (existingDateSet.has(dateStr)) {
            return null;
          }

          // Validar se todos os campos obrigatórios estão presentes
          if (!record.open || !record.high || !record.low || !record.close) {
            console.log(`⚠️  Dados incompletos para ${ticker} em ${dateStr}, pulando...`);
            return null;
          }

          // Função para validar e ajustar precisão decimal (máximo 6 dígitos antes da vírgula, 4 após)
          const validateDecimal = (value: number, fieldName: string): number => {
            if (!value || isNaN(value) || !isFinite(value)) {
              console.log(`⚠️  Valor inválido para ${fieldName} em ${ticker} (${dateStr}): ${value}`);
              return 0;
            }
            
            // Verificar se excede a precisão Decimal(10,4) - máximo 999999.9999
            if (Math.abs(value) >= 1000000) {
              console.log(`⚠️  Valor muito grande para ${fieldName} em ${ticker} (${dateStr}): ${value}, limitando...`);
              return Math.sign(value) * 999999.9999;
            }
            
            // Arredondar para 4 casas decimais
            return Math.round(value * 10000) / 10000;
          };

          const adjustedClose = record.adjustedClose || record.close;

          return {
            companyId: company.id,
            date,
            open: validateDecimal(record.open, 'open'),
            high: validateDecimal(record.high, 'high'),
            low: validateDecimal(record.low, 'low'),
            close: validateDecimal(record.close, 'close'),
            volume: record.volume ? BigInt(record.volume) : BigInt(0),
            adjustedClose: validateDecimal(adjustedClose, 'adjustedClose'),
            interval
          };
        })
        .filter(record => record !== null);

      if (historicalRecords.length === 0) {
        console.log(`⏭️  Todos os dados históricos já existem para ${ticker}`);
        return;
      }

      // Inserir em lotes para melhor performance
      const batchSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < historicalRecords.length; i += batchSize) {
        const batch = historicalRecords.slice(i, i + batchSize);
        
        try {
          await backgroundPrisma.historicalPrice.createMany({
            data: batch,
            skipDuplicates: true
          });

          insertedCount += batch.length;
          console.log(`  📊 Inseridos ${insertedCount}/${historicalRecords.length} registros`);
        } catch (batchError: any) {
          console.error(`❌ Erro ao inserir lote para ${ticker}:`, batchError.message);
          
          // Tentar inserir um por vez para identificar o registro problemático
          for (const record of batch) {
            try {
              await backgroundPrisma.historicalPrice.create({
                data: record
              });
              insertedCount++;
            } catch (recordError: any) {
              console.error(`❌ Erro no registro ${record.date.toISOString().split('T')[0]} para ${ticker}:`, recordError.message);
              
              // Verificar se é erro de overflow numérico
              if (recordError.message.includes('numeric field overflow')) {
                console.error(`   🔢 OVERFLOW DETECTADO - Valores que excedem Decimal(10,4):`);
                console.error(`      Open: ${record.open} (máx: 999999.9999)`);
                console.error(`      High: ${record.high} (máx: 999999.9999)`);
                console.error(`      Low: ${record.low} (máx: 999999.9999)`);
                console.error(`      Close: ${record.close} (máx: 999999.9999)`);
                console.error(`      AdjustedClose: ${record.adjustedClose} (máx: 999999.9999)`);
                console.error(`      Volume: ${record.volume}`);
              }
              
              console.error(`   Dados completos:`, JSON.stringify(record, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
              ));
            }
          }
        }
      }

      console.log(`✅ ${insertedCount} novos registros históricos salvos para ${ticker}`);

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

      // Buscar dados históricos
      const historicalData = await this.fetchHistoricalData(ticker, range, interval);

      if (historicalData) {
        // Processar e salvar no banco
        await this.processHistoricalData(ticker, historicalData, interval);

        // Marcar como completo
        await this.tickerManager.updateProgress(ticker, {
          hasHistoricalData: true,
          status: 'COMPLETED'
        });

        console.log(`✅ ${ticker} processado com sucesso`);
      } else {
        await this.tickerManager.updateProgress(ticker, {
          status: 'ERROR',
          error: 'Dados históricos não encontrados'
        });
      }

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

    console.log('🚀 Iniciando busca de dados históricos da BRAPI...');
    console.log(`📊 Configurações: range=${range}, interval=${interval}`);

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
