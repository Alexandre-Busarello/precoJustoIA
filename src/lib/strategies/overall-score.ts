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
}

// Interface para análise das demonstrações
export interface StatementsAnalysis {
  score: number; // 0-100
  redFlags: string[];
  positiveSignals: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// === ANÁLISE INTELIGENTE DAS DEMONSTRAÇÕES FINANCEIRAS ===
export function analyzeFinancialStatements(data: FinancialStatementsData): StatementsAnalysis {
  const { incomeStatements, balanceSheets, cashflowStatements } = data;
  
  let score = 100;
  const redFlags: string[] = [];
  const positiveSignals: string[] = [];
  
  // Verificar se temos dados suficientes (pelo menos 4 trimestres)
  if (incomeStatements.length < 4 || balanceSheets.length < 4 || cashflowStatements.length < 4) {
    score -= 10;
    redFlags.push('Dados históricos insuficientes para análise completa');
  }

  // === ANÁLISE DA DRE ===
  if (incomeStatements.length >= 2) {
    const latest = incomeStatements[0];
    const previous = incomeStatements[1];
    
    // 1. Receita Total - Verificar volatilidade excessiva
    const currentRevenue = toNumber(latest.totalRevenue) || toNumber(latest.operatingIncome);
    const previousRevenue = toNumber(previous.totalRevenue) || toNumber(previous.operatingIncome);
    
    if (currentRevenue && previousRevenue && previousRevenue > 0) {
      const revenueChange = (currentRevenue - previousRevenue) / previousRevenue;
      
      if (revenueChange < -0.5) {
        score -= 15;
        redFlags.push('Queda drástica de receita (>50%)');
      } else if (revenueChange > 2.0) {
        score -= 10;
        redFlags.push('Crescimento de receita suspeito (>200%)');
      } else if (revenueChange > 0.1) {
        positiveSignals.push('Crescimento consistente de receita');
      }
    }
    
    // 2. Margem Líquida - Verificar deterioração
    const currentNetIncome = toNumber(latest.netIncome);
    const currentOperatingIncome = toNumber(latest.operatingIncome);
    const previousNetIncome = toNumber(previous.netIncome);
    const previousOperatingIncome = toNumber(previous.operatingIncome);
    
    if (currentNetIncome && currentOperatingIncome && previousNetIncome && previousOperatingIncome) {
      const currentMargin = currentOperatingIncome > 0 ? currentNetIncome / currentOperatingIncome : 0;
      const previousMargin = previousOperatingIncome > 0 ? previousNetIncome / previousOperatingIncome : 0;
      
      if (currentMargin < -0.2) {
        score -= 20;
        redFlags.push('Margem líquida muito negativa (<-20%)');
      } else if (previousMargin > 0.05 && currentMargin < previousMargin * 0.5) {
        score -= 15;
        redFlags.push('Deterioração significativa da margem líquida');
      } else if (currentMargin > 0.15) {
        positiveSignals.push('Margem líquida saudável (>15%)');
      }
    }
    
    // 3. Despesas Operacionais - Verificar crescimento descontrolado
    const currentOpExpenses = toNumber(latest.totalOperatingExpenses);
    const previousOpExpenses = toNumber(previous.totalOperatingExpenses);
    
    if (currentOpExpenses && previousOpExpenses && previousOpExpenses > 0 && currentRevenue && previousRevenue) {
      const expenseGrowth = (currentOpExpenses - previousOpExpenses) / previousOpExpenses;
      const revenueGrowthRate = (currentRevenue - previousRevenue) / previousRevenue;
      
      if (expenseGrowth > revenueGrowthRate + 0.2) {
        score -= 10;
        redFlags.push('Crescimento de despesas superior ao de receitas');
      }
    }
  }

  // === ANÁLISE DO BALANÇO ===
  if (balanceSheets.length >= 2) {
    const latest = balanceSheets[0];
    const previous = balanceSheets[1];
    
    // 1. Liquidez - Verificar deterioração
    const currentAssets = toNumber(latest.totalCurrentAssets);
    const currentLiabilities = toNumber(latest.totalCurrentLiabilities);
    const previousAssets = toNumber(previous.totalCurrentAssets);
    const previousLiabilities = toNumber(previous.totalCurrentLiabilities);
    
    if (currentAssets && currentLiabilities && previousAssets && previousLiabilities) {
      const currentRatio = currentAssets / currentLiabilities;
      const previousRatio = previousAssets / previousLiabilities;
      
      if (currentRatio < 0.8) {
        score -= 20;
        redFlags.push('Liquidez corrente crítica (<0.8)');
      } else if (previousRatio > 1.2 && currentRatio < previousRatio * 0.7) {
        score -= 15;
        redFlags.push('Deterioração significativa da liquidez');
      } else if (currentRatio > 1.5) {
        positiveSignals.push('Liquidez corrente saudável');
      }
    }
    
    // 2. Endividamento - Verificar crescimento perigoso
    const currentTotalLiab = toNumber(latest.totalLiab);
    const currentEquity = toNumber(latest.totalStockholderEquity);
    const previousTotalLiab = toNumber(previous.totalLiab);
    const previousEquity = toNumber(previous.totalStockholderEquity);
    
    if (currentTotalLiab && currentEquity && previousTotalLiab && previousEquity) {
      const currentDebtRatio = currentTotalLiab / (currentTotalLiab + currentEquity);
      const previousDebtRatio = previousTotalLiab / (previousTotalLiab + previousEquity);
      
      if (currentDebtRatio > 0.8) {
        score -= 25;
        redFlags.push('Endividamento excessivo (>80%)');
      } else if (currentDebtRatio > previousDebtRatio + 0.15) {
        score -= 15;
        redFlags.push('Crescimento acelerado do endividamento');
      } else if (currentDebtRatio < 0.4) {
        positiveSignals.push('Endividamento controlado');
      }
    }
    
    // 3. Patrimônio Líquido - Verificar erosão
    if (currentEquity && previousEquity && previousEquity > 0) {
      const equityChange = (currentEquity - previousEquity) / previousEquity;
      
      if (equityChange < -0.3) {
        score -= 20;
        redFlags.push('Erosão significativa do patrimônio líquido');
      } else if (currentEquity < 0) {
        score -= 30;
        redFlags.push('Patrimônio líquido negativo');
      } else if (equityChange > 0.1) {
        positiveSignals.push('Crescimento do patrimônio líquido');
      }
    }
  }

  // === ANÁLISE DO FLUXO DE CAIXA ===
  if (cashflowStatements.length >= 2) {
    const latest = cashflowStatements[0];
    const previous = cashflowStatements[1];
    
    // 1. Fluxo de Caixa Operacional - Verificar consistência
    const currentOpCashFlow = toNumber(latest.operatingCashFlow);
    const previousOpCashFlow = toNumber(previous.operatingCashFlow);
    const currentNetIncome = toNumber(incomeStatements[0]?.netIncome);
    
    if (currentOpCashFlow !== null && currentNetIncome !== null) {
      if (currentOpCashFlow < 0 && currentNetIncome > 0) {
        score -= 15;
        redFlags.push('Fluxo de caixa operacional negativo apesar do lucro');
      } else if (currentNetIncome > 0 && currentOpCashFlow < currentNetIncome * 0.5) {
        score -= 10;
        redFlags.push('Fluxo de caixa operacional muito inferior ao lucro');
      }
    }
    
    // 2. Verificar padrão de queima de caixa
    if (currentOpCashFlow && previousOpCashFlow) {
      if (currentOpCashFlow < 0 && previousOpCashFlow < 0) {
        score -= 20;
        redFlags.push('Queima de caixa operacional persistente');
      } else if (currentOpCashFlow > 0 && previousOpCashFlow < 0) {
        positiveSignals.push('Recuperação do fluxo de caixa operacional');
      }
    }
    
    // 3. Fluxo de Caixa de Investimento - Verificar padrões anômalos
    const currentInvCashFlow = toNumber(latest.investmentCashFlow);
    const previousInvCashFlow = toNumber(previous.investmentCashFlow);
    
    if (currentInvCashFlow && previousInvCashFlow) {
      // Investimento muito alto pode indicar aquisições arriscadas
      if (Math.abs(currentInvCashFlow) > Math.abs(currentOpCashFlow || 0) * 2) {
        score -= 10;
        redFlags.push('Investimentos desproporcionais ao fluxo operacional');
      }
    }
  }

  // === ANÁLISE DE TENDÊNCIAS (4+ trimestres) ===
  if (incomeStatements.length >= 4) {
    const revenues = incomeStatements.slice(0, 4).map(stmt => 
      toNumber(stmt.totalRevenue) || toNumber(stmt.operatingIncome) || 0
    ).reverse(); // Ordem cronológica
    
    const netIncomes = incomeStatements.slice(0, 4).map(stmt => 
      toNumber(stmt.netIncome) || 0
    ).reverse();
    
    // Verificar tendência de receita
    let revenueDeclineCount = 0;
    let profitDeclineCount = 0;
    
    for (let i = 1; i < revenues.length; i++) {
      if (revenues[i] < revenues[i-1] * 0.95) revenueDeclineCount++;
      if (netIncomes[i] < netIncomes[i-1]) profitDeclineCount++;
    }
    
    if (revenueDeclineCount >= 3) {
      score -= 20;
      redFlags.push('Tendência consistente de queda de receita');
    } else if (revenueDeclineCount === 0) {
      positiveSignals.push('Crescimento consistente de receita');
    }
    
    if (profitDeclineCount >= 3) {
      score -= 15;
      redFlags.push('Tendência consistente de queda de lucro');
    }
  }

  // Determinar nível de risco
  let riskLevel: StatementsAnalysis['riskLevel'] = 'LOW';
  if (score < 30) riskLevel = 'CRITICAL';
  else if (score < 50) riskLevel = 'HIGH';
  else if (score < 70) riskLevel = 'MEDIUM';

  return {
    score: Math.max(0, Math.min(100, score)),
    redFlags: redFlags.slice(0, 8), // Máximo 8 red flags
    positiveSignals: positiveSignals.slice(0, 5), // Máximo 5 sinais positivos
    riskLevel
  };
}

// === FUNÇÃO CENTRALIZADA PARA CALCULAR SCORE GERAL ===
export function calculateOverallScore(strategies: {
  graham: StrategyAnalysis | null;
  dividendYield: StrategyAnalysis | null;
  lowPE: StrategyAnalysis | null;
  magicFormula: StrategyAnalysis | null;
  fcd: StrategyAnalysis | null;
  gordon: StrategyAnalysis | null;
}, financialData: FinancialData, currentPrice: number, statementsData?: FinancialStatementsData): OverallScore {
  const weights = {
    graham: 0.12,        // 12% - Base fundamentalista
    dividendYield: 0.12, // 12% - Sustentabilidade de dividendos
    lowPE: 0.16,         // 16% - Value investing
    magicFormula: 0.12,  // 12% - Qualidade operacional
    fcd: 0.16,           // 16% - Valor intrínseco
    gordon: 0.12,        // 12% - Método dos dividendos
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

  // Análise das Demonstrações Financeiras
  let statementsAnalysis: StatementsAnalysis | null = null;
  if (statementsData) {
    statementsAnalysis = analyzeFinancialStatements(statementsData);
    const statementsWeight = weights.statements;
    const statementsContribution = statementsAnalysis.score * statementsWeight;
    totalScore += statementsContribution;
    totalWeight += statementsWeight;

    // Adicionar red flags e sinais positivos às listas
    if (statementsAnalysis.riskLevel === 'CRITICAL') {
      weaknesses.push('Demonstrações financeiras indicam risco crítico');
    } else if (statementsAnalysis.riskLevel === 'HIGH') {
      weaknesses.push('Demonstrações financeiras indicam alto risco');
    } else if (statementsAnalysis.riskLevel === 'LOW' && statementsAnalysis.score >= 80) {
      strengths.push('Demonstrações financeiras saudáveis');
    }

    // Adicionar red flags específicos
    statementsAnalysis.redFlags.forEach(flag => {
      if (!weaknesses.includes(flag)) {
        weaknesses.push(flag);
      }
    });

    // Adicionar sinais positivos específicos
    statementsAnalysis.positiveSignals.forEach(signal => {
      if (!strengths.includes(signal)) {
        strengths.push(signal);
      }
    });
  }

  // Calcular score final normalizado
  const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

  // Adicionar análises de indicadores básicos
  const roe = toNumber(financialData.roe);
  const liquidezCorrente = toNumber(financialData.liquidezCorrente);
  const dividaLiquidaPl = toNumber(financialData.dividaLiquidaPl);
  const margemLiquida = toNumber(financialData.margemLiquida);

  if (roe && roe >= 0.15) strengths.push('Alto ROE');
  if (roe && roe < 0.05) weaknesses.push('ROE muito baixo');

  if (liquidezCorrente && liquidezCorrente >= 1.5) strengths.push('Boa liquidez');
  if (liquidezCorrente && liquidezCorrente < 1.0) weaknesses.push('Liquidez baixa');

  if (!dividaLiquidaPl || dividaLiquidaPl <= 0.5) strengths.push('Endividamento controlado');
  if (dividaLiquidaPl && dividaLiquidaPl > 2.0) weaknesses.push('Alto endividamento');

  if (margemLiquida && margemLiquida >= 0.10) strengths.push('Boa margem de lucro');
  if (margemLiquida && margemLiquida < 0.02) weaknesses.push('Margem de lucro baixa');

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
