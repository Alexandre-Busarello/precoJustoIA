import { AbstractStrategy, averageOfLatest, companySectorClass, formatPercent, toNumber } from './base-strategy';
import type { SectorClass } from '../finance/sector-classification';
import { formatBRLCompact, formatNumber, formatPct } from '../format';
import { DividendYieldParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';
import { STRATEGY_CONFIG } from './strategy-config';

/** Perfil de critérios por tipo de negócio. */
type DividendProfile = 'financial' | 'utility' | 'general';

function profileOf(cls: SectorClass): DividendProfile {
  if (cls === 'financial') return 'financial';
  if (cls === 'utility') return 'utility';
  return 'general';
}

const PROFILE_LABEL: Record<DividendProfile, string> = {
  financial: 'critérios de bancos e seguradoras',
  utility: 'critérios de utilidade pública',
  general: 'critérios gerais',
};

/** Financeiras: ROE médio de 5 anos ≥ 12% e payout entre 25% e 80%. */
const FINANCIAL_MIN_ROE_5Y = 0.12;
const FINANCIAL_PAYOUT_RANGE = { min: 0.25, max: 0.8 } as const;
/** Utilities: dívida líquida/EBITDA ≤ 3,5 no lugar de dívida líquida/PL ≤ 1. */
const UTILITY_MAX_NET_DEBT_EBITDA = 3.5;

interface DividendMetrics {
  profile: DividendProfile;
  dy: number | null;
  roe: number | null;
  roe5y: number | null;
  payout: number | null;
  liquidezCorrente: number | null;
  dividaLiquidaPl: number | null;
  dividaLiquidaEbitda: number | null;
  pl: number | null;
  margemLiquida: number | null;
  marketCap: number | null;
  roic: number | null;
  consistentProfits: boolean;
}

/** DY mínimo informado, ou o padrão do modelo (4%) quando a chamada não traz o parâmetro. */
function minYieldOf(params: DividendYieldParams): number {
  const value = toNumber(params.minYield);
  return value !== null && value >= 0 ? value : STRATEGY_CONFIG.dividendYield.minYield;
}

export class DividendYieldStrategy extends AbstractStrategy<DividendYieldParams> {
  readonly name = 'dividendYield';

  validateCompanyData(companyData: CompanyData, params: DividendYieldParams): boolean {
    const dy = toNumber(companyData.financials.dy);
    return dy !== null && dy >= minYieldOf(params);
  }

  private metrics(companyData: CompanyData, params: DividendYieldParams): DividendMetrics {
    const { financials, historicalFinancials } = companyData;
    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    const roeHistory = [...(historicalFinancials ?? [])].sort((a, b) => (b.year || 0) - (a.year || 0)).map((row) => toNumber(row.roe));
    return {
      profile: profileOf(companySectorClass(companyData)),
      dy: this.getDividendYield(financials, use7YearAverages, historicalFinancials),
      roe: this.getROE(financials, use7YearAverages, historicalFinancials),
      roe5y: averageOfLatest([toNumber(financials.roe), ...roeHistory], 5)?.average ?? null,
      payout: toNumber(financials.payout),
      liquidezCorrente: this.getLiquidezCorrente(financials, false, historicalFinancials),
      dividaLiquidaPl: this.getDividaLiquidaPl(financials, use7YearAverages, historicalFinancials),
      dividaLiquidaEbitda: toNumber(financials.dividaLiquidaEbitda),
      pl: this.getPL(financials, false, historicalFinancials),
      margemLiquida: this.getMargemLiquida(financials, use7YearAverages, historicalFinancials),
      marketCap: toNumber(financials.marketCap),
      roic: this.getROIC(financials, use7YearAverages, historicalFinancials),
      consistentProfits: this.hasConsistentProfits(companyData),
    };
  }

  runAnalysis(companyData: CompanyData, params: DividendYieldParams): StrategyAnalysis {
    const minYield = minYieldOf(params);
    const isBDR = this.isBDRTicker(companyData.ticker);
    const m = this.metrics(companyData, params);
    const { profile, dy, roe, roe5y, payout, liquidezCorrente, dividaLiquidaPl, dividaLiquidaEbitda, pl, margemLiquida, marketCap, roic } = m;

    const minROE = isBDR ? 0.12 : 0.1;
    const minLiquidez = isBDR ? 1.0 : 1.2;
    const maxDividaLiquidaPl = isBDR ? 1.5 : 1.0;
    const maxPL = isBDR ? 30 : 25;
    const minMargemLiquida = 0.05;
    const minMarketCap = isBDR ? 2_000_000_000 : 1_000_000_000;

    const dyCriterion = { label: `Dividend yield ≥ ${formatPercent(minYield)}`, value: !!(dy && dy >= minYield), description: `DY: ${formatPercent(dy)}` };
    const plCriterion = { label: `P/L entre 4 e ${maxPL}`, value: !pl || (pl >= 4 && pl <= maxPL), description: `P/L: ${formatNumber(pl, { digits: 1 })}` };
    const marketCapCriterion = {
      label: `Market cap ≥ ${isBDR ? 'R$ 2 bi' : 'R$ 1 bi'}`,
      value: !marketCap || marketCap >= minMarketCap,
      description: `Market cap: ${marketCap ? formatBRLCompact(marketCap) : 'N/A'}`,
    };

    const criteria =
      profile === 'financial'
        ? [
            dyCriterion,
            { label: `ROE médio de 5 anos ≥ ${formatPercent(FINANCIAL_MIN_ROE_5Y)}`, value: roe5y !== null && roe5y >= FINANCIAL_MIN_ROE_5Y, description: `ROE médio: ${formatPercent(roe5y)}` },
            {
              label: `Payout entre ${formatPercent(FINANCIAL_PAYOUT_RANGE.min)} e ${formatPercent(FINANCIAL_PAYOUT_RANGE.max)}`,
              value: payout !== null && payout >= FINANCIAL_PAYOUT_RANGE.min && payout <= FINANCIAL_PAYOUT_RANGE.max,
              description: `Payout: ${formatPercent(payout)}`,
            },
            { label: 'Lucros consistentes', value: m.consistentProfits, description: m.consistentProfits ? 'Sem prejuízos recorrentes no histórico' : 'Prejuízos no histórico recente' },
            plCriterion,
            marketCapCriterion,
          ]
        : [
            dyCriterion,
            { label: `ROE ≥ ${formatPercent(minROE)}`, value: !roe || roe >= minROE, description: `ROE: ${formatPercent(roe)}` },
            { label: `Liquidez corrente ≥ ${formatNumber(minLiquidez, { digits: 1 })}`, value: !liquidezCorrente || liquidezCorrente >= minLiquidez, description: `LC: ${formatNumber(liquidezCorrente, { digits: 2 })}` },
            profile === 'utility'
              ? {
                  label: `Dív. líq./EBITDA ≤ ${formatNumber(UTILITY_MAX_NET_DEBT_EBITDA, { digits: 1 })}`,
                  value: dividaLiquidaEbitda === null || dividaLiquidaEbitda <= UTILITY_MAX_NET_DEBT_EBITDA,
                  description: `Dív. líq./EBITDA: ${formatNumber(dividaLiquidaEbitda, { digits: 2 })}`,
                }
              : {
                  label: `Dív. líq./PL ≤ ${formatPct(maxDividaLiquidaPl, { digits: 0 })}`,
                  value: !dividaLiquidaPl || dividaLiquidaPl <= maxDividaLiquidaPl,
                  description: `Dív/PL: ${formatNumber(dividaLiquidaPl, { digits: 2 })}`,
                },
            plCriterion,
            { label: `Margem líquida ≥ ${formatPercent(minMargemLiquida)}`, value: !margemLiquida || margemLiquida >= minMargemLiquida, description: `Margem: ${formatPercent(margemLiquida)}` },
            marketCapCriterion,
          ];

    const passedCriteria = criteria.filter((c) => c.value).length;
    const isEligible = passedCriteria >= criteria.length - 2 && dyCriterion.value;
    const score = (passedCriteria / criteria.length) * 100;
    const sustainabilityScore = this.sustainabilityScore(m);

    return {
      isEligible,
      score,
      fairValue: null,
      upside: null,
      discount: null,
      reasoning: isEligible
        ? `Atende ao modelo anti-armadilha (${PROFILE_LABEL[profile]}) com DY de ${formatPercent(dy)}. Score de sustentabilidade: ${formatNumber(sustainabilityScore, { digits: 1 })}/100.`
        : `Pode ser uma armadilha de dividendos: ${passedCriteria} de ${criteria.length} ${PROFILE_LABEL[profile]} atendidos.`,
      criteria,
      key_metrics: {
        dividendYield: dy,
        sustainabilityScore: Number(sustainabilityScore.toFixed(1)),
        roe,
        roe5y,
        payout,
        pl,
        marketCap,
        roic,
      },
    };
  }

  /**
   * Score de sustentabilidade (0–100): rentabilidade, margem e DY para todos; a parte de saúde financeira segue o perfil
   * (liquidez e dívida/PL em geral; dívida/EBITDA em utilities; payout e consistência de lucro em financeiras).
   */
  private sustainabilityScore(m: DividendMetrics): number {
    const base = Math.min(m.roe || 0, 0.3) * 25 + Math.min(m.margemLiquida || 0, 0.2) * 75 + Math.min(m.roic || 0, 0.25) * 20 + (m.dy || 0) * 50;
    let health: number;
    if (m.profile === 'financial') {
      const payoutInRange = m.payout !== null && m.payout >= FINANCIAL_PAYOUT_RANGE.min && m.payout <= FINANCIAL_PAYOUT_RANGE.max;
      health = (payoutInRange ? 25 : 0) + (m.consistentProfits ? 25 : 0) + Math.min((m.roe5y || 0) / 0.2, 1) * 45;
    } else if (m.profile === 'utility') {
      const leverage = m.dividaLiquidaEbitda ?? 0;
      health = Math.min(m.liquidezCorrente || 0, 3) * 15 + Math.max(0, 50 - (Math.max(leverage, 0) / UTILITY_MAX_NET_DEBT_EBITDA) * 50);
    } else {
      health = Math.min(m.liquidezCorrente || 0, 3) * 15 + Math.max(0, 50 - (m.dividaLiquidaPl || 0) * 50);
    }
    return Math.min(100, base + health);
  }

  runRanking(companies: CompanyData[], params: DividendYieldParams): RankBuilderResult[] {
    const results: RankBuilderResult[] = [];

    let filteredCompanies = this.filterCompaniesByOverallScore(companies, 50);
    filteredCompanies = this.filterTickerEndingDigits(filteredCompanies);
    filteredCompanies = this.filterByAssetType(filteredCompanies, params.assetTypeFilter);
    filteredCompanies = this.filterCompaniesBySize(filteredCompanies, params.companySize || 'all');

    for (const company of filteredCompanies) {
      if (!this.validateCompanyData(company, params)) continue;
      // Mesmos critérios por tipo de negócio da página do ativo, mas no ranking ROE e P/L precisam existir.
      const analysis = this.runAnalysis(company, params);
      const metrics = analysis.key_metrics ?? {};
      if (!analysis.isEligible || metrics.roe === null || metrics.roe === undefined || metrics.pl === null || metrics.pl === undefined) continue;
      if (this.shouldExcludeCompany(company)) continue;

      const m = this.metrics(company, params);
      results.push({
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice: company.currentPrice,
        logoUrl: company.logoUrl,
        fairValue: null,
        upside: null,
        marginOfSafety: null,
        rational: `Atende ao modelo anti-armadilha (${PROFILE_LABEL[m.profile]}) com DY de ${formatPercent(m.dy)}: ROE de ${formatPercent(m.profile === 'financial' ? m.roe5y : m.roe)}${m.profile === 'financial' ? ' (média de 5 anos)' : ''}, ${
          m.profile === 'financial'
            ? `payout de ${formatPercent(m.payout)}`
            : m.profile === 'utility'
              ? `dívida líquida/EBITDA de ${formatNumber(m.dividaLiquidaEbitda, { digits: 2 })}`
              : `liquidez corrente de ${formatNumber(m.liquidezCorrente, { digits: 2 })}`
        }, margem líquida de ${formatPercent(m.margemLiquida)}. Score de sustentabilidade: ${metrics.sustainabilityScore ?? 0}/100.`,
        key_metrics: {
          dy: m.dy,
          sustainabilityScore: metrics.sustainabilityScore ?? null,
          pl: m.pl,
          roe: m.roe,
          roic: m.roic,
          payout: m.payout,
          liquidezCorrente: m.liquidezCorrente,
          dividaLiquidaPl: m.dividaLiquidaPl,
          dividaLiquidaEbitda: m.dividaLiquidaEbitda,
          margemLiquida: m.margemLiquida,
          marketCapBi: m.marketCap ? Number((m.marketCap / 1_000_000_000).toFixed(1)) : null,
        },
      });
    }

    const sortedResults = results.sort((a, b) => (b.key_metrics?.sustainabilityScore || 0) - (a.key_metrics?.sustainabilityScore || 0));
    const uniqueResults = this.removeDuplicateCompanies(sortedResults);
    return this.applyTechnicalPrioritization(uniqueResults.slice(0, 50), companies, params.useTechnicalAnalysis);
  }

  generateRational(params: DividendYieldParams): string {
    return `# Anti-armadilha de dividendos

**Ideia**: renda passiva sustentável, evitando empresas com dividend yield alto por queda de preço ou por dividendos que o lucro não sustenta.

**Critério de entrada**: dividend yield ≥ ${formatPercent(minYieldOf(params))}.

## Critérios por tipo de negócio

**Empresas em geral**
- ROE ≥ 10% e margem líquida ≥ 5%
- Liquidez corrente ≥ 1,2 e dívida líquida/PL ≤ 100%
- P/L entre 4 e 25 e market cap ≥ R$ 1 bilhão

**Utilidade pública** (energia, saneamento, gás)
- Os mesmos critérios, com dívida líquida/EBITDA ≤ 3,5 no lugar de dívida líquida/PL (são negócios naturalmente alavancados)

**Bancos e seguradoras**
- ROE médio de 5 anos ≥ 12%
- Payout entre 25% e 80%
- Lucros consistentes no histórico
- Sem liquidez corrente nem dívida/PL, que não se aplicam a instituições financeiras

**Ordenação**: score de sustentabilidade (DY e saúde financeira)${params.useTechnicalAnalysis ? ', com priorização técnica (sobrevenda) dentro de faixas de resultados semelhantes' : ''}.`;
  }
}
