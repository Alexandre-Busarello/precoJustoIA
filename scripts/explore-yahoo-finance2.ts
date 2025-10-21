/**
 * Script Exploratório: Yahoo Finance 2
 * 
 * Explora TODOS os módulos e dados disponíveis no yahoo-finance2
 * para diferentes tipos de ativos brasileiros
 */

import { inspect } from 'util';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Lazy import do yahoo-finance2
let yahooFinanceInstance: any = null;

async function getYahooFinance() {
  if (!yahooFinanceInstance) {
    const yahooFinance2Module = await import('yahoo-finance2');
    const YahooFinance = yahooFinance2Module.default;
    yahooFinanceInstance = new YahooFinance();
  }
  return yahooFinanceInstance;
}

interface ExplorationResult {
  ticker: string;
  type: 'STOCK' | 'ETF' | 'FII' | 'BDR';
  timestamp: string;
  modules: {
    [moduleName: string]: {
      success: boolean;
      data?: any;
      error?: string;
      dataSize?: number;
    };
  };
}

// Tickers de teste (um de cada tipo)
const TEST_TICKERS = {
  STOCK: 'PETR4.SA',    // Ação
  ETF: 'BOVA11.SA',     // ETF
  FII: 'HGLG11.SA',     // FII
  BDR: 'GOGL34.SA'      // BDR (Google)
};

/**
 * Explora um módulo específico do yahoo-finance2
 */
async function exploreModule(
  ticker: string,
  moduleName: string,
  moduleConfig?: any
): Promise<{ success: boolean; data?: any; error?: string; dataSize?: number }> {
  try {
    const yahooFinance = await getYahooFinance();
    
    console.log(`  🔍 Testando módulo: ${moduleName}...`);
    
    let result;
    
    switch (moduleName) {
      // === MÓDULOS PRINCIPAIS ===
      case 'quote':
        result = await yahooFinance.quote(ticker);
        break;
      
      case 'chart':
        result = await yahooFinance.chart(ticker, {
          period1: '2023-01-01',
          period2: new Date(),
          interval: '1mo',
          events: 'div,split'
        });
        break;
      
      case 'historical':
        result = await yahooFinance.historical(ticker, {
          period1: '2023-01-01',
          period2: new Date(),
          interval: '1mo'
        });
        break;
      
      case 'search':
        result = await yahooFinance.search(ticker.replace('.SA', ''));
        break;
      
      // === QUOTE SUMMARY COM TODOS OS SUBMODULOS ===
      case 'quoteSummary-assetProfile':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['assetProfile'] });
        break;
      
      case 'quoteSummary-balanceSheetHistory':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['balanceSheetHistory'] });
        break;
      
      case 'quoteSummary-balanceSheetHistoryQuarterly':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['balanceSheetHistoryQuarterly'] });
        break;
      
      case 'quoteSummary-calendarEvents':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['calendarEvents'] });
        break;
      
      case 'quoteSummary-cashflowStatementHistory':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['cashflowStatementHistory'] });
        break;
      
      case 'quoteSummary-cashflowStatementHistoryQuarterly':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['cashflowStatementHistoryQuarterly'] });
        break;
      
      case 'quoteSummary-defaultKeyStatistics':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['defaultKeyStatistics'] });
        break;
      
      case 'quoteSummary-earnings':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['earnings'] });
        break;
      
      case 'quoteSummary-earningsHistory':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['earningsHistory'] });
        break;
      
      case 'quoteSummary-earningsTrend':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['earningsTrend'] });
        break;
      
      case 'quoteSummary-financialData':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['financialData'] });
        break;
      
      case 'quoteSummary-fundOwnership':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['fundOwnership'] });
        break;
      
      case 'quoteSummary-fundPerformance':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['fundPerformance'] });
        break;
      
      case 'quoteSummary-fundProfile':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['fundProfile'] });
        break;
      
      case 'quoteSummary-incomeStatementHistory':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['incomeStatementHistory'] });
        break;
      
      case 'quoteSummary-incomeStatementHistoryQuarterly':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['incomeStatementHistoryQuarterly'] });
        break;
      
      case 'quoteSummary-indexTrend':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['indexTrend'] });
        break;
      
      case 'quoteSummary-industryTrend':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['industryTrend'] });
        break;
      
      case 'quoteSummary-insiderHolders':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['insiderHolders'] });
        break;
      
      case 'quoteSummary-insiderTransactions':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['insiderTransactions'] });
        break;
      
      case 'quoteSummary-institutionOwnership':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['institutionOwnership'] });
        break;
      
      case 'quoteSummary-majorDirectHolders':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['majorDirectHolders'] });
        break;
      
      case 'quoteSummary-majorHoldersBreakdown':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['majorHoldersBreakdown'] });
        break;
      
      case 'quoteSummary-netSharePurchaseActivity':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['netSharePurchaseActivity'] });
        break;
      
      case 'quoteSummary-price':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['price'] });
        break;
      
      case 'quoteSummary-quoteType':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['quoteType'] });
        break;
      
      case 'quoteSummary-recommendationTrend':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['recommendationTrend'] });
        break;
      
      case 'quoteSummary-secFilings':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['secFilings'] });
        break;
      
      case 'quoteSummary-sectorTrend':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['sectorTrend'] });
        break;
      
      case 'quoteSummary-summaryDetail':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['summaryDetail'] });
        break;
      
      case 'quoteSummary-summaryProfile':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['summaryProfile'] });
        break;
      
      case 'quoteSummary-symbol':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['symbol'] });
        break;
      
      case 'quoteSummary-topHoldings':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['topHoldings'] });
        break;
      
      case 'quoteSummary-upgradeDowngradeHistory':
        result = await yahooFinance.quoteSummary(ticker, { modules: ['upgradeDowngradeHistory'] });
        break;
      
      // === OUTROS MÓDULOS ===
      case 'insights':
        result = await yahooFinance.insights(ticker);
        break;
      
      case 'recommendationsBySymbol':
        result = await yahooFinance.recommendationsBySymbol(ticker);
        break;
      
      case 'trendingSymbols':
        result = await yahooFinance.trendingSymbols('BR');
        break;
      
      case 'options':
        result = await yahooFinance.options(ticker);
        break;
      
      default:
        throw new Error(`Módulo desconhecido: ${moduleName}`);
    }
    
    const dataSize = JSON.stringify(result).length;
    console.log(`    ✅ Sucesso (${dataSize} bytes)`);
    
    return {
      success: true,
      data: result,
      dataSize
    };
    
  } catch (error: any) {
    console.log(`    ❌ Erro: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Explora todos os módulos para um ticker
 */
async function exploreTicker(ticker: string, type: string): Promise<ExplorationResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Explorando ${ticker} (${type})`);
  console.log(`${'='.repeat(60)}\n`);
  
  const result: ExplorationResult = {
    ticker,
    type: type as any,
    timestamp: new Date().toISOString(),
    modules: {}
  };
  
  // Lista de módulos para testar
  const modules = [
    // Principais
    'quote',
    'chart',
    'historical',
    'search',
    
    // quoteSummary submodules
    'quoteSummary-assetProfile',
    'quoteSummary-balanceSheetHistory',
    'quoteSummary-balanceSheetHistoryQuarterly',
    'quoteSummary-calendarEvents',
    'quoteSummary-cashflowStatementHistory',
    'quoteSummary-cashflowStatementHistoryQuarterly',
    'quoteSummary-defaultKeyStatistics',
    'quoteSummary-earnings',
    'quoteSummary-earningsHistory',
    'quoteSummary-earningsTrend',
    'quoteSummary-financialData',
    'quoteSummary-fundOwnership',
    'quoteSummary-fundPerformance',
    'quoteSummary-fundProfile',
    'quoteSummary-incomeStatementHistory',
    'quoteSummary-incomeStatementHistoryQuarterly',
    'quoteSummary-indexTrend',
    'quoteSummary-industryTrend',
    'quoteSummary-insiderHolders',
    'quoteSummary-insiderTransactions',
    'quoteSummary-institutionOwnership',
    'quoteSummary-majorDirectHolders',
    'quoteSummary-majorHoldersBreakdown',
    'quoteSummary-netSharePurchaseActivity',
    'quoteSummary-price',
    'quoteSummary-quoteType',
    'quoteSummary-recommendationTrend',
    'quoteSummary-secFilings',
    'quoteSummary-sectorTrend',
    'quoteSummary-summaryDetail',
    'quoteSummary-summaryProfile',
    'quoteSummary-symbol',
    'quoteSummary-topHoldings',
    'quoteSummary-upgradeDowngradeHistory',
    
    // Outros
    'insights',
    'recommendationsBySymbol',
    'options'
  ];
  
  for (const moduleName of modules) {
    result.modules[moduleName] = await exploreModule(ticker, moduleName);
    
    // Pequeno delay para não sobrecarregar a API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return result;
}

/**
 * Gera relatório de exploração
 */
function generateReport(results: ExplorationResult[]): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 RELATÓRIO DE EXPLORAÇÃO');
  console.log(`${'='.repeat(60)}\n`);
  
  // Estatísticas por tipo de ativo
  for (const result of results) {
    console.log(`\n${result.type} (${result.ticker}):`);
    console.log(`${'─'.repeat(40)}`);
    
    const successCount = Object.values(result.modules).filter(m => m.success).length;
    const totalCount = Object.keys(result.modules).length;
    const successRate = ((successCount / totalCount) * 100).toFixed(1);
    
    console.log(`✅ Módulos com sucesso: ${successCount}/${totalCount} (${successRate}%)`);
    console.log(`\nMódulos disponíveis:`);
    
    // Agrupar por categoria
    const categories: { [key: string]: string[] } = {
      'Principais': [],
      'Dados Financeiros': [],
      'Perfil e Informações': [],
      'Propriedade e Transações': [],
      'Tendências e Recomendações': [],
      'Outros': []
    };
    
    for (const [moduleName, moduleResult] of Object.entries(result.modules)) {
      if (!moduleResult.success) continue;
      
      if (moduleName.startsWith('quoteSummary-balance') || 
          moduleName.startsWith('quoteSummary-income') || 
          moduleName.startsWith('quoteSummary-cashflow') ||
          moduleName.startsWith('quoteSummary-financial') ||
          moduleName.startsWith('quoteSummary-earnings') ||
          moduleName.startsWith('quoteSummary-defaultKey')) {
        categories['Dados Financeiros'].push(moduleName);
      } else if (moduleName.startsWith('quoteSummary-asset') || 
                 moduleName.startsWith('quoteSummary-summary') ||
                 moduleName.startsWith('quoteSummary-quoteType') ||
                 moduleName.startsWith('quoteSummary-fund')) {
        categories['Perfil e Informações'].push(moduleName);
      } else if (moduleName.includes('insider') || 
                 moduleName.includes('institution') || 
                 moduleName.includes('ownership') ||
                 moduleName.includes('Holders')) {
        categories['Propriedade e Transações'].push(moduleName);
      } else if (moduleName.includes('Trend') || 
                 moduleName.includes('recommendation') ||
                 moduleName.includes('upgrade')) {
        categories['Tendências e Recomendações'].push(moduleName);
      } else if (['quote', 'chart', 'historical', 'search'].includes(moduleName)) {
        categories['Principais'].push(moduleName);
      } else {
        categories['Outros'].push(moduleName);
      }
    }
    
    for (const [category, modules] of Object.entries(categories)) {
      if (modules.length > 0) {
        console.log(`\n  📁 ${category}:`);
        modules.forEach(m => console.log(`     ✓ ${m}`));
      }
    }
  }
  
  // Comparativo entre tipos de ativos
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('🔄 COMPARATIVO ENTRE TIPOS DE ATIVOS');
  console.log(`${'='.repeat(60)}\n`);
  
  // Encontrar módulos disponíveis em todos os tipos
  const allModules = new Set(Object.keys(results[0].modules));
  const universalModules: string[] = [];
  const typeSpecificModules: { [type: string]: string[] } = {};
  
  for (const moduleName of allModules) {
    const availableIn = results.filter(r => r.modules[moduleName]?.success).map(r => r.type);
    
    if (availableIn.length === results.length) {
      universalModules.push(moduleName);
    } else if (availableIn.length > 0) {
      for (const type of availableIn) {
        if (!typeSpecificModules[type]) typeSpecificModules[type] = [];
        typeSpecificModules[type].push(moduleName);
      }
    }
  }
  
  console.log(`📦 Módulos universais (disponíveis para todos): ${universalModules.length}`);
  universalModules.slice(0, 10).forEach(m => console.log(`   ✓ ${m}`));
  if (universalModules.length > 10) {
    console.log(`   ... e mais ${universalModules.length - 10} módulos`);
  }
  
  console.log(`\n📦 Módulos específicos por tipo:`);
  for (const [type, modules] of Object.entries(typeSpecificModules)) {
    console.log(`\n  ${type}: ${modules.length} módulos`);
    modules.slice(0, 5).forEach(m => console.log(`     ✓ ${m}`));
    if (modules.length > 5) {
      console.log(`     ... e mais ${modules.length - 5} módulos`);
    }
  }
}

/**
 * Salva resultados completos em arquivo JSON
 */
function saveResults(results: ExplorationResult[]): void {
  const outputDir = join(__dirname, '../.exploration-results');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `yahoo-finance2-exploration-${timestamp}.json`;
  const filepath = join(outputDir, filename);
  
  try {
    // Criar diretório se não existir
    const fs = require('fs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Salvar resultados completos
    writeFileSync(filepath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n💾 Resultados completos salvos em: ${filepath}`);
    
    // Também salvar uma versão resumida
    const summary = results.map(r => ({
      ticker: r.ticker,
      type: r.type,
      timestamp: r.timestamp,
      moduleSummary: Object.entries(r.modules).reduce((acc, [name, result]) => {
        acc[name] = {
          success: result.success,
          dataSize: result.dataSize,
          hasData: !!result.data
        };
        return acc;
      }, {} as any)
    }));
    
    const summaryFilename = `yahoo-finance2-summary-${timestamp}.json`;
    const summaryFilepath = join(outputDir, summaryFilename);
    writeFileSync(summaryFilepath, JSON.stringify(summary, null, 2), 'utf-8');
    console.log(`💾 Resumo salvo em: ${summaryFilepath}`);
    
  } catch (error: any) {
    console.error(`❌ Erro ao salvar resultados:`, error.message);
  }
}

/**
 * Main
 */
async function main() {
  console.log(`🚀 Iniciando exploração do yahoo-finance2...`);
  console.log(`📅 ${new Date().toLocaleString('pt-BR')}\n`);
  
  const results: ExplorationResult[] = [];
  
  // Explorar cada tipo de ativo
  for (const [type, ticker] of Object.entries(TEST_TICKERS)) {
    const result = await exploreTicker(ticker, type);
    results.push(result);
    
    // Delay entre tickers
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Gerar relatório
  generateReport(results);
  
  // Salvar resultados
  saveResults(results);
  
  console.log(`\n✅ Exploração concluída!`);
}

// Executar
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}

export { main, exploreTicker, exploreModule };

