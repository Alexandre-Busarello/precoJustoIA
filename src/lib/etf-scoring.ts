/**
 * Cálculo do ETF Score — score composto 0-100 com 6 dimensões:
 * Custo (18%), Retorno (22%), Liquidez (18%), Solidez (12%), Qualidade da Carteira (18%), Análise IA (12%)
 * + penalidade de concentração (até -20 pts)
 *
 * Análogo ao score de ações/FIIs via AssetSnapshot.overallScore.
 */
import { PrismaClient } from '@prisma/client';
import { analyzeEtfWithAi } from './etf-ai-analysis';

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

// Se return1y não está disponível, anualizamos return6m como proxy
function effectiveReturn1y(etf: EtfForScoring): number | null {
  if (etf.return1y !== null) return etf.return1y;
  if (etf.return6m !== null) return (1 + etf.return6m) ** 2 - 1;
  return null;
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

// ── Helpers de normalização ────────────────────────────────────────────────

function linearNormalize(value: number, min: number, max: number): number {
  if (max === min) return 100;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function logNormalize(value: number, allValues: number[]): number {
  const positives = allValues.filter((v) => v > 0);
  if (positives.length === 0) return 50;
  const logVal = Math.log1p(value);
  const logMin = Math.log1p(Math.min(...positives));
  const logMax = Math.log1p(Math.max(...positives));
  return linearNormalize(logVal, logMin, logMax);
}

// ── Dimensão 1: Custo ──────────────────────────────────────────────────────

function calcCusto(netExpenseRatio: number | null): number {
  if (netExpenseRatio === null || netExpenseRatio === 0) return 100;
  const MIN_RATE = 0.001; // 0.10%
  const MAX_RATE = 0.015; // 1.50%
  // Quanto menor a taxa, maior o score → inverso
  return linearNormalize(MAX_RATE - netExpenseRatio, MAX_RATE - MIN_RATE, 0) * -1 + 100;
  // Simplificado: 100 para taxa=0.001, 0 para taxa=0.015
}

function calcCustoSimple(netExpenseRatio: number | null): number {
  if (netExpenseRatio === null || netExpenseRatio === 0) return 100;
  const MIN_RATE = 0.001;
  const MAX_RATE = 0.015;
  if (netExpenseRatio <= MIN_RATE) return 100;
  if (netExpenseRatio >= MAX_RATE) return 0;
  return ((MAX_RATE - netExpenseRatio) / (MAX_RATE - MIN_RATE)) * 100;
}

// ── Dimensão 2: Retorno ────────────────────────────────────────────────────

function calcRetorno(return1y: number, group: number[]): number {
  if (group.length <= 1) return 75; // neutro se único no grupo
  const min = Math.min(...group);
  const max = Math.max(...group);
  return linearNormalize(return1y, min, max);
}

// ── Dimensão 3: Liquidez ───────────────────────────────────────────────────

function calcLiquidez(volume: number, allVolumes: number[]): number {
  return logNormalize(volume, allVolumes);
}

// ── Dimensão 4: Solidez ────────────────────────────────────────────────────

function calcSolidez(netAssets: number, allAssets: number[]): number {
  return logNormalize(netAssets, allAssets);
}

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

// ── Penalidade de Concentração ─────────────────────────────────────────────

function calcConcentracaoPenalty(holdingsConcentrationTop5: number | null): number {
  if (holdingsConcentrationTop5 === null) return 0;
  const THRESHOLD = 0.65;  // acima de 65% já penaliza
  const MAX_EXCESS = 0.35; // 65%+35% = 100% → penalidade máxima de 20 pts
  const MAX_PENALTY = 20;
  if (holdingsConcentrationTop5 <= THRESHOLD) return 0;
  const excess = holdingsConcentrationTop5 - THRESHOLD;
  return Math.min(MAX_PENALTY, (excess / MAX_EXCESS) * MAX_PENALTY);
}

// ── Score Principal ────────────────────────────────────────────────────────

export async function calculateEtfScore(
  etf: EtfForScoring,
  allEtfs: EtfForScoring[],
  volumeMap: Map<number, number> // companyId → volume
): Promise<{ score: number | null; dimensions: ScoreDimensions | null }> {
  const retorno1y = effectiveReturn1y(etf);
  if (retorno1y === null || etf.netExpenseRatio === null) {
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
    .map((e) => Number(e.netAssets ?? 0))
    .filter((a) => a > 0);

  const volume = volumeMap.get(etf.companyId) ?? 0;

  const custo = calcCustoSimple(etf.netExpenseRatio);
  const retorno = calcRetorno(retorno1y, benchmarkGroup);
  const liquidez = volume > 0 ? calcLiquidez(volume, allVolumes) : 0;
  const solidez = etf.netAssets ? calcSolidez(Number(etf.netAssets), allAssets) : 0;
  const qualidadeCarteira = await calcQualidadeCarteira(etf.holdings);
  // IA pode isentar a penalidade quando a concentração é estrutural (fundo-de-fundos)
  const concentracaoPenalty = etf.aiConcentracaoPenaltyOverride
    ? 0
    : calcConcentracaoPenalty(
        etf.holdingsConcentrationTop5 ? Number(etf.holdingsConcentrationTop5) : null
      );

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
    netExpenseRatio: e.netExpenseRatio ? Number(e.netExpenseRatio) : null,
    return1y: e.return1y ? Number(e.return1y) : null,
    return6m: e.return6m ? Number(e.return6m) : null,
    return3y: e.return3y ? Number(e.return3y) : null,
    return5y: e.return5y ? Number(e.return5y) : null,
    netAssets: e.netAssets ? Number(e.netAssets) : null,
    benchmarkIndex: e.benchmarkIndex,
    category: e.category,
    volatility12m: e.volatility12m ? Number(e.volatility12m) : null,
    holdingsConcentrationTop5: e.holdingsConcentrationTop5 ? Number(e.holdingsConcentrationTop5) : null,
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
      netExpenseRatio: etf.netExpenseRatio ? Number(etf.netExpenseRatio) : null,
      netAssets: etf.netAssets ? Number(etf.netAssets) : null,
      return6m: etf.return6m ? Number(etf.return6m) : null,
      return1y: etf.return1y ? Number(etf.return1y) : null,
      return3y: etf.return3y ? Number(etf.return3y) : null,
      return5y: etf.return5y ? Number(etf.return5y) : null,
      volatility12m: etf.volatility12m ? Number(etf.volatility12m) : null,
      holdingsConcentrationTop5: etf.holdingsConcentrationTop5
        ? Number(etf.holdingsConcentrationTop5)
        : null,
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
