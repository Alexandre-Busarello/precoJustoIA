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

// Classe base abstrata para todas as estratégias
export abstract class AbstractStrategy<T extends StrategyParams> implements BaseStrategy<T> {
  abstract readonly name: string;
  
  abstract runAnalysis(companyData: CompanyData, params: T): StrategyAnalysis;
  abstract runRanking(companies: CompanyData[], params: T): RankBuilderResult[];
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

    console.log('FCFF Base:', fcffBase);
    
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
