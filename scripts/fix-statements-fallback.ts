#!/usr/bin/env npx tsx

/**
 * CORREÇÃO DO FALLBACK PARA DEMONSTRAÇÕES VAZIAS
 */

import { prisma } from '../src/lib/prisma';

async function checkStatementsData() {
  console.log('🔍 VERIFICANDO DADOS DAS DEMONSTRAÇÕES FINANCEIRAS\n');

  try {
    // Buscar Amazon
    const company = await prisma.company.findFirst({
      where: { ticker: 'AMZO34' },
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 3
        },
        incomeStatements: {
          orderBy: { endDate: 'desc' },
          take: 3
        },
        balanceSheets: {
          orderBy: { endDate: 'desc' },
          take: 3
        },
        cashflowStatements: {
          orderBy: { endDate: 'desc' },
          take: 3
        }
      }
    });

    if (!company) {
      console.log('❌ Amazon não encontrada');
      return;
    }

    console.log(`📊 Verificando dados para: ${company.name} (${company.ticker})\n`);

    // Verificar demonstrações financeiras
    console.log('📋 DEMONSTRAÇÕES FINANCEIRAS:');
    console.log(`   Income Statements: ${company.incomeStatements.length} registros`);
    console.log(`   Balance Sheets: ${company.balanceSheets.length} registros`);
    console.log(`   Cashflow Statements: ${company.cashflowStatements.length} registros`);

    // Verificar se têm dados válidos
    let hasValidIncomeData = false;
    let hasValidBalanceData = false;

    if (company.incomeStatements.length > 0) {
      const latestIncome = company.incomeStatements[0];
      const revenue = latestIncome.totalRevenue ? Number(latestIncome.totalRevenue) : 0;
      const netIncome = latestIncome.netIncome ? Number(latestIncome.netIncome) : 0;
      
      console.log(`\n📊 INCOME STATEMENT MAIS RECENTE (${latestIncome.endDate?.toISOString().split('T')[0]}):`);
      console.log(`   Total Revenue: ${revenue > 0 ? (revenue / 1e9).toFixed(2) + 'B' : 'ZERO/NULL'}`);
      console.log(`   Net Income: ${netIncome !== 0 ? (netIncome / 1e9).toFixed(2) + 'B' : 'ZERO/NULL'}`);
      
      hasValidIncomeData = revenue > 0 || netIncome !== 0;
    }

    if (company.balanceSheets.length > 0) {
      const latestBalance = company.balanceSheets[0];
      const totalAssets = latestBalance.totalAssets ? Number(latestBalance.totalAssets) : 0;
      const currentAssets = latestBalance.totalCurrentAssets ? Number(latestBalance.totalCurrentAssets) : 0;
      const currentLiabilities = latestBalance.totalCurrentLiabilities ? Number(latestBalance.totalCurrentLiabilities) : 0;
      
      console.log(`\n📊 BALANCE SHEET MAIS RECENTE (${latestBalance.endDate?.toISOString().split('T')[0]}):`);
      console.log(`   Total Assets: ${totalAssets > 0 ? (totalAssets / 1e9).toFixed(2) + 'B' : 'ZERO/NULL'}`);
      console.log(`   Current Assets: ${currentAssets > 0 ? (currentAssets / 1e9).toFixed(2) + 'B' : 'ZERO/NULL'}`);
      console.log(`   Current Liabilities: ${currentLiabilities > 0 ? (currentLiabilities / 1e9).toFixed(2) + 'B' : 'ZERO/NULL'}`);
      
      hasValidBalanceData = totalAssets > 0 || currentAssets > 0 || currentLiabilities > 0;
    }

    console.log(`\n🔍 VALIDAÇÃO DOS DADOS:`);
    console.log(`   Income Statements válidos: ${hasValidIncomeData ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   Balance Sheets válidos: ${hasValidBalanceData ? '✅ SIM' : '❌ NÃO'}`);

    // Verificar financial_data
    console.log(`\n📊 FINANCIAL DATA (${company.financialData.length} registros):`);
    if (company.financialData.length > 0) {
      const latestFD = company.financialData[0];
      console.log(`   Ano: ${latestFD.year}`);
      console.log(`   ROE: ${latestFD.roe ? (Number(latestFD.roe) * 100).toFixed(1) + '%' : 'NULL'}`);
      console.log(`   Margem Líquida: ${latestFD.margemLiquida ? (Number(latestFD.margemLiquida) * 100).toFixed(1) + '%' : 'NULL'}`);
      console.log(`   Liquidez Corrente: ${latestFD.liquidezCorrente ? Number(latestFD.liquidezCorrente).toFixed(2) + 'x' : 'NULL'}`);
      console.log(`   Margem EBITDA: ${latestFD.margemEbitda ? (Number(latestFD.margemEbitda) * 100).toFixed(1) + '%' : 'NULL'}`);
      console.log(`   Ativo Circulante: ${latestFD.ativoCirculante ? (Number(latestFD.ativoCirculante) / 1e9).toFixed(2) + 'B' : 'NULL'}`);
      console.log(`   Passivo Circulante: ${latestFD.passivoCirculante ? (Number(latestFD.passivoCirculante) / 1e9).toFixed(2) + 'B' : 'NULL'}`);
      console.log(`   Ativo Total: ${latestFD.ativoTotal ? (Number(latestFD.ativoTotal) / 1e9).toFixed(2) + 'B' : 'NULL'}`);
    }

    // Conclusão
    console.log(`\n📝 CONCLUSÃO:`);
    if (!hasValidIncomeData && !hasValidBalanceData) {
      console.log(`   🚨 PROBLEMA CRÍTICO: Demonstrações financeiras estão VAZIAS`);
      console.log(`   📋 SOLUÇÃO: Sistema deve usar APENAS financial_data para cálculos`);
      console.log(`   ⚠️ IMPACTO: Alertas incorretos sendo gerados por dados zerados`);
    } else {
      console.log(`   ✅ Demonstrações financeiras têm dados válidos`);
    }

    console.log(`\n🔧 RECOMENDAÇÕES:`);
    console.log(`   1. Implementar fallback completo para quando statements estão vazios`);
    console.log(`   2. Priorizar financial_data quando disponível e válido`);
    console.log(`   3. Ajustar benchmarks para empresas de tecnologia`);
    console.log(`   4. Verificar processo de importação das demonstrações`);

  } catch (error: any) {
    console.error('❌ Erro na verificação:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkStatementsData().catch(console.error);