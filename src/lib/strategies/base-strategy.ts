import { 
  BaseStrategy, 
  StrategyParams, 
  CompanyData, 
  StrategyAnalysis, 
  RankBuilderResult 
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
 * Valida e normaliza o crescimento de lucros para evitar distorções
 * Trata casos especiais como recuperação de prejuízo e valores extremos
 */
export function validateEarningsGrowth(crescimentoLucros: number | null): number | null {
  if (crescimentoLucros === null || crescimentoLucros === undefined) {
    return null;
  }

  // Converter para número se necessário
  const growth = typeof crescimentoLucros === 'number' ? crescimentoLucros : parseFloat(String(crescimentoLucros));
  
  if (isNaN(growth)) {
    return null;
  }

  // Casos especiais que devem ser tratados como "dados não confiáveis"
  if (Math.abs(growth) > 2.0) { // Crescimento > 200% ou < -200%
    console.warn(`⚠️ Crescimento de lucros extremo detectado: ${(growth * 100).toFixed(1)}%. Considerando como não confiável.`);
    return null; // Tratar como dado não disponível
  }

  // Limitar crescimento a faixas razoáveis para análise fundamentalista
  // Focamos em empresas estáveis, não em crescimentos explosivos
  if (growth > 1.0) { // Limitar crescimento máximo a 100%
    return 1.0;
  }
  
  if (growth < -0.8) { // Limitar declínio máximo a -80%
    return -0.8;
  }

  return growth;
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
}
