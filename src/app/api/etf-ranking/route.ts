import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { runEtfRanking, ETF_PRESETS, EtfPresetSlug, EtfRankingItem } from '@/lib/strategies/etf-ranking-strategy';

const FREE_LIMIT = 10;

function fmtPct(v: number | null): string {
  if (v === null) return 'N/D';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}%`;
}

function buildEtfRational(etf: EtfRankingItem): string {
  const effReturn = etf.return1y ?? (etf.return6m !== null ? (1 + etf.return6m) ** 2 - 1 : null);
  const parts: string[] = [];
  if (etf.etfScore !== null) parts.push(`**Score PJ-ETF: ${etf.etfScore}/100**`);
  if (etf.benchmarkIndex) parts.push(`Índice: **${etf.benchmarkIndex}**`);
  if (etf.netExpenseRatio !== null) parts.push(`Taxa: ${fmtPct(etf.netExpenseRatio)} a.a.`);
  if (effReturn !== null) parts.push(`Retorno${etf.isEstimatedReturn ? ' (est.)' : ''} 1a: ${fmtPct(effReturn)}`);
  if (etf.return3y !== null) parts.push(`Retorno 3a: ${fmtPct(etf.return3y)}`);
  return parts.join(' | ');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { preset } = body as { preset: string; limit?: number };

    if (!preset || !(preset in ETF_PRESETS)) {
      return NextResponse.json({ error: 'Preset inválido' }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    let isPremium = false;
    let currentUser: Awaited<ReturnType<typeof getCurrentUser>> = null;

    if (session?.user?.email) {
      currentUser = await getCurrentUser();
      isPremium = currentUser?.isPremium ?? false;
    }

    const limit = isPremium ? undefined : FREE_LIMIT;
    const results = await runEtfRanking(prisma, preset as EtfPresetSlug, limit);

    // Salva histórico no formato RankBuilderResult (compatível com QuickRanker)
    if (currentUser?.id) {
      // Busca preços atuais para todos os ETFs
      const tickers = results.map((r) => r.ticker);
      const priceRows = await prisma.dailyQuote.findMany({
        where: { company: { ticker: { in: tickers } } },
        orderBy: { date: 'desc' },
        distinct: ['companyId'],
        select: { price: true, company: { select: { ticker: true } } },
      });
      const priceMap = new Map(priceRows.map((r) => [r.company.ticker, Number(r.price)]));

      const rankBuilderResults = results.map((etf) => {
        const effReturn = etf.return1y ?? (etf.return6m !== null ? (1 + etf.return6m) ** 2 - 1 : null);
        return {
          ticker: etf.ticker,
          name: etf.name,
          sector: etf.benchmarkIndex ?? null,
          currentPrice: priceMap.get(etf.ticker) ?? 0,
          logoUrl: etf.logoUrl,
          fairValue: null,
          upside: null,
          marginOfSafety: null,
          rational: buildEtfRational(etf),
          key_metrics: {
            etfScore: etf.etfScore,
            retorno_1a: effReturn,
            taxa_adm: etf.netExpenseRatio,
            patrimonio_bi: etf.netAssets ? etf.netAssets / 1e9 : null,
          },
        };
      });

      await prisma.rankingHistory.create({
        data: {
          userId: currentUser.id,
          model: preset,
          params: { preset },
          results: JSON.parse(JSON.stringify(rankBuilderResults)),
          resultCount: rankBuilderResults.length,
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      preset,
      presetInfo: ETF_PRESETS[preset as EtfPresetSlug],
      results,
      count: results.length,
      isPremium,
      isLimited: !isPremium,
    });
  } catch (error) {
    console.error('Erro no ETF ranking:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
