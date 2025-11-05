/**
 * Teste da persistência automática de dividendos no banco de dados
 * Demonstra como os dividendos são salvos automaticamente
 */

import { DividendService } from '@/lib/dividend-service';
import { prisma } from '@/lib/prisma';

async function testDividendPersistence() {
  console.log('🧪 Testando persistência automática de dividendos\n');
  
  const testTicker = 'PETR4';
  
  try {
    // 1. Verificar estado inicial no banco
    console.log('📋 Estado inicial no banco:');
    const companyBefore = await prisma.company.findUnique({
      where: { ticker: testTicker },
      select: {
        id: true,
        ticker: true,
        ultimoDividendo: true,
        dataUltimoDividendo: true,
        financialData: {
          where: { year: new Date().getFullYear() },
          select: {
            year: true,
            ultimoDividendo: true,
            dataUltimoDividendo: true
          }
        }
      }
    });
    
    if (companyBefore) {
      console.log(`Company.ultimoDividendo: ${companyBefore.ultimoDividendo || 'null'}`);
      console.log(`Company.dataUltimoDividendo: ${companyBefore.dataUltimoDividendo || 'null'}`);
      
      if (companyBefore.financialData.length > 0) {
        const fd = companyBefore.financialData[0];
        console.log(`FinancialData.ultimoDividendo: ${fd.ultimoDividendo || 'null'}`);
        console.log(`FinancialData.dataUltimoDividendo: ${fd.dataUltimoDividendo || 'null'}`);
      } else {
        console.log('FinancialData do ano atual: não existe');
      }
    } else {
      console.log(`❌ Empresa ${testTicker} não encontrada`);
      return;
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 2. Buscar e salvar dividendo usando o método sequencial
    console.log('🔄 Executando busca sequencial com persistência...\n');
    
    const results = await DividendService.fetchLatestDividendsSequential(
      [testTicker],
      0 // Sem delay para teste
    );
    
    const result = results.get(testTicker);
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 3. Verificar estado final no banco
    console.log('📋 Estado final no banco:');
    const companyAfter = await prisma.company.findUnique({
      where: { ticker: testTicker },
      select: {
        ultimoDividendo: true,
        dataUltimoDividendo: true,
        financialData: {
          where: { year: new Date().getFullYear() },
          select: {
            year: true,
            ultimoDividendo: true,
            dataUltimoDividendo: true
          }
        }
      }
    });
    
    if (companyAfter) {
      console.log(`Company.ultimoDividendo: ${companyAfter.ultimoDividendo || 'null'}`);
      console.log(`Company.dataUltimoDividendo: ${companyAfter.dataUltimoDividendo || 'null'}`);
      
      if (companyAfter.financialData.length > 0) {
        const fd = companyAfter.financialData[0];
        console.log(`FinancialData.ultimoDividendo: ${fd.ultimoDividendo || 'null'}`);
        console.log(`FinancialData.dataUltimoDividendo: ${fd.dataUltimoDividendo || 'null'}`);
      }
    }
    
    // 4. Verificar se houve mudança
    console.log('\n📊 Resultado do teste:');
    if (result?.success) {
      console.log(`✅ Dividendo encontrado e salvo: R$ ${result.latestDividend?.amount}`);
      
      const dividendoMudou = companyBefore?.ultimoDividendo !== companyAfter?.ultimoDividendo;
      const dataMudou = companyBefore?.dataUltimoDividendo?.getTime() !== companyAfter?.dataUltimoDividendo?.getTime();
      
      if (dividendoMudou || dataMudou) {
        console.log('✅ Dados foram atualizados no banco com sucesso!');
      } else {
        console.log('ℹ️ Dados já estavam atualizados (sem mudança necessária)');
      }
    } else {
      console.log(`❌ Falha na busca: ${result?.error}`);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Função para testar múltiplas empresas
async function testMultipleDividendPersistence() {
  console.log('🧪 Testando persistência para múltiplas empresas\n');
  
  const testTickers = ['PETR4', 'VALE3', 'ITUB4'];
  
  try {
    const results = await DividendService.fetchLatestDividendsSequential(
      testTickers,
      500 // 500ms entre cada busca
    );
    
    console.log('\n📊 Resumo dos resultados:');
    for (const [ticker, result] of results) {
      if (result.success && result.latestDividend) {
        console.log(`✅ ${ticker}: R$ ${result.latestDividend.amount} (${result.latestDividend.date})`);
      } else {
        console.log(`❌ ${ticker}: ${result.error}`);
      }
    }
    
    const sucessos = Array.from(results.values()).filter(r => r.success).length;
    console.log(`\n🎯 Total: ${sucessos}/${testTickers.length} sucessos`);
    
  } catch (error) {
    console.error('❌ Erro no teste múltiplo:', error);
  }
}

// Executar testes
async function runTests() {
  try {
    await testDividendPersistence();
    console.log('\n' + '='.repeat(80) + '\n');
    await testMultipleDividendPersistence();
  } catch (error) {
    console.error('❌ Erro geral nos testes:', error);
  }
}

// Descomente para executar
// runTests();

export {
  testDividendPersistence,
  testMultipleDividendPersistence
};