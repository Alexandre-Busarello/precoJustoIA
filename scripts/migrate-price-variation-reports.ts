/**
 * Script de Migração: Preencher windowDays e conclusion em Relatórios de Variação de Preço
 * 
 * Este script:
 * 1. Preenche windowDays extraindo de metadata.triggerReason.days
 * 2. Preenche conclusion extraindo do conteúdo do relatório
 * 3. Remove relatórios duplicados (mantém apenas o mais recente para cada empresa/dia)
 * 
 * Uso:
 *   npx tsx scripts/migrate-price-variation-reports.ts
 * 
 * Para modo dry-run (apenas visualizar sem fazer alterações):
 *   npx tsx scripts/migrate-price-variation-reports.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

/**
 * Extrai a conclusão do conteúdo do relatório usando regex
 */
function extractConclusionFromContent(content: string): string | null {
  // Buscar a seção "## Análise de Impacto Fundamental" > "### Sobre a Queda de Preço" > "**Conclusão**:"
  const analysisSectionMatch = content.match(
    /## Análise de Impacto Fundamental[\s\S]*?### Sobre a Queda de Preço[\s\S]*?\*\*Conclusão\*\*:\s*([^\n]+)/i
  );
  
  if (analysisSectionMatch && analysisSectionMatch[1]) {
    return analysisSectionMatch[1].trim();
  }
  
  return null;
}

/**
 * Extrai windowDays de metadata.triggerReason.days
 */
function extractWindowDays(metadata: any): number | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  
  const triggerReason = metadata.triggerReason;
  if (!triggerReason || typeof triggerReason !== 'object') {
    return null;
  }
  
  const days = triggerReason.days;
  if (typeof days === 'number' && [1, 5, 30, 365].includes(days)) {
    return days;
  }
  
  return null;
}

/**
 * Normaliza data para comparar apenas dia (sem hora)
 */
function normalizeDate(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  
  console.log('🔄 Iniciando migração de relatórios de variação de preço...\n');
  
  if (isDryRun) {
    console.log('⚠️  MODO DRY-RUN: Nenhuma alteração será feita no banco de dados\n');
  }

  try {
    // 1. Buscar todos os relatórios PRICE_VARIATION
    const allReportsRaw = await prisma.aIReport.findMany({
      where: {
        type: 'PRICE_VARIATION',
        status: 'COMPLETED',
      },
      include: {
        company: {
          select: {
            ticker: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Mapear para incluir campos que podem não estar tipados ainda
    const allReports = allReportsRaw.map(report => ({
      id: report.id,
      companyId: report.companyId,
      content: report.content,
      metadata: report.metadata,
      windowDays: (report as any).windowDays || null,
      conclusion: (report as any).conclusion || null,
      createdAt: report.createdAt,
      company: report.company,
    }));

    console.log(`📊 Total de relatórios encontrados: ${allReports.length}\n`);

    // 2. Processar cada relatório
    let updatedCount = 0;
    let windowDaysFilled = 0;
    let conclusionFilled = 0;
    const reportsToUpdate: Array<{
      id: string;
      windowDays: number | null;
      conclusion: string | null;
    }> = [];

    for (const report of allReports) {
      let needsUpdate = false;
      let windowDays = report.windowDays;
      let conclusion = report.conclusion;

      // Extrair windowDays se não estiver preenchido
      if (!windowDays) {
        const extractedDays = extractWindowDays(report.metadata);
        if (extractedDays) {
          windowDays = extractedDays;
          windowDaysFilled++;
          needsUpdate = true;
        }
      }

      // Extrair conclusion se não estiver preenchido
      if (!conclusion) {
        const extractedConclusion = extractConclusionFromContent(report.content);
        if (extractedConclusion) {
          conclusion = extractedConclusion;
          conclusionFilled++;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        reportsToUpdate.push({
          id: report.id,
          windowDays,
          conclusion,
        });
      }
    }

    console.log(`📝 Relatórios que precisam de atualização: ${reportsToUpdate.length}`);
    console.log(`   - windowDays a preencher: ${windowDaysFilled}`);
    console.log(`   - conclusion a preencher: ${conclusionFilled}\n`);

    // 3. Atualizar relatórios
    if (!isDryRun && reportsToUpdate.length > 0) {
      console.log('💾 Atualizando relatórios...\n');
      
      // Atualizar em batch para melhor performance
      const BATCH_SIZE = 50;
      for (let i = 0; i < reportsToUpdate.length; i += BATCH_SIZE) {
        const batch = reportsToUpdate.slice(i, i + BATCH_SIZE);
        
        await Promise.all(
          batch.map(update =>
            prisma.aIReport.update({
              where: { id: update.id },
              data: {
                windowDays: update.windowDays,
                conclusion: update.conclusion,
              } as any,
            })
          )
        );
        
        updatedCount += batch.length;
        console.log(`   ✅ ${updatedCount}/${reportsToUpdate.length} relatórios atualizados...`);
      }
      
      console.log(`\n✅ Total: ${updatedCount} relatórios atualizados\n`);
    } else if (isDryRun && reportsToUpdate.length > 0) {
      console.log('📋 Relatórios que seriam atualizados (dry-run):\n');
      for (const update of reportsToUpdate.slice(0, 10)) {
        const report = allReports.find(r => r.id === update.id);
        console.log(`   - ${report?.company.ticker}: windowDays=${update.windowDays}, conclusion=${update.conclusion?.substring(0, 50)}...`);
      }
      if (reportsToUpdate.length > 10) {
        console.log(`   ... e mais ${reportsToUpdate.length - 10} relatórios\n`);
      }
    }

    // 4. Identificar e remover duplicatas
    console.log('🔍 Identificando relatórios duplicados...\n');

    // Agrupar por empresa e data (normalizada)
    const reportsByCompanyAndDate = new Map<string, Array<typeof allReports[0]>>();

    for (const report of allReports) {
      const dateKey = normalizeDate(report.createdAt);
      const key = `${report.companyId}-${dateKey}`;
      
      if (!reportsByCompanyAndDate.has(key)) {
        reportsByCompanyAndDate.set(key, []);
      }
      reportsByCompanyAndDate.get(key)!.push(report);
    }

    // Encontrar grupos com mais de 1 relatório
    const duplicates: Array<{ key: string; reports: typeof allReports }> = [];
    for (const [key, reports] of reportsByCompanyAndDate.entries()) {
      if (reports.length > 1) {
        duplicates.push({ key, reports });
      }
    }

    console.log(`📊 Grupos duplicados encontrados: ${duplicates.length}`);

    const duplicatesToDelete: string[] = [];

    for (const { key, reports } of duplicates) {
      // Ordenar por data de criação (mais recente primeiro)
      const sortedReports = [...reports].sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );

      // Manter apenas o mais recente, marcar os outros para exclusão
      const toDelete = sortedReports.slice(1);
      
      console.log(`\n   ${key}:`);
      console.log(`     - Mantendo: ${sortedReports[0].id} (${sortedReports[0].company.ticker}, ${sortedReports[0].createdAt.toISOString()})`);
      
      for (const report of toDelete) {
        console.log(`     - Removendo: ${report.id} (${report.createdAt.toISOString()})`);
        duplicatesToDelete.push(report.id);
      }
    }

    console.log(`\n🗑️  Total de relatórios duplicados a remover: ${duplicatesToDelete.length}\n`);

    // 5. Remover duplicatas
    if (!isDryRun && duplicatesToDelete.length > 0) {
      console.log('💾 Removendo relatórios duplicados...\n');
      
      const deleteResult = await prisma.aIReport.deleteMany({
        where: {
          id: {
            in: duplicatesToDelete,
          },
        },
      });
      
      console.log(`✅ ${deleteResult.count} relatórios duplicados removidos\n`);
    } else if (isDryRun && duplicatesToDelete.length > 0) {
      console.log('📋 Relatórios que seriam removidos (dry-run):\n');
      for (const id of duplicatesToDelete.slice(0, 10)) {
        const report = allReports.find(r => r.id === id);
        console.log(`   - ${report?.company.ticker}: ${id} (${report?.createdAt.toISOString()})`);
      }
      if (duplicatesToDelete.length > 10) {
        console.log(`   ... e mais ${duplicatesToDelete.length - 10} relatórios\n`);
      }
    }

    // Resumo final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DA MIGRAÇÃO');
    console.log('='.repeat(60));
    console.log(`Total de relatórios processados: ${allReports.length}`);
    console.log(`windowDays preenchidos: ${windowDaysFilled}`);
    console.log(`conclusion preenchidas: ${conclusionFilled}`);
    console.log(`Relatórios atualizados: ${isDryRun ? '0 (dry-run)' : updatedCount}`);
    console.log(`Relatórios duplicados encontrados: ${duplicates.length}`);
    console.log(`Relatórios duplicados removidos: ${isDryRun ? '0 (dry-run)' : duplicatesToDelete.length}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('✅ Migração concluída com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

