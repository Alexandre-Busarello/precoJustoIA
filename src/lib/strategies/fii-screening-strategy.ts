import { AbstractStrategy, toNumber, formatPercent } from './base-strategy';
import {
  CompanyData,
  FiiScreeningParams,
  RankBuilderResult,
  StrategyAnalysis,
} from './types';
import { calculateFiiOverallScore } from './fii-overall-score';
import {
  computeFiiListingValuation,
  fiiListingFairValueModelLabel,
} from '@/lib/fii-listing-valuation';

function matchesTipo(f: CompanyData['financials'], tipo: FiiScreeningParams['tipoFii']): boolean {
  if (!tipo || tipo === 'both') return true;
  const isPapel = !!f.fiiIsPapel;
  if (tipo === 'papel') return isPapel;
  return !isPapel;
}

export class FiiScreeningStrategy extends AbstractStrategy<FiiScreeningParams> {
  readonly name = 'fiiScreening';

  generateRational(params: FiiScreeningParams): string {
    return `Screening de FIIs com filtros: DY mín. ${params.minDY != null ? formatPercent(params.minDY) : '—'}, P/VP máx. ${
      params.maxPVP ?? '—'
    }, liquidez mín., imóveis, vacância e segmento.`;
  }

  validateCompanyData(companyData: CompanyData, params: FiiScreeningParams): boolean {
    return this.passesFilters(companyData, params);
  }

  private passesFilters(c: CompanyData, p: FiiScreeningParams): boolean {
    const f = c.financials;
    if (!matchesTipo(f, p.tipoFii || 'both')) return false;
    const dy = toNumber(f.dy);
    const pvp = toNumber(f.pvp);
    const liq = toNumber(f.fiiLiquidez);
    const qtd = toNumber(f.fiiQtdImoveis);
    const vac = toNumber(f.fiiVacanciaMedia);
    const seg = String(f.fiiSegment || '');

    if (p.minDY != null && p.minDY > 0 && (dy === null || dy < p.minDY)) return false;
    if (p.maxPVP != null && p.maxPVP > 0 && (pvp === null || pvp > p.maxPVP)) return false;
    if (p.minLiquidity != null && p.minLiquidity > 0 && (liq === null || liq < p.minLiquidity))
      return false;
    if (p.minQtdImoveis != null && p.minQtdImoveis > 0 && (qtd === null || qtd < p.minQtdImoveis))
      return false;
    if (p.maxVacancia != null && vac !== null && vac > p.maxVacancia) return false;
    if (p.segmentos && p.segmentos.length > 0) {
      const ok = p.segmentos.some((s) => seg.toLowerCase().includes(s.toLowerCase()));
      if (!ok) return false;
    }
    return c.currentPrice > 0;
  }

  runAnalysis(companyData: CompanyData, params: FiiScreeningParams): StrategyAnalysis {
    const ok = this.passesFilters(companyData, params);
    const scoreRes = calculateFiiOverallScore(
      {
        ticker: companyData.ticker,
        cotacao: companyData.financials.fiiCotacao ?? companyData.currentPrice,
        dividendYield: companyData.financials.dy,
        pvp: companyData.financials.pvp,
        ffoYield: companyData.financials.fiiFfoYield,
        capRate: companyData.financials.fiiCapRate,
        valorPatrimonial: companyData.financials.vpa,
        liquidez: companyData.financials.fiiLiquidez,
        valorMercado: companyData.financials.marketCap,
        qtdImoveis: companyData.financials.fiiQtdImoveis,
        vacanciaMedia: companyData.financials.fiiVacanciaMedia,
        precoM2: companyData.financials.precoM2,
        aluguelM2: companyData.financials.aluguelM2,
        segment: String(companyData.financials.fiiSegment || ''),
        isPapel: !!companyData.financials.fiiIsPapel,
      },
      companyData.dividendHistory
    );
    const ref = computeFiiListingValuation(companyData);
    const fiiListingRef: number | null =
      ref.upsideSource === 'dy_teto' ? 1 : ref.upsideSource === 'valor_patrimonial' ? 2 : null;
    return {
      isEligible: ok,
      score: scoreRes?.score ?? 0,
      fairValue: ref.fairValue,
      upside: ref.upside,
      reasoning: ok ? 'FII passa nos filtros configurados.' : 'FII fora dos filtros.',
      criteria: [],
      key_metrics: {
        pjFiiScore: scoreRes?.score ?? null,
        dy: toNumber(companyData.financials.dy),
        pvp: toNumber(companyData.financials.pvp),
        liquidez: toNumber(companyData.financials.fiiLiquidez),
        vacancia: toNumber(companyData.financials.fiiVacanciaMedia),
        capRate: toNumber(companyData.financials.fiiCapRate),
        precoTetoDY: ref.precoTetoDY,
        fiiListingRef,
      },
    };
  }

  runRanking(companies: CompanyData[], params: FiiScreeningParams): RankBuilderResult[] {
    const list = this.filterByAssetType(companies, params.assetTypeFilter || 'fii');
    const limit = params.limit ?? 500;
    const out: RankBuilderResult[] = [];

    for (const c of list) {
      if (!this.passesFilters(c, params)) continue;
      const analysis = this.runAnalysis(c, params);
      const score = calculateFiiOverallScore(
        {
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
        },
        c.dividendHistory
      );
      const ref = computeFiiListingValuation(c);
      const fairValueModel = fiiListingFairValueModelLabel(ref.upsideSource);
      const marginOfSafety =
        ref.fairValue !== null && ref.fairValue > 0 && c.currentPrice > 0
          ? ((ref.fairValue - c.currentPrice) / c.currentPrice) * 100
          : null;
      out.push({
        ticker: c.ticker,
        name: c.name,
        sector: c.sector,
        currentPrice: c.currentPrice,
        logoUrl: c.logoUrl,
        fairValue: ref.fairValue,
        upside: ref.upside,
        marginOfSafety,
        fairValueModel,
        rational:
          `Screening FII — PJ-FII Score ${score?.score?.toFixed(1) ?? 'N/A'}. ` +
          `Dividendos ${score?.breakdown.dividendos.score.toFixed(0) ?? '—'}, Valuation ${
            score?.breakdown.valuation.score.toFixed(0) ?? '—'
          }, Portfólio ${score?.breakdown.qualidadePortfolio.score.toFixed(0) ?? '—'}.`,
        key_metrics: {
          ...(analysis.key_metrics || {}),
          pjFiiScore: score?.score ?? null,
          precoTetoDY: ref.precoTetoDY,
          fiiListingRef:
            ref.upsideSource === 'dy_teto' ? 1 : ref.upsideSource === 'valor_patrimonial' ? 2 : null,
        },
      });
      if (out.length >= limit) break;
    }
    return out;
  }
}
