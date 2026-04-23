import { AbstractStrategy, toNumber, formatPercent } from './base-strategy';
import {
  CompanyData,
  FiiDividendYieldParams,
  RankBuilderResult,
  StrategyAnalysis,
} from './types';

function matchesTipo(f: CompanyData['financials'], tipo: FiiDividendYieldParams['tipoFii']): boolean {
  if (!tipo || tipo === 'both') return true;
  const isPapel = !!f.fiiIsPapel;
  if (tipo === 'papel') return isPapel;
  return !isPapel;
}

export class FiiDividendYieldStrategy extends AbstractStrategy<FiiDividendYieldParams> {
  readonly name = 'fiiDividendYield';

  generateRational(params: FiiDividendYieldParams): string {
    const minY = params.minYield ?? 0.08;
    const maxP = params.maxPvp ?? 1.3;
    return `Ranking de FIIs por Dividend Yield, com P/VP ≤ ${maxP} e DY mínimo ${formatPercent(
      minY
    )}, respeitando liquidez mínima.`;
  }

  validateCompanyData(companyData: CompanyData, params: FiiDividendYieldParams): boolean {
    const f = companyData.financials;
    const dy = toNumber(f.dy);
    const pvp = toNumber(f.pvp);
    const liq = toNumber(f.fiiLiquidez);
    const minY = params.minYield ?? 0.08;
    const maxP = params.maxPvp ?? 1.3;
    const minL = params.minLiquidity ?? 500_000;
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
        rational: `DY ${formatPercent(dy)} com P/VP ${toNumber(c.financials.pvp)?.toFixed(2) ?? 'N/A'} e liquidez adequada.`,
        key_metrics: {
          dy,
          pvp: toNumber(c.financials.pvp),
          liquidez: toNumber(c.financials.fiiLiquidez),
        },
      });
    }

    rows.sort((a, b) => (b.key_metrics?.dy as number) - (a.key_metrics?.dy as number));
    const lim = params.limit ?? 100;
    return rows.slice(0, lim);
  }
}
