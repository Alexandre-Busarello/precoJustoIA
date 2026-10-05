import { AbstractStrategy, notApplicableAnalysis, toNumber, validateCAGR5Years } from './base-strategy';
import { toRankingResult, upsidePoints } from './bazin-strategy';
import { LynchParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';
import { isCyclicalCommodity } from '@/lib/finance/sector-classification';
import { lynchFairPE, peg } from '@/lib/finance/valuation';
import { formatBRL, formatMultiple, formatPct } from '@/lib/format';
import { marginOfSafety } from '@/lib/valuation-metrics';

export const LYNCH_DEFAULTS = {
  maxPeg: 1,
  maxGrowthRate: 0.25,
} as const;

export type PegBand = 'muito barato' | 'barato' | 'caro';

/** Faixas de Lynch: PEG < 0,5 muito barato; 0,5 a 1 barato; acima de 1 caro. */
export function pegBand(value: number): PegBand {
  if (value < 0.5) return 'muito barato';
  if (value <= 1) return 'barato';
  return 'caro';
}

/** Crescimento usado por Lynch: CAGR de lucros de 5 anos validado, positivo e limitado ao teto (padrão 25%). */
export function lynchGrowth(cagrLucros5a: unknown, maxGrowthRate: number = LYNCH_DEFAULTS.maxGrowthRate): number | null {
  const validated = validateCAGR5Years(toNumber(cagrLucros5a));
  if (validated === null || !Number.isFinite(validated) || validated <= 0) return null;
  return Math.min(validated, maxGrowthRate);
}

function notApplicable(reason: string, keyMetrics: Record<string, number | null>): StrategyAnalysis {
  return {
    isEligible: false,
    score: 0,
    fairValue: null,
    upside: null,
    discount: null,
    reasoning: reason,
    criteria: [{ label: 'Modelo aplicável', value: false, description: reason }],
    key_metrics: keyMetrics,
  };
}

/**
 * Peter Lynch: P/L justo = crescimento dos lucros + dividend yield (em pontos percentuais) e PEG = P/L ÷ crescimento.
 * Valor justo = LPA × P/L justo. Não se aplica a empresas com prejuízo nem a commodities cíclicas, cujo lucro de pico
 * distorce o P/L.
 */
export class LynchStrategy extends AbstractStrategy<LynchParams> {
  readonly name = 'lynch';

  validateCompanyData(companyData: CompanyData): boolean {
    return companyData.currentPrice > 0;
  }

  runAnalysis(companyData: CompanyData, params: LynchParams = {}): StrategyAnalysis {
    const bdrReason = this.bdrNotApplicableReason(companyData);
    if (bdrReason) return notApplicableAnalysis(bdrReason);
    const maxPeg = params.maxPeg ?? LYNCH_DEFAULTS.maxPeg;
    const maxGrowthRate = params.maxGrowthRate ?? LYNCH_DEFAULTS.maxGrowthRate;
    const { currentPrice: price, financials } = companyData;

    const lpa = toNumber(financials.lpa);
    const dy = toNumber(financials.dy);
    const cagr = toNumber(financials.cagrLucros5a);
    const baseMetrics = { lpa, dy, cagrLucros5a: cagr, roe: toNumber(financials.roe) };

    if (isCyclicalCommodity(companyData.sector, companyData.industry)) {
      return notApplicable(
        'Modelo não se aplica a commodities cíclicas: o lucro acompanha o ciclo de preços e o P/L de pico distorce o PEG.',
        baseMetrics
      );
    }
    if (lpa === null || !Number.isFinite(lpa) || lpa <= 0) {
      return notApplicable('Modelo não se aplica: a empresa não tem lucro por ação positivo.', baseMetrics);
    }

    const g = lynchGrowth(cagr, maxGrowthRate);
    if (g === null) {
      return notApplicable('Modelo não se aplica: sem crescimento de lucros positivo nos últimos 5 anos.', baseMetrics);
    }

    const pl = price > 0 ? price / lpa : null;
    const dyFraction = dy !== null && Number.isFinite(dy) && dy > 0 ? dy : 0;
    const pegValue = pl === null ? null : peg(pl, g);
    const fairPE = lynchFairPE(g, dyFraction);
    const fairValue = fairPE === null ? null : lpa * fairPE;
    const discount = marginOfSafety(price, fairValue);
    const band = pegValue === null ? null : pegBand(pegValue);

    const pegOk = pegValue !== null && pegValue <= maxPeg;
    const belowFair = discount !== null && discount > 0;
    const criteria: StrategyAnalysis['criteria'] = [
      {
        label: `PEG ≤ ${formatMultiple(maxPeg)}`,
        value: pegOk,
        description: `PEG: ${formatMultiple(pegValue, { digits: 2 })}${band ? ` (faixa "${band}" de Lynch)` : ''} · P/L ${formatMultiple(pl)} ÷ crescimento ${formatPct(g)}`,
      },
      {
        label: 'Preço abaixo do valor estimado',
        value: belowFair,
        description: `Valor estimado: ${formatBRL(fairValue)} (LPA ${formatBRL(lpa)} × P/L justo ${formatMultiple(fairPE)})`,
      },
    ];

    const growthNote = cagr !== null && cagr > g ? ` (CAGR de ${formatPct(cagr)} limitado a ${formatPct(maxGrowthRate, { digits: 0 })})` : '';
    const reasoning = [
      `PEG de ${formatMultiple(pegValue, { digits: 2 })}${band ? `, faixa "${band}" de Lynch` : ''}: P/L de ${formatMultiple(pl)} sobre crescimento dos lucros de ${formatPct(g)} ao ano${growthNote}.`,
      `P/L justo = crescimento + dividend yield = ${formatMultiple(fairPE)}, o que leva a um valor estimado de ${formatBRL(fairValue)} por ação.`,
      pegOk ? 'Atende ao PEG máximo do modelo.' : `PEG acima do máximo de ${formatMultiple(maxPeg)}.`,
    ].join(' ');

    return {
      isEligible: pegOk && belowFair,
      score: (criteria.filter((c) => c.value).length / criteria.length) * 100,
      fairValue,
      upside: upsidePoints(price, fairValue),
      discount,
      reasoning,
      criteria,
      key_metrics: {
        ...baseMetrics,
        pl,
        peg: pegValue,
        growthRate: g,
        fairPE,
      },
    };
  }

  runRanking(companies: CompanyData[], params: LynchParams = {}): RankBuilderResult[] {
    let candidates = this.filterByAssetType(companies, params.assetTypeFilter);
    candidates = this.filterCompaniesBySize(candidates, params.companySize || 'all');

    const ranked = candidates
      .filter((company) => this.validateCompanyData(company))
      .map((company) => ({ company, analysis: this.runAnalysis(company, params) }))
      .filter(({ analysis }) => analysis.isEligible)
      // Menor PEG primeiro.
      .sort((a, b) => (a.analysis.key_metrics?.peg ?? Infinity) - (b.analysis.key_metrics?.peg ?? Infinity))
      .slice(0, params.limit ?? 50)
      .map(({ company, analysis }) => toRankingResult(company, analysis));

    return this.applyTechnicalPrioritization(ranked, companies, params.useTechnicalAnalysis);
  }

  generateRational(params: LynchParams = {}): string {
    const maxPeg = params.maxPeg ?? LYNCH_DEFAULTS.maxPeg;
    const maxGrowthRate = params.maxGrowthRate ?? LYNCH_DEFAULTS.maxGrowthRate;

    return `# Peter Lynch (PEG)

Peter Lynch comparava o P/L com o crescimento dos lucros: uma empresa que cresce rápido pode valer um P/L maior.

## Fórmulas

- **Crescimento (g)**: CAGR dos lucros nos últimos 5 anos, limitado a ${formatPct(maxGrowthRate, { digits: 0 })} ao ano.
- **PEG = P/L ÷ (g × 100)**. Faixas de Lynch: abaixo de 0,5 muito barato, de 0,5 a 1 barato, acima de 1 caro.
- **P/L justo = g + dividend yield**, em pontos percentuais.
- **Valor estimado = LPA × P/L justo**.

## Critérios

- PEG ≤ ${formatMultiple(maxPeg)} e preço abaixo do valor estimado.
- Fora do modelo: empresas com LPA negativo ou sem crescimento de lucros, e commodities cíclicas (petróleo, mineração, siderurgia, papel e celulose), cujo lucro de pico distorce o P/L.

**Ordenação**: menor PEG${params.useTechnicalAnalysis ? ', com priorização técnica dentro de faixas semelhantes' : ''}.

O crescimento passado pode não se repetir. Estimativa, não é recomendação de investimento.`;
  }
}
