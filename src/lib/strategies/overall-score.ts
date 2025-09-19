import { StrategyAnalysis } from './types';
import { toNumber } from './base-strategy';

// Interface para score geral
export interface OverallScore {
  score: number; // Score de 0-100
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  classification: 'Excelente' | 'Muito Bom' | 'Bom' | 'Regular' | 'Fraco' | 'Muito Fraco';
  strengths: string[];
  weaknesses: string[];
  recommendation: 'Compra Forte' | 'Compra' | 'Neutro' | 'Venda' | 'Venda Forte';
  statementsAnalysis?: StatementsAnalysis; // Análise das demonstrações financeiras
}

// Interface para dados financeiros
export interface FinancialData {
  roe?: number | null;
  liquidezCorrente?: number | null;
  dividaLiquidaPl?: number | null;
  margemLiquida?: number | null;
  [key: string]: number | string | boolean | null | undefined; // Para outros campos que possam existir
}

// Interface para dados das demonstrações financeiras
export interface FinancialStatementsData {
  incomeStatements: Record<string, unknown>[];
  balanceSheets: Record<string, unknown>[];
  cashflowStatements: Record<string, unknown>[];
  company?: {
    sector?: string | null;
    industry?: string | null;
    marketCap?: number | null;
  };
}

// Interface para análise das demonstrações
export interface StatementsAnalysis {
  score: number; // 0-100
  redFlags: string[];
  positiveSignals: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  companyStrength: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';
  contextualFactors: string[];
}

// === ANÁLISE INTELIGENTE E CONTEXTUAL DAS DEMONSTRAÇÕES FINANCEIRAS ===
export function analyzeFinancialStatements(data: FinancialStatementsData): StatementsAnalysis {
  const { incomeStatements, balanceSheets, cashflowStatements, company } = data;
  
  let score = 100;
  const redFlags: string[] = [];
  const positiveSignals: string[] = [];
  const contextualFactors: string[] = [];
  
  // === ANÁLISE DE ROBUSTEZ FINANCEIRA ===
  const companyStrength = assessCompanyStrength(data);
  
  // === CONTEXTO SETORIAL E TAMANHO ===
  const sectorContext = getSectorContext(company?.sector || null, company?.industry || null);
  const sizeContext = getSizeContext(company?.marketCap || null);
  
  // Verificar se temos dados suficientes - dar benefício da dúvida
  const minYears = 3;
  const hasInsufficientData = incomeStatements.length < 2 || balanceSheets.length < 2 || cashflowStatements.length < 2;
  const hasLimitedHistory = incomeStatements.length < minYears;
  
  // Não penalizar por dados insuficientes - dar benefício da dúvida
  if (hasInsufficientData) {
    contextualFactors.push('Dados históricos limitados - análise baseada em informações disponíveis');
  } else if (hasLimitedHistory) {
    contextualFactors.push('Histórico parcial - análise baseada em dados disponíveis');
  }

  // === ANÁLISE HISTÓRICA EXPANDIDA (3-5 ANOS) ===
  const maxPeriods = Math.min(5, incomeStatements.length);
  const historicalAnalysis = analyzeHistoricalTrends(incomeStatements, balanceSheets, cashflowStatements, maxPeriods);
  
  // Aplicar resultados da análise histórica
  score += historicalAnalysis.scoreAdjustment;
  redFlags.push(...historicalAnalysis.redFlags);
  positiveSignals.push(...historicalAnalysis.positiveSignals);

  // === ANÁLISE CONTEXTUAL DE LIQUIDEZ E CAIXA ===
  const cashAnalysis = analyzeCashPosition(balanceSheets, cashflowStatements, companyStrength, sectorContext);
  score += cashAnalysis.scoreAdjustment;
  redFlags.push(...cashAnalysis.redFlags);
  positiveSignals.push(...cashAnalysis.positiveSignals);
  contextualFactors.push(...(cashAnalysis.contextualFactors || []));

  // === ANÁLISE CONTEXTUAL DE RECEITAS ===
  const revenueAnalysis = analyzeRevenueQuality(incomeStatements, companyStrength, sectorContext, sizeContext);
  score += revenueAnalysis.scoreAdjustment;
  redFlags.push(...revenueAnalysis.redFlags);
  positiveSignals.push(...revenueAnalysis.positiveSignals);
  contextualFactors.push(...(revenueAnalysis.contextualFactors || []));

  // === ANÁLISE CONTEXTUAL DE MARGENS ===
  const marginAnalysis = analyzeMarginQuality(incomeStatements, companyStrength, sectorContext);
  score += marginAnalysis.scoreAdjustment;
  redFlags.push(...marginAnalysis.redFlags);
  positiveSignals.push(...marginAnalysis.positiveSignals);

  // === ANÁLISE CONTEXTUAL DE ENDIVIDAMENTO ===
  const debtAnalysis = analyzeDebtContext(balanceSheets, companyStrength, sectorContext);
  score += debtAnalysis.scoreAdjustment;
  redFlags.push(...debtAnalysis.redFlags);
  positiveSignals.push(...debtAnalysis.positiveSignals);

  // === ANÁLISE DE RESILIÊNCIA OPERACIONAL ===
  const resilienceAnalysis = analyzeOperationalResilience(incomeStatements, balanceSheets, cashflowStatements, companyStrength);
  score += resilienceAnalysis.scoreAdjustment;
  redFlags.push(...resilienceAnalysis.redFlags);
  positiveSignals.push(...resilienceAnalysis.positiveSignals);
  contextualFactors.push(...(resilienceAnalysis.contextualFactors || []));

  // Determinar nível de risco considerando força da empresa
  let riskLevel: StatementsAnalysis['riskLevel'] = 'LOW';
  if (score < 20 || (score < 40 && companyStrength === 'WEAK')) {
    riskLevel = 'CRITICAL';
  } else if (score < 40 || (score < 60 && companyStrength === 'WEAK')) {
    riskLevel = 'HIGH';
  } else if (score < 60 || (score < 75 && companyStrength === 'MODERATE')) {
    riskLevel = 'MEDIUM';
  }

  // Ajustar score final baseado na força da empresa
  const strengthMultiplier = getStrengthMultiplier(companyStrength);
  const finalScore = Math.max(0, Math.min(100, Math.round(score * strengthMultiplier)));

  return {
    score: finalScore,
    redFlags: redFlags.filter(Boolean).slice(0, 10), // Máximo 10 red flags
    positiveSignals: positiveSignals.filter(Boolean).slice(0, 8), // Máximo 8 sinais positivos
    riskLevel,
    companyStrength,
    contextualFactors: contextualFactors.filter(Boolean).slice(0, 5)
  };
}

// === FUNÇÕES AUXILIARES PARA ANÁLISE CONTEXTUAL ===

// Tipos para análises contextuais
interface AnalysisResult {
  scoreAdjustment: number;
  redFlags: string[];
  positiveSignals: string[];
  contextualFactors?: string[];
}

interface SectorContext {
  type: 'FINANCIAL' | 'CYCLICAL' | 'DEFENSIVE' | 'GROWTH' | 'COMMODITY' | 'TECH' | 'UTILITY' | 'OTHER';
  volatilityTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
  marginExpectation: 'LOW' | 'MEDIUM' | 'HIGH';
  cashIntensive: boolean;
}

interface SizeContext {
  category: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'MEGA';
  volatilityTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
  growthExpectation: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Avaliar força geral da empresa
function assessCompanyStrength(data: FinancialStatementsData): StatementsAnalysis['companyStrength'] {
  const { incomeStatements, balanceSheets, cashflowStatements } = data;
  
  if (!incomeStatements.length || !balanceSheets.length || !cashflowStatements.length) {
    return 'WEAK';
  }

  let strengthScore = 0;
  const latest = {
    income: incomeStatements[0],
    balance: balanceSheets[0],
    cashflow: cashflowStatements[0]
  };

  // 1. Posição de caixa (25 pontos) - só avaliar se temos dados
  const cash = toNumber(latest.balance.cash);
  const totalAssets = toNumber(latest.balance.totalAssets);
  
  if (cash !== null && totalAssets !== null && totalAssets > 0) {
    const cashRatio = cash / totalAssets;
    if (cashRatio > 0.15) strengthScore += 25;
    else if (cashRatio > 0.08) strengthScore += 15;
    else if (cashRatio > 0.03) strengthScore += 8;
  } else {
    // Dar benefício da dúvida - assumir posição média
    strengthScore += 12; // Valor intermediário
  }

  // 2. Liquidez corrente (20 pontos) - só avaliar se temos dados
  const currentAssets = toNumber(latest.balance.totalCurrentAssets);
  const currentLiabilities = toNumber(latest.balance.totalCurrentLiabilities);
  
  if (currentAssets !== null && currentLiabilities !== null && currentLiabilities > 0) {
    const currentRatio = currentAssets / currentLiabilities;
    if (currentRatio > 2.0) strengthScore += 20;
    else if (currentRatio > 1.5) strengthScore += 15;
    else if (currentRatio > 1.2) strengthScore += 10;
    else if (currentRatio > 1.0) strengthScore += 5;
  } else {
    // Dar benefício da dúvida - assumir liquidez adequada
    strengthScore += 10; // Valor intermediário
  }

  // 3. Rentabilidade (25 pontos) - só avaliar se temos dados
  const netIncome = toNumber(latest.income.netIncome);
  const revenue = toNumber(latest.income.totalRevenue) || toNumber(latest.income.operatingIncome);
  
  if (netIncome !== null && revenue !== null && revenue > 0) {
    const netMargin = netIncome / revenue;
    if (netMargin > 0.15) strengthScore += 25;
    else if (netMargin > 0.08) strengthScore += 18;
    else if (netMargin > 0.03) strengthScore += 10;
    else if (netMargin > 0) strengthScore += 5;
  } else {
    // Dar benefício da dúvida - assumir rentabilidade média
    strengthScore += 12; // Valor intermediário
  }

  // 4. Endividamento (15 pontos) - só avaliar se temos dados
  const totalLiab = toNumber(latest.balance.totalLiab);
  const equity = toNumber(latest.balance.totalStockholderEquity);
  
  if (totalLiab !== null && equity !== null && (totalLiab + equity) > 0) {
    const debtRatio = totalLiab / (totalLiab + equity);
    if (debtRatio < 0.3) strengthScore += 15;
    else if (debtRatio < 0.5) strengthScore += 10;
    else if (debtRatio < 0.7) strengthScore += 5;
  } else {
    // Dar benefício da dúvida - assumir endividamento controlado
    strengthScore += 10; // Valor intermediário
  }

  // 5. Fluxo de caixa operacional (15 pontos) - só avaliar se temos dados
  const opCashFlow = toNumber(latest.cashflow.operatingCashFlow);
  if (opCashFlow !== null && revenue !== null && revenue > 0) {
    if (opCashFlow > 0) {   
      const cashFlowMargin = opCashFlow / revenue;
      if (cashFlowMargin > 0.12) strengthScore += 15;
      else if (cashFlowMargin > 0.06) strengthScore += 10;
      else if (cashFlowMargin > 0.02) strengthScore += 5;
    }
  } else {
    // Dar benefício da dúvida - assumir fluxo de caixa adequado
    strengthScore += 7; // Valor intermediário
  }

  // Classificar força da empresa
  if (strengthScore >= 80) return 'VERY_STRONG';
  if (strengthScore >= 60) return 'STRONG';
  if (strengthScore >= 40) return 'MODERATE';
  return 'WEAK';
}

// Obter contexto setorial
function getSectorContext(sector: string | null, industry: string | null): SectorContext {
  const sectorLower = sector?.toLowerCase() || '';
  const industryLower = industry?.toLowerCase() || '';
  
  // Setor financeiro
  if (sectorLower.includes('financial') || sectorLower.includes('bank') || 
      industryLower.includes('insurance') || industryLower.includes('seguros')) {
    return {
      type: 'FINANCIAL',
      volatilityTolerance: 'MEDIUM',
      marginExpectation: 'MEDIUM',
      cashIntensive: true
    };
  }
  
  // Setor de tecnologia
  if (sectorLower.includes('technology') || sectorLower.includes('software') ||
      industryLower.includes('tech') || industryLower.includes('internet')) {
    return {
      type: 'TECH',
      volatilityTolerance: 'HIGH',
      marginExpectation: 'HIGH',
      cashIntensive: false
    };
  }
  
  // Setor cíclico (varejo, automotivo, construção)
  if (sectorLower.includes('consumer') || sectorLower.includes('retail') ||
      sectorLower.includes('automotive') || sectorLower.includes('construction')) {
    return {
      type: 'CYCLICAL',
      volatilityTolerance: 'HIGH',
      marginExpectation: 'MEDIUM',
      cashIntensive: false
    };
  }
  
  // Setor defensivo (utilities, saúde, alimentos)
  if (sectorLower.includes('utilities') || sectorLower.includes('healthcare') ||
      sectorLower.includes('food') || sectorLower.includes('pharmaceutical')) {
    return {
      type: 'DEFENSIVE',
      volatilityTolerance: 'LOW',
      marginExpectation: 'MEDIUM',
      cashIntensive: false
    };
  }
  
  // Commodities
  if (sectorLower.includes('materials') || sectorLower.includes('mining') ||
      sectorLower.includes('oil') || sectorLower.includes('steel')) {
    return {
      type: 'COMMODITY',
      volatilityTolerance: 'HIGH',
      marginExpectation: 'LOW',
      cashIntensive: false
    };
  }
  
  return {
    type: 'OTHER',
    volatilityTolerance: 'MEDIUM',
    marginExpectation: 'MEDIUM',
    cashIntensive: false
  };
}

// Obter contexto de tamanho
function getSizeContext(marketCap: number | null): SizeContext {
  if (!marketCap || marketCap <= 0) {
    return {
      category: 'SMALL',
      volatilityTolerance: 'HIGH',
      growthExpectation: 'MEDIUM'
    };
  }
  
  // Valores em bilhões de reais (aproximado)
  if (marketCap > 100_000_000_000) { // > 100B
    return {
      category: 'MEGA',
      volatilityTolerance: 'LOW',
      growthExpectation: 'LOW'
    };
  } else if (marketCap > 20_000_000_000) { // > 20B
    return {
      category: 'LARGE',
      volatilityTolerance: 'LOW',
      growthExpectation: 'MEDIUM'
    };
  } else if (marketCap > 5_000_000_000) { // > 5B
    return {
      category: 'MEDIUM',
      volatilityTolerance: 'MEDIUM',
      growthExpectation: 'MEDIUM'
    };
  } else if (marketCap > 1_000_000_000) { // > 1B
    return {
      category: 'SMALL',
      volatilityTolerance: 'HIGH',
      growthExpectation: 'HIGH'
    };
  } else {
    return {
      category: 'MICRO',
      volatilityTolerance: 'HIGH',
      growthExpectation: 'HIGH'
    };
  }
}

// Análise histórica expandida
function analyzeHistoricalTrends(
  incomeStatements: Record<string, unknown>[],
  balanceSheets: Record<string, unknown>[],
  cashflowStatements: Record<string, unknown>[],
  periods: number
): AnalysisResult {
  const result: AnalysisResult = {
    scoreAdjustment: 0,
    redFlags: [],
    positiveSignals: []
  };

  if (periods < 2) return result;

  // Analisar tendências de receita usando comparação ano a ano
  const revenues = incomeStatements.slice(0, periods).map(stmt => 
    toNumber(stmt.totalRevenue) || toNumber(stmt.operatingIncome) || 0
  ).reverse(); // Mais antigo primeiro

  const netIncomes = incomeStatements.slice(0, periods).map(stmt => 
    toNumber(stmt.netIncome) || 0
  ).reverse(); // Mais antigo primeiro

  // Calcular tendências anuais (comparar ano com ano anterior)
  const annualAnalysis = calculateAnnualTrends(revenues, netIncomes);
  
  // Avaliar consistência histórica baseada em dados anuais
  // Só considerar se temos pelo menos 3 anos de dados
  if (annualAnalysis.validComparisons >= 2) {
    if (annualAnalysis.revenueGrowthRatio > 0.6) {
      result.scoreAdjustment += 10;
      result.positiveSignals.push('Histórico consistente de crescimento de receita anual');
    } else if (annualAnalysis.revenueDeclineRatio > 0.6) {
      result.scoreAdjustment -= 15;
      result.redFlags.push('Padrão histórico de declínio de receita anual');
    }

    if (annualAnalysis.profitGrowthRatio > 0.5) {
      result.scoreAdjustment += 8;
      result.positiveSignals.push('Histórico consistente de crescimento de lucro anual');
    } else if (annualAnalysis.profitDeclineRatio > 0.6) {
      result.scoreAdjustment -= 12;
      result.redFlags.push('Padrão histórico de declínio de lucro anual');
    }
  } else if (annualAnalysis.validComparisons >= 1) {
    // Para empresas com dados limitados, ser mais conservador
    if (annualAnalysis.revenueDeclineRatio > 0.8) {
      // Não penalizar por dados limitados - dar benefício da dúvida
      result.contextualFactors?.push('Possível tendência de declínio de receita - dados limitados');
    }
    if (annualAnalysis.profitDeclineRatio > 0.8) {
      // Não penalizar por dados limitados - dar benefício da dúvida
      result.contextualFactors?.push('Possível tendência de declínio de lucro - dados limitados');
    }
  }

  // Análise adicional de volatilidade
  if (annualAnalysis.revenueVolatility > 0.3) {
    result.scoreAdjustment -= 3;
    result.redFlags.push('Alta volatilidade nas receitas');
  } else if (annualAnalysis.revenueVolatility < 0.1) {
    result.scoreAdjustment += 3;
    result.positiveSignals.push('Receitas estáveis e previsíveis');
  }

  return result;
}

// Função auxiliar para comparação YoY de métricas individuais
function getYoYComparison(
  statements: Record<string, unknown>[],
  currentIndex: number,
  fieldName: string,
  alternativeFieldName?: string
): { current: number; previous: number; hasComparison: boolean; change: number } {
  const result = {
    current: 0,
    previous: 0,
    hasComparison: false,
    change: 0
  };

  if (statements.length <= currentIndex) return result;

  const yoyIndex = currentIndex + 4; // 4 trimestres atrás (mesmo trimestre do ano anterior)
  
  if (statements.length <= yoyIndex) return result;

  const currentValue = toNumber(statements[currentIndex][fieldName]) || 
                      (alternativeFieldName ? toNumber(statements[currentIndex][alternativeFieldName]) : 0) || 0;
  const yoyValue = toNumber(statements[yoyIndex][fieldName]) || 
                   (alternativeFieldName ? toNumber(statements[yoyIndex][alternativeFieldName]) : 0) || 0;

  if (yoyValue !== 0) {
    result.current = currentValue;
    result.previous = yoyValue;
    result.hasComparison = true;
    result.change = (currentValue - yoyValue) / Math.abs(yoyValue);
  }

  return result;
}

// Nova função para calcular tendências anuais
function calculateAnnualTrends(revenues: number[], netIncomes: number[]) {
  let revenueGrowthCount = 0;
  let revenueDeclineCount = 0;
  let profitGrowthCount = 0;
  let profitDeclineCount = 0;
  let validRevenueComparisons = 0;
  let validProfitComparisons = 0;
  
  const revenueChanges: number[] = [];
  
  // Comparar ano com ano anterior (1 ano atrás)
  for (let i = 1; i < revenues.length; i++) {
    const currentRevenue = revenues[i];
    const previousYearRevenue = revenues[i - 1];
    const currentProfit = netIncomes[i];
    const previousYearProfit = netIncomes[i - 1];
    
    // Análise de receita anual
    if (previousYearRevenue > 0 && currentRevenue > 0) {
      const revenueChange = (currentRevenue - previousYearRevenue) / previousYearRevenue;
      revenueChanges.push(Math.abs(revenueChange));
      validRevenueComparisons++;
      
      if (revenueChange > 0.05) { // Crescimento > 5%
        revenueGrowthCount++;
      } else if (revenueChange < -0.05) { // Declínio > 5%
        revenueDeclineCount++;
      }
    }
    
    // Análise de lucro anual
    if (previousYearProfit !== 0 && currentProfit !== 0) {
      const profitChange = (currentProfit - previousYearProfit) / Math.abs(previousYearProfit);
      validProfitComparisons++;
      
      if (profitChange > 0.1) { // Crescimento > 10%
        profitGrowthCount++;
      } else if (profitChange < -0.1) { // Declínio > 10%
        profitDeclineCount++;
      }
    }
  }
  
  // Calcular volatilidade da receita
  const avgRevenueChange = revenueChanges.length > 0 
    ? revenueChanges.reduce((sum, change) => sum + change, 0) / revenueChanges.length 
    : 0;
  
  return {
    revenueGrowthRatio: validRevenueComparisons > 0 ? revenueGrowthCount / validRevenueComparisons : 0,
    revenueDeclineRatio: validRevenueComparisons > 0 ? revenueDeclineCount / validRevenueComparisons : 0,
    profitGrowthRatio: validProfitComparisons > 0 ? profitGrowthCount / validProfitComparisons : 0,
    profitDeclineRatio: validProfitComparisons > 0 ? profitDeclineCount / validProfitComparisons : 0,
    revenueVolatility: avgRevenueChange,
    validComparisons: Math.min(validRevenueComparisons, validProfitComparisons)
  };
}

// Análise contextual de posição de caixa
function analyzeCashPosition(
  balanceSheets: Record<string, unknown>[],
  cashflowStatements: Record<string, unknown>[],
  companyStrength: StatementsAnalysis['companyStrength'],
  sectorContext: SectorContext
): AnalysisResult {
  const result: AnalysisResult = {
    scoreAdjustment: 0,
    redFlags: [],
    positiveSignals: [],
    contextualFactors: []
  };

  if (!balanceSheets.length || !cashflowStatements.length) return result;

    const latest = balanceSheets[0];
  const latestCashflow = cashflowStatements[0];
  
  const cash = toNumber(latest.cash);
  const totalAssets = toNumber(latest.totalAssets);
  const currentAssets = toNumber(latest.totalCurrentAssets);
  const currentLiabilities = toNumber(latest.totalCurrentLiabilities);
  const opCashFlow = toNumber(latestCashflow.operatingCashFlow);

  // Só calcular se temos dados válidos - dar benefício da dúvida se não temos
  const cashRatio = (cash !== null && totalAssets !== null && totalAssets > 0) ? cash / totalAssets : null;
  const currentRatio = (currentAssets !== null && currentLiabilities !== null && currentLiabilities > 0) ? currentAssets / currentLiabilities : null;
  // Análise contextual baseada na força da empresa
  if (companyStrength === 'VERY_STRONG' || companyStrength === 'STRONG') {
    // Empresas fortes podem suportar quedas temporárias de fluxo de caixa
    if (opCashFlow !== null && opCashFlow < 0) {
      if (cashRatio !== null && cashRatio > 0.1) {
        result.scoreAdjustment -= 5; // Penalidade menor
        result.contextualFactors?.push('Empresa robusta com reservas para superar dificuldades temporárias');
      } else if (cashRatio !== null) {
        result.scoreAdjustment -= 10;
        result.redFlags.push('Queima de caixa em empresa sólida - monitorar de perto');
      }
    }
    
    if (currentRatio !== null && currentRatio > 1.5) {
      result.scoreAdjustment += 5;
      result.positiveSignals.push('Liquidez robusta em empresa sólida');
    }
  } else {
    // Empresas fracas precisam de mais caixa - mas só penalizar se temos dados
    if (opCashFlow !== null && opCashFlow < 0) {
      result.scoreAdjustment -= 20;
      result.redFlags.push('Queima de caixa em empresa frágil - risco elevado');
    }
    
    // Só penalizar liquidez baixa se realmente temos os dados
    if (currentRatio !== null && currentRatio < 1.2) {
      result.scoreAdjustment -= 15;
      result.redFlags.push('Liquidez baixa em empresa frágil');
    } else if (currentRatio === null) {
      result.contextualFactors?.push('Dados de liquidez não disponíveis - benefício da dúvida aplicado');
    }
  }

  // Contexto setorial - só avaliar se temos dados
  if (sectorContext.cashIntensive && cashRatio !== null) {
    if (cashRatio > 0.15) {
      result.positiveSignals.push('Posição de caixa adequada para setor intensivo em capital');
    } else if (cashRatio < 0.05) {
      result.redFlags.push('Posição de caixa baixa para setor que requer reservas');
    }
  }

  return result;
}

// Análise contextual de qualidade de receita
function analyzeRevenueQuality(
  incomeStatements: Record<string, unknown>[],
  companyStrength: StatementsAnalysis['companyStrength'],
  sectorContext: SectorContext,
  sizeContext: SizeContext
): AnalysisResult {
  const result: AnalysisResult = {
    scoreAdjustment: 0,
    redFlags: [],
    positiveSignals: [],
    contextualFactors: []
  };

  if (incomeStatements.length < 2) return result;

  // Usar comparação YoY para receita
  const revenueComparison = getYoYComparison(incomeStatements, 0, 'totalRevenue', 'operatingIncome');
  let revenueChange = 0;

  if (revenueComparison.hasComparison) {
    revenueChange = revenueComparison.change;
  } else {
    // Fallback para comparação sequencial se não tiver dados YoY suficientes
    if (incomeStatements.length >= 2) {
      const latest = incomeStatements[0];
      const previous = incomeStatements[1];
      const currentRevenue = toNumber(latest.totalRevenue) || toNumber(latest.operatingIncome) || 0;
      const previousRevenue = toNumber(previous.totalRevenue) || toNumber(previous.operatingIncome) || 1;
      revenueChange = (currentRevenue - previousRevenue) / previousRevenue;
      
      result.contextualFactors?.push('Comparação sequencial - dados YoY limitados, usando informações disponíveis');
    }
  }

  // Análise contextual baseada no setor
  let volatilityThreshold = 0.3; // Padrão
  if (sectorContext.volatilityTolerance === 'HIGH') {
    volatilityThreshold = 0.5; // Setores cíclicos podem ter mais volatilidade
  } else if (sectorContext.volatilityTolerance === 'LOW') {
    volatilityThreshold = 0.15; // Setores defensivos devem ser mais estáveis
  }

  // Análise contextual baseada no tamanho
  if (sizeContext.category === 'MICRO' || sizeContext.category === 'SMALL') {
    volatilityThreshold *= 1.5; // Empresas menores podem ter mais volatilidade
  }

  // Avaliar mudanças de receita no contexto
  if (Math.abs(revenueChange) > volatilityThreshold) {
    if (revenueChange > 0) {
      if (companyStrength === 'VERY_STRONG' || companyStrength === 'STRONG') {
        result.positiveSignals.push('Crescimento acelerado em empresa sólida');
        result.scoreAdjustment += 5;
      } else {
        result.contextualFactors?.push('Crescimento acelerado - verificar sustentabilidade');
      }
    } else {
      if (companyStrength === 'VERY_STRONG' || companyStrength === 'STRONG') {
        result.scoreAdjustment -= 8; // Penalidade menor para empresas fortes
        result.contextualFactors?.push('Queda de receita em empresa robusta - possível recuperação');
      } else {
        result.scoreAdjustment -= 20;
        result.redFlags.push('Queda significativa de receita em empresa frágil');
      }
    }
  } else if (revenueChange > 0.05) {
    result.positiveSignals.push('Crescimento consistente de receita');
    result.scoreAdjustment += 3;
  }

  return result;
}

// Análise contextual de qualidade de margens
function analyzeMarginQuality(
  incomeStatements: Record<string, unknown>[],
  companyStrength: StatementsAnalysis['companyStrength'],
  sectorContext: SectorContext
): AnalysisResult {
  const result: AnalysisResult = {
    scoreAdjustment: 0,
    redFlags: [],
    positiveSignals: []
  };

  if (incomeStatements.length < 2) return result;

  // Calcular margem atual
  const latest = incomeStatements[0];
  const currentNetIncome = toNumber(latest.netIncome) || 0;
  const currentRevenue = toNumber(latest.totalRevenue) || toNumber(latest.operatingIncome) || 1;
  const currentMargin = currentNetIncome / currentRevenue;
  
  // Usar comparação YoY para margem
  const revenueComparison = getYoYComparison(incomeStatements, 0, 'totalRevenue', 'operatingIncome');
  const netIncomeComparison = getYoYComparison(incomeStatements, 0, 'netIncome');
  
  let previousMargin = 0;

  if (revenueComparison.hasComparison && netIncomeComparison.hasComparison && revenueComparison.previous > 0) {
    previousMargin = netIncomeComparison.previous / revenueComparison.previous;
  } else {
    // Fallback para comparação sequencial se não tiver dados YoY suficientes
    if (incomeStatements.length >= 2) {
      const previous = incomeStatements[1];
      const previousNetIncome = toNumber(previous.netIncome) || 0;
      const previousRevenue = toNumber(previous.totalRevenue) || toNumber(previous.operatingIncome) || 1;
      previousMargin = previousNetIncome / previousRevenue;
    }
  }

  // Benchmarks setoriais
  let goodMarginThreshold = 0.1; // Padrão 10%
  let excellentMarginThreshold = 0.15; // Padrão 15%
  
  if (sectorContext.marginExpectation === 'HIGH') {
    goodMarginThreshold = 0.15;
    excellentMarginThreshold = 0.25;
  } else if (sectorContext.marginExpectation === 'LOW') {
    goodMarginThreshold = 0.05;
    excellentMarginThreshold = 0.1;
  }

  // Avaliar margens no contexto setorial
  if (currentMargin > excellentMarginThreshold) {
    result.scoreAdjustment += 8;
    result.positiveSignals.push('Margem líquida excelente para o setor');
  } else if (currentMargin > goodMarginThreshold) {
    result.scoreAdjustment += 4;
    result.positiveSignals.push('Margem líquida saudável');
  } else if (currentMargin < 0) {
    if (companyStrength === 'VERY_STRONG' || companyStrength === 'STRONG') {
      result.scoreAdjustment -= 10; // Penalidade menor para empresas fortes
    } else {
      result.scoreAdjustment -= 20;
      result.redFlags.push('Margem líquida negativa');
    }
  }

  // Avaliar deterioração de margem
  if (previousMargin > goodMarginThreshold && currentMargin < previousMargin * 0.6) {
    if (companyStrength === 'VERY_STRONG' || companyStrength === 'STRONG') {
      result.scoreAdjustment -= 8;
    } else {
      result.scoreAdjustment -= 15;
      result.redFlags.push('Deterioração significativa da margem líquida');
    }
  }

  return result;
}

// Análise contextual de endividamento
function analyzeDebtContext(
  balanceSheets: Record<string, unknown>[],
  companyStrength: StatementsAnalysis['companyStrength'],
  sectorContext: SectorContext
): AnalysisResult {
  const result: AnalysisResult = {
    scoreAdjustment: 0,
    redFlags: [],
    positiveSignals: []
  };

  if (balanceSheets.length < 2) return result;

  // Calcular índice de endividamento atual - só se temos dados válidos
  const latest = balanceSheets[0];
  const currentTotalLiab = toNumber(latest.totalLiab);
  const currentEquity = toNumber(latest.totalStockholderEquity);
  
  // Só calcular se temos dados válidos
  const currentDebtRatio = (currentTotalLiab !== null && currentEquity !== null && (currentTotalLiab + currentEquity) > 0) 
    ? currentTotalLiab / (currentTotalLiab + currentEquity) 
    : null;
  
  // Usar comparação YoY para endividamento
  const liabComparison = getYoYComparison(balanceSheets, 0, 'totalLiab');
  const equityComparison = getYoYComparison(balanceSheets, 0, 'totalStockholderEquity');
  
  let previousDebtRatio = 0;

  if (liabComparison.hasComparison && equityComparison.hasComparison && 
      (liabComparison.previous + equityComparison.previous) > 0) {
    previousDebtRatio = liabComparison.previous / (liabComparison.previous + equityComparison.previous);
  } else {
    // Fallback para comparação sequencial se não tiver dados YoY suficientes
    if (balanceSheets.length >= 2) {
      const previous = balanceSheets[1];
      const previousTotalLiab = toNumber(previous.totalLiab) || 0;
      const previousEquity = toNumber(previous.totalStockholderEquity) || 1;
      previousDebtRatio = previousTotalLiab / (previousTotalLiab + previousEquity);
    }
  }

  // Tolerância setorial ao endividamento
  let highDebtThreshold = 0.6; // Padrão
  let criticalDebtThreshold = 0.8;
  
  if (sectorContext.type === 'FINANCIAL') {
    highDebtThreshold = 0.8; // Bancos naturalmente têm mais "dívida"
    criticalDebtThreshold = 0.9;
  } else if (sectorContext.type === 'UTILITY') {
    highDebtThreshold = 0.7; // Utilities podem ter mais dívida
    criticalDebtThreshold = 0.85;
  }

  // Avaliar endividamento no contexto - só se temos dados válidos
  if (currentDebtRatio !== null) {
    if (currentDebtRatio > criticalDebtThreshold) {
      if (companyStrength === 'VERY_STRONG') {
        result.scoreAdjustment -= 15; // Penalidade menor para empresas muito fortes
      } else {
        result.scoreAdjustment -= 25;
        result.redFlags.push('Endividamento excessivo');
      }
    } else if (currentDebtRatio > highDebtThreshold) {
      if (companyStrength === 'WEAK') {
        result.scoreAdjustment -= 15;
        result.redFlags.push('Alto endividamento em empresa frágil');
      } else {
        result.scoreAdjustment -= 8;
      }
    } else if (currentDebtRatio < 0.3) {
      result.scoreAdjustment += 5;
      result.positiveSignals.push('Endividamento controlado');
    }
  } else {
    // Se não temos dados de endividamento, dar benefício da dúvida
    result.contextualFactors?.push('Dados de endividamento não disponíveis - benefício da dúvida aplicado');
    result.positiveSignals.push('Endividamento assumido como controlado (dados não disponíveis)');
  }

  // Avaliar crescimento do endividamento - só se temos dados válidos
  if (currentDebtRatio !== null && previousDebtRatio !== null) {
    const debtGrowth = currentDebtRatio - previousDebtRatio;
    if (debtGrowth > 0.15) {
      if (companyStrength === 'VERY_STRONG' || companyStrength === 'STRONG') {
        result.scoreAdjustment -= 8;
      } else {
        result.scoreAdjustment -= 15;
        result.redFlags.push('Crescimento acelerado do endividamento');
      }
    }
  }

  return result;
}

// Análise de resiliência operacional
function analyzeOperationalResilience(
  incomeStatements: Record<string, unknown>[],
  balanceSheets: Record<string, unknown>[],
  cashflowStatements: Record<string, unknown>[],
  companyStrength: StatementsAnalysis['companyStrength']
): AnalysisResult {
  const result: AnalysisResult = {
    scoreAdjustment: 0,
    redFlags: [],
    positiveSignals: [],
    contextualFactors: []
  };

  if (!incomeStatements.length || !balanceSheets.length || !cashflowStatements.length) return result;

  const latest = {
    income: incomeStatements[0],
    balance: balanceSheets[0],
    cashflow: cashflowStatements[0]
  };

  // Avaliar capacidade de geração de caixa vs lucro
  const netIncome = toNumber(latest.income.netIncome) || 0;
  const opCashFlow = toNumber(latest.cashflow.operatingCashFlow) || 0;
  const revenue = toNumber(latest.income.totalRevenue) || toNumber(latest.income.operatingIncome) || 1;

  if (netIncome > 0 && opCashFlow > 0) {
    const cashConversionRatio = opCashFlow / netIncome;
    if (cashConversionRatio > 1.2) {
      result.scoreAdjustment += 8;
      result.positiveSignals.push('Excelente conversão de lucro em caixa');
    } else if (cashConversionRatio < 0.5) {
      result.scoreAdjustment -= 10;
      result.redFlags.push('Baixa conversão de lucro em caixa');
    }
  }

  // Avaliar diversificação de receitas (proxy: estabilidade)
  if (incomeStatements.length >= 4) {
    const revenues = incomeStatements.slice(0, 4).map(stmt => 
      toNumber(stmt.totalRevenue) || toNumber(stmt.operatingIncome) || 0
    );
    
    const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const volatility = Math.sqrt(revenues.reduce((sum, rev) => sum + Math.pow(rev - avgRevenue, 2), 0) / revenues.length) / avgRevenue;
    
    if (volatility < 0.15) {
      result.scoreAdjustment += 5;
      result.positiveSignals.push('Receitas estáveis e previsíveis');
    } else if (volatility > 0.4) {
      if (companyStrength === 'VERY_STRONG' || companyStrength === 'STRONG') {
        result.contextualFactors?.push('Alta volatilidade de receitas, mas empresa robusta');
      } else {
        result.scoreAdjustment -= 8;
        result.redFlags.push('Alta volatilidade de receitas');
      }
    }
  }

  // Avaliar eficiência operacional
  const totalAssets = toNumber(latest.balance.totalAssets) || 1;
  const assetTurnover = revenue / totalAssets;
  
  if (assetTurnover > 1.0) {
    result.scoreAdjustment += 3;
    result.positiveSignals.push('Boa eficiência no uso de ativos');
  } else if (assetTurnover < 0.3) {
    result.scoreAdjustment -= 5;
  }

  return result;
}

// Obter multiplicador baseado na força da empresa
function getStrengthMultiplier(companyStrength: StatementsAnalysis['companyStrength']): number {
  switch (companyStrength) {
    case 'VERY_STRONG': return 1.1; // Boost de 10%
    case 'STRONG': return 1.05; // Boost de 5%
    case 'MODERATE': return 1.0; // Neutro
    case 'WEAK': return 0.9; // Penalidade de 10%
    default: return 1.0;
  }
}

// === FUNÇÃO CENTRALIZADA PARA CALCULAR SCORE GERAL ===
export function calculateOverallScore(strategies: {
  graham: StrategyAnalysis | null;
  dividendYield: StrategyAnalysis | null;
  lowPE: StrategyAnalysis | null;
  magicFormula: StrategyAnalysis | null;
  fcd: StrategyAnalysis | null;
  gordon: StrategyAnalysis | null;
  fundamentalist: StrategyAnalysis | null;
}, financialData: FinancialData, currentPrice: number, statementsData?: FinancialStatementsData): OverallScore {
  const weights = {
    graham: 0.08,        // 8% - Base fundamentalista
    dividendYield: 0.08, // 8% - Sustentabilidade de dividendos
    lowPE: 0.15,         // 15% - Value investing
    magicFormula: 0.13,  // 13% - Qualidade operacional
    fcd: 0.15,           // 15% - Valor intrínseco
    gordon: 0.01,        // 1% - Método dos dividendos (menor pesos possível sempre)
    fundamentalist: 0.20, // 20% - Análise fundamentalista simplificada
    statements: 0.20     // 20% - Análise das demonstrações financeiras
  };

  let totalScore = 0;
  let totalWeight = 0;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Função auxiliar para verificar se o preço atual está compatível com o preço justo
  const isPriceCompatibleWithFairValue = (fairValue: number | null, upside: number | null): boolean => {
    if (!fairValue || !upside || currentPrice <= 0) return false;
    // Considera compatível se o upside for positivo (preço atual menor que preço justo)
    // ou se o downside for menor que 20% (preço atual até 20% acima do preço justo)
    return upside >= 10;
  };

  // Graham Analysis
  if (strategies.graham) {
    const grahamWeight = weights.graham;
    const isPriceCompatible = isPriceCompatibleWithFairValue(strategies.graham.fairValue, strategies.graham.upside);
    
    // Sempre inclui o peso, mas penaliza se incompatível
    if (isPriceCompatible) {
      const grahamContribution = strategies.graham.score * grahamWeight;
      totalScore += grahamContribution;
      
      if (strategies.graham.isEligible && strategies.graham.score >= 80) {
        strengths.push('Fundamentos sólidos (Graham)');
      } else if (strategies.graham.score < 60) {
        weaknesses.push('Fundamentos fracos');
      }
    } else {
      // Penaliza com score baixo se preço incompatível
      const penalizedScore = strategies.graham.fairValue && strategies.graham.upside && strategies.graham.upside < 10 ? 20 : strategies.graham.score;
      const grahamContribution = penalizedScore * grahamWeight;
      totalScore += grahamContribution;
      
      if (strategies.graham.fairValue && strategies.graham.upside && strategies.graham.upside < -20) {
        weaknesses.push('Preço muito acima do valor justo (Graham)');
      }
    }
    totalWeight += grahamWeight;
  }

  // Dividend Yield Analysis (não tem fairValue, sempre considera)
  if (strategies.dividendYield) {
    const dyWeight = weights.dividendYield;
    const dyContribution = strategies.dividendYield.score * dyWeight;
    totalScore += dyContribution;
    totalWeight += dyWeight;

    if (strategies.dividendYield.isEligible && strategies.dividendYield.score >= 80) {
      strengths.push('Dividendos sustentáveis');
    } else if (strategies.dividendYield.score < 60) {
      weaknesses.push('Dividendos em risco');
    }
  }

  // Low PE Analysis (não tem fairValue, sempre considera)
  if (strategies.lowPE) {
    const lowPEWeight = weights.lowPE;
    const lowPEContribution = strategies.lowPE.score * lowPEWeight;
    totalScore += lowPEContribution;
    totalWeight += lowPEWeight;

    if (strategies.lowPE.isEligible && strategies.lowPE.score >= 80) {
      strengths.push('Boa oportunidade de valor');
    } else if (strategies.lowPE.score < 60) {
      weaknesses.push('Possível value trap');
    }
  }

  // Magic Formula Analysis (não tem fairValue, sempre considera)
  if (strategies.magicFormula) {
    const mfWeight = weights.magicFormula;
    const mfContribution = strategies.magicFormula.score * mfWeight;
    totalScore += mfContribution;
    totalWeight += mfWeight;

    if (strategies.magicFormula.isEligible && strategies.magicFormula.score >= 80) {
      strengths.push('Excelente qualidade operacional');
    } else if (strategies.magicFormula.score < 60) {
      weaknesses.push('Qualidade operacional questionável');
    }
  }

  // FCD Analysis
  if (strategies.fcd) {
    const fcdWeight = weights.fcd;
    const isPriceCompatible = isPriceCompatibleWithFairValue(strategies.fcd.fairValue, strategies.fcd.upside);
    
    // Sempre inclui o peso, mas penaliza se incompatível
    if (isPriceCompatible) {
      const fcdContribution = strategies.fcd.score * fcdWeight;
      totalScore += fcdContribution;

      if (strategies.fcd.fairValue && strategies.fcd.upside && strategies.fcd.upside > 20) {
        strengths.push('Alto potencial de valorização');
      }
    } else {
      // Penaliza com score baixo se preço incompatível
      const penalizedScore = strategies.fcd.fairValue && strategies.fcd.upside && strategies.fcd.upside < 10 ? 20 : strategies.fcd.score;
      const fcdContribution = penalizedScore * fcdWeight;
      totalScore += fcdContribution;
      
      if (strategies.fcd.fairValue && strategies.fcd.upside && strategies.fcd.upside < 10) {
        weaknesses.push('Preço com pouca margem de segurança (FCD)');
      }
    }
    totalWeight += fcdWeight;
  }

  // Gordon Analysis
  if (strategies.gordon) {
    const gordonWeight = weights.gordon;
    const isPriceCompatible = isPriceCompatibleWithFairValue(strategies.gordon.fairValue, strategies.gordon.upside);
    
    // Sempre inclui o peso, mas penaliza se incompatível
    if (isPriceCompatible) {
      const gordonContribution = strategies.gordon.score * gordonWeight;
      totalScore += gordonContribution;

      if (strategies.gordon.isEligible && strategies.gordon.score >= 80) {
        strengths.push('Excelente para renda passiva (Gordon)');
      } else if (strategies.gordon.score < 60) {
        weaknesses.push('Dividendos inconsistentes');
      }
    } else {
      // Penaliza com score baixo se preço incompatível
      const penalizedScore = strategies.gordon.fairValue && strategies.gordon.upside && strategies.gordon.upside < 15 ? 25 : strategies.gordon.score;
      const gordonContribution = penalizedScore * gordonWeight;
      totalScore += gordonContribution;
      
      if (strategies.gordon.fairValue && strategies.gordon.upside && strategies.gordon.upside < 0) {
        weaknesses.push('Preço acima do valor justo por dividendos');
      }
    }
    totalWeight += gordonWeight;
  }

  // Fundamentalist Analysis (não tem fairValue, sempre considera)
  if (strategies.fundamentalist) {
    const fundamentalistWeight = weights.fundamentalist;
    const fundamentalistContribution = strategies.fundamentalist.score * fundamentalistWeight;
    totalScore += fundamentalistContribution;
    totalWeight += fundamentalistWeight;

    if (strategies.fundamentalist.isEligible && strategies.fundamentalist.score >= 80) {
      strengths.push('Excelente análise fundamentalista simplificada');
    } else if (strategies.fundamentalist.score >= 70) {
      strengths.push('Boa análise fundamentalista');
    } else if (strategies.fundamentalist.score < 60) {
      weaknesses.push('Fundamentos fracos na análise 3+1');
    }
  }

  // Análise das Demonstrações Financeiras
  let statementsAnalysis: StatementsAnalysis | null = null;
  if (statementsData) {
    statementsAnalysis = analyzeFinancialStatements(statementsData);
    const statementsWeight = weights.statements;
    
    // Aplicar penalização severa para risco crítico
    let adjustedStatementsScore = statementsAnalysis.score;
    if (statementsAnalysis.riskLevel === 'CRITICAL') {
      // Penalização severa: reduzir o score das demonstrações para no máximo 20
      adjustedStatementsScore = Math.min(statementsAnalysis.score, 20);
      weaknesses.push('🚨 RISCO CRÍTICO: Demonstrações financeiras indicam sérios problemas');
    } else if (statementsAnalysis.riskLevel === 'HIGH') {
      // Penalização moderada para alto risco
      adjustedStatementsScore = Math.min(statementsAnalysis.score, 40);
      weaknesses.push('⚠️ ALTO RISCO: Demonstrações financeiras preocupantes');
    } else if (statementsAnalysis.riskLevel === 'LOW' && statementsAnalysis.score >= 80) {
      strengths.push('✅ Demonstrações financeiras saudáveis');
    }
    
    const statementsContribution = adjustedStatementsScore * statementsWeight;
    totalScore += statementsContribution;
    totalWeight += statementsWeight;

    // Adicionar força da empresa como contexto
    if (statementsAnalysis.companyStrength === 'VERY_STRONG') {
      strengths.push('Empresa muito robusta financeiramente');
    } else if (statementsAnalysis.companyStrength === 'STRONG') {
      strengths.push('Empresa robusta financeiramente');
    } else if (statementsAnalysis.companyStrength === 'WEAK') {
      weaknesses.push('Empresa financeiramente frágil');
    }

    // Adicionar red flags específicos (limitado para não sobrecarregar)
    statementsAnalysis.redFlags.slice(0, 3).forEach(flag => {
      if (!weaknesses.includes(flag)) {
        weaknesses.push(flag);
      }
    });

    // Adicionar sinais positivos específicos (limitado para não sobrecarregar)
    statementsAnalysis.positiveSignals.slice(0, 3).forEach(signal => {
      if (!strengths.includes(signal)) {
        strengths.push(signal);
      }
    });
  }

  // Calcular score final normalizado
  let finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  
  // Obter dados financeiros para análise de penalizações
  const roe = toNumber(financialData.roe);
  const liquidezCorrente = toNumber(financialData.liquidezCorrente);
  const dividaLiquidaPl = toNumber(financialData.dividaLiquidaPl);
  const margemLiquida = toNumber(financialData.margemLiquida);
  
  // Aplicar penalização por endividamento elevado
  if (dividaLiquidaPl !== null) {
    let debtPenalty = 0;
    if (dividaLiquidaPl > 3.0) {
      // Endividamento muito alto: penalização severa de 20 pontos
      debtPenalty = 20;
      weaknesses.push('🚨 Endividamento crítico');
    } else if (dividaLiquidaPl > 2.0) {
      // Endividamento alto: penalização de 12 pontos
      debtPenalty = 12;
      if (!weaknesses.includes('Alto endividamento')) {
        weaknesses.push('Alto endividamento');
      }
    } else if (dividaLiquidaPl > 1.5) {
      // Endividamento moderadamente alto: penalização de 6 pontos
      debtPenalty = 6;
      weaknesses.push('Endividamento moderadamente alto');
    } else if (dividaLiquidaPl > 1.0) {
      // Endividamento moderado: penalização leve de 3 pontos
      debtPenalty = 3;
      weaknesses.push('Endividamento moderado');
    } else if (dividaLiquidaPl > 0.9) {
      // Endividamento leve: penalização leve de 2 ponto
      debtPenalty = 2;
      weaknesses.push('Endividamento leve');
    }
    
    if (debtPenalty > 0) {
      finalScore = Math.max(0, finalScore - debtPenalty);
    }
  }
  
  // Aplicar penalização por baixa margem líquida
  if (margemLiquida !== null) {
    let marginPenalty = 0;
    if (margemLiquida < -0.05) {
      // Margem líquida muito negativa: penalização severa de 18 pontos
      marginPenalty = 18;
      weaknesses.push('🚨 Margem líquida crítica (prejuízo)');
    } else if (margemLiquida < 0) {
      // Margem líquida negativa: penalização de 12 pontos
      marginPenalty = 12;
      weaknesses.push('Margem líquida negativa');
    } else if (margemLiquida < 0.02) {
      // Margem líquida muito baixa: penalização de 8 pontos
      marginPenalty = 8;
      if (!weaknesses.includes('Margem de lucro baixa')) {
        weaknesses.push('Margem de lucro baixa');
      }
    } else if (margemLiquida < 0.05) {
      // Margem líquida baixa: penalização de 4 pontos
      marginPenalty = 6;
      weaknesses.push('Margem de lucro abaixo da média');
    } else if (margemLiquida < 0.08) {
      // Margem líquida moderada: penalização leve de 2 pontos
      marginPenalty = 4;
      weaknesses.push('Margem de lucro moderada');
    }
    
    if (marginPenalty > 0) {
      finalScore = Math.max(0, finalScore - marginPenalty);
    }
  }
  
  // Aplicar penalização adicional no score geral para risco crítico
  if (statementsAnalysis?.riskLevel === 'CRITICAL') {
    // Penalização adicional de 15 pontos no score final para risco crítico
    finalScore = Math.max(0, finalScore - 15);
    // Garantir que empresas com risco crítico nunca tenham score superior a 50
    finalScore = Math.min(finalScore, 50);
  } else if (statementsAnalysis?.riskLevel === 'HIGH') {
    // Penalização adicional de 8 pontos no score final para alto risco
    finalScore = Math.max(0, finalScore - 8);
    // Garantir que empresas com alto risco nunca tenham score superior a 70
    finalScore = Math.min(finalScore, 70);
  }

  // Adicionar análises de indicadores básicos - dar benefício da dúvida quando dados faltam

  // Só adicionar pontos positivos ou negativos se o dado existir
  if (roe !== null) {
    if (roe >= 0.15) strengths.push('Alto ROE');
    else if (roe < 0.05) weaknesses.push('ROE muito baixo');
  }

  if (liquidezCorrente !== null) {
    if (liquidezCorrente >= 1.5) strengths.push('Boa liquidez');
    else if (liquidezCorrente < 1.0) weaknesses.push('Liquidez baixa');
  }

  if (dividaLiquidaPl !== null) {
    if (dividaLiquidaPl <= 0.5) {
      strengths.push('Endividamento controlado');
    }
    // Casos de endividamento alto já foram tratados na penalização acima
  } else {
    // Se não tem dado de dívida, assumir que é controlado (benefício da dúvida)
    strengths.push('Endividamento controlado (dado não disponível)');
  }

  if (margemLiquida !== null) {
    if (margemLiquida >= 0.15) {
      strengths.push('Excelente margem de lucro');
    } else if (margemLiquida >= 0.10) {
      strengths.push('Boa margem de lucro');
    }
    // Casos de margem baixa já foram tratados na penalização acima
  }

  // Determinar grade e classificação
  let grade: OverallScore['grade'];
  let classification: OverallScore['classification'];
  let recommendation: OverallScore['recommendation'];

  if (finalScore >= 95) {
    grade = 'A+';
    classification = 'Excelente';
    recommendation = 'Compra Forte';
  } else if (finalScore >= 90) {
    grade = 'A';
    classification = 'Excelente';
    recommendation = 'Compra Forte';
  } else if (finalScore >= 85) {
    grade = 'A-';
    classification = 'Muito Bom';
    recommendation = 'Compra';
  } else if (finalScore >= 80) {
    grade = 'B+';
    classification = 'Muito Bom';
    recommendation = 'Compra';
  } else if (finalScore >= 75) {
    grade = 'B';
    classification = 'Bom';
    recommendation = 'Compra';
  } else if (finalScore >= 70) {
    grade = 'B-';
    classification = 'Bom';
    recommendation = 'Neutro';
  } else if (finalScore >= 65) {
    grade = 'C+';
    classification = 'Regular';
    recommendation = 'Neutro';
  } else if (finalScore >= 60) {
    grade = 'C';
    classification = 'Regular';
    recommendation = 'Neutro';
  } else if (finalScore >= 50) {
    grade = 'C-';
    classification = 'Regular';
    recommendation = 'Venda';
  } else if (finalScore >= 30) {
    grade = 'D';
    classification = 'Fraco';
    recommendation = 'Venda';
  } else {
    grade = 'F';
    classification = 'Muito Fraco';
    recommendation = 'Venda Forte';
  }

  return {
    score: finalScore,
    grade,
    classification,
    strengths: strengths.slice(0, 5), // Máximo 5 pontos fortes
    weaknesses: weaknesses.slice(0, 5), // Máximo 5 pontos fracos
    recommendation,
    statementsAnalysis: statementsAnalysis || undefined // Incluir análise das demonstrações financeiras
  };
}
