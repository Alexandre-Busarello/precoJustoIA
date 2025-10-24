#!/usr/bin/env tsx

/**
 * Script exploratório para testar o módulo fundamentalsTimeSeries do yahoo-finance2
 * 
 * Este script testa diferentes módulos e períodos para verificar quais dados
 * fundamentalistas conseguimos extrair para ações brasileiras.
 * 
 * Uso: npx tsx scripts/explore-yahoo-fundamentals-timeseries.ts
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

// Lazy import do yahoo-finance2 para evitar problemas de importação
async function getYahooFinance() {
  const { default: yahooFinance } = await import('yahoo-finance2');
  return yahooFinance;
}

interface ExplorationResult {
  ticker: string;
  module: string;
  type: 'quarterly' | 'annual' | 'trailing';
  period: string;
  success: boolean;
  dataCount: number;
  sampleData?: any;
  error?: string;
  availableFields?: string[];
  timestamp: string;
}

class YahooFundamentalsExplorer {
  private results: ExplorationResult[] = [];
  
  // Tickers brasileiros para teste (diferentes setores)
  private testTickers = [
    'PETR4.SA',  // Petrobras - Petróleo
    'VALE3.SA',  // Vale - Mineração
    'ITUB4.SA',  // Itaú - Banco
    'BBDC4.SA',  // Bradesco - Banco
    'ABEV3.SA',  // Ambev - Bebidas
    'WEGE3.SA',  // WEG - Equipamentos
    'MGLU3.SA',  // Magazine Luiza - Varejo
    'B3SA3.SA',  // B3 - Serviços Financeiros
  ];

  // Módulos disponíveis no fundamentalsTimeSeries
  private modules = [
    'balance-sheet',
    'financials', // income statement
    'cash-flow',
    'all'
  ];

  // Tipos de período
  private periodTypes: ('quarterly' | 'annual' | 'trailing')[] = [
    'quarterly',
    'annual', 
    'trailing'
  ];

  /**
   * Explora um módulo específico para um ticker
   */
  async exploreModule(
    ticker: string,
    module: string,
    type: 'quarterly' | 'annual' | 'trailing',
    period1: string = '2020-01-01'
  ): Promise<ExplorationResult> {
    const yahooFinance = await getYahooFinance();
    
    const result: ExplorationResult = {
      ticker,
      module,
      type,
      period: period1,
      success: false,
      dataCount: 0,
      timestamp: new Date().toISOString()
    };

    try {
      console.log(`🔍 Testando ${ticker} - ${module} (${type})...`);
      
      const data = await yahooFinance.fundamentalsTimeSeries(ticker, {
        period1,
        type,
        module: module as any
      });

      if (data && Array.isArray(data) && data.length > 0) {
        result.success = true;
        result.dataCount = data.length;
        result.sampleData = data[0]; // Primeiro item como amostra
        result.availableFields = Object.keys(data[0]).filter(key => 
          data[0][key] !== null && data[0][key] !== undefined
        );
        
        console.log(`✅ ${ticker} - ${module} (${type}): ${data.length} registros`);
        console.log(`   Campos disponíveis: ${result.availableFields.length}`);
      } else {
        result.success = false;
        result.error = 'Nenhum dado retornado';
        console.log(`❌ ${ticker} - ${module} (${type}): Sem dados`);
      }
    } catch (error: any) {
      result.success = false;
      result.error = error.message;
      console.log(`❌ ${ticker} - ${module} (${type}): ${error.message}`);
    }

    return result;
  }

  /**
   * Explora todos os módulos para um ticker específico
   */
  async exploreTicker(ticker: string): Promise<void> {
    console.log(`\n🚀 Explorando ${ticker}...`);
    
    for (const module of this.modules) {
      for (const type of this.periodTypes) {
        const result = await this.exploreModule(ticker, module, type);
        this.results.push(result);
        
        // Delay para evitar rate limiting
        await this.delay(1000);
      }
    }
  }

  /**
   * Testa diferentes períodos para um ticker/módulo específico
   */
  async testDifferentPeriods(ticker: string, module: string): Promise<void> {
    const periods = [
      '2023-01-01', // 1 ano
      '2022-01-01', // 2 anos
      '2020-01-01', // 4 anos
      '2018-01-01', // 6 anos
    ];

    console.log(`\n📅 Testando diferentes períodos para ${ticker} - ${module}...`);
    
    for (const period of periods) {
      const result = await this.exploreModule(ticker, module, 'annual', period);
      result.period = `desde ${period}`;
      this.results.push(result);
      await this.delay(1000);
    }
  }

  /**
   * Analisa campos específicos que mapeiam para nosso schema
   */
  async analyzeSchemaMapping(): Promise<void> {
    console.log('\n🔍 Analisando mapeamento para schema Prisma...');
    
    // Campos que queremos encontrar no yahoo-finance2
    const targetFields = {
      // FinancialData
      'P/E': ['trailingPE', 'forwardPE', 'priceEarningsRatio'],
      'P/B': ['priceToBook', 'priceBookRatio'],
      'EV/EBITDA': ['enterpriseToEbitda', 'evToEbitda'],
      'EV/Revenue': ['enterpriseToRevenue', 'evToRevenue'],
      'ROE': ['returnOnEquity', 'roe'],
      'ROA': ['returnOnAssets', 'roa'],
      'Debt/Equity': ['debtToEquity', 'debtEquityRatio'],
      'Current Ratio': ['currentRatio'],
      'Market Cap': ['marketCap', 'marketCapitalization'],
      'Enterprise Value': ['enterpriseValue'],
      'Dividend Yield': ['dividendYield', 'trailingAnnualDividendYield'],
      
      // BalanceSheet
      'Total Assets': ['totalAssets'],
      'Current Assets': ['totalCurrentAssets', 'currentAssets'],
      'Cash': ['cash', 'cashAndCashEquivalents'],
      'Total Debt': ['totalDebt', 'longTermDebt'],
      'Stockholder Equity': ['totalStockholderEquity', 'stockholderEquity'],
      
      // IncomeStatement
      'Total Revenue': ['totalRevenue', 'revenue'],
      'Net Income': ['netIncome', 'netIncomeCommonStockholders'],
      'Operating Income': ['operatingIncome', 'ebit'],
      'Gross Profit': ['grossProfit'],
      
      // CashflowStatement
      'Operating Cash Flow': ['operatingCashFlow', 'cashFromOperations'],
      'Free Cash Flow': ['freeCashFlow'],
      'Investment Cash Flow': ['investingCashFlow', 'cashFromInvesting'],
      'Financing Cash Flow': ['financingCashFlow', 'cashFromFinancing'],
    };

    // Testa um ticker específico para análise detalhada
    const testTicker = 'PETR4.SA';
    
    for (const module of ['balance-sheet', 'financials', 'cash-flow']) {
      const result = await this.exploreModule(testTicker, module, 'annual');
      
      if (result.success && result.sampleData) {
        console.log(`\n📊 Campos encontrados em ${module}:`);
        
        Object.entries(targetFields).forEach(([fieldName, possibleKeys]) => {
          const foundKeys = possibleKeys.filter(key => 
            result.sampleData.hasOwnProperty(key) && 
            result.sampleData[key] !== null
          );
          
          if (foundKeys.length > 0) {
            console.log(`  ✅ ${fieldName}: ${foundKeys.join(', ')}`);
          } else {
            console.log(`  ❌ ${fieldName}: não encontrado`);
          }
        });
      }
    }
  }

  /**
   * Executa exploração completa
   */
  async run(): Promise<void> {
    console.log('🚀 Iniciando exploração do yahoo-finance2 fundamentalsTimeSeries...\n');
    
    try {
      // 1. Testa alguns tickers principais
      const mainTickers = ['PETR4.SA', 'VALE3.SA', 'ITUB4.SA'];
      
      for (const ticker of mainTickers) {
        await this.exploreTicker(ticker);
      }
      
      // 2. Testa diferentes períodos
      await this.testDifferentPeriods('PETR4.SA', 'financials');
      
      // 3. Analisa mapeamento para schema
      await this.analyzeSchemaMapping();
      
      // 4. Gera relatório
      this.generateReport();
      
      // 5. Salva resultados
      this.saveResults();
      
    } catch (error) {
      console.error('❌ Erro durante exploração:', error);
    }
  }

  /**
   * Gera relatório de exploração
   */
  generateReport(): void {
    console.log('\n📊 RELATÓRIO DE EXPLORAÇÃO');
    console.log('=' .repeat(50));
    
    const successfulResults = this.results.filter(r => r.success);
    const failedResults = this.results.filter(r => !r.success);
    
    console.log(`Total de testes: ${this.results.length}`);
    console.log(`Sucessos: ${successfulResults.length}`);
    console.log(`Falhas: ${failedResults.length}`);
    console.log(`Taxa de sucesso: ${((successfulResults.length / this.results.length) * 100).toFixed(1)}%`);
    
    // Análise por módulo
    console.log('\n📈 Sucesso por módulo:');
    this.modules.forEach(module => {
      const moduleResults = this.results.filter(r => r.module === module);
      const moduleSuccesses = moduleResults.filter(r => r.success);
      const rate = moduleResults.length > 0 ? (moduleSuccesses.length / moduleResults.length) * 100 : 0;
      console.log(`  ${module}: ${moduleSuccesses.length}/${moduleResults.length} (${rate.toFixed(1)}%)`);
    });
    
    // Análise por tipo
    console.log('\n📅 Sucesso por tipo:');
    this.periodTypes.forEach(type => {
      const typeResults = this.results.filter(r => r.type === type);
      const typeSuccesses = typeResults.filter(r => r.success);
      const rate = typeResults.length > 0 ? (typeSuccesses.length / typeResults.length) * 100 : 0;
      console.log(`  ${type}: ${typeSuccesses.length}/${typeResults.length} (${rate.toFixed(1)}%)`);
    });
    
    // Tickers mais bem-sucedidos
    console.log('\n🏆 Tickers com mais dados:');
    const tickerStats = new Map<string, { success: number; total: number }>();
    
    this.results.forEach(result => {
      if (!tickerStats.has(result.ticker)) {
        tickerStats.set(result.ticker, { success: 0, total: 0 });
      }
      const stats = tickerStats.get(result.ticker)!;
      stats.total++;
      if (result.success) stats.success++;
    });
    
    Array.from(tickerStats.entries())
      .sort((a, b) => b[1].success - a[1].success)
      .slice(0, 5)
      .forEach(([ticker, stats]) => {
        const rate = (stats.success / stats.total) * 100;
        console.log(`  ${ticker}: ${stats.success}/${stats.total} (${rate.toFixed(1)}%)`);
      });
    
    // Erros mais comuns
    console.log('\n❌ Erros mais comuns:');
    const errorCounts = new Map<string, number>();
    failedResults.forEach(result => {
      if (result.error) {
        const count = errorCounts.get(result.error) || 0;
        errorCounts.set(result.error, count + 1);
      }
    });
    
    Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([error, count]) => {
        console.log(`  ${error}: ${count} ocorrências`);
      });
  }

  /**
   * Salva resultados em arquivo JSON
   */
  saveResults(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `yahoo-fundamentals-exploration-${timestamp}.json`;
    const filepath = join(process.cwd(), '.exploration-results', filename);
    
    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      successfulTests: this.results.filter(r => r.success).length,
      failedTests: this.results.filter(r => !r.success).length,
      testedTickers: [...new Set(this.results.map(r => r.ticker))],
      testedModules: this.modules,
      testedPeriodTypes: this.periodTypes,
      results: this.results
    };
    
    try {
      writeFileSync(filepath, JSON.stringify(summary, null, 2));
      console.log(`\n💾 Resultados salvos em: ${filepath}`);
    } catch (error) {
      console.error('❌ Erro ao salvar resultados:', error);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Função principal
 */
async function main() {
  const explorer = new YahooFundamentalsExplorer();
  await explorer.run();
}

// Executa se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

export { YahooFundamentalsExplorer };