import { AbstractStrategy, companySectorClass, formatPercent, notApplicableAnalysis, toNumber } from './base-strategy';
import { magicFormulaRank } from '../finance/valuation';
import { formatBRLCompact, formatNumber, formatPct } from '../format';
import { MagicFormulaParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';

/** Earnings yield mínimo padrão (EBIT/EV de 8%). */
export const MAGIC_FORMULA_DEFAULT_MIN_EY = 0.08;
/** ROIC mínimo padrão na análise individual. */
export const MAGIC_FORMULA_DEFAULT_MIN_ROIC = 0.15;

const EXCLUDED_REASON =
  'Modelo não se aplica a bancos, seguradoras e empresas de utilidade pública: a Fórmula Mágica de Greenblatt exclui esses setores, cujo capital e lucro operacional não são comparáveis.';

/** Earnings yield de Greenblatt: EBIT ÷ EV = 1 ÷ (EV/EBIT). `null` com EV/EBIT ausente ou ≤ 0. */
export function greenblattEarningsYield(companyData: CompanyData): number | null {
  const evEbit = toNumber(companyData.financials.evEbit);
  return evEbit !== null && Number.isFinite(evEbit) && evEbit > 0 ? 1 / evEbit : null;
}

/** Financeiras e utilities ficam fora do método. */
export function isExcludedFromMagicFormula(companyData: CompanyData): boolean {
  const cls = companySectorClass(companyData);
  return cls === 'financial' || cls === 'utility';
}

export class MagicFormulaStrategy extends AbstractStrategy<MagicFormulaParams> {
  readonly name = 'magicFormula';

  validateCompanyData(companyData: CompanyData, params: MagicFormulaParams): boolean {
    const { minROIC = 0, minEY = 0 } = params;
    const roic = toNumber(companyData.financials.roic);
    const earningsYield = greenblattEarningsYield(companyData);
    return roic !== null && roic > 0 && roic >= minROIC && earningsYield !== null && earningsYield >= minEY;
  }

  runAnalysis(companyData: CompanyData, params: MagicFormulaParams): StrategyAnalysis {
    const { financials, historicalFinancials, ticker } = companyData;
    if (isExcludedFromMagicFormula(companyData)) return notApplicableAnalysis(EXCLUDED_REASON);

    const { minROIC = MAGIC_FORMULA_DEFAULT_MIN_ROIC, minEY = MAGIC_FORMULA_DEFAULT_MIN_EY } = params;
    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    const isBDR = this.isBDRTicker(ticker);

    const roic = this.getROIC(financials, use7YearAverages, historicalFinancials);
    const earningsYield = greenblattEarningsYield(companyData);
    const roe = this.getROE(financials, use7YearAverages, historicalFinancials);
    const crescimentoReceitas = toNumber(financials.crescimentoReceitas);
    const margemLiquida = this.getMargemLiquida(financials, use7YearAverages, historicalFinancials);
    const liquidezCorrente = this.getLiquidezCorrente(financials, false, historicalFinancials);
    const dividaLiquidaPl = this.getDividaLiquidaPl(financials, use7YearAverages, historicalFinancials);
    const marketCap = toNumber(financials.marketCap);

    const effectiveMinROIC = isBDR ? Math.max(minROIC, 0.12) : minROIC;
    const effectiveMinEY = isBDR ? Math.min(minEY, 0.05) : minEY;
    const minROE = isBDR ? 0.12 : 0.15;
    const minMargemLiquida = 0.05;
    const minLiquidez = isBDR ? 1.0 : 1.2;
    const maxDividaLiquidaPl = isBDR ? 2.0 : 1.5;
    const minMarketCap = isBDR ? 3_000_000_000 : 1_000_000_000;

    const criteria = [
      { label: `ROIC ≥ ${formatPct(effectiveMinROIC, { digits: 0 })}`, value: !!(roic && roic >= effectiveMinROIC), description: `ROIC: ${formatPercent(roic)}` },
      {
        label: `Earnings yield (EBIT/EV) ≥ ${formatPct(effectiveMinEY, { digits: 0 })}`,
        value: earningsYield !== null && earningsYield >= effectiveMinEY,
        description: `EBIT/EV: ${formatPercent(earningsYield)}`,
      },
      { label: `ROE ≥ ${formatPct(minROE, { digits: 0 })}`, value: !roe || roe >= minROE, description: `ROE: ${formatPercent(roe)}` },
      { label: 'Crescimento das receitas ≥ −5%', value: !crescimentoReceitas || crescimentoReceitas >= -0.05, description: `Crescimento: ${formatPercent(crescimentoReceitas)}` },
      { label: `Margem líquida ≥ ${formatPct(minMargemLiquida, { digits: 0 })}`, value: !margemLiquida || margemLiquida >= minMargemLiquida, description: `Margem: ${formatPercent(margemLiquida)}` },
      { label: `Liquidez corrente ≥ ${formatNumber(minLiquidez, { digits: 1 })}`, value: !liquidezCorrente || liquidezCorrente >= minLiquidez, description: `LC: ${formatNumber(liquidezCorrente, { digits: 2 })}` },
      { label: `Dív. líq./PL ≤ ${formatPct(maxDividaLiquidaPl, { digits: 0 })}`, value: !dividaLiquidaPl || dividaLiquidaPl <= maxDividaLiquidaPl, description: `Dív/PL: ${formatNumber(dividaLiquidaPl, { digits: 2 })}` },
      {
        label: `Market cap ≥ ${isBDR ? 'R$ 3 bi' : 'R$ 1 bi'}`,
        value: !marketCap || marketCap >= minMarketCap,
        description: `Market cap: ${marketCap ? formatBRLCompact(marketCap) : 'N/A'}`,
      },
    ];

    const passedCriteria = criteria.filter((c) => c.value).length;
    const isEligible = passedCriteria >= 6 && criteria[0].value && criteria[1].value;
    const score = (passedCriteria / criteria.length) * 100;

    // Score de leitura rápida (0–100): ROIC e EBIT/EV dominam; ROE, margem e crescimento complementam.
    const magicScore = Math.min(
      100,
      Math.min(roic || 0, 0.5) * 100 +
        Math.min(earningsYield || 0, 0.25) * 200 +
        Math.min(roe || 0, 0.3) * 50 +
        Math.min(margemLiquida || 0, 0.3) * 50 +
        Math.max(0, (crescimentoReceitas || 0) + 0.05) * 80
    );

    return {
      isEligible,
      score,
      fairValue: null,
      upside: null,
      discount: null,
      reasoning: isEligible
        ? `Atende à Fórmula Mágica: ROIC de ${formatPercent(roic)} e earnings yield (EBIT/EV) de ${formatPercent(earningsYield)}. Score: ${formatNumber(magicScore, { digits: 1 })}/100. No ranking, a posição vem da soma das posições por ROIC e por EBIT/EV.`
        : `Não atende aos critérios mínimos da Fórmula Mágica (${passedCriteria} de ${criteria.length} critérios; ROIC e EBIT/EV são obrigatórios).`,
      criteria,
      key_metrics: {
        roic,
        earningsYield,
        magicScore: Number(magicScore.toFixed(1)),
        roe,
        margemLiquida,
      },
    };
  }

  runRanking(companies: CompanyData[], params: MagicFormulaParams): RankBuilderResult[] {
    let filteredCompanies = this.filterCompaniesByOverallScore(companies, 50);
    filteredCompanies = this.filterTickerEndingDigits(filteredCompanies);
    filteredCompanies = this.filterByAssetType(filteredCompanies, params.assetTypeFilter);
    filteredCompanies = this.filterCompaniesBySize(filteredCompanies, params.companySize || 'all');

    const universe = filteredCompanies.filter(
      (company) => !isExcludedFromMagicFormula(company) && this.validateCompanyData(company, params) && !this.shouldExcludeCompany(company)
    );
    const byTicker = new Map(universe.map((company) => [company.ticker, company]));

    // Greenblatt: posição por ROIC + posição por EBIT/EV, ordenado pela soma (menor é melhor).
    const ranked = magicFormulaRank(
      universe.map((company) => ({ id: company.ticker, roic: toNumber(company.financials.roic), evEbit: toNumber(company.financials.evEbit) }))
    );
    const total = ranked.length;

    const results: RankBuilderResult[] = ranked.map((item) => {
      const company = byTicker.get(String(item.id))!;
      const { financials, currentPrice } = company;
      const roe = toNumber(financials.roe);
      const margemLiquida = toNumber(financials.margemLiquida);
      const crescimentoReceitas = toNumber(financials.crescimentoReceitas);
      // Score 0–100 pela posição combinada (1º lugar = 100).
      const magicScore = total > 0 ? Math.round(100 * (1 - (item.position - 1) / total)) : 0;
      return {
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice,
        logoUrl: company.logoUrl,
        fairValue: null,
        upside: null,
        marginOfSafety: null,
        rational: `Posição ${item.position} de ${total} na Fórmula Mágica: ${item.roicRank}º em ROIC (${formatPercent(item.roic)}) e ${item.eyRank}º em earnings yield (EBIT/EV de ${formatPercent(item.earningsYield)}), soma ${item.combinedRank}. ROE ${formatPercent(roe)}, margem líquida ${formatPercent(margemLiquida)}, crescimento das receitas ${formatPercent(crescimentoReceitas)}.`,
        key_metrics: {
          magicScore,
          roic: item.roic,
          earningsYield: item.earningsYield,
          roicRank: item.roicRank,
          eyRank: item.eyRank,
          combinedRank: item.combinedRank,
          roe,
          margemLiquida,
          dy: toNumber(financials.dy),
          liquidezCorrente: toNumber(financials.liquidezCorrente),
          crescimentoReceitas,
        },
      };
    });

    const uniqueResults = this.removeDuplicateCompanies(results);
    const limit = params.limit ?? 50;
    return this.applyTechnicalPrioritization(uniqueResults.slice(0, limit), companies, params.useTechnicalAnalysis);
  }

  generateRational(params: MagicFormulaParams): string {
    const { minROIC = 0, minEY = 0 } = params;
    return `# Fórmula Mágica (Joel Greenblatt)

**Ideia**: encontrar bons negócios a preços razoáveis, combinando retorno sobre o capital e preço baixo em relação ao lucro operacional.

## Como o ranking é montado

- **ROIC** (retorno sobre o capital investido): qualidade do negócio${minROIC > 0 ? `, mínimo de ${formatPercent(minROIC)}` : ''}.
- **Earnings yield = EBIT ÷ EV** (o inverso de EV/EBIT): preço em relação ao lucro operacional, considerando a dívida${minEY > 0 ? `, mínimo de ${formatPercent(minEY)}` : ''}.
- Cada empresa recebe uma posição por ROIC e outra por earnings yield; o ranking ordena pela **soma das duas posições** (menor é melhor).
- Ficam de fora bancos, seguradoras e empresas de utilidade pública, como no método original, e empresas com ROIC ou EBIT não positivos.

**Ordenação**: soma das posições${params.useTechnicalAnalysis ? ', com priorização técnica (sobrevenda) dentro de faixas de resultados semelhantes' : ''}.`;
  }
}
