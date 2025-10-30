#!/usr/bin/env tsx

/**
 * Script de teste para verificar a integração BDR
 * Testa alguns BDRs principais para validar o funcionamento
 */

import { BDRDataService } from '../src/lib/bdr-data-service';
import { backgroundPrisma } from './prisma-background';

async function testBDRIntegration() {
  console.log('🧪 TESTE DE INTEGRAÇÃO BDR');
  console.log('=' .repeat(50));
  
  // Lista de BDRs para teste (incluindo alguns da lista principal)
  const testBDRs = [
    'AMZO34.SA', // Amazon
    'AAPL34.SA', // Apple  
    'MSFT34.SA', // Microsoft
    'GOGL34.SA', // Google
    'TSLA34.SA', // Tesla
    'KO34.SA',   // Coca-Cola
    'WMT34.SA',  // Walmart
    'DIS34.SA'   // Disney
  ];
  
  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ ticker: string; error: string }> = [];
  
  console.log(`\n📊 Testando ${testBDRs.length} BDRs principais...\n`);
  
  for (let i = 0; i < testBDRs.length; i++) {
    const ticker = testBDRs[i];
    console.log(`[${i + 1}/${testBDRs.length}] 🔄 Testando ${ticker}...`);
    
    try {
      // 1. Verificar se é detectado como BDR
      const isBDR = BDRDataService.isBDR(ticker);
      console.log(`  🔍 Detectado como BDR: ${isBDR ? '✅' : '❌'}`);
      
      if (!isBDR) {
        throw new Error('Ticker não foi detectado como BDR');
      }
      
      // 2. Buscar dados do Yahoo Finance
      console.log(`  📡 Buscando dados do Yahoo Finance...`);
      const yahooData = await BDRDataService.fetchBDRData(ticker);
      
      if (!yahooData) {
        throw new Error('Não foi possível obter dados do Yahoo Finance');
      }
      
      console.log(`  ✅ Dados obtidos: ${yahooData.quote?.shortName || yahooData.quote?.longName || 'Nome não disponível'}`);
      
      // 3. Converter dados para formato do banco
      console.log(`  🔄 Convertendo dados para formato do banco...`);
      const financialData = BDRDataService.convertYahooDataToFinancialData(yahooData, ticker);
      
      console.log(`  📊 Dados convertidos:`);
      console.log(`     - P/L: ${financialData.pl || 'N/A'}`);
      console.log(`     - P/VP: ${financialData.pvp || 'N/A'}`);
      console.log(`     - DY: ${financialData.dy ? (financialData.dy * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`     - ROE: ${financialData.roe ? (financialData.roe * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`     - Market Cap: ${financialData.marketCap ? 'R$ ' + (financialData.marketCap / 1000000000).toFixed(2) + 'B' : 'N/A'}`);
      
      // 4. Testar criação/atualização da empresa (sem salvar)
      console.log(`  🏢 Testando estrutura da empresa...`);
      const company = await backgroundPrisma.company.findUnique({
        where: { ticker: ticker.toUpperCase() }
      });
      
      if (company) {
        console.log(`  ✅ Empresa já existe: ${company.name}`);
      } else {
        console.log(`  📝 Empresa seria criada: ${yahooData.quote?.longName || yahooData.quote?.shortName || ticker}`);
      }
      
      successCount++;
      console.log(`  ✅ ${ticker} testado com sucesso!\n`);
      
    } catch (error: any) {
      errorCount++;
      const errorMsg = error.message || 'Erro desconhecido';
      errors.push({ ticker, error: errorMsg });
      console.log(`  ❌ Erro: ${errorMsg}\n`);
    }
    
    // Delay entre testes para evitar rate limiting
    if (i < testBDRs.length - 1) {
      console.log(`  ⏳ Aguardando 2s antes do próximo teste...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Resumo final
  console.log('📊 RESUMO DO TESTE');
  console.log('=' .repeat(50));
  console.log(`✅ Sucessos: ${successCount}/${testBDRs.length}`);
  console.log(`❌ Erros: ${errorCount}/${testBDRs.length}`);
  
  if (errors.length > 0) {
    console.log('\n🔍 Detalhes dos erros:');
    errors.forEach(({ ticker, error }) => {
      console.log(`  • ${ticker}: ${error}`);
    });
  }
  
  // Teste da lista única de BDRs
  console.log('\n🌎 Testando lista única de BDRs...');
  try {
    const uniqueBDRs = await BDRDataService.getUniqueBDRList();
    console.log(`✅ Lista única obtida: ${uniqueBDRs.length} BDRs`);
    console.log(`📋 Primeiros 10: ${uniqueBDRs.slice(0, 10).join(', ')}`);
  } catch (error: any) {
    console.log(`❌ Erro ao obter lista única: ${error.message}`);
  }
  
  console.log('\n🎉 TESTE CONCLUÍDO!');
  
  if (successCount === testBDRs.length) {
    console.log('✅ Todos os testes passaram! A integração BDR está funcionando.');
  } else {
    console.log(`⚠️ ${errorCount} teste(s) falharam. Verifique os erros acima.`);
  }
  
  process.exit(0);
}

// Executar teste
testBDRIntegration().catch(error => {
  console.error('❌ Erro crítico no teste:', error);
  process.exit(1);
});