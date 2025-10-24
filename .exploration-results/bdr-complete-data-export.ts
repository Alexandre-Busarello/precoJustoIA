#!/usr/bin/env tsx

/**
 * Exportação completa de dados BDR do Yahoo Finance2
 * Salva todos os dados em JSON para análise posterior
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function exportBDRCompleteData() {
  try {
    console.log('🔍 EXPORTAÇÃO COMPLETA DE DADOS BDR');
    console.log('=' .repeat(50));
    
    const { default: YahooFinance } = await import('yahoo-finance2');
    const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
    
    const tickers = ['AMZO34.SA', 'GOGL34.SA', 'MSFT34.SA', 'ROXO34.SA'];
    const completeResults: any[] = [];
    
    for (const ticker of tickers) {
      console.log(`\n📊 Processando ${ticker}:`);
      
      const tickerResult = {
        ticker,
        timestamp: new Date().toISOString(),
        quote: null,
        quoteSummary: {},
        fundamentalsTimeSeries: null,
        summary: {
          totalFields: 0,
          moduleCount: 0,
          availableModules: [] as string[],
          errors: [] as string[]
        }
      };
      
      // 1. QUOTE API
      try {
        console.log('  📊 Coletando Quote API...');
        const quote = await yahooFinance.quote(ticker);
        tickerResult.quote = quote;
        
        const quoteFields = Object.keys(quote).filter(key => 
          quote[key] !== null && quote[key] !== undefined
        );
        console.log(`    ✅ Quote: ${quoteFields.length} campos coletados`);
        tickerResult.summary.totalFields += quoteFields.length;
        
      } catch (error: any) {
        console.log(`    ❌ Quote falhou: ${error.message}`);
        tickerResult.summary.errors.push(`Quote: ${error.message}`);
      }
      
      // 2. QUOTESUMMARY API - Todos os módulos possíveis
      const modules = [
        'defaultKeyStatistics',
        'financialData', 
        'summaryDetail',
        'summaryProfile',
        'balanceSheetHistory',
        'incomeStatementHistory',
        'cashflowStatementHistory',
        'earnings',
        'earningsHistory',
        'earningsTrend',
        'price',
        'quoteType',
        'assetProfile',
        'calendarEvents',
        'fundOwnership',
        'institutionOwnership',
        'majorHoldersBreakdown',
        'recommendationTrend'
      ];
      
      console.log('  📈 Coletando QuoteSummary módulos...');
      for (const module of modules) {
        try {
          const result = await yahooFinance.quoteSummary(ticker, { modules: [module] });
          
          if (result[module]) {
            tickerResult.quoteSummary[module] = result[module];
            
            const fields = Object.keys(result[module]).filter(key => 
              result[module][key] !== null && result[module][key] !== undefined
            );
            
            console.log(`    ✅ ${module}: ${fields.length} campos`);
            tickerResult.summary.availableModules.push(module);
            tickerResult.summary.moduleCount++;
            tickerResult.summary.totalFields += fields.length;
          }
          
        } catch (error: any) {
          if (!error.message.includes('No fundamentals data found')) {
            tickerResult.summary.errors.push(`${module}: ${error.message}`);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // 3. FUNDAMENTALSTIMESERIES API
      console.log('  💰 Coletando FundamentalsTimeSeries...');
      const configs = [
        { type: 'annual', module: 'all' },
        { type: 'annual', module: 'balance-sheet' },
        { type: 'annual', module: 'financials' },
        { type: 'annual', module: 'cash-flow' },
        { type: 'quarterly', module: 'all' }
      ];
      
      for (const config of configs) {
        try {
          const data = await yahooFinance.fundamentalsTimeSeries(ticker, {
            period1: '2020-01-01',
            ...config
          });
          
          if (data && data.length > 0) {
            if (!tickerResult.fundamentalsTimeSeries) {
              tickerResult.fundamentalsTimeSeries = {};
            }
            tickerResult.fundamentalsTimeSeries[`${config.type}_${config.module}`] = data;
            console.log(`    ✅ ${config.type} ${config.module}: ${data.length} registros`);
          }
          
        } catch (configError: any) {
          // Tenta extrair dados do erro de validação
          if (configError.message.includes('Failed Yahoo Schema validation') && configError.result) {
            if (!tickerResult.fundamentalsTimeSeries) {
              tickerResult.fundamentalsTimeSeries = {};
            }
            tickerResult.fundamentalsTimeSeries[`${config.type}_${config.module}_validation_error`] = {
              error: configError.message,
              data: configError.result
            };
            console.log(`    ⚠️ ${config.type} ${config.module}: dados extraídos do erro de validação`);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      completeResults.push(tickerResult);
      
      console.log(`\n  📊 Resumo ${ticker}:`);
      console.log(`     Total de campos: ${tickerResult.summary.totalFields}`);
      console.log(`     Módulos QuoteSummary: ${tickerResult.summary.moduleCount}`);
      console.log(`     Quote disponível: ${tickerResult.quote ? 'Sim' : 'Não'}`);
      console.log(`     FundamentalsTimeSeries: ${tickerResult.fundamentalsTimeSeries ? 'Sim' : 'Não'}`);
      console.log(`     Erros: ${tickerResult.summary.errors.length}`);
      
      // Delay entre tickers para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Salva resultados completos
    saveCompleteResults(completeResults);
    
    // Gera relatório final
    generateFinalReport(completeResults);
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

function saveCompleteResults(results: any[]): void {
  try {
    const resultsDir = join(process.cwd(), '.exploration-results');
    mkdirSync(resultsDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `bdr-complete-export-${timestamp}.json`;
    const filepath = join(resultsDir, filename);
    
    const completeData = {
      metadata: {
        timestamp: new Date().toISOString(),
        totalTickers: results.length,
        description: 'Exportação completa de dados BDR do Yahoo Finance2',
        apis: ['Quote', 'QuoteSummary', 'FundamentalsTimeSeries'],
        purpose: 'Análise completa de campos disponíveis para mapeamento do schema Prisma'
      },
      summary: {
        totalFields: results.reduce((sum, r) => sum + r.summary.totalFields, 0),
        totalModules: results.reduce((sum, r) => sum + r.summary.moduleCount, 0),
        tickersSummary: results.map(r => ({
          ticker: r.ticker,
          totalFields: r.summary.totalFields,
          moduleCount: r.summary.moduleCount,
          availableModules: r.summary.availableModules,
          hasQuote: !!r.quote,
          hasFundamentals: !!r.fundamentalsTimeSeries,
          errorCount: r.summary.errors.length
        })),
        moduleFrequency: calculateModuleFrequency(results),
        fieldAnalysis: analyzeFields(results)
      },
      fullData: results
    };
    
    writeFileSync(filepath, JSON.stringify(completeData, null, 2));
    
    const fileSizeMB = (JSON.stringify(completeData).length / 1024 / 1024).toFixed(2);
    console.log(`\n💾 DADOS COMPLETOS SALVOS:`);
    console.log(`   Arquivo: ${filepath}`);
    console.log(`   Tamanho: ${fileSizeMB} MB`);
    console.log(`   Total de campos: ${completeData.summary.totalFields}`);
    console.log(`   Total de módulos: ${completeData.summary.totalModules}`);
    
  } catch (error) {
    console.error('❌ Erro ao salvar dados completos:', error);
  }
}

function calculateModuleFrequency(results: any[]): any {
  const moduleFrequency = new Map<string, number>();
  results.forEach(r => {
    r.summary.availableModules.forEach((module: string) => {
      moduleFrequency.set(module, (moduleFrequency.get(module) || 0) + 1);
    });
  });
  
  return Object.fromEntries(
    Array.from(moduleFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([module, count]) => [module, {
        count,
        percentage: ((count / results.length) * 100).toFixed(0) + '%'
      }])
  );
}

function analyzeFields(results: any[]): any {
  const analysis = {
    quoteFields: new Set<string>(),
    quoteSummaryFields: new Map<string, Set<string>>(),
    fundamentalsFields: new Set<string>()
  };
  
  results.forEach(r => {
    // Analisa campos do Quote
    if (r.quote) {
      Object.keys(r.quote).forEach(field => {
        if (r.quote[field] !== null && r.quote[field] !== undefined) {
          analysis.quoteFields.add(field);
        }
      });
    }
    
    // Analisa campos do QuoteSummary
    Object.keys(r.quoteSummary).forEach(module => {
      if (!analysis.quoteSummaryFields.has(module)) {
        analysis.quoteSummaryFields.set(module, new Set());
      }
      Object.keys(r.quoteSummary[module]).forEach(field => {
        if (r.quoteSummary[module][field] !== null && r.quoteSummary[module][field] !== undefined) {
          analysis.quoteSummaryFields.get(module)!.add(field);
        }
      });
    });
    
    // Analisa campos do FundamentalsTimeSeries
    if (r.fundamentalsTimeSeries) {
      Object.values(r.fundamentalsTimeSeries).forEach((dataset: any) => {
        if (Array.isArray(dataset)) {
          dataset.forEach(record => {
            Object.keys(record).forEach(field => {
              if (record[field] !== null && record[field] !== undefined) {
                analysis.fundamentalsFields.add(field);
              }
            });
          });
        } else if (dataset && dataset.data && Array.isArray(dataset.data)) {
          dataset.data.forEach((record: any) => {
            Object.keys(record).forEach(field => {
              if (record[field] !== null && record[field] !== undefined) {
                analysis.fundamentalsFields.add(field);
              }
            });
          });
        }
      });
    }
  });
  
  return {
    quoteFieldCount: analysis.quoteFields.size,
    quoteFields: Array.from(analysis.quoteFields).sort(),
    quoteSummaryModules: Object.fromEntries(
      Array.from(analysis.quoteSummaryFields.entries()).map(([module, fields]) => [
        module, {
          fieldCount: fields.size,
          fields: Array.from(fields).sort()
        }
      ])
    ),
    fundamentalsFieldCount: analysis.fundamentalsFields.size,
    fundamentalsFields: Array.from(analysis.fundamentalsFields).sort()
  };
}

function generateFinalReport(results: any[]): void {
  console.log('\n📊 RELATÓRIO FINAL DA EXPORTAÇÃO');
  console.log('=' .repeat(50));
  
  const totalFields = results.reduce((sum, r) => sum + r.summary.totalFields, 0);
  const totalModules = results.reduce((sum, r) => sum + r.summary.moduleCount, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.summary.errors.length, 0);
  
  console.log(`\n📈 Estatísticas Gerais:`);
  console.log(`   Tickers processados: ${results.length}`);
  console.log(`   Total de campos coletados: ${totalFields}`);
  console.log(`   Total de módulos: ${totalModules}`);
  console.log(`   Média de campos por ticker: ${Math.round(totalFields / results.length)}`);
  console.log(`   Total de erros: ${totalErrors}`);
  
  console.log(`\n🏆 Ranking por cobertura de dados:`);
  results
    .sort((a, b) => b.summary.totalFields - a.summary.totalFields)
    .forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.ticker}: ${r.summary.totalFields} campos (${r.summary.moduleCount} módulos)`);
    });
  
  console.log(`\n✅ EXPORTAÇÃO CONCLUÍDA COM SUCESSO!`);
  console.log(`   Todos os dados foram salvos em JSON para análise posterior`);
  console.log(`   Use os dados para mapear campos para o schema Prisma`);
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return 'N/A';
  
  if (typeof value === 'number') {
    if (Math.abs(value) > 1000000000) {
      return `${(value / 1000000000).toFixed(2)}B`;
    } else if (Math.abs(value) > 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else {
      return value.toFixed(2);
    }
  }
  
  if (typeof value === 'string' && value.length > 30) {
    return value.substring(0, 30) + '...';
  }
  
  return value.toString();
}

// Executa a exportação
exportBDRCompleteData();