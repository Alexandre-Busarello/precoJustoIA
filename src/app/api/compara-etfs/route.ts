import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get('tickers');

  if (!tickersParam) {
    return NextResponse.json({ error: 'tickers param required' }, { status: 400 });
  }

  const tickers = tickersParam
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 6);

  if (tickers.length < 2) {
    return NextResponse.json({ error: 'Mínimo 2 tickers' }, { status: 400 });
  }

  const companies = await prisma.company.findMany({
    where: { ticker: { in: tickers }, assetType: 'ETF', isActive: true },
    select: {
      id: true,
      ticker: true,
      name: true,
      logoUrl: true,
      description: true,
      etfData: {
        select: {
          etfScore: true,
          etfClass: true,
          category: true,
          benchmarkIndex: true,
          netExpenseRatio: true,
          netAssets: true,
          return1m: true,
          return3m: true,
          return6m: true,
          return1y: true,
          return3y: true,
          return5y: true,
          returnSinceInception: true,
          volatility12m: true,
          holdingsConcentrationTop5: true,
          aiAnalysisScore: true,
          aiAnalysisSummary: true,
          aiConcentracaoPenaltyOverride: true,
          holdings: {
            orderBy: { weight: 'desc' },
            take: 5,
            select: { ticker: true, name: true, weight: true },
          },
        },
      },
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1,
        select: { price: true, date: true },
      },
    },
  });

  // Preservar a ordem original
  const ordered = tickers
    .map((t) => companies.find((c) => c.ticker === t))
    .filter(Boolean);

  const data = ordered.map((c) => {
    const d = c!.etfData;
    const price = c!.dailyQuotes[0]?.price ?? null;
    return {
      ticker: c!.ticker,
      name: c!.name,
      logoUrl: c!.logoUrl,
      description: c!.description,
      price: price ? Number(price) : null,
      etfScore: d?.etfScore ?? null,
      etfClass: d?.etfClass ?? null,
      category: d?.category ?? null,
      benchmarkIndex: d?.benchmarkIndex ?? null,
      netExpenseRatio: d?.netExpenseRatio ? Number(d.netExpenseRatio) : null,
      netAssets: d?.netAssets ? Number(d.netAssets) : null,
      return1m: d?.return1m ? Number(d.return1m) : null,
      return3m: d?.return3m ? Number(d.return3m) : null,
      return6m: d?.return6m ? Number(d.return6m) : null,
      return1y: d?.return1y ? Number(d.return1y) : null,
      return3y: d?.return3y ? Number(d.return3y) : null,
      return5y: d?.return5y ? Number(d.return5y) : null,
      returnSinceInception: d?.returnSinceInception ? Number(d.returnSinceInception) : null,
      volatility12m: d?.volatility12m ? Number(d.volatility12m) : null,
      holdingsConcentrationTop5: d?.holdingsConcentrationTop5 ? Number(d.holdingsConcentrationTop5) : null,
      aiAnalysisScore: d?.aiAnalysisScore ?? null,
      aiAnalysisSummary: d?.aiAnalysisSummary ?? null,
      aiConcentracaoPenaltyOverride: d?.aiConcentracaoPenaltyOverride ?? false,
      topHoldings: (d?.holdings ?? []).map((h) => ({
        ticker: h.ticker,
        name: h.name,
        weight: Number(h.weight),
      })),
    };
  });

  return NextResponse.json({ etfs: data });
}
