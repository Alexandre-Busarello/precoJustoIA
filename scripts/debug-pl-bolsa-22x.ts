/**
 * Script para investigar o registro com P/L de 22.55x em dezembro/2025
 * Identifica quais empresas estão sendo incluídas nesse cálculo
 */

import * as dotenv from 'dotenv';
import { backgroundPrisma } from './prisma-background';
import { toNumber } from '../src/lib/strategies';

// Carregar variáveis de ambiente
dotenv.config();

async function investigate22xPL() {
  try {
    console.log('🔍 Investigando registro com P/L de 22.55x');
    console.log('='.repeat(80));

    const targetDate = new Date(2025, 11, 1); // Dezembro 2025
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

    console.log(`\n📅 Período: ${monthStart.toISOString().split('T')[0]} até ${monthEnd.toISOString().split('T')[0]}`);

    // Buscar o registro específico
    const record = await (backgroundPrisma as any).plBolsaHistory.findFirst({
      where: {
        date: monthStart,
        sector: null,
        minScore: null,
        excludeUnprofitable: false,
        pl: { gt: 22 },
      },
    });

    if (!record) {
      console.log('\n⚠️  Registro não encontrado');
      return;
    }

    const pl = toNumber(record.pl);
    const avgPl = toNumber(record.averagePl);
    console.log(`\n📊 Registro encontrado:`);
    console.log(`   Data: ${record.date.toISOString().split('T')[0]}`);
    console.log(`   P/L: ${pl?.toFixed(2)}x`);
    console.log(`   Média: ${avgPl?.toFixed(2)}x`);
    console.log(`   Empresas: ${record.companyCount}`);
    console.log(`   Setor: ${record.sector || 'todos'}`);
    console.log(`   MinScore: ${record.minScore ?? 'nenhum'}`);
    console.log(`   Excluir não lucrativas: ${record.excludeUnprofitable}`);

    // Agora vamos recalcular para ver quais empresas estão sendo incluídas
    console.log(`\n🔍 Recalculando para identificar empresas incluídas...`);

    // Buscar todas as empresas STOCK
    const companies = await backgroundPrisma.company.findMany({
      where: {
        assetType: 'STOCK',
      },
      select: {
        id: true,
        ticker: true,
        name: true,
        sector: true,
      },
    });

    const companyIds = companies.map(c => c.id);
    console.log(`   Total de empresas STOCK: ${companies.length}`);

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
    const financialData = await backgroundPrisma.financialData.findMany({
      where: {
        companyId: { in: Array.from(pricesByCompany.keys()) },
        year: { lte: targetDate.getFullYear() },
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

    // Agrupar por companyId e pegar o mais recente
    const latestFinancialByCompany = new Map<number, typeof financialData[0]>();
    for (const financial of financialData) {
      if (!latestFinancialByCompany.has(financial.companyId) && financial) {
        latestFinancialByCompany.set(financial.companyId, financial);
      }
    }

    // Calcular P/L para cada empresa
    const companiesPLData: Array<{
      companyId: number;
      ticker: string;
      name: string;
      sector: string | null;
      pl: number;
      marketCap: number;
      weightedPL: number;
      price: number;
      lpa: number | null;
      financialPL: number | null;
      calculatedPL: number | null;
      year: number;
    }> = [];

    const companiesMap = new Map(companies.map(c => [c.id, c]));

    for (const [companyId, priceData] of pricesByCompany.entries()) {
      const financial = latestFinancialByCompany.get(companyId);
      if (!financial) {
        continue;
      }

      const company = companiesMap.get(companyId);
      if (!company) {
        continue;
      }

      // Calcular P/L
      let pl: number | null = null;
      let financialPL: number | null = null;
      let calculatedPL: number | null = null;

      financialPL = financial.pl ? toNumber(financial.pl) : null;
      if (financialPL !== null && financialPL > 0) {
        pl = financialPL;
      } else {
        const financialLPA = financial.lpa ? toNumber(financial.lpa) : null;
        if (financialLPA !== null && financialLPA > 0 && priceData.price > 0) {
          calculatedPL = priceData.price / financialLPA;
          pl = calculatedPL;
        }
      }

      // Filtrar outliers
      if (
        !pl ||
        pl <= 0 ||
        !isFinite(pl) ||
        pl > 100 ||
        pl < -100
      ) {
        continue;
      }

      const marketCap = financial.marketCap
        ? toNumber(financial.marketCap)
        : null;

      if (!marketCap || marketCap <= 0) {
        continue;
      }

      const weightedPL = pl * marketCap;

      companiesPLData.push({
        companyId,
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        pl,
        marketCap,
        weightedPL,
        price: priceData.price,
        lpa: financial.lpa ? toNumber(financial.lpa) : null,
        financialPL,
        calculatedPL,
        year: financial.year,
      });
    }

    // Calcular P/L agregado
    const totalWeightedPL = companiesPLData.reduce((sum, c) => sum + c.weightedPL, 0);
    const totalMarketCap = companiesPLData.reduce((sum, c) => sum + c.marketCap, 0);
    const aggregatedPL = totalMarketCap > 0 ? totalWeightedPL / totalMarketCap : 0;

    console.log(`\n📊 Resultado do recálculo:`);
    console.log(`   Empresas válidas: ${companiesPLData.length}`);
    console.log(`   Market Cap Total: R$ ${(totalMarketCap / 1_000_000_000).toFixed(2)} bilhões`);
    console.log(`   P/L Agregado: ${aggregatedPL.toFixed(2)}x`);
    console.log(`   P/L no cache: ${pl?.toFixed(2)}x`);
    console.log(`   Diferença: ${Math.abs(aggregatedPL - (pl || 0)).toFixed(2)}x`);

    if (companiesPLData.length !== record.companyCount) {
      console.log(`\n⚠️  ATENÇÃO: Número de empresas diferente!`);
      console.log(`   Cache: ${record.companyCount} empresas`);
      console.log(`   Recalculado: ${companiesPLData.length} empresas`);
    }

    // Mostrar as empresas com maior P/L
    console.log(`\n📈 TOP 30 EMPRESAS COM MAIOR P/L:`);
    companiesPLData
      .sort((a, b) => b.pl - a.pl)
      .slice(0, 30)
      .forEach((c, idx) => {
        const weight = totalMarketCap > 0 ? (c.marketCap / totalMarketCap) * 100 : 0;
        console.log(`   ${idx + 1}. ${c.ticker.padEnd(10)} | P/L: ${c.pl.toFixed(2)}x | Market Cap: R$ ${(c.marketCap / 1_000_000_000).toFixed(2)}B | Peso: ${weight.toFixed(3)}% | ${c.financialPL !== null ? 'PL do BD' : 'Calculado (preço/LPA)'}`);
      });

    // Mostrar as empresas com maior peso (market cap)
    console.log(`\n💰 TOP 30 EMPRESAS COM MAIOR PESO (Market Cap):`);
    companiesPLData
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 30)
      .forEach((c, idx) => {
        const weight = totalMarketCap > 0 ? (c.marketCap / totalMarketCap) * 100 : 0;
        console.log(`   ${idx + 1}. ${c.ticker.padEnd(10)} | Market Cap: R$ ${(c.marketCap / 1_000_000_000).toFixed(2)}B | Peso: ${weight.toFixed(3)}% | P/L: ${c.pl.toFixed(2)}x`);
      });

    // Verificar se há empresas com P/L muito alto que podem estar distorcendo
    const highPLCompanies = companiesPLData.filter(c => c.pl > 50);
    if (highPLCompanies.length > 0) {
      console.log(`\n⚠️  Empresas com P/L > 50x (${highPLCompanies.length}):`);
      highPLCompanies.forEach((c, idx) => {
        const weight = totalMarketCap > 0 ? (c.marketCap / totalMarketCap) * 100 : 0;
        console.log(`   ${idx + 1}. ${c.ticker.padEnd(10)} | P/L: ${c.pl.toFixed(2)}x | Market Cap: R$ ${(c.marketCap / 1_000_000_000).toFixed(2)}B | Peso: ${weight.toFixed(3)}%`);
      });
    }

    // Verificar se o problema pode ser falta de dados
    console.log(`\n🔍 Verificando possíveis problemas:`);
    
    // Empresas que aparecem no cache mas não no recálculo
    if (companiesPLData.length < record.companyCount) {
      console.log(`\n   ⚠️  O recálculo encontrou MENOS empresas (${companiesPLData.length}) do que o cache indica (${record.companyCount})`);
      console.log(`      Isso pode significar que algumas empresas perderam dados financeiros ou preços.`);
    }

    // Verificar se há empresas com dados muito antigos
    const currentYear = new Date().getFullYear();
    const oldDataCompanies = companiesPLData.filter(c => c.year < currentYear - 2);
    if (oldDataCompanies.length > 0) {
      console.log(`\n   ⚠️  Empresas com dados financeiros muito antigos (>2 anos) (${oldDataCompanies.length}):`);
      oldDataCompanies.slice(0, 10).forEach((c, idx) => {
        console.log(`      ${idx + 1}. ${c.ticker.padEnd(10)} | Ano: ${c.year} | P/L: ${c.pl.toFixed(2)}x`);
      });
    }

  } catch (error) {
    console.error('❌ Erro durante investigação:', error);
    throw error;
  } finally {
    await backgroundPrisma.$disconnect();
  }
}

investigate22xPL()
  .then(() => {
    console.log('\n✅ Investigação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

