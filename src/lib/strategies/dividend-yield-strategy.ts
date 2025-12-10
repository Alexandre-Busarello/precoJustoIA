import { AbstractStrategy, toNumber, formatPercent } from './base-strategy';
import { DividendYieldParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';

export class DividendYieldStrategy extends AbstractStrategy<DividendYieldParams> {
  readonly name = 'dividendYield';

  validateCompanyData(companyData: CompanyData, params: DividendYieldParams): boolean {
    const { financials } = companyData;
    const { minYield } = params;
    // Dar benefício da dúvida - só requer dividend yield mínimo
    return !!(
      financials.dy && toNumber(financials.dy)! >= minYield
    );
  }

  runAnalysis(companyData: CompanyData, params: DividendYieldParams): StrategyAnalysis {
    const { financials, historicalFinancials, ticker } = companyData;
    const { minYield } = params;
    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    const isBDR = this.isBDRTicker(ticker);
    
    const dy = this.getDividendYield(financials, use7YearAverages, historicalFinancials);
    const roe = this.getROE(financials, use7YearAverages, historicalFinancials);
    const liquidezCorrente = this.getLiquidezCorrente(financials, use7YearAverages, historicalFinancials);
    const dividaLiquidaPl = this.getDividaLiquidaPl(financials, use7YearAverages, historicalFinancials);
    const pl = this.getPL(financials, false, historicalFinancials);
    const margemLiquida = this.getMargemLiquida(financials, use7YearAverages, historicalFinancials);
    const marketCap = toNumber(financials.marketCap);
    const roic = this.getROIC(financials, use7YearAverages, historicalFinancials);

    // Ajustar critérios para BDRs (empresas americanas pagam menos dividendos, mas são mais estáveis)
    const minROE = isBDR ? 0.12 : 0.10; // ROE mínimo mais alto para BDRs (12% vs 10%)
    const minLiquidez = isBDR ? 1.0 : 1.2; // Liquidez pode ser menor para BDRs
    const maxDividaLiquidaPl = isBDR ? 1.5 : 1.0; // Mais tolerante com dívida para BDRs (150% vs 100%)
    const maxPL = isBDR ? 30 : 25; // P/L máximo mais alto para BDRs (30 vs 25)
    const minMargemLiquida = isBDR ? 0.05 : 0.05; // Mesmo padrão
    const minMarketCap = isBDR ? 2000000000 : 1000000000; // Market Cap maior para BDRs (R$ 2B vs R$ 1B)

    const criteria = [
      { label: `Dividend Yield ≥ ${(minYield * 100).toFixed(0)}%`, value: !!(dy && dy >= minYield), description: `DY: ${formatPercent(dy)}` },
      { label: `ROE ≥ ${(minROE * 100).toFixed(0)}%${isBDR ? ' (BDR)' : ''}`, value: !roe || roe >= minROE, description: `ROE: ${formatPercent(roe) || 'N/A - Benefício da dúvida'}` },
      { label: `Liquidez Corrente ≥ ${minLiquidez.toFixed(1)}${isBDR ? ' (BDR)' : ''}`, value: !liquidezCorrente || liquidezCorrente >= minLiquidez, description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A - Benefício da dúvida'}` },
      { label: `Dív. Líq./PL ≤ ${(maxDividaLiquidaPl * 100).toFixed(0)}%${isBDR ? ' (BDR)' : ''}`, value: !dividaLiquidaPl || dividaLiquidaPl <= maxDividaLiquidaPl, description: `Dív/PL: ${dividaLiquidaPl?.toFixed(1) || 'N/A - Benefício da dúvida'}` },
      { label: `P/L entre 4-${maxPL}${isBDR ? ' (BDR)' : ''}`, value: !pl || (pl >= 4 && pl <= maxPL), description: `P/L: ${pl?.toFixed(1) || 'N/A - Benefício da dúvida'}` },
      { label: `Margem Líquida ≥ ${(minMargemLiquida * 100).toFixed(0)}%`, value: !margemLiquida || margemLiquida >= minMargemLiquida, description: `Margem: ${formatPercent(margemLiquida) || 'N/A - Benefício da dúvida'}` },
      { label: `Market Cap ≥ ${isBDR ? 'R$ 2B' : 'R$ 1B'}${isBDR ? ' (BDR)' : ''}`, value: !marketCap || marketCap >= minMarketCap, description: `Market Cap: ${marketCap ? `R$ ${(marketCap / 1000000000).toFixed(1)}B` : 'N/A - Benefício da dúvida'}` }
    ];
    
    const passedCriteria = criteria.filter(c => c.value).length;
    const isEligible = passedCriteria >= 5 && !!dy && dy >= minYield; // Reduzido para dar benefício da dúvida
    const score = (passedCriteria / criteria.length) * 100;

    // Calcular sustainability score como no backend
    let sustainabilityScore = (
      Math.min(roe || 0, 0.30) * 25 +
      Math.min(liquidezCorrente || 0, 3) * 15 +
      Math.max(0, 50 - (dividaLiquidaPl || 0) * 50) +
      Math.min(margemLiquida || 0, 0.20) * 75 +
      Math.min(roic || 0, 0.25) * 20 +
      (dy || 0) * 50
    );

    if (sustainabilityScore > 100) sustainabilityScore = 100;
    
    return {
      isEligible,
      score,
      fairValue: null,
      upside: dy ? (dy * 100) : null,
      reasoning: isEligible 
        ? `✅ Aprovada no Anti-Dividend Trap com DY ${formatPercent(dy)}. Score de sustentabilidade: ${sustainabilityScore.toFixed(1)}/100.`
        : `❌ Empresa pode ser dividend trap (${passedCriteria}/7 critérios aprovados).`,
      criteria,
      key_metrics: {
        dividendYield: dy,
        sustainabilityScore: Number(sustainabilityScore.toFixed(1)),
        roe: roe,
        pl: pl,
        marketCap: marketCap
      }
    };
  }

  runRanking(companies: CompanyData[], params: DividendYieldParams): RankBuilderResult[] {
    const { minYield } = params;
    const results: RankBuilderResult[] = [];

    // Filtrar empresas por overall_score > 50 (remover empresas ruins)
    let filteredCompanies = this.filterCompaniesByOverallScore(companies, 50);
    
    // Filtrar tickers que terminam em 5, 6, 7, 8 ou 9
    filteredCompanies = this.filterTickerEndingDigits(filteredCompanies);
    
    // Filtrar por tipo de ativo primeiro (b3, bdr, both)
    filteredCompanies = this.filterByAssetType(filteredCompanies, params.assetTypeFilter);
    
    // Filtrar empresas por tamanho se especificado
    filteredCompanies = this.filterCompaniesBySize(filteredCompanies, params.companySize || 'all');

    for (const company of filteredCompanies) {
      // EXCLUSÃO AUTOMÁTICA: Verificar critérios de exclusão
      if (this.shouldExcludeCompany(company)) continue;
      
      // Validação customizada para ranking
      const { financials } = company;
      if (!(
        financials.dy && toNumber(financials.dy)! >= minYield &&
        financials.roe && toNumber(financials.roe)! >= 0.10 &&
        financials.liquidezCorrente && toNumber(financials.liquidezCorrente)! >= 1.2 &&
        (!financials.dividaLiquidaPl || toNumber(financials.dividaLiquidaPl)! <= 1.0) &&
        financials.pl && toNumber(financials.pl)! >= 5 && toNumber(financials.pl)! <= 25 &&
        financials.margemLiquida && toNumber(financials.margemLiquida)! >= 0.05 &&
        financials.marketCap && toNumber(financials.marketCap)! >= 1000000000
      )) continue;

      const { currentPrice, historicalFinancials } = company;
      const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
      const dy = this.getDividendYield(financials, use7YearAverages, historicalFinancials)!;
      const pl = this.getPL(financials, false, historicalFinancials);
      const roe = this.getROE(financials, use7YearAverages, historicalFinancials) || 0;
      const liquidezCorrente = this.getLiquidezCorrente(financials, use7YearAverages, historicalFinancials) || 0;
      const dividaLiquidaPl = this.getDividaLiquidaPl(financials, use7YearAverages, historicalFinancials) || 0;
      const margemLiquida = this.getMargemLiquida(financials, use7YearAverages, historicalFinancials) || 0;
      const marketCap = toNumber(financials.marketCap);
      const roic = this.getROIC(financials, use7YearAverages, historicalFinancials) || 0;

      // Calcular "Score de Qualidade" para evitar dividend traps
      let sustainabilityScore = (
        Math.min(roe, 0.30) * 25 +       // ROE forte (peso 25%)
        Math.min(liquidezCorrente, 3) * 15 +           // Liquidez adequada (peso alto)
        Math.max(0, 50 - dividaLiquidaPl * 50) +        // Penaliza alta dívida
        Math.min(margemLiquida, 0.20) * 75 +         // Margem líquida saudável
        Math.min(roic, 0.25) * 20 +       // ROIC para eficiência
        dy * 50                   // DY ainda importa, mas não domina
      );

      if (sustainabilityScore > 100) sustainabilityScore = 100;

      results.push({
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice,
        logoUrl: company.logoUrl,
        fairValue: null,
        upside: null,
        marginOfSafety: null,
        rational: `Aprovada no Anti-Dividend Trap Model com DY ${dy.toFixed(1)}%. Empresa sustentável: ROE ${roe.toFixed(1)}%, LC ${liquidezCorrente.toFixed(2)}, Margem Líquida ${margemLiquida.toFixed(1)}%. Score de sustentabilidade: ${Number(sustainabilityScore.toFixed(1))}/100. Evita dividend traps.`,
        key_metrics: {
          dy: dy,
          sustainabilityScore: Number(sustainabilityScore.toFixed(1)),
          pl: pl,
          roe: roe,
          roic: roic,
          liquidezCorrente: liquidezCorrente,
          dividaLiquidaPl: dividaLiquidaPl,
          margemLiquida: margemLiquida,
          marketCapBi: marketCap ? Number((marketCap / 1000000000).toFixed(1)) : null,
        }
      });
    }

    // Ordenar por Score de Sustentabilidade
    const sortedResults = results
      .sort((a, b) => (b.key_metrics?.sustainabilityScore || 0) - (a.key_metrics?.sustainabilityScore || 0));

    // Remover empresas duplicadas (manter apenas o primeiro ticker de cada empresa)
    const uniqueResults = this.removeDuplicateCompanies(sortedResults);
    
    // Aplicar limite
    const limitedResults = uniqueResults.slice(0, 50);

    // Aplicar priorização técnica se habilitada
    return this.applyTechnicalPrioritization(limitedResults, companies, params.useTechnicalAnalysis);
  }

  generateRational(params: DividendYieldParams): string {
    return `# MODELO ANTI-DIVIDEND TRAP

**Filosofia**: Focado em renda passiva sustentável, evitando empresas que pagam dividendos altos mas estão em declínio.

**Estratégia**: Dividend Yield ≥ ${(params.minYield * 100).toFixed(1)}% + rigorosos filtros de sustentabilidade.

**Problema Resolvido**: Elimina "dividend traps" - empresas com DY artificial por queda no preço ou dividendos insustentáveis.

## Filtros Anti-Trap

- ROE ≥ 10% (rentabilidade forte e consistente)
- Liquidez Corrente ≥ 1.2 (capacidade real de pagar dividendos)
- P/L entre 4-25 (evita preços artificiais ou empresas caras demais)
- Margem Líquida ≥ 5% (lucratividade real e saudável)
- Dívida Líquida/PL ≤ 100% (não comprometida por dívidas)
- Market Cap ≥ R$ 1B (tamanho e liquidez adequados)

**Ordenação**: Por Score de Sustentabilidade (combina DY + saúde financeira)${params.useTechnicalAnalysis ? ' + Priorização por Análise Técnica (ativos em sobrevenda primeiro)' : ''}.

**Objetivo**: Renda passiva de qualidade, não armadilhas disfarçadas${params.useTechnicalAnalysis ? '. Com análise técnica ativa, priorizamos ativos em sobrevenda para melhor timing de entrada' : ''}.`;
  }
}
