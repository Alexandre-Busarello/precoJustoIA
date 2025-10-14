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

  runAnalysis(companyData: CompanyData, params: GrahamParams = {}): StrategyAnalysis {
    const { financials, currentPrice, historicalFinancials } = companyData;
    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    
    const lpa = toNumber(financials.lpa);
    const vpa = toNumber(financials.vpa);
    const roe = this.getROE(financials, use7YearAverages, historicalFinancials);
    const liquidezCorrente = this.getLiquidezCorrente(financials, use7YearAverages, historicalFinancials);
    const margemLiquida = this.getMargemLiquida(financials, use7YearAverages, historicalFinancials);
    const dividaLiquidaPl = this.getDividaLiquidaPl(financials, use7YearAverages, historicalFinancials);
    const crescimentoLucros = toNumber(financials.crescimentoLucros);
    const cagrLucros5a = toNumber(financials.cagrLucros5a);
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
      { label: 'Crescimento Lucros ≥ -15%', value: !crescimentoLucros || crescimentoLucros >= -0.15 || !!(cagrLucros5a && cagrLucros5a > 0), description: `Crescimento: ${crescimentoLucros ? formatPercent(crescimentoLucros) : 'N/A - Benefício da dúvida'}${cagrLucros5a && cagrLucros5a > 0 ? ` (CAGR 5a: ${formatPercent(cagrLucros5a)})` : ''}` },
      { label: 'Market Cap ≥ R$ 2B', value: !marketCap || marketCap >= 2000000000, description: `Market Cap: ${formatCurrency(marketCap) || 'N/A - Benefício da dúvida'}` }
    ];

    const passedCriteria = criteria.filter(c => c.value).length;
    const hasMinimumCriteria = passedCriteria >= 7; // Reduzido para dar benefício da dúvida
    const hasValidFairValue = !!fairValue;
    const hasValidUpside = !!upside;
    const hasMinimumUpside = !!(upside && upside >= 10);
    
    const isEligible = hasMinimumCriteria && hasValidFairValue && hasValidUpside && hasMinimumUpside;
    const score = (passedCriteria / criteria.length) * 100;
    
    // Calcular quality score com foco na margem de segurança (conceito central do Graham)
    let qualityScore = 0;
    
    // 1. Margem de Segurança (60% do score) - Peso principal
    if (upside && upside > 0) {
      // Normalizar upside: 10% = 20 pontos, 50%+ = 60 pontos (máximo)
      const marginScore = Math.min(upside / 50 * 60, 60);
      qualityScore += marginScore;
    }
    
    // 2. Indicadores Fundamentais (40% do score) - Peso secundário
    // Considerar crescimento apenas se CAGR 5 anos for positivo
    const shouldConsiderGrowth = cagrLucros5a && cagrLucros5a > 0;
    const growthScore = shouldConsiderGrowth && crescimentoLucros ? 
      Math.min(Math.max(0, crescimentoLucros + 0.15), 0.50) * 20 : 0; // Até 10 pontos se CAGR positivo
    
    const fundamentalsScore = (
      Math.min(roe || 0, 0.25) * 60 +        // ROE: até 15 pontos
      Math.min(liquidezCorrente || 0, 2.5) * 6 +     // Liquidez: até 15 pontos  
      Math.min(margemLiquida || 0, 0.15) * 67 +      // Margem: até 10 pontos
      growthScore                                      // Crescimento: até 10 pontos (só se CAGR > 0)
    ) * 0.4; // 40% do peso total
    
    qualityScore += fundamentalsScore;

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
    const marginOfSafety = params.marginOfSafety || 0.20;
    const results: RankBuilderResult[] = [];

    // Filtrar empresas por overall_score > 50 (remover empresas ruins)
    let filteredCompanies = this.filterCompaniesByOverallScore(companies, 50);
    
    // Filtrar empresas por tamanho se especificado
    filteredCompanies = this.filterCompaniesBySize(filteredCompanies, params.companySize || 'all');

    for (const company of filteredCompanies) {
      if (!this.validateCompanyData(company)) continue;
      
      // EXCLUSÃO AUTOMÁTICA: Verificar critérios de exclusão
      if (this.shouldExcludeCompany(company)) continue;

      const { financials, currentPrice, historicalFinancials } = company;
      const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
      const lpa = toNumber(financials.lpa)!;
      const vpa = toNumber(financials.vpa)!;
      const roe = this.getROE(financials, use7YearAverages, historicalFinancials) || 0;
      const liquidezCorrente = this.getLiquidezCorrente(financials, use7YearAverages, historicalFinancials) || 0;
      const margemLiquida = this.getMargemLiquida(financials, use7YearAverages, historicalFinancials) || 0;
      const crescimentoLucros = toNumber(financials.crescimentoLucros) || 0;
      const cagrLucros5a = toNumber(financials.cagrLucros5a);
      const marketCap = toNumber(financials.marketCap);

      // Fórmula de Graham: Preço Justo = √(22.5 × LPA × VPA)
      const fairValue = Math.sqrt(22.5 * lpa * vpa);
      const marginOfSafetyActual = (fairValue / currentPrice) - 1;

      // Filtrar apenas empresas com margem de segurança >= parâmetro
      if (marginOfSafetyActual >= marginOfSafety && (marketCap && marketCap >= 2000000000)) {
        const upside = ((fairValue / currentPrice) - 1) * 100;

        // Score de qualidade com foco na margem de segurança (conceito central do Graham)
        let qualityScore = 0;
        
        // 1. Margem de Segurança (60% do score) - Peso principal
        const marginOfSafetyPercent = marginOfSafetyActual * 100;
        if (marginOfSafetyPercent > 0) {
          // Normalizar margem: 10% = 20 pontos, 50%+ = 60 pontos (máximo)
          const marginScore = Math.min(marginOfSafetyPercent / 50 * 60, 60);
          qualityScore += marginScore;
        }
        
        // 2. Indicadores Fundamentais (40% do score) - Peso secundário
        // Considerar crescimento apenas se CAGR 5 anos for positivo
        const shouldConsiderGrowth = cagrLucros5a && cagrLucros5a > 0;
        const growthScore = shouldConsiderGrowth && crescimentoLucros ? 
          Math.min(Math.max(0, crescimentoLucros + 0.15), 0.50) * 20 : 0; // Até 10 pontos se CAGR positivo
        
        const fundamentalsScore = (
          Math.min(roe, 0.25) * 60 +        // ROE: até 15 pontos
          Math.min(liquidezCorrente, 2.5) * 6 +     // Liquidez: até 15 pontos
          Math.min(margemLiquida, 0.15) * 67 +      // Margem: até 10 pontos
          growthScore                                // Crescimento: até 10 pontos (só se CAGR > 0)
        ) * 0.4; // 40% do peso total
        
        qualityScore += fundamentalsScore;

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
          rational: `Aprovada no Graham Quality Model com ${Number((marginOfSafetyActual * 100).toFixed(1))}% de margem de segurança (peso 60% do score). Fundamentos sólidos: ROE ${Number((roe * 100)).toFixed(1)}%, LC ${Number(liquidezCorrente).toFixed(2)}, Margem Líquida ${Number((margemLiquida * 100)).toFixed(1)}%${shouldConsiderGrowth ? `, CAGR 5a ${Number((cagrLucros5a! * 100)).toFixed(1)}%` : ''}. Score de qualidade: ${Number(qualityScore.toFixed(1))}/100.`,
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
    const sortedResults = results
      .sort((a, b) => (b.key_metrics?.qualityScore || 0) - (a.key_metrics?.qualityScore || 0));

    // Remover empresas duplicadas (manter apenas o primeiro ticker de cada empresa)
    const uniqueResults = this.removeDuplicateCompanies(sortedResults);
    
    // Aplicar limite
    const limitedResults = uniqueResults.slice(0, 50);

    // Aplicar priorização técnica se habilitada
    return this.applyTechnicalPrioritization(limitedResults, companies, params.useTechnicalAnalysis);
  }

  generateRational(params: GrahamParams): string {
    return `# MODELO GRAHAM APRIMORADO

**Filosofia**: Baseado na fórmula clássica de Benjamin Graham para encontrar ações baratas de empresas sólidas.

**Estratégia**: Preço Justo = √(22.5 × LPA × VPA), buscando margem de segurança de ${((params.marginOfSafety || 0.20) * 100).toFixed(0)}%.

## Filtros de Qualidade Aplicados

- ROE ≥ 10% (rentabilidade consistente)
- Liquidez Corrente ≥ 1.0 (capacidade de honrar compromissos)
- Margem Líquida > 0% (empresa lucrativa)
- Crescimento Lucros ≥ -15% (não em declínio severo)
- Dívida Líquida/PL ≤ 150% (endividamento controlado)

**Score de Qualidade**:
- 60% Margem de Segurança (conceito central do Graham)
- 40% Indicadores Fundamentais (ROE, Liquidez, Margem Líquida)

**Ordenação**: Por Score de Qualidade priorizando maior margem de segurança${params.useTechnicalAnalysis ? ' + Priorização por Análise Técnica (ativos em sobrevenda primeiro)' : ''}.

**Objetivo**: Encontrar empresas subvalorizadas MAS financeiramente saudáveis, evitando "value traps"${params.useTechnicalAnalysis ? '. Com análise técnica ativa, priorizamos ativos em sobrevenda para melhor timing de entrada' : ''}.`;
  }
}
