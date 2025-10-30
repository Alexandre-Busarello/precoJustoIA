#!/usr/bin/env npx tsx

/**
 * TESTE PARA VERIFICAR DADOS HISTÓRICOS ESTENDIDOS (10 ANOS)
 */

import { BDRDataService } from '../src/lib/bdr-data-service';
import { prisma } from '../src/lib/prisma';

async function testExtendedHistoricalData() {
  console.log('🧪 TESTE DE DADOS HISTÓRICOS ESTENDIDOS (10 ANOS)\n');

  try {
    // Processar AMZO34.SA com dados históricos estendidos
    const ticker = 'AMZO34.SA';
    console.log(`🔄 Processando ${ticker} com dados históricos estendidos...`);
    
    const success = await BDRDataService.processBDR(ticker, true);
    
    if (success) {
      const company = await prisma.company.findUnique({
        where: { ticker: 'AMZO34' }
      });
      
      if (company) {
        // Verificar preços históricos disponíveis
        const historicalPrices = await prisma.historicalPrice.findMany({
          where: { companyId: company.id },
          orderBy: { date: 'asc' },
          select: { date: true, close: true }
        });
        
        console.log(`📊 PREÇOS HISTÓRICOS DISPONÍVEIS:`);
        console.log(`   Total de registros: ${historicalPrices.length}`);
        
        if (historicalPrices.length > 0) {
          const firstPrice = historicalPrices[0];
          const lastPrice = historicalPrices[historicalPrices.length - 1];
          
          console.log(`   Primeiro preço: ${firstPrice.date.toISOString().split('T')[0]} - R$ ${firstPrice.close}`);
          console.log(`   Último preço: ${lastPrice.date.toISOString().split('T')[0]} - R$ ${lastPrice.close}`);
          
          // Agrupar por ano
          const pricesByYear = new Map<number, number>();
          historicalPrices.forEach(price => {
            const year = price.date.getFullYear();
            if (!pricesByYear.has(year)) {
              pricesByYear.set(year, 0);
            }
            pricesByYear.set(year, pricesByYear.get(year)! + 1);
          });
          
          console.log(`\n   📅 Preços por ano:`);
          Array.from(pricesByYear.entries())
            .sort(([a], [b]) => a - b)
            .forEach(([year, count]) => {
              console.log(`      ${year}: ${count} registros`);
            });
        }
        
        // Verificar dados financeiros históricos com múltiplos
        const financialData = await prisma.financialData.findMany({
          where: { 
            companyId: company.id,
            year: { gte: 2015, lte: 2024 } // Últimos 10 anos
          },
          orderBy: { year: 'desc' },
          select: {
            year: true,
            pl: true,
            pvp: true,
            psr: true,
            marketCap: true,
            lpa: true,
            vpa: true
          }
        });
        
        console.log(`\n📊 MÚLTIPLOS HISTÓRICOS CALCULADOS:`);
        financialData.forEach(fd => {
          const hasMultiples = fd.pl !== null || fd.pvp !== null || fd.psr !== null;
          const status = hasMultiples ? '✅' : '❌';
          
          console.log(`   ${status} ${fd.year}: P/L=${fd.pl?.toFixed(2) || 'NULL'}, P/VPA=${fd.pvp?.toFixed(2) || 'NULL'}, P/S=${fd.psr?.toFixed(2) || 'NULL'}`);
          
          if (hasMultiples) {
            console.log(`      📈 Market Cap: R$ ${fd.marketCap ? (Number(fd.marketCap) / 1e9).toFixed(2) + 'B' : 'NULL'}`);
            console.log(`      📊 LPA: ${fd.lpa || 'NULL'}, VPA: ${fd.vpa?.toFixed(2) || 'NULL'}`);
          }
        });
        
        // Resumo
        const yearsWithMultiples = financialData.filter(fd => fd.pl !== null || fd.pvp !== null).length;
        const totalYears = financialData.length;
        
        console.log(`\n📈 RESUMO:`);
        console.log(`   Anos com dados financeiros: ${totalYears}`);
        console.log(`   Anos com múltiplos calculados: ${yearsWithMultiples}`);
        console.log(`   Cobertura de múltiplos: ${totalYears > 0 ? ((yearsWithMultiples/totalYears)*100).toFixed(1) : 0}%`);
        console.log(`   Período de preços: ${historicalPrices.length > 0 ? `${historicalPrices[0].date.getFullYear()}-${historicalPrices[historicalPrices.length-1].date.getFullYear()}` : 'Nenhum'}`);
      }
    }

  } catch (error: any) {
    console.error('❌ Erro no teste:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testExtendedHistoricalData().catch(console.error);