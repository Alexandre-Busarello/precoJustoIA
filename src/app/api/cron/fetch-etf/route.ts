import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { runPhase1 } from '../../../../../scripts/fetch-etf-brapi';
import { runPhase2 } from '../../../../lib/etf-scrapers/etf1-client';
import { recalculateAllEtfScores, refreshEtfAiAnalyses } from '../../../../lib/etf-scoring';
import { generateEtfDescriptions } from '../../../../lib/etf-description-service';

export const maxDuration = 300;

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const phase = parseInt(searchParams.get('phase') ?? '1', 10);
  const force = searchParams.get('force') === 'true';
  const maxItems = searchParams.get('maxItems') ? parseInt(searchParams.get('maxItems')!, 10) : undefined;

  const startMs = Date.now();

  try {
    if (phase === 1) {
      const result = await runPhase1();

      await prisma.etfIngestionLog.create({
        data: {
          phase: 1,
          processedCount: result.processed,
          failedCount: result.failed,
          durationMs: result.durationMs,
          status: result.failed === 0 ? 'success' : result.processed > 0 ? 'partial' : 'failed',
        },
      });

      await recalculateAllEtfScores();

      return NextResponse.json({
        success: true,
        phase: 1,
        processed: result.processed,
        failed: result.failed,
        newEtfs: result.newEtfs,
        durationMs: Date.now() - startMs,
      });
    }

    if (phase === 2) {
      const result = await runPhase2(prisma, { force, maxItems });

      await prisma.etfIngestionLog.create({
        data: {
          phase: 2,
          processedCount: result.processed,
          failedCount: result.failed,
          durationMs: result.durationMs,
          status: result.failed === 0 ? 'success' : result.processed > 0 ? 'partial' : 'failed',
        },
      });

      // Análise IA semanal: roda após Phase 2 ter atualizado os dados fundamentais
      await refreshEtfAiAnalyses();
      await recalculateAllEtfScores();
      // Gera descrições didáticas apenas para novos ETFs sem descrição
      await generateEtfDescriptions({ forceAll: false });

      return NextResponse.json({
        success: true,
        phase: 2,
        processed: result.processed,
        failed: result.failed,
        durationMs: Date.now() - startMs,
      });
    }

    return NextResponse.json({ error: 'phase deve ser 1 ou 2' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    await prisma.etfIngestionLog.create({
      data: {
        phase,
        processedCount: 0,
        failedCount: -1,
        durationMs: Date.now() - startMs,
        status: 'failed',
      },
    }).catch(() => {});

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
