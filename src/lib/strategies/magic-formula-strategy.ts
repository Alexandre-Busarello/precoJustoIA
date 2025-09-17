import { AbstractStrategy, toNumber, formatPercent } from './base-strategy';
import { MagicFormulaParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';

export class MagicFormulaStrategy extends AbstractStrategy<MagicFormulaParams> {
  readonly name = 'magicFormula';

  validateCompanyData(companyData: CompanyData, params: MagicFormulaParams): boolean {
    const { financials } = companyData;
    const { minROIC = 0, minEY = 0 } = params;
    return !!(
      financials.roic && toNumber(financials.roic)! >= minROIC &&
      financials.earningsYield && toNumber(financials.earningsYield)! >= minEY &&
      financials.roe && toNumber(financials.roe)! >= 0.15 &&
      (!financials.crescimentoReceitas || toNumber(financials.crescimentoReceitas)! >= -0.05) &&
      financials.margemLiquida && toNumber(financials.margemLiquida)! >= 0.05 &&
      financials.liquidezCorrente && toNumber(financials.liquidezCorrente)! >= 1.2 &&
      (!financials.dividaLiquidaPl || toNumber(financials.dividaLiquidaPl)! <= 1.5) &&
      financials.marketCap && toNumber(financials.marketCap)! >= 1000000000
    );
  }

  runAnalysis(companyData: CompanyData, params: MagicFormulaParams): StrategyAnalysis {
    const { financials } = companyData;
    const { minROIC = 0.15, minEY = 0.8 } = params;
    
    const roic = toNumber(financials.roic);
    const earningsYield = toNumber(financials.earningsYield);
    const roe = toNumber(financials.roe);
    const crescimentoReceitas = toNumber(financials.crescimentoReceitas);
    const margemLiquida = toNumber(financials.margemLiquida);
    const liquidezCorrente = toNumber(financials.liquidezCorrente);
    const dividaLiquidaPl = toNumber(financials.dividaLiquidaPl);
    const marketCap = toNumber(financials.marketCap);

    const criteria = [
      { label: `ROIC ≥ ${(minROIC * 100).toFixed(0)}%`, value: !!(roic && roic >= minROIC), description: `ROIC: ${formatPercent(roic)}` },
      { label: `Earnings Yield ≥ ${(minEY * 100).toFixed(0)}%`, value: !!(earningsYield && earningsYield >= minEY), description: `EY: ${formatPercent(earningsYield)}` },
      { label: 'ROE ≥ 15%', value: !!(roe && roe >= 0.15), description: `ROE: ${formatPercent(roe)}` },
      { label: 'Crescimento Receitas ≥ -5%', value: !crescimentoReceitas || crescimentoReceitas >= -0.05, description: `Crescimento: ${formatPercent(crescimentoReceitas)}` },
      { label: 'Margem Líquida ≥ 5%', value: !!(margemLiquida && margemLiquida >= 0.05), description: `Margem: ${formatPercent(margemLiquida)}` },
      { label: 'Liquidez Corrente ≥ 1.2', value: !!(liquidezCorrente && liquidezCorrente >= 1.2), description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A'}` },
      { label: 'Dív. Líq./PL ≤ 150%', value: !dividaLiquidaPl || dividaLiquidaPl <= 1.5, description: `Dív/PL: ${dividaLiquidaPl?.toFixed(1) || 'N/A'}` },
      { label: 'Market Cap ≥ R$ 1B', value: !!(marketCap && marketCap >= 1000000000), description: `Market Cap: ${marketCap ? `R$ ${(marketCap / 1000000).toFixed(0)}M` : 'N/A'}` }
    ];
    
    const passedCriteria = criteria.filter(c => c.value).length;
    const isEligible = passedCriteria >= 6 && !!roic && !!earningsYield && roic >= minROIC && earningsYield >= minEY;
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
    // const { minROIC = 0, minEY = 0 } = params; // Não usado atualmente
    const results: RankBuilderResult[] = [];

    for (const company of companies) {
      if (!this.validateCompanyData(company, params)) continue;

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
    return results
      .sort((a, b) => (b.key_metrics?.magicScore || 0) - (a.key_metrics?.magicScore || 0))
      .slice(0, 50);
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

**Ordenação**: Por Magic Score - combina ROIC alto + Earnings Yield alto + indicadores complementares.

**Objetivo**: Empresas que são simultaneamente ótimos negócios (alto ROIC) vendidas a preços atrativos (alto EY).

**Diferencial**: Equilibra crescimento e valor, evitando extremos que podem ser perigosos.`;
  }
}
