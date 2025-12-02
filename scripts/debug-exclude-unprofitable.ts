/**
 * Script para investigar por que o número de empresas aumenta quando excludeUnprofitable = true
 */

import * as dotenv from 'dotenv';
import { backgroundPrisma } from './prisma-background';
import { toNumber } from '../src/lib/strategies';

// Carregar variáveis de ambiente
dotenv.config();

async function debugExcludeUnprofitable() {
  try {
    console.log('🔍 Investigando filtro excludeUnprofitable');
    console.log('='.repeat(80));

    const targetMonth = new Date(2025, 10, 1); // Novembro 2025
    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

    console.log(`\n📅 Analisando mês: ${targetMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`);
    console.log(`   Período: ${monthStart.toISOString().split('T')[0]} até ${monthEnd.toISOString().split('T')[0]}`);

    // Buscar todas as empresas STOCK
    const companies = await backgroundPrisma.company.findMany({
      where: {
        assetType: 'STOCK',
      },
      select: {
        id: true,
        ticker: true,
        name: true,
      },
    });

    const companyIds = companies.map(c => c.id);
    console.log(`\n📊 Total de empresas STOCK: ${companies.length}`);

    // Buscar preços mensais
    const historicalPrices = await backgroundPrisma.historicalPrice.findMany({
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

    // TESTE 1: Buscar dados financeiros SEM filtro excludeUnprofitable
    console.log(`\n📊 TESTE 1: Buscar dados financeiros SEM filtro excludeUnprofitable`);
    const financialDataWithoutFilter = await backgroundPrisma.financialData.findMany({
      where: {
        companyId: { in: Array.from(pricesByCompany.keys()) },
        year: { lte: targetMonth.getFullYear() },
      },
      select: {
        companyId: true,
        year: true,
        pl: true,
        lpa: true,
        lucroLiquido: true,
        marketCap: true,
      },
      orderBy: {
        year: 'desc',
      },
    });

    console.log(`   Total de registros financeiros encontrados: ${financialDataWithoutFilter.length}`);

    // Agrupar por companyId e pegar o mais recente
    const latestFinancialWithoutFilter = new Map<number, typeof financialDataWithoutFilter[0]>();
    for (const financial of financialDataWithoutFilter) {
      if (!latestFinancialWithoutFilter.has(financial.companyId) && financial) {
        latestFinancialWithoutFilter.set(financial.companyId, financial);
      }
    }

    console.log(`   Empresas com dados financeiros (último registro): ${latestFinancialWithoutFilter.size}`);

    // Contar empresas com lucro positivo, negativo e NULL
    let companiesWithPositiveProfit = 0;
    let companiesWithNegativeProfit = 0;
    let companiesWithNullProfit = 0;
    let companiesWithValidPL = 0;
    let companiesWithValidMarketCap = 0;
    let companiesWithBothValid = 0;

    for (const [companyId, financial] of latestFinancialWithoutFilter.entries()) {
      const lucroLiquido = financial.lucroLiquido ? toNumber(financial.lucroLiquido) : null;
      
      if (lucroLiquido === null) {
        companiesWithNullProfit++;
      } else if (lucroLiquido > 0) {
        companiesWithPositiveProfit++;
      } else {
        companiesWithNegativeProfit++;
      }

      // Verificar se tem P/L válido
      const pl = financial.pl ? toNumber(financial.pl) : null;
      if (!pl) {
        const lpa = financial.lpa ? toNumber(financial.lpa) : null;
        const priceData = pricesByCompany.get(companyId);
        if (lpa && lpa > 0 && priceData && priceData.price > 0) {
          const calculatedPL = priceData.price / lpa;
          if (calculatedPL > 0 && calculatedPL <= 100 && calculatedPL >= -100 && isFinite(calculatedPL)) {
            companiesWithValidPL++;
          }
        }
      } else if (pl > 0 && pl <= 100 && pl >= -100 && isFinite(pl)) {
        companiesWithValidPL++;
      }

      // Verificar se tem market cap válido
      const marketCap = financial.marketCap ? toNumber(financial.marketCap) : null;
      if (marketCap && marketCap > 0) {
        companiesWithValidMarketCap++;
      }

      // Verificar se tem ambos válidos
      const hasValidPL = (pl && pl > 0 && pl <= 100 && pl >= -100 && isFinite(pl)) || 
                        (financial.lpa && toNumber(financial.lpa) && toNumber(financial.lpa)! > 0 && pricesByCompany.has(companyId));
      const hasValidMarketCap = marketCap && marketCap > 0;
      if (hasValidPL && hasValidMarketCap) {
        companiesWithBothValid++;
      }
    }

    console.log(`\n   📈 Distribuição de lucro líquido:`);
    console.log(`      Lucro positivo: ${companiesWithPositiveProfit}`);
    console.log(`      Lucro negativo: ${companiesWithNegativeProfit}`);
    console.log(`      Lucro NULL: ${companiesWithNullProfit}`);
    console.log(`\n   ✅ Empresas com P/L válido: ${companiesWithValidPL}`);
    console.log(`   ✅ Empresas com Market Cap válido: ${companiesWithValidMarketCap}`);
    console.log(`   ✅ Empresas com AMBOS válidos: ${companiesWithBothValid}`);

    // TESTE 2: Buscar dados financeiros COM filtro excludeUnprofitable
    console.log(`\n📊 TESTE 2: Buscar dados financeiros COM filtro excludeUnprofitable (lucroLiquido > 0)`);
    const financialDataWithFilter = await backgroundPrisma.financialData.findMany({
      where: {
        companyId: { in: Array.from(pricesByCompany.keys()) },
        year: { lte: targetMonth.getFullYear() },
        lucroLiquido: { gt: 0 },
      },
      select: {
        companyId: true,
        year: true,
        pl: true,
        lpa: true,
        lucroLiquido: true,
        marketCap: true,
      },
      orderBy: {
        year: 'desc',
      },
    });

    console.log(`   Total de registros financeiros encontrados: ${financialDataWithFilter.length}`);

    // Agrupar por companyId e pegar o mais recente
    const latestFinancialWithFilter = new Map<number, typeof financialDataWithFilter[0]>();
    for (const financial of financialDataWithFilter) {
      if (!latestFinancialWithFilter.has(financial.companyId) && financial) {
        latestFinancialWithFilter.set(financial.companyId, financial);
      }
    }

    console.log(`   Empresas com dados financeiros (último registro com lucro > 0): ${latestFinancialWithFilter.size}`);

    // Contar empresas válidas com o filtro
    let companiesWithFilterValidPL = 0;
    let companiesWithFilterValidMarketCap = 0;
    let companiesWithFilterBothValid = 0;

    for (const [companyId, financial] of latestFinancialWithFilter.entries()) {
      // Verificar se tem P/L válido
      const pl = financial.pl ? toNumber(financial.pl) : null;
      if (!pl) {
        const lpa = financial.lpa ? toNumber(financial.lpa) : null;
        const priceData = pricesByCompany.get(companyId);
        if (lpa && lpa > 0 && priceData && priceData.price > 0) {
          const calculatedPL = priceData.price / lpa;
          if (calculatedPL > 0 && calculatedPL <= 100 && calculatedPL >= -100 && isFinite(calculatedPL)) {
            companiesWithFilterValidPL++;
          }
        }
      } else if (pl > 0 && pl <= 100 && pl >= -100 && isFinite(pl)) {
        companiesWithFilterValidPL++;
      }

      // Verificar se tem market cap válido
      const marketCap = financial.marketCap ? toNumber(financial.marketCap) : null;
      if (marketCap && marketCap > 0) {
        companiesWithFilterValidMarketCap++;
      }

      // Verificar se tem ambos válidos
      const hasValidPL = (pl && pl > 0 && pl <= 100 && pl >= -100 && isFinite(pl)) || 
                        (financial.lpa && toNumber(financial.lpa) && toNumber(financial.lpa)! > 0 && pricesByCompany.has(companyId));
      const hasValidMarketCap = marketCap && marketCap > 0;
      if (hasValidPL && hasValidMarketCap) {
        companiesWithFilterBothValid++;
      }
    }

    console.log(`\n   ✅ Empresas com P/L válido: ${companiesWithFilterValidPL}`);
    console.log(`   ✅ Empresas com Market Cap válido: ${companiesWithFilterValidMarketCap}`);
    console.log(`   ✅ Empresas com AMBOS válidos: ${companiesWithFilterBothValid}`);

    // Comparar empresas que aparecem em um mas não no outro
    const companiesOnlyWithoutFilter = new Set<number>();
    const companiesOnlyWithFilter = new Set<number>();

    for (const companyId of latestFinancialWithoutFilter.keys()) {
      if (!latestFinancialWithFilter.has(companyId)) {
        companiesOnlyWithoutFilter.add(companyId);
      }
    }

    for (const companyId of latestFinancialWithFilter.keys()) {
      if (!latestFinancialWithoutFilter.has(companyId)) {
        companiesOnlyWithFilter.add(companyId);
      }
    }

    console.log(`\n🔍 ANÁLISE COMPARATIVA:`);
    console.log(`   Empresas apenas SEM filtro: ${companiesOnlyWithoutFilter.size}`);
    console.log(`   Empresas apenas COM filtro: ${companiesOnlyWithFilter.size}`);

    if (companiesOnlyWithFilter.size > 0) {
      console.log(`\n   ⚠️  Empresas que aparecem COM filtro mas não SEM filtro (${companiesOnlyWithFilter.size}):`);
      const companiesMap = new Map(companies.map(c => [c.id, c]));
      Array.from(companiesOnlyWithFilter).slice(0, 20).forEach((companyId, idx) => {
        const company = companiesMap.get(companyId);
        const financial = latestFinancialWithFilter.get(companyId);
        const lucroLiquido = financial?.lucroLiquido ? toNumber(financial.lucroLiquido) : null;
        console.log(`      ${idx + 1}. ${company?.ticker.padEnd(10)} | Lucro: ${lucroLiquido ? `R$ ${(lucroLiquido / 1_000_000).toFixed(2)}M` : 'N/A'}`);
      });
    }

    // Verificar se há empresas que têm múltiplos registros financeiros
    console.log(`\n🔍 Verificando empresas com múltiplos registros financeiros:`);
    const companiesWithMultipleRecords = new Map<number, typeof financialDataWithoutFilter>();
    
    for (const financial of financialDataWithoutFilter) {
      if (!companiesWithMultipleRecords.has(financial.companyId)) {
        companiesWithMultipleRecords.set(financial.companyId, []);
      }
      companiesWithMultipleRecords.get(financial.companyId)!.push(financial);
    }

    const companiesWithMultiple = Array.from(companiesWithMultipleRecords.entries())
      .filter(([_, records]) => records.length > 1)
      .slice(0, 10);

    if (companiesWithMultiple.length > 0) {
      console.log(`\n   Exemplos de empresas com múltiplos registros:`);
      const companiesMap = new Map(companies.map(c => [c.id, c]));
      companiesWithMultiple.forEach(([companyId, records]) => {
        const company = companiesMap.get(companyId);
        console.log(`\n   ${company?.ticker}:`);
        records.slice(0, 3).forEach(record => {
          const lucro = record.lucroLiquido ? toNumber(record.lucroLiquido) : null;
          console.log(`      Ano ${record.year}: Lucro ${lucro ? (lucro > 0 ? '+' : '') + (lucro / 1_000_000).toFixed(2) + 'M' : 'NULL'}`);
        });
      });
    }

  } catch (error) {
    console.error('❌ Erro durante investigação:', error);
    throw error;
  } finally {
    await backgroundPrisma.$disconnect();
  }
}

debugExcludeUnprofitable()
  .then(() => {
    console.log('\n✅ Investigação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

