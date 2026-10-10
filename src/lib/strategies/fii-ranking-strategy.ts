import { AbstractStrategy, toNumber } from './base-strategy';
import {
  CompanyData,
  FiiRankingParams,
  RankBuilderResult,
  StrategyAnalysis,
} from './types';
import { calculateFiiOverallScore } from './fii-overall-score';
import {
  computeFiiListingValuation,
  fiiListingFairValueModelLabel,
} from '@/lib/fii-listing-valuation';
import { formatNumber } from '@/lib/format';

/** Padrões do Ranking PJ-FII: os mesmos do registro (`ranking-models.ts`), usados quando um parâmetro não vem. */
export const FII_RANKING_DEFAULTS = {
  minScore: 55,
  minLiquidity: 1_000_000,
  limit: 30,
} as const;

function lastFetchedAtOf(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesTipo(f: CompanyData['financials'], tipo: FiiRankingParams['tipoFii']): boolean {
  if (!tipo || tipo === 'both') return true;
  const isPapel = !!f.fiiIsPapel;
  if (tipo === 'papel') return isPapel;
  return !isPapel;
}

/** Mesmos insumos do score da página do FII (`getCachedFiiOverallScore`): cotação do pregão, PL e data de atualização. */
function buildScoreInput(c: CompanyData) {
  return {
    ticker: c.ticker,
    cotacao: c.currentPrice > 0 ? c.currentPrice : c.financials.fiiCotacao,
    dividendYield: c.financials.dy,
    pvp: c.financials.pvp,
    ffoYield: c.financials.fiiFfoYield,
    capRate: c.financials.fiiCapRate,
    valorPatrimonial: c.financials.vpa,
    liquidez: c.financials.fiiLiquidez,
    valorMercado: c.financials.marketCap,
    qtdImoveis: c.financials.fiiQtdImoveis,
    vacanciaMedia: c.financials.fiiVacanciaMedia,
    precoM2: c.financials.precoM2,
    aluguelM2: c.financials.aluguelM2,
    segment: String(c.financials.fiiSegment || ''),
    isPapel: !!c.financials.fiiIsPapel,
    patrimonioLiquido: c.financials.patrimonioLiquido,
    lastFetchedAt: lastFetchedAtOf(c.financials.fiiLastFetchedAt),
  };
}

export class FiiRankingStrategy extends AbstractStrategy<FiiRankingParams> {
  readonly name = 'fiiRanking';

  generateRational(params: FiiRankingParams): string {
    const minS = params.minScore ?? FII_RANKING_DEFAULTS.minScore;
    return `Ranking PJ-FII: ordena pelo score proprietário (mín. ${minS}), com pilares Dividendos, Valuation, Qualidade do portfólio, Liquidez e Segmento e resiliência.`;
  }

  validateCompanyData(companyData: CompanyData, params: FiiRankingParams): boolean {
    const s = calculateFiiOverallScore(buildScoreInput(companyData), companyData.dividendHistory);
    const minS = params.minScore ?? FII_RANKING_DEFAULTS.minScore;
    const liq = toNumber(companyData.financials.fiiLiquidez);
    const minL = params.minLiquidity ?? FII_RANKING_DEFAULTS.minLiquidity;
    if (!matchesTipo(companyData.financials, params.tipoFii || 'both')) return false;
    // Sem dado de liquidez conta como ilíquido (mesma regra do filtro de liquidez dos rankings).
    if (liq === null || liq < minL) return false;
    const qtd = toNumber(companyData.financials.fiiQtdImoveis);
    if (params.minQtdImoveis != null && (qtd === null || qtd < params.minQtdImoveis)) return false;
    const vac = toNumber(companyData.financials.fiiVacanciaMedia);
    if (params.maxVacancia != null && vac !== null && vac > params.maxVacancia) return false;
    if (params.segmentos && params.segmentos.length > 0) {
      const seg = String(companyData.financials.fiiSegment || '');
      if (!params.segmentos.some((x) => seg.toLowerCase().includes(x.toLowerCase()))) return false;
    }
    return !!s && s.score >= minS && companyData.currentPrice > 0;
  }

  runAnalysis(companyData: CompanyData, params: FiiRankingParams): StrategyAnalysis {
    const s = calculateFiiOverallScore(buildScoreInput(companyData), companyData.dividendHistory);
    const ok = s !== null && this.validateCompanyData(companyData, params);
    const pvp = toNumber(companyData.financials.pvp);
    const ref = computeFiiListingValuation(companyData);
    const fiiListingRef: number | null =
      ref.upsideSource === 'dy_teto' ? 1 : ref.upsideSource === 'valor_patrimonial' ? 2 : null;
    return {
      isEligible: ok,
      score: s?.score ?? 0,
      fairValue: ref.fairValue,
      upside: ref.upside,
      reasoning: s
        ? `PJ-FII Score ${formatNumber(s.score)} (${s.grade}). ${s.recommendation}.`
        : 'Score não disponível.',
      criteria: [],
      key_metrics: {
        pjFiiScore: s?.score ?? null,
        dy: toNumber(companyData.financials.dy),
        pvp,
        liquidez: toNumber(companyData.financials.fiiLiquidez),
        precoTetoDY: ref.precoTetoDY,
        fiiListingRef,
      },
    };
  }

  runRanking(companies: CompanyData[], params: FiiRankingParams): RankBuilderResult[] {
    const list = this.filterByAssetType(companies, params.assetTypeFilter || 'fii');
    const minS = params.minScore ?? FII_RANKING_DEFAULTS.minScore;
    const minL = params.minLiquidity ?? FII_RANKING_DEFAULTS.minLiquidity;
    const rows: Array<{ c: CompanyData; score: number; dy: number; res: NonNullable<ReturnType<typeof calculateFiiOverallScore>> }> = [];

    for (const c of list) {
      const res = calculateFiiOverallScore(buildScoreInput(c), c.dividendHistory);
      if (!res || res.score < minS) continue;
      const liq = toNumber(c.financials.fiiLiquidez);
      if (liq === null || liq < minL) continue;
      if (!matchesTipo(c.financials, params.tipoFii || 'both')) continue;
      const qtd = toNumber(c.financials.fiiQtdImoveis);
      if (params.minQtdImoveis != null && (qtd === null || qtd < params.minQtdImoveis)) continue;
      const vac = toNumber(c.financials.fiiVacanciaMedia);
      if (params.maxVacancia != null && vac !== null && vac > params.maxVacancia) continue;
      if (params.segmentos && params.segmentos.length > 0) {
        const seg = String(c.financials.fiiSegment || '');
        if (!params.segmentos.some((x) => seg.toLowerCase().includes(x.toLowerCase()))) continue;
      }
      if (!(c.currentPrice > 0)) continue;

      const dy = toNumber(c.financials.dy) ?? 0;
      rows.push({ c, score: res.score, dy, res });
    }

    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.dy - a.dy;
    });

    const lim = params.limit ?? FII_RANKING_DEFAULTS.limit;
    return rows.slice(0, lim).map(({ c, res }) => {
      const analysis = this.runAnalysis(c, params);
      const tag = analysis.key_metrics?.fiiListingRef;
      const src =
        tag === 1 ? ('dy_teto' as const) : tag === 2 ? ('valor_patrimonial' as const) : null;
      return {
        ticker: c.ticker,
        name: c.name,
        sector: c.sector,
        currentPrice: c.currentPrice,
        logoUrl: c.logoUrl,
        fairValue: analysis.fairValue,
        upside: analysis.upside,
        fairValueModel: fiiListingFairValueModelLabel(src),
        // Margem de segurança (1 − preço ÷ preço justo), em pontos percentuais.
        marginOfSafety: analysis.fairValue && analysis.fairValue > 0
          ? (1 - c.currentPrice / analysis.fairValue) * 100
          : null,
        rational:
          `PJ-FII ${formatNumber(res.score)} (${res.grade}). Pilares: Dividendos ${formatNumber(res.breakdown.dividendos.score, { digits: 0 })}, ` +
          `Valuation ${formatNumber(res.breakdown.valuation.score, { digits: 0 })}, ` +
          `Qualidade ${formatNumber(res.breakdown.qualidadePortfolio.score, { digits: 0 })}, ` +
          `Liquidez ${formatNumber(res.breakdown.liquidez.score, { digits: 0 })}, ` +
          `Segmento e resiliência ${formatNumber(res.breakdown.gestao.score, { digits: 0 })}.`,
        key_metrics: analysis.key_metrics,
      };
    });
  }
}
