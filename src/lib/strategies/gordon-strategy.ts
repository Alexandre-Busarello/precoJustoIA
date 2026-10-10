import {
  AbstractStrategy,
  companySectorClass,
  costOfEquityBRL,
  discountFraction,
  formatCurrency,
  formatPercent,
  isImplausibleUpside,
  macroAssumptions,
  notApplicableAnalysis,
  toNumber,
  upsidePercent,
} from './base-strategy';
import { extraordinaryEvents, removeExtraordinary, sumTTM, dedupedDividendEvents, type DividendEvent } from '../finance/dividends';
import { formatNumber, formatPct } from '../format';
import { gordonValue, MIN_DISCOUNT_GROWTH_SPREAD } from '../finance/valuation';
import type { SectorClass } from '../finance/sector-classification';
import { GordonParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';

/** Teto do crescimento perpétuo nominal dos dividendos (6%). */
export const GORDON_MAX_GROWTH = 0.06;
/** Crescimento usado quando o parâmetro não é informado. */
export const GORDON_DEFAULT_GROWTH = 0.05;
/**
 * Margem de segurança mínima (desconto 1 − P/VJ) para entrar no modelo: 10%, equivalente a ~11% de potencial.
 * Antes era "potencial ≥ 15%" fixo; com k = Ke (~16–19% com a Selic atual) e g ≤ 6%, o preço justo só passa do preço
 * para DY acima de ~11%, e o corte de 15% de potencial deixava o ranking praticamente vazio. Decisão registrada para o
 * dono do produto revisar; o desconto segue a mesma semântica de margem dos demais modelos.
 */
export const GORDON_MIN_DISCOUNT = 0.1;

/**
 * Beta por classe setorial (ajuste setorial do Ke): utilities reguladas têm risco menor; commodities cíclicas, maior.
 * Usa a classificação determinística de `sector-classification`, que entende os nomes da B3 e os traduzidos do Yahoo.
 */
const SECTOR_BETA: Record<SectorClass, number> = {
  utility: 0.8,
  financial: 1.0,
  cyclicalCommodity: 1.2,
  other: 1.0,
};

const SECTOR_LABEL: Record<SectorClass, string> = {
  utility: 'utilidade pública',
  financial: 'financeiro',
  cyclicalCommodity: 'commodity cíclica',
  other: 'demais setores',
};

/**
 * D0 a partir do histórico: soma dos proventos com data-com nos últimos 12 meses, sem os pagamentos extraordinários
 * (`removeExtraordinary`: acima de 2× a mediana e sem repetição sazonal em outros anos). Passe o histórico de vários
 * anos para que os dividendos trimestrais/semestrais regulares sejam reconhecidos como recorrentes.
 */
export function dividendsTTM(events: readonly DividendEvent[], asOf: Date = new Date()): number {
  return sumTTM(removeExtraordinary(events), asOf);
}

/** Soma dos extraordinários descartados dentro da janela de 12 meses (para explicar o D0). */
export function extraordinaryTTM(events: readonly DividendEvent[], asOf: Date = new Date()): number {
  return sumTTM(extraordinaryEvents(events), asOf);
}

export interface GordonInputs {
  /** Proventos dos últimos 12 meses por ação (D0). */
  d0: number | null;
  d0Source: 'history' | 'dividendYield12m' | 'dy' | null;
  /** Extraordinários com data-com nos últimos 12 meses que ficaram fora do D0 (só com histórico). */
  excludedExtraordinary: number;
  /** Custo de capital próprio (k). */
  k: number;
  /** Crescimento perpétuo (g). */
  g: number;
  /** Crescimento sustentável ROE × (1 − payout), quando calculável. */
  sustainableGrowth: number | null;
  sectorClass: SectorClass;
  beta: number;
  dy: number | null;
  roe: number | null;
  payout: number | null;
}

export class GordonStrategy extends AbstractStrategy<GordonParams> {
  readonly name = 'gordon';

  /**
   * Insumos do modelo, os mesmos na análise e no ranking:
   * - D0 = soma dos proventos com data-com nos últimos 12 meses, sem extraordinários (ver `dividendsTTM`); sem
   *   histórico, DY 12m × preço. Nunca o último pagamento avulso.
   * - k = Ke pelas premissas macro com beta setorial (+ ajuste manual), nunca abaixo da Selic nem da taxa informada.
   * - g = min(parâmetro, ROE × (1 − payout), 6%), não negativo.
   */
  computeInputs(companyData: CompanyData, params: GordonParams): GordonInputs {
    const { financials, currentPrice, historicalFinancials } = companyData;
    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    const macro = macroAssumptions();
    const sectorClass = companySectorClass(companyData);
    const beta = params.useSectoralAdjustment === false ? 1 : SECTOR_BETA[sectorClass];
    const k = Math.max(costOfEquityBRL(beta, macro) + (params.sectoralWaccAdjustment ?? 0), macro.selic, params.discountRate ?? 0);

    const dy = this.getDividendYield(financials, use7YearAverages, historicalFinancials);
    const roe = this.getROE(financials, use7YearAverages, historicalFinancials);
    const payout = this.getIndicatorValue(financials, 'payout', use7YearAverages, historicalFinancials);
    const sustainableGrowth = roe !== null && payout !== null ? roe * (1 - Math.min(Math.max(payout, 0), 1)) : null;
    const growthCap = Math.min(params.dividendGrowthRate ?? GORDON_DEFAULT_GROWTH, GORDON_MAX_GROWTH);
    const g = Math.max(0, sustainableGrowth === null ? growthCap : Math.min(growthCap, sustainableGrowth));

    let d0: number | null = null;
    let d0Source: GordonInputs['d0Source'] = null;
    let excludedExtraordinary = 0;
    const events = companyData.dividendHistory ? dedupedDividendEvents(companyData.dividendHistory) : [];
    if (events.length > 0) {
      d0 = dividendsTTM(events);
      excludedExtraordinary = extraordinaryTTM(events);
      d0Source = 'history';
    } else {
      const dividendYield12m = toNumber(financials.dividendYield12m);
      const currentDy = toNumber(financials.dy);
      if (dividendYield12m && dividendYield12m > 0 && currentPrice > 0) {
        d0 = dividendYield12m * currentPrice;
        d0Source = 'dividendYield12m';
      } else if (currentDy && currentDy > 0 && currentPrice > 0) {
        d0 = currentDy * currentPrice;
        d0Source = 'dy';
      }
    }

    return { d0, d0Source, excludedExtraordinary, k, g, sustainableGrowth, sectorClass, beta, dy, roe, payout };
  }

  validateCompanyData(companyData: CompanyData, params: GordonParams): boolean {
    if (companyData.currentPrice <= 0) return false;
    const { d0 } = this.computeInputs(companyData, params);
    return d0 !== null && d0 > 0;
  }

  runAnalysis(companyData: CompanyData, params: GordonParams): StrategyAnalysis {
    const { financials, currentPrice, historicalFinancials, ticker } = companyData;
    const bdrReason = this.bdrNotApplicableReason(companyData);
    if (bdrReason) return notApplicableAnalysis(bdrReason);

    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    const isBDR = this.isBDRTicker(ticker);
    const inputs = this.computeInputs(companyData, params);
    const { d0, k, g, dy, roe, payout, sectorClass } = inputs;
    const spreadOk = k - g >= MIN_DISCOUNT_GROWTH_SPREAD - 1e-9;

    let fairValue = d0 !== null && spreadOk ? gordonValue({ d0, g, k }) : null;
    let implausible = false;
    if (fairValue !== null) fairValue *= this.perReceiptFactor(companyData);
    if (fairValue !== null && isImplausibleUpside(currentPrice, fairValue)) {
      fairValue = null;
      implausible = true;
    }
    const upside = upsidePercent(currentPrice, fairValue);
    const discount = discountFraction(currentPrice, fairValue);
    const meetsMinDiscount = discount !== null && discount >= GORDON_MIN_DISCOUNT - 1e-9;

    const dividendYield12m = toNumber(financials.dividendYield12m);
    const crescimentoLucros = toNumber(financials.crescimentoLucros);
    const cagrLucros5a = toNumber(financials.cagrLucros5a);
    const liquidezCorrente = this.getLiquidezCorrente(financials, false, historicalFinancials);
    const dividaLiquidaPl = this.getDividaLiquidaPl(financials, use7YearAverages, historicalFinancials);
    const dividaLiquidaEbitda = toNumber(financials.dividaLiquidaEbitda);

    const minDY = isBDR ? 0.03 : 0.04;
    const minDY12m = isBDR ? 0.02 : 0.03;
    const maxPayout = isBDR ? 0.9 : 0.8;
    const minROE = 0.12;
    const minLiquidez = isBDR ? 1.0 : 1.2;
    const maxDividaLiquidaPl = isBDR ? 1.5 : 1.0;

    const criteria = [
      {
        label: `Margem de segurança ≥ ${formatPct(GORDON_MIN_DISCOUNT, { digits: 0 })}`,
        value: meetsMinDiscount,
        description: `Margem: ${discount === null ? 'N/A' : formatPercent(discount)}; potencial: ${upside === null ? 'N/A' : formatPercent(upside / 100)}`,
      },
      { label: `Dividend yield ≥ ${formatPct(minDY, { digits: 0 })}`, value: !!(dy && dy >= minDY), description: `DY: ${formatPercent(dy)}` },
      { label: `DY 12m ≥ ${formatPct(minDY12m, { digits: 0 })}`, value: !dividendYield12m || dividendYield12m >= minDY12m, description: `DY 12m: ${formatPercent(dividendYield12m)}` },
      { label: `Payout ≤ ${formatPct(maxPayout, { digits: 0 })}`, value: !payout || payout <= maxPayout, description: `Payout: ${formatPercent(payout)}` },
      { label: `ROE ≥ ${formatPct(minROE, { digits: 0 })}`, value: !roe || roe >= minROE, description: `ROE: ${formatPercent(roe)}` },
      {
        label: 'Crescimento dos lucros ≥ −20%',
        value: !crescimentoLucros || crescimentoLucros >= -0.2 || !!(cagrLucros5a && cagrLucros5a > 0),
        description: `Crescimento: ${formatPercent(crescimentoLucros)}${cagrLucros5a && cagrLucros5a > 0 ? ` (CAGR 5a: ${formatPercent(cagrLucros5a)})` : ''}`,
      },
      ...(sectorClass === 'financial'
        ? []
        : [
            { label: `Liquidez corrente ≥ ${formatNumber(minLiquidez, { digits: 1 })}`, value: !liquidezCorrente || liquidezCorrente >= minLiquidez, description: `LC: ${formatNumber(liquidezCorrente, { digits: 2 })}` },
            sectorClass === 'utility'
              ? { label: 'Dív. líq./EBITDA ≤ 3,5', value: dividaLiquidaEbitda === null || dividaLiquidaEbitda <= 3.5, description: `Dív. líq./EBITDA: ${formatNumber(dividaLiquidaEbitda, { digits: 2 })}` }
              : { label: `Dív. líq./PL ≤ ${formatPct(maxDividaLiquidaPl, { digits: 0 })}`, value: !dividaLiquidaPl || dividaLiquidaPl <= maxDividaLiquidaPl, description: `Dív/PL: ${formatNumber(dividaLiquidaPl, { digits: 2 })}` },
          ]),
    ];

    const passedCriteria = criteria.filter((c) => c.value).length;
    const hasMinimumCriteria = passedCriteria >= criteria.length - 2;
    const isEligible = hasMinimumCriteria && fairValue !== null && meetsMinDiscount;
    const score = (passedCriteria / criteria.length) * 100;

    const d0Label =
      inputs.d0Source === 'history'
        ? inputs.excludedExtraordinary > 0
          ? `soma dos proventos dos últimos 12 meses, sem ${formatCurrency(inputs.excludedExtraordinary)} em extraordinários`
          : 'soma dos proventos dos últimos 12 meses; nenhum extraordinário identificado'
        : inputs.d0Source === 'dividendYield12m'
          ? 'DY 12 meses × preço'
          : inputs.d0Source === 'dy'
            ? 'DY × preço'
            : 'sem dados de proventos';
    const parameters = `D0 ${formatCurrency(d0)} (${d0Label}), g ${formatPercent(g)}, k ${formatPercent(k)} (Ke com beta ${formatNumber(inputs.beta, { digits: 1 })}, ${SECTOR_LABEL[sectorClass]}).`;

    const reasons: string[] = [];
    if (d0 === null || d0 <= 0) reasons.push('sem proventos nos últimos 12 meses');
    if (!spreadOk) reasons.push(`spread k − g de ${formatPercent(k - g)}, abaixo do mínimo de 4 p.p.`);
    if (implausible) reasons.push('estimativa fora da faixa plausível (potencial acima de 500%)');
    if (fairValue !== null && !meetsMinDiscount) {
      reasons.push(
        discount !== null && discount < 0
          ? 'preço acima do preço justo estimado'
          : `margem de segurança de ${formatPercent(discount ?? 0)}, abaixo de ${formatPct(GORDON_MIN_DISCOUNT, { digits: 0 })}`,
      );
    }
    if (!hasMinimumCriteria) reasons.push(`${passedCriteria} de ${criteria.length} critérios atendidos`);

    const verdict =
      fairValue === null
        ? 'Não foi possível estimar o preço justo pelos dividendos'
        : `Preço justo de ${formatCurrency(fairValue)} = D1 ${formatCurrency((d0 ?? 0) * (1 + g))} ÷ (k − g)`;
    const bdrNote = this.bdrConversionNote(companyData);
    const reasoning = `${verdict}. ${parameters}${
      isEligible ? ` Margem de segurança de ${formatPercent(discount)}.` : reasons.length > 0 ? ` Fora do modelo: ${reasons.join('; ')}.` : ''
    }${bdrNote ? ` ${bdrNote}` : ''}`;

    return {
      fairValue,
      upside,
      discount,
      isEligible,
      score,
      criteria,
      reasoning,
      key_metrics: {
        d0,
        d1: d0 !== null ? d0 * (1 + g) : null,
        costOfEquity: k,
        growthRate: g,
        sustainableGrowth: inputs.sustainableGrowth,
        adjustedDiscountRate: k,
        adjustedGrowthRate: g,
        dy,
        roe,
        payout,
      },
    };
  }

  runRanking(companies: CompanyData[], params: GordonParams): RankBuilderResult[] {
    const results: RankBuilderResult[] = [];

    let filteredCompanies = this.filterCompaniesByOverallScore(companies, 50);
    filteredCompanies = this.filterTickerEndingDigits(filteredCompanies);
    filteredCompanies = this.filterByAssetType(filteredCompanies, params.assetTypeFilter);
    filteredCompanies = this.filterCompaniesBySize(filteredCompanies, params.companySize || 'all');

    for (const company of filteredCompanies) {
      if (!this.validateCompanyData(company, params)) continue;
      const analysis = this.runAnalysis(company, params);
      if (!analysis.isEligible || analysis.fairValue === null) continue;
      if (this.shouldExcludeCompany(company)) continue;

      // Score composto com as mesmas métricas (médias) da análise individual.
      const metrics = analysis.key_metrics ?? {};
      const dy = metrics.dy ?? null;
      const roe = metrics.roe ?? null;
      const payout = metrics.payout ?? null;
      const cagrLucros5a = toNumber(company.financials.cagrLucros5a);
      const crescimentoLucros = toNumber(company.financials.crescimentoLucros);
      const considerGrowth = !!(cagrLucros5a && cagrLucros5a > 0);
      const upsideScore = analysis.upside ? Math.min(Math.max(analysis.upside, 0) / 50, 1) : 0;
      const dyScore = dy ? Math.min(dy / 0.12, 1) : 0;
      const roeScore = roe ? Math.min(roe / 0.25, 1) : 0;
      const payoutScore = payout ? 1 - Math.min(payout / 0.8, 1) : 0;
      const growthScore = considerGrowth && crescimentoLucros ? Math.min(Math.max(0, crescimentoLucros + 0.2), 0.3) / 0.3 : 0;
      const compositeScore = considerGrowth
        ? (upsideScore * 0.35 + dyScore * 0.25 + roeScore * 0.2 + payoutScore * 0.1 + growthScore * 0.1) * 100
        : (upsideScore * 0.4 + dyScore * 0.3 + roeScore * 0.2 + payoutScore * 0.1) * 100;

      const result = this.convertToRankingResult(company, analysis);
      results.push({ ...result, key_metrics: { ...metrics, compositeScore: Number(compositeScore.toFixed(1)) } });
    }

    const sortedResults = results.sort((a, b) => (b.key_metrics?.compositeScore || 0) - (a.key_metrics?.compositeScore || 0));
    const uniqueResults = this.removeDuplicateCompanies(sortedResults);
    return this.applyTechnicalPrioritization(uniqueResults, companies, params.useTechnicalAnalysis);
  }

  generateRational(params: GordonParams): string {
    const macro = macroAssumptions();
    const sectoral = params.useSectoralAdjustment !== false;
    const growthCap = Math.min(params.dividendGrowthRate ?? GORDON_DEFAULT_GROWTH, GORDON_MAX_GROWTH);

    return `# Modelo de Gordon (desconto de dividendos)

**Ideia**: o preço justo é o valor presente dos dividendos futuros, crescendo a uma taxa constante: D1 ÷ (k − g). É uma estimativa sensível às premissas.

## Premissas

- **D0**: soma dos proventos (dividendos e JCP brutos) com data-com nos últimos 12 meses, sem os extraordinários: pagamentos acima de 2× a mediana que não se repetem na mesma época de outros anos. Sem histórico, DY 12 meses × preço. D1 = D0 × (1 + g).
- **k (custo de capital próprio)**: NTN-B longa + IPCA 12 meses + beta × prêmio de risco (hoje ${formatPercent(costOfEquityBRL(1, macro))} com beta 1), nunca abaixo da Selic (${formatPercent(macro.selic)}). Uma taxa informada só vale quando é maior.
- **g (crescimento perpétuo)**: o menor entre ${formatPercent(growthCap)}, ROE × (1 − payout) e 6%.
- **Spread mínimo**: k − g de pelo menos 4 p.p.; abaixo disso o modelo não se aplica.
- **Ajuste setorial**: ${sectoral ? 'ativado (beta 0,8 para utilidade pública, 1,2 para commodities cíclicas, 1,0 para os demais)' : 'desativado (beta 1,0 para todos)'}.

## Critérios

- Dividend yield ≥ 4% e payout ≤ 80%
- ROE ≥ 12%
- Margem de segurança (1 − preço ÷ preço justo) ≥ 10%, cerca de 11% de potencial
- Bancos e seguradoras não são avaliados por liquidez corrente nem por dívida/PL; utilidade pública usa dívida líquida/EBITDA ≤ 3,5.

**Ordenação**: score composto (potencial, dividend yield, ROE, payout e crescimento)${params.useTechnicalAnalysis ? ', com priorização técnica (sobrevenda) dentro de faixas de resultados semelhantes' : ''}.`;
  }
}
