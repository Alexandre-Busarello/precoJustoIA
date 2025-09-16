import { AbstractStrategy, toNumber, formatPercent } from './base-strategy';
import { GordonParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';

export class GordonStrategy extends AbstractStrategy<GordonParams> {
  readonly name = 'gordon';

  validateCompanyData(companyData: CompanyData, params: GordonParams): boolean {
    const { financials, currentPrice } = companyData;
    
    // Critérios essenciais que devem existir
    const hasEssentialData = !!(
      financials.dy && toNumber(financials.dy)! > 0 &&
      financials.roe && toNumber(financials.roe)! > 0 &&
      currentPrice > 0
    );
    
    // Deve ter pelo menos uma fonte de dados de dividendos
    const hasDividendData = !!(
      (financials.ultimoDividendo && toNumber(financials.ultimoDividendo)! > 0) ||
      (financials.dividendYield12m && toNumber(financials.dividendYield12m)! > 0) ||
      (financials.dy && toNumber(financials.dy)! > 0) // Pode usar DY para estimar
    );
    
    // Verificar se a taxa de desconto é maior que a taxa de crescimento
    const ratesAreValid = params.discountRate > params.dividendGrowthRate;
    
    return hasEssentialData && hasDividendData && ratesAreValid;
  }

  runAnalysis(companyData: CompanyData, params: GordonParams): StrategyAnalysis {
    const { financials, currentPrice } = companyData;
    
    const dy = toNumber(financials.dy);
    const dividendYield12m = toNumber(financials.dividendYield12m);
    const ultimoDividendo = toNumber(financials.ultimoDividendo);
    const payout = toNumber(financials.payout);
    const roe = toNumber(financials.roe);
    const crescimentoLucros = toNumber(financials.crescimentoLucros);
    const liquidezCorrente = toNumber(financials.liquidezCorrente);
    const dividaLiquidaPl = toNumber(financials.dividaLiquidaPl);
    
    // Calcular dividendo estimado usando a melhor fonte disponível
    let dividendEstimated = null;
    if (ultimoDividendo && ultimoDividendo > 0) {
      dividendEstimated = ultimoDividendo;
    } else if (dividendYield12m && dividendYield12m > 0 && currentPrice > 0) {
      dividendEstimated = dividendYield12m * currentPrice;
    } else if (dy && dy > 0 && currentPrice > 0) {
      dividendEstimated = dy * currentPrice;
    }
    
    const fairValue = this.calculateGordonFairValue(
      dividendEstimated, 
      params.discountRate, 
      params.dividendGrowthRate
    );
    const upside = fairValue && currentPrice > 0 ? ((fairValue - currentPrice) / currentPrice) * 100 : null;
    
    const criteria = [
      { label: 'Upside ≥ 15%', value: !!(upside && upside >= 15), description: `Upside: ${upside ? formatPercent(upside / 100) : 'N/A'}` },
      { label: 'Dividend Yield ≥ 4%', value: !!(dy && dy >= 0.04), description: `DY: ${formatPercent(dy)}` },
      { label: 'DY 12m ≥ 3%', value: !dividendYield12m || dividendYield12m >= 0.03, description: `DY 12m: ${dividendYield12m ? formatPercent(dividendYield12m) : 'N/A'}` },
      { label: 'Payout ≤ 80%', value: !payout || payout <= 0.80, description: `Payout: ${payout ? formatPercent(payout) : 'N/A'}` },
      { label: 'ROE ≥ 12%', value: !!(roe && roe >= 0.12), description: `ROE: ${formatPercent(roe)}` },
      { label: 'Crescimento Lucros ≥ -20%', value: !crescimentoLucros || crescimentoLucros >= -0.20, description: `Crescimento: ${crescimentoLucros ? formatPercent(crescimentoLucros) : 'N/A'}` },
      { label: 'Liquidez Corrente ≥ 1.2', value: !liquidezCorrente || liquidezCorrente >= 1.2, description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A'}` },
      { label: 'Dív. Líq./PL ≤ 100%', value: !dividaLiquidaPl || dividaLiquidaPl <= 1.0, description: `Dív/PL: ${dividaLiquidaPl?.toFixed(1) || 'N/A'}` }
    ];

    const passedCriteria = criteria.filter(c => c.value).length;
    const hasMinimumCriteria = passedCriteria >= 5;
    const hasValidFairValue = !!fairValue;
    const hasValidUpside = !!upside;
    const hasMinimumUpside = !!(upside && upside >= 15);
    
    const isEligible = hasMinimumCriteria && hasValidFairValue && hasValidUpside && hasMinimumUpside;
    const score = (passedCriteria / criteria.length) * 100;
    
    // Reasoning detalhado
    let reasoning = '';
    if (!hasMinimumCriteria) {
      const failedCriteria = criteria.filter(c => !c.value).map(c => c.label);
      reasoning += `Não atende critérios mínimos (${passedCriteria}/8): ${failedCriteria.join(', ')}. `;
    }
    if (!hasValidFairValue) {
      reasoning += 'Não foi possível calcular preço justo pelos dividendos. ';
    }
    if (!hasValidUpside) {
      reasoning += 'Upside não calculável. ';
    }
    if (hasValidUpside && !hasMinimumUpside) {
      reasoning += 'Upside insuficiente para investimento (< 15%). ';
    }
    if (isEligible) {
      reasoning = `Empresa elegível pela Fórmula de Gordon com ${passedCriteria}/8 critérios atendidos e upside de ${formatPercent(upside! / 100)}. ` +
                 `Parâmetros: Taxa desconto ${formatPercent(params.discountRate)}, crescimento dividendos ${formatPercent(params.dividendGrowthRate)}.`;
    } else if (!hasValidFairValue) {
      reasoning += `Parâmetros utilizados: Taxa desconto ${formatPercent(params.discountRate)}, crescimento ${formatPercent(params.dividendGrowthRate)}.`;
    }

    return {
      fairValue,
      upside,
      isEligible,
      score,
      criteria,
      reasoning: reasoning.trim() || 'Análise concluída.'
    };
  }

  private calculateGordonFairValue(
    dividendNext12m: number | null, 
    discountRate: number, 
    growthRate: number
  ): number | null {
    if (!dividendNext12m || dividendNext12m <= 0) return null;
    if (discountRate <= growthRate) return null; // Taxa de desconto deve ser maior que crescimento
    
    // Fórmula de Gordon: P = D / (K - G)
    // P = Preço justo
    // D = Dividendo próximos 12 meses
    // K = Taxa de desconto (retorno esperado)
    // G = Taxa de crescimento dos dividendos
    
    const fairValue = dividendNext12m / (discountRate - growthRate);
    return fairValue > 0 ? fairValue : null;
  }

  runRanking(companies: CompanyData[], params: GordonParams): RankBuilderResult[] {
    const results: RankBuilderResult[] = [];
    
    for (const company of companies) {
      if (!this.validateCompanyData(company, params)) continue;
      
      const analysis = this.runAnalysis(company, params);
      if (!analysis.isEligible) continue;
      
      const dy = toNumber(company.financials.dy);
      const roe = toNumber(company.financials.roe);
      const payout = toNumber(company.financials.payout);
      
      // Score composto: 40% upside + 30% dividend yield + 20% ROE + 10% payout sustentável
      const upsideScore = analysis.upside ? Math.min(analysis.upside / 50, 1) : 0; // Max 50% upside = score 1
      const dyScore = dy ? Math.min(dy / 0.12, 1) : 0; // Max 12% DY = score 1
      const roeScore = roe ? Math.min(roe / 0.25, 1) : 0; // Max 25% ROE = score 1
      const payoutScore = payout ? (1 - Math.min(payout / 0.8, 1)) : 0; // Menor payout = melhor score
      
      const compositeScore = (
        upsideScore * 0.4 + 
        dyScore * 0.3 + 
        roeScore * 0.2 + 
        payoutScore * 0.1
      ) * 100;
      
      results.push({
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice: company.currentPrice,
        logoUrl: company.logoUrl,
        fairValue: analysis.fairValue!,
        upside: analysis.upside!,
        marginOfSafety: analysis.upside! > 0 ? analysis.upside! : null,
        rational: `Fórmula de Gordon: Preço justo R$ ${analysis.fairValue!.toFixed(2)} baseado em dividendos. DY: ${formatPercent(dy)}, ROE: ${formatPercent(roe)}, Payout: ${formatPercent(payout)}.`,
        key_metrics: {
          dy: dy || 0,
          roe: roe || 0,
          payout: payout || 0,
          compositeScore: compositeScore
        }
      });
    }
    
    return results.sort((a, b) => (b.key_metrics?.compositeScore || 0) - (a.key_metrics?.compositeScore || 0));
  }

  generateRational(params: GordonParams): string {
    return `# FÓRMULA DE GORDON (Método dos Dividendos)

**Filosofia**: Avalia empresas com base na sustentabilidade e crescimento dos dividendos.

## Parâmetros de Análise

- **Taxa de desconto**: ${formatPercent(params.discountRate)}
- **Taxa de crescimento esperada**: ${formatPercent(params.dividendGrowthRate)}

## Critérios de Seleção

- Dividend yield atrativo (≥4%)
- Payout sustentável (≤80%)
- ROE sólido (≥12%)
- Potencial de valorização (≥15%)

**Ideal Para**: Investidores focados em renda passiva com crescimento.

**Objetivo**: Encontrar empresas que combinam dividendos atrativos com crescimento sustentável.`;
  }
}
