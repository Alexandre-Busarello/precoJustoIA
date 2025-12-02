/**
 * Script para corrigir o banco de dados do P/L histórico da BOLSA
 * 
 * Remove registros de meses incompletos (futuros) e recalcula novembro se necessário
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
  // (para garantir que temos dados do último dia útil do mês anterior)
  const nextMonthStart = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  const daysSinceNextMonth = Math.floor((now.getTime() - nextMonthStart.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysSinceNextMonth < 3) {
    return false
  }
  
  return true
}

async function fixDatabase() {
  try {
    console.log('🔧 Corrigindo banco de dados do P/L histórico da BOLSA');
    console.log('='.repeat(80));

    // Buscar todos os registros
    const allRecords = await (backgroundPrisma as any).plBolsaHistory.findMany({
      orderBy: {
        date: 'asc',
      },
    });

    console.log(`\n📊 Total de registros no banco: ${allRecords.length}`);

    // Identificar registros de meses incompletos
    const incompleteRecords: any[] = [];
    const completeRecords: any[] = [];

    for (const record of allRecords) {
      const recordDate = new Date(record.date);
      recordDate.setDate(1); // Normalizar para primeiro dia do mês
      
      if (!isMonthComplete(recordDate)) {
        incompleteRecords.push(record);
      } else {
        // Verificar também se tem número mínimo de empresas (200)
        if (record.companyCount < 200) {
          // Verificar se é um registro com filtros (setor específico, minScore, etc)
          // Se não tem filtros, deve ter pelo menos 200 empresas
          if (!record.sector && record.minScore === null) {
            incompleteRecords.push(record);
            console.log(`   ⚠️  Registro com poucas empresas: ${recordDate.toISOString().split('T')[0]} - ${record.companyCount} empresas (mínimo: 200)`);
          } else {
            completeRecords.push(record);
          }
        } else {
          completeRecords.push(record);
        }
      }
    }

    console.log(`\n📊 Registros completos: ${completeRecords.length}`);
    console.log(`📊 Registros incompletos a remover: ${incompleteRecords.length}`);

    if (incompleteRecords.length > 0) {
      console.log(`\n🗑️  Removendo registros incompletos...`);
      
      for (const record of incompleteRecords) {
        const recordDate = new Date(record.date);
        const pl = toNumber(record.pl);
        console.log(`   Removendo: ${recordDate.toISOString().split('T')[0]} | P/L: ${pl?.toFixed(2)}x | Empresas: ${record.companyCount} | Setor: ${record.sector || 'todos'} | MinScore: ${record.minScore ?? 'nenhum'}`);
        
        await (backgroundPrisma as any).plBolsaHistory.delete({
          where: { id: record.id },
        });
      }
      
      console.log(`\n✅ ${incompleteRecords.length} registro(s) removido(s) com sucesso!`);
    } else {
      console.log(`\n✅ Nenhum registro incompleto encontrado!`);
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

    console.log(`\n📅 Verificando registros de novembro/2025:`);
    console.log(`   Total encontrado: ${novemberRecords.length}`);

    if (novemberRecords.length > 0) {
      novemberRecords.forEach((record: any) => {
        const pl = toNumber(record.pl);
        const avgPl = toNumber(record.averagePl);
        console.log(`   ${record.date.toISOString().split('T')[0]} | P/L: ${pl?.toFixed(2)}x | Média: ${avgPl?.toFixed(2)}x | Empresas: ${record.companyCount}`);
      });

      // Verificar se há registros com poucas empresas ou P/L anormal
      const problematicRecords = novemberRecords.filter((r: any) => {
        const pl = toNumber(r.pl);
        return r.companyCount < 200 || (pl && pl > 20);
      });

      if (problematicRecords.length > 0) {
        console.log(`\n⚠️  Encontrados ${problematicRecords.length} registro(s) problemático(s) em novembro:`);
        problematicRecords.forEach((record: any) => {
          const pl = toNumber(record.pl);
          console.log(`   ${record.date.toISOString().split('T')[0]} | P/L: ${pl?.toFixed(2)}x | Empresas: ${record.companyCount}`);
        });
        console.log(`\n   Esses registros serão removidos e recalculados...`);
        
        for (const record of problematicRecords) {
          await (backgroundPrisma as any).plBolsaHistory.delete({
            where: { id: record.id },
          });
        }
        
        console.log(`\n✅ Registros problemáticos removidos. Eles serão recalculados automaticamente na próxima requisição.`);
      }
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

fixDatabase()
  .then(() => {
    console.log('\n✅ Script finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

