import { AbstractStrategy, toNumber, formatPercent } from './base-strategy';
import { LowPEParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';

export class LowPEStrategy extends AbstractStrategy<LowPEParams> {
  readonly name = 'lowPE';

  validateCompanyData(companyData: CompanyData, params: LowPEParams): boolean {
    const { financials } = companyData;
    const { maxPE } = params;
    // Dar benefício da dúvida - só requer P/L válido
    return !!(
      financials.pl && toNumber(financials.pl)! > 3 && toNumber(financials.pl)! <= maxPE
    );
  }

  runAnalysis(companyData: CompanyData, params: LowPEParams): StrategyAnalysis {
    const { financials, historicalFinancials, ticker } = companyData;
    const { maxPE, minROE = 0.15 } = params;
    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    const isBDR = this.isBDRTicker(ticker);
    
    const pl = this.getPL(financials, false, historicalFinancials);
    const roe = this.getROE(financials, use7YearAverages, historicalFinancials);
    const crescimentoReceitas = toNumber(financials.crescimentoReceitas);
    const margemLiquida = this.getMargemLiquida(financials, use7YearAverages, historicalFinancials);
    const liquidezCorrente = this.getLiquidezCorrente(financials, use7YearAverages, historicalFinancials);
    const roa = toNumber(financials.roa);
    const dividaLiquidaPl = this.getDividaLiquidaPl(financials, use7YearAverages, historicalFinancials);
    const marketCap = toNumber(financials.marketCap);
    const roic = this.getROIC(financials, use7YearAverages, historicalFinancials);

    // Ajustar critérios para BDRs (mercado internacional aceita P/E mais alto)
    const effectiveMaxPE = isBDR ? Math.max(maxPE, 25) : maxPE; // P/E máximo mais alto para BDRs (mínimo 25)
    const effectiveMinROE = isBDR ? Math.max(minROE, 0.12) : minROE; // ROE mínimo mais alto para BDRs (mínimo 12%)
    const minMargemLiquida = isBDR ? 0.05 : 0.03; // Margem líquida mínima mais alta para BDRs (5% vs 3%)
    const maxDividaLiquidaPl = isBDR ? 2.5 : 2.0; // Mais tolerante com dívida para BDRs (250% vs 200%)
    const minMarketCap = isBDR ? 2000000000 : 500000000; // Market Cap maior para BDRs (R$ 2B vs R$ 500M)

    const criteria = [
      { label: `P/L entre 3-${effectiveMaxPE}${isBDR ? ' (BDR)' : ''}`, value: !!(pl && pl > 3 && pl <= effectiveMaxPE), description: `P/L: ${pl?.toFixed(1) || 'N/A'}` },
      { label: `ROE ≥ ${(effectiveMinROE * 100).toFixed(0)}%${isBDR ? ' (BDR)' : ''}`, value: !roe || roe >= effectiveMinROE, description: `ROE: ${formatPercent(roe) || 'N/A - Benefício da dúvida'}` },
      { label: 'Crescimento Receitas ≥ -10%', value: !crescimentoReceitas || crescimentoReceitas >= -0.10, description: `Crescimento: ${formatPercent(crescimentoReceitas) || 'N/A - Benefício da dúvida'}` },
      { label: `Margem Líquida ≥ ${(minMargemLiquida * 100).toFixed(0)}%${isBDR ? ' (BDR)' : ''}`, value: !margemLiquida || margemLiquida >= minMargemLiquida, description: `Margem: ${formatPercent(margemLiquida) || 'N/A - Benefício da dúvida'}` },
      { label: 'Liquidez Corrente ≥ 1.0', value: !liquidezCorrente || liquidezCorrente >= 1.0, description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A - Benefício da dúvida'}` },
      { label: 'ROA ≥ 5%', value: !roa || roa >= 0.05, description: `ROA: ${formatPercent(roa) || 'N/A - Benefício da dúvida'}` },
      { label: `Dív. Líq./PL ≤ ${(maxDividaLiquidaPl * 100).toFixed(0)}%${isBDR ? ' (BDR)' : ''}`, value: !dividaLiquidaPl || dividaLiquidaPl <= maxDividaLiquidaPl, description: `Dív/PL: ${dividaLiquidaPl?.toFixed(1) || 'N/A - Benefício da dúvida'}` },
      { label: `Market Cap ≥ ${isBDR ? 'R$ 2B' : 'R$ 500M'}${isBDR ? ' (BDR)' : ''}`, value: !marketCap || marketCap >= minMarketCap, description: `Market Cap: ${marketCap ? `R$ ${(marketCap / 1000000).toFixed(0)}M` : 'N/A - Benefício da dúvida'}` }
    ];
    
    const passedCriteria = criteria.filter(c => c.value).length;
    const isEligible = passedCriteria >= 6 && !!pl && pl > 3 && pl <= effectiveMaxPE; // Reduzido para dar benefício da dúvida
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
    const { maxPE, minROE = 0.15 } = params;
    const results: RankBuilderResult[] = [];

    // Filtrar empresas por overall_score > 50 (remover empresas ruins)
    let filteredCompanies = this.filterCompaniesByOverallScore(companies, 50);
    
    // Filtrar tickers que terminam em 5, 6, 7, 8 ou 9
    filteredCompanies = this.filterTickerEndingDigits(filteredCompanies);
    
    // Filtrar por tipo de ativo primeiro (b3, bdr, both)
    filteredCompanies = this.filterByAssetType(filteredCompanies, params.assetTypeFilter);

    for (const company of filteredCompanies) {
      if (!this.validateCompanyData(company, params)) continue;
      
      // EXCLUSÃO AUTOMÁTICA: Verificar critérios de exclusão
      if (this.shouldExcludeCompany(company)) continue;

      const { financials, currentPrice, ticker } = company;
      const isBDR = this.isBDRTicker(ticker);
      const pl = toNumber(financials.pl)!;
      const roe = toNumber(financials.roe) || 0;
      const roa = toNumber(financials.roa) || 0;
      const margemLiquida = toNumber(financials.margemLiquida) || 0;
      const liquidezCorrente = toNumber(financials.liquidezCorrente) || 0;
      const crescimentoReceitas = toNumber(financials.crescimentoReceitas) || 0;
      const roic = toNumber(financials.roic) || 0;

      // Ajustar critérios para BDRs
      const effectiveMaxPE = isBDR ? Math.max(maxPE, 25) : maxPE;
      const effectiveMinROE = isBDR ? Math.max(minROE, 0.12) : minROE;
      
      // Verificar se atende aos critérios ajustados
      if (pl > effectiveMaxPE || roe < effectiveMinROE) continue;

      // Score de value investing (qualidade + preço baixo)
      // Para BDRs, ajustar peso do P/L (mercado aceita P/E mais alto)
      const plWeight = isBDR ? 1.5 : 2.0; // Menor penalização por P/L alto para BDRs
      let valueScore = (
        Math.max(0, 50 - pl * plWeight) +         // Premia P/L baixo (ajustado para BDRs)
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
    const sortedResults = results
      .sort((a, b) => (b.key_metrics?.valueScore || 0) - (a.key_metrics?.valueScore || 0));

    // Remover empresas duplicadas (manter apenas o primeiro ticker de cada empresa)
    const uniqueResults = this.removeDuplicateCompanies(sortedResults);
    
    // Aplicar limite
    const limitedResults = uniqueResults.slice(0, 50);

    // Aplicar priorização técnica se habilitada
    return this.applyTechnicalPrioritization(limitedResults, companies, params.useTechnicalAnalysis);
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

**Ordenação**: Por Value Score (combina preço atrativo + indicadores de qualidade)${params.useTechnicalAnalysis ? ' + Priorização por Análise Técnica (ativos em sobrevenda primeiro)' : ''}.

**Objetivo**: Empresas baratas que são REALMENTE bons negócios, não problemas disfarçados${params.useTechnicalAnalysis ? '. Com análise técnica ativa, priorizamos ativos em sobrevenda para melhor timing de entrada' : ''}.`;
  }
}
