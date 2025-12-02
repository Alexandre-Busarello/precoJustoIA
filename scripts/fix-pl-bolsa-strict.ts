/**
 * Script para corrigir o banco de dados do P/L histórico da BOLSA com critérios mais rigorosos
 * 
 * Remove registros com muito poucas empresas mesmo em setores específicos
 */

import * as dotenv from 'dotenv';
import { backgroundPrisma } from './prisma-background';
import { toNumber } from '../src/lib/strategies';

// Carregar variáveis de ambiente
dotenv.config();

/**
 * Verifica se um mês está completo (não é futuro e tem dados suficientes)
 */
function isMonthComplete(month: Date): boolean {
  const now = new Date()
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  
  // Se o mês ainda não terminou, não está completo
  if (monthEnd > now) {
    return false
  }
  
  // Se estamos no mês atual, verificar se já passou pelo menos 3 dias do mês seguinte
  const nextMonthStart = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  const daysSinceNextMonth = Math.floor((now.getTime() - nextMonthStart.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysSinceNextMonth < 3) {
    return false
  }
  
  return true
}

/**
 * Determina o número mínimo de empresas necessário baseado nos filtros
 */
function getMinCompaniesRequired(record: any): number {
  // Sem filtros: mínimo 200 empresas
  if (!record.sector && record.minScore === null) {
    return 200
  }
  
  // Com filtro de setor: mínimo 10 empresas (setores podem ser pequenos)
  if (record.sector) {
    return 10
  }
  
  // Com filtro de score: mínimo 20 empresas
  if (record.minScore !== null) {
    return 20
  }
  
  return 200 // Padrão
}

async function fixDatabaseStrict() {
  try {
    console.log('🔧 Corrigindo banco de dados do P/L histórico da BOLSA (critérios rigorosos)');
    console.log('='.repeat(80));

    // Buscar todos os registros
    const allRecords = await (backgroundPrisma as any).plBolsaHistory.findMany({
      orderBy: {
        date: 'asc',
      },
    });

    console.log(`\n📊 Total de registros no banco: ${allRecords.length}`);

    // Identificar registros problemáticos
    const problematicRecords: any[] = [];
    const validRecords: any[] = [];

    for (const record of allRecords) {
      const recordDate = new Date(record.date);
      recordDate.setDate(1); // Normalizar para primeiro dia do mês
      
      const minRequired = getMinCompaniesRequired(record);
      const isComplete = isMonthComplete(recordDate);
      
      // Verificar se o registro é problemático
      if (!isComplete) {
        problematicRecords.push(record);
        console.log(`   ⚠️  Mês incompleto: ${recordDate.toISOString().split('T')[0]} | Empresas: ${record.companyCount}`);
      } else if (record.companyCount < minRequired) {
        problematicRecords.push(record);
        console.log(`   ⚠️  Poucas empresas: ${recordDate.toISOString().split('T')[0]} | Empresas: ${record.companyCount} (mínimo: ${minRequired}) | Setor: ${record.sector || 'todos'} | MinScore: ${record.minScore ?? 'nenhum'}`);
      } else {
        validRecords.push(record);
      }
    }

    console.log(`\n📊 Registros válidos: ${validRecords.length}`);
    console.log(`📊 Registros problemáticos a remover: ${problematicRecords.length}`);

    if (problematicRecords.length > 0) {
      console.log(`\n🗑️  Removendo registros problemáticos...`);
      
      let removedCount = 0;
      for (const record of problematicRecords) {
        const recordDate = new Date(record.date);
        const pl = toNumber(record.pl);
        const minRequired = getMinCompaniesRequired(record);
        
        console.log(`   Removendo: ${recordDate.toISOString().split('T')[0]} | P/L: ${pl?.toFixed(2)}x | Empresas: ${record.companyCount} (mín: ${minRequired}) | Setor: ${record.sector || 'todos'} | MinScore: ${record.minScore ?? 'nenhum'}`);
        
        try {
          await (backgroundPrisma as any).plBolsaHistory.delete({
            where: { id: record.id },
          });
          removedCount++;
        } catch (error: any) {
          console.log(`   ⚠️  Erro ao remover registro ${record.id}: ${error.message}`);
        }
      }
      
      console.log(`\n✅ ${removedCount} registro(s) removido(s) com sucesso!`);
    } else {
      console.log(`\n✅ Nenhum registro problemático encontrado!`);
    }

    // Verificar novembro/2025 especificamente
    const novemberStart = new Date(2025, 10, 1); // Novembro 2025
    const novemberRecords = await (backgroundPrisma as any).plBolsaHistory.findMany({
      where: {
        date: {
          gte: novemberStart,
          lt: new Date(2025, 11, 1), // Antes de dezembro
        },
        sector: null,
        minScore: null,
        excludeUnprofitable: false,
      },
    });

    console.log(`\n📅 Verificando registros de novembro/2025 (sem filtros):`);
    console.log(`   Total encontrado: ${novemberRecords.length}`);

    if (novemberRecords.length > 0) {
      novemberRecords.forEach((record: any) => {
        const pl = toNumber(record.pl);
        const avgPl = toNumber(record.averagePl);
        console.log(`   ${record.date.toISOString().split('T')[0]} | P/L: ${pl?.toFixed(2)}x | Média: ${avgPl?.toFixed(2)}x | Empresas: ${record.companyCount}`);
      });
    }

    // Verificar o último mês completo disponível
    const now = new Date();
    const lastCompleteMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    console.log(`\n📅 Último mês completo disponível: ${lastCompleteMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`);

    // Listar últimos registros válidos
    const lastValidRecords = await (backgroundPrisma as any).plBolsaHistory.findMany({
      where: {
        sector: null,
        minScore: null,
        excludeUnprofitable: false,
        companyCount: { gte: 200 },
      },
      orderBy: {
        date: 'desc',
      },
      take: 5,
    });

    if (lastValidRecords.length > 0) {
      console.log(`\n📊 Últimos 5 registros válidos (sem filtros, ≥200 empresas):`);
      lastValidRecords.forEach((record: any) => {
        const pl = toNumber(record.pl);
        const avgPl = toNumber(record.averagePl);
        const dateStr = record.date.toISOString().split('T')[0];
        console.log(`   ${dateStr} | P/L: ${pl?.toFixed(2)}x | Média: ${avgPl?.toFixed(2)}x | Empresas: ${record.companyCount}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Correção do banco de dados concluída!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Erro durante correção:', error);
    throw error;
  } finally {
    await backgroundPrisma.$disconnect();
  }
}

fixDatabaseStrict()
  .then(() => {
    console.log('\n✅ Script finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

