import { AbstractStrategy, toNumber, formatPercent } from './base-strategy';
import { LowPEParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';

export class LowPEStrategy extends AbstractStrategy<LowPEParams> {
  readonly name = 'lowPE';

  validateCompanyData(companyData: CompanyData, params: LowPEParams): boolean {
    const { financials } = companyData;
    const { maxPE, minROE = 0 } = params;
    return !!(
      financials.pl && toNumber(financials.pl)! > 3 && toNumber(financials.pl)! <= maxPE &&
      financials.roe && toNumber(financials.roe)! >= minROE &&
      (!financials.crescimentoReceitas || toNumber(financials.crescimentoReceitas)! >= -0.10) &&
      financials.margemLiquida && toNumber(financials.margemLiquida)! >= 0.03 &&
      financials.liquidezCorrente && toNumber(financials.liquidezCorrente)! >= 1.0 &&
      financials.roa && toNumber(financials.roa)! >= 0.05 &&
      (!financials.dividaLiquidaPl || toNumber(financials.dividaLiquidaPl)! <= 2.0) &&
      financials.marketCap && toNumber(financials.marketCap)! >= 500000000
    );
  }

  runAnalysis(companyData: CompanyData, params: LowPEParams): StrategyAnalysis {
    const { financials } = companyData;
    const { maxPE, minROE = 0.15 } = params;
    
    const pl = toNumber(financials.pl);
    const roe = toNumber(financials.roe);
    const crescimentoReceitas = toNumber(financials.crescimentoReceitas);
    const margemLiquida = toNumber(financials.margemLiquida);
    const liquidezCorrente = toNumber(financials.liquidezCorrente);
    const roa = toNumber(financials.roa);
    const dividaLiquidaPl = toNumber(financials.dividaLiquidaPl);
    const marketCap = toNumber(financials.marketCap);
    const roic = toNumber(financials.roic);

    const criteria = [
      { label: `P/L entre 3-${maxPE}`, value: !!(pl && pl > 3 && pl <= maxPE), description: `P/L: ${pl?.toFixed(1) || 'N/A'}` },
      { label: `ROE ≥ ${(minROE * 100).toFixed(0)}%`, value: !!(roe && roe >= minROE), description: `ROE: ${formatPercent(roe)}` },
      { label: 'Crescimento Receitas ≥ -10%', value: !crescimentoReceitas || crescimentoReceitas >= -0.10, description: `Crescimento: ${formatPercent(crescimentoReceitas)}` },
      { label: 'Margem Líquida ≥ 3%', value: !!(margemLiquida && margemLiquida >= 0.03), description: `Margem: ${formatPercent(margemLiquida)}` },
      { label: 'Liquidez Corrente ≥ 1.0', value: !!(liquidezCorrente && liquidezCorrente >= 1.0), description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A'}` },
      { label: 'ROA ≥ 5%', value: !!(roa && roa >= 0.05), description: `ROA: ${formatPercent(roa)}` },
      { label: 'Dív. Líq./PL ≤ 200%', value: !dividaLiquidaPl || dividaLiquidaPl <= 2.0, description: `Dív/PL: ${dividaLiquidaPl?.toFixed(1) || 'N/A'}` },
      { label: 'Market Cap ≥ R$ 500M', value: !!(marketCap && marketCap >= 500000000), description: `Market Cap: ${marketCap ? `R$ ${(marketCap / 1000000).toFixed(0)}M` : 'N/A'}` }
    ];
    
    const passedCriteria = criteria.filter(c => c.value).length;
    const isEligible = passedCriteria >= 6 && !!pl && pl > 3 && pl <= maxPE;
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
        ? `✅ Aprovada no Value Investing com P/L ${pl?.toFixed(1)}. Value Score: ${valueScore.toFixed(1)}/100. Não é value trap.`
        : `❌ Empresa pode ser value trap (${passedCriteria}/8 critérios aprovados).`,
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
    // const { maxPE, minROE = 0 } = params; // Não usado atualmente
    const results: RankBuilderResult[] = [];

    for (const company of companies) {
      if (!this.validateCompanyData(company, params)) continue;

      const { financials, currentPrice } = company;
      const pl = toNumber(financials.pl)!;
      const roe = toNumber(financials.roe) || 0;
      const roa = toNumber(financials.roa) || 0;
      const margemLiquida = toNumber(financials.margemLiquida) || 0;
      const liquidezCorrente = toNumber(financials.liquidezCorrente) || 0;
      const crescimentoReceitas = toNumber(financials.crescimentoReceitas) || 0;
      const roic = toNumber(financials.roic) || 0;

      // Score de value investing (qualidade + preço baixo)
      let valueScore = (
        Math.max(0, 50 - pl * 2) +         // Premia P/L baixo
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
        rational: `Aprovada no Value Investing Model com P/L ${pl.toFixed(1)}. Empresa de qualidade: ROE ${(roe * 100).toFixed(2)}%, ROA ${roa.toFixed(1)}%, Margem ${(margemLiquida * 100).toFixed(2)}%. Crescimento Receitas: ${(crescimentoReceitas * 100).toFixed(2)}%. Value Score: ${Number(valueScore.toFixed(1))}/100. Não é value trap.`,
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
    return results
      .sort((a, b) => (b.key_metrics?.valueScore || 0) - (a.key_metrics?.valueScore || 0))
      .slice(0, 50);
  }

  generateRational(params: LowPEParams): string {
    const { maxPE, minROE = 0 } = params;
    return `# 💎 MODELO VALUE INVESTING

**Filosofia**: Baseado no value investing clássico - empresas baratas (baixo P/L) MAS de qualidade comprovada.

**Estratégia**: P/L ≤ ${maxPE} + ROE ≥ ${(minROE * 100).toFixed(0)}% + filtros rigorosos de qualidade.

**Problema Resolvido**: Evita "value traps" - ações baratas que continuam caindo por problemas fundamentais.

## Filtros Anti-Value Trap

- P/L > 3 (evita preços suspeitosamente baixos)
- ROA ≥ 5% (eficiência na gestão dos ativos)
- Crescimento Receitas ≥ -10% (não em forte declínio operacional)
- Margem Líquida ≥ 3% (operação rentável e sustentável)
- Liquidez Corrente ≥ 1.0 (situação financeira adequada)
- Dívida Líquida/PL ≤ 200% (endividamento não excessivo)
- Market Cap ≥ R$ 500M (liquidez e estabilidade mínimas)

**Ordenação**: Por Value Score (combina preço atrativo + indicadores de qualidade).

**Objetivo**: Empresas baratas que são REALMENTE bons negócios, não problemas disfarçados.`;
  }
}
