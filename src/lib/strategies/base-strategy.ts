import { 
  BaseStrategy, 
  StrategyParams, 
  CompanyData, 
  StrategyAnalysis, 
  RankBuilderResult,
  TechnicalAnalysisData
} from './types';

// Funções utilitárias
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return parseFloat(String(value));
}

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function formatPercent(value: unknown): string {
  const numValue = toNumber(value);
  if (numValue === null || numValue === undefined) return 'N/A';
  return `${(numValue * 100).toFixed(2)}%`;
}

/**
 * Valida e normaliza o CAGR de lucros de 5 anos para evitar distorções
 * CAGR deve ser mais conservador que crescimento anual por ser uma média de longo prazo
 */
export function validateCAGR5Years(cagrLucros5a: number | null): number | null {
  if (cagrLucros5a === null || cagrLucros5a === undefined) {
    return null;
  }

  // Converter para número se necessário
  const cagr = typeof cagrLucros5a === 'number' ? cagrLucros5a : parseFloat(String(cagrLucros5a));
  
  if (isNaN(cagr)) {
    return null;
  }

  // CAGR extremos são ainda mais suspeitos que crescimento anual
  // Pois representam média de 5 anos, não deveria ter valores tão extremos
  if (Math.abs(cagr) > 1.0) { // CAGR > 100% ou < -100% é muito suspeito
    console.warn(`⚠️ CAGR 5 anos extremo detectado: ${(cagr * 100).toFixed(1)}%. Considerando como não confiável.`);
    return null; // Tratar como dado não disponível
  }

  // Limitar CAGR a faixas ainda mais conservadoras
  // CAGR sustentável raramente excede 50% por 5 anos consecutivos
  if (cagr > 0.5) { // Limitar CAGR máximo a 50%
    return 0.5;
  }
  
  if (cagr < -0.5) { // Limitar declínio máximo a -50%
    return -0.5;
  }

  return cagr;
}

// Classe base abstrata para todas as estratégias
export abstract class AbstractStrategy<T extends StrategyParams> implements BaseStrategy<T> {
  abstract readonly name: string;
  
  abstract runAnalysis(companyData: CompanyData, params: T): StrategyAnalysis;
  abstract runRanking(companies: CompanyData[], params: T): RankBuilderResult[] | Promise<RankBuilderResult[]>;
  abstract generateRational(params: T): string;
  abstract validateCompanyData(companyData: CompanyData, params: T): boolean;
  
  // Métodos utilitários comuns
  protected calculateGrahamFairValue(lpa: number | null, vpa: number | null): number | null {
    if (!lpa || !vpa || lpa <= 0 || vpa <= 0) return null;
    return Math.sqrt(22.5 * lpa * vpa);
  }
  
  protected calculateFCDFairValue(
    ebitda: number | null, 
    fluxoCaixaLivre: number | null, 
    sharesOutstanding: number | null,
    growthRate: number = 0.025,      // 2.5% padrão
    discountRate: number = 0.10,     // 10% padrão  
    yearsProjection: number = 5      // 5 anos padrão
  ): number | null {
    if (!ebitda || !sharesOutstanding || ebitda <= 0 || sharesOutstanding <= 0) return null;
    
    // 1. Fluxo de Caixa Base
    let fcffBase: number;
    if (fluxoCaixaLivre && fluxoCaixaLivre > 0) {
      fcffBase = fluxoCaixaLivre;
    } else {
      // Estimativa conservadora: EBITDA * 0.6
      fcffBase = ebitda * 0.6;
    }
    
    if (fcffBase <= 0) return null;
    
    // 2. Projetar Fluxos de Caixa Futuros
    const projectedCashflows: number[] = [];
    let currentCashflow = fcffBase;
    
    for (let year = 1; year <= yearsProjection; year++) {
      // Taxa de crescimento decrescente
      const yearlyGrowth = growthRate + (0.05 * Math.exp(-year * 0.5));
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
    return enterpriseValue / sharesOutstanding;
  }
  
  // Filtrar empresas por tamanho (Market Cap)
  protected filterCompaniesBySize(companies: CompanyData[], sizeFilter: string): CompanyData[] {
    if (sizeFilter === 'all') return companies;
    
    return companies.filter(company => {
      const marketCap = toNumber(company.financials.marketCap);
      if (!marketCap) return false;
      
      // Valores em bilhões de reais
      const marketCapBillions = marketCap / 1_000_000_000;
      
      switch (sizeFilter) {
        case 'small_caps':
          return marketCapBillions < 2; // Menos de R$ 2 bilhões
        case 'mid_caps':
          return marketCapBillions >= 2 && marketCapBillions < 10; // R$ 2-10 bilhões
        case 'blue_chips':
          return marketCapBillions >= 10; // Mais de R$ 10 bilhões
        default:
          return true;
      }
    });
  }

  // Converter StrategyAnalysis para RankBuilderResult
  protected convertToRankingResult(
    companyData: CompanyData, 
    analysis: StrategyAnalysis
  ): RankBuilderResult {
    return {
      ticker: companyData.ticker,
      name: companyData.name,
      sector: companyData.sector,
      currentPrice: companyData.currentPrice,
      logoUrl: companyData.logoUrl, // Incluir logo por padrão
      fairValue: analysis.fairValue,
      upside: analysis.upside,
      marginOfSafety: analysis.fairValue && companyData.currentPrice > 0 
        ? ((analysis.fairValue - companyData.currentPrice) / companyData.currentPrice) * 100 
        : null,
      rational: analysis.reasoning,
      key_metrics: analysis.key_metrics
    };
  }

  // Calcular score de análise técnica para priorização (sobrevenda = oportunidade)
  protected calculateTechnicalScore(technicalData?: TechnicalAnalysisData): number {
    if (!technicalData) return 0;

    let score = 0;

    // RSI: Priorizar sobrevenda como oportunidade de entrada
    if (technicalData.rsi !== undefined) {
      if (technicalData.rsi <= 25) {
        score += 5; // Sobrevenda extrema - excelente oportunidade
      } else if (technicalData.rsi <= 30) {
        score += 4; // Forte sobrevenda - boa oportunidade
      } else if (technicalData.rsi <= 40) {
        score += 2; // Sobrevenda moderada - oportunidade razoável
      } else if (technicalData.rsi <= 50) {
        score += 1; // Neutro baixo - leve oportunidade
      } else if (technicalData.rsi >= 75) {
        score -= 3; // Sobrecompra forte - evitar
      } else if (technicalData.rsi >= 70) {
        score -= 1; // Sobrecompra moderada - cautela
      }
    }

    // Oscilador Estocástico: Confirmar sinais de sobrevenda
    if (technicalData.stochasticK !== undefined && technicalData.stochasticD !== undefined) {
      const avgStochastic = (technicalData.stochasticK + technicalData.stochasticD) / 2;
      if (avgStochastic <= 15) {
        score += 4; // Sobrevenda extrema
      } else if (avgStochastic <= 20) {
        score += 3; // Forte sobrevenda
      } else if (avgStochastic <= 30) {
        score += 2; // Sobrevenda moderada
      } else if (avgStochastic >= 85) {
        score -= 3; // Sobrecompra forte
      } else if (avgStochastic >= 80) {
        score -= 1; // Sobrecompra moderada
      }
    }

    // Sinal geral: Peso maior para confirmação
    if (technicalData.overallSignal === 'SOBREVENDA') {
      score += 3; // Confirmação de oportunidade
    } else if (technicalData.overallSignal === 'SOBRECOMPRA') {
      score -= 2; // Confirmação de cautela
    }

    return score;
  }

  /**
   * Aplicar priorização técnica no ranking (complementar à análise fundamentalista)
   * 
   * ESTRATÉGIA:
   * 1. Preserva a ordem fundamentalista como critério principal
   * 2. Agrupa ativos em faixas de qualidade similar (~20% cada)
   * 3. Dentro de cada grupo, prioriza oportunidades técnicas (sobrevenda)
   * 4. Mantém a qualidade fundamentalista como base, usando técnica para timing
   */
  protected applyTechnicalPrioritization(
    results: RankBuilderResult[], 
    companies: CompanyData[], 
    useTechnicalAnalysis: boolean = false
  ): RankBuilderResult[] {
    if (!useTechnicalAnalysis) return results;

    // Criar mapa de dados técnicos por ticker
    const technicalMap = new Map<string, TechnicalAnalysisData>();
    companies.forEach(company => {
      if (company.technicalAnalysis) {
        technicalMap.set(company.ticker, company.technicalAnalysis);
      }
    });

    // Adicionar score técnico aos resultados (preservando ordem fundamentalista)
    const resultsWithTechnicalScore = results.map((result, originalIndex) => {
      const technicalData = technicalMap.get(result.ticker);
      const technicalScore = this.calculateTechnicalScore(technicalData);
      
      return {
        ...result,
        technicalScore,
        originalIndex, // Preservar posição original baseada na análise fundamentalista
        // Adicionar informação técnica ao rational se disponível
        rational: technicalData ? 
          `${result.rational}\n\n📊 **Análise Técnica**: ${this.getTechnicalSummary(technicalData)}` : 
          result.rational
      };
    });

    // Agrupar por faixas de qualidade fundamentalista e ordenar tecnicamente dentro de cada grupo
    const groupSize = Math.max(3, Math.floor(results.length / 5)); // Grupos de ~20% ou mínimo 3
    const reorderedResults: typeof resultsWithTechnicalScore = [];

    for (let i = 0; i < resultsWithTechnicalScore.length; i += groupSize) {
      const group = resultsWithTechnicalScore.slice(i, i + groupSize);
      
      // Dentro de cada grupo, priorizar por análise técnica (sobrevenda = melhor oportunidade)
      const sortedGroup = group.sort((a, b) => {
        // Primeiro critério: score técnico (maior = melhor oportunidade de entrada)
        if (b.technicalScore !== a.technicalScore) {
          return b.technicalScore - a.technicalScore;
        }
        // Segundo critério: manter ordem fundamentalista original
        return a.originalIndex - b.originalIndex;
      });
      
      reorderedResults.push(...sortedGroup);
    }

    return reorderedResults.map(({ ...result }) => result);
  }

  // Gerar resumo da análise técnica
  private getTechnicalSummary(technicalData: TechnicalAnalysisData): string {
    const parts: string[] = [];

    if (technicalData.rsi !== undefined) {
      let rsiStatus = '';
      if (technicalData.rsi <= 30) rsiStatus = 'forte sobrevenda';
      else if (technicalData.rsi <= 40) rsiStatus = 'sobrevenda';
      else if (technicalData.rsi >= 70) rsiStatus = 'sobrecompra';
      else rsiStatus = 'neutro';
      
      parts.push(`RSI ${technicalData.rsi.toFixed(1)} (${rsiStatus})`);
    }

    if (technicalData.stochasticK !== undefined && technicalData.stochasticD !== undefined) {
      const avgStochastic = (technicalData.stochasticK + technicalData.stochasticD) / 2;
      let stochStatus = '';
      if (avgStochastic <= 20) stochStatus = 'forte sobrevenda';
      else if (avgStochastic <= 30) stochStatus = 'sobrevenda';
      else if (avgStochastic >= 80) stochStatus = 'sobrecompra';
      else stochStatus = 'neutro';
      
      parts.push(`Estocástico ${avgStochastic.toFixed(1)} (${stochStatus})`);
    }

    if (technicalData.overallSignal) {
      const signalText = technicalData.overallSignal === 'SOBREVENDA' ? 'Oportunidade de entrada' :
                        technicalData.overallSignal === 'SOBRECOMPRA' ? 'Possível saída' : 'Neutro';
      parts.push(`Sinal: ${signalText}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'Dados técnicos não disponíveis';
  }
}
