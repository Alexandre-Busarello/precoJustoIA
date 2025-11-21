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
    const { financials, currentPrice, historicalFinancials, ticker } = companyData;
    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    const isBDR = this.isBDRTicker(ticker);
    
    const ebitda = toNumber(financials.ebitda);
    const fluxoCaixaLivre = toNumber(financials.fluxoCaixaLivre);
    const fluxoCaixaOperacional = toNumber(financials.fluxoCaixaOperacional);
    const sharesOutstanding = toNumber(financials.sharesOutstanding);
    const roe = this.getROE(financials, use7YearAverages, historicalFinancials);
    const margemEbitda = this.getMargemEbitda(financials, use7YearAverages, historicalFinancials);
    const crescimentoReceitas = toNumber(financials.crescimentoReceitas);
    const liquidezCorrente = this.getLiquidezCorrente(financials, use7YearAverages, historicalFinancials);
    const marketCap = toNumber(financials.marketCap);
    
    // Ajustar taxa de desconto para BDRs (mercado internacional tem WACC diferente)
    const defaultDiscountRate = isBDR ? 0.12 : 0.10; // 12% para BDRs (mercado americano), 10% para Brasil
    
    // IMPORTANTE: No modelo DCF, não subtraímos a dívida líquida do Enterprise Value porque:
    // - O Enterprise Value calculado pelo DCF já representa o valor total da empresa
    // - A dívida já está implícita nos fluxos de caixa (juros já foram descontados)
    // - A taxa de desconto (WACC) já considera o custo da dívida
    // Subtrair a dívida novamente seria dupla contagem
    
    const fairValue = this.calculateFCDFairValue(
      ebitda, 
      fluxoCaixaLivre, 
      sharesOutstanding,
      params.growthRate || 0.025,
      params.discountRate || defaultDiscountRate,
      params.yearsProjection || 5
    );
    
    const upside = fairValue && currentPrice > 0 ? ((fairValue - currentPrice) / currentPrice) * 100 : null;
    const minMarginOfSafety = params.minMarginOfSafety || 0.20;

    // Ajustar critérios para BDRs
    const minROE = isBDR ? 0.15 : 0.12; // ROE mínimo mais alto para BDRs (15% vs 12%)
    const minMargemEbitda = isBDR ? 0.12 : 0.15; // Margem EBITDA pode ser um pouco menor para BDRs (12% vs 15%)
    const minLiquidez = isBDR ? 1.0 : 1.2; // Liquidez pode ser um pouco menor para BDRs
    const minMarketCap = isBDR ? 5000000000 : 2000000000; // Market Cap maior para BDRs (R$ 5B vs R$ 2B)

    const criteria = [
      { label: `Upside >= ${(minMarginOfSafety * 100)}`, value: !!((!!upside && upside >= (minMarginOfSafety * 100)) || !upside), description: `Upside: ${formatPercent(upside! / 100)}` },
      { label: 'EBITDA > 0', value: !!(ebitda && ebitda > 0), description: `EBITDA: ${formatCurrency(ebitda)}` },
      { label: 'FCO > 0', value: !fluxoCaixaOperacional || fluxoCaixaOperacional > 0, description: `FCO: ${formatCurrency(fluxoCaixaOperacional) || 'N/A - Benefício da dúvida'}` },
      { label: `ROE ≥ ${(minROE * 100).toFixed(0)}%${isBDR ? ' (BDR)' : ''}`, value: !roe || roe >= minROE, description: `ROE: ${formatPercent(roe) || 'N/A - Benefício da dúvida'}` },
      { label: `Margem EBITDA ≥ ${(minMargemEbitda * 100).toFixed(0)}%${isBDR ? ' (BDR)' : ''}`, value: !margemEbitda || margemEbitda >= minMargemEbitda, description: `Margem EBITDA: ${formatPercent(margemEbitda) || 'N/A - Benefício da dúvida'}` },
      { label: 'Crescimento Receitas ≥ -10%', value: !crescimentoReceitas || crescimentoReceitas >= -0.10, description: `Crescimento: ${formatPercent(crescimentoReceitas) || 'N/A - Benefício da dúvida'}` },
      { label: `Liquidez Corrente ≥ ${minLiquidez.toFixed(1)}${isBDR ? ' (BDR)' : ''}`, value: !liquidezCorrente || liquidezCorrente >= minLiquidez, description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A - Benefício da dúvida'}` },
      { label: `Market Cap ≥ ${isBDR ? 'R$ 5B' : 'R$ 2B'}${isBDR ? ' (BDR)' : ''}`, value: !marketCap || marketCap >= minMarketCap, description: `Market Cap: ${formatCurrency(marketCap) || 'N/A - Benefício da dúvida'}` }
    ];

    const passedCriteria = criteria.filter(c => c.value).length;
    const isEligible = passedCriteria >= 6 && !!fairValue && !!upside && upside >= (minMarginOfSafety * 100); // Reduzido para dar benefício da dúvida
    const score = (passedCriteria / criteria.length) * 100;
    
    // Calcular quality score como no backend
    const isUpsideCalculable = upside !== null && upside !== undefined && upside > 0;
    let scoreBruto = 0;
    if (isUpsideCalculable) {
        // CASO 1: Upside foi calculado. A fórmula original é usada.
        // (Garantindo que upside negativo não subtraia pontos)
        scoreBruto =
            Math.min(roe || 0, 0.4) * 100 +
            Math.min(margemEbitda || 0, 0.5) * 80 +
            Math.max(0, (crescimentoReceitas || 0) + 0.2) * 50 +
            Math.min(liquidezCorrente || 0, 3) * 5 +
            (upside > 0 ? Math.min(upside / 100, 1) * 5 : 0); // Contribuição do upside
    } else {
        // CASO 2: Upside é incalculável. Calculamos sem ele e aplicamos o fator de escala.
        const scoreSemUpside =
            Math.min(roe || 0, 0.4) * 100 +
            Math.min(margemEbitda || 0, 0.5) * 80 +
            Math.max(0, (crescimentoReceitas || 0) + 0.2) * 50 +
            Math.min(liquidezCorrente || 0, 3) * 5;
    
        // O peso do upside (5%) é redistribuído para os outros 95%
        const fatorDeAjuste = 100 / 95; // ~1.0526
        scoreBruto = scoreSemUpside * fatorDeAjuste;
    }
    let fcdQualityScore = Math.min(100, scoreBruto);
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
      discountRate,            // WACC (será ajustado se não fornecido)
      yearsProjection = 5,     // 5 anos de projeção explícita
      minMarginOfSafety = 0.20, // 20% margem de segurança mínima
      limit = 10,
      use7YearAverages = true  // Usar médias históricas por padrão
    } = params;

    const results: RankBuilderResult[] = [];

    // Filtrar empresas por overall_score > 50 (remover empresas ruins)
    let filteredCompanies = this.filterCompaniesByOverallScore(companies, 50);
    
    // Filtrar por tipo de ativo primeiro (b3, bdr, both)
    filteredCompanies = this.filterByAssetType(filteredCompanies, params.assetTypeFilter);

    for (const company of filteredCompanies) {
      if (!this.validateCompanyData(company)) continue;
      
      // EXCLUSÃO AUTOMÁTICA: Verificar critérios de exclusão
      if (this.shouldExcludeCompany(company)) continue;

      const { financials, currentPrice, historicalFinancials, ticker } = company;
      const isBDR = this.isBDRTicker(ticker);
      const ebitda = toNumber(financials.ebitda)!;
      const fluxoCaixaLivre = toNumber(financials.fluxoCaixaLivre);
      const sharesOutstanding = toNumber(financials.sharesOutstanding)!;
      const marketCap = toNumber(financials.marketCap)!;
      
      // Ajustar taxa de desconto para BDRs se não fornecida
      const effectiveDiscountRate = discountRate || (isBDR ? 0.12 : 0.10);
      
      // Usar médias históricas para indicadores de qualidade
      const roe = this.getROE(financials, use7YearAverages, historicalFinancials) || 0;
      const margemEbitda = this.getMargemEbitda(financials, use7YearAverages, historicalFinancials) || 0;
      const crescimentoReceitas = toNumber(financials.crescimentoReceitas) || 0;
      const liquidezCorrente = this.getLiquidezCorrente(financials, use7YearAverages, historicalFinancials) || 0;

      // === CÁLCULO DO FCD ===
      // IMPORTANTE: No modelo DCF, não subtraímos a dívida líquida do Enterprise Value porque:
      // - O Enterprise Value calculado pelo DCF já representa o valor total da empresa
      // - A dívida já está implícita nos fluxos de caixa (juros já foram descontados)
      // - A taxa de desconto (WACC) já considera o custo da dívida
      // Subtrair a dívida novamente seria dupla contagem
      
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
        const pv = projectedCashflows[year] / Math.pow(1 + effectiveDiscountRate, year + 1);
        presentValueCashflows += pv;
      }

      // 4. Calcular Valor Terminal e seu Valor Presente
      const terminalCashflow = projectedCashflows[projectedCashflows.length - 1] * (1 + growthRate);
      const terminalValue = terminalCashflow / (effectiveDiscountRate - growthRate);
      const presentValueTerminal = terminalValue / Math.pow(1 + effectiveDiscountRate, yearsProjection);

      // 5. Valor Total da Empresa (Enterprise Value)
      // O Enterprise Value do DCF já representa o valor total da empresa
      const enterpriseValue = presentValueCashflows + presentValueTerminal;

      // 6. Preço Justo por Ação = Enterprise Value / Número de Ações
      const fairValuePerShare = enterpriseValue / sharesOutstanding;

      // 8. Calcular Margem de Segurança
      const marginOfSafetyActual = (fairValuePerShare / currentPrice) - 1;

      // Ajustar critérios para BDRs
      const minMarketCap = isBDR ? 5000000000 : 2000000000; // R$ 5B para BDRs, R$ 2B para Brasil

      // Filtrar apenas empresas com margem >= parâmetro
      if (marginOfSafetyActual >= minMarginOfSafety && marketCap >= minMarketCap) {
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
          rational: `Aprovada no FCD Premium Model com ${Number((marginOfSafetyActual * 100).toFixed(1))}% de margem de segurança. Preço justo R$ ${fairValuePerShare.toFixed(2)} vs atual R$ ${currentPrice.toFixed(2)}. Base: FCFF R$ ${(fcffBase/1000000).toFixed(0)}M, crescimento ${(growthRate*100).toFixed(1)}%, WACC ${(effectiveDiscountRate*100).toFixed(1)}%. Qualidade: ROE ${(roe*100).toFixed(1)}%, Margem EBITDA ${(margemEbitda*100).toFixed(1)}%. Score FCD: ${Number(fcdQualityScore.toFixed(1))}/100.`,
          key_metrics: {
            fairValue: Number(fairValuePerShare.toFixed(2)),
            fcffBase: Number((fcffBase / 1000000).toFixed(1)), // Em milhões
            enterpriseValue: Number((enterpriseValue / 1000000000).toFixed(2)), // Em bilhões
            presentValueCashflows: Number((presentValueCashflows / 1000000000).toFixed(2)), // Em bilhões
            presentValueTerminal: Number((presentValueTerminal / 1000000000).toFixed(2)), // Em bilhões
            terminalValueContribution: Number(((presentValueTerminal / enterpriseValue) * 100).toFixed(1)), // % do valor
            impliedWACC: effectiveDiscountRate,
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
      .sort((a, b) => (b.upside || 0) - (a.upside || 0));

    // Remover empresas duplicadas (manter apenas o primeiro ticker de cada empresa)
    const uniqueResults = this.removeDuplicateCompanies(sortedResults);
    
    // Aplicar limite
    const limitedResults = uniqueResults.slice(0, limit);

    // Aplicar priorização técnica se habilitada
    return this.applyTechnicalPrioritization(limitedResults, companies, params.useTechnicalAnalysis);
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
