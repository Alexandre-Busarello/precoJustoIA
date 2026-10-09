import {
  AbstractStrategy,
  averageOfLatest,
  companySectorClass,
  discountFraction,
  formatCurrency,
  formatPercent,
  isImplausibleUpside,
  notApplicableAnalysis,
  toNumber,
  upsidePercent,
} from './base-strategy';
import { formatBRLCompact, formatNumber, formatPct } from '../format';
import { GrahamParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';

/** Rótulo do modelo: √(22,5 × LPA × VPA) é o preço máximo do investidor defensivo (P/L 15 × P/VP 1,5), não um valor justo. */
export const GRAHAM_LABEL = 'Número de Graham (preço máximo defensivo)';

/** Anos usados no LPA normalizado. */
const NORMALIZED_EPS_YEARS = 5;
/** Mínimo de anos para normalizar o LPA: 3 em geral; 2 para commodities cíclicas, que sempre usam a média. */
const MIN_YEARS_GENERAL = 3;
const MIN_YEARS_CYCLICAL = 2;

export interface GrahamEps {
  /** LPA usado na fórmula. */
  value: number | null;
  current: number | null;
  /** Anos na média (1 = LPA atual, sem normalização). */
  years: number;
  normalized: boolean;
  cyclical: boolean;
}

/**
 * LPA da fórmula: média dos últimos 5 anos (atual + histórico) quando há pelo menos 3 anos, e sempre para commodities
 * cíclicas (com 2 anos ou mais), que parecem baratíssimas no pico de lucro. Sem histórico suficiente, o LPA atual.
 */
export function grahamEps(companyData: CompanyData): GrahamEps {
  const current = toNumber(companyData.financials.lpa);
  const cyclical = companySectorClass(companyData) === 'cyclicalCommodity';
  // Um ano por linha, sem repetir o ano corrente (se o histórico trouxer a linha do ano de `financials`, o LPA atual
  // contaria duas vezes na média).
  const currentYear = toNumber((companyData.financials as { year?: unknown }).year);
  const seenYears = new Set<number>(currentYear !== null ? [currentYear] : []);
  const history = [...(companyData.historicalFinancials ?? [])]
    .sort((a, b) => (b.year || 0) - (a.year || 0))
    .filter((row) => {
      if (!row.year) return true;
      if (seenYears.has(row.year)) return false;
      seenYears.add(row.year);
      return true;
    })
    .map((row) => toNumber(row.lpa));
  const average = averageOfLatest([current, ...history], NORMALIZED_EPS_YEARS);
  const minYears = cyclical ? MIN_YEARS_CYCLICAL : MIN_YEARS_GENERAL;
  if (average && average.count >= minYears) {
    return { value: average.average, current, years: average.count, normalized: true, cyclical };
  }
  return { value: current, current, years: 1, normalized: false, cyclical };
}

export class GrahamStrategy extends AbstractStrategy<GrahamParams> {
  readonly name = 'graham';

  validateCompanyData(companyData: CompanyData): boolean {
    const eps = grahamEps(companyData).value;
    const vpa = toNumber(companyData.financials.vpa);
    return !!eps && eps > 0 && !!vpa && vpa > 0;
  }

  runAnalysis(companyData: CompanyData, params: GrahamParams = {}): StrategyAnalysis {
    const { financials, currentPrice, historicalFinancials, ticker } = companyData;
    const bdrReason = this.bdrNotApplicableReason(companyData);
    if (bdrReason) return notApplicableAnalysis(bdrReason);

    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    const isBDR = this.isBDRTicker(ticker);
    const isFinancialCompany = companySectorClass(companyData) === 'financial';

    const eps = grahamEps(companyData);
    const vpa = toNumber(financials.vpa);
    const roe = this.getROE(financials, use7YearAverages, historicalFinancials);
    const liquidezCorrente = this.getLiquidezCorrente(financials, false, historicalFinancials);
    const margemLiquida = this.getMargemLiquida(financials, use7YearAverages, historicalFinancials);
    const dividaLiquidaPl = this.getDividaLiquidaPl(financials, use7YearAverages, historicalFinancials);
    const crescimentoLucros = toNumber(financials.crescimentoLucros);
    const cagrLucros5a = toNumber(financials.cagrLucros5a);
    const marketCap = toNumber(financials.marketCap);

    let fairValue = this.calculateGrahamFairValue(eps.value, vpa);
    if (fairValue !== null) fairValue *= this.perReceiptFactor(companyData);
    let implausible = false;
    if (fairValue !== null && isImplausibleUpside(currentPrice, fairValue)) {
      fairValue = null;
      implausible = true;
    }
    const upside = upsidePercent(currentPrice, fairValue);
    const discount = discountFraction(currentPrice, fairValue);

    const minROE = isBDR ? 0.12 : 0.1;
    const minLiquidez = 1.0;
    const maxDividaLiquidaPl = isBDR ? 2.0 : 1.5;
    const minMarketCap = isBDR ? 5_000_000_000 : 2_000_000_000;
    const epsLabel = eps.normalized ? `LPA médio de ${eps.years} anos` : 'LPA';

    const criteria = [
      { label: 'Potencial ≥ 10%', value: upside !== null && upside >= 10, description: `Potencial: ${upside === null ? 'N/A' : formatPercent(upside / 100)}` },
      { label: `${epsLabel} positivo`, value: !!(eps.value && eps.value > 0), description: `${epsLabel}: ${formatCurrency(eps.value)}` },
      { label: 'VPA positivo', value: !!(vpa && vpa > 0), description: `VPA: ${formatCurrency(vpa)}` },
      { label: `ROE ≥ ${formatPct(minROE, { digits: 0 })}${isBDR ? ' (BDR)' : ''}`, value: !roe || roe >= minROE, description: `ROE: ${formatPercent(roe)}` },
      ...(isFinancialCompany
        ? []
        : [{ label: `Liquidez corrente ≥ ${formatNumber(minLiquidez, { digits: 1 })}`, value: !liquidezCorrente || liquidezCorrente >= minLiquidez, description: `LC: ${formatNumber(liquidezCorrente, { digits: 2 })}` }]),
      { label: 'Margem líquida positiva', value: !margemLiquida || margemLiquida > 0, description: `Margem: ${formatPercent(margemLiquida)}` },
      ...(isFinancialCompany
        ? []
        : [{ label: `Dív. líq./PL ≤ ${formatPct(maxDividaLiquidaPl, { digits: 0 })}`, value: !dividaLiquidaPl || dividaLiquidaPl <= maxDividaLiquidaPl, description: `Dív/PL: ${formatNumber(dividaLiquidaPl, { digits: 2 })}` }]),
      {
        label: 'Crescimento dos lucros ≥ −15%',
        value: !crescimentoLucros || crescimentoLucros >= -0.15 || !!(cagrLucros5a && cagrLucros5a > 0),
        description: `Crescimento: ${formatPercent(crescimentoLucros)}${cagrLucros5a && cagrLucros5a > 0 ? ` (CAGR 5a: ${formatPercent(cagrLucros5a)})` : ''}`,
      },
      { label: `Market cap ≥ ${isBDR ? 'R$ 5 bi' : 'R$ 2 bi'}`, value: !marketCap || marketCap >= minMarketCap, description: `Market cap: ${formatBRLCompact(marketCap)}` },
    ];

    const passedCriteria = criteria.filter((c) => c.value).length;
    const hasMinimumCriteria = passedCriteria >= criteria.length - 2;
    const hasMinimumUpside = upside !== null && upside >= 10;
    const isEligible = hasMinimumCriteria && fairValue !== null && hasMinimumUpside;
    const score = (passedCriteria / criteria.length) * 100;

    // Score de qualidade: 60% pela margem de segurança (33% de desconto = 50% de potencial = nota máxima), 40% fundamentos.
    const marginScore = discount !== null && discount > 0 ? Math.min(discount * 180, 60) : 0;
    const growthScore =
      cagrLucros5a && cagrLucros5a > 0 && crescimentoLucros ? Math.min(Math.max(0, crescimentoLucros + 0.15), 0.5) * 20 : 0;
    const fundamentalsScore =
      (Math.min(roe || 0, 0.25) * 60 + Math.min(liquidezCorrente || 0, 2.5) * 6 + Math.min(margemLiquida || 0, 0.15) * 67 + growthScore) * 0.4;
    const qualityScore = Math.min(100, marginScore + fundamentalsScore);

    const epsNote = eps.normalized
      ? `Usa o LPA normalizado (média de ${eps.years} anos: ${formatCurrency(eps.value)}; LPA atual ${formatCurrency(eps.current)})${eps.cyclical ? ', porque o lucro de commodities cíclicas oscila com o preço da commodity' : ''}.`
      : `Usa o LPA atual (${formatCurrency(eps.current)})${eps.cyclical ? '; o histórico é curto para normalizar o lucro desta commodity cíclica' : ''}.`;

    let reasoning: string;
    if (isEligible) {
      reasoning = `${GRAHAM_LABEL}: ${formatCurrency(fairValue)}, margem de segurança de ${formatPercent(discount)} (potencial de ${formatPercent((upside ?? 0) / 100)}). ${epsNote} Score de qualidade: ${formatNumber(qualityScore, { digits: 1 })}/100.`;
    } else {
      const reasons: string[] = [];
      if (!hasMinimumCriteria) reasons.push(`critérios fundamentais insuficientes (${passedCriteria} de ${criteria.length})`);
      if (implausible) reasons.push('estimativa fora da faixa plausível (potencial acima de 500%)');
      else if (fairValue === null) reasons.push('não foi possível calcular o número de Graham (LPA ou VPA não positivos)');
      if (fairValue !== null && !hasMinimumUpside) reasons.push(`potencial de ${formatPercent((upside ?? 0) / 100)}, abaixo de 10%`);
      reasoning = `${GRAHAM_LABEL}${fairValue !== null ? `: ${formatCurrency(fairValue)}` : ''}. Não atende ao modelo: ${reasons.join('; ')}. ${epsNote}`;
    }
    const bdrNote = this.bdrConversionNote(companyData);
    if (bdrNote) reasoning = `${reasoning} ${bdrNote}`;

    return {
      isEligible,
      score,
      fairValue,
      upside,
      discount,
      reasoning,
      criteria,
      key_metrics: {
        lpa: eps.current,
        lpaNormalizado: eps.normalized ? eps.value : null,
        lpaAnos: eps.years,
        vpa,
        qualityScore: Number(qualityScore.toFixed(1)),
        pl: toNumber(financials.pl),
        pvp: toNumber(financials.pvp),
        roe,
        liquidezCorrente,
        margemLiquida,
        crescimentoLucros,
      },
    };
  }

  runRanking(companies: CompanyData[], params: GrahamParams): RankBuilderResult[] {
    // Desconto mínimo (1 − preço ÷ preço justo); ver strategy-config para a conversão do antigo "upside mínimo".
    const minDiscount = params.marginOfSafety ?? 0.1667;
    const results: RankBuilderResult[] = [];

    let filteredCompanies = this.filterCompaniesByOverallScore(companies, 50);
    filteredCompanies = this.filterTickerEndingDigits(filteredCompanies);
    filteredCompanies = this.filterByAssetType(filteredCompanies, params.assetTypeFilter);
    filteredCompanies = this.filterCompaniesBySize(filteredCompanies, params.companySize || 'all');

    for (const company of filteredCompanies) {
      if (!this.validateCompanyData(company)) continue;
      const analysis = this.runAnalysis(company, params);
      const marketCap = toNumber(company.financials.marketCap);
      const minMarketCap = this.isBDRTicker(company.ticker) ? 5_000_000_000 : 2_000_000_000;
      if (analysis.fairValue === null || analysis.discount === null || analysis.discount === undefined) continue;
      if (analysis.discount < minDiscount || !marketCap || marketCap < minMarketCap) continue;
      if (this.shouldExcludeCompany(company)) continue;
      results.push(this.convertToRankingResult(company, analysis));
    }

    const sortedResults = results.sort((a, b) => (b.key_metrics?.qualityScore || 0) - (a.key_metrics?.qualityScore || 0));
    const uniqueResults = this.removeDuplicateCompanies(sortedResults);
    return this.applyTechnicalPrioritization(uniqueResults.slice(0, 50), companies, params.useTechnicalAnalysis);
  }

  generateRational(params: GrahamParams): string {
    return `# ${GRAHAM_LABEL}

**Ideia**: √(22,5 × LPA × VPA) é o preço máximo que o investidor defensivo de Benjamin Graham pagaria (P/L 15 × P/VP 1,5). É um teto conservador, não uma estimativa de valor justo, e foi calibrado para os juros dos EUA dos anos 1970.

**LPA normalizado**: média dos últimos 5 anos quando há histórico (sempre para commodities cíclicas, como petróleo, mineração, siderurgia e celulose), para não superestimar empresas no pico do lucro.

**Margem de segurança mínima**: ${formatPercent(params.marginOfSafety ?? 0.1667)} de desconto (1 − preço ÷ número de Graham).

## Filtros de qualidade

- ROE ≥ 10%
- Liquidez corrente ≥ 1,0 e dívida líquida/PL ≤ 150% (não se aplicam a bancos e seguradoras)
- Margem líquida positiva
- Crescimento dos lucros ≥ −15%

**Score de qualidade**: 60% margem de segurança, 40% fundamentos (ROE, liquidez, margem líquida).

**Ordenação**: por score de qualidade${params.useTechnicalAnalysis ? ', com priorização técnica (sobrevenda) dentro de faixas de resultados semelhantes' : ''}.`;
  }
}
