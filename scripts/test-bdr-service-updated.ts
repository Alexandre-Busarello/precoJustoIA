#!/usr/bin/env npx tsx

/**
 * TESTE DO BDR DATA SERVICE ATUALIZADO
 * 
 * Testa se o BDRDataService atualizado com o mapeamento correto funciona
 */

import { BDRDataService } from '../src/lib/bdr-data-service';
import { prisma } from '../src/lib/prisma';

async function testUpdatedBDRService() {
  console.log('🧪 TESTE DO BDR DATA SERVICE ATUALIZADO\n');

  try {
    // Testar com AMZO34.SA (Amazon)
    const ticker = 'AMZO34.SA';
    console.log(`🔄 Testando processamento completo de ${ticker}...`);
    
    const success = await BDRDataService.processBDR(ticker, true);
    
    if (success) {
      console.log(`✅ ${ticker} processado com sucesso!`);
      
      // Verificar dados salvos no banco
      console.log('\n📊 VERIFICANDO DADOS SALVOS NO BANCO:');
      
      const company = await prisma.company.findUnique({
        where: { ticker: 'AMZO34' }
      });
      
      if (company) {
        console.log(`🏢 Empresa: ${company.name} (ID: ${company.id})`);
        
        // Verificar Financial Data
        const financialData = await prisma.financialData.findMany({
          where: { companyId: company.id },
          orderBy: { year: 'desc' },
          take: 5
        });
        
        console.log(`\n📈 FINANCIAL DATA (${financialData.length} registros):`);
        financialData.forEach(fd => {
          console.log(`   ${fd.year}: receita=${fd.receitaTotal}, lucro=${fd.lucroLiquido}, roic=${fd.roic}`);
        });
        
        // Verificar Balance Sheets
        const balanceSheets = await prisma.balanceSheet.findMany({
          where: { companyId: company.id },
          orderBy: { endDate: 'desc' },
          take: 3
        });
        
        console.log(`\n🏦 BALANCE SHEETS (${balanceSheets.length} registros):`);
        balanceSheets.forEach(bs => {
          console.log(`   ${bs.endDate.toISOString().split('T')[0]}: totalAssets=${bs.totalAssets}, equity=${bs.totalStockholderEquity}`);
        });
        
        // Verificar Cashflow Statements
        const cashflowStatements = await prisma.cashflowStatement.findMany({
          where: { companyId: company.id },
          orderBy: { endDate: 'desc' },
          take: 3
        });
        
        console.log(`\n💰 CASHFLOW STATEMENTS (${cashflowStatements.length} registros):`);
        cashflowStatements.forEach(cf => {
          console.log(`   ${cf.endDate.toISOString().split('T')[0]}: operatingCF=${cf.operatingCashFlow}, investmentCF=${cf.investmentCashFlow}`);
        });
        
        // Verificar Key Statistics
        const keyStatistics = await prisma.keyStatistics.findMany({
          where: { companyId: company.id },
          orderBy: { endDate: 'desc' },
          take: 2
        });
        
        console.log(`\n📊 KEY STATISTICS (${keyStatistics.length} registros):`);
        keyStatistics.forEach(ks => {
          console.log(`   ${ks.endDate.toISOString().split('T')[0]}: enterpriseValue=${ks.enterpriseValue}, bookValue=${ks.bookValue}`);
        });
        
      } else {
        console.log('❌ Empresa não encontrada no banco');
      }
      
    } else {
      console.log(`❌ Falha ao processar ${ticker}`);
    }

  } catch (error: any) {
    console.error('❌ Erro no teste:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar teste
testUpdatedBDRService().catch(console.error);