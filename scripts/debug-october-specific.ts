/**
 * Script para debugar especificamente outubro/2025
 */

import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { toNumber } from '../src/lib/strategies';

dotenv.config();

const prisma = new PrismaClient();

async function debugOctober() {
  try {
    console.log('🔍 Debugando novembro/2025 especificamente');
    console.log('='.repeat(80));

    const month = new Date(2025, 10, 1); // Novembro 2025
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    console.log(`\n📅 Mês: ${month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`);
    console.log(`   Período: ${monthStart.toISOString().split('T')[0]} até ${monthEnd.toISOString().split('T')[0]}`);

    // Buscar empresas STOCK
    const companies = await prisma.company.findMany({
      where: {
        assetType: 'STOCK',
      },
      select: { id: true, ticker: true },
    });

    const companyIds = companies.map((c) => c.id);
    console.log(`\n📊 Total de empresas STOCK: ${companyIds.length}`);

    // Buscar preços mensais
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

    // Buscar dados financeiros (MESMA LÓGICA DO CÓDIGO REAL)
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
      orderBy: {
        year: 'desc',
      },
    });

    console.log(`   Registros financeiros encontrados: ${financialData.length}`);

    // TESTE 1: SEM filtro (mesma lógica do código)
    console.log(`\n📊 TESTE 1: SEM filtro excludeUnprofitable`);
    
    const latestFinancialByCompany1 = new Map<number, typeof financialData[0]>();
    for (const financial of financialData) {
      if (!latestFinancialByCompany1.has(financial.companyId)) {
        latestFinancialByCompany1.set(financial.companyId, financial);
      }
    }

    console.log(`   Empresas com dados financeiros: ${latestFinancialByCompany1.size}`);

    let validCompanies1 = 0;
    const companiesDetails1 = new Map<number, { ticker: string; year: number; lucro: number | null; pl: number | null }>();

    for (const [companyId, priceData] of pricesByCompany.entries()) {
      const financial = latestFinancialByCompany1.get(companyId);
      if (!financial) {
        continue;
      }

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

      if (!pl || pl <= 0 || !isFinite(pl) || pl > 100 || pl < -100) {
        continue;
      }

      const marketCap = financial.marketCap ? toNumber(financial.marketCap) : null;
      if (!marketCap || marketCap <= 0) {
        continue;
      }

      validCompanies1++;
      const company = companies.find(c => c.id === companyId);
      companiesDetails1.set(companyId, {
        ticker: company?.ticker || 'UNKNOWN',
        year: financial.year,
        lucro: financial.lucroLiquido ? toNumber(financial.lucroLiquido) : null,
        pl,
      });
    }

    console.log(`   ✅ Empresas válidas: ${validCompanies1}`);

    // TESTE 2: COM filtro (mesma lógica do código)
    console.log(`\n📊 TESTE 2: COM filtro excludeUnprofitable`);
    
    const latestFinancialByCompany2 = new Map<number, typeof financialData[0]>();
    for (const financial of financialData) {
      if (!latestFinancialByCompany2.has(financial.companyId)) {
        latestFinancialByCompany2.set(financial.companyId, financial);
      }
    }

    // Aplicar filtro de lucratividade DEPOIS de pegar o mais recente
    for (const [companyId, financial] of latestFinancialByCompany2.entries()) {
      const lucroLiquido = financial.lucroLiquido ? toNumber(financial.lucroLiquido) : null;
      if (lucroLiquido === null || lucroLiquido <= 0) {
        latestFinancialByCompany2.delete(companyId);
      }
    }

    console.log(`   Empresas com dados financeiros (após filtro): ${latestFinancialByCompany2.size}`);

    let validCompanies2 = 0;
    const companiesDetails2 = new Map<number, { ticker: string; year: number; lucro: number | null; pl: number | null }>();

    for (const [companyId, priceData] of pricesByCompany.entries()) {
      const financial = latestFinancialByCompany2.get(companyId);
      if (!financial) {
        continue;
      }

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

      if (!pl || pl <= 0 || !isFinite(pl) || pl > 100 || pl < -100) {
        continue;
      }

      const marketCap = financial.marketCap ? toNumber(financial.marketCap) : null;
      if (!marketCap || marketCap <= 0) {
        continue;
      }

      validCompanies2++;
      const company = companies.find(c => c.id === companyId);
      companiesDetails2.set(companyId, {
        ticker: company?.ticker || 'UNKNOWN',
        year: financial.year,
        lucro: financial.lucroLiquido ? toNumber(financial.lucroLiquido) : null,
        pl,
      });
    }

    console.log(`   ✅ Empresas válidas: ${validCompanies2}`);

    // Comparação detalhada
    console.log(`\n📊 COMPARAÇÃO DETALHADA:`);
    console.log(`   SEM filtro: ${validCompanies1} empresas`);
    console.log(`   COM filtro: ${validCompanies2} empresas`);
    console.log(`   Diferença: ${validCompanies2 - validCompanies1} empresas`);

    // Encontrar empresas que aparecem em um mas não no outro
    const onlyInTest1 = Array.from(companiesDetails1.keys()).filter(id => !companiesDetails2.has(id));
    const onlyInTest2 = Array.from(companiesDetails2.keys()).filter(id => !companiesDetails1.has(id));

    console.log(`\n   Empresas apenas no TESTE 1 (SEM filtro): ${onlyInTest1.length}`);
    if (onlyInTest1.length > 0 && onlyInTest1.length <= 30) {
      for (const companyId of onlyInTest1.slice(0, 10)) {
        const details = companiesDetails1.get(companyId)!;
        console.log(`      ${details.ticker}: Ano ${details.year}, Lucro: ${details.lucro?.toFixed(2) || 'N/A'}, P/L: ${details.pl?.toFixed(2) || 'N/A'}`);
      }
    }

    console.log(`\n   Empresas apenas no TESTE 2 (COM filtro): ${onlyInTest2.length}`);
    if (onlyInTest2.length > 0 && onlyInTest2.length <= 30) {
      for (const companyId of onlyInTest2.slice(0, 10)) {
        const details = companiesDetails2.get(companyId)!;
        const originalFinancial = latestFinancialByCompany1.get(companyId);
        console.log(`      ${details.ticker}: Ano ${details.year}, Lucro: ${details.lucro?.toFixed(2) || 'N/A'}, P/L: ${details.pl?.toFixed(2) || 'N/A'}`);
        if (originalFinancial) {
          const originalLucro = originalFinancial.lucroLiquido ? toNumber(originalFinancial.lucroLiquido) : null;
          console.log(`         (Original: Ano ${originalFinancial.year}, Lucro: ${originalLucro?.toFixed(2) || 'N/A'})`);
        }
      }
    }

    // Verificar se há empresas usando anos diferentes
    const differentYears = new Map<number, { ticker: string; year1: number; year2: number; lucro1: number | null; lucro2: number | null }>();
    for (const companyId of companiesDetails1.keys()) {
      const details1 = companiesDetails1.get(companyId);
      const details2 = companiesDetails2.get(companyId);
      if (details1 && details2 && details1.year !== details2.year) {
        const company = companies.find(c => c.id === companyId);
        differentYears.set(companyId, {
          ticker: company?.ticker || 'UNKNOWN',
          year1: details1.year,
          year2: details2.year,
          lucro1: details1.lucro,
          lucro2: details2.lucro,
        });
      }
    }

    if (differentYears.size > 0) {
      console.log(`\n   ⚠️  Empresas usando anos diferentes:`);
      for (const [companyId, info] of Array.from(differentYears.entries()).slice(0, 10)) {
        console.log(`      ${info.ticker}: SEM filtro usa ${info.year1} (Lucro: ${info.lucro1?.toFixed(2) || 'N/A'}), COM filtro usa ${info.year2} (Lucro: ${info.lucro2?.toFixed(2) || 'N/A'})`);
      }
    } else {
      console.log(`\n   ✅ Todas as empresas usam o mesmo ano em ambos os testes`);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

debugOctober()
  .then(() => {
    console.log('\n✅ Debug concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

