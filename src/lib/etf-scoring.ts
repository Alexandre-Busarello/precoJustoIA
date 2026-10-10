/**
 * Cálculo do ETF Score — score composto 0-100 com 6 dimensões:
 * Custo (18%), Retorno (22%), Liquidez (18%), Solidez (12%), Qualidade da Carteira (18%), Análise IA (12%)
 * + penalidade de concentração (até -20 pts)
 *
 * Análogo ao score de ações/FIIs via AssetSnapshot.overallScore.
 */
import { PrismaClient } from '@prisma/client';
import { analyzeEtfWithAi } from './etf-ai-analysis';
import {
  concentrationPenalty,
  costScore,
  effectiveReturn1y,
  logNormalize,
  returnScore,
  toNullableNumber,
} from './etf-scoring-core';

const prisma = new PrismaClient();

export interface EtfForScoring {
  id: number;
  companyId: number;
  netExpenseRatio: number | null;
  return1y: number | null;
  return6m: number | null;
  return3y: number | null;
  return5y: number | null;
  netAssets: number | null;
  benchmarkIndex: string | null;
  category: string | null;
  volatility12m: number | null;
  holdingsConcentrationTop5: number | null;
  aiAnalysisScore: number | null;
  aiConcentracaoPenaltyOverride: boolean | null;
  holdings: Array<{
    companyId: number | null;
    weight: number;
  }>;
}

export interface ScoreDimensions {
  custo: number;
  retorno: number;
  liquidez: number;
  solidez: number;
  qualidadeCarteira: number;
  analiseIA: number;
  concentracaoPenalty: number;
  total: number;
}

// Dimensões custo, retorno e a penalidade de concentração ficam em etf-scoring-core (puras e testadas).

// ── Dimensão 5: Qualidade da Carteira ─────────────────────────────────────

async function calcQualidadeCarteira(
  holdings: Array<{ companyId: number | null; weight: number }>
): Promise<number> {
  const trackable = holdings.filter((h) => h.companyId !== null);
  if (trackable.length === 0) return 50; // neutro

  const companyIds = trackable.map((h) => h.companyId as number);

  // Busca o score mais recente de cada empresa via AssetSnapshot
  const snapshots = await prisma.assetSnapshot.findMany({
    where: { companyId: { in: companyIds }, isLatest: true },
    select: { companyId: true, overallScore: true },
  });

  const scoreMap = new Map<number, number>();
  for (const s of snapshots) {
    if (s.overallScore !== null) {
      scoreMap.set(s.companyId, Number(s.overallScore));
    }
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const h of trackable) {
    const score = scoreMap.get(h.companyId as number);
    if (score !== undefined) {
      weightedSum += score * h.weight;
      totalWeight += h.weight;
    }
  }

  if (totalWeight === 0) return 50;
  // overallScore da plataforma é 0-100 (Decimal 5,2)
  return weightedSum / totalWeight;
}

// ── Score Principal ────────────────────────────────────────────────────────

export async function calculateEtfScore(
  etf: EtfForScoring,
  allEtfs: EtfForScoring[],
  volumeMap: Map<number, number> // companyId → volume
): Promise<{ score: number | null; dimensions: ScoreDimensions | null }> {
  const retorno1y = effectiveReturn1y(etf);
  const custo = costScore(etf.netExpenseRatio);
  if (retorno1y === null || custo === null) {
    return { score: null, dimensions: null };
  }

  // Agrupa ETFs por benchmark para normalizar retorno (usa return efetivo de cada um)
  const benchmarkGroup = allEtfs
    .filter((e) => (e.benchmarkIndex ?? 'Outros') === (etf.benchmarkIndex ?? 'Outros'))
    .map((e) => effectiveReturn1y(e))
    .filter((r): r is number => r !== null);

  const allVolumes = allEtfs
    .map((e) => volumeMap.get(e.companyId) ?? 0)
    .filter((v) => v > 0);

  const allAssets = allEtfs
    .map((e) => e.netAssets ?? 0)
    .filter((a) => a > 0);

  const volume = volumeMap.get(etf.companyId) ?? 0;

  const retorno = returnScore(retorno1y, benchmarkGroup);
  const liquidez = volume > 0 ? logNormalize(volume, allVolumes) : 0;
  const solidez = etf.netAssets !== null && etf.netAssets > 0 ? logNormalize(etf.netAssets, allAssets) : 0;
  const qualidadeCarteira = await calcQualidadeCarteira(etf.holdings);
  // IA pode isentar a penalidade quando a concentração é estrutural (fundo-de-fundos)
  const concentracaoPenalty = etf.aiConcentracaoPenaltyOverride
    ? 0
    : concentrationPenalty(etf.holdingsConcentrationTop5);

  // Dimensão IA: usa o score armazenado (calculado separadamente). Fallback 50 (neutro) se ainda não analisado.
  const analiseIA = etf.aiAnalysisScore !== null && etf.aiAnalysisScore !== undefined
    ? etf.aiAnalysisScore
    : 50;

  // Pesos: Custo 18% | Retorno 22% | Liquidez 18% | Solidez 12% | Qualidade 18% | IA 12%
  const raw =
    custo * 0.18 +
    retorno * 0.22 +
    liquidez * 0.18 +
    solidez * 0.12 +
    qualidadeCarteira * 0.18 +
    analiseIA * 0.12;

  const total = Math.max(0, Math.round(raw - concentracaoPenalty));

  return {
    score: total,
    dimensions: { custo, retorno, liquidez, solidez, qualidadeCarteira, analiseIA, concentracaoPenalty, total },
  };
}

// ── Recálculo em Lote ──────────────────────────────────────────────────────

export async function recalculateAllEtfScores(): Promise<void> {
  console.log('🧮 Recalculando ETF Scores...');

  const etfs = await prisma.etfData.findMany({
    where: {
      company: { isActive: true, assetType: 'ETF' },
      netExpenseRatio: { not: null },
      // inclui ETFs com return1y OU return6m (fallback)
      OR: [{ return1y: { not: null } }, { return6m: { not: null } }],
    },
    include: {
      holdings: { select: { companyId: true, weight: true } },
    },
  });

  // Busca volumes mais recentes via HistoricalPrice (mensal)
  const companyIds = etfs.map((e) => e.companyId);
  const latestPrices = await prisma.historicalPrice.findMany({
    where: { companyId: { in: companyIds }, interval: '1d', volume: { gt: 0 } },
    orderBy: { date: 'desc' },
    distinct: ['companyId'],
    select: { companyId: true, volume: true },
  });

  const volumeMap = new Map<number, number>(
    latestPrices.map((p) => [p.companyId, Number(p.volume ?? 0)])
  );

  let updated = 0;
  let skipped = 0;

  const toEtfForScoring = (e: typeof etfs[number], includeHoldings = true): EtfForScoring => ({
    id: e.id,
    companyId: e.companyId,
    netExpenseRatio: toNullableNumber(e.netExpenseRatio),
    return1y: toNullableNumber(e.return1y),
    return6m: toNullableNumber(e.return6m),
    return3y: toNullableNumber(e.return3y),
    return5y: toNullableNumber(e.return5y),
    netAssets: toNullableNumber(e.netAssets),
    benchmarkIndex: e.benchmarkIndex,
    category: e.category,
    volatility12m: toNullableNumber(e.volatility12m),
    holdingsConcentrationTop5: toNullableNumber(e.holdingsConcentrationTop5),
    aiAnalysisScore: e.aiAnalysisScore,
    aiConcentracaoPenaltyOverride: e.aiConcentracaoPenaltyOverride ?? null,
    holdings: includeHoldings
      ? e.holdings.map((h) => ({ companyId: h.companyId, weight: Number(h.weight) }))
      : [],
  });

  const allEtfsForScoring = etfs.map((e) => toEtfForScoring(e, false));

  for (const etf of etfs) {
    const etfForScoring = toEtfForScoring(etf, true);

    try {
      const { score, dimensions } = await calculateEtfScore(etfForScoring, allEtfsForScoring, volumeMap);

      if (score !== null && dimensions !== null) {
        await prisma.etfData.update({
          where: { id: etf.id },
          data: { etfScore: score, scoreUpdatedAt: new Date() },
        });

        // Salva snapshot histórico do score (mesmo padrão do AssetSnapshot para ações)
        await prisma.assetSnapshot.updateMany({
          where: { companyId: etf.companyId, isLatest: true },
          data: { isLatest: false },
        });
        await prisma.assetSnapshot.create({
          data: {
            companyId: etf.companyId,
            overallScore: score,
            isLatest: true,
            snapshotData: {
              type: 'etf',
              etfScore: score,
              dimensions: {
                custo: dimensions.custo,
                retorno: dimensions.retorno,
                liquidez: dimensions.liquidez,
                solidez: dimensions.solidez,
                qualidadeCarteira: dimensions.qualidadeCarteira,
                analiseIA: dimensions.analiseIA,
                concentracaoPenalty: dimensions.concentracaoPenalty,
              },
            },
            scoreComposition: {
              custo: { score: dimensions.custo, weight: 0.18 },
              retorno: { score: dimensions.retorno, weight: 0.22 },
              liquidez: { score: dimensions.liquidez, weight: 0.18 },
              solidez: { score: dimensions.solidez, weight: 0.12 },
              qualidadeCarteira: { score: dimensions.qualidadeCarteira, weight: 0.18 },
              analiseIA: { score: dimensions.analiseIA, weight: 0.12 },
            },
            penaltyInfo: dimensions.concentracaoPenalty > 0
              ? JSON.parse(JSON.stringify({ applied: true, value: dimensions.concentracaoPenalty, reason: 'Concentração Top 5 acima de 65%' }))
              : undefined,
          },
        });

        updated++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`❌ Score ${etf.companyId}: ${err instanceof Error ? err.message : err}`);
      skipped++;
    }
  }

  console.log(`✅ Scores: ${updated} atualizados, ${skipped} ignorados (dados insuficientes)`);

  // Desativa ETFs que a Phase 2 já rastreou mas ainda não têm score calculável
  const unscoredAfterScrape = await prisma.etfData.findMany({
    where: {
      company: { isActive: true, assetType: 'ETF' },
      lastScrapedAt: { not: null },
      etfScore: null,
    },
    select: { companyId: true },
  });

  if (unscoredAfterScrape.length > 0) {
    await prisma.company.updateMany({
      where: { id: { in: unscoredAfterScrape.map((u) => u.companyId) } },
      data: { isActive: false },
    });
    console.log(`⚠️  ${unscoredAfterScrape.length} ETF(s) desativados automaticamente (Phase 2 rodou, sem score calculável)`);
  }
}

// ── Análise IA em Lote ─────────────────────────────────────────────────────

/**
 * Roda análise qualitativa via Gemini para todos os ETFs ativos.
 * Chamado pelo cron de Phase 2 (semanal) para manter as análises atualizadas.
 * Usa o aiAnalysisScore armazenado; recalculateAllEtfScores() consome esse valor.
 */
export async function refreshEtfAiAnalyses(options: { forceAll?: boolean } = {}): Promise<void> {
  console.log('🤖 Iniciando análise IA dos ETFs...');

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const etfs = await prisma.etfData.findMany({
    where: {
      company: { isActive: true, assetType: 'ETF' },
      netExpenseRatio: { not: null },
      OR: [{ return1y: { not: null } }, { return6m: { not: null } }],
      ...(!options.forceAll && {
        OR: [
          { aiAnalysisUpdatedAt: null },
          { aiAnalysisUpdatedAt: { lt: oneWeekAgo } },
        ],
      }),
    },
    select: {
      id: true,
      benchmarkIndex: true,
      category: true,
      netExpenseRatio: true,
      netAssets: true,
      return6m: true,
      return1y: true,
      return3y: true,
      return5y: true,
      volatility12m: true,
      holdingsConcentrationTop5: true,
      company: { select: { ticker: true, name: true } },
      holdings: {
        select: { ticker: true, name: true, weight: true },
        orderBy: { weight: 'desc' },
        take: 10,
      },
    },
  });

  console.log(`📋 ${etfs.length} ETF(s) para análise IA`);

  let analyzed = 0;
  let failed = 0;

  for (const etf of etfs) {
    const input = {
      ticker: etf.company.ticker,
      name: etf.company.name,
      benchmarkIndex: etf.benchmarkIndex,
      category: etf.category,
      netExpenseRatio: toNullableNumber(etf.netExpenseRatio),
      netAssets: toNullableNumber(etf.netAssets),
      return6m: toNullableNumber(etf.return6m),
      return1y: toNullableNumber(etf.return1y),
      return3y: toNullableNumber(etf.return3y),
      return5y: toNullableNumber(etf.return5y),
      volatility12m: toNullableNumber(etf.volatility12m),
      holdingsConcentrationTop5: toNullableNumber(etf.holdingsConcentrationTop5),
      topHoldings: etf.holdings.map((h) => ({
        ticker: h.ticker,
        name: h.name,
        weight: Number(h.weight),
      })),
      // dimensões quantitativas: usamos 50 como placeholder (IA avalia qualitativamente)
      custoScore: 50,
      retornoScore: 50,
      liquidezScore: 50,
      solidezScore: 50,
      qualidadeCarteiraScore: 50,
    };

    const result = await analyzeEtfWithAi(input);

    if (result) {
      await prisma.etfData.update({
        where: { id: etf.id },
        data: {
          aiAnalysisScore: result.score,
          aiAnalysisSummary: result.summary,
          aiAnalysisUpdatedAt: new Date(),
          aiConcentracaoPenaltyOverride: result.skipConcentracaoPenalty,
        },
      });
      const overrideFlag = result.skipConcentracaoPenalty ? ' [penalidade ignorada]' : '';
      console.log(`✅ ${etf.company.ticker}: IA score ${result.score}${overrideFlag}`);
      analyzed++;
    } else {
      failed++;
    }

    // Pequena pausa para não saturar a API
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`🤖 Análise IA concluída: ${analyzed} analisados, ${failed} falhas`);
}
