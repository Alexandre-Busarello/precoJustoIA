/**
 * Script para entender por que o filtro de lucratividade não está funcionando
 */

import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { toNumber } from '../src/lib/strategies';

dotenv.config();

const prisma = new PrismaClient();

async function debugProfitableFilter() {
  try {
    console.log('🔍 Investigando filtro de lucratividade');
    console.log('='.repeat(80));

    const month = new Date(2025, 10, 1); // Novembro 2025
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    // Buscar empresas STOCK
    const companies = await prisma.company.findMany({
      where: { assetType: 'STOCK' },
      select: { id: true, ticker: true },
    });

    const companyIds = companies.map((c) => c.id);

    // Buscar preços mensais
    const historicalPrices = await prisma.historicalPrice.findMany({
      where: {
        companyId: { in: companyIds },
        interval: '1mo',
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { companyId: true, date: true, close: true },
      orderBy: { date: 'desc' },
    });

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

    console.log(`\n📊 Empresas com preço válido: ${pricesByCompany.size}`);

    // Buscar dados financeiros
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
      orderBy: { year: 'desc' },
    });

    // TESTE 1: SEM filtro - pegar mais recente de cada empresa
    const latestFinancialByCompany1 = new Map<number, typeof financialData[0]>();
    for (const financial of financialData) {
      if (!latestFinancialByCompany1.has(financial.companyId)) {
        latestFinancialByCompany1.set(financial.companyId, financial);
      }
    }

    console.log(`\n📊 TESTE 1: SEM filtro excludeUnprofitable`);
    console.log(`   Empresas com dados financeiros: ${latestFinancialByCompany1.size}`);

    // Contar empresas por categoria
    let validWithPL = 0;
    let invalidPL = 0;
    let invalidMarketCap = 0;
    let unprofitable = 0;
    let profitable = 0;
    let noLucroData = 0;

    const unprofitableCompanies: Array<{ ticker: string; year: number; lucro: number | null; pl: number | null; marketCap: number | null }> = [];

    for (const [companyId, priceData] of pricesByCompany.entries()) {
      const financial = latestFinancialByCompany1.get(companyId);
      if (!financial) continue;

      const lucroLiquido = financial.lucroLiquido ? toNumber(financial.lucroLiquido) : null;
      if (lucroLiquido === null) {
        noLucroData++;
      } else if (lucroLiquido <= 0) {
        unprofitable++;
        const company = companies.find(c => c.id === companyId);
        unprofitableCompanies.push({
          ticker: company?.ticker || 'UNKNOWN',
          year: financial.year,
          lucro: lucroLiquido,
          pl: financial.pl ? toNumber(financial.pl) : null,
          marketCap: financial.marketCap ? toNumber(financial.marketCap) : null,
        });
      } else {
        profitable++;
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

      if (!pl || pl <= 0 || !isFinite(pl) || pl > 100 || pl < -100) {
        invalidPL++;
        continue;
      }

      const marketCap = financial.marketCap ? toNumber(financial.marketCap) : null;
      if (!marketCap || marketCap <= 0) {
        invalidMarketCap++;
        continue;
      }

      validWithPL++;
    }

    console.log(`   ✅ Empresas válidas (P/L e Market Cap OK): ${validWithPL}`);
    console.log(`   ❌ Empresas com P/L inválido: ${invalidPL}`);
    console.log(`   ❌ Empresas com Market Cap inválido: ${invalidMarketCap}`);
    console.log(`   💰 Empresas lucrativas: ${profitable}`);
    console.log(`   💸 Empresas não lucrativas: ${unprofitable}`);
    console.log(`   ❓ Empresas sem dados de lucro: ${noLucroData}`);

    // TESTE 2: COM filtro - remover não lucrativas ANTES de calcular P/L
    console.log(`\n📊 TESTE 2: COM filtro excludeUnprofitable`);
    
    const latestFinancialByCompany2 = new Map<number, typeof financialData[0]>();
    for (const financial of financialData) {
      if (!latestFinancialByCompany2.has(financial.companyId)) {
        latestFinancialByCompany2.set(financial.companyId, financial);
      }
    }

    // Aplicar filtro de lucratividade
    let removedByProfitability = 0;
    for (const [companyId, financial] of latestFinancialByCompany2.entries()) {
      const lucroLiquido = financial.lucroLiquido ? toNumber(financial.lucroLiquido) : null;
      if (lucroLiquido === null || lucroLiquido <= 0) {
        latestFinancialByCompany2.delete(companyId);
        removedByProfitability++;
      }
    }

    console.log(`   Empresas removidas por lucratividade: ${removedByProfitability}`);
    console.log(`   Empresas restantes após filtro: ${latestFinancialByCompany2.size}`);

    let validWithPL2 = 0;
    let invalidPL2 = 0;
    let invalidMarketCap2 = 0;

    for (const [companyId, priceData] of pricesByCompany.entries()) {
      const financial = latestFinancialByCompany2.get(companyId);
      if (!financial) continue; // Já foi removido por lucratividade

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

      if (!pl || pl <= 0 || !isFinite(pl) || pl > 100 || pl < -100) {
        invalidPL2++;
        continue;
      }

      const marketCap = financial.marketCap ? toNumber(financial.marketCap) : null;
      if (!marketCap || marketCap <= 0) {
        invalidMarketCap2++;
        continue;
      }

      validWithPL2++;
    }

    console.log(`   ✅ Empresas válidas (P/L e Market Cap OK): ${validWithPL2}`);
    console.log(`   ❌ Empresas com P/L inválido: ${invalidPL2}`);
    console.log(`   ❌ Empresas com Market Cap inválido: ${invalidMarketCap2}`);

    // Comparação
    console.log(`\n📊 COMPARAÇÃO:`);
    console.log(`   SEM filtro: ${validWithPL} empresas válidas`);
    console.log(`   COM filtro: ${validWithPL2} empresas válidas`);
    console.log(`   Diferença esperada: ${unprofitable} empresas não lucrativas deveriam ser removidas`);
    console.log(`   Diferença real: ${validWithPL - validWithPL2} empresas`);

    // Verificar se empresas não lucrativas têm P/L válido
    console.log(`\n🔍 Analisando empresas não lucrativas:`);
    let unprofitableWithValidPL = 0;
    let unprofitableWithInvalidPL = 0;
    
    for (const company of unprofitableCompanies.slice(0, 20)) {
      if (company.pl !== null && company.pl > 0 && company.pl <= 100 && company.pl >= -100 && company.marketCap !== null && company.marketCap > 0) {
        unprofitableWithValidPL++;
        console.log(`   ⚠️  ${company.ticker}: Lucro negativo (${company.lucro?.toFixed(2)}M) mas tem P/L válido (${company.pl?.toFixed(2)}x) e Market Cap (${company.marketCap?.toFixed(2)}M)`);
      } else {
        unprofitableWithInvalidPL++;
      }
    }

    console.log(`\n   Empresas não lucrativas com P/L válido: ${unprofitableWithValidPL}`);
    console.log(`   Empresas não lucrativas com P/L inválido: ${unprofitableWithInvalidPL}`);

    if (unprofitableWithValidPL > 0) {
      console.log(`\n   ⚠️  PROBLEMA ENCONTRADO!`);
      console.log(`   Há ${unprofitableWithValidPL} empresas não lucrativas que têm P/L e Market Cap válidos.`);
      console.log(`   Essas empresas estão sendo contadas no TESTE 1 mas removidas no TESTE 2.`);
      console.log(`   Mas o número final é o mesmo porque outras empresas estão sendo excluídas por outros motivos.`);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

debugProfitableFilter()
  .then(() => {
    console.log('\n✅ Debug concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

