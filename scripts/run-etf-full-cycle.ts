/**
 * Executa ciclo completo ETF: Fase 1 (BRAPI) + Fase 2 (etf1.com.br) + Scores
 * Uso: npx ts-node --transpileOnly --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/run-etf-full-cycle.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import { runPhase1 } from './fetch-etf-brapi';
import { runPhase2 } from '../src/lib/etf-scrapers/etf1-client';
import { recalculateAllEtfScores } from '../src/lib/etf-scoring';

const prisma = new PrismaClient();

async function main() {
  console.log('\n========================================');
  console.log('CICLO COMPLETO ETF — ' + new Date().toISOString());
  console.log('========================================\n');

  // ── Fase 1: BRAPI ──────────────────────────────────
  console.log('>>> FASE 1: Atualizando dados de mercado via BRAPI...');
  const r1 = await runPhase1();
  console.log(`Fase 1: ${r1.processed} ok, ${r1.failed} falhas, ${r1.newEtfs} novos (${r1.durationMs}ms)\n`);

  await prisma.etfIngestionLog.create({
    data: {
      phase: 1,
      processedCount: r1.processed,
      failedCount: r1.failed,
      durationMs: r1.durationMs,
      status: r1.failed === 0 ? 'success' : r1.processed > 0 ? 'partial' : 'failed',
    },
  });

  // ── Fase 2: etf1.com.br ────────────────────────────
  console.log('>>> FASE 2: Coletando dados qualitativos via etf1.com.br...');
  const r2 = await runPhase2(prisma, { force: false });
  console.log(`Fase 2: ${r2.processed} ok, ${r2.failed} falhas (${r2.durationMs}ms)\n`);

  await prisma.etfIngestionLog.create({
    data: {
      phase: 2,
      processedCount: r2.processed,
      failedCount: r2.failed,
      durationMs: r2.durationMs,
      status: r2.failed === 0 ? 'success' : r2.processed > 0 ? 'partial' : 'failed',
    },
  });

  // ── Score ───────────────────────────────────────────
  console.log('>>> SCORES: Recalculando ETF Scores...');
  await recalculateAllEtfScores();

  // ── Sumário ─────────────────────────────────────────
  const scored = await prisma.etfData.count({ where: { etfScore: { not: null } } });
  const withHoldings = await prisma.etfHolding.count();
  const top10 = await prisma.etfData.findMany({
    where: { etfScore: { not: null } },
    orderBy: { etfScore: 'desc' },
    take: 10,
    select: {
      company: { select: { ticker: true } },
      etfScore: true,
      return1y: true,
      netExpenseRatio: true,
      benchmarkIndex: true,
    },
  });

  console.log('\n========================================');
  console.log('RESULTADO FINAL');
  console.log('========================================');
  console.log(`ETFs com score: ${scored}`);
  console.log(`Holdings totais salvas: ${withHoldings}`);
  console.log('\nTOP 10 ETFs por score:');
  for (const e of top10) {
    const ret = e.return1y ? (Number(e.return1y) * 100).toFixed(1) + '%' : 'N/A';
    const exp = e.netExpenseRatio ? (Number(e.netExpenseRatio) * 100).toFixed(2) + '%' : 'N/A';
    console.log(`  ${e.company.ticker.padEnd(8)} score=${e.etfScore}  ret1y=${ret}  exp=${exp}  [${e.benchmarkIndex ?? '—'}]`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('ERRO FATAL:', e.message);
  process.exit(1);
});
