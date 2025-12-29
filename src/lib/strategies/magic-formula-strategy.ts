import { AbstractStrategy, toNumber, formatPercent } from './base-strategy';
import { MagicFormulaParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';

export class MagicFormulaStrategy extends AbstractStrategy<MagicFormulaParams> {
  readonly name = 'magicFormula';

  validateCompanyData(companyData: CompanyData, params: MagicFormulaParams): boolean {
    const { financials } = companyData;
    const { minROIC = 0, minEY = 0 } = params;
    // Dar benefício da dúvida - só requer dados essenciais para Magic Formula
    return !!(
      financials.roic && toNumber(financials.roic)! >= minROIC &&
      financials.earningsYield && toNumber(financials.earningsYield)! >= minEY
    );
  }

  runAnalysis(companyData: CompanyData, params: MagicFormulaParams): StrategyAnalysis {
    const { financials, historicalFinancials, ticker } = companyData;
    const { minROIC = 0.15, minEY = 0.8 } = params;
    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    const isBDR = this.isBDRTicker(ticker);
    
    const roic = this.getROIC(financials, use7YearAverages, historicalFinancials);
    const earningsYield = toNumber(financials.earningsYield);
    const roe = this.getROE(financials, use7YearAverages, historicalFinancials);
    const crescimentoReceitas = toNumber(financials.crescimentoReceitas);
    const margemLiquida = this.getMargemLiquida(financials, use7YearAverages, historicalFinancials);
    const liquidezCorrente = this.getLiquidezCorrente(financials, false, historicalFinancials);
    const dividaLiquidaPl = this.getDividaLiquidaPl(financials, use7YearAverages, historicalFinancials);
    const marketCap = toNumber(financials.marketCap);

    // Ajustar critérios para BDRs
    const effectiveMinROIC = isBDR ? Math.max(minROIC, 0.12) : minROIC; // ROIC mínimo pode ser um pouco menor para BDRs
    const effectiveMinEY = isBDR ? Math.max(minEY, 0.05) : minEY; // Earnings Yield mínimo menor para BDRs (mercado aceita P/E mais alto)
    const minROE = isBDR ? 0.12 : 0.15; // ROE mínimo um pouco menor para BDRs (12% vs 15%)
    const minMargemLiquida = isBDR ? 0.05 : 0.05; // Mesmo padrão
    const minLiquidez = isBDR ? 1.0 : 1.2; // Liquidez pode ser menor para BDRs
    const maxDividaLiquidaPl = isBDR ? 2.0 : 1.5; // Mais tolerante com dívida para BDRs (200% vs 150%)
    const minMarketCap = isBDR ? 3000000000 : 1000000000; // Market Cap maior para BDRs (R$ 3B vs R$ 1B)

    const criteria = [
      { label: `ROIC ≥ ${(effectiveMinROIC * 100).toFixed(0)}%${isBDR ? ' (BDR)' : ''}`, value: !!(roic && roic >= effectiveMinROIC), description: `ROIC: ${formatPercent(roic)}` },
      { label: `Earnings Yield ≥ ${(effectiveMinEY * 100).toFixed(0)}%${isBDR ? ' (BDR)' : ''}`, value: !!(earningsYield && earningsYield >= effectiveMinEY), description: `EY: ${formatPercent(earningsYield)}` },
      { label: `ROE ≥ ${(minROE * 100).toFixed(0)}%${isBDR ? ' (BDR)' : ''}`, value: !roe || roe >= minROE, description: `ROE: ${formatPercent(roe) || 'N/A - Benefício da dúvida'}` },
      { label: 'Crescimento Receitas ≥ -5%', value: !crescimentoReceitas || crescimentoReceitas >= -0.05, description: `Crescimento: ${formatPercent(crescimentoReceitas) || 'N/A - Benefício da dúvida'}` },
      { label: `Margem Líquida ≥ ${(minMargemLiquida * 100).toFixed(0)}%`, value: !margemLiquida || margemLiquida >= minMargemLiquida, description: `Margem: ${formatPercent(margemLiquida) || 'N/A - Benefício da dúvida'}` },
      { label: `Liquidez Corrente ≥ ${minLiquidez.toFixed(1)}${isBDR ? ' (BDR)' : ''}`, value: !liquidezCorrente || liquidezCorrente >= minLiquidez, description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A - Benefício da dúvida'}` },
      { label: `Dív. Líq./PL ≤ ${(maxDividaLiquidaPl * 100).toFixed(0)}%${isBDR ? ' (BDR)' : ''}`, value: !dividaLiquidaPl || dividaLiquidaPl <= maxDividaLiquidaPl, description: `Dív/PL: ${dividaLiquidaPl?.toFixed(1) || 'N/A - Benefício da dúvida'}` },
      { label: `Market Cap ≥ ${isBDR ? 'R$ 3B' : 'R$ 1B'}${isBDR ? ' (BDR)' : ''}`, value: !marketCap || marketCap >= minMarketCap, description: `Market Cap: ${marketCap ? `R$ ${(marketCap / 1000000).toFixed(0)}M` : 'N/A - Benefício da dúvida'}` }
    ];
    
    const passedCriteria = criteria.filter(c => c.value).length;
    const isEligible = passedCriteria >= 6 && !!roic // && !!earningsYield && roic >= minROIC && earningsYield >= minEY; 
    const score = (passedCriteria / criteria.length) * 100;

    // Calcular magic formula score como no backend
    let magicScore = (
      Math.min(roic || 0, 0.50) * 100 +   // ROIC até 50%
      Math.min(earningsYield || 0, 0.25) * 200 +  // EY até 25%
      Math.min(roe || 0, 0.30) * 50 +     // ROE até 30%
      Math.min(margemLiquida || 0, 0.30) * 50 +   // Margem até 30%
      Math.max(0, (crescimentoReceitas || 0) + 0.05) * 80     // Crescimento não negativo
    );

    if (magicScore > 100) magicScore = 100;
    
    return {
      isEligible,
      score,
      fairValue: null,
      upside: null,
      reasoning: isEligible 
        ? `✅ Aprovada na Magic Formula com ROIC ${formatPercent(roic)} e EY ${formatPercent(earningsYield)}. Magic Score: ${magicScore.toFixed(1)}/100. Ótimo negócio a preço justo.`
        : `❌ Não atende aos critérios mínimos da Magic Formula (${passedCriteria}/8 critérios aprovados).`,
      criteria,
      key_metrics: {
        roic: roic,
        earningsYield: earningsYield,
        magicScore: Number(magicScore.toFixed(1)),
        roe: roe,
        margemLiquida: margemLiquida
      }
    };
  }

  runRanking(companies: CompanyData[], params: MagicFormulaParams): RankBuilderResult[] {
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
      if (!this.validateCompanyData(company, params)) continue;
      
      // EXCLUSÃO AUTOMÁTICA: Verificar critérios de exclusão
      if (this.shouldExcludeCompany(company)) continue;

      const { financials, currentPrice } = company;
      const roic = toNumber(financials.roic)!;
      const earningsYield = toNumber(financials.earningsYield)!;
      const roe = toNumber(financials.roe) || 0;
      const margemLiquida = toNumber(financials.margemLiquida) || 0;
      const crescimentoReceitas = toNumber(financials.crescimentoReceitas) || 0;
      const liquidezCorrente = toNumber(financials.liquidezCorrente) || 0;

      // Magic Formula Score (combina ROIC alto + EY alto + qualidade)
      let magicScore = (
        Math.min(roic, 0.50) * 100 +        // ROIC até 50% = 50 pontos
        Math.min(earningsYield, 0.25) * 200 +   // EY até 25% = 50 pontos
        Math.min(roe, 0.30) * 50 +          // ROE até 30% = 15 pontos
        Math.min(margemLiquida, 0.30) * 50 +        // Margem até 30% = 15 pontos
        Math.max(0, crescimentoReceitas + 0.05) * 80 // Crescimento não negativo = 8 pontos
      );

      if (magicScore > 100) magicScore = 100;

      results.push({
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice,
        logoUrl: company.logoUrl,
        fairValue: null,
        upside: null,
        marginOfSafety: null,
        rational: `Aprovada na Magic Formula Model com ROIC ${(roic * 100).toFixed(1)}% e Earnings Yield ${(earningsYield * 100).toFixed(1)}%. ROE sólido: ${(roe * 100).toFixed(1)}%, Margem Líquida: ${(margemLiquida * 100).toFixed(1)}%. Crescimento Receitas: ${(crescimentoReceitas * 100).toFixed(1)}%. Magic Score: ${Number(magicScore.toFixed(1))}/100. Ótimo negócio a preço justo.`,
        key_metrics: {
          roic: roic,
          earningsYield: earningsYield,
          magicScore: Number(magicScore.toFixed(1)),
          roe: roe,
          margemLiquida: margemLiquida,
          dy: toNumber(financials.dy),
          liquidezCorrente: liquidezCorrente,
          crescimentoReceitas: crescimentoReceitas,
        }
      });
    }

    // Ordenar por Magic Score
    const sortedResults = results
      .sort((a, b) => (b.key_metrics?.magicScore || 0) - (a.key_metrics?.magicScore || 0));

    // Remover empresas duplicadas (manter apenas o primeiro ticker de cada empresa)
    const uniqueResults = this.removeDuplicateCompanies(sortedResults);
    
    // Aplicar limite (usar params.limit se fornecido, senão usar 50 como padrão)
    const limit = params.limit ?? 50;
    const limitedResults = uniqueResults.slice(0, limit);

    // Aplicar priorização técnica se habilitada
    return this.applyTechnicalPrioritization(limitedResults, companies, params.useTechnicalAnalysis);
  }

  generateRational(params: MagicFormulaParams): string {
    const { minROIC = 0, minEY = 0 } = params;
    return `# 🎯 MODELO MAGIC FORMULA (Joel Greenblatt)

**Filosofia**: Encontrar "ótimos negócios a preços justos" - empresas com alta qualidade operacional e preço atrativo.

## Métricas Centrais

- **ROIC** ≥ ${(minROIC * 100).toFixed(0)}% (Return on Invested Capital - qualidade do negócio)
- **Earnings Yield** ≥ ${(minEY * 100).toFixed(0)}% (1/P/L - preço atrativo)

**Filosofia do Criador**: Joel Greenblatt criou esta fórmula para combinar value investing com growth investing.

## Filtros de Qualidade

- ROE ≥ 15% (retorno sobre patrimônio líquido consistente)
- Crescimento Receitas ≥ -5% (não em declínio operacional acentuado)
- Margem Líquida ≥ 5% (negócio rentável e eficiente)
- Liquidez Corrente ≥ 1.2 (saúde financeira de curto prazo)
- Dívida Líquida/PL ≤ 150% (estrutura de capital equilibrada)
- Market Cap ≥ R$ 1B (empresas de médio/grande porte)

**Ordenação**: Por Magic Score - combina ROIC alto + Earnings Yield alto + indicadores complementares${params.useTechnicalAnalysis ? ' + Priorização por Análise Técnica (ativos em sobrevenda primeiro)' : ''}.

**Objetivo**: Empresas que são simultaneamente ótimos negócios (alto ROIC) vendidas a preços atrativos (alto EY)${params.useTechnicalAnalysis ? '. Com análise técnica ativa, priorizamos ativos em sobrevenda para melhor timing de entrada' : ''}.

**Diferencial**: Equilibra crescimento e valor, evitando extremos que podem ser perigosos.`;
  }
}
