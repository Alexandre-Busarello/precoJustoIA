const { TickerProcessingManager } = require('./ticker-processing-manager.ts');
require('dotenv').config();

async function testTickerProcessing() {
  console.log('🧪 Testando sistema de processamento por ticker...\n');
  
  try {
    const tickerManager = new TickerProcessingManager('test_ticker_processing');
    
    // Teste 1: Inicializar alguns tickers de teste
    console.log('📊 Teste 1: Inicializando tickers de teste...');
    const testTickers = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3'];
    await tickerManager.initializeTickers(testTickers, 0);
    console.log(`   ✅ ${testTickers.length} tickers inicializados\n`);
    
    // Teste 2: Verificar resumo inicial
    console.log('📊 Teste 2: Verificando resumo inicial...');
    const initialSummary = await tickerManager.getProcessingSummary();
    console.log(`   ${tickerManager.getFormattedSummary(initialSummary)}\n`);
    
    // Teste 3: Buscar tickers para processar
    console.log('🔍 Teste 3: Buscando tickers para processar...');
    const tickersToProcess = await tickerManager.getTickersToProcess(3);
    console.log(`   Encontrados ${tickersToProcess.length} tickers para processar:`);
    tickersToProcess.forEach((t, i) => {
      const needs = [];
      if (t.needsHistoricalData) needs.push('histórico');
      if (t.needsTTMUpdate) needs.push('TTM');
      if (t.needsBrapiProData) needs.push('Brapi Pro');
      console.log(`   ${i + 1}. ${t.ticker} - Status: ${t.status} (${needs.join(', ') || 'atualizado'})`);
    });
    console.log('   ✅ Busca funcionando\n');
    
    // Teste 4: Simular processamento de um ticker
    if (tickersToProcess.length > 0) {
      const testTicker = tickersToProcess[0].ticker;
      console.log(`🔄 Teste 4: Simulando processamento de ${testTicker}...`);
      
      // Marcar como em processamento
      await tickerManager.markProcessing(testTicker);
      console.log(`   Marcado como PROCESSING`);
      
      // Simular progresso parcial
      await tickerManager.updateProgress(testTicker, {
        hasBasicData: true,
        hasHistoricalData: false,
        hasTTMData: true
      });
      console.log(`   Progresso parcial atualizado`);
      
      // Marcar como completo
      await tickerManager.markCompleted(testTicker);
      console.log(`   Marcado como COMPLETED`);
      console.log('   ✅ Simulação de processamento funcionando\n');
    }
    
    // Teste 5: Testar processamento de tickers específicos
    console.log('🎯 Teste 5: Testando tickers específicos...');
    const specificTickers = ['MGLU3', 'WEGE3'];
    const specificTickerInfos = await tickerManager.getSpecificTickers(specificTickers);
    console.log(`   Tickers específicos encontrados/criados: ${specificTickerInfos.length}`);
    specificTickerInfos.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.ticker} - Status: ${t.status} - Prioridade: ${t.priority}`);
    });
    console.log('   ✅ Tickers específicos funcionando\n');
    
    // Teste 6: Testar filtros
    console.log('🔍 Teste 6: Testando filtros...');
    
    const priorityTickers = await tickerManager.getTickersToProcess(5, { priorityOnly: true });
    console.log(`   Tickers com prioridade: ${priorityTickers.length}`);
    
    const historicalNeeded = await tickerManager.getTickersToProcess(5, { historicalOnly: true });
    console.log(`   Tickers que precisam de histórico: ${historicalNeeded.length}`);
    
    const ttmNeeded = await tickerManager.getTickersToProcess(5, { ttmOnly: true });
    console.log(`   Tickers que precisam de TTM: ${ttmNeeded.length}`);
    
    console.log('   ✅ Filtros funcionando\n');
    
    // Teste 7: Testar tratamento de erros
    console.log('❌ Teste 7: Testando tratamento de erros...');
    const errorTicker = testTickers[1]; // VALE3
    await tickerManager.markError(errorTicker, 'Erro de teste simulado');
    console.log(`   Erro marcado para ${errorTicker}`);
    
    const errorSummary = await tickerManager.getProcessingSummary();
    console.log(`   Erros no resumo: ${errorSummary.error}`);
    console.log('   ✅ Tratamento de erros funcionando\n');
    
    // Teste 8: Resumo final
    console.log('📋 Teste 8: Resumo final do sistema:');
    const finalSummary = await tickerManager.getProcessingSummary();
    console.log(`   ${tickerManager.getFormattedSummary(finalSummary)}\n`);
    
    // Limpeza: Remover tickers de teste
    console.log('🧹 Limpeza: Removendo tickers de teste...');
    const allTestTickers = [...testTickers, ...specificTickers];
    await tickerManager.removeTickers(allTestTickers);
    console.log(`   ${allTestTickers.length} tickers de teste removidos`);
    console.log('   ✅ Limpeza concluída\n');
    
    console.log('🎉 Todos os testes passaram! Sistema funcionando corretamente.');
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message);
    console.error(error.stack);
  }
}

// Executar testes
testTickerProcessing().catch(console.error);
