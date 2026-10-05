import { AbstractStrategy, companySectorClass, toNumber, formatPercent } from './base-strategy';
import { formatBRLCompact, formatNumber, formatPct } from '../format';
import { LowPEParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';

export class LowPEStrategy extends AbstractStrategy<LowPEParams> {
  readonly name = 'lowPE';

  validateCompanyData(companyData: CompanyData, params: LowPEParams): boolean {
    const { financials } = companyData;
    const { maxPE } = params;
    // Dar benefício da dúvida - só requer P/L válido
    return !!(
      financials.pl && toNumber(financials.pl)! > 3 && toNumber(financials.pl)! <= maxPE
    );
  }

  runAnalysis(companyData: CompanyData, params: LowPEParams): StrategyAnalysis {
    const { financials, historicalFinancials, ticker } = companyData;
    const { maxPE, minROE = 0.15 } = params;
    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    const isBDR = this.isBDRTicker(ticker);
    // Bancos e seguradoras não têm liquidez corrente nem dívida líquida/PL comparáveis: esses critérios não se aplicam.
    const isFinancialCompany = companySectorClass(companyData) === 'financial';
    
    const pl = this.getPL(financials, false, historicalFinancials);
    const roe = this.getROE(financials, use7YearAverages, historicalFinancials);
    const crescimentoReceitas = toNumber(financials.crescimentoReceitas);
    const margemLiquida = this.getMargemLiquida(financials, use7YearAverages, historicalFinancials);
    const liquidezCorrente = this.getLiquidezCorrente(financials, false, historicalFinancials);
    const roa = toNumber(financials.roa);
    const dividaLiquidaPl = this.getDividaLiquidaPl(financials, use7YearAverages, historicalFinancials);
    const marketCap = toNumber(financials.marketCap);
    const roic = this.getROIC(financials, use7YearAverages, historicalFinancials);

    // Ajustar critérios para BDRs (mercado internacional aceita P/E mais alto)
    const effectiveMaxPE = isBDR ? Math.max(maxPE, 25) : maxPE; // P/E máximo mais alto para BDRs (mínimo 25)
    const effectiveMinROE = isBDR ? Math.max(minROE, 0.12) : minROE; // ROE mínimo mais alto para BDRs (mínimo 12%)
    const minMargemLiquida = isBDR ? 0.05 : 0.03; // Margem líquida mínima mais alta para BDRs (5% vs 3%)
    const maxDividaLiquidaPl = isBDR ? 2.5 : 2.0; // Mais tolerante com dívida para BDRs (250% vs 200%)
    const minMarketCap = isBDR ? 2000000000 : 500000000; // Market Cap maior para BDRs (R$ 2B vs R$ 500M)

    const criteria = [
      { label: `P/L entre 3 e ${effectiveMaxPE}`, value: !!(pl && pl > 3 && pl <= effectiveMaxPE), description: `P/L: ${formatNumber(pl, { digits: 1 })}` },
      { label: `ROE ≥ ${formatPct(effectiveMinROE, { digits: 0 })}`, value: !roe || roe >= effectiveMinROE, description: `ROE: ${formatPercent(roe)}` },
      { label: 'Crescimento das receitas ≥ −10%', value: !crescimentoReceitas || crescimentoReceitas >= -0.10, description: `Crescimento: ${formatPercent(crescimentoReceitas)}` },
      { label: `Margem líquida ≥ ${formatPct(minMargemLiquida, { digits: 0 })}`, value: !margemLiquida || margemLiquida >= minMargemLiquida, description: `Margem: ${formatPercent(margemLiquida)}` },
      ...(isFinancialCompany
        ? []
        : [{ label: 'Liquidez corrente ≥ 1,0', value: !liquidezCorrente || liquidezCorrente >= 1.0, description: `LC: ${formatNumber(liquidezCorrente, { digits: 2 })}` }]),
      { label: 'ROA ≥ 5%', value: !roa || roa >= 0.05, description: `ROA: ${formatPercent(roa)}` },
      ...(isFinancialCompany
        ? []
        : [{ label: `Dív. líq./PL ≤ ${formatPct(maxDividaLiquidaPl, { digits: 0 })}`, value: !dividaLiquidaPl || dividaLiquidaPl <= maxDividaLiquidaPl, description: `Dív/PL: ${formatNumber(dividaLiquidaPl, { digits: 2 })}` }]),
      { label: `Market cap ≥ ${isBDR ? 'R$ 2 bi' : 'R$ 500 mi'}`, value: !marketCap || marketCap >= minMarketCap, description: `Market cap: ${marketCap ? formatBRLCompact(marketCap) : 'N/A'}` }
    ];
    
    const passedCriteria = criteria.filter(c => c.value).length;
    const isEligible = passedCriteria >= criteria.length - 2 && !!pl && pl > 3 && pl <= effectiveMaxPE;
    const score = (passedCriteria / criteria.length) * 100;

    // Calcular value score como no backend
    let valueScore = (
      Math.max(0, 50 - (pl || 0) * 2) +
      Math.min(roe || 0, 0.30) * 50 +
      Math.min(roa || 0, 0.20) * 100 +
      Math.min(margemLiquida || 0, 0.20) * 80 +
      Math.max(0, (crescimentoReceitas || 0) + 0.10) * 30 +
      Math.min(roic || 0, 0.25) * 40
    );

    if (valueScore > 100) valueScore = 100;
    
    return {
      isEligible,
      score,
      fairValue: null,
      upside: null,
      reasoning: isEligible 
        ? `Atende ao modelo P/L baixo com qualidade: P/L de ${formatNumber(pl, { digits: 1 })} (teto fixo de ${effectiveMaxPE}) com rentabilidade e crescimento dentro dos filtros. Score de valor: ${formatNumber(valueScore, { digits: 1 })}/100.`
        : `Não atende ao modelo P/L baixo com qualidade (${passedCriteria} de ${criteria.length} critérios); pode ser uma armadilha de valor.`,
      criteria,
      key_metrics: {
        pl: pl,
        valueScore: Number(valueScore.toFixed(1)),
        roe: roe,
        roa: roa,
        roic: roic
      }
    };
  }

  runRanking(companies: CompanyData[], params: LowPEParams): RankBuilderResult[] {
    const { maxPE, minROE = 0.15 } = params;
    const results: RankBuilderResult[] = [];

    // Filtrar empresas por overall_score > 50 (remover empresas ruins)
    let filteredCompanies = this.filterCompaniesByOverallScore(companies, 50);
    
    // Filtrar tickers que terminam em 5, 6, 7, 8 ou 9
    filteredCompanies = this.filterTickerEndingDigits(filteredCompanies);
    
    // Filtrar por tipo de ativo primeiro (b3, bdr, both)
    filteredCompanies = this.filterByAssetType(filteredCompanies, params.assetTypeFilter);

    for (const company of filteredCompanies) {
      if (!this.validateCompanyData(company, params)) continue;
      
      // EXCLUSÃO AUTOMÁTICA: Verificar critérios de exclusão
      if (this.shouldExcludeCompany(company)) continue;

      const { financials, currentPrice, ticker } = company;
      const isBDR = this.isBDRTicker(ticker);
      const pl = toNumber(financials.pl)!;
      const roe = toNumber(financials.roe) || 0;
      const roa = toNumber(financials.roa) || 0;
      const margemLiquida = toNumber(financials.margemLiquida) || 0;
      const liquidezCorrente = toNumber(financials.liquidezCorrente) || 0;
      const crescimentoReceitas = toNumber(financials.crescimentoReceitas) || 0;
      const roic = toNumber(financials.roic) || 0;

      // Ajustar critérios para BDRs
      const effectiveMaxPE = isBDR ? Math.max(maxPE, 25) : maxPE;
      const effectiveMinROE = isBDR ? Math.max(minROE, 0.12) : minROE;
      
      // Verificar se atende aos critérios ajustados
      if (pl > effectiveMaxPE || roe < effectiveMinROE) continue;

      // Score de value investing (qualidade + preço baixo)
      // Para BDRs, ajustar peso do P/L (mercado aceita P/E mais alto)
      const plWeight = isBDR ? 1.5 : 2.0; // Menor penalização por P/L alto para BDRs
      let valueScore = (
        Math.max(0, 50 - pl * plWeight) +         // Premia P/L baixo (ajustado para BDRs)
        Math.min(roe, 0.30) * 50 +          // ROE forte
        Math.min(roa, 0.20) * 100 +          // ROA eficiente
        Math.min(margemLiquida, 0.20) * 80 +            // Margem saudável
        Math.max(0, crescimentoReceitas + 0.10) * 30 +   // Crescimento não negativo
        Math.min(roic, 0.25) * 40           // ROIC para qualidade
      );

      if (valueScore > 100) valueScore = 100;

      results.push({
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice,
        logoUrl: company.logoUrl,
        fairValue: null,
        upside: null,
        marginOfSafety: null,
        rational: `P/L de ${formatNumber(pl, { digits: 1 })} (teto fixo de ${effectiveMaxPE}) com ROE de ${formatPercent(roe)}, ROA de ${formatPercent(roa)} e margem líquida de ${formatPercent(margemLiquida)}. Crescimento das receitas: ${formatPercent(crescimentoReceitas)}. Score de valor: ${formatNumber(valueScore, { digits: 1 })}/100.`,
        key_metrics: {
          pl: pl,
          valueScore: Number(valueScore.toFixed(1)),
          roe: roe,
          roa: roa,
          roic: roic,
          dy: toNumber(financials.dy),
          liquidezCorrente: liquidezCorrente,
          margemLiquida: margemLiquida,
          crescimentoReceitas: crescimentoReceitas,
        }
      });
    }

    // Ordenar por Value Score
    const sortedResults = results
      .sort((a, b) => (b.key_metrics?.valueScore || 0) - (a.key_metrics?.valueScore || 0));

    // Remover empresas duplicadas (manter apenas o primeiro ticker de cada empresa)
    const uniqueResults = this.removeDuplicateCompanies(sortedResults);
    
    // Aplicar limite
    const limitedResults = uniqueResults.slice(0, 50);

    // Aplicar priorização técnica se habilitada
    return this.applyTechnicalPrioritization(limitedResults, companies, params.useTechnicalAnalysis);
  }

  generateRational(params: LowPEParams): string {
    const { maxPE, minROE = 0 } = params;
    return `# P/L baixo com qualidade

**Ideia**: value investing clássico. Empresas com P/L baixo que mantêm rentabilidade e crescimento, filtrando armadilhas de valor (ações baratas por um motivo).

**Critério de preço**: P/L entre 3 e ${maxPE}, um teto fixo (não é uma comparação com a média do setor). Para BDRs, o teto sobe para 25.

**Rentabilidade**: ROE ≥ ${formatPercent(minROE)}.

## Filtros contra armadilhas de valor

- P/L acima de 3 (evita lucros não recorrentes ou preços distorcidos)
- ROA ≥ 5%
- Crescimento das receitas ≥ −10%
- Margem líquida ≥ 3%
- Liquidez corrente ≥ 1,0 e dívida líquida/PL ≤ 200% (não se aplicam a bancos e seguradoras)
- Market cap ≥ R$ 500 milhões

**Ordenação**: score de valor (P/L baixo e indicadores de qualidade)${params.useTechnicalAnalysis ? ', com priorização técnica (sobrevenda) dentro de faixas de resultados semelhantes' : ''}.`;
  }
}
