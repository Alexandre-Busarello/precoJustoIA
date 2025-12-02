/**
 * Script para verificar o cache do P/L histórico da BOLSA no banco de dados
 * Verifica se há registros com P/L anormal em novembro/2025
 */

import * as dotenv from 'dotenv';
import { backgroundPrisma } from './prisma-background';
import { toNumber } from '../src/lib/strategies';

// Carregar variáveis de ambiente
dotenv.config();

async function checkCache() {
  try {
    console.log('🔍 Verificando cache do P/L histórico da BOLSA');
    console.log('='.repeat(80));

    // Buscar todos os registros de novembro/2025
    const novemberStart = new Date(2025, 10, 1); // Novembro 2025
    const novemberEnd = new Date(2025, 10, 30, 23, 59, 59);

    console.log(`\n📅 Buscando registros de ${novemberStart.toISOString().split('T')[0]} até ${novemberEnd.toISOString().split('T')[0]}`);

    const cachedRecords = await (backgroundPrisma as any).plBolsaHistory.findMany({
      where: {
        date: {
          gte: novemberStart,
          lte: novemberEnd,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    console.log(`\n📊 Total de registros encontrados: ${cachedRecords.length}`);

    if (cachedRecords.length === 0) {
      console.log('\n⚠️  Nenhum registro encontrado para novembro/2025');
      console.log('   Isso pode significar que o cache ainda não foi gerado ou foi limpo.');
      
      // Buscar registros mais recentes
      const recentRecords = await (backgroundPrisma as any).plBolsaHistory.findMany({
        orderBy: {
          date: 'desc',
        },
        take: 10,
      });

      if (recentRecords.length > 0) {
        console.log('\n📅 Últimos 10 registros no cache:');
        recentRecords.forEach((record: any) => {
          const pl = toNumber(record.pl);
          const avgPl = toNumber(record.averagePl);
          console.log(`   ${record.date.toISOString().split('T')[0]} | P/L: ${pl?.toFixed(2)}x | Média: ${avgPl?.toFixed(2)}x | Empresas: ${record.companyCount} | Setor: ${record.sector || 'todos'} | MinScore: ${record.minScore ?? 'nenhum'} | Excluir não lucrativas: ${record.excludeUnprofitable}`);
        });
      }
    } else {
      console.log('\n📊 Registros de novembro/2025:');
      cachedRecords.forEach((record: any) => {
        const pl = toNumber(record.pl);
        const avgPl = toNumber(record.averagePl);
        const dateStr = record.date.toISOString().split('T')[0];
        
        // Destacar valores anormais
        const isAbnormal = pl && pl > 20;
        const marker = isAbnormal ? '⚠️  ' : '   ';
        
        console.log(`${marker}${dateStr} | P/L: ${pl?.toFixed(2)}x | Média: ${avgPl?.toFixed(2)}x | Empresas: ${record.companyCount} | Setor: ${record.sector || 'todos'} | MinScore: ${record.minScore ?? 'nenhum'} | Excluir não lucrativas: ${record.excludeUnprofitable}`);
      });

      // Verificar se há registros com P/L > 20
      const abnormalRecords = cachedRecords.filter((r: any) => {
        const pl = toNumber(r.pl);
        return pl && pl > 20;
      });

      if (abnormalRecords.length > 0) {
        console.log(`\n⚠️  ATENÇÃO: ${abnormalRecords.length} registro(s) com P/L > 20x encontrado(s):`);
        abnormalRecords.forEach((record: any) => {
          const pl = toNumber(record.pl);
          const avgPl = toNumber(record.averagePl);
          console.log(`   ${record.date.toISOString().split('T')[0]} | P/L: ${pl?.toFixed(2)}x | Média: ${avgPl?.toFixed(2)}x | Empresas: ${record.companyCount}`);
          console.log(`      Filtros: Setor=${record.sector || 'todos'}, MinScore=${record.minScore ?? 'nenhum'}, Excluir não lucrativas=${record.excludeUnprofitable}`);
        });
      }
    }

    // Verificar também outubro para comparação
    const octoberStart = new Date(2025, 9, 1); // Outubro 2025
    const octoberEnd = new Date(2025, 9, 31, 23, 59, 59);

    console.log(`\n📅 Buscando registros de outubro/2025 para comparação:`);
    const octoberRecords = await (backgroundPrisma as any).plBolsaHistory.findMany({
      where: {
        date: {
          gte: octoberStart,
          lte: octoberEnd,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    if (octoberRecords.length > 0) {
      console.log(`\n📊 Registros de outubro/2025 (${octoberRecords.length}):`);
      octoberRecords.forEach((record: any) => {
        const pl = toNumber(record.pl);
        const avgPl = toNumber(record.averagePl);
        console.log(`   ${record.date.toISOString().split('T')[0]} | P/L: ${pl?.toFixed(2)}x | Média: ${avgPl?.toFixed(2)}x | Empresas: ${record.companyCount}`);
      });
    }

    // Buscar todos os registros com P/L > 20 em qualquer data
    console.log(`\n🔍 Buscando TODOS os registros com P/L > 20x (em qualquer data):`);
    const allRecords = await (backgroundPrisma as any).plBolsaHistory.findMany({
      orderBy: {
        date: 'desc',
      },
    });

    const allAbnormal = allRecords.filter((r: any) => {
      const pl = toNumber(r.pl);
      return pl && pl > 20;
    });

    if (allAbnormal.length > 0) {
      console.log(`\n⚠️  Total de ${allAbnormal.length} registro(s) com P/L > 20x encontrado(s):`);
      allAbnormal.slice(0, 20).forEach((record: any) => {
        const pl = toNumber(record.pl);
        const avgPl = toNumber(record.averagePl);
        const dateStr = record.date.toISOString().split('T')[0];
        console.log(`   ${dateStr} | P/L: ${pl?.toFixed(2)}x | Média: ${avgPl?.toFixed(2)}x | Empresas: ${record.companyCount} | Setor: ${record.sector || 'todos'} | MinScore: ${record.minScore ?? 'nenhum'}`);
      });
      
      if (allAbnormal.length > 20) {
        console.log(`   ... e mais ${allAbnormal.length - 20} registro(s)`);
      }
    } else {
      console.log(`\n✅ Nenhum registro com P/L > 20x encontrado no cache`);
    }

    // Verificar diferentes combinações de filtros
    console.log(`\n🔍 Verificando diferentes combinações de filtros para novembro:`);
    const filterCombinations = [
      { sector: null, minScore: null, excludeUnprofitable: false },
      { sector: null, minScore: null, excludeUnprofitable: true },
      { sector: null, minScore: 50, excludeUnprofitable: false },
      { sector: null, minScore: 70, excludeUnprofitable: false },
    ];

    for (const filters of filterCombinations) {
      const records = await (backgroundPrisma as any).plBolsaHistory.findMany({
        where: {
          date: {
            gte: novemberStart,
            lte: novemberEnd,
          },
          sector: filters.sector,
          minScore: filters.minScore,
          excludeUnprofitable: filters.excludeUnprofitable,
        },
        orderBy: {
          date: 'asc',
        },
      });

      if (records.length > 0) {
        const record = records[0];
        const pl = toNumber(record.pl);
        const avgPl = toNumber(record.averagePl);
        console.log(`   Setor=${filters.sector || 'todos'}, MinScore=${filters.minScore ?? 'nenhum'}, Excluir não lucrativas=${filters.excludeUnprofitable}: P/L=${pl?.toFixed(2)}x, Média=${avgPl?.toFixed(2)}x`);
      }
    }

  } catch (error) {
    console.error('❌ Erro ao verificar cache:', error);
    throw error;
  } finally {
    await backgroundPrisma.$disconnect();
  }
}

checkCache()
  .then(() => {
    console.log('\n✅ Verificação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

