/**
 * Script para debugar a lógica do P/L histórico
 * Compara o comportamento com e sem excludeUnprofitable
 */

import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { toNumber } from '../src/lib/strategies';

dotenv.config();

const prisma = new PrismaClient();

async function debugLogic() {
  try {
    console.log('🔍 Debugando lógica do P/L histórico');
    console.log('='.repeat(80));

    const month = new Date(2025, 10, 1); // Novembro 2025
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    console.log(`\n📅 Analisando mês: ${month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`);
    console.log(`   Período: ${monthStart.toISOString().split('T')[0]} até ${monthEnd.toISOString().split('T')[0]}`);

    // Buscar todas as empresas
    const companies = await prisma.company.findMany({
      select: { id: true, ticker: true },
    });

    const companyIds = companies.map((c) => c.id);
    console.log(`\n📊 Total de empresas no banco: ${companyIds.length}`);

    // Buscar preços mensais (último dia útil do mês)
    const historicalPrices = await prisma.historicalPrice.findMany({
      where: {
        companyId: { in: companyIds },
        interval: '1mo',
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        companyId: true,
        date: true,
        close: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    console.log(`   Preços históricos encontrados: ${historicalPrices.length}`);

    // Agrupar por companyId e pegar o último preço do mês
    const pricesByCompany = new Map<number, { date: Date; price: number }>();
    for (const price of historicalPrices) {
      if (!pricesByCompany.has(price.companyId)) {
        const priceValue = toNumber(price.close);
        if (priceValue !== null && priceValue > 0 && isFinite(priceValue)) {
          pricesByCompany.set(price.companyId, {
            date: price.date,
            price: priceValue,
          });
        }
      }
    }

    console.log(`   Empresas com preço válido: ${pricesByCompany.size}`);

    // Buscar dados financeiros mais recentes até o mês atual
    const financialData = await prisma.financialData.findMany({
      where: {
        companyId: { in: Array.from(pricesByCompany.keys()) },
        year: { lte: month.getFullYear() },
      },
      select: {
        companyId: true,
        year: true,
        pl: true,
        lpa: true,
        lucroLiquido: true,
        marketCap: true,
      },
      orderBy: [
        { companyId: 'asc' },
        { year: 'desc' },
      ],
    });

    console.log(`   Registros financeiros encontrados: ${financialData.length}`);

    // TESTE 1: SEM filtro excludeUnprofitable
    console.log(`\n📊 TESTE 1: SEM filtro excludeUnprofitable`);
    
    // Agrupar por companyId e pegar o mais recente
    const latestFinancialByCompany1 = new Map<number, typeof financialData[0]>();
    for (const financial of financialData) {
      if (!latestFinancialByCompany1.has(financial.companyId)) {
        latestFinancialByCompany1.set(financial.companyId, financial);
      }
    }

    console.log(`   Empresas com dados financeiros: ${latestFinancialByCompany1.size}`);

    let validCompanies1 = 0;
    let invalidCompanies1 = 0;
    const invalidReasons1 = new Map<string, number>();

    for (const [companyId, priceData] of pricesByCompany.entries()) {
      const financial = latestFinancialByCompany1.get(companyId);
      if (!financial) {
        invalidCompanies1++;
        invalidReasons1.set('Sem dados financeiros', (invalidReasons1.get('Sem dados financeiros') || 0) + 1);
        continue;
      }

      // Calcular P/L
      let pl: number | null = null;
      const financialPL = financial.pl ? toNumber(financial.pl) : null;
      if (financialPL !== null && financialPL > 0) {
        pl = financialPL;
      } else {
        const financialLPA = financial.lpa ? toNumber(financial.lpa) : null;
        if (financialLPA !== null && financialLPA > 0 && priceData.price > 0) {
          pl = priceData.price / financialLPA;
        }
      }

      // Filtrar outliers
      if (!pl || pl <= 0 || !isFinite(pl) || pl > 100 || pl < -100) {
        invalidCompanies1++;
        invalidReasons1.set('P/L inválido', (invalidReasons1.get('P/L inválido') || 0) + 1);
        continue;
      }

      const marketCap = financial.marketCap ? toNumber(financial.marketCap) : null;
      if (!marketCap || marketCap <= 0) {
        invalidCompanies1++;
        invalidReasons1.set('Market cap inválido', (invalidReasons1.get('Market cap inválido') || 0) + 1);
        continue;
      }

      validCompanies1++;
    }

    console.log(`   ✅ Empresas válidas: ${validCompanies1}`);
    console.log(`   ❌ Empresas inválidas: ${invalidCompanies1}`);
    console.log(`   Razões de invalidade:`);
    for (const [reason, count] of invalidReasons1.entries()) {
      console.log(`      - ${reason}: ${count}`);
    }

    // TESTE 2: COM filtro excludeUnprofitable
    console.log(`\n📊 TESTE 2: COM filtro excludeUnprofitable`);

    // Agrupar por companyId e pegar o mais recente
    const latestFinancialByCompany2 = new Map<number, typeof financialData[0]>();
    for (const financial of financialData) {
      if (!latestFinancialByCompany2.has(financial.companyId)) {
        latestFinancialByCompany2.set(financial.companyId, financial);
      }
    }

    // Aplicar filtro de lucratividade DEPOIS de pegar o mais recente
    if (true) { // excludeUnprofitable = true
      for (const [companyId, financial] of latestFinancialByCompany2.entries()) {
        const lucroLiquido = financial.lucroLiquido ? toNumber(financial.lucroLiquido) : null;
        if (lucroLiquido === null || lucroLiquido <= 0) {
          latestFinancialByCompany2.delete(companyId);
        }
      }
    }

    console.log(`   Empresas com dados financeiros (após filtro): ${latestFinancialByCompany2.size}`);

    let validCompanies2 = 0;
    let invalidCompanies2 = 0;
    const invalidReasons2 = new Map<string, number>();
    const excludedByProfitability = new Set<number>();

    for (const [companyId, priceData] of pricesByCompany.entries()) {
      const financial = latestFinancialByCompany2.get(companyId);
      if (!financial) {
        // Verificar se foi excluído por lucratividade ou falta de dados
        const originalFinancial = latestFinancialByCompany1.get(companyId);
        if (originalFinancial) {
          const lucroLiquido = originalFinancial.lucroLiquido ? toNumber(originalFinancial.lucroLiquido) : null;
          if (lucroLiquido === null || lucroLiquido <= 0) {
            excludedByProfitability.add(companyId);
            continue; // Excluído por lucratividade
          }
        }
        invalidCompanies2++;
        invalidReasons2.set('Sem dados financeiros', (invalidReasons2.get('Sem dados financeiros') || 0) + 1);
        continue;
      }

      // Calcular P/L
      let pl: number | null = null;
      const financialPL = financial.pl ? toNumber(financial.pl) : null;
      if (financialPL !== null && financialPL > 0) {
        pl = financialPL;
      } else {
        const financialLPA = financial.lpa ? toNumber(financial.lpa) : null;
        if (financialLPA !== null && financialLPA > 0 && priceData.price > 0) {
          pl = priceData.price / financialLPA;
        }
      }

      // Filtrar outliers
      if (!pl || pl <= 0 || !isFinite(pl) || pl > 100 || pl < -100) {
        invalidCompanies2++;
        invalidReasons2.set('P/L inválido', (invalidReasons2.get('P/L inválido') || 0) + 1);
        continue;
      }

      const marketCap = financial.marketCap ? toNumber(financial.marketCap) : null;
      if (!marketCap || marketCap <= 0) {
        invalidCompanies2++;
        invalidReasons2.set('Market cap inválido', (invalidReasons2.get('Market cap inválido') || 0) + 1);
        continue;
      }

      validCompanies2++;
    }

    console.log(`   ✅ Empresas válidas: ${validCompanies2}`);
    console.log(`   ❌ Empresas inválidas: ${invalidCompanies2}`);
    console.log(`   🚫 Empresas excluídas por lucratividade: ${excludedByProfitability.size}`);
    console.log(`   Razões de invalidade:`);
    for (const [reason, count] of invalidReasons2.entries()) {
      console.log(`      - ${reason}: ${count}`);
    }

    // Comparação
    console.log(`\n📊 COMPARAÇÃO:`);
    console.log(`   SEM filtro: ${validCompanies1} empresas válidas`);
    console.log(`   COM filtro: ${validCompanies2} empresas válidas`);
    console.log(`   Diferença: ${validCompanies2 - validCompanies1} empresas`);
    
    if (validCompanies2 > validCompanies1) {
      console.log(`\n   ⚠️  PROBLEMA: Com filtro temos MAIS empresas! Isso não deveria acontecer.`);
      
      // Encontrar empresas que aparecem no teste 2 mas não no teste 1
      const companiesInTest1 = new Set<number>();
      const companiesInTest2 = new Set<number>();
      
      // Recalcular para identificar diferenças
      for (const [companyId, priceData] of pricesByCompany.entries()) {
        const financial1 = latestFinancialByCompany1.get(companyId);
        if (financial1) {
          let pl1: number | null = null;
          const financialPL1 = financial1.pl ? toNumber(financial1.pl) : null;
          if (financialPL1 !== null && financialPL1 > 0) {
            pl1 = financialPL1;
          } else {
            const financialLPA1 = financial1.lpa ? toNumber(financial1.lpa) : null;
            if (financialLPA1 !== null && financialLPA1 > 0 && priceData.price > 0) {
              pl1 = priceData.price / financialLPA1;
            }
          }
          const marketCap1 = financial1.marketCap ? toNumber(financial1.marketCap) : null;
          if (pl1 && pl1 > 0 && pl1 <= 100 && pl1 >= -100 && marketCap1 && marketCap1 > 0) {
            companiesInTest1.add(companyId);
          }
        }
        
        const financial2 = latestFinancialByCompany2.get(companyId);
        if (financial2) {
          let pl2: number | null = null;
          const financialPL2 = financial2.pl ? toNumber(financial2.pl) : null;
          if (financialPL2 !== null && financialPL2 > 0) {
            pl2 = financialPL2;
          } else {
            const financialLPA2 = financial2.lpa ? toNumber(financial2.lpa) : null;
            if (financialLPA2 !== null && financialLPA2 > 0 && priceData.price > 0) {
              pl2 = priceData.price / financialLPA2;
            }
          }
          const marketCap2 = financial2.marketCap ? toNumber(financial2.marketCap) : null;
          if (pl2 && pl2 > 0 && pl2 <= 100 && pl2 >= -100 && marketCap2 && marketCap2 > 0) {
            companiesInTest2.add(companyId);
          }
        }
      }
      
      const onlyInTest2 = Array.from(companiesInTest2).filter(id => !companiesInTest1.has(id));
      const onlyInTest1 = Array.from(companiesInTest1).filter(id => !companiesInTest2.has(id));
      
      console.log(`\n   Empresas apenas no TESTE 2 (COM filtro): ${onlyInTest2.length}`);
      if (onlyInTest2.length > 0 && onlyInTest2.length <= 50) {
        for (const companyId of onlyInTest2.slice(0, 10)) {
          const company = companies.find(c => c.id === companyId);
          const financial1 = latestFinancialByCompany1.get(companyId);
          const financial2 = latestFinancialByCompany2.get(companyId);
          console.log(`      ${company?.ticker || companyId}:`);
          console.log(`         Teste 1 - Ano: ${financial1?.year}, Lucro: ${financial1?.lucroLiquido ? toNumber(financial1.lucroLiquido) : 'N/A'}`);
          console.log(`         Teste 2 - Ano: ${financial2?.year}, Lucro: ${financial2?.lucroLiquido ? toNumber(financial2.lucroLiquido) : 'N/A'}`);
        }
      }
      
      console.log(`\n   Empresas apenas no TESTE 1 (SEM filtro): ${onlyInTest1.length}`);
    } else {
      console.log(`   ✅ OK: Com filtro temos MENOS ou IGUAL número de empresas.`);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

debugLogic()
  .then(() => {
    console.log('\n✅ Debug concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

