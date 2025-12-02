/**
 * Script de debug para investigar o salto do P/L histórico da BOLSA em novembro/2025
 * 
 * Este script:
 * 1. Calcula o P/L agregado de outubro e novembro de 2025
 * 2. Compara os dois meses
 * 3. Lista as empresas que mais contribuíram para o aumento
 * 4. Mostra detalhes de cada empresa (P/L, market cap, peso no cálculo)
 * 5. Identifica possíveis problemas nos dados
 */

import * as dotenv from 'dotenv';
import { backgroundPrisma } from './prisma-background';
import { toNumber } from '../src/lib/strategies';

// Carregar variáveis de ambiente
dotenv.config();

interface CompanyPLData {
  companyId: number;
  ticker: string;
  name: string;
  sector: string | null;
  pl: number;
  marketCap: number;
  weightedPL: number; // pl * marketCap
  weight: number; // marketCap / totalMarketCap
  price: number;
  lpa: number | null;
  financialPL: number | null;
  calculatedPL: number | null;
  year: number;
}

interface MonthPLAnalysis {
  month: Date;
  aggregatedPL: number;
  totalMarketCap: number;
  validCompanies: number;
  companies: CompanyPLData[];
}

/**
 * Calcula o P/L agregado para um mês específico (sem cache)
 */
async function calculateMonthPL(month: Date): Promise<MonthPLAnalysis> {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  console.log(`\n📅 Calculando P/L para ${month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`);
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
      sector: true,
    },
  });

  const companyIds = companies.map(c => c.id);
  console.log(`   Total de empresas STOCK: ${companies.length}`);

  // Buscar preços mensais (último dia útil do mês)
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

  console.log(`   Dados financeiros encontrados: ${financialData.length}`);

  // Agrupar por companyId e pegar o mais recente
  const latestFinancialByCompany = new Map<number, typeof financialData[0]>();
  for (const financial of financialData) {
    if (!latestFinancialByCompany.has(financial.companyId) && financial) {
      latestFinancialByCompany.set(financial.companyId, financial);
    }
  }

  console.log(`   Empresas com dados financeiros: ${latestFinancialByCompany.size}`);

  // Calcular P/L agregado ponderado
  let totalWeightedPL = 0;
  let totalMarketCap = 0;
  let validCompanies = 0;
  const companiesPLData: CompanyPLData[] = [];

  // Criar mapa de empresas para facilitar busca
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

    // Tentar usar FinancialData.pl primeiro
    financialPL = financial.pl ? toNumber(financial.pl) : null;
    if (financialPL !== null && financialPL > 0) {
      pl = financialPL;
    }
    // Se não tiver, calcular: preço / LPA
    else {
      const financialLPA = financial.lpa ? toNumber(financial.lpa) : null;
      if (financialLPA !== null && financialLPA > 0 && priceData.price > 0) {
        calculatedPL = priceData.price / financialLPA;
        pl = calculatedPL;
      }
    }

    // Filtrar outliers e valores inválidos
    // Desconsiderar: NULL, <= 0, > 100, < -100
    if (
      !pl ||
      pl <= 0 ||
      !isFinite(pl) ||
      pl > 100 ||
      pl < -100
    ) {
      continue;
    }

    // Market cap para ponderação
    const marketCap = financial.marketCap
      ? toNumber(financial.marketCap)
      : null;

    // Se não tiver market cap, excluir
    if (!marketCap || marketCap <= 0) {
      continue;
    }

    const weightedPL = pl * marketCap;
    totalWeightedPL += weightedPL;
    totalMarketCap += marketCap;
    validCompanies++;

    companiesPLData.push({
      companyId,
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      pl,
      marketCap,
      weightedPL,
      weight: 0, // Será calculado depois
      price: priceData.price,
      lpa: financial.lpa ? toNumber(financial.lpa) : null,
      financialPL,
      calculatedPL,
      year: financial.year,
    });
  }

  // Calcular pesos
  companiesPLData.forEach(company => {
    company.weight = totalMarketCap > 0 ? company.marketCap / totalMarketCap : 0;
  });

  const aggregatedPL = totalMarketCap > 0 ? totalWeightedPL / totalMarketCap : 0;

  return {
    month,
    aggregatedPL,
    totalMarketCap,
    validCompanies,
    companies: companiesPLData,
  };
}

/**
 * Compara dois meses e identifica empresas que mais contribuíram para mudanças
 */
function compareMonths(october: MonthPLAnalysis, november: MonthPLAnalysis): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPARAÇÃO OUTUBRO vs NOVEMBRO 2025');
  console.log('='.repeat(80));

  console.log(`\n📈 P/L Agregado:`);
  console.log(`   Outubro: ${october.aggregatedPL.toFixed(2)}x`);
  console.log(`   Novembro: ${november.aggregatedPL.toFixed(2)}x`);
  console.log(`   Variação: ${((november.aggregatedPL / october.aggregatedPL - 1) * 100).toFixed(2)}%`);
  console.log(`   Diferença absoluta: ${(november.aggregatedPL - october.aggregatedPL).toFixed(2)}x`);

  console.log(`\n💰 Market Cap Total:`);
  console.log(`   Outubro: R$ ${(october.totalMarketCap / 1_000_000_000).toFixed(2)} bilhões`);
  console.log(`   Novembro: R$ ${(november.totalMarketCap / 1_000_000_000).toFixed(2)} bilhões`);
  console.log(`   Variação: ${((november.totalMarketCap / october.totalMarketCap - 1) * 100).toFixed(2)}%`);

  console.log(`\n🏢 Empresas Válidas:`);
  console.log(`   Outubro: ${october.validCompanies}`);
  console.log(`   Novembro: ${november.validCompanies}`);
  console.log(`   Diferença: ${november.validCompanies - october.validCompanies}`);

  // Criar mapas para facilitar comparação
  const octoberMap = new Map(october.companies.map(c => [c.companyId, c]));
  const novemberMap = new Map(november.companies.map(c => [c.companyId, c]));

  // Identificar empresas que apareceram em novembro mas não em outubro
  const newCompanies = november.companies.filter(c => !octoberMap.has(c.companyId));
  if (newCompanies.length > 0) {
    console.log(`\n🆕 Empresas que apareceram em NOVEMBRO mas não em OUTUBRO (${newCompanies.length}):`);
    newCompanies
      .sort((a, b) => b.weightedPL - a.weightedPL)
      .slice(0, 20)
      .forEach((c, idx) => {
        console.log(`   ${idx + 1}. ${c.ticker.padEnd(10)} | P/L: ${c.pl.toFixed(2)}x | Market Cap: R$ ${(c.marketCap / 1_000_000_000).toFixed(2)}B | Peso: ${(c.weight * 100).toFixed(3)}%`);
      });
  }

  // Identificar empresas que desapareceram em novembro
  const removedCompanies = october.companies.filter(c => !novemberMap.has(c.companyId));
  if (removedCompanies.length > 0) {
    console.log(`\n❌ Empresas que estavam em OUTUBRO mas não em NOVEMBRO (${removedCompanies.length}):`);
    removedCompanies
      .sort((a, b) => b.weightedPL - a.weightedPL)
      .slice(0, 20)
      .forEach((c, idx) => {
        console.log(`   ${idx + 1}. ${c.ticker.padEnd(10)} | P/L: ${c.pl.toFixed(2)}x | Market Cap: R$ ${(c.marketCap / 1_000_000_000).toFixed(2)}B`);
      });
  }

  // Comparar empresas que aparecem em ambos os meses
  const commonCompanies: Array<{
    company: CompanyPLData;
    october: CompanyPLData;
    november: CompanyPLData;
    plChange: number;
    marketCapChange: number;
    contributionChange: number;
  }> = [];

  for (const novCompany of november.companies) {
    const octCompany = octoberMap.get(novCompany.companyId);
    if (octCompany) {
      const plChange = novCompany.pl - octCompany.pl;
      const marketCapChange = novCompany.marketCap - octCompany.marketCap;
      const contributionChange = novCompany.weightedPL - octCompany.weightedPL;
      
      commonCompanies.push({
        company: novCompany,
        october: octCompany,
        november: novCompany,
        plChange,
        marketCapChange,
        contributionChange,
      });
    }
  }

  // Empresas com maior aumento de P/L
  console.log(`\n📈 TOP 20 EMPRESAS COM MAIOR AUMENTO DE P/L:`);
  commonCompanies
    .sort((a, b) => b.plChange - a.plChange)
    .slice(0, 20)
    .forEach((item, idx) => {
      const c = item.november;
      console.log(`   ${idx + 1}. ${c.ticker.padEnd(10)} | P/L Out: ${item.october.pl.toFixed(2)}x → Nov: ${c.pl.toFixed(2)}x (${item.plChange > 0 ? '+' : ''}${item.plChange.toFixed(2)}x) | Market Cap: R$ ${(c.marketCap / 1_000_000_000).toFixed(2)}B | Peso: ${(c.weight * 100).toFixed(3)}%`);
    });

  // Empresas que mais contribuíram para o aumento do P/L agregado
  console.log(`\n💰 TOP 20 EMPRESAS QUE MAIS CONTRIBUÍRAM PARA O AUMENTO (por mudança na contribuição ponderada):`);
  commonCompanies
    .sort((a, b) => b.contributionChange - a.contributionChange)
    .slice(0, 20)
    .forEach((item, idx) => {
      const c = item.november;
      const contributionOut = item.october.weightedPL;
      const contributionNov = c.weightedPL;
      console.log(`   ${idx + 1}. ${c.ticker.padEnd(10)} | Contribuição Out: ${contributionOut.toFixed(2)} → Nov: ${contributionNov.toFixed(2)} (${item.contributionChange > 0 ? '+' : ''}${item.contributionChange.toFixed(2)}) | P/L: ${c.pl.toFixed(2)}x | Market Cap: R$ ${(c.marketCap / 1_000_000_000).toFixed(2)}B`);
    });

  // Empresas com P/L muito alto em novembro
  console.log(`\n⚠️  TOP 20 EMPRESAS COM P/L MAIS ALTO EM NOVEMBRO:`);
  november.companies
    .sort((a, b) => b.pl - a.pl)
    .slice(0, 20)
    .forEach((c, idx) => {
      const octData = octoberMap.get(c.companyId);
      const change = octData ? ` (Out: ${octData.pl.toFixed(2)}x)` : ' (nova)';
      console.log(`   ${idx + 1}. ${c.ticker.padEnd(10)} | P/L: ${c.pl.toFixed(2)}x${change} | Market Cap: R$ ${(c.marketCap / 1_000_000_000).toFixed(2)}B | Peso: ${(c.weight * 100).toFixed(3)}% | ${c.financialPL !== null ? 'PL do BD' : 'Calculado (preço/LPA)'}`);
    });

  // Empresas com maior peso no cálculo (maior market cap)
  console.log(`\n🏆 TOP 20 EMPRESAS COM MAIOR PESO NO CÁLCULO (por market cap):`);
  november.companies
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 20)
    .forEach((c, idx) => {
      const octData = octoberMap.get(c.companyId);
      const plChange = octData ? ` (P/L Out: ${octData.pl.toFixed(2)}x → Nov: ${c.pl.toFixed(2)}x)` : ' (nova)';
      console.log(`   ${idx + 1}. ${c.ticker.padEnd(10)} | Market Cap: R$ ${(c.marketCap / 1_000_000_000).toFixed(2)}B | Peso: ${(c.weight * 100).toFixed(3)}%${plChange}`);
    });

  // Análise de possíveis problemas
  console.log(`\n🔍 ANÁLISE DE POSSÍVEIS PROBLEMAS:`);
  
  // Empresas com P/L > 50 em novembro
  const highPLCompanies = november.companies.filter(c => c.pl > 50);
  if (highPLCompanies.length > 0) {
    console.log(`\n   ⚠️  Empresas com P/L > 50x em novembro (${highPLCompanies.length}):`);
    highPLCompanies
      .sort((a, b) => b.pl - a.pl)
      .forEach((c, idx) => {
        const octData = octoberMap.get(c.companyId);
        const change = octData ? ` (Out: ${octData.pl.toFixed(2)}x)` : ' (nova)';
        console.log(`      ${idx + 1}. ${c.ticker.padEnd(10)} | P/L: ${c.pl.toFixed(2)}x${change} | Market Cap: R$ ${(c.marketCap / 1_000_000_000).toFixed(2)}B | Peso: ${(c.weight * 100).toFixed(3)}%`);
      });
  }

  // Empresas que mudaram drasticamente de P/L
  const drasticChanges = commonCompanies.filter(item => {
    const percentChange = Math.abs(item.plChange / item.october.pl);
    return percentChange > 0.5; // Mais de 50% de mudança
  });
  if (drasticChanges.length > 0) {
    console.log(`\n   ⚠️  Empresas com mudança drástica de P/L (>50%) (${drasticChanges.length}):`);
    drasticChanges
      .sort((a, b) => Math.abs(b.plChange / b.october.pl) - Math.abs(a.plChange / a.october.pl))
      .slice(0, 20)
      .forEach((item, idx) => {
        const c = item.november;
        const percentChange = (item.plChange / item.october.pl) * 100;
        console.log(`      ${idx + 1}. ${c.ticker.padEnd(10)} | P/L Out: ${item.october.pl.toFixed(2)}x → Nov: ${c.pl.toFixed(2)}x (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%) | Market Cap: R$ ${(c.marketCap / 1_000_000_000).toFixed(2)}B`);
      });
  }

  // Empresas que mudaram drasticamente de market cap
  const drasticMarketCapChanges = commonCompanies.filter(item => {
    const percentChange = Math.abs(item.marketCapChange / item.october.marketCap);
    return percentChange > 0.3; // Mais de 30% de mudança
  });
  if (drasticMarketCapChanges.length > 0) {
    console.log(`\n   ⚠️  Empresas com mudança drástica de Market Cap (>30%) (${drasticMarketCapChanges.length}):`);
    drasticMarketCapChanges
      .sort((a, b) => Math.abs(b.marketCapChange / b.october.marketCap) - Math.abs(a.marketCapChange / a.october.marketCap))
      .slice(0, 20)
      .forEach((item, idx) => {
        const c = item.november;
        const percentChange = (item.marketCapChange / item.october.marketCap) * 100;
        console.log(`      ${idx + 1}. ${c.ticker.padEnd(10)} | Market Cap Out: R$ ${(item.october.marketCap / 1_000_000_000).toFixed(2)}B → Nov: R$ ${(c.marketCap / 1_000_000_000).toFixed(2)}B (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%) | P/L: ${c.pl.toFixed(2)}x`);
      });
  }
}

/**
 * Função principal
 */
async function main() {
  try {
    console.log('🔍 Iniciando análise de debug do P/L histórico da BOLSA');
    console.log('='.repeat(80));

    const october = new Date(2025, 9, 1); // Outubro 2025 (mês 9, 0-indexed)
    const november = new Date(2025, 10, 1); // Novembro 2025 (mês 10, 0-indexed)

    const octoberAnalysis = await calculateMonthPL(october);
    const novemberAnalysis = await calculateMonthPL(november);

    compareMonths(octoberAnalysis, novemberAnalysis);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Análise concluída!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Erro durante a análise:', error);
    throw error;
  } finally {
    await backgroundPrisma.$disconnect();
  }
}

// Executar
main()
  .then(() => {
    console.log('\n✅ Script finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

