import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { calculateEtfScore, EtfForScoring, ScoreDimensions } from './etf-scoring';

export interface EtfScoreResult {
  score: number;
  dimensions: ScoreDimensions;
  aiConcentracaoPenaltyOverride: boolean;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export const getCachedEtfScore = cache(async (ticker: string): Promise<EtfScoreResult | null> => {
  const [etfs, latestPrices] = await Promise.all([
    prisma.etfData.findMany({
      where: { company: { isActive: true, assetType: 'ETF' } },
      select: {
        id: true,
        companyId: true,
        netExpenseRatio: true,
        return1y: true,
        return6m: true,
        return3y: true,
        return5y: true,
        netAssets: true,
        benchmarkIndex: true,
        category: true,
        volatility12m: true,
        holdingsConcentrationTop5: true,
        aiAnalysisScore: true,
        aiConcentracaoPenaltyOverride: true,
        holdings: { select: { companyId: true, weight: true } },
      },
    }),
    prisma.historicalPrice.findMany({
      where: {
        company: { assetType: 'ETF' },
        interval: '1d',
        volume: { gt: 0 },
      },
      orderBy: { date: 'desc' },
      distinct: ['companyId'],
      select: { companyId: true, volume: true },
    }),
  ]);

  const volumeMap = new Map<number, number>(
    latestPrices.map((p) => [p.companyId, toNum(p.volume) ?? 0])
  );

  // Find the target ETF (we need company.ticker matching)
  const targetCompany = await prisma.company.findUnique({
    where: { ticker: ticker.toUpperCase() },
    select: { id: true },
  });
  if (!targetCompany) return null;

  const targetEtf = etfs.find((e) => e.companyId === targetCompany.id);
  if (!targetEtf) return null;

  const toEtfForScoring = (e: typeof etfs[number]): EtfForScoring => ({
    id: e.id,
    companyId: e.companyId,
    netExpenseRatio: toNum(e.netExpenseRatio),
    return1y: toNum(e.return1y),
    return6m: toNum(e.return6m),
    return3y: toNum(e.return3y),
    return5y: toNum(e.return5y),
    netAssets: toNum(e.netAssets),
    benchmarkIndex: e.benchmarkIndex,
    category: e.category,
    volatility12m: toNum(e.volatility12m),
    holdingsConcentrationTop5: toNum(e.holdingsConcentrationTop5),
    aiAnalysisScore: e.aiAnalysisScore,
    aiConcentracaoPenaltyOverride: e.aiConcentracaoPenaltyOverride ?? null,
    holdings: e.holdings.map((h) => ({
      companyId: h.companyId,
      weight: toNum(h.weight) ?? 0,
    })),
  });

  const etfForScoring = toEtfForScoring(targetEtf);
  const allEtfsForScoring: EtfForScoring[] = etfs.map((e) => ({
    ...toEtfForScoring(e),
    holdings: [], // holdings only needed for target
  }));

  const { score, dimensions } = await calculateEtfScore(etfForScoring, allEtfsForScoring, volumeMap);

  if (score === null || dimensions === null) return null;
  return {
    score,
    dimensions,
    aiConcentracaoPenaltyOverride: etfForScoring.aiConcentracaoPenaltyOverride ?? false,
  };
});
