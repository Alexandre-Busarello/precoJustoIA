/**
 * Script para recalcular e atualizar registros incorretos do P/L histórico
 */

import * as dotenv from 'dotenv';
import { backgroundPrisma } from './prisma-background';
import { calculateAggregatedPL, PLBolsaFilters } from '../src/lib/pl-bolsa-service';

dotenv.config();

async function recalculateCache() {
  try {
    console.log('🔄 Recalculando cache do P/L histórico');
    console.log('='.repeat(80));

    // Buscar registros de outubro e novembro/2025 que podem estar incorretos
    const startDate = new Date(2025, 9, 1); // Outubro 2025
    const endDate = new Date(2025, 11, 1); // Dezembro 2025 (exclusivo)

    console.log(`\n📅 Período: ${startDate.toISOString().split('T')[0]} até ${endDate.toISOString().split('T')[0]}`);

    // Buscar registros existentes
    const existingRecords = await (backgroundPrisma as any).plBolsaHistory.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
        sector: null,
        minScore: null,
      },
      orderBy: {
        date: 'asc',
      },
    });

    console.log(`\n📊 Registros existentes encontrados: ${existingRecords.length}`);
    existingRecords.forEach((r: any) => {
      console.log(`   ${r.date.toISOString().split('T')[0]} | excludeUnprofitable: ${r.excludeUnprofitable} | Empresas: ${r.companyCount} | P/L: ${r.pl}`);
    });

    // Recalcular para ambos os casos (com e sem filtro)
    console.log(`\n🔄 Recalculando dados...`);

    // 1. SEM filtro excludeUnprofitable
    console.log(`\n1️⃣ Recalculando SEM filtro excludeUnprofitable...`);
    const filtersWithout: PLBolsaFilters = {
      startDate,
      endDate,
      sector: undefined,
      minScore: undefined,
      excludeUnprofitable: false,
    };
    const dataWithout = await calculateAggregatedPL(filtersWithout);
    console.log(`   ✅ Calculado: ${dataWithout.length} pontos de dados`);
    if (dataWithout.length > 0) {
      console.log(`   Último ponto: ${dataWithout[dataWithout.length - 1].date} | Empresas: ${dataWithout[dataWithout.length - 1].companyCount} | P/L: ${dataWithout[dataWithout.length - 1].pl.toFixed(2)}x`);
    }

    // 2. COM filtro excludeUnprofitable
    console.log(`\n2️⃣ Recalculando COM filtro excludeUnprofitable...`);
    const filtersWith: PLBolsaFilters = {
      startDate,
      endDate,
      sector: undefined,
      minScore: undefined,
      excludeUnprofitable: true,
    };
    const dataWith = await calculateAggregatedPL(filtersWith);
    console.log(`   ✅ Calculado: ${dataWith.length} pontos de dados`);
    if (dataWith.length > 0) {
      console.log(`   Último ponto: ${dataWith[dataWith.length - 1].date} | Empresas: ${dataWith[dataWith.length - 1].companyCount} | P/L: ${dataWith[dataWith.length - 1].pl.toFixed(2)}x`);
    }

    // Comparar resultados
    console.log(`\n📊 Comparação:`);
    console.log(`   SEM filtro: ${dataWithout.length} pontos`);
    console.log(`   COM filtro: ${dataWith.length} pontos`);

    // Verificar se há diferenças significativas
    const monthsWithout = new Set(dataWithout.map(d => d.date));
    const monthsWith = new Set(dataWith.map(d => d.date));

    for (const date of monthsWithout) {
      const pointWithout = dataWithout.find(d => d.date === date);
      const pointWith = dataWith.find(d => d.date === date);

      if (pointWithout && pointWith) {
        const diff = pointWith.companyCount - pointWithout.companyCount;
        if (diff > 0) {
          console.log(`\n   ⚠️  ${date}: COM filtro tem ${diff} empresas A MAIS que SEM filtro!`);
          console.log(`      SEM: ${pointWithout.companyCount} empresas | P/L: ${pointWithout.pl.toFixed(2)}x`);
          console.log(`      COM: ${pointWith.companyCount} empresas | P/L: ${pointWith.pl.toFixed(2)}x`);
        } else if (diff < 0) {
          console.log(`\n   ✅ ${date}: COM filtro tem ${Math.abs(diff)} empresas A MENOS que SEM filtro (correto)`);
          console.log(`      SEM: ${pointWithout.companyCount} empresas | P/L: ${pointWithout.pl.toFixed(2)}x`);
          console.log(`      COM: ${pointWith.companyCount} empresas | P/L: ${pointWith.pl.toFixed(2)}x`);
        } else {
          console.log(`\n   ✅ ${date}: Mesmo número de empresas (${pointWithout.companyCount})`);
        }
      }
    }

    console.log(`\n✅ Recalculação concluída!`);
    console.log(`\n💡 Os dados foram salvos automaticamente no cache pelo calculateAggregatedPL.`);

  } catch (error) {
    console.error('❌ Erro:', error);
    throw error;
  } finally {
    await backgroundPrisma.$disconnect();
  }
}

recalculateCache()
  .then(() => {
    console.log('\n✅ Processo concluído com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

