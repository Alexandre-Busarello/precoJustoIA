/**
 * Teste da otimização do método Barsi com busca sequencial de dividendos
 * Este exemplo simula como o rank-builder agora funciona
 */

import { DividendService } from '@/lib/dividend-service';

// Simular dados de empresas como retornados pelo getCompaniesData()
const mockCompanies = [
  {
    ticker: 'PETR4',
    name: 'Petrobras',
    sector: 'Energia',
    currentPrice: 35.50,
    financials: {
      ultimoDividendo: 2.87, // Tem dividendo
      dy: 0.08,
      roe: 0.15
    }
  },
  {
    ticker: 'DASA3',
    name: 'Dasa',
    sector: 'Saúde',
    currentPrice: 12.30,
    financials: {
      ultimoDividendo: null, // Não tem dividendo - precisa buscar
      dy: 0.05,
      roe: 0.12
    }
  },
  {
    ticker: 'RENT3',
    name: 'Localiza',
    sector: 'Serviços',
    currentPrice: 45.20,
    financials: {
      ultimoDividendo: null, // Não tem dividendo - precisa buscar
      dy: 0.06,
      roe: 0.18
    }
  }
];

async function testBarsiOptimization() {
  console.log('🧪 Testando otimização do método Barsi\n');
  
  // Simular a lógica do rank-builder
  const model = 'barsi';
  
  if (model === 'barsi') {
    // Identificar empresas que precisam de dados de dividendos
    const companiesNeedingDividends: string[] = [];
    
    for (const company of mockCompanies) {
      const hasUltimoDividendo = company.financials.ultimoDividendo && Number(company.financials.ultimoDividendo) > 0;
      
      if (!hasUltimoDividendo) {
        companiesNeedingDividends.push(company.ticker);
      }
    }
    
    console.log(`📊 Empresas que precisam de dividendos: ${companiesNeedingDividends.join(', ')}`);
    
    if (companiesNeedingDividends.length > 0) {
      console.log(`📊 Iniciando busca sequencial para ${companiesNeedingDividends.length} empresas...\n`);
      
      // Buscar dividendos sequencialmente
      const dividendResults = await DividendService.fetchLatestDividendsSequential(
        companiesNeedingDividends,
        500 // 500ms entre cada busca
      );
      
      const successCount = Array.from(dividendResults.values()).filter(r => r.success).length;
      console.log(`\n✅ Busca concluída: ${successCount}/${companiesNeedingDividends.length} sucessos`);
      
      // Enriquecer dados das empresas
      for (const company of mockCompanies) {
        if (dividendResults.has(company.ticker)) {
          const dividendResult = dividendResults.get(company.ticker);
          if (dividendResult?.success && dividendResult.latestDividend) {
            company.financials.ultimoDividendo = dividendResult.latestDividend.amount;
            console.log(`📊 Enriquecido ${company.ticker} com dividendo: R$ ${dividendResult.latestDividend.amount}`);
          }
        }
      }
    }
  }
  
  // Mostrar resultado final
  console.log('\n📋 Estado final das empresas:');
  for (const company of mockCompanies) {
    const dividendo = company.financials.ultimoDividendo;
    console.log(`${company.ticker}: ${dividendo ? `R$ ${dividendo}` : 'Sem dividendo'}`);
  }
}

// Executar teste
async function runTest() {
  try {
    await testBarsiOptimization();
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Descomente para executar
// runTest();

export { testBarsiOptimization };