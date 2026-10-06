import { AbstractStrategy, toNumber } from './base-strategy';
import { fiveYearAverage, toRankingResult, upsidePoints } from './bazin-strategy';
import { BankPvpParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';
import { getMacroAssumptionsSync, keFromMacro } from '@/lib/finance/macro';
import { isFinancial } from '@/lib/finance/sector-classification';
import { MIN_DISCOUNT_GROWTH_SPREAD, fairPVP } from '@/lib/finance/valuation';
import { formatBRL, formatMultiple, formatPct } from '@/lib/format';
import { marginOfSafety } from '@/lib/valuation-metrics';

export const BANK_PVP_DEFAULTS = {
  maxGrowthRate: 0.06,
  minRoe: 0.12,
} as const;

/** Spread mínimo entre Ke e g com tolerância de ponto flutuante (0,15 − 0,11 dá 0,03999…). */
const SPREAD_EPSILON = 1e-9;

/** Payout em fração: o informado, ou DY × P/L quando falta. `null` sem nenhuma das fontes. */
function payoutOf(companyData: CompanyData): number | null {
  const payout = toNumber(companyData.financials.payout);
  if (payout !== null && Number.isFinite(payout) && payout >= 0) return Math.min(payout, 1);
  const dy = toNumber(companyData.financials.dy);
  const pl = toNumber(companyData.financials.pl);
  if (dy !== null && pl !== null && Number.isFinite(dy * pl) && dy >= 0 && pl > 0) return Math.min(dy * pl, 1);
  return null;
}

function notApplicable(
  reason: string,
  keyMetrics: Record<string, number | null> = {},
  label = 'Modelo aplicável'
): StrategyAnalysis {
  return {
    isEligible: false,
    score: 0,
    fairValue: null,
    upside: null,
    discount: null,
    reasoning: reason,
    criteria: [{ label, value: false, description: reason }],
    key_metrics: keyMetrics,
  };
}

/**
 * P/VP justo para bancos e seguradoras (lucro residual em perpetuidade): (ROE − g) / (Ke − g), com
 * ROE = média de 5 anos, g = min(ROE × (1 − payout), 6%) e Ke das premissas macro. Valor estimado = VPA × P/VP justo.
 */
export class BankPvpStrategy extends AbstractStrategy<BankPvpParams> {
  readonly name = 'bankPvp';

  validateCompanyData(companyData: CompanyData): boolean {
    return companyData.currentPrice > 0 && isFinancial(companyData.sector, companyData.industry);
  }

  runAnalysis(companyData: CompanyData, params: BankPvpParams = {}): StrategyAnalysis {
    if (!isFinancial(companyData.sector, companyData.industry)) {
      return notApplicable('Modelo só se aplica a bancos, seguradoras e demais financeiras.');
    }

    const maxGrowthRate = params.maxGrowthRate ?? BANK_PVP_DEFAULTS.maxGrowthRate;
    const minRoe = params.minRoe ?? BANK_PVP_DEFAULTS.minRoe;
    const ke = params.costOfEquity ?? keFromMacro(getMacroAssumptionsSync());
    const { currentPrice: price, financials } = companyData;

    const roe5y = fiveYearAverage(companyData, 'roe');
    const payout = payoutOf(companyData);
    const vpa = toNumber(financials.vpa);
    const baseMetrics = { roe: roe5y, payout, vpa, costOfEquity: ke, pvp: toNumber(financials.pvp) };

    if (roe5y === null) return notApplicable('Sem histórico de ROE para estimar o P/VP justo.', baseMetrics);
    if (payout === null) return notApplicable('Sem payout (nem DY e P/L) para estimar o crescimento sustentável.', baseMetrics);
    if (vpa === null || !Number.isFinite(vpa) || vpa <= 0) {
      return notApplicable('Modelo não se aplica: valor patrimonial por ação ausente ou negativo.', baseMetrics);
    }

    const g = Math.min(roe5y * (1 - payout), maxGrowthRate);
    const spread = ke - g;
    const spreadOk = spread >= MIN_DISCOUNT_GROWTH_SPREAD - SPREAD_EPSILON;
    const pvpJusto = spreadOk ? fairPVP({ roe: roe5y, g, ke }) : null;
    const fairValue = pvpJusto === null ? null : vpa * pvpJusto;
    const discount = marginOfSafety(price, fairValue);
    const metrics = { ...baseMetrics, growthRate: g, fairPVP: pvpJusto };

    if (!spreadOk) {
      return notApplicable(
        `Ke de ${formatPct(ke)} menos crescimento de ${formatPct(g)} fica abaixo do mínimo de ${formatPct(MIN_DISCOUNT_GROWTH_SPREAD, { digits: 0 })}: o P/VP justo não é confiável.`,
        metrics,
        `Ke − g ≥ ${formatPct(MIN_DISCOUNT_GROWTH_SPREAD, { digits: 0 })}`
      );
    }

    const roeOk = roe5y >= minRoe;
    const belowFair = discount !== null && discount > 0;
    const criteria: StrategyAnalysis['criteria'] = [
      { label: `ROE médio de 5 anos ≥ ${formatPct(minRoe, { digits: 0 })}`, value: roeOk, description: `ROE médio: ${formatPct(roe5y)}` },
      {
        label: `Ke − g ≥ ${formatPct(MIN_DISCOUNT_GROWTH_SPREAD, { digits: 0 })}`,
        value: spreadOk,
        description: `Ke ${formatPct(ke)} · g ${formatPct(g)} (ROE × (1 − payout de ${formatPct(payout)}), teto de ${formatPct(maxGrowthRate, { digits: 0 })})`,
      },
      {
        label: 'Preço abaixo do valor estimado',
        value: belowFair,
        description: `P/VP justo ${formatMultiple(pvpJusto, { digits: 2 })} × VPA ${formatBRL(vpa)} = ${formatBRL(fairValue)}`,
      },
    ];

    const reasoning = pvpJusto === null
      ? `ROE médio de ${formatPct(roe5y)} não supera o crescimento de ${formatPct(g)}: sem P/VP justo positivo.`
      : [
          `P/VP justo de ${formatMultiple(pvpJusto, { digits: 2 })} = (ROE ${formatPct(roe5y)} − g ${formatPct(g)}) ÷ (Ke ${formatPct(ke)} − g).`,
          `Com VPA de ${formatBRL(vpa)}, o valor estimado é ${formatBRL(fairValue)} por ação, contra P/VP atual de ${formatMultiple(baseMetrics.pvp, { digits: 2 })}.`,
        ].join(' ');

    return {
      isEligible: roeOk && spreadOk && belowFair,
      score: (criteria.filter((c) => c.value).length / criteria.length) * 100,
      fairValue,
      upside: upsidePoints(price, fairValue),
      discount,
      reasoning,
      criteria,
      key_metrics: metrics,
    };
  }

  runRanking(companies: CompanyData[], params: BankPvpParams = {}): RankBuilderResult[] {
    let candidates = this.filterByAssetType(companies, params.assetTypeFilter);
    candidates = this.filterCompaniesBySize(candidates, params.companySize || 'all');

    const ranked = candidates
      .filter((company) => this.validateCompanyData(company))
      .map((company) => ({ company, analysis: this.runAnalysis(company, params) }))
      .filter(({ analysis }) => analysis.isEligible)
      .sort((a, b) => (b.analysis.upside ?? -Infinity) - (a.analysis.upside ?? -Infinity))
      .slice(0, params.limit ?? 50)
      .map(({ company, analysis }) => toRankingResult(company, analysis));

    return this.applyTechnicalPrioritization(ranked, companies, params.useTechnicalAnalysis);
  }

  generateRational(params: BankPvpParams = {}): string {
    const maxGrowthRate = params.maxGrowthRate ?? BANK_PVP_DEFAULTS.maxGrowthRate;
    const minRoe = params.minRoe ?? BANK_PVP_DEFAULTS.minRoe;

    return `# P/VP justo (bancos e seguradoras)

Fluxo de caixa descontado não funciona bem em bancos: dívida é matéria-prima, não financiamento. O P/VP justo compara o retorno sobre o patrimônio com o custo de capital.

## Fórmula

**P/VP justo = (ROE − g) ÷ (Ke − g)** e **valor estimado = VPA × P/VP justo**

- ROE: média dos últimos 5 anos.
- g: crescimento sustentável ROE × (1 − payout), limitado a ${formatPct(maxGrowthRate, { digits: 0 })}.
- Ke: custo de capital próprio pelas premissas macro (NTN-B + IPCA esperado + prêmio de risco, nunca abaixo da Selic).
- Exige Ke − g ≥ ${formatPct(MIN_DISCOUNT_GROWTH_SPREAD, { digits: 0 })}; abaixo disso o resultado fica instável.

## Critérios

- ROE médio ≥ ${formatPct(minRoe, { digits: 0 })} e preço abaixo do valor estimado.

Estimativa, não é recomendação de investimento.`;
  }
}
