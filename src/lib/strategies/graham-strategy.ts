import { AbstractStrategy, toNumber, formatCurrency, formatPercent } from './base-strategy';
import { GrahamParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';

export class GrahamStrategy extends AbstractStrategy<GrahamParams> {
  readonly name = 'graham';

  validateCompanyData(companyData: CompanyData): boolean {
    const { financials } = companyData;
    // Dar benefício da dúvida - só requer dados essenciais para cálculo do valor justo
    return !!(
      financials.lpa && toNumber(financials.lpa)! > 0 &&
      financials.vpa && toNumber(financials.vpa)! > 0
    );
  }

  runAnalysis(companyData: CompanyData): StrategyAnalysis {
    const { financials, currentPrice } = companyData;
    
    const lpa = toNumber(financials.lpa);
    const vpa = toNumber(financials.vpa);
    const roe = toNumber(financials.roe);
    const liquidezCorrente = toNumber(financials.liquidezCorrente);
    const margemLiquida = toNumber(financials.margemLiquida);
    const dividaLiquidaPl = toNumber(financials.dividaLiquidaPl);
    const crescimentoLucros = toNumber(financials.crescimentoLucros);
    const marketCap = toNumber(financials.marketCap);
    
    const fairValue = this.calculateGrahamFairValue(lpa, vpa);
    const upside = fairValue && currentPrice > 0 ? ((fairValue - currentPrice) / currentPrice) * 100 : null;
    
    const criteria = [
      { label: 'Upside ≥ 10', value: !!(upside && upside >= 10), description: `Upside: ${formatPercent(upside! / 100)}` },
      { label: 'LPA positivo', value: !!(lpa && lpa > 0), description: `LPA: ${formatCurrency(lpa)}` },
      { label: 'VPA positivo', value: !!(vpa && vpa > 0), description: `VPA: ${formatCurrency(vpa)}` },
      { label: 'ROE ≥ 10%', value: !roe || roe >= 0.10, description: `ROE: ${formatPercent(roe) || 'N/A - Benefício da dúvida'}` },
      { label: 'Liquidez Corrente ≥ 1.0', value: !liquidezCorrente || liquidezCorrente >= 1.0, description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A - Benefício da dúvida'}` },
      { label: 'Margem Líquida positiva', value: !margemLiquida || margemLiquida > 0, description: `Margem: ${formatPercent(margemLiquida) || 'N/A - Benefício da dúvida'}` },
      { label: 'Dív. Líq./PL ≤ 150%', value: !dividaLiquidaPl || dividaLiquidaPl <= 1.5, description: `Dív/PL: ${dividaLiquidaPl?.toFixed(1) || 'N/A - Benefício da dúvida'}` },
      { label: 'Crescimento Lucros ≥ -15%', value: !crescimentoLucros || crescimentoLucros >= -0.15, description: `Crescimento: ${formatPercent(crescimentoLucros) || 'N/A - Benefício da dúvida'}` },
      { label: 'Market Cap ≥ R$ 2B', value: !marketCap || marketCap >= 2000000000, description: `Market Cap: ${formatCurrency(marketCap) || 'N/A - Benefício da dúvida'}` }
    ];

    const passedCriteria = criteria.filter(c => c.value).length;
    const hasMinimumCriteria = passedCriteria >= 7; // Reduzido para dar benefício da dúvida
    const hasValidFairValue = !!fairValue;
    const hasValidUpside = !!upside;
    const hasMinimumUpside = !!(upside && upside >= 10);
    
    const isEligible = hasMinimumCriteria && hasValidFairValue && hasValidUpside && hasMinimumUpside;
    const score = (passedCriteria / criteria.length) * 100;
    
    // Calcular quality score como no backend
    let qualityScore = (
      Math.min(roe || 0, 0.25) * 40 +
      Math.min(liquidezCorrente || 0, 2.5) * 20 +
      Math.min(margemLiquida || 0, 0.15) * 100 +
      Math.max(0, (crescimentoLucros || 0) + 0.15) * 50
    );

    if (qualityScore > 100) qualityScore = 100;

    // Determinar o motivo da reprovação
    let reasoning: string;
    if (isEligible) {
      reasoning = `✅ Empresa aprovada no modelo Graham com ${upside?.toFixed(1)}% de margem de segurança. Score de qualidade: ${qualityScore.toFixed(1)}/100.`;
    } else {
      const reasons: string[] = [];
      
      if (!hasMinimumCriteria) {
        reasons.push(`critérios fundamentais insuficientes (${passedCriteria}/${criteria.length} aprovados)`);
      }
      
      if (!hasValidFairValue) {
        reasons.push('não foi possível calcular o valor justo');
      }
      
      if (hasValidUpside && !hasMinimumUpside) {
        reasons.push(`upside insuficiente (${upside?.toFixed(1)}%, mínimo 10%)`);
      } else if (!hasValidUpside) {
        reasons.push('não foi possível calcular o upside');
      }
      
      reasoning = `❌ Empresa não atende aos critérios Graham: ${reasons.join(', ')}.`;
    }

    return {
      isEligible,
      score,
      fairValue,
      upside,
      reasoning,
      criteria,
      key_metrics: {
        lpa: lpa,
        vpa: vpa,
        qualityScore: Number(qualityScore.toFixed(1)),
        pl: toNumber(financials.pl),
        pvp: toNumber(financials.pvp),
        roe: roe
      }
    };
  }

  runRanking(companies: CompanyData[], params: GrahamParams): RankBuilderResult[] {
    const { marginOfSafety } = params;
    const results: RankBuilderResult[] = [];

    for (const company of companies) {
      if (!this.validateCompanyData(company)) continue;

      const { financials, currentPrice } = company;
      const lpa = toNumber(financials.lpa)!;
      const vpa = toNumber(financials.vpa)!;
      const roe = toNumber(financials.roe) || 0;
      const liquidezCorrente = toNumber(financials.liquidezCorrente) || 0;
      const margemLiquida = toNumber(financials.margemLiquida) || 0;
      const crescimentoLucros = toNumber(financials.crescimentoLucros) || 0;
      const marketCap = toNumber(financials.marketCap);

      // Fórmula de Graham: Preço Justo = √(22.5 × LPA × VPA)
      const fairValue = Math.sqrt(22.5 * lpa * vpa);
      const marginOfSafetyActual = (fairValue / currentPrice) - 1;

      // Filtrar apenas empresas com margem de segurança >= parâmetro
      if (marginOfSafetyActual >= marginOfSafety && (marketCap && marketCap >= 2000000000)) {
        const upside = ((fairValue / currentPrice) - 1) * 100;

        // Score de qualidade para Graham (peso na solidez da empresa)
        let qualityScore = (
          Math.min(roe, 0.25) * 40 +        // ROE (peso alto)
          Math.min(liquidezCorrente, 2.5) * 20 +         // Liquidez
          Math.min(margemLiquida, 0.15) * 100 +          // Margem líquida
          Math.max(0, crescimentoLucros + 0.15) * 50   // Crescimento (penaliza declínio)
        );

        if (qualityScore > 100) qualityScore = 100;

        results.push({
          ticker: company.ticker,
          name: company.name,
          sector: company.sector,
          currentPrice,
          logoUrl: company.logoUrl,
          fairValue: Number(fairValue.toFixed(2)),
          upside: Number(upside.toFixed(2)),
          marginOfSafety: Number((marginOfSafetyActual * 100).toFixed(2)),
          rational: `Aprovada no Graham Quality Model com ${Number((marginOfSafetyActual * 100).toFixed(1))}% de margem de segurança. Empresa sólida: ROE ${Number((roe * 100)).toFixed(1)}%, LC ${Number(liquidezCorrente).toFixed(2)}, Margem Líquida ${Number((margemLiquida * 100)).toFixed(1)}%. Score de qualidade: ${Number(qualityScore.toFixed(1))}/100.`,
          key_metrics: {
            lpa: lpa,
            vpa: vpa,
            qualityScore: Number(qualityScore.toFixed(1)),
            pl: toNumber(financials.pl),
            pvp: toNumber(financials.pvp),
            roe: roe,
            liquidezCorrente: liquidezCorrente,
            margemLiquida: margemLiquida,
            crescimentoLucros: crescimentoLucros,
          }
        });
      }
    }

    // Ordenar por qualidade (empresas sólidas primeiro)
    return results
      .sort((a, b) => (b.key_metrics?.qualityScore || 0) - (a.key_metrics?.qualityScore || 0))
      .slice(0, 50);
  }

  generateRational(params: GrahamParams): string {
    return `# MODELO GRAHAM APRIMORADO

**Filosofia**: Baseado na fórmula clássica de Benjamin Graham para encontrar ações baratas de empresas sólidas.

**Estratégia**: Preço Justo = √(22.5 × LPA × VPA), buscando margem de segurança de ${(params.marginOfSafety * 100).toFixed(0)}%.

## Filtros de Qualidade Aplicados

- ROE ≥ 10% (rentabilidade consistente)
- Liquidez Corrente ≥ 1.0 (capacidade de honrar compromissos)
- Margem Líquida > 0% (empresa lucrativa)
- Crescimento Lucros ≥ -15% (não em declínio severo)
- Dívida Líquida/PL ≤ 150% (endividamento controlado)

**Ordenação**: Por Score de Qualidade (combina solidez financeira + margem de segurança).

**Objetivo**: Encontrar empresas subvalorizadas MAS financeiramente saudáveis, evitando "value traps".`;
  }
}
