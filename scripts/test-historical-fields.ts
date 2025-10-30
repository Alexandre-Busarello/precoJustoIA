#!/usr/bin/env npx tsx

/**
 * TESTE FOCADO NOS CAMPOS HISTÓRICOS CORRIGIDOS
 */

import { BDRDataService } from '../src/lib/bdr-data-service';
import { prisma } from '../src/lib/prisma';

async function testHistoricalFields() {
  console.log('🧪 TESTE DOS CAMPOS HISTÓRICOS CORRIGIDOS\n');

  try {
    // Processar AMZO34.SA
    const ticker = 'AMZO34.SA';
    console.log(`🔄 Processando ${ticker}...`);
    
    const success = await BDRDataService.processBDR(ticker, true);
    
    if (success) {
      const company = await prisma.company.findUnique({
        where: { ticker: 'AMZO34' }
      });
      
      if (company) {
        // Verificar apenas os anos históricos (2021-2024)
        const historicalData = await prisma.financialData.findMany({
          where: { 
            companyId: company.id,
            year: { in: [2021, 2022, 2023, 2024] }
          },
          orderBy: { year: 'desc' }
        });
        
        console.log(`📊 ANÁLISE DOS CAMPOS HISTÓRICOS CORRIGIDOS:\n`);
        
        historicalData.forEach((fd) => {
          console.log(`   ANO ${fd.year}:`);
          
          // Campos que DEVEM estar preenchidos agora
          const shouldBeFilled = [
            'margemBruta', 'giroAtivos', 'passivoAtivos', 
            'liquidezRapida', 'lpa', 'vpa'
          ];

          // Campos que DEVEM estar preenchidos com múltiplos históricos
          const historicalMultiples = [
            'pl', 'pvp', 'earningsYield', 'psr', 'pAtivos', 'marketCap', 'enterpriseValue', 'evEbitda'
          ];
          
          console.log(`      ✅ Campos que DEVEM estar preenchidos:`);
          shouldBeFilled.forEach(field => {
            const value = (fd as any)[field];
            if (value !== null) {
              console.log(`         ✅ ${field}: ${value}`);
            } else {
              console.log(`         ❌ ${field}: NULL (DEVERIA estar preenchido)`);
            }
          });
          
          console.log(`      📈 Múltiplos históricos (DEVEM estar preenchidos com preços históricos):`);
          historicalMultiples.forEach(field => {
            const value = (fd as any)[field];
            if (value !== null && value !== undefined) {
              console.log(`         ✅ ${field}: ${typeof value === 'number' ? Number(value).toFixed(2) : value}`);
            } else {
              console.log(`         ❌ ${field}: NULL (DEVERIA estar preenchido com dados históricos)`);
            }
          });
          
          // Resumo de preenchimento
          const allFields = Object.entries(fd);
          const excludeFields = ['id', 'companyId', 'year', 'updatedAt', 'dataSource'];
          const relevantFields = allFields.filter(([key]) => !excludeFields.includes(key));
          const filledFields = relevantFields.filter(([key, value]) => value !== null);
          
          console.log(`      📊 Total: ${filledFields.length}/${relevantFields.length} campos preenchidos (${((filledFields.length/relevantFields.length)*100).toFixed(1)}%)\n`);
        });
        
      }
    }

  } catch (error: any) {
    console.error('❌ Erro no teste:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testHistoricalFields().catch(console.error);