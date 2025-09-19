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
    const { financials } = companyData;
    const { minYield } = params;
    
    const dy = toNumber(financials.dy);
    const roe = toNumber(financials.roe);
    const liquidezCorrente = toNumber(financials.liquidezCorrente);
    const dividaLiquidaPl = toNumber(financials.dividaLiquidaPl);
    const pl = toNumber(financials.pl);
    const margemLiquida = toNumber(financials.margemLiquida);
    const marketCap = toNumber(financials.marketCap);
    const roic = toNumber(financials.roic);

    const criteria = [
      { label: `Dividend Yield ≥ ${(minYield * 100).toFixed(0)}%`, value: !!(dy && dy >= minYield), description: `DY: ${formatPercent(dy)}` },
      { label: 'ROE ≥ 10%', value: !roe || roe >= 0.10, description: `ROE: ${formatPercent(roe) || 'N/A - Benefício da dúvida'}` },
      { label: 'Liquidez Corrente ≥ 1.2', value: !liquidezCorrente || liquidezCorrente >= 1.2, description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A - Benefício da dúvida'}` },
      { label: 'Dív. Líq./PL ≤ 100%', value: !dividaLiquidaPl || dividaLiquidaPl <= 1.0, description: `Dív/PL: ${dividaLiquidaPl?.toFixed(1) || 'N/A - Benefício da dúvida'}` },
      { label: 'P/L entre 4-25', value: !pl || (pl >= 4 && pl <= 25), description: `P/L: ${pl?.toFixed(1) || 'N/A - Benefício da dúvida'}` },
      { label: 'Margem Líquida ≥ 5%', value: !margemLiquida || margemLiquida >= 0.05, description: `Margem: ${formatPercent(margemLiquida) || 'N/A - Benefício da dúvida'}` },
      { label: 'Market Cap ≥ R$ 1B', value: !marketCap || marketCap >= 1000000000, description: `Market Cap: ${marketCap ? `R$ ${(marketCap / 1000000000).toFixed(1)}B` : 'N/A - Benefício da dúvida'}` }
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

    // Filtrar empresas por tamanho se especificado
    const filteredCompanies = this.filterCompaniesBySize(companies, params.companySize || 'all');

    for (const company of filteredCompanies) {
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

      const { currentPrice } = company;
      const dy = toNumber(financials.dy)!;
      const pl = toNumber(financials.pl);
      const roe = toNumber(financials.roe) || 0;
      const liquidezCorrente = toNumber(financials.liquidezCorrente) || 0;
      const dividaLiquidaPl = toNumber(financials.dividaLiquidaPl) || 0;
      const margemLiquida = toNumber(financials.margemLiquida) || 0;
      const marketCap = toNumber(financials.marketCap);
      const roic = toNumber(financials.roic) || 0;

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
    return results
      .sort((a, b) => (b.key_metrics?.sustainabilityScore || 0) - (a.key_metrics?.sustainabilityScore || 0))
      .slice(0, 50);
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

**Ordenação**: Por Score de Sustentabilidade (combina DY + saúde financeira).

**Objetivo**: Renda passiva de qualidade, não armadilhas disfarçadas.`;
  }
}
