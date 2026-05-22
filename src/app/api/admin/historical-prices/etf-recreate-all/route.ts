import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { HistoricalDataService } from '@/lib/historical-data-service';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const etfs = await prisma.company.findMany({
      where: { assetType: 'ETF' },
      select: { id: true, ticker: true, name: true },
      orderBy: { ticker: 'asc' },
    });

    if (etfs.length === 0) {
      return NextResponse.json({ error: 'Nenhum ETF encontrado no banco de dados' }, { status: 404 });
    }

    console.log(`🔄 [ETF HISTORICAL] Recriando histórico para ${etfs.length} ETFs...`);

    const startDate = new Date('2000-01-01');
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const results = {
      total: etfs.length,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      details: [] as Array<{
        ticker: string;
        status: 'success' | 'failed' | 'skipped';
        message: string;
        recordsProcessed?: number;
        recordsDeduplicated?: number;
        recordsSaved?: number;
      }>,
    };

    const processEtf = async (etf: (typeof etfs)[0], index: number, total: number) => {
      try {
        console.log(`  [${index + 1}/${total}] ${etf.ticker}...`);

        const monthlyData = await HistoricalDataService.fetchHistoricalFromYahoo(etf.ticker, startDate, endDate, '1mo');

        const today = new Date();
        const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const dailyData = await HistoricalDataService.fetchHistoricalFromYahoo(etf.ticker, currentMonthStart, endDate, '1d');

        const allData = [...monthlyData, ...dailyData];

        if (allData.length === 0) {
          return { ticker: etf.ticker, status: 'skipped' as const, message: 'Nenhum dado encontrado no Yahoo Finance', recordsProcessed: 0, recordsDeduplicated: 0, recordsSaved: 0 };
        }

        const processedData = HistoricalDataService.processMonthlyData(allData);

        await prisma.historicalPrice.deleteMany({ where: { companyId: etf.id, interval: '1mo' } });
        await HistoricalDataService.saveHistoricalData(etf.id, processedData, '1mo', etf.ticker);

        return {
          ticker: etf.ticker,
          status: 'success' as const,
          message: 'Histórico recriado com sucesso',
          recordsProcessed: allData.length,
          recordsDeduplicated: processedData.length,
          recordsSaved: processedData.length,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`    ❌ ${etf.ticker}: ${msg}`);
        return { ticker: etf.ticker, status: 'failed' as const, message: msg };
      }
    };

    const BATCH_SIZE = 3;
    for (let i = 0; i < etfs.length; i += BATCH_SIZE) {
      const batch = etfs.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((etf, bi) => processEtf(etf, i + bi, etfs.length))
      );

      for (const r of batchResults) {
        results.processed++;
        if (r.status === 'fulfilled') {
          results.details.push(r.value);
          if (r.value.status === 'success') results.success++;
          else if (r.value.status === 'skipped') results.skipped++;
          else results.failed++;
        } else {
          results.failed++;
          results.details.push({ ticker: 'unknown', status: 'failed', message: r.reason?.message || 'Erro desconhecido' });
        }
      }

      if (i + BATCH_SIZE < etfs.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    console.log(`✅ [ETF HISTORICAL] Concluído: ${results.success} sucesso, ${results.failed} falhas, ${results.skipped} ignorados`);

    return NextResponse.json({
      success: true,
      message: `Processamento concluído: ${results.success} sucesso, ${results.failed} falhas, ${results.skipped} ignorados`,
      results,
    });
  } catch (error) {
    console.error('❌ [ETF HISTORICAL] Erro geral:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao recriar histórico de ETFs' },
      { status: 500 }
    );
  }
}
