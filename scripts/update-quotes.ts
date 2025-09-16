#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const prisma = new PrismaClient();

// Interface para resposta básica da Brapi (apenas cotações)
interface BrapiQuoteResponse {
  results: Array<{
    symbol: string;
    shortName: string;
    regularMarketPrice: number;
    regularMarketDayHigh: number;
    regularMarketDayLow: number;
    regularMarketVolume: number;
    regularMarketPreviousClose: number;
    regularMarketTime: string;
  }>;
}

class QuoteUpdater {
  private readonly baseURL = 'https://brapi.dev/api';
  private readonly token?: string;
  private readonly batchSize: number;
  private readonly isPaidPlan: boolean;

  constructor(batchSize: number = 1) {
    this.token = process.env.BRAPI_TOKEN;
    this.batchSize = batchSize;
    this.isPaidPlan = batchSize > 1;
    
    console.log(`🔧 Configuração: ${this.isPaidPlan ? 'Plano Pago' : 'Plano Gratuito'} (${batchSize} ação${batchSize > 1 ? 'ões' : ''} por requisição)`);
  }

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'User-Agent': 'analisador-acoes-quotes/1.0.0'
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  async fetchQuotes(tickers: string[]): Promise<BrapiQuoteResponse> {
    const tickersList = tickers.join(',');
    
    try {
      console.log(`🔍 Buscando cotações para: ${tickersList}`);
      
      const response = await axios.get<BrapiQuoteResponse>(
        `${this.baseURL}/quote/${tickersList}`,
        {
          headers: this.getHeaders(),
          params: {
            range: '1d',
            interval: '1d',
            fundamental: 'false' // Apenas cotações, sem dados fundamentalistas
            // Não incluir 'modules' para evitar erro
          },
          timeout: 15000
        }
      );

      return response.data;
    } catch (error: any) {
      console.error(`❌ Erro ao buscar cotações para ${tickersList}:`, error.message);
      throw error;
    }
  }

  async updateCompanyQuote(ticker: string, price: number, previousClose: number): Promise<void> {
    try {
      // Buscar empresa no banco
      const company = await prisma.company.findUnique({
        where: { ticker },
        select: { id: true, name: true }
      });

      if (!company) {
        console.log(`⚠️  Empresa ${ticker} não encontrada no banco`);
        return;
      }

      // Data de hoje (sem horário)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Atualizar/criar cotação do dia
      await prisma.dailyQuote.upsert({
        where: {
          companyId_date: {
            companyId: company.id,
            date: today
          }
        },
        update: {
          price: price
        },
        create: {
          companyId: company.id,
          date: today,
          price: price
        }
      });

      // Calcular variação percentual
      const variation = previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0;
      const variationSymbol = variation > 0 ? '📈' : variation < 0 ? '📉' : '➡️';
      
      console.log(`💰 ${ticker}: R$ ${price.toFixed(2)} ${variationSymbol} ${variation >= 0 ? '+' : ''}${variation.toFixed(2)}%`);

    } catch (error: any) {
      console.error(`❌ Erro ao atualizar cotação de ${ticker}:`, error.message);
    }
  }

  async run() {
    console.log('🚀 Iniciando atualização de cotações...');

    try {
      // Buscar todas as empresas cadastradas no banco
      const companies = await prisma.company.findMany({
        select: { ticker: true },
        orderBy: { ticker: 'asc' }
      });

      if (companies.length === 0) {
        console.log('❌ Nenhuma empresa encontrada no banco de dados');
        return;
      }

      console.log(`📋 Total de empresas: ${companies.length}`);
      
      const tickers = companies.map(c => c.ticker);
      const totalBatches = Math.ceil(tickers.length / this.batchSize);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < tickers.length; i += this.batchSize) {
        const batch = tickers.slice(i, i + this.batchSize);
        const batchNumber = Math.floor(i / this.batchSize) + 1;
        
        console.log(`\n📦 Processando lote ${batchNumber} de ${totalBatches} (${batch.length} empresa${batch.length > 1 ? 's' : ''})`);
        
        try {
          const quotesData = await this.fetchQuotes(batch);
          
          if (quotesData.results && quotesData.results.length > 0) {
            for (const quote of quotesData.results) {
              try {
                await this.updateCompanyQuote(
                  quote.symbol,
                  quote.regularMarketPrice,
                  quote.regularMarketPreviousClose || 0
                );
                successCount++;
              } catch (error: any) {
                console.error(`❌ Erro ao processar ${quote.symbol}:`, error.message);
                errorCount++;
              }
            }
          }
          
          // Verificar se alguma empresa do lote não foi encontrada
          const foundTickers = quotesData.results?.map(r => r.symbol) || [];
          const notFound = batch.filter(ticker => !foundTickers.includes(ticker));
          
          if (notFound.length > 0) {
            console.log(`⚠️  Não encontradas: ${notFound.join(', ')}`);
            errorCount += notFound.length;
          }
          
        } catch (error: any) {
          console.error(`❌ Erro no lote ${batchNumber}:`, error.response?.data?.message || error.message);
          
          // Se for erro de limite do plano gratuito, parar execução
          if (error.response?.data?.message?.includes('plano permite até')) {
            console.error('💡 Dica: Use um batch size menor ou faça upgrade em brapi.dev/dashboard');
            process.exit(1);
          }
          
          errorCount += batch.length;
        }

        // Delay entre lotes - maior para plano gratuito
        const delayMs = this.isPaidPlan ? 500 : 2000;
        if (i + this.batchSize < tickers.length) { // Não fazer delay no último lote
          console.log(`⏳ Aguardando ${delayMs}ms antes do próximo lote...`);
          await this.delay(delayMs);
        }
      }

      console.log('\n✅ Atualização de cotações finalizada!');
      
      // Estatísticas finais
      console.log(`\n📊 Resumo:`);
      console.log(`   ✅ Sucessos: ${successCount}`);
      console.log(`   ❌ Erros: ${errorCount}`);
      console.log(`   📈 Taxa de sucesso: ${((successCount / (successCount + errorCount)) * 100).toFixed(1)}%`);
      
      // Estatísticas do banco
      const totalQuotes = await prisma.dailyQuote.count();
      const todayQuotes = await prisma.dailyQuote.count({
        where: {
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });
      
      console.log(`\n📈 Banco de dados:`);
      console.log(`   - Total de cotações: ${totalQuotes}`);
      console.log(`   - Cotações de hoje: ${todayQuotes}`);
      
    } catch (error: any) {
      console.error('❌ Erro fatal no processo:', error.message);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Executar o script
// Argumentos: node script.js [batchSize]
// Exemplo: tsx update-quotes.ts 1 (gratuito) ou tsx update-quotes.ts 10 (pago)

const args = process.argv.slice(2);
const batchSize = args[0] ? parseInt(args[0]) : 1; // Default: plano gratuito

if (isNaN(batchSize) || batchSize < 1) {
  console.error('❌ Tamanho do lote inválido. Use: npx tsx update-quotes.ts [batchSize]');
  console.error('   Exemplos:');
  console.error('   - npx tsx update-quotes.ts 1    (plano gratuito)');
  console.error('   - npx tsx update-quotes.ts 10   (plano pago)');
  process.exit(1);
}

const updater = new QuoteUpdater(batchSize);
updater.run();

export { QuoteUpdater };
