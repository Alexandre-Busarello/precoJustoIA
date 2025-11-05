import { AbstractStrategy, toNumber, formatCurrency, formatPercent } from './base-strategy';
import { BarsiParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';
import { prisma } from '@/lib/prisma';

export class BarsiStrategy extends AbstractStrategy<BarsiParams> {
  readonly name = 'barsi';

  // Setores "perenes" do método B.E.S.T. + Gás
  private readonly PERENNIAL_SECTORS = [
    'Bancos',
    'Energia Elétrica', 
    'Saneamento',
    'Seguros',
    'Telecomunicações',
    'Gás',
    'Água e Saneamento',
    'Energia',
    'Serviços Financeiros',
    'Utilities',
    'Utilidade Pública'
  ];

  /**
   * Calcula a média de dividendos pagos nos últimos 5-6 anos
   * usando o histórico de dividendos da empresa
   */
  private async calculateAverageDividend(ticker: string): Promise<number | null> {
    try {
      // Buscar empresa pelo ticker
      const company = await prisma.company.findUnique({
        where: { ticker },
        include: {
          dividendHistory: {
            orderBy: { exDate: 'desc' }
          }
        }
      });

      if (!company || !company.dividendHistory || company.dividendHistory.length === 0) {
        return null;
      }

      // Definir o período de análise (5-6 anos atrás)
      const currentDate = new Date();
      const yearsToLookBack = 6;
      const cutoffDate = new Date(currentDate);
      cutoffDate.setFullYear(cutoffDate.getFullYear() - yearsToLookBack);

      // Filtrar dividendos dos últimos 5-6 anos
      const recentDividends = company.dividendHistory.filter((div: { exDate: Date }) => 
        div.exDate >= cutoffDate
      );

      if (recentDividends.length === 0) {
        return null;
      }

      // Agrupar dividendos por ano e somar
      const dividendsByYear = new Map<number, number>();
      
      for (const dividend of recentDividends) {
        const year = dividend.exDate.getFullYear();
        const amount = toNumber(dividend.amount) || 0;
        
        const currentSum = dividendsByYear.get(year) || 0;
        dividendsByYear.set(year, currentSum + amount);
      }

      // Se temos menos de 2 anos de dados, não é confiável
      if (dividendsByYear.size < 2) {
        return null;
      }

      // Calcular a média anual
      const yearlyTotals = Array.from(dividendsByYear.values());
      const averageDividend = yearlyTotals.reduce((sum, total) => sum + total, 0) / yearlyTotals.length;

      return averageDividend;
    } catch (error) {
      console.error(`Erro ao calcular média de dividendos para ${ticker}:`, error);
      return null;
    }
  }

  validateCompanyData(companyData: CompanyData): boolean {
    const { ultimoDividendo, financials } = companyData;
    // Dados essenciais para o método Barsi
    return !!(
      financials.dy && toNumber(financials.dy)! > 0 &&
      financials.ultimoDividendo && toNumber(ultimoDividendo || financials.ultimoDividendo)! > 0 &&
      companyData.currentPrice > 0
    );
  }

  /**
   * Verifica se a empresa está em setor "perene" (B.E.S.T.)
   */
  private isPerennialSector(sector: string | null): boolean {
    if (!sector) return false;
    
    return this.PERENNIAL_SECTORS.some(perennialSector => 
      sector.toLowerCase().includes(perennialSector.toLowerCase()) ||
      perennialSector.toLowerCase().includes(sector.toLowerCase())
    );
  }

  /**
   * Calcula o "preço teto" baseado na meta de DY do Barsi
   * Preço Teto = Dividendo por Ação / DY Desejado
   */
  private calculateCeilingPrice(
    dividendPerShare: number, 
    targetDY: number, 
    multiplier: number = 1.0
  ): number {
    return (dividendPerShare / targetDY) * multiplier;
  }

  /**
   * Verifica histórico de dividendos consistentes
   * Analisa se a empresa pagou dividendos nos últimos anos
   */
  private hasConsistentDividendHistory(
    companyData: CompanyData, 
    minYears: number = 5
  ): boolean {
    const { historicalFinancials } = companyData;
    
    if (!historicalFinancials || historicalFinancials.length < minYears) {
      // Se não temos dados históricos suficientes, dar benefício da dúvida
      // se o DY atual for > 3% (indica empresa pagadora)
      const currentDY = toNumber(companyData.financials.dy);
      return !!(currentDY && currentDY > 0.03);
    }

    // Contar quantos anos dos últimos N anos pagaram dividendos
    const recentYears = historicalFinancials
      .slice(0, minYears)
      .filter(year => {
        const dy = toNumber(year.dy);
        return dy && dy > 0.01; // Pelo menos 1% de DY
      });

    return recentYears.length >= Math.floor(minYears * 0.8); // 80% dos anos
  }

  async runAnalysis(companyData: CompanyData, params: BarsiParams): Promise<StrategyAnalysis> {
    const { financials, currentPrice, sector, historicalFinancials, ticker } = companyData;
    const {
      targetDividendYield,
      maxPriceToPayMultiplier = 1.0,
      minConsecutiveDividends = 5,
      maxDebtToEquity = 1.0,
      minROE = 0.10,
      focusOnBEST = true
    } = params;

    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    
    // Métricas principais
    const dy = this.getDividendYield(financials, use7YearAverages, historicalFinancials);
    
    // Calcular média de dividendos dos últimos 5-6 anos
    let averageDividend = await this.calculateAverageDividend(ticker);
    
    // Se não conseguir calcular pela média histórica, usar ultimoDividendo como fallback
    if (!averageDividend) {
      averageDividend = toNumber(companyData.ultimoDividendo || financials.ultimoDividendo) || null;
    }
    
    const roe = this.getROE(financials, use7YearAverages, historicalFinancials);
    const dividaLiquidaPl = this.getDividaLiquidaPl(financials, use7YearAverages, historicalFinancials);
    const liquidezCorrente = this.getLiquidezCorrente(financials, use7YearAverages, historicalFinancials);
    const margemLiquida = this.getMargemLiquida(financials, use7YearAverages, historicalFinancials);
    const payout = toNumber(financials.payout);
    const marketCap = toNumber(financials.marketCap);

    // Calcular preço teto baseado no método Barsi usando a média de dividendos
    const ceilingPrice = averageDividend ? 
      this.calculateCeilingPrice(averageDividend, targetDividendYield, maxPriceToPayMultiplier) : null;
    
    const isUnderCeiling = ceilingPrice ? currentPrice <= ceilingPrice : false;
    const discountFromCeiling = ceilingPrice ? ((ceilingPrice - currentPrice) / ceilingPrice) * 100 : null;

    // Verificações do método Barsi
    const isPerennialSector = this.isPerennialSector(sector);
    const hasConsistentDividends = this.hasConsistentDividendHistory(companyData, minConsecutiveDividends);
    const hasGoodProfitability = !!(roe && roe >= minROE);
    const hasLowDebt = !dividaLiquidaPl || dividaLiquidaPl <= maxDebtToEquity;
    const hasPositiveMargin = !margemLiquida || margemLiquida > 0;
    const hasReasonablePayout = !payout || (payout > 0.20 && payout < 0.95); // Entre 20% e 80%
    const hasMinimumSize = !marketCap || marketCap >= 1000000000; // R$ 1B mínimo

    const criteria = [
      { 
        label: focusOnBEST ? 'Setor Perene (B.E.S.T.)' : 'Setor Perene (Opcional)', 
        value: !focusOnBEST || isPerennialSector, 
        description: `Setor: ${sector || 'N/A'}${isPerennialSector ? ' ✓ Perene' : ' ⚠️ Não-perene'}` 
      },
      { 
        label: `Preço ≤ Teto (DY ${(targetDividendYield * 100).toFixed(1)}%)`, 
        value: isUnderCeiling, 
        description: `Preço: ${formatCurrency(currentPrice)} | Teto: ${formatCurrency(ceilingPrice)} ${discountFromCeiling ? `(${discountFromCeiling.toFixed(1)}% desconto)` : ''}` 
      },
      { 
        label: `Dividendos Consistentes (${minConsecutiveDividends}a)`, 
        value: hasConsistentDividends, 
        description: `Histórico: ${hasConsistentDividends ? 'Consistente' : 'Inconsistente'} | DY Atual: ${formatPercent(dy)}` 
      },
      { 
        label: `ROE ≥ ${(minROE * 100).toFixed(0)}%`, 
        value: hasGoodProfitability, 
        description: `ROE: ${formatPercent(roe) || 'N/A'}` 
      },
      { 
        label: `Dívida/PL ≤ ${(maxDebtToEquity * 100).toFixed(0)}%`, 
        value: hasLowDebt, 
        description: `Dív/PL: ${dividaLiquidaPl?.toFixed(1) || 'N/A'}` 
      },
      { 
        label: 'Margem Líquida Positiva', 
        value: hasPositiveMargin, 
        description: `Margem: ${formatPercent(margemLiquida) || 'N/A'}` 
      },
      { 
        label: 'Payout Sustentável (20-95%)', 
        value: hasReasonablePayout, 
        description: `Payout: ${payout ? formatPercent(payout) : 'N/A'}` 
      },
      { 
        label: 'Market Cap ≥ R$ 1B', 
        value: hasMinimumSize, 
        description: `Market Cap: ${marketCap ? formatCurrency(marketCap) : 'N/A'}` 
      }
    ];

    const passedCriteria = criteria.filter(c => c.value).length;
    const totalCriteria = criteria.length;
    
    // Para ser elegível no método Barsi, precisa passar em critérios essenciais
    const essentialCriteria = [
      isUnderCeiling, // Preço abaixo do teto é fundamental
      hasConsistentDividends, // Histórico de dividendos é essencial
      hasGoodProfitability, // Empresa precisa ser lucrativa
      hasLowDebt // Baixo endividamento é crucial
    ];
    
    const passedEssentialCriteria = essentialCriteria.filter(Boolean).length;
    const isEligible = passedEssentialCriteria >= 4 && passedCriteria >= 6;
    
    const score = (passedCriteria / totalCriteria) * 100;

    // Calcular Barsi Quality Score
    let barsiScore = 0;
    
    // 1. Desconto do Preço Teto (40% do score) - Conceito central do Barsi
    if (discountFromCeiling && discountFromCeiling > 0) {
      const discountScore = Math.min(discountFromCeiling / 30 * 40, 40); // Até 30% desconto = 40 pontos
      barsiScore += discountScore;
    }
    
    // 2. Qualidade dos Dividendos (35% do score)
    const dividendQuality = (
      (dy || 0) * 200 + // DY atual (até 20 pontos)
      (hasConsistentDividends ? 15 : 0) // Consistência histórica
    );
    barsiScore += Math.min(dividendQuality, 35);
    
    // 3. Saúde Financeira (25% do score)
    const financialHealth = (
      Math.min(roe || 0, 0.25) * 40 + // ROE (até 10 pontos)
      Math.min(liquidezCorrente || 0, 2.5) * 4 + // Liquidez (até 10 pontos)
      Math.min(margemLiquida || 0, 0.15) * 33 // Margem (até 5 pontos)
    );
    barsiScore += Math.min(financialHealth, 25);

    if (barsiScore > 100) barsiScore = 100;

    let reasoning: string;
    if (isEligible) {
      reasoning = `✅ Aprovada no Método Barsi! Preço ${formatCurrency(currentPrice)} está ${discountFromCeiling?.toFixed(1)}% abaixo do teto ${formatCurrency(ceilingPrice)} para DY ${(targetDividendYield * 100).toFixed(1)}%. Score Barsi: ${barsiScore.toFixed(1)}/100.`;
    } else {
      const failedEssential = [];
      if (!isUnderCeiling) failedEssential.push('preço acima do teto');
      if (!hasConsistentDividends) failedEssential.push('dividendos inconsistentes');
      if (!hasGoodProfitability) failedEssential.push('ROE insuficiente');
      if (!hasLowDebt) failedEssential.push('alto endividamento');
      
      reasoning = `❌ Não atende ao Método Barsi: ${failedEssential.join(', ')}. Critérios: ${passedCriteria}/${totalCriteria}.`;
    }

    return {
      isEligible,
      score,
      fairValue: ceilingPrice,
      upside: discountFromCeiling,
      reasoning,
      criteria,
      key_metrics: {
        ceilingPrice: ceilingPrice,
        discountFromCeiling: discountFromCeiling,
        barsiScore: Number(barsiScore.toFixed(1)),
        dividendYield: dy,
        averageDividend: averageDividend,
        roe: roe,
        payout: payout
      }
    };
  }

  async runRanking(companies: CompanyData[], params: BarsiParams): Promise<RankBuilderResult[]> {
    const {
      targetDividendYield,
      maxPriceToPayMultiplier = 1.0,
      minConsecutiveDividends = 3,
      maxDebtToEquity = 1.0,
      minROE = 0.10,
      focusOnBEST = true
    } = params;

    const results: RankBuilderResult[] = [];

    // Filtrar empresas por overall_score > 50 (remover empresas ruins)
    let filteredCompanies = this.filterCompaniesByOverallScore(companies, 50);
    
    // Filtrar empresas por tamanho se especificado
    filteredCompanies = this.filterCompaniesBySize(filteredCompanies, params.companySize || 'all');

    for (const company of filteredCompanies) {
      if (!this.validateCompanyData(company)) continue;
      
      // EXCLUSÃO AUTOMÁTICA: Verificar critérios de exclusão
      if (this.shouldExcludeCompany(company)) continue;

      const { financials, currentPrice, sector, historicalFinancials, ticker } = company;
      const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
      
      // Verificar se está em setor perene (se obrigatório)
      if (focusOnBEST && !this.isPerennialSector(sector)) continue;

      // Métricas essenciais
      const dy = this.getDividendYield(financials, use7YearAverages, historicalFinancials);
      
      // Calcular média de dividendos dos últimos 5-6 anos
      let averageDividend = await this.calculateAverageDividend(ticker);
      
      // Se não conseguir calcular pela média histórica, usar ultimoDividendo como fallback
      if (!averageDividend) {
        averageDividend = toNumber(company.ultimoDividendo || financials.ultimoDividendo) || null;
      }
      
      const roe = this.getROE(financials, use7YearAverages, historicalFinancials);
      const dividaLiquidaPl = this.getDividaLiquidaPl(financials, use7YearAverages, historicalFinancials);
      const liquidezCorrente = this.getLiquidezCorrente(financials, use7YearAverages, historicalFinancials);
      const margemLiquida = this.getMargemLiquida(financials, use7YearAverages, historicalFinancials);
      const marketCap = toNumber(financials.marketCap);

      // Filtros obrigatórios para o ranking
      if (!averageDividend || averageDividend <= 0) continue;
      if (!roe || roe < minROE) continue;
      if (dividaLiquidaPl && dividaLiquidaPl > maxDebtToEquity) continue;
      if (!this.hasConsistentDividendHistory(company, minConsecutiveDividends)) continue;
      if (marketCap && marketCap < 1000000000) continue; // Mínimo R$ 1B

      // Calcular preço teto usando a média de dividendos
      const ceilingPrice = this.calculateCeilingPrice(averageDividend, targetDividendYield, maxPriceToPayMultiplier);
      
      // Só incluir se preço atual estiver abaixo do teto
      if (currentPrice > ceilingPrice) continue;

      const discountFromCeiling = ((ceilingPrice - currentPrice) / ceilingPrice) * 100;

      // Calcular Barsi Quality Score
      let barsiScore = 0;
      
      // 1. Desconto do Preço Teto (40% do score)
      const discountScore = Math.min(discountFromCeiling / 30 * 40, 40);
      barsiScore += discountScore;
      
      // 2. Qualidade dos Dividendos (35% do score)
      const dividendQuality = (dy || 0) * 200 + 15; // DY + bônus por consistência
      barsiScore += Math.min(dividendQuality, 35);
      
      // 3. Saúde Financeira (25% do score)
      const financialHealth = (
        Math.min(roe, 0.25) * 40 +
        Math.min(liquidezCorrente || 0, 2.5) * 4 +
        Math.min(margemLiquida || 0, 0.15) * 33
      );
      barsiScore += Math.min(financialHealth, 25);

      if (barsiScore > 100) barsiScore = 100;

      results.push({
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice,
        logoUrl: company.logoUrl,
        fairValue: Number(ceilingPrice.toFixed(2)),
        upside: Number(discountFromCeiling.toFixed(2)),
        marginOfSafety: Number(discountFromCeiling.toFixed(2)),
        rational: `Aprovada no Método Barsi! Setor perene ${sector}. Preço ${formatCurrency(currentPrice)} está ${discountFromCeiling.toFixed(1)}% abaixo do teto ${formatCurrency(ceilingPrice)} (DY meta ${(targetDividendYield * 100).toFixed(1)}%). Média de dividendos 5-6 anos: ${formatCurrency(averageDividend)}. Dividendos consistentes, ROE ${(roe * 100).toFixed(1)}%, baixo endividamento. Score Barsi: ${barsiScore.toFixed(1)}/100. Ideal para buy-and-hold com reinvestimento.`,
        key_metrics: {
          ceilingPrice: Number(ceilingPrice.toFixed(2)),
          discountFromCeiling: Number(discountFromCeiling.toFixed(2)),
          barsiScore: Number(barsiScore.toFixed(1)),
          dividendYield: dy,
          averageDividend: averageDividend,
          roe: roe,
          dividaLiquidaPl: dividaLiquidaPl,
          liquidezCorrente: liquidezCorrente,
          margemLiquida: margemLiquida
        }
      });
    }

    // Ordenar por Score Barsi (maior desconto do teto + melhor qualidade)
    const sortedResults = results
      .sort((a, b) => (b.key_metrics?.barsiScore || 0) - (a.key_metrics?.barsiScore || 0));

    // Remover empresas duplicadas
    const uniqueResults = this.removeDuplicateCompanies(sortedResults);
    
    // Aplicar limite
    const limitedResults = uniqueResults.slice(0, 50);

    // Aplicar priorização técnica se habilitada
    return this.applyTechnicalPrioritization(limitedResults, companies, params.useTechnicalAnalysis);
  }

  generateRational(params: BarsiParams): string {
    const {
      targetDividendYield,
      maxPriceToPayMultiplier = 1.0,
      minConsecutiveDividends = 5,
      maxDebtToEquity = 1.0,
      minROE = 0.10,
      focusOnBEST = true
    } = params;

    return `# MÉTODO BARSI - BUY AND HOLD DE DIVIDENDOS

**Filosofia**: Baseado na estratégia de Luiz Barsi para construção de patrimônio através de dividendos em setores "perenes".

**Estratégia**: Comprar empresas de setores essenciais quando o preço estiver abaixo do "preço teto" calculado pela meta de Dividend Yield.

## Os 5 Passos do Método Barsi

### 1. Setores Perenes (B.E.S.T.)
${focusOnBEST ? '✅ ATIVO' : '⚠️ OPCIONAL'} - Foco em setores essenciais:
- **B**ancos
- **E**nergia Elétrica  
- **S**aneamento e **S**eguros
- **T**elecomunicações
- **Gás** (adicional)

### 2. Qualidade da Empresa
- ROE ≥ ${(minROE * 100).toFixed(0)}% (lucro consistente)
- Dívida/PL ≤ ${(maxDebtToEquity * 100).toFixed(0)}% (baixo endividamento)
- Margem Líquida positiva (empresa lucrativa)
- Histórico de ${minConsecutiveDividends} anos pagando dividendos

### 3. Preço Teto (Conceito Central)
**Fórmula**: Preço Teto = Dividendo por Ação ÷ DY Meta (${(targetDividendYield * 100).toFixed(1)}%)
- Multiplicador: ${maxPriceToPayMultiplier}x
- **Só compra se Preço Atual ≤ Preço Teto**

### 4. Disciplina de Aporte
- Aporte mensal constante
- Aproveitar crises para comprar mais barato
- Foco em empresas abaixo do preço teto

### 5. Reinvestimento 100%
- Todos os dividendos reinvestidos em mais ações
- Efeito "bola de neve" dos juros compostos
- **Nunca vender** (exceto se perder fundamentos)

**Score Barsi**:
- 40% Desconto do Preço Teto (oportunidade de compra)
- 35% Qualidade dos Dividendos (DY + consistência histórica)  
- 25% Saúde Financeira (ROE, liquidez, margem)

**Ordenação**: Por Score Barsi (melhor oportunidade de compra + qualidade)${params.useTechnicalAnalysis ? ' + Priorização por Análise Técnica (timing de entrada)' : ''}.

**Objetivo**: Independência financeira através de renda passiva crescente e sustentável${params.useTechnicalAnalysis ? '. Com análise técnica ativa, otimizamos o timing de entrada nos ativos selecionados' : ''}.`;
  }
}