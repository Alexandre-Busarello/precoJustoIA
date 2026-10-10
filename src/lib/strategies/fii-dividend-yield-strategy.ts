import { AbstractStrategy, toNumber, formatPercent } from './base-strategy';
import { formatBRLCompact, formatNumber } from '../format';
import {
  CompanyData,
  FiiDividendYieldParams,
  RankBuilderResult,
  StrategyAnalysis,
} from './types';

/** Padrões do ranking de FIIs por dividend yield: os mesmos do registro (`ranking-models.ts`). */
export const FII_DIVIDEND_YIELD_DEFAULTS = {
  minYield: 0.08,
  maxPvp: 1.1,
  minLiquidity: 500_000,
  limit: 50,
} as const;

function matchesTipo(f: CompanyData['financials'], tipo: FiiDividendYieldParams['tipoFii']): boolean {
  if (!tipo || tipo === 'both') return true;
  const isPapel = !!f.fiiIsPapel;
  if (tipo === 'papel') return isPapel;
  return !isPapel;
}

export class FiiDividendYieldStrategy extends AbstractStrategy<FiiDividendYieldParams> {
  readonly name = 'fiiDividendYield';

  generateRational(params: FiiDividendYieldParams): string {
    const minY = params.minYield ?? FII_DIVIDEND_YIELD_DEFAULTS.minYield;
    const maxP = params.maxPvp ?? FII_DIVIDEND_YIELD_DEFAULTS.maxPvp;
    const minL = params.minLiquidity ?? FII_DIVIDEND_YIELD_DEFAULTS.minLiquidity;
    return `Ranking de FIIs por dividend yield, com P/VP até ${formatNumber(maxP, { digits: 2 })}, DY mínimo de ${formatPercent(
      minY
    )} e liquidez diária a partir de ${formatBRLCompact(minL)}.`;
  }

  validateCompanyData(companyData: CompanyData, params: FiiDividendYieldParams): boolean {
    const f = companyData.financials;
    const dy = toNumber(f.dy);
    const pvp = toNumber(f.pvp);
    const liq = toNumber(f.fiiLiquidez);
    const minY = params.minYield ?? FII_DIVIDEND_YIELD_DEFAULTS.minYield;
    const maxP = params.maxPvp ?? FII_DIVIDEND_YIELD_DEFAULTS.maxPvp;
    const minL = params.minLiquidity ?? FII_DIVIDEND_YIELD_DEFAULTS.minLiquidity;
    return !!(
      matchesTipo(f, params.tipoFii || 'both') &&
      dy !== null &&
      dy >= minY &&
      pvp !== null &&
      pvp <= maxP &&
      liq !== null &&
      liq >= minL &&
      companyData.currentPrice > 0
    );
  }

  runAnalysis(companyData: CompanyData, params: FiiDividendYieldParams): StrategyAnalysis {
    const ok = this.validateCompanyData(companyData, params);
    const dy = toNumber(companyData.financials.dy);
    return {
      isEligible: ok,
      score: dy !== null ? dy * 100 : 0,
      fairValue: null,
      upside: dy,
      reasoning: ok
        ? `FII com DY ${formatPercent(dy)} dentro dos guard-rails.`
        : 'FII fora dos critérios de DY / P/VP / liquidez.',
      criteria: [],
      key_metrics: {
        dy,
        pvp: toNumber(companyData.financials.pvp),
        liquidez: toNumber(companyData.financials.fiiLiquidez),
      },
    };
  }

  runRanking(companies: CompanyData[], params: FiiDividendYieldParams): RankBuilderResult[] {
    const list = this.filterByAssetType(companies, params.assetTypeFilter || 'fii');
    const rows: RankBuilderResult[] = [];

    for (const c of list) {
      if (!this.validateCompanyData({ ...c, financials: c.financials }, params)) continue;
      const dy = toNumber(c.financials.dy)!;
      rows.push({
        ticker: c.ticker,
        name: c.name,
        sector: c.sector,
        currentPrice: c.currentPrice,
        logoUrl: c.logoUrl,
        fairValue: null,
        upside: null,
        marginOfSafety: null,
        rational: `DY ${formatPercent(dy)} com P/VP ${formatNumber(toNumber(c.financials.pvp), { digits: 2 })} e liquidez adequada.`,
        key_metrics: {
          dy,
          pvp: toNumber(c.financials.pvp),
          liquidez: toNumber(c.financials.fiiLiquidez),
        },
      });
    }

    rows.sort((a, b) => (b.key_metrics?.dy as number) - (a.key_metrics?.dy as number));
    const lim = params.limit ?? FII_DIVIDEND_YIELD_DEFAULTS.limit;
    return rows.slice(0, lim);
  }
}
