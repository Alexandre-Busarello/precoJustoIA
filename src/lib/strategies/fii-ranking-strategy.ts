import { AbstractStrategy, toNumber, formatPercent } from './base-strategy';
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

function matchesTipo(f: CompanyData['financials'], tipo: FiiRankingParams['tipoFii']): boolean {
  if (!tipo || tipo === 'both') return true;
  const isPapel = !!f.fiiIsPapel;
  if (tipo === 'papel') return isPapel;
  return !isPapel;
}

function buildScoreInput(c: CompanyData) {
  return {
    ticker: c.ticker,
    cotacao: c.financials.fiiCotacao ?? c.currentPrice,
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
  };
}

export class FiiRankingStrategy extends AbstractStrategy<FiiRankingParams> {
  readonly name = 'fiiRanking';

  generateRational(params: FiiRankingParams): string {
    const minS = params.minScore ?? 55;
    return `Ranking PJ-FII: ordena pelo score proprietário (mín. ${minS}), com pilares Dividendos, Valuation, Qualidade do portfólio, Liquidez e Gestão.`;
  }

  validateCompanyData(companyData: CompanyData, params: FiiRankingParams): boolean {
    const s = calculateFiiOverallScore(buildScoreInput(companyData), companyData.dividendHistory);
    const minS = params.minScore ?? 55;
    const liq = toNumber(companyData.financials.fiiLiquidez);
    const minL = params.minLiquidity ?? 1_000_000;
    if (!matchesTipo(companyData.financials, params.tipoFii || 'both')) return false;
    if (liq !== null && liq < minL) return false;
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
        ? `PJ-FII Score ${s.score} (${s.grade}). ${s.recommendation}.`
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
    const minS = params.minScore ?? 55;
    const minL = params.minLiquidity ?? 1_000_000;
    const rows: Array<{ c: CompanyData; score: number; dy: number; res: NonNullable<ReturnType<typeof calculateFiiOverallScore>> }> = [];

    for (const c of list) {
      const res = calculateFiiOverallScore(buildScoreInput(c), c.dividendHistory);
      if (!res || res.score < minS) continue;
      const liq = toNumber(c.financials.fiiLiquidez);
      if (liq !== null && liq < minL) continue;
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

    const lim = params.limit ?? 100;
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
        marginOfSafety: analysis.fairValue
          ? ((analysis.fairValue - c.currentPrice) / c.currentPrice) * 100
          : null,
        rational:
          `PJ-FII ${res.score} (${res.grade}). Pilares: Dividendos ${res.breakdown.dividendos.score.toFixed(
            0
          )}, Valuation ${res.breakdown.valuation.score.toFixed(0)}, Qualidade ${res.breakdown.qualidadePortfolio.score.toFixed(
            0
          )}, Liquidez ${res.breakdown.liquidez.score.toFixed(0)}, Gestão ${res.breakdown.gestao.score.toFixed(0)}.`,
        key_metrics: analysis.key_metrics,
      };
    });
  }
}
