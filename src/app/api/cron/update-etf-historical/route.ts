import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HistoricalDataService } from '@/lib/historical-data-service';

export const maxDuration = 300;

const INITIAL_YEARS_BACK = 20;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const startMs = Date.now();

  const etfs = await prisma.company.findMany({
    where: { assetType: 'ETF' },
    select: { id: true, ticker: true },
    orderBy: { ticker: 'asc' },
  });

  console.log(`🔄 [ETF HISTORICAL CRON] Atualizando histórico de ${etfs.length} ETFs...`);

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const stats = { success: 0, skipped: 0, failed: 0, initialLoad: 0 };

  const processEtf = async (etf: { id: number; ticker: string }) => {
    try {
      const lastDate = await HistoricalDataService.getLastHistoricalDate(etf.id, '1mo');

      if (lastDate) {
        const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86_400_000);
        if (daysSince < 1) {
          stats.skipped++;
          return;
        }
        // Incremental: fetch from day after last record
        const startDate = new Date(lastDate);
        startDate.setDate(startDate.getDate() + 1);
        await HistoricalDataService.fetchAndSaveHistoricalPricesFromYahoo(etf.id, etf.ticker, startDate, endDate, '1mo');
      } else {
        // First load: fetch full history (20 years)
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - INITIAL_YEARS_BACK);
        await HistoricalDataService.fetchAndSaveHistoricalPricesFromYahoo(etf.id, etf.ticker, startDate, endDate, '1mo');
        stats.initialLoad++;
      }

      stats.success++;
    } catch (error) {
      console.error(`❌ [ETF HISTORICAL CRON] ${etf.ticker}:`, error instanceof Error ? error.message : error);
      stats.failed++;
    }
  };

  for (let i = 0; i < etfs.length; i += BATCH_SIZE) {
    const batch = etfs.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(processEtf));

    if (i + BATCH_SIZE < etfs.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  const durationMs = Date.now() - startMs;
  console.log(`✅ [ETF HISTORICAL CRON] ${stats.success} atualizados (${stats.initialLoad} carga inicial), ${stats.skipped} ignorados, ${stats.failed} falhas — ${durationMs}ms`);

  return NextResponse.json({
    success: true,
    total: etfs.length,
    successCount: stats.success,
    skippedCount: stats.skipped,
    failedCount: stats.failed,
    initialLoadCount: stats.initialLoad,
    durationMs,
  });
}
