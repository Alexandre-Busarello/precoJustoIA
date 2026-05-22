import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCalculateTechnicalAnalysis } from '@/lib/technical-analysis-service';

export const maxDuration = 300;

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000;

/**
 * GET /api/cron/refresh-etf-technical
 *
 * Regenera análises técnicas expiradas (> 30 dias) para todos os ETFs ativos.
 * Deve ser agendado para rodar mensalmente.
 *
 * Query params:
 *   ?ticker=BOVA11   — processar apenas um ticker específico
 *   ?force=true      — forçar recálculo mesmo que não expirado
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tickerParam = searchParams.get('ticker')?.toUpperCase();
  const force = searchParams.get('force') === 'true';

  const startMs = Date.now();

  const etfs = await prisma.company.findMany({
    where: {
      assetType: 'ETF',
      isActive: true,
      ...(tickerParam ? { ticker: tickerParam } : {}),
    },
    select: { id: true, ticker: true },
    orderBy: { ticker: 'asc' },
  });

  console.log(`🔄 [ETF TECHNICAL CRON] ${etfs.length} ETFs para verificar...`);

  const stats = { refreshed: 0, skipped: 0, insufficient: 0, failed: 0 };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let i = 0; i < etfs.length; i += BATCH_SIZE) {
    const batch = etfs.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (etf) => {
        try {
          // Verificar se já tem análise válida (não expirada)
          if (!force) {
            const existing = await (prisma as any).assetTechnicalAnalysis.findFirst({
              where: {
                companyId: etf.id,
                isActive: true,
                expiresAt: { gt: new Date() },
              },
              select: { expiresAt: true, calculatedAt: true },
            });

            if (existing) {
              const daysLeft = Math.floor(
                (existing.expiresAt.getTime() - Date.now()) / 86_400_000
              );
              console.log(`  ⏭️  ${etf.ticker}: análise válida por mais ${daysLeft} dia(s)`);
              stats.skipped++;
              return;
            }
          }

          // Calcular (ou forçar recálculo)
          const result = await getOrCalculateTechnicalAnalysis(etf.ticker, force, true);

          if (!result) {
            console.log(`  ⚠️  ${etf.ticker}: dados históricos insuficientes`);
            stats.insufficient++;
            return;
          }

          console.log(`  ✅ ${etf.ticker}: análise técnica gerada`);
          stats.refreshed++;
        } catch (err) {
          console.error(
            `  ❌ ${etf.ticker}:`,
            err instanceof Error ? err.message : err
          );
          stats.failed++;
        }
      })
    );

    if (i + BATCH_SIZE < etfs.length) await delay(BATCH_DELAY_MS);
  }

  const durationMs = Date.now() - startMs;

  console.log(
    `\n📊 [ETF TECHNICAL CRON] Concluído em ${(durationMs / 1000).toFixed(1)}s:`,
    stats
  );

  return NextResponse.json({
    success: true,
    total: etfs.length,
    ...stats,
    durationMs,
  });
}
