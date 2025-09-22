import { AbstractStrategy, toNumber, formatPercent, validateEarningsGrowth } from './base-strategy';
import { GordonParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';

// Parâmetros setoriais baseados em dados de mercado e estudos de WACC
const SECTORAL_PARAMETERS = {
  // Setores de baixo risco - WACC menor, crescimento conservador
  'Energia Elétrica': { waccAdjustment: -0.02, growthAdjustment: 0.02 }, // Utilities: WACC ~8-10%
  'Saneamento': { waccAdjustment: -0.02, growthAdjustment: 0.02 },
  'Água e Saneamento': { waccAdjustment: -0.02, growthAdjustment: 0.02 },
  'Petróleo e Gás': { waccAdjustment: -0.01, growthAdjustment: 0.015 }, // Energia: WACC ~9-11%
  
  // Setores financeiros - WACC moderado, crescimento baseado em ROE
  'Bancos': { waccAdjustment: 0.00, growthAdjustment: 0.03 }, // WACC ~10-12%
  'Seguros': { waccAdjustment: 0.00, growthAdjustment: 0.025 },
  'Serviços Financeiros': { waccAdjustment: 0.00, growthAdjustment: 0.025 },
  
  // Setores de consumo - WACC moderado
  'Alimentos e Bebidas': { waccAdjustment: 0.00, growthAdjustment: 0.035 },
  'Comércio': { waccAdjustment: 0.01, growthAdjustment: 0.03 },
  'Consumo': { waccAdjustment: 0.01, growthAdjustment: 0.03 },
  
  // Setores industriais - WACC moderado a alto
  'Siderurgia e Metalurgia': { waccAdjustment: 0.015, growthAdjustment: 0.02 },
  'Papel e Celulose': { waccAdjustment: 0.01, growthAdjustment: 0.025 },
  'Mineração': { waccAdjustment: 0.02, growthAdjustment: 0.02 },
  
  // Setores de alto risco - WACC maior
  'Tecnologia': { waccAdjustment: 0.03, growthAdjustment: 0.06 }, // Tech: WACC ~13-15%
  'Telecomunicações': { waccAdjustment: 0.015, growthAdjustment: 0.02 },
  'Saúde': { waccAdjustment: 0.02, growthAdjustment: 0.04 },
  
  // Padrão para setores não mapeados
  'default': { waccAdjustment: 0.00, growthAdjustment: 0.03 }
} as const;

export class GordonStrategy extends AbstractStrategy<GordonParams> {
  readonly name = 'gordon';

  /**
   * Calcula parâmetros ajustados por setor baseado em dados de mercado
   */
  private getSectoralAdjustedParams(companyData: CompanyData, params: GordonParams): { adjustedDiscountRate: number; adjustedGrowthRate: number } {
    const sector = companyData.sector || 'default';
    const sectorParams = SECTORAL_PARAMETERS[sector as keyof typeof SECTORAL_PARAMETERS] || SECTORAL_PARAMETERS.default;
    
    // Se o ajuste setorial está desabilitado, usar parâmetros originais
    if (params.useSectoralAdjustment === false) {
      return {
        adjustedDiscountRate: params.discountRate,
        adjustedGrowthRate: params.dividendGrowthRate
      };
    }
    
    // Aplicar ajustes setoriais
    let adjustedDiscountRate = params.discountRate + sectorParams.waccAdjustment;
    let adjustedGrowthRate = Math.min(params.dividendGrowthRate + sectorParams.growthAdjustment, adjustedDiscountRate - 0.01);
    
    // Aplicar ajuste manual se fornecido
    if (params.sectoralWaccAdjustment !== undefined) {
      adjustedDiscountRate += params.sectoralWaccAdjustment;
    }
    
    // Garantir que a taxa de desconto seja sempre maior que a de crescimento
    if (adjustedDiscountRate <= adjustedGrowthRate) {
      adjustedGrowthRate = adjustedDiscountRate - 0.01;
    }
    
    // Limites de segurança
    adjustedDiscountRate = Math.max(0.06, Math.min(0.25, adjustedDiscountRate)); // 6% a 25%
    adjustedGrowthRate = Math.max(0.00, Math.min(0.12, adjustedGrowthRate)); // 0% a 12%
    
    return { adjustedDiscountRate, adjustedGrowthRate };
  }

  /**
   * Análise de pares para validação dos parâmetros
   */
  private validateParametersWithComps(companyData: CompanyData, fairValue: number | null): { isReasonable: boolean; reasoning: string } {
    if (!fairValue) return { isReasonable: false, reasoning: 'Preço justo não calculável' };
    
    const currentPrice = companyData.currentPrice;
    const upside = ((fairValue - currentPrice) / currentPrice) * 100;
    const pl = toNumber(companyData.financials.pl);
    const pvp = toNumber(companyData.financials.pvp);
    
    // Validações baseadas em múltiplos de mercado
    const warnings: string[] = [];
    
    // Upside muito alto pode indicar parâmetros otimistas demais
    if (upside > 100) {
      warnings.push('Upside muito elevado (>100%) - parâmetros podem estar otimistas');
    }
    
    // P/L muito baixo com upside alto pode indicar problemas
    if (pl && pl < 5 && upside > 50) {
      warnings.push('P/L muito baixo com alto upside - verificar qualidade dos lucros');
    }
    
    // P/VP muito baixo pode indicar problemas fundamentais
    if (pvp && pvp < 0.5 && upside > 30) {
      warnings.push('P/VP muito baixo - possíveis problemas fundamentais');
    }
    
    const isReasonable = warnings.length === 0 && upside >= -20 && upside <= 80;
    const reasoning = warnings.length > 0 ? warnings.join('; ') : 'Parâmetros consistentes com análise de pares';
    
    return { isReasonable, reasoning };
  }

  validateCompanyData(companyData: CompanyData, params: GordonParams): boolean {
    const { financials, currentPrice } = companyData;
    
    // Dar benefício da dúvida - só requer dados essenciais
    const hasEssentialData = !!(
      financials.dy && toNumber(financials.dy)! > 0 &&
      currentPrice > 0
    );
    
    // Deve ter pelo menos uma fonte de dados de dividendos
    const hasDividendData = !!(
      (financials.ultimoDividendo && toNumber(financials.ultimoDividendo)! > 0) ||
      (financials.dividendYield12m && toNumber(financials.dividendYield12m)! > 0) ||
      (financials.dy && toNumber(financials.dy)! > 0) // Pode usar DY para estimar
    );
    
    // Verificar se as taxas ajustadas são válidas
    const { adjustedDiscountRate, adjustedGrowthRate } = this.getSectoralAdjustedParams(companyData, params);
    const ratesAreValid = adjustedDiscountRate > adjustedGrowthRate;
    
    return hasEssentialData && hasDividendData && ratesAreValid;
  }

  runAnalysis(companyData: CompanyData, params: GordonParams): StrategyAnalysis {
    const { financials, currentPrice } = companyData;
    
    // Obter parâmetros ajustados por setor
    const { adjustedDiscountRate, adjustedGrowthRate } = this.getSectoralAdjustedParams(companyData, params);
    
    const dy = toNumber(financials.dy);
    const dividendYield12m = toNumber(financials.dividendYield12m);
    const ultimoDividendo = toNumber(financials.ultimoDividendo);
    const payout = toNumber(financials.payout);
    const roe = toNumber(financials.roe);
    const crescimentoLucrosRaw = toNumber(financials.crescimentoLucros);
    const crescimentoLucros = validateEarningsGrowth(crescimentoLucrosRaw);
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
      adjustedDiscountRate, 
      adjustedGrowthRate
    );
    const upside = fairValue && currentPrice > 0 ? ((fairValue - currentPrice) / currentPrice) * 100 : null;
    
    const criteria = [
      { label: 'Upside ≥ 15%', value: !!(upside && upside >= 15), description: `Upside: ${upside ? formatPercent(upside / 100) : 'N/A'}` },
      { label: 'Dividend Yield ≥ 4%', value: !!(dy && dy >= 0.04), description: `DY: ${formatPercent(dy)}` },
      { label: 'DY 12m ≥ 3%', value: !dividendYield12m || dividendYield12m >= 0.03, description: `DY 12m: ${dividendYield12m ? formatPercent(dividendYield12m) : 'N/A - Benefício da dúvida'}` },
      { label: 'Payout ≤ 80%', value: !payout || payout <= 0.80, description: `Payout: ${payout ? formatPercent(payout) : 'N/A - Benefício da dúvida'}` },
      { label: 'ROE ≥ 12%', value: !roe || roe >= 0.12, description: `ROE: ${formatPercent(roe) || 'N/A - Benefício da dúvida'}` },
      { label: 'Crescimento Lucros ≥ -20%', value: !crescimentoLucros || crescimentoLucros >= -0.20, description: `Crescimento: ${crescimentoLucros ? formatPercent(crescimentoLucros) : 'N/A - Benefício da dúvida'}` },
      { label: 'Liquidez Corrente ≥ 1.2', value: !liquidezCorrente || liquidezCorrente >= 1.2, description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A - Benefício da dúvida'}` },
      { label: 'Dív. Líq./PL ≤ 100%', value: !dividaLiquidaPl || dividaLiquidaPl <= 1.0, description: `Dív/PL: ${dividaLiquidaPl?.toFixed(1) || 'N/A - Benefício da dúvida'}` }
    ];

    const passedCriteria = criteria.filter(c => c.value).length;
    const hasMinimumCriteria = passedCriteria >= 6; // Reduzido para dar benefício da dúvida
    const hasValidFairValue = !!fairValue;
    const hasValidUpside = !!upside;
    const hasMinimumUpside = !!(upside && upside >= 15);

    const isEligible = hasMinimumCriteria && hasValidFairValue && hasValidUpside && hasMinimumUpside;
    const score = (passedCriteria / criteria.length) * 100;

    // Validação com análise de pares
    const compsValidation = this.validateParametersWithComps(companyData, fairValue);

    // Reasoning detalhado
    let reasoning = '';
    
    // Informações sobre ajustes setoriais
    const sectorInfo = companyData.sector ? ` (Setor: ${companyData.sector})` : '';
    const sectoralAdjustment = params.useSectoralAdjustment !== false;
    const ratesDiffer = adjustedDiscountRate !== params.discountRate || adjustedGrowthRate !== params.dividendGrowthRate;
    
    if (sectoralAdjustment && ratesDiffer) {
      reasoning += `Parâmetros ajustados por setor${sectorInfo}: Taxa desconto ${formatPercent(adjustedDiscountRate)} (base: ${formatPercent(params.discountRate)}), crescimento ${formatPercent(adjustedGrowthRate)} (base: ${formatPercent(params.dividendGrowthRate)}). `;
    } else {
      reasoning += `Parâmetros base utilizados: Taxa desconto ${formatPercent(adjustedDiscountRate)}, crescimento ${formatPercent(adjustedGrowthRate)}${sectorInfo}. `;
    }
    
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
      reasoning = `Empresa elegível pela Fórmula de Gordon com ${passedCriteria}/8 critérios atendidos e upside de ${formatPercent(upside! / 100)}. ` + reasoning;
    }
    
    // Adicionar validação de pares se houver alertas
    if (!compsValidation.isReasonable) {
      reasoning += `Alerta de análise de pares: ${compsValidation.reasoning}. `;
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
    
    // Filtrar empresas por tamanho se especificado
    const filteredCompanies = this.filterCompaniesBySize(companies, params.companySize || 'all');
    
    for (const company of filteredCompanies) {
      if (!this.validateCompanyData(company, params)) continue;
      
      const analysis = this.runAnalysis(company, params);
      if (!analysis.isEligible) continue;
      
      // Obter parâmetros ajustados para o rational
      const { adjustedDiscountRate, adjustedGrowthRate } = this.getSectoralAdjustedParams(company, params);
      
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
      
      // Rational detalhado com informações setoriais
      const sectorInfo = company.sector ? ` (${company.sector})` : '';
      const ratesDiffer = adjustedDiscountRate !== params.discountRate || adjustedGrowthRate !== params.dividendGrowthRate;
      const ratesInfo = ratesDiffer ? 
        ` Taxas ajustadas por setor: ${formatPercent(adjustedDiscountRate)} desconto, ${formatPercent(adjustedGrowthRate)} crescimento.` :
        ` Taxas: ${formatPercent(adjustedDiscountRate)} desconto, ${formatPercent(adjustedGrowthRate)} crescimento.`;
      
      results.push({
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice: company.currentPrice,
        logoUrl: company.logoUrl,
        fairValue: analysis.fairValue!,
        upside: analysis.upside!,
        marginOfSafety: analysis.upside! > 0 ? analysis.upside! : null,
        rational: `Fórmula de Gordon${sectorInfo}: Preço justo R$ ${analysis.fairValue!.toFixed(2)} baseado em dividendos.${ratesInfo} DY: ${formatPercent(dy)}, ROE: ${formatPercent(roe)}, Payout: ${formatPercent(payout)}.`,
        key_metrics: {
          dy: dy || 0,
          roe: roe || 0,
          payout: payout || 0,
          compositeScore: compositeScore,
          adjustedDiscountRate: adjustedDiscountRate,
          adjustedGrowthRate: adjustedGrowthRate
        }
      });
    }
    
    return results.sort((a, b) => (b.key_metrics?.compositeScore || 0) - (a.key_metrics?.compositeScore || 0));
  }

  generateRational(params: GordonParams): string {
    const sectoralAdjustment = params.useSectoralAdjustment !== false;
    
    return `# FÓRMULA DE GORDON (Método dos Dividendos) - CALIBRADA

**Filosofia**: Avalia empresas com base na sustentabilidade e crescimento dos dividendos, utilizando parâmetros calibrados por setor conforme práticas de mercado.

## Parâmetros Base de Análise

- **Taxa de desconto base**: ${formatPercent(params.discountRate)}
- **Taxa de crescimento base**: ${formatPercent(params.dividendGrowthRate)}
- **Ajuste setorial**: ${sectoralAdjustment ? 'Ativado' : 'Desativado'}
${params.sectoralWaccAdjustment ? `- **Ajuste manual WACC**: ${params.sectoralWaccAdjustment > 0 ? '+' : ''}${formatPercent(params.sectoralWaccAdjustment)}` : ''}

## Calibração Setorial

${sectoralAdjustment ? `
**Setores de Baixo Risco** (Utilities, Energia): WACC reduzido (-1% a -2%)
**Setores Financeiros** (Bancos, Seguros): WACC padrão, crescimento baseado em ROE
**Setores Industriais**: WACC moderado (+1% a +1.5%)
**Setores de Alto Risco** (Tecnologia): WACC elevado (+3%), crescimento acelerado

Os parâmetros são automaticamente ajustados baseado no setor da empresa, seguindo estudos de WACC por indústria e análise de pares.
` : `
Utilizando parâmetros fixos sem ajuste setorial.
`}

## Critérios de Seleção

- Dividend yield atrativo (≥4%)
- Payout sustentável (≤80%)
- ROE sólido (≥12%)
- Potencial de valorização (≥15%)
- Validação por análise de pares

## Análise de Pares (Comps)

- Validação de múltiplos P/L e P/VP vs. setor
- Alertas para upsides excessivos (>100%)
- Verificação de consistência com mercado

**Ideal Para**: Investidores focados em renda passiva com crescimento, que valorizam análise fundamentalista calibrada por setor.

**Objetivo**: Encontrar empresas que combinam dividendos atrativos com crescimento sustentável, usando parâmetros realistas baseados em dados de mercado.`;
  }
}
