/**
 * Exemplo de como usar o DividendService otimizado para buscar dividendos
 * de forma sequencial sem sobrecarregar o banco de dados
 */

import { DividendService } from '@/lib/dividend-service';

// Exemplo 1: Buscar apenas o último dividendo de uma empresa (sem salvar)
async function exemploUltimoDividendo() {
  console.log('=== Exemplo: Buscar último dividendo ===');
  
  const result = await DividendService.fetchLatestDividendOnly('PETR4');
  
  if (result.success && result.latestDividend) {
    console.log(`Último dividendo PETR4: R$ ${result.latestDividend.amount} em ${result.latestDividend.date}`);
  } else {
    console.log(`Erro: ${result.error}`);
  }
}

// Exemplo 2: Buscar dividendos para múltiplas empresas de forma sequencial
async function exemploLoteSequencial() {
  console.log('=== Exemplo: Busca sequencial em lote ===');
  
  const tickers = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3'];
  
  const results = await DividendService.fetchLatestDividendsSequential(
    tickers,
    500 // 500ms entre cada busca
  );
  
  console.log('\n📊 Resultados:');
  for (const [ticker, result] of results) {
    if (result.success && result.latestDividend) {
      console.log(`✅ ${ticker}: R$ ${result.latestDividend.amount}`);
    } else {
      console.log(`❌ ${ticker}: ${result.error}`);
    }
  }
}

// Exemplo 3: Atualizar dividendos para empresas sem dados (uso em jobs de manutenção)
async function exemploAtualizacaoManutencao() {
  console.log('=== Exemplo: Job de manutenção ===');
  
  // Simular empresas que precisam de atualização
  const empresasSemDividendos = ['DASA3', 'RENT3', 'MGLU3'];
  
  console.log(`🔧 Atualizando dividendos para ${empresasSemDividendos.length} empresas...`);
  
  const results = await DividendService.fetchLatestDividendsSequential(
    empresasSemDividendos,
    1000 // 1 segundo entre cada busca para ser mais conservador
  );
  
  const sucessos = Array.from(results.values()).filter(r => r.success).length;
  console.log(`✅ Atualização concluída: ${sucessos}/${empresasSemDividendos.length} sucessos`);
}

// Executar exemplos
async function executarExemplos() {
  try {
    await exemploUltimoDividendo();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await exemploLoteSequencial();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await exemploAtualizacaoManutencao();
    
  } catch (error) {
    console.error('Erro nos exemplos:', error);
  }
}

// Descomente para executar
// executarExemplos();

export {
  exemploUltimoDividendo,
  exemploLoteSequencial,
  exemploAtualizacaoManutencao
};