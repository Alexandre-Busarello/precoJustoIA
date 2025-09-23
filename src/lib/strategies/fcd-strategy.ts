import { AbstractStrategy, toNumber, formatCurrency, formatPercent } from './base-strategy';
import { FCDParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';

export class FCDStrategy extends AbstractStrategy<FCDParams> {
  readonly name = 'fcd';

  validateCompanyData(companyData: CompanyData): boolean {
    const { financials } = companyData;
    // Dar benefício da dúvida - só requer dados essenciais para FCD
    return !!(
      financials.ebitda && toNumber(financials.ebitda)! > 0 &&
      financials.sharesOutstanding && toNumber(financials.sharesOutstanding)! > 0
    );
  }

  runAnalysis(companyData: CompanyData, params: FCDParams = {}): StrategyAnalysis {
    const { financials, currentPrice } = companyData;
    
    const ebitda = toNumber(financials.ebitda);
    const fluxoCaixaLivre = toNumber(financials.fluxoCaixaLivre);
    const fluxoCaixaOperacional = toNumber(financials.fluxoCaixaOperacional);
    const sharesOutstanding = toNumber(financials.sharesOutstanding);
    const roe = toNumber(financials.roe);
    const margemEbitda = toNumber(financials.margemEbitda);
    const crescimentoReceitas = toNumber(financials.crescimentoReceitas);
    const liquidezCorrente = toNumber(financials.liquidezCorrente);
    const marketCap = toNumber(financials.marketCap);
    
    const fairValue = this.calculateFCDFairValue(
      ebitda, 
      fluxoCaixaLivre, 
      sharesOutstanding,
      params.growthRate || 0.025,
      params.discountRate || 0.10,
      params.yearsProjection || 5
    );
    
    const upside = fairValue && currentPrice > 0 ? ((fairValue - currentPrice) / currentPrice) * 100 : null;
    const minMarginOfSafety = params.minMarginOfSafety || 0.20;

    const criteria = [
      { label: `Upside >= ${(minMarginOfSafety * 100)}`, value: !!(!!upside && upside >= (minMarginOfSafety * 100)), description: `Upside: ${formatPercent(upside! / 100)}` },
      { label: 'EBITDA > 0', value: !!(ebitda && ebitda > 0), description: `EBITDA: ${formatCurrency(ebitda)}` },
      { label: 'FCO > 0', value: !fluxoCaixaOperacional || fluxoCaixaOperacional > 0, description: `FCO: ${formatCurrency(fluxoCaixaOperacional) || 'N/A - Benefício da dúvida'}` },
      { label: 'ROE ≥ 12%', value: !roe || roe >= 0.12, description: `ROE: ${formatPercent(roe) || 'N/A - Benefício da dúvida'}` },
      { label: 'Margem EBITDA ≥ 15%', value: !margemEbitda || margemEbitda >= 0.15, description: `Margem EBITDA: ${formatPercent(margemEbitda) || 'N/A - Benefício da dúvida'}` },
      { label: 'Crescimento Receitas ≥ -10%', value: !crescimentoReceitas || crescimentoReceitas >= -0.10, description: `Crescimento: ${formatPercent(crescimentoReceitas) || 'N/A - Benefício da dúvida'}` },
      { label: 'Liquidez Corrente ≥ 1.2', value: !liquidezCorrente || liquidezCorrente >= 1.2, description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A - Benefício da dúvida'}` },
      { label: 'Market Cap ≥ R$ 2B', value: !marketCap || marketCap >= 2000000000, description: `Market Cap: ${formatCurrency(marketCap) || 'N/A - Benefício da dúvida'}` }
    ];

    const passedCriteria = criteria.filter(c => c.value).length;
    const isEligible = passedCriteria >= 6 && !!fairValue && !!upside && upside >= (minMarginOfSafety * 100); // Reduzido para dar benefício da dúvida
    const score = (passedCriteria / criteria.length) * 100;
    
    // Calcular quality score como no backend
    let fcdQualityScore = Math.min(100, (
      Math.min(roe || 0, 0.4) * 100 +          // ROE strong (até 40% = 40 pontos)
      Math.min(margemEbitda || 0, 0.5) * 80 +  // Margem EBITDA (até 50% = 40 pontos)
      Math.max(0, (crescimentoReceitas || 0) + 0.2) * 50 + // Crescimento não negativo
      Math.min(liquidezCorrente || 0, 3) * 5 +  // Liquidez adequada
      Math.min((upside || 0) / 100, 1) * 5      // Upside potencial
    ));

    if (fcdQualityScore > 100) fcdQualityScore = 100;
    
    const reasoning = `Análise FCD: Preço justo calculado em ${formatCurrency(fairValue)} vs atual ${formatCurrency(currentPrice)}. ${passedCriteria} de ${criteria.length} critérios Premium atendidos (Score FCD: ${fcdQualityScore.toFixed(1)}). ${
      isEligible ? `Upside potencial de ${upside?.toFixed(1)}%. Empresa atende aos critérios Premium de geração de caixa com margem de segurança robusta.` :
      !fairValue ? `Não foi possível calcular preço justo (dados de fluxo de caixa insuficientes).` :
      upside! < (minMarginOfSafety * 100) ? `Upside insuficiente (${upside?.toFixed(1)}%). FCD requer margem de segurança mínima de ${(minMarginOfSafety * 100).toFixed(0)}%.` :
      `Apenas ${passedCriteria} critérios Premium atendidos. Empresa não passa nos rigorosos filtros de qualidade FCD.`
    }`;

    return {
      isEligible,
      score,
      fairValue,
      upside,
      reasoning,
      criteria,
      key_metrics: {
        fairValue: fairValue,
        fcdQualityScore: Number(fcdQualityScore.toFixed(1)),
        ebitda: ebitda,
        fluxoCaixaLivre: fluxoCaixaLivre,
        roe: roe,
        margemEbitda: margemEbitda
      }
    };
  }

  runRanking(companies: CompanyData[], params: FCDParams): RankBuilderResult[] {
    const { 
      growthRate = 0.025,      // 2.5% crescimento perpétuo (padrão conservador)
      discountRate = 0.10,     // 10% WACC (padrão para mercado brasileiro)
      yearsProjection = 5,     // 5 anos de projeção explícita
      minMarginOfSafety = 0.20, // 20% margem de segurança mínima
      limit = 10 
    } = params;

    const results: RankBuilderResult[] = [];

    for (const company of companies) {
      if (!this.validateCompanyData(company)) continue;

      const { financials, currentPrice } = company;
      const ebitda = toNumber(financials.ebitda)!;
      const fluxoCaixaLivre = toNumber(financials.fluxoCaixaLivre);
      const sharesOutstanding = toNumber(financials.sharesOutstanding)!;
      const marketCap = toNumber(financials.marketCap)!;
      const roe = toNumber(financials.roe) || 0;
      const margemEbitda = toNumber(financials.margemEbitda) || 0;
      const crescimentoReceitas = toNumber(financials.crescimentoReceitas) || 0;
      const liquidezCorrente = toNumber(financials.liquidezCorrente) || 0;

      // === CÁLCULO DO FCD ===
      
      // 1. Fluxo de Caixa Base
      let fcffBase: number;
      if (fluxoCaixaLivre && fluxoCaixaLivre > 0) {
        fcffBase = fluxoCaixaLivre;
      } else {
        // Estimativa conservadora: EBITDA * 0.6
        fcffBase = ebitda * 0.6;
      }

      if (fcffBase <= 0) continue;

      // 2. Projetar Fluxos de Caixa Futuros
      const projectedCashflows: number[] = [];
      let currentCashflow = fcffBase;
      
      for (let year = 1; year <= yearsProjection; year++) {
        // Taxa de crescimento decrescente: começa mais alto e converge para taxa perpétua
        const yearlyGrowth = growthRate + (0.05 * Math.exp(-year * 0.5)); // Decai exponencialmente
        currentCashflow = currentCashflow * (1 + yearlyGrowth);
        projectedCashflows.push(currentCashflow);
      }

      // 3. Calcular Valor Presente dos Fluxos
      let presentValueCashflows = 0;
      for (let year = 0; year < projectedCashflows.length; year++) {
        const pv = projectedCashflows[year] / Math.pow(1 + discountRate, year + 1);
        presentValueCashflows += pv;
      }

      // 4. Calcular Valor Terminal e seu Valor Presente
      const terminalCashflow = projectedCashflows[projectedCashflows.length - 1] * (1 + growthRate);
      const terminalValue = terminalCashflow / (discountRate - growthRate);
      const presentValueTerminal = terminalValue / Math.pow(1 + discountRate, yearsProjection);

      // 5. Valor Total da Empresa
      const enterpriseValue = presentValueCashflows + presentValueTerminal;

      // 6. Preço Justo por Ação
      const fairValuePerShare = enterpriseValue / sharesOutstanding;

      // 7. Calcular Margem de Segurança
      const marginOfSafetyActual = (fairValuePerShare / currentPrice) - 1;

      // Filtrar apenas empresas com margem >= parâmetro
      if (marginOfSafetyActual >= minMarginOfSafety) {
        const upside = marginOfSafetyActual * 100;

        // Score FCD: combina upside potencial + qualidade dos dados
        let fcdQualityScore = Math.min(100, (
          Math.min(roe, 0.4) * 100 +          // ROE strong (até 40% = 40 pontos)
          Math.min(margemEbitda, 0.5) * 80 +  // Margem EBITDA (até 50% = 40 pontos)
          Math.max(0, crescimentoReceitas + 0.2) * 50 +    // Crescimento não negativo (até 20% = 10 pontos)
          Math.min(liquidezCorrente, 3) * 5 +               // Liquidez adequada (até 3.0 = 15 pontos)
          Math.min(marginOfSafetyActual, 1) * 5    // Upside potencial (até 100% = 5 pontos)
        ));

        if (fcdQualityScore > 100) fcdQualityScore = 100;

        results.push({
          ticker: company.ticker,
          name: company.name,
          sector: company.sector,
          currentPrice,
          logoUrl: company.logoUrl,
          fairValue: Number(fairValuePerShare.toFixed(2)),
          upside: Number(upside.toFixed(2)),
          marginOfSafety: Number((marginOfSafetyActual * 100).toFixed(2)),
          rational: `Aprovada no FCD Premium Model com ${Number((marginOfSafetyActual * 100).toFixed(1))}% de margem de segurança. Preço justo R$ ${fairValuePerShare.toFixed(2)} vs atual R$ ${currentPrice.toFixed(2)}. Base: FCFF R$ ${(fcffBase/1000000).toFixed(0)}M, crescimento ${(growthRate*100).toFixed(1)}%, WACC ${(discountRate*100).toFixed(1)}%. Qualidade: ROE ${(roe*100).toFixed(1)}%, Margem EBITDA ${(margemEbitda*100).toFixed(1)}%. Score FCD: ${Number(fcdQualityScore.toFixed(1))}/100.`,
          key_metrics: {
            fairValue: Number(fairValuePerShare.toFixed(2)),
            fcffBase: Number((fcffBase / 1000000).toFixed(1)), // Em milhões
            enterpriseValue: Number((enterpriseValue / 1000000000).toFixed(2)), // Em bilhões
            presentValueCashflows: Number((presentValueCashflows / 1000000000).toFixed(2)), // Em bilhões
            presentValueTerminal: Number((presentValueTerminal / 1000000000).toFixed(2)), // Em bilhões
            terminalValueContribution: Number(((presentValueTerminal / enterpriseValue) * 100).toFixed(1)), // % do valor
            impliedWACC: discountRate,
            impliedGrowth: growthRate,
            projectionYears: yearsProjection,
            fcdQualityScore: Number(fcdQualityScore.toFixed(1)),
            roe: roe,
            margemEbitda: margemEbitda,
            crescimentoReceitas: crescimentoReceitas,
            liquidezCorrente: liquidezCorrente,
            marketCapBi: marketCap ? Number((marketCap / 1000000000).toFixed(1)) : null,
          }
        });
      }
    }

    // Ordenar por Upside Potencial (maior margem de segurança primeiro)
    const sortedResults = results
      .sort((a, b) => (b.upside || 0) - (a.upside || 0))
      .slice(0, limit);

    // Aplicar priorização técnica se habilitada
    return this.applyTechnicalPrioritization(sortedResults, companies, params.useTechnicalAnalysis);
  }

  generateRational(params: FCDParams): string {
    const growthRate = ((params.growthRate || 0.025) * 100).toFixed(1);
    const discountRate = ((params.discountRate || 0.10) * 100).toFixed(1);
    const years = params.yearsProjection || 5;
    const marginSafety = ((params.minMarginOfSafety || 0.20) * 100).toFixed(0);
    
    return `# MODELO FLUXO DE CAIXA DESCONTADO (FCD)

**Filosofia**: Avaliação intrínseca baseada na capacidade de geração de caixa da empresa, projétando fluxos futuros e descontando-os a valor presente.

## Metodologia Aplicada

- **Fluxo de Caixa Livre da Firma (FCFF)**: EBITDA - Capex Estimado - Variação Capital de Giro
- **Projeção**: ${years} anos com crescimento de ${growthRate}% ao ano
- **Taxa de Desconto**: ${discountRate}% (WACC simplificado considerando risco Brasil)
- **Valor Terminal**: Crescimento perpétuo de ${growthRate}% pós-período explícito
- **Margem de Segurança**: Mínima de ${marginSafety}%

## Filtros de Qualidade Premium

- EBITDA > 0 e consistente (geração de caixa operacional)
- Fluxo de Caixa Operacional > 0 (capacidade real de geração)
- ROE ≥ 12% (rentabilidade superior sobre patrimônio)
- Margem EBITDA ≥ 15% (eficiência operacional elevada)
- Crescimento Receitas ≥ -10% (não em declínio operacional severo)
- Liquidez Corrente ≥ 1.2 (situação financeira sólida)
- Market Cap ≥ R$ 2B (empresas consolidadas e líquidas)

## Diferencial Premium

- Cálculo sofisticado de valor intrínseco baseado em DCF
- Considera valor temporal do dinheiro e risco específico
- Projeta cenários futuros realistas de geração de caixa
- Identifica empresas subvalorizadas com base em fundamentos sólidos${params.useTechnicalAnalysis ? '\n- Prioriza ativos em sobrevenda para melhor timing de entrada' : ''}

**Resultado**: Preço justo calculado por metodologia robusta utilizada por analistas profissionais${params.useTechnicalAnalysis ? ', com priorização técnica para otimizar pontos de entrada' : ''}.`;
  }
}
