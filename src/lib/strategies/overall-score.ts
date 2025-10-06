import { StrategyAnalysis } from './types';
import { toNumber } from './base-strategy';

// Interface para score geral
export interface OverallScore {
  score: number; // Score de 0-100
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  classification: 'Excelente' | 'Muito Bom' | 'Bom' | 'Regular' | 'Fraco' | 'Péssimo';
  strengths: string[];
  weaknesses: string[];
  recommendation: 'Empresa Excelente' | 'Empresa Boa' | 'Empresa Regular' | 'Empresa Fraca' | 'Empresa Péssima';
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
    ticker?: string | null;
    sector?: string | null;
    industry?: string | null;
    marketCap?: number | null;
  };
  // Dados financeiros calculados como fallback
  financialDataFallback?: {
    // Indicadores podem ser arrays (múltiplos anos) ou valores únicos
    roe?: number | number[] | null;
    roa?: number | number[] | null;
    margemLiquida?: number | number[] | null;
    margemBruta?: number | number[] | null;
    margemEbitda?: number | number[] | null;
    liquidezCorrente?: number | number[] | null;
    liquidezRapida?: number | number[] | null;
    debtToEquity?: number | number[] | null;
    dividaLiquidaPl?: number | number[] | null;
    giroAtivos?: number | number[] | null;
    cagrLucros5a?: number | null; // CAGR é sempre um valor único
    cagrReceitas5a?: number | null; // CAGR é sempre um valor único
    crescimentoLucros?: number | number[] | null;
    crescimentoReceitas?: number | number[] | null;
    fluxoCaixaOperacional?: number | number[] | null;
    fluxoCaixaLivre?: number | number[] | null;
    totalCaixa?: number | number[] | null;
    totalDivida?: number | number[] | null;
    ativoTotal?: number | number[] | null;
    patrimonioLiquido?: number | number[] | null;
    passivoCirculante?: number | number[] | null;
    ativoCirculante?: number | number[] | null;
    years?: number[]; // Anos dos dados disponíveis
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

// === FUNÇÃO DE RECONCILIAÇÃO: REMOVE CONTRADIÇÕES ENTRE PONTOS FORTES E ALERTAS ===
// Prioriza sempre os alertas (red flags), removendo pontos fortes contraditórios
// Filosofia: Empresas de qualidade devem ter análise conservadora e pessimista
function reconcileContradictions(
  positiveSignals: string[],
  redFlags: string[],
  metrics: AverageMetrics
): { reconciledSignals: string[]; removedCount: number } {
  const reconciled = [...positiveSignals];
  const toRemove: number[] = [];

  // Mapeamento de contradições: quando há um alerta, remove pontos fortes específicos
  const contradictionRules = [
    // 1. ENDIVIDAMENTO: Se endividamento é alto, NENHUM aspecto de liquidez/capacidade é válido
    {
      redFlagKeywords: ['Endividamento muito alto', 'Endividamento crítico', 'Endividamento alto'],
      positiveKeywordsToRemove: [
        'Facilidade para pagar juros',
        'Consegue pagar juros',
        'Boa capacidade de pagamento',
        'Endividamento controlado',
        'Endividamento baixo',
        'Liquidez imediata boa',  // NOVO: liquidez de curto prazo não importa com endividamento estrutural alto
        'Liquidez adequada',
        'Capital de giro saudável',  // NOVO: capital de giro não resolve endividamento alto
        'Capital de giro positivo',
        'Boa liquidez'
      ]
    },
    
    // 2. MARGENS: Se margem líquida é baixa, a operação não pode ser "muito lucrativa" nem "geração de caixa excelente"
    {
      redFlagKeywords: ['Margem de lucro baixa', 'Margem líquida baixa'],
      positiveKeywordsToRemove: [
        'Operação muito lucrativa',
        'Operação lucrativa',
        'Excelente margem',
        'Boa margem',
        'Boa geração de caixa',  // NOVO: margens baixas contradizem boa geração de caixa
        'Sobra muito dinheiro',  // NOVO: se margem é baixa, não "sobra muito"
        'Fluxo de caixa forte',
        'Excelente conversão em caixa'
      ]
    },
    
    // 3. RENTABILIDADE: Se ROE/ROA são baixos, não há "rentabilidade excepcional" nem "qualidade"
    {
      redFlagKeywords: ['Rentabilidade baixa', 'Baixa eficiência dos ativos', 'Margem de lucro baixa'],
      positiveKeywordsToRemove: [
        'Rentabilidade excepcional',
        'Rentabilidade excelente',
        'Boa rentabilidade',
        'Eficiência dos ativos',
        'Qualidade dos lucros',  // NOVO: rentabilidade baixa contradiz qualidade
        'Lucros de qualidade',
        'Lucro vira dinheiro',  // NOVO: mesmo virando dinheiro, lucro baixo é problema
        'Excelente qualidade dos lucros'
      ]
    },
    
    // 4. CRESCIMENTO: Se lucros estão em queda, NENHUM tipo de crescimento é válido
    {
      redFlagKeywords: [
        'Lucros em queda',
        'Receitas em queda',
        'Crescimento negativo',
        'Queda de receita',
        'Queda de lucros',
        'Crescimento sem lucro'  // NOVO: crescimento de vendas sem lucro
      ],
      positiveKeywordsToRemove: [
        'Crescimento sustentável',
        'Crescimento forte',
        'Crescimento consistente',
        'Boa expansão',
        'Bom crescimento',
        'Crescimento acelerado',  // NOVO: crescimento de vendas não importa se lucros caem
        'Vendas crescem',  // NOVO: vendas crescendo não é positivo se lucros caem
        'Receitas em expansão',
        'Expansão de vendas',
        'Boa geração de caixa',  // NOVO: lucros em queda contradizem boa geração
        'Sobra muito dinheiro',  // NOVO: lucros em queda indicam que não sobra
        'Fluxo de caixa livre alto',
        'Caixa livre abundante',
        'Qualidade dos lucros',  // NOVO: se lucros caem, qualidade não importa
        'Lucro vira dinheiro',  // NOVO: irrelevante se lucros estão caindo
        'Lucros sólidos'
      ]
    },
    
    // 5. EFICIÊNCIA: Se recursos são mal aproveitados, não há "eficiência"
    {
      redFlagKeywords: ['Recursos mal aproveitados', 'Ativos ociosos', 'Baixo giro de ativos'],
      positiveKeywordsToRemove: [
        'Eficiência operacional',
        'Uso eficiente',
        'Boa gestão de ativos',
        'Ativos produtivos'
      ]
    },
    
    // 6. ESTABILIDADE: Se há instabilidade, não pode haver "consistência" ou "previsibilidade"
    {
      redFlagKeywords: [
        'Lucratividade instável',
        'Resultados voláteis',
        'Margem instável',
        'Receitas irregulares',
        'Margens de lucro variam muito'  // NOVO: variação de margens
      ],
      positiveKeywordsToRemove: [
        'Resultados consistentes',
        'Margem estável',
        'Receita previsível',
        'Resultados previsíveis',
        'Vendas relativamente previsíveis',  // NOVO: instabilidade de lucro suprime previsibilidade de vendas
        'Vendas previsíveis',
        'Receitas consistentes',
        'Estabilidade operacional'
      ]
    },
    
    // 7. LIQUIDEZ: Se há problemas de liquidez, não pode haver "boa capacidade"
    {
      redFlagKeywords: [
        'Dificuldade para pagar contas',
        'Liquidez baixa',
        'Problemas de caixa',
        'Capital de giro negativo'
      ],
      positiveKeywordsToRemove: [
        'Boa capacidade de pagamento',
        'Liquidez imediata boa',
        'Capital de giro saudável',
        'Boa liquidez'
      ]
    },
    
    // 8. QUALIDADE DOS LUCROS: Se lucros são de baixa qualidade, não pode haver "lucros sólidos"
    {
      redFlagKeywords: [
        'Qualidade dos lucros questionável',
        'Dependência de resultados não operacionais',
        'Lucros artificiais',
        'Lucros não recorrentes'
      ],
      positiveKeywordsToRemove: [
        'Lucros de qualidade',
        'Lucros recorrentes',
        'Lucros consistentes',
        'Base sólida de lucros'
      ]
    },
    
    // 9. FLUXO DE CAIXA: Se há problemas de caixa, não pode haver "geração sólida"
    {
      redFlagKeywords: [
        'Fluxo de caixa negativo',
        'Queima de caixa',
        'Caixa deteriorando',
        'Problemas de conversão'
      ],
      positiveKeywordsToRemove: [
        'Geração sólida de caixa',
        'Fluxo de caixa forte',
        'Boa conversão em caixa',
        'Caixa robusto'
      ]
    }
  ];

  // Aplicar regras de contradição
  for (const rule of contradictionRules) {
    // Verificar se algum red flag corresponde a esta regra
    const hasMatchingRedFlag = redFlags.some(flag => 
      rule.redFlagKeywords.some(keyword => flag.includes(keyword))
    );

    if (hasMatchingRedFlag) {
      // Marcar para remoção todos os pontos fortes que contradizem este alerta
      reconciled.forEach((signal, index) => {
        const shouldRemove = rule.positiveKeywordsToRemove.some(keyword => 
          signal.includes(keyword)
        );
        
        if (shouldRemove && !toRemove.includes(index)) {
          toRemove.push(index);
          console.log(`❌ Removendo ponto forte contraditório: "${signal.substring(0, 60)}..."`);
          console.log(`   Motivo: Alerta sobre ${rule.redFlagKeywords[0]}`);
        }
      });
    }
  }

  // CASOS ESPECIAIS: Verificações adicionais baseadas em métricas específicas
  
  // Se D/E > 2x e Interest Coverage alto, remover "facilidade para pagar juros"
  if (metrics.debtToEquity > 2.0 && metrics.interestCoverage >= 8) {
    reconciled.forEach((signal, index) => {
      if (signal.includes('Facilidade para pagar juros') && !toRemove.includes(index)) {
        toRemove.push(index);
        console.log(`❌ Removendo "Facilidade para pagar juros" - endividamento muito alto (${metrics.debtToEquity.toFixed(2)}x) suprime esta vantagem`);
      }
    });
  }
  
  // Se margem operacional > 15% mas margem líquida < 5%, remover "operação muito lucrativa"
  if (metrics.operatingMargin >= 0.15 && metrics.netMargin < 0.05) {
    reconciled.forEach((signal, index) => {
      if (signal.includes('Operação muito lucrativa') && !toRemove.includes(index)) {
        toRemove.push(index);
        console.log(`❌ Removendo "Operação muito lucrativa" - margem líquida baixa (${(metrics.netMargin * 100).toFixed(1)}%) indica que lucro operacional não se converte em lucro líquido`);
      }
    });
  }
  
  // COMBINAÇÃO CRÍTICA: Endividamento alto + Lucros em queda = Remover TODOS os pontos sobre caixa/dividendos
  const hasHighDebt = redFlags.some(flag => 
    flag.includes('Endividamento muito alto') || flag.includes('Endividamento crítico')
  );
  const hasFallingProfits = redFlags.some(flag => 
    flag.includes('Lucros em queda') || flag.includes('Crescimento sem lucro')
  );
  
  if (hasHighDebt && hasFallingProfits) {
    reconciled.forEach((signal, index) => {
      const isCashRelated = signal.includes('caixa') || 
                           signal.includes('Sobra') || 
                           signal.includes('dividendo') ||
                           signal.includes('Fluxo de caixa livre');
      if (isCashRelated && !toRemove.includes(index)) {
        toRemove.push(index);
        console.log(`❌ Removendo ponto sobre caixa/dividendos - combinação crítica: endividamento alto + lucros em queda`);
      }
    });
  }
  
  // MARGEM BAIXA + LUCROS EM QUEDA: Remover qualquer ponto sobre geração de valor
  const hasLowMargins = redFlags.some(flag => flag.includes('Margem de lucro baixa'));
  if (hasLowMargins && hasFallingProfits) {
    reconciled.forEach((signal, index) => {
      const isValueGeneration = signal.includes('geração') || 
                               signal.includes('Sobra') ||
                               signal.includes('lucrativ');
      if (isValueGeneration && !toRemove.includes(index)) {
        toRemove.push(index);
        console.log(`❌ Removendo ponto sobre geração de valor - combinação crítica: margens baixas + lucros em queda`);
      }
    });
  }

  // Remover os índices marcados (de trás para frente para não alterar índices)
  const filtered = reconciled.filter((_, index) => !toRemove.includes(index));
  const removedCount = toRemove.length;
  
  console.log(`📊 Reconciliação: ${positiveSignals.length} pontos fortes → ${filtered.length} após remoção de ${removedCount} contradições`);
  
  return { reconciledSignals: filtered, removedCount };
}

// === ANÁLISE INTELIGENTE BASEADA EM MÉDIAS E BENCHMARKS SETORIAIS ===
export function analyzeFinancialStatements(data: FinancialStatementsData): StatementsAnalysis {
  const { incomeStatements, balanceSheets, cashflowStatements, company } = data;
  
  const redFlags: string[] = [];
  const positiveSignals: string[] = [];
  const contextualFactors: string[] = [];

  // === CONTEXTO SETORIAL E TAMANHO ===
  const sectorContext = getSectorContext(company?.sector || null, company?.industry || null, company?.ticker || undefined);
  const sizeContext = getSizeContext(company?.marketCap || null);
  
  // Log para debug de bancos
  if (company?.ticker && ['ITUB4', 'BBAS3', 'BBSE3', 'SANB11'].includes(company.ticker.toUpperCase())) {
    console.log(`🏦 DEBUG BANCO ${company.ticker}:`, {
      sector: company.sector,
      industry: company.industry,
      sectorContext: sectorContext.type,
      isFinancial: sectorContext.type === 'FINANCIAL'
    });
  }
  
  // Verificar disponibilidade de dados
  const minYears = 3;
  const hasInsufficientData = incomeStatements.length < 2 || balanceSheets.length < 2 || cashflowStatements.length < 2;
  const hasLimitedHistory = incomeStatements.length < minYears;
  
  // Para dados insuficientes, retornar score neutro
  if (hasInsufficientData) {
    contextualFactors.push('Dados históricos limitados - análise baseada em informações disponíveis');
    return {
      score: 50, // Score neutro para dados limitados
      redFlags: ['Dados históricos insuficientes para análise completa'],
      positiveSignals: [],
      riskLevel: 'MEDIUM' as const,
      companyStrength: 'MODERATE' as const,
      contextualFactors
    };
  } else if (hasLimitedHistory) {
    contextualFactors.push('Histórico parcial - análise baseada em dados disponíveis');
  }

  // === CALCULAR MÉDIAS DOS ÚLTIMOS 7 ANOS COMPLETOS ===
  const currentYear = new Date().getFullYear();
  const completedYearsData = {
    income: incomeStatements.filter(stmt => {
      const year = new Date(stmt.endDate as string).getFullYear();
      return year < currentYear;
    }).slice(0, 7),
    balance: balanceSheets.filter(stmt => {
      const year = new Date(stmt.endDate as string).getFullYear();
      return year < currentYear;
    }).slice(0, 7),
    cashflow: cashflowStatements.filter(stmt => {
      const year = new Date(stmt.endDate as string).getFullYear();
      return year < currentYear;
    }).slice(0, 7)
  };

  // === VALIDAÇÃO DE DADOS ===
  const dataValidation = validateFinancialData(
    completedYearsData.income, 
    completedYearsData.balance, 
    sectorContext,
    company?.sector || null,
    company?.industry || null
  );
  
  // === ANÁLISE BASEADA EM MÉDIAS E BENCHMARKS ===
  const averageMetrics = calculateAverageMetrics(completedYearsData, data.financialDataFallback, company?.ticker || undefined, dataValidation);
  const benchmarks = getSectorBenchmarks(sectorContext, sizeContext);
  console.log('Data validation results:', dataValidation);
  
  // === SISTEMA DE PONTUAÇÃO NORMALIZADO ===
  // Definir pesos normalizados (soma = 1.0)
  const weights = {
    profitability: 0.25,    // 25% - Rentabilidade
    liquidity: 0.18,        // 18% - Liquidez e Solvência  
    efficiency: 0.18,       // 18% - Eficiência Operacional
    stability: 0.15,        // 15% - Estabilidade e Consistência
    cashFlow: 0.10,         // 10% - Fluxo de Caixa
    growth: 0.04,           // 4% - Crescimento Sustentável
    incomeComposition: 0.10 // 10% - Composição do Resultado (qualidade dos lucros)
  };

  // Coletar todas as análises
  const analyses = {
    profitability: analyzeProfitabilityMetrics(averageMetrics, benchmarks, sectorContext, completedYearsData),
    liquidity: analyzeLiquidityMetrics(averageMetrics, benchmarks, sectorContext, dataValidation),
    efficiency: analyzeEfficiencyMetrics(averageMetrics, benchmarks, sectorContext, dataValidation),
    stability: analyzeStabilityMetrics(completedYearsData, averageMetrics, sectorContext),
    cashFlow: analyzeCashFlowQuality(averageMetrics, benchmarks, sectorContext),
    growth: analyzeGrowthQuality(completedYearsData, averageMetrics, sectorContext),
    incomeComposition: analyzeIncomeComposition(completedYearsData, sectorContext)
  };

  // Coletar flags e sinais
  Object.values(analyses).forEach(analysis => {
    redFlags.push(...analysis.redFlags);
    positiveSignals.push(...analysis.positiveSignals);
  });

  // === RECONCILIAÇÃO: REMOVER PONTOS FORTES CONTRADITÓRIOS AOS ALERTAS ===
  // Como priorizamos empresas de qualidade, devemos ser pessimistas na análise
  // Alertas sempre suprimem pontos fortes contraditórios
  const reconciliationResult = reconcileContradictions(positiveSignals, redFlags, averageMetrics);
  const reconciledPositiveSignals = reconciliationResult.reconciledSignals;
  const contradictionsRemoved = reconciliationResult.removedCount;

  // === NORMALIZAÇÃO DO SCORE ===
  // Converter scoreAdjustments para scores de 0-100 e aplicar pesos
  let weightedScore = 0;
  
  Object.entries(analyses).forEach(([key, analysis]) => {
    // Nova lógica: Score começa em 100 e é reduzido por penalidades
    // scoreAdjustment positivo = bônus, scoreAdjustment negativo = penalidade
    // Score base = 100, ajustado pelo scoreAdjustment
    let normalizedScore = 100 + analysis.scoreAdjustment;
    
    // Garantir que o score fique entre 0 e 100
    normalizedScore = Math.max(0, Math.min(100, normalizedScore));
    
    const weight = weights[key as keyof typeof weights];
    weightedScore += normalizedScore * weight;
    
    console.log(`${key} Analysis:`, {
      scoreAdjustment: analysis.scoreAdjustment,
      normalizedScore: normalizedScore.toFixed(1),
      weight: weight,
      contribution: (normalizedScore * weight).toFixed(1)
    });
  });

  console.log('Final weighted score:', weightedScore.toFixed(1));

  // === GARANTIR QUE O SCORE ESTÁ ENTRE 0-100 ===
  let finalScore = Math.max(0, Math.min(100, Math.round(weightedScore)));

  // === AJUSTE DO SCORE BASEADO EM CONTRADIÇÕES E PROPORÇÃO DE ALERTAS ===
  // Cada contradição removida indica um problema estrutural que estava sendo mascarado
  // NOVA LÓGICA: Penalização muito mais agressiva baseada na proporção de alertas vs pontos fortes
  
  const totalSignals = redFlags.length + reconciledPositiveSignals.length;
  const alertRatio = totalSignals > 0 ? redFlags.length / totalSignals : 0;
  
  console.log(`📊 Proporção de Alertas: ${redFlags.length} alertas / ${totalSignals} sinais totais = ${(alertRatio * 100).toFixed(1)}%`);
  
  let additionalPenalty = 0;
  
  // PENALIZAÇÃO POR ALTA PROPORÇÃO DE ALERTAS
  if (alertRatio >= 0.85 && redFlags.length >= 6) {
    // 85%+ de alertas com 6+ problemas = Empresa Péssima
    additionalPenalty = 30;
    console.log(`🚨 Empresa Péssima: ${(alertRatio * 100).toFixed(0)}% de alertas (${redFlags.length} problemas) - penalização crítica de -30 pontos`);
  } else if (alertRatio >= 0.75 && redFlags.length >= 5) {
    // 75%+ de alertas com 5+ problemas = empresa fraca
    additionalPenalty = 25;
    console.log(`⚠️ EMPRESA FRACA: ${(alertRatio * 100).toFixed(0)}% de alertas (${redFlags.length} problemas) - penalização severa de -25 pontos`);
  } else if (alertRatio >= 0.65 && redFlags.length >= 4) {
    // 65%+ de alertas com 4+ problemas = empresa problemática
    additionalPenalty = 20;
    console.log(`⚠️ EMPRESA PROBLEMÁTICA: ${(alertRatio * 100).toFixed(0)}% de alertas (${redFlags.length} problemas) - penalização de -20 pontos`);
  } else if (alertRatio >= 0.50 && redFlags.length >= 3) {
    // 50%+ de alertas com 3+ problemas = empresa mediana com problemas
    additionalPenalty = 15;
    console.log(`⚠️ PROBLEMAS SIGNIFICATIVOS: ${(alertRatio * 100).toFixed(0)}% de alertas (${redFlags.length} problemas) - penalização de -15 pontos`);
  }
  
  // PENALIZAÇÃO POR CONTRADIÇÕES REMOVIDAS
  if (contradictionsRemoved > 0) {
    let contradictionPenalty = 0;
    
    if (contradictionsRemoved >= 5) {
      // 5+ contradições: empresa com sérios problemas estruturais mascarados
      contradictionPenalty = 20;
      console.log(`⚠️ PENALIZAÇÃO SEVERA: ${contradictionsRemoved} contradições removidas indicam problemas graves mascarados`);
    } else if (contradictionsRemoved >= 3) {
      // 3-4 contradições: problemas significativos
      contradictionPenalty = 15;
      console.log(`⚠️ PENALIZAÇÃO MODERADA: ${contradictionsRemoved} contradições removidas`);
    } else if (contradictionsRemoved >= 1) {
      // 1-2 contradições: problemas menores
      contradictionPenalty = 10;
      console.log(`⚠️ PENALIZAÇÃO LEVE: ${contradictionsRemoved} contradições removidas`);
    }
    
    additionalPenalty += contradictionPenalty;
  }
  
  // APLICAR PENALIZAÇÃO TOTAL
  if (additionalPenalty > 0) {
    finalScore = Math.max(0, finalScore - additionalPenalty);
    console.log(`Score ajustado após análise de proporção: ${finalScore} (penalização total: -${additionalPenalty} pontos)`);
  }

  // === PENALIZAÇÕES CRÍTICAS DIRETAS ===
  // Aplicar penalizações mínimas garantidas para problemas críticos
  const incomeCompositionAnalysis = analyses.incomeComposition;
  if (incomeCompositionAnalysis.scoreAdjustment <= -300) {
    // Dependência excessiva de resultados não operacionais - penalização mínima de 25 pontos
    finalScore = Math.max(0, finalScore - 25);
    console.log('Aplicada penalização crítica: -25 pontos por dependência excessiva de resultados não operacionais');
  } else if (incomeCompositionAnalysis.scoreAdjustment <= -50) {
    // Qualidade dos lucros questionável - penalização mínima de 15 pontos
    finalScore = Math.max(0, finalScore - 15);
    console.log('Aplicada penalização moderada: -15 pontos por qualidade dos lucros questionável');
  }

  // === DETERMINAR FORÇA DA EMPRESA BASEADA NAS MÉDIAS ===
  const companyStrength = assessCompanyStrengthFromAverages(averageMetrics, benchmarks, sectorContext);
  console.log('Company Strength:', companyStrength);

  // === VERIFICAÇÃO DE PROBLEMAS CRÍTICOS COMBINADOS ===
  // Certas combinações de problemas são tão graves que o score deve ser limitado
  const hasCriticalDebt = redFlags.some(flag => flag.includes('Endividamento muito alto') || flag.includes('Endividamento crítico'));
  const hasFallingProfits = redFlags.some(flag => flag.includes('Lucros em queda'));
  const hasLowProfitability = redFlags.some(flag => flag.includes('Rentabilidade baixa'));
  const hasLowMargins = redFlags.some(flag => flag.includes('Margem de lucro baixa'));
  const hasUnstableProfits = redFlags.some(flag => flag.includes('Lucratividade instável'));
  
  // Combinação CRÍTICA 1: Endividamento alto + Lucros em queda + Rentabilidade baixa
  if (hasCriticalDebt && hasFallingProfits && hasLowProfitability) {
    if (finalScore > 40) {
      console.log(`🚨 LIMITAÇÃO DE SCORE: Combinação crítica detectada (endividamento + lucros em queda + baixa rentabilidade)`);
      console.log(`   Score limitado de ${finalScore} para 40`);
      finalScore = 40;
    }
  }
  
  // Combinação CRÍTICA 2: Margens baixas + Lucros em queda + Instabilidade
  if (hasLowMargins && hasFallingProfits && hasUnstableProfits) {
    if (finalScore > 45) {
      console.log(`🚨 LIMITAÇÃO DE SCORE: Combinação crítica detectada (margens baixas + lucros em queda + instabilidade)`);
      console.log(`   Score limitado de ${finalScore} para 45`);
      finalScore = 45;
    }
  }
  
  // Se tem 6+ alertas, score máximo deve ser 50
  if (redFlags.length >= 6 && finalScore > 50) {
    console.log(`🚨 LIMITAÇÃO DE SCORE: ${redFlags.length} alertas graves - score máximo permitido: 50`);
    console.log(`   Score limitado de ${finalScore} para 50`);
    finalScore = 50;
  }
  
  // Se tem 8+ alertas, score máximo deve ser 35
  if (redFlags.length >= 8 && finalScore > 35) {
    console.log(`🚨 LIMITAÇÃO DE SCORE: ${redFlags.length} alertas graves - score máximo permitido: 35`);
    console.log(`   Score limitado de ${finalScore} para 35`);
    finalScore = 35;
  }

  // === DETERMINAR NÍVEL DE RISCO BASEADO NO SCORE FINAL ===
  let riskLevel: StatementsAnalysis['riskLevel'] = 'LOW';
  const criticalFlags = redFlags.filter(flag => 
    flag.includes('crítico') || flag.includes('grave') || flag.includes('insolvência')
  ).length;
  
  if (finalScore < 30 || criticalFlags >= 3) {
    riskLevel = 'CRITICAL';
  } else if (finalScore < 50 || criticalFlags >= 2) {
    riskLevel = 'HIGH';
  } else if (finalScore < 70 || redFlags.length >= 4) {
    riskLevel = 'MEDIUM';
  }

  console.log('Final analysis result:', {
    finalScore,
    riskLevel,
    companyStrength,
    redFlagsCount: redFlags.length,
    positiveSignalsCount: positiveSignals.length,
    reconciledPositiveSignalsCount: reconciledPositiveSignals.length,
    contradictionsRemoved: contradictionsRemoved,
    scoreAdjustment: contradictionsRemoved > 0 ? `Penalizado por ${contradictionsRemoved} contradições` : 'Nenhuma contradição'
  });

  return {
    score: finalScore,
    redFlags: redFlags.filter(Boolean).slice(0, 8), // Máximo 8 red flags mais relevantes
    positiveSignals: reconciledPositiveSignals.filter(Boolean).slice(0, 6), // Máximo 6 sinais positivos (após reconciliação)
    riskLevel,
    companyStrength,
    contextualFactors: contextualFactors.filter(Boolean).slice(0, 3)
  };
}

// === INTERFACES E TIPOS PARA NOVA ANÁLISE ===

interface AverageMetrics {
  // Rentabilidade
  roe: number;
  roa: number;
  netMargin: number;
  grossMargin: number;
  operatingMargin: number;
  
  // Liquidez
  currentRatio: number;
  quickRatio: number;
  cashRatio: number;
  workingCapitalRatio: number;
  
  // Eficiência
  assetTurnover: number;
  receivablesTurnover: number;
  inventoryTurnover: number;
  
  // Endividamento e Cobertura
  debtToEquity: number;
  debtToAssets: number;
  interestCoverage: number;
  
  // Crescimento
  revenueGrowth: number;
  netIncomeGrowth: number;
  
  // Fluxo de Caixa
  operatingCashFlowMargin: number;
  freeCashFlowMargin: number;
  cashConversionRatio: number;
  
  // Estabilidade
  revenueStability: number;
  marginStability: number;
  cashFlowStability: number;
}

interface SectorBenchmarks {
  // Rentabilidade mínima esperada
  minROE: number;
  goodROE: number;
  excellentROE: number;
  
  minROA: number;
  goodROA: number;
  
  minNetMargin: number;
  goodNetMargin: number;
  
  // Liquidez
  minCurrentRatio: number;
  goodCurrentRatio: number;
  
  // Endividamento máximo aceitável
  maxDebtToEquity: number;
  maxDebtToAssets: number;
  
  // Crescimento esperado
  minRevenueGrowth: number;
  goodRevenueGrowth: number;
}

// === FUNÇÃO PARA CALCULAR MÉDIAS DOS INDICADORES ===
function calculateAverageMetrics(
  data: {
    income: Record<string, unknown>[];
    balance: Record<string, unknown>[];
    cashflow: Record<string, unknown>[];
  },
  fallbackData?: FinancialStatementsData['financialDataFallback'],
  ticker?: string,
  dataValidation?: DataValidation
): AverageMetrics {
  const { income, balance, cashflow } = data;
  const periods = Math.min(income.length, balance.length, cashflow.length);
  
  if (periods === 0) {
    // Retornar métricas neutras se não houver dados
    return {
      roe: 0, roa: 0, netMargin: 0, grossMargin: 0, operatingMargin: 0,
      currentRatio: 1, quickRatio: 1, cashRatio: 0.1, workingCapitalRatio: 0.2,
      assetTurnover: 1, receivablesTurnover: 4, inventoryTurnover: 4,
      debtToEquity: 0.5, debtToAssets: 0.3, interestCoverage: 5,
      revenueGrowth: 0, netIncomeGrowth: 0,
      operatingCashFlowMargin: 0.1, freeCashFlowMargin: 0.05, cashConversionRatio: 1,
      revenueStability: 0.5, marginStability: 0.5, cashFlowStability: 0.5
    };
  }

  // Calcular médias dos indicadores
  const metrics: AverageMetrics = {
    roe: 0, roa: 0, netMargin: 0, grossMargin: 0, operatingMargin: 0,
    currentRatio: 0, quickRatio: 0, cashRatio: 0, workingCapitalRatio: 0,
    assetTurnover: 0, receivablesTurnover: 0, inventoryTurnover: 0,
    debtToEquity: 0, debtToAssets: 0, interestCoverage: 0,
    revenueGrowth: 0, netIncomeGrowth: 0,
    operatingCashFlowMargin: 0, freeCashFlowMargin: 0, cashConversionRatio: 0,
    revenueStability: 0, marginStability: 0, cashFlowStability: 0
  };

  let validPeriods = 0;
  
  for (let i = 0; i < periods; i++) {
    const incomeStmt = income[i];
    const balanceStmt = balance[i];
    const cashflowStmt = cashflow[i];
    
    // Extrair valores básicos
    const revenue = toNumber(incomeStmt.totalRevenue) || toNumber(incomeStmt.operatingIncome) || 0;
    const netIncome = toNumber(incomeStmt.netIncome) || 0;
    const grossProfit = toNumber(incomeStmt.grossProfit) || 0;
    const operatingIncome = toNumber(incomeStmt.operatingIncome) || 0;
    const totalOperatingExpenses = toNumber(incomeStmt.totalOperatingExpenses) || 0;
    
    const totalAssets = toNumber(balanceStmt.totalAssets) || 1;
    const totalEquity = toNumber(balanceStmt.totalStockholderEquity) || 1;
    const currentAssets = toNumber(balanceStmt.totalCurrentAssets) || 0;
    const currentLiabilities = toNumber(balanceStmt.totalCurrentLiabilities) || 1;
    const cash = toNumber(balanceStmt.cash) || 0;
    const totalDebt = toNumber(balanceStmt.totalLiab) || 0;
    const inventory = toNumber(balanceStmt.inventory) || 0;
    const receivables = toNumber(balanceStmt.accountsReceivable) || 0;
    
    // Dados de fluxo de caixa
    const operatingCashFlow = toNumber(cashflowStmt.operatingCashFlow) || 0;
    const capex = toNumber(cashflowStmt.capitalExpenditures) || 0;
    const freeCashFlow = operatingCashFlow - Math.abs(capex);
    
    // Dados de DRE adicionais
    const interestExpense = toNumber(incomeStmt.interestExpense) || 0;
    const ebit = toNumber(incomeStmt.ebit) || 0;
    
    // Verificações de sanidade para evitar valores extremos
    const isValidEquity = totalEquity > 0 && Math.abs(totalEquity) > totalAssets * 0.001; // PL deve ser pelo menos 0.1% dos ativos
    const isValidAssets = totalAssets > 0;
    const isValidRevenue = revenue > 0;
    const isValidLiabilities = currentLiabilities > 0 && currentLiabilities < totalAssets * 10; // Passivos não podem ser 10x os ativos
    
    if (isValidRevenue && isValidAssets) {
      // Rentabilidade - só calcular se temos patrimônio líquido válido
      if (isValidEquity) {
        const roe = netIncome / totalEquity;
        const roa = netIncome / totalAssets;
        
        // Verificações de sanidade para ROE e ROA (valores extremos indicam dados problemáticos)
        if (Math.abs(roe) <= 10) { // ROE não deve exceder 1000% (10 em decimal)
          metrics.roe += roe;
        } else {
          console.warn(`ROE extremo detectado: ${(roe * 100).toFixed(1)}% - ignorando para evitar distorção`);
          // Usar ROA como proxy se disponível
          if (Math.abs(roa) <= 1) {
            metrics.roe += roa; // ROA como fallback conservador
          }
        }
        
        if (Math.abs(roa) <= 1) { // ROA não deve exceder 100%
          metrics.roa += roa;
        } else {
          console.warn(`ROA extremo detectado: ${(roa * 100).toFixed(1)}% - ignorando para evitar distorção`);
        }
      } else {
        console.warn(`Patrimônio líquido inválido: ${totalEquity} - pulando cálculos de rentabilidade`);
        // Para empresas com PL problemático, usar valores neutros
        metrics.roe += 0;
        metrics.roa += 0;
      }
      
      // Margens - sempre calcular se temos receita válida
      const netMargin = (revenue > 0 && !isNaN(netIncome) && !isNaN(revenue)) ? netIncome / revenue : 0;
      const grossMargin = (revenue > 0 && !isNaN(grossProfit) && !isNaN(revenue)) ? grossProfit / revenue : 0;
      
      // Só somar se conseguimos calcular uma margem válida
      if (revenue > 0 && !isNaN(netMargin) && Math.abs(netMargin) <= 2) { // Margem não deve exceder 200%
        metrics.netMargin += netMargin;
      } else if (revenue <= 0) {
        console.warn(`Receita inválida para cálculo de margem: ${revenue} - não calculando margem para este período`);
      } else if (Math.abs(netMargin) > 2) {
        console.warn(`Margem líquida extrema detectada: ${(netMargin * 100).toFixed(1)}% - ignorando`);
      }
      
      if (Math.abs(grossMargin) <= 2) { // Margem bruta não deve exceder 200%
        metrics.grossMargin += grossMargin;
      } else {
        console.warn(`Margem bruta extrema detectada: ${(grossMargin * 100).toFixed(1)}% - ignorando`);
      }
      
      // Calcular margem operacional corretamente
      let operatingProfit = ebit;
      if (!operatingProfit && grossProfit > 0 && totalOperatingExpenses > 0) {
        operatingProfit = grossProfit - totalOperatingExpenses;
      } else if (!operatingProfit) {
        operatingProfit = operatingIncome; // Fallback
      }
      
      const operatingMargin = operatingProfit / revenue;
      if (Math.abs(operatingMargin) <= 2) { // Margem operacional não deve exceder 200%
        metrics.operatingMargin += operatingMargin;
      } else {
        console.warn(`Margem operacional extrema detectada: ${(operatingMargin * 100).toFixed(1)}% - ignorando`);
      }
      
      // Liquidez - só calcular se temos passivos válidos
      if (isValidLiabilities) {
        const currentRatio = currentAssets / currentLiabilities;
        const quickRatio = (currentAssets - inventory) / currentLiabilities;
        const cashRatio = cash / currentLiabilities;
        
        if (currentRatio <= 1000) { // Current ratio não deve exceder 1000x
          metrics.currentRatio += currentRatio;
        } else {
          console.warn(`Current ratio extremo detectado: ${currentRatio.toFixed(1)}x - ignorando`);
          metrics.currentRatio += 1; // Valor neutro
        }
        
        if (quickRatio <= 1000) {
          metrics.quickRatio += quickRatio;
        } else {
          console.warn(`Quick ratio extremo detectado: ${quickRatio.toFixed(1)}x - ignorando`);
          metrics.quickRatio += 0.8; // Valor neutro
        }
        
        if (cashRatio <= 100) {
          metrics.cashRatio += cashRatio;
        } else {
          console.warn(`Cash ratio extremo detectado: ${cashRatio.toFixed(1)}x - ignorando`);
          metrics.cashRatio += 0.1; // Valor neutro
        }
      } else {
        // Passivos inválidos - usar valores neutros
        metrics.currentRatio += 1.2;
        metrics.quickRatio += 0.8;
        metrics.cashRatio += 0.1;
      }
      
      metrics.workingCapitalRatio += ((currentAssets - currentLiabilities) / totalAssets);
      
      // Eficiência
      const assetTurnover = revenue / totalAssets;
      if (assetTurnover <= 20) { // Asset turnover não deve exceder 20x
        metrics.assetTurnover += assetTurnover;
      } else {
        console.warn(`Asset turnover extremo detectado: ${assetTurnover.toFixed(1)}x - ignorando`);
        metrics.assetTurnover += 1; // Valor neutro
      }
      
      // Giro de recebíveis (se temos dados)
      if (receivables > 0) {
        const receivablesTurnover = revenue / receivables;
        if (receivablesTurnover <= 365) { // Não deve exceder 365x (1 dia)
          metrics.receivablesTurnover += receivablesTurnover;
        } else {
          console.warn(`Receivables turnover extremo detectado: ${receivablesTurnover.toFixed(1)}x - usando valor neutro`);
          metrics.receivablesTurnover += 6; // Valor neutro (60 dias)
        }
      } else {
        metrics.receivablesTurnover += 6; // Valor neutro (60 dias)
      }
      
      // Giro de estoque (se temos dados e não é empresa de serviços)
      if (inventory > 0) {
        const cogs = toNumber(incomeStmt.costOfRevenue) || (revenue - grossProfit);
        if (cogs > 0) {
          const inventoryTurnover = cogs / inventory;
          if (inventoryTurnover <= 365) { // Não deve exceder 365x (1 dia)
            metrics.inventoryTurnover += inventoryTurnover;
          } else {
            console.warn(`Inventory turnover extremo detectado: ${inventoryTurnover.toFixed(1)}x - usando valor neutro`);
            metrics.inventoryTurnover += 4; // Valor neutro
          }
        } else {
          metrics.inventoryTurnover += 4; // Valor neutro
        }
      } else {
        metrics.inventoryTurnover += 12; // Empresas de serviço (sem estoque)
      }
      
      // Endividamento e cobertura - só calcular se temos patrimônio válido
      if (isValidEquity) {
        const debtToEquity = totalDebt / totalEquity;
        const debtToAssets = totalDebt / totalAssets;
        
        if (debtToEquity <= 100) { // Debt-to-equity não deve exceder 100x
          metrics.debtToEquity += debtToEquity;
        } else {
          console.warn(`Debt-to-equity extremo detectado: ${debtToEquity.toFixed(1)}x - usando debt-to-assets como proxy`);
          // Usar debt-to-assets como proxy mais conservador
          metrics.debtToEquity += Math.min(debtToAssets * 2, 10); // Máximo 10x
        }
        
        if (debtToAssets <= 10) { // Debt-to-assets não deve exceder 10x
          metrics.debtToAssets += debtToAssets;
        } else {
          console.warn(`Debt-to-assets extremo detectado: ${debtToAssets.toFixed(1)}x - usando valor máximo`);
          metrics.debtToAssets += 2; // Valor alto mas não extremo
        }
      } else {
        // PL inválido - usar valores conservadores baseados apenas em dívida/ativos
        const debtToAssets = totalDebt / totalAssets;
        metrics.debtToEquity += Math.min(debtToAssets * 3, 5); // Estimativa conservadora
        metrics.debtToAssets += Math.min(debtToAssets, 2);
      }
      
      // Cobertura de juros - tratamento especial para bancos
      const isLikelyBank = dataValidation?.isBankOrFinancial || 
        (ticker && ['BBSE3', 'SULA11', 'PSSA3', 'BBAS3', 'ITUB4', 'SANB11', 'BPAC11', 'BRSR6', 'PINE4', 'WIZS3', 'ABCB4', 'BPAN4', 'BBDC3', 'BBDC4'].includes(ticker.toUpperCase()));
      
      // Debug para bancos específicos
      if (ticker && ['BBSE3', 'ITUB4', 'BBAS3'].includes(ticker.toUpperCase())) {
        console.log(`🏦 DEBUG COBERTURA JUROS ${ticker}:`, {
          isLikelyBank,
          netIncome,
          interestExpense,
          ebit,
          period: i
        });
      }
      
      if (isLikelyBank) {
        // Para bancos, usar lucro líquido ao invés de EBIT para cobertura de juros
        if (interestExpense > 0 && netIncome > 0) {
          const interestCoverage = netIncome / interestExpense;
          if (interestCoverage <= 100) { // Limite mais baixo para bancos
            metrics.interestCoverage += Math.max(interestCoverage, 0.1); // Mínimo de 0.1
          } else {
            metrics.interestCoverage += 20; // Valor alto para bancos
          }
        } else if (netIncome > 0) {
          // Banco com lucro mas sem despesa de juros significativa
          metrics.interestCoverage += 15; // Valor bom para bancos
        } else {
          // Banco com prejuízo ou sem dados válidos
          metrics.interestCoverage += 1; // Valor baixo mas não zero
        }
      } else {
        // Lógica tradicional para empresas não-financeiras
        if (interestExpense > 0 && ebit > 0) {
          const interestCoverage = ebit / interestExpense;
          if (interestCoverage <= 1000) { // Cobertura não deve exceder 1000x
            metrics.interestCoverage += interestCoverage;
          } else {
            console.warn(`Interest coverage extremo detectado: ${interestCoverage.toFixed(1)}x - usando valor máximo`);
            metrics.interestCoverage += 50; // Valor alto mas não extremo
          }
        } else {
          metrics.interestCoverage += 10; // Valor neutro para empresas sem dívida significativa
        }
      }
      
      // Fluxo de caixa
      const operatingCashFlowMargin = operatingCashFlow / revenue;
      const freeCashFlowMargin = freeCashFlow / revenue;
      
      if (Math.abs(operatingCashFlowMargin) <= 5) { // Margem de FCO não deve exceder 500%
        metrics.operatingCashFlowMargin += operatingCashFlowMargin;
      } else {
        console.warn(`Operating cash flow margin extrema detectada: ${(operatingCashFlowMargin * 100).toFixed(1)}% - ignorando`);
        metrics.operatingCashFlowMargin += 0.1; // Valor neutro
      }
      
      if (Math.abs(freeCashFlowMargin) <= 5) { // Margem de FCL não deve exceder 500%
        metrics.freeCashFlowMargin += freeCashFlowMargin;
      } else {
        console.warn(`Free cash flow margin extrema detectada: ${(freeCashFlowMargin * 100).toFixed(1)}% - ignorando`);
        metrics.freeCashFlowMargin += 0.05; // Valor neutro
      }
      
      // Conversão lucro → caixa
      if (netIncome > 0) {
        const cashConversionRatio = operatingCashFlow / netIncome;
        if (Math.abs(cashConversionRatio) <= 20) { // Conversão não deve exceder 20x
          metrics.cashConversionRatio += cashConversionRatio;
        } else {
          console.warn(`Cash conversion ratio extremo detectado: ${cashConversionRatio.toFixed(1)}x - usando valor neutro`);
          metrics.cashConversionRatio += 1; // Neutro
        }
      } else {
        metrics.cashConversionRatio += 1; // Neutro
      }
      
      validPeriods++;
    }
  }
  
  // Calcular médias
  if (validPeriods > 0) {
    const excludeFromAverage = ['revenueGrowth', 'netIncomeGrowth', 'revenueStability', 'marginStability', 'cashFlowStability'];
    Object.keys(metrics).forEach(key => {
      if (!excludeFromAverage.includes(key)) {
        (metrics as any)[key] = (metrics as any)[key] / validPeriods;
      }
    });
  }
  
  // Calcular crescimento e estabilidade
  if (periods >= 2) {
    const revenues = income.slice(0, periods).map(stmt => 
      toNumber(stmt.totalRevenue) || toNumber(stmt.operatingIncome) || 0
    );
    const netIncomes = income.slice(0, periods).map(stmt => 
      toNumber(stmt.netIncome) || 0
    );
    
    metrics.revenueGrowth = calculateCAGR(revenues);
    metrics.netIncomeGrowth = calculateCAGR(netIncomes);
    metrics.revenueStability = calculateStability(revenues);
    metrics.marginStability = calculateStability(
      income.slice(0, periods).map((stmt, idx) => {
        const rev = revenues[idx];
        const net = netIncomes[idx];
        return rev > 0 ? net / rev : 0;
      })
    );
  }
  
  // === APLICAR FALLBACK QUANDO NECESSÁRIO ===
  if (fallbackData) {
    const fallbackMetrics = calculateFallbackMetrics(fallbackData);
    let fallbacksApplied = 0;
    
    // Aplicar fallback para indicadores críticos que ficaram zerados ou inválidos
    if ((metrics.roe === 0 || isNaN(metrics.roe)) && fallbackMetrics.roe !== undefined) {
      console.log(`Aplicando fallback para ROE: ${metrics.roe} → ${fallbackMetrics.roe}`);
      metrics.roe = fallbackMetrics.roe;
      fallbacksApplied++;
    }
    
    if ((metrics.roa === 0 || isNaN(metrics.roa)) && fallbackMetrics.roa !== undefined) {
      console.log(`Aplicando fallback para ROA: ${metrics.roa} → ${fallbackMetrics.roa}`);
      metrics.roa = fallbackMetrics.roa;
      fallbacksApplied++;
    }
    
    if ((metrics.netMargin === 0 || isNaN(metrics.netMargin)) && fallbackMetrics.netMargin !== undefined) {
      console.log(`Aplicando fallback para Net Margin: ${metrics.netMargin} → ${fallbackMetrics.netMargin}`);
      metrics.netMargin = fallbackMetrics.netMargin;
      fallbacksApplied++;
    }
    
    if ((metrics.grossMargin === 0 || isNaN(metrics.grossMargin)) && fallbackMetrics.grossMargin !== undefined) {
      console.log(`Aplicando fallback para Gross Margin: ${metrics.grossMargin} → ${fallbackMetrics.grossMargin}`);
      metrics.grossMargin = fallbackMetrics.grossMargin;
      fallbacksApplied++;
    }
    
    if ((metrics.operatingMargin === 0 || isNaN(metrics.operatingMargin)) && fallbackMetrics.operatingMargin !== undefined) {
      console.log(`Aplicando fallback para Operating Margin: ${metrics.operatingMargin} → ${fallbackMetrics.operatingMargin}`);
      metrics.operatingMargin = fallbackMetrics.operatingMargin;
      fallbacksApplied++;
    }
    
    if ((metrics.currentRatio === 0 || isNaN(metrics.currentRatio)) && fallbackMetrics.currentRatio !== undefined) {
      console.log(`Aplicando fallback para Current Ratio: ${metrics.currentRatio} → ${fallbackMetrics.currentRatio}`);
      metrics.currentRatio = fallbackMetrics.currentRatio;
      fallbacksApplied++;
    }
    
    if ((metrics.quickRatio === 0 || isNaN(metrics.quickRatio)) && fallbackMetrics.quickRatio !== undefined) {
      console.log(`Aplicando fallback para Quick Ratio: ${metrics.quickRatio} → ${fallbackMetrics.quickRatio}`);
      metrics.quickRatio = fallbackMetrics.quickRatio;
      fallbacksApplied++;
    }
    
    if ((metrics.debtToEquity === 0 || isNaN(metrics.debtToEquity)) && fallbackMetrics.debtToEquity !== undefined) {
      console.log(`Aplicando fallback para Debt-to-Equity: ${metrics.debtToEquity} → ${fallbackMetrics.debtToEquity}`);
      metrics.debtToEquity = fallbackMetrics.debtToEquity;
      fallbacksApplied++;
    }
    
    if ((metrics.assetTurnover === 0 || isNaN(metrics.assetTurnover)) && fallbackMetrics.assetTurnover !== undefined) {
      console.log(`Aplicando fallback para Asset Turnover: ${metrics.assetTurnover} → ${fallbackMetrics.assetTurnover}`);
      metrics.assetTurnover = fallbackMetrics.assetTurnover;
      fallbacksApplied++;
    }
    
    // Aplicar fallback para crescimento se não conseguimos calcular
    if ((metrics.revenueGrowth === 0 || isNaN(metrics.revenueGrowth)) && fallbackMetrics.revenueGrowth !== undefined) {
      console.log(`Aplicando fallback para Revenue Growth: ${metrics.revenueGrowth} → ${fallbackMetrics.revenueGrowth}`);
      metrics.revenueGrowth = fallbackMetrics.revenueGrowth;
      fallbacksApplied++;
    }
    
    if ((metrics.netIncomeGrowth === 0 || isNaN(metrics.netIncomeGrowth)) && fallbackMetrics.netIncomeGrowth !== undefined) {
      console.log(`Aplicando fallback para Net Income Growth: ${metrics.netIncomeGrowth} → ${fallbackMetrics.netIncomeGrowth}`);
      metrics.netIncomeGrowth = fallbackMetrics.netIncomeGrowth;
      fallbacksApplied++;
    }
    
    // Aplicar outros fallbacks se disponíveis
    Object.keys(fallbackMetrics).forEach(key => {
      const fallbackValue = (fallbackMetrics as any)[key];
      const currentValue = (metrics as any)[key];
      
      if (fallbackValue !== undefined && (currentValue === 0 || isNaN(currentValue) || currentValue === undefined)) {
        console.log(`Aplicando fallback adicional para ${key}: ${currentValue} → ${fallbackValue}`);
        (metrics as any)[key] = fallbackValue;
        fallbacksApplied++;
      }
    });
    
    if (fallbacksApplied > 0) {
      console.log(`Total de ${fallbacksApplied} fallbacks aplicados usando dados do financial_data`);
    }
  }
  
  return metrics;
}

// === FUNÇÃO PARA OBTER BENCHMARKS SETORIAIS ===
function getSectorBenchmarks(sectorContext: SectorContext, sizeContext: SizeContext): SectorBenchmarks {
  // Benchmarks base (conservadores)
  const benchmarks: SectorBenchmarks = {
    minROE: 0.08, goodROE: 0.15, excellentROE: 0.25,
    minROA: 0.03, goodROA: 0.08,
    minNetMargin: 0.05, goodNetMargin: 0.10,
    minCurrentRatio: 1.0, goodCurrentRatio: 1.5,
    maxDebtToEquity: 2.0, maxDebtToAssets: 0.6,
    minRevenueGrowth: 0.03, goodRevenueGrowth: 0.10
  };
  
  // Ajustar por setor
  if (sectorContext.type === 'FINANCIAL') {
    // Benchmarks específicos para bancos e seguradoras
    benchmarks.minROE = 0.08;      // ROE mínimo para bancos
    benchmarks.goodROE = 0.15;     // ROE bom para bancos
    benchmarks.excellentROE = 0.20; // ROE excelente para bancos
    benchmarks.minROA = 0.008;     // ROA mínimo para bancos (0.8%)
    benchmarks.goodROA = 0.015;    // ROA bom para bancos (1.5%)
    benchmarks.minNetMargin = 0.10; // Margem mínima para bancos (10%)
    benchmarks.goodNetMargin = 0.25; // Margem boa para bancos (25%)
    benchmarks.maxDebtToEquity = 15.0; // Bancos têm alta alavancagem natural
    benchmarks.maxDebtToAssets = 0.9;  // Bancos podem ter até 90% de alavancagem
    benchmarks.minCurrentRatio = 0.1;  // Liquidez corrente não se aplica da mesma forma
    benchmarks.goodCurrentRatio = 0.3; // Para bancos, liquidez é diferente
  } else if (sectorContext.marginExpectation === 'HIGH') {
    benchmarks.minNetMargin = 0.10;
    benchmarks.goodNetMargin = 0.20;
    benchmarks.minROE = 0.12;
    benchmarks.goodROE = 0.20;
  } else if (sectorContext.marginExpectation === 'LOW') {
    benchmarks.minNetMargin = 0.02;
    benchmarks.goodNetMargin = 0.05;
    benchmarks.minROE = 0.05;
    benchmarks.goodROE = 0.10;
    benchmarks.maxDebtToEquity = 3.0; // Setores de baixa margem podem ter mais dívida
  }
  
  // Ajustar por tamanho
  if (sizeContext.category === 'LARGE' || sizeContext.category === 'MEGA') {
    benchmarks.minRevenueGrowth = 0.02; // Grandes empresas crescem menos
    benchmarks.goodRevenueGrowth = 0.07;
  } else if (sizeContext.category === 'SMALL' || sizeContext.category === 'MICRO') {
    benchmarks.minRevenueGrowth = 0.05; // Pequenas empresas devem crescer mais
    benchmarks.goodRevenueGrowth = 0.15;
  }
  
  return benchmarks;
}

// === FUNÇÕES AUXILIARES PARA CÁLCULOS ===

// Função para calcular médias usando dados do financial_data como fallback
function calculateFallbackMetrics(fallbackData?: FinancialStatementsData['financialDataFallback']): Partial<AverageMetrics> {
  if (!fallbackData || !fallbackData.years || fallbackData.years.length === 0) {
    return {};
  }

  const metrics: Partial<AverageMetrics> = {};
  
  // Função auxiliar para calcular média de um array de valores
  const calculateAverage = (values: (number | null | undefined)[]): number | undefined => {
    const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v as number)) as number[];
    if (validValues.length === 0) return undefined;
    return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  };

  // Se temos dados de múltiplos anos, assumimos que são arrays
  // Se não, assumimos que é um valor único (compatibilidade)
  const isArrayData = Array.isArray(fallbackData.roe);
  
  if (isArrayData) {
    // Calcular médias dos arrays de dados históricos
    if (fallbackData.roe && Array.isArray(fallbackData.roe)) {
      const avgRoe = calculateAverage(fallbackData.roe);
      if (avgRoe !== undefined) metrics.roe = avgRoe;
    }
    
    if (fallbackData.roa && Array.isArray(fallbackData.roa)) {
      const avgRoa = calculateAverage(fallbackData.roa);
      if (avgRoa !== undefined) metrics.roa = avgRoa;
    }
    
    if (fallbackData.margemLiquida && Array.isArray(fallbackData.margemLiquida)) {
      const avgNetMargin = calculateAverage(fallbackData.margemLiquida);
      if (avgNetMargin !== undefined) metrics.netMargin = avgNetMargin;
    }
    
    if (fallbackData.margemBruta && Array.isArray(fallbackData.margemBruta)) {
      const avgGrossMargin = calculateAverage(fallbackData.margemBruta);
      if (avgGrossMargin !== undefined) metrics.grossMargin = avgGrossMargin;
    }
    
    if (fallbackData.margemEbitda && Array.isArray(fallbackData.margemEbitda)) {
      const avgOperatingMargin = calculateAverage(fallbackData.margemEbitda);
      if (avgOperatingMargin !== undefined) metrics.operatingMargin = avgOperatingMargin;
    }
    
    if (fallbackData.liquidezCorrente && Array.isArray(fallbackData.liquidezCorrente)) {
      const avgCurrentRatio = calculateAverage(fallbackData.liquidezCorrente);
      if (avgCurrentRatio !== undefined) metrics.currentRatio = avgCurrentRatio;
    }
    
    if (fallbackData.liquidezRapida && Array.isArray(fallbackData.liquidezRapida)) {
      const avgQuickRatio = calculateAverage(fallbackData.liquidezRapida);
      if (avgQuickRatio !== undefined) metrics.quickRatio = avgQuickRatio;
    }
    
    if (fallbackData.debtToEquity && Array.isArray(fallbackData.debtToEquity)) {
      const avgDebtToEquity = calculateAverage(fallbackData.debtToEquity);
      if (avgDebtToEquity !== undefined) metrics.debtToEquity = avgDebtToEquity;
    } else if (fallbackData.dividaLiquidaPl && Array.isArray(fallbackData.dividaLiquidaPl)) {
      const avgDebtToEquity = calculateAverage(fallbackData.dividaLiquidaPl);
      if (avgDebtToEquity !== undefined) metrics.debtToEquity = avgDebtToEquity;
    }
    
    if (fallbackData.giroAtivos && Array.isArray(fallbackData.giroAtivos)) {
      const avgAssetTurnover = calculateAverage(fallbackData.giroAtivos);
      if (avgAssetTurnover !== undefined) metrics.assetTurnover = avgAssetTurnover;
    }
    
    // Para crescimento, usar CAGR se disponível, senão média do crescimento anual
    if (fallbackData.cagrReceitas5a !== null && fallbackData.cagrReceitas5a !== undefined) {
      metrics.revenueGrowth = fallbackData.cagrReceitas5a;
    } else if (fallbackData.crescimentoReceitas && Array.isArray(fallbackData.crescimentoReceitas)) {
      const avgRevenueGrowth = calculateAverage(fallbackData.crescimentoReceitas);
      if (avgRevenueGrowth !== undefined) metrics.revenueGrowth = avgRevenueGrowth;
    }
    
    if (fallbackData.cagrLucros5a !== null && fallbackData.cagrLucros5a !== undefined) {
      metrics.netIncomeGrowth = fallbackData.cagrLucros5a;
    } else if (fallbackData.crescimentoLucros && Array.isArray(fallbackData.crescimentoLucros)) {
      const avgNetIncomeGrowth = calculateAverage(fallbackData.crescimentoLucros);
      if (avgNetIncomeGrowth !== undefined) metrics.netIncomeGrowth = avgNetIncomeGrowth;
    }
    
  } else {
    // Compatibilidade com dados únicos (não arrays)
    if (fallbackData.roe !== null && fallbackData.roe !== undefined && typeof fallbackData.roe === 'number') {
      metrics.roe = fallbackData.roe;
    }
    
    if (fallbackData.roa !== null && fallbackData.roa !== undefined && typeof fallbackData.roa === 'number') {
      metrics.roa = fallbackData.roa;
    }
    
    if (fallbackData.margemLiquida !== null && fallbackData.margemLiquida !== undefined && typeof fallbackData.margemLiquida === 'number') {
      metrics.netMargin = fallbackData.margemLiquida;
    }
    
    if (fallbackData.margemBruta !== null && fallbackData.margemBruta !== undefined && typeof fallbackData.margemBruta === 'number') {
      metrics.grossMargin = fallbackData.margemBruta;
    }
    
    if (fallbackData.margemEbitda !== null && fallbackData.margemEbitda !== undefined && typeof fallbackData.margemEbitda === 'number') {
      metrics.operatingMargin = fallbackData.margemEbitda;
    }
    
    if (fallbackData.liquidezCorrente !== null && fallbackData.liquidezCorrente !== undefined && typeof fallbackData.liquidezCorrente === 'number') {
      metrics.currentRatio = fallbackData.liquidezCorrente;
    }
    
    if (fallbackData.liquidezRapida !== null && fallbackData.liquidezRapida !== undefined && typeof fallbackData.liquidezRapida === 'number') {
      metrics.quickRatio = fallbackData.liquidezRapida;
    }
    
    if (fallbackData.debtToEquity !== null && fallbackData.debtToEquity !== undefined && typeof fallbackData.debtToEquity === 'number') {
      metrics.debtToEquity = fallbackData.debtToEquity;
    } else if (fallbackData.dividaLiquidaPl !== null && fallbackData.dividaLiquidaPl !== undefined && typeof fallbackData.dividaLiquidaPl === 'number') {
      metrics.debtToEquity = fallbackData.dividaLiquidaPl;
    }
    
    if (fallbackData.giroAtivos !== null && fallbackData.giroAtivos !== undefined && typeof fallbackData.giroAtivos === 'number') {
      metrics.assetTurnover = fallbackData.giroAtivos;
    }
    
    if (fallbackData.cagrReceitas5a !== null && fallbackData.cagrReceitas5a !== undefined) {
      metrics.revenueGrowth = fallbackData.cagrReceitas5a;
    } else if (fallbackData.crescimentoReceitas !== null && fallbackData.crescimentoReceitas !== undefined && typeof fallbackData.crescimentoReceitas === 'number') {
      metrics.revenueGrowth = fallbackData.crescimentoReceitas;
    }
    
    if (fallbackData.cagrLucros5a !== null && fallbackData.cagrLucros5a !== undefined) {
      metrics.netIncomeGrowth = fallbackData.cagrLucros5a;
    } else if (fallbackData.crescimentoLucros !== null && fallbackData.crescimentoLucros !== undefined && typeof fallbackData.crescimentoLucros === 'number') {
      metrics.netIncomeGrowth = fallbackData.crescimentoLucros;
    }
  }
  
  // Calcular indicadores derivados apenas se temos dados base válidos
  // Não inventar valores se não conseguimos calcular
  
  console.log('Fallback metrics calculated:', metrics);
  return metrics;
}

// Função para validar se os dados fazem sentido para análise
interface DataValidation {
  hasValidCurrentAssets: boolean;
  hasValidCurrentLiabilities: boolean;
  hasValidInventory: boolean;
  hasValidReceivables: boolean;
  hasValidCash: boolean;
  hasValidTotalAssets: boolean;
  hasValidRevenue: boolean;
  isServiceCompany: boolean; // Empresa de serviços (sem estoque relevante)
  isBankOrFinancial: boolean; // Banco ou financeira (estrutura diferente)
}

function validateFinancialData(
  incomeData: Record<string, unknown>[],
  balanceData: Record<string, unknown>[],
  sectorContext?: SectorContext,
  sector?: string | null,
  industry?: string | null
): DataValidation {
  if (incomeData.length === 0 || balanceData.length === 0) {
    return {
      hasValidCurrentAssets: false,
      hasValidCurrentLiabilities: false,
      hasValidInventory: false,
      hasValidReceivables: false,
      hasValidCash: false,
      hasValidTotalAssets: false,
      hasValidRevenue: false,
      isServiceCompany: false,
      isBankOrFinancial: false
    };
  }

  // Analisar os últimos 3 períodos para determinar padrões
  const periodsToCheck = Math.min(3, incomeData.length, balanceData.length);
  let validCurrentAssets = 0;
  let validCurrentLiabilities = 0;
  let validInventory = 0;
  let validReceivables = 0;
  let validCash = 0;
  let validTotalAssets = 0;
  let validRevenue = 0;

  for (let i = 0; i < periodsToCheck; i++) {
    const income = incomeData[i];
    const balance = balanceData[i];

    const currentAssets = toNumber(balance.totalCurrentAssets) || 0;
    const currentLiabilities = toNumber(balance.totalCurrentLiabilities) || 0;
    const inventory = toNumber(balance.inventory) || 0;
    const receivables = toNumber(balance.accountsReceivable) || 0;
    const cash = toNumber(balance.cash) || 0;
    const totalAssets = toNumber(balance.totalAssets) || 0;
    const revenue = toNumber(income.totalRevenue) || toNumber(income.operatingIncome) || 0;

    // Considerar válido se > 0 e faz sentido proporcionalmente
    if (currentAssets > 0 && currentAssets < totalAssets * 2) validCurrentAssets++;
    if (currentLiabilities > 0 && currentLiabilities < totalAssets * 2) validCurrentLiabilities++;
    if (inventory >= 0) validInventory++; // Inventory pode ser 0 para empresas de serviço
    if (receivables >= 0) validReceivables++; // Receivables pode ser 0 para alguns negócios
    if (cash >= 0) validCash++; // Cash pode ser 0 (empresa sem caixa)
    if (totalAssets > 0) validTotalAssets++;
    if (revenue > 0) validRevenue++;
  }

  // Determinar tipo de empresa
  const isServiceCompany = validInventory > 0 && (validInventory === periodsToCheck) && 
    balanceData.slice(0, periodsToCheck).every(stmt => (toNumber(stmt.inventory) || 0) === 0);
  
  const isBankOrFinancial = sectorContext?.type === 'FINANCIAL' || 
    (sector?.toLowerCase().includes('bank') ?? false) ||
    (sector?.toLowerCase().includes('financ') ?? false) ||
    (sector?.toLowerCase().includes('seguros') ?? false) ||
    (sector?.toLowerCase().includes('insurance') ?? false) ||
    (sector?.toLowerCase().includes('previdência') ?? false) ||
    (industry?.toLowerCase().includes('bank') ?? false) ||
    (industry?.toLowerCase().includes('financ') ?? false) ||
    (industry?.toLowerCase().includes('seguros') ?? false) ||
    (industry?.toLowerCase().includes('insurance') ?? false) ||
    (industry?.toLowerCase().includes('previdência') ?? false);

  return {
    hasValidCurrentAssets: validCurrentAssets >= Math.ceil(periodsToCheck * 0.6), // Pelo menos 60% dos períodos
    hasValidCurrentLiabilities: validCurrentLiabilities >= Math.ceil(periodsToCheck * 0.6),
    hasValidInventory: validInventory >= Math.ceil(periodsToCheck * 0.6),
    hasValidReceivables: validReceivables >= Math.ceil(periodsToCheck * 0.6),
    hasValidCash: validCash >= Math.ceil(periodsToCheck * 0.6),
    hasValidTotalAssets: validTotalAssets >= Math.ceil(periodsToCheck * 0.6),
    hasValidRevenue: validRevenue >= Math.ceil(periodsToCheck * 0.6),
    isServiceCompany,
    isBankOrFinancial
  };
}

function calculateCAGR(values: number[]): number {
  if (values.length < 2) return 0;
  
  const validValues = values.filter(v => v > 0);
  if (validValues.length < 2) return 0;
  
  const firstValue = validValues[validValues.length - 1]; // Mais antigo
  const lastValue = validValues[0]; // Mais recente
  const years = validValues.length - 1;
  
  if (firstValue <= 0 || years <= 0) return 0;
  
  return Math.pow(lastValue / firstValue, 1 / years) - 1;
}

function calculateStability(values: number[]): number {
  if (values.length < 2) return 0.5;
  
  const validValues = values.filter(v => !isNaN(v) && isFinite(v));
  if (validValues.length < 2) return 0.5;
  
  const mean = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  if (mean === 0) return 0.5;
  
  const variance = validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validValues.length;
  const coefficientOfVariation = Math.sqrt(variance) / Math.abs(mean);
  
  // Converter para score de estabilidade (0 = instável, 1 = muito estável)
  return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
}

// === FUNÇÕES DE ANÁLISE ESPECÍFICAS ===

// 1. ANÁLISE DE RENTABILIDADE
function analyzeProfitabilityMetrics(
  metrics: AverageMetrics, 
  benchmarks: SectorBenchmarks, 
  sectorContext: SectorContext,
  data?: { income: Record<string, unknown>[]; balance: Record<string, unknown>[]; cashflow: Record<string, unknown>[] }
): AnalysisResult {
  const result: AnalysisResult = { scoreAdjustment: 0, redFlags: [], positiveSignals: [] };
  
  // Para seguradoras e empresas financeiras, usar análise adaptada
  const isFinancialSector = sectorContext.type === 'FINANCIAL';
  
  // ROE Analysis
  if (metrics.roe >= benchmarks.excellentROE) {
    result.scoreAdjustment += 15;
    if (isFinancialSector) {
      result.positiveSignals.push(`Rentabilidade excepcional: A ${sectorContext.type === 'FINANCIAL' ? 'instituição financeira' : 'empresa'} gera ${(metrics.roe * 100).toFixed(1)}% de retorno sobre o patrimônio líquido (acima de ${(benchmarks.goodROE * 100).toFixed(1)}% esperado). Excelente eficiência na gestão do capital.`);
    } else {
      result.positiveSignals.push(`Rentabilidade excepcional: A empresa gera ${(metrics.roe * 100).toFixed(1)}% de lucro para cada R$ 100 investidos pelos acionistas (acima de ${(benchmarks.goodROE * 100).toFixed(1)}% esperado). Isso significa que seu dinheiro está rendendo muito bem nesta empresa.`);
    }
  } else if (metrics.roe >= benchmarks.goodROE) {
    result.scoreAdjustment += 8;
    if (isFinancialSector) {
      result.positiveSignals.push(`Boa rentabilidade: A instituição gera ${(metrics.roe * 100).toFixed(1)}% de retorno sobre o patrimônio líquido. Gestão eficiente do capital dos acionistas.`);
    } else {
      result.positiveSignals.push(`Boa rentabilidade: A empresa gera ${(metrics.roe * 100).toFixed(1)}% de lucro para cada R$ 100 dos acionistas. É um retorno sólido para seu investimento.`);
    }
  } else if (metrics.roe < benchmarks.minROE) {
    result.scoreAdjustment -= 20;
    if (isFinancialSector) {
      result.redFlags.push(`Rentabilidade baixa: A instituição gera apenas ${(metrics.roe * 100).toFixed(1)}% de retorno sobre o patrimônio líquido (mínimo esperado: ${(benchmarks.minROE * 100).toFixed(1)}%). Pode indicar ineficiência na gestão do capital ou ambiente desafiador.`);
    } else {
      result.redFlags.push(`Rentabilidade baixa: A empresa gera apenas ${(metrics.roe * 100).toFixed(1)}% de lucro para cada R$ 100 investidos (mínimo esperado: ${(benchmarks.minROE * 100).toFixed(1)}%). Seu dinheiro pode render mais em outras opções de investimento.`);
    }
  }
  
  // ROA Analysis
  if (metrics.roa >= benchmarks.goodROA) {
    result.scoreAdjustment += 10;
    if (isFinancialSector) {
      result.positiveSignals.push(`Eficiência dos ativos: A instituição consegue gerar ${(metrics.roa * 100).toFixed(1)}% de retorno sobre seus ativos. Boa gestão do portfólio e operações.`);
    } else {
      result.positiveSignals.push(`Eficiência dos ativos: A empresa consegue gerar ${(metrics.roa * 100).toFixed(1)}% de lucro para cada R$ 100 em ativos que possui. Isso mostra que ela usa bem seus recursos (equipamentos, imóveis, etc.).`);
    }
  } else if (metrics.roa < benchmarks.minROA) {
    result.scoreAdjustment -= 15;
    if (isFinancialSector) {
      result.redFlags.push(`Baixa eficiência dos ativos: A instituição gera apenas ${(metrics.roa * 100).toFixed(1)}% de retorno sobre seus ativos. Pode indicar problemas na gestão do portfólio ou operações ineficientes.`);
    } else {
      result.redFlags.push(`Baixa eficiência dos ativos: A empresa gera apenas ${(metrics.roa * 100).toFixed(1)}% de lucro com seus recursos. Pode estar com ativos ociosos ou mal utilizados.`);
    }
  }
  
  // Net Margin Analysis - Adaptado para setor financeiro
  if (isFinancialSector) {
    // Para seguradoras e bancos, verificar se conseguimos calcular a margem adequadamente
    if (metrics.netMargin === 0 || isNaN(metrics.netMargin)) {
      // Margem líquida não disponível ou não calculável - ignorar análise
      result.positiveSignals.push(`Análise de margem não aplicável: Para seguradoras, a margem líquida é calculada de forma específica e pode não estar disponível nos dados padronizados. Foque nos indicadores de rentabilidade (ROE/ROA).`);
    } else if (metrics.netMargin >= benchmarks.goodNetMargin) {
      result.scoreAdjustment += 12;
      result.positiveSignals.push(`Margem operacional sólida: A instituição mantém ${(metrics.netMargin * 100).toFixed(1)}% de margem líquida, indicando boa gestão de custos operacionais e sinistralidade controlada.`);
    } else if (metrics.netMargin < benchmarks.minNetMargin && metrics.netMargin > 0) {
      result.scoreAdjustment -= 8; // Penalidade menor para setor financeiro
      result.positiveSignals.push(`Margem operacional moderada: A instituição mantém ${(metrics.netMargin * 100).toFixed(1)}% de margem líquida. Para seguradoras, isso pode refletir períodos de alta sinistralidade ou investimentos em crescimento.`);
    } else if (metrics.netMargin < 0) {
      result.scoreAdjustment -= 15;
      result.redFlags.push(`Margem operacional negativa: A instituição apresenta margem líquida de ${(metrics.netMargin * 100).toFixed(1)}%. Pode indicar alta sinistralidade, custos elevados ou ambiente desafiador.`);
    }
  } else {
    // Análise tradicional para outros setores
    if (metrics.netMargin >= benchmarks.goodNetMargin) {
      result.scoreAdjustment += 12;
      result.positiveSignals.push(`Margem de lucro sólida: De cada R$ 100 em vendas, a empresa consegue manter R$ ${(metrics.netMargin * 100).toFixed(1)} como lucro líquido. Isso indica boa gestão de custos.`);
    } else if (metrics.netMargin < benchmarks.minNetMargin) {
      result.scoreAdjustment -= 18;
      result.redFlags.push(`Margem de lucro baixa: De cada R$ 100 vendidos, sobram apenas R$ ${(metrics.netMargin * 100).toFixed(1)} de lucro (esperado: pelo menos R$ ${(benchmarks.minNetMargin * 100).toFixed(1)}). A empresa pode ter custos altos ou preços baixos.`);
    }
  }
  
  // Detectar e explicar inconsistência entre margem operacional e líquida
  if (metrics.operatingMargin < 0 && metrics.netMargin > 0.05 && data) {
    // Vamos analisar os dados reais para identificar a causa específica
    const explanation = analyzeOperationalVsNetMarginGap(data, metrics);
    result.positiveSignals.push(explanation);
  }
  
  return result;
}

// Função para analisar a diferença entre margem operacional e líquida
function analyzeOperationalVsNetMarginGap(
  data: { income: Record<string, unknown>[]; balance: Record<string, unknown>[]; cashflow: Record<string, unknown>[] },
  metrics: AverageMetrics
): string {
  if (data.income.length === 0) {
    return `Resultado atípico: Apesar da operação dar prejuízo, o resultado final é positivo. Não foi possível identificar a causa específica com os dados disponíveis.`;
  }

  const latestIncome = data.income[0];
  
  // Extrair dados da DRE
  const revenue = toNumber(latestIncome.totalRevenue) || toNumber(latestIncome.operatingIncome) || 0;
  const operatingIncome = toNumber(latestIncome.operatingIncome) || 0;
  const netIncome = toNumber(latestIncome.netIncome) || 0;
  const interestExpense = toNumber(latestIncome.interestExpense) || 0;
  const interestIncome = toNumber(latestIncome.interestIncome) || 0;
  const otherIncome = toNumber(latestIncome.otherIncomeExpenseNet) || 0;
  const incomeBeforeTax = toNumber(latestIncome.incomeBeforeTax) || 0;
  const taxExpense = toNumber(latestIncome.incomeTaxExpense) || 0;
  
  if (revenue <= 0) {
    return `Resultado atípico: Apesar da operação dar prejuízo, o resultado final é positivo. Não foi possível analisar com os dados de receita disponíveis.`;
  }

  // Calcular as diferenças
  const operationalLoss = Math.abs(operatingIncome);
  const netProfit = netIncome;
  const totalGap = netProfit + operationalLoss; // Quanto precisa "compensar"
  
  const explanations: string[] = [];
  let mainCause = '';
  
  // 1. Analisar receitas financeiras (juros recebidos)
  if (interestIncome > 0) {
    const interestImpact = (interestIncome / revenue) * 100;
    if (interestImpact >= 5) {
      explanations.push(`receitas de juros significativas (R$ ${interestImpact.toFixed(1)} para cada R$ 100 de vendas)`);
      if (interestIncome >= totalGap * 0.5) {
        mainCause = 'receitas financeiras';
      }
    }
  }
  
  // 2. Analisar outras receitas não operacionais
  if (otherIncome > 0) {
    const otherImpact = (otherIncome / revenue) * 100;
    if (otherImpact >= 3) {
      explanations.push(`outras receitas não operacionais (R$ ${otherImpact.toFixed(1)} para cada R$ 100 de vendas)`);
      if (otherIncome >= totalGap * 0.5) {
        mainCause = 'receitas extraordinárias';
      }
    }
  }
  
  // 3. Analisar baixas despesas financeiras (se a empresa tem pouca dívida)
  const netFinancialResult = interestIncome - Math.abs(interestExpense);
  if (netFinancialResult > 0) {
    const financialImpact = (netFinancialResult / revenue) * 100;
    if (financialImpact >= 3) {
      explanations.push(`resultado financeiro líquido positivo (R$ ${financialImpact.toFixed(1)} para cada R$ 100 de vendas)`);
      if (!mainCause && netFinancialResult >= totalGap * 0.3) {
        mainCause = 'resultado financeiro positivo';
      }
    }
  }
  
  // 4. Analisar benefício fiscal (se os impostos são baixos ou negativos)
  if (incomeBeforeTax > 0 && taxExpense < incomeBeforeTax * 0.1) {
    const taxBenefit = incomeBeforeTax * 0.25 - taxExpense; // Assumindo 25% como taxa normal
    if (taxBenefit > 0) {
      const taxImpact = (taxBenefit / revenue) * 100;
      if (taxImpact >= 2) {
        explanations.push(`baixa carga tributária ou benefícios fiscais`);
        if (!mainCause && taxBenefit >= totalGap * 0.3) {
          mainCause = 'benefícios fiscais';
        }
      }
    }
  }
  
  // Montar explicação final
  if (explanations.length === 0) {
    return `Resultado atípico: A operação dá prejuízo de R$ ${Math.abs(metrics.operatingMargin * 100).toFixed(1)} para cada R$ 100 vendidos, mas o resultado final é lucro de R$ ${(metrics.netMargin * 100).toFixed(1)}. A causa específica não foi identificada nos dados disponíveis.`;
  }
  
  const causesText = explanations.length === 1 ? explanations[0] : 
                   explanations.length === 2 ? `${explanations[0]} e ${explanations[1]}` :
                   `${explanations.slice(0, -1).join(', ')} e ${explanations[explanations.length - 1]}`;
  
  if (mainCause) {
    return `Resultado explicado: Apesar da operação dar prejuízo, o lucro final vem principalmente de ${mainCause}. A empresa compensa as perdas operacionais com ${causesText}.`;
  } else {
    return `Resultado misto: A operação dá prejuízo, mas o lucro final é resultado de ${causesText}. Isso torna os resultados menos previsíveis.`;
  }
}

// 2. ANÁLISE DE LIQUIDEZ E SOLVÊNCIA
function analyzeLiquidityMetrics(
  metrics: AverageMetrics, 
  benchmarks: SectorBenchmarks, 
  sectorContext: SectorContext,
  dataValidation?: DataValidation
): AnalysisResult {
  const result: AnalysisResult = { scoreAdjustment: 0, redFlags: [], positiveSignals: [] };
  
  console.log('metrics', metrics);
  console.log('benchmarks', benchmarks);
  console.log('sectorContext', sectorContext);
  console.log('dataValidation', dataValidation);
  
  const isFinancialSector = sectorContext.type === 'FINANCIAL';
  
  // Current Ratio Analysis - adaptado para setor financeiro
  if (dataValidation?.hasValidCurrentAssets && dataValidation?.hasValidCurrentLiabilities) {
    if (isFinancialSector) {
      // Para bancos, liquidez corrente é menos relevante e pode ser baixa
      if (metrics.currentRatio >= 0.3) {
        result.scoreAdjustment += 5;
        result.positiveSignals.push(`Liquidez adequada para instituição financeira: A instituição mantém R$ ${metrics.currentRatio.toFixed(2)} em ativos líquidos para cada R$ 1,00 de obrigações de curto prazo. Adequado para o setor bancário.`);
      } else if (metrics.currentRatio < 0.1) {
        result.scoreAdjustment -= 10; // Penalidade menor para bancos
        result.redFlags.push(`Liquidez muito baixa: A instituição tem apenas R$ ${metrics.currentRatio.toFixed(2)} para cada R$ 1,00 de obrigações de curto prazo. Pode indicar problemas de gestão de liquidez.`);
      }
    } else {
      // Análise tradicional para outros setores
      if (metrics.currentRatio >= benchmarks.goodCurrentRatio) {
        result.scoreAdjustment += 10;
        result.positiveSignals.push(`Boa capacidade de pagamento: A empresa tem R$ ${metrics.currentRatio.toFixed(2)} em ativos de curto prazo para cada R$ 1,00 de dívidas de curto prazo. Consegue pagar suas contas em dia.`);
      } else if (metrics.currentRatio < benchmarks.minCurrentRatio) {
        result.scoreAdjustment -= 25;
        result.redFlags.push(`Dificuldade para pagar contas: A empresa tem apenas R$ ${metrics.currentRatio.toFixed(2)} para cada R$ 1,00 de dívidas de curto prazo (mínimo: R$ ${benchmarks.minCurrentRatio.toFixed(1)}). Pode ter problemas de caixa.`);
      }
    }
  } else if (dataValidation) {
    // Se não temos dados válidos, adicionar contexto
    if (isFinancialSector) {
      result.positiveSignals.push(`Indicadores de liquidez tradicionais não aplicáveis: Para bancos, a liquidez é gerenciada de forma específica através de reservas obrigatórias e instrumentos financeiros.`);
    } else {
      result.positiveSignals.push(`Indicadores de liquidez não disponíveis: Dados de ativos ou passivos circulantes não estão disponíveis ou não fazem sentido para este tipo de negócio.`);
    }
  }
  
  // Quick Ratio Analysis - adaptado para setor financeiro
  if (dataValidation?.hasValidCurrentAssets && dataValidation?.hasValidCurrentLiabilities && !isFinancialSector) {
    if (metrics.quickRatio >= 1.0) {
      result.scoreAdjustment += 8;
      result.positiveSignals.push(`Liquidez imediata boa: Mesmo sem vender estoques, a empresa tem R$ ${metrics.quickRatio.toFixed(2)} disponíveis para cada R$ 1,00 de dívidas urgentes.`);
    } else if (metrics.quickRatio < 0.5) {
      result.scoreAdjustment -= 15;
      result.redFlags.push(`Liquidez imediata baixa: Sem vender estoques, a empresa tem apenas R$ ${metrics.quickRatio.toFixed(2)} para cada R$ 1,00 de dívidas urgentes. Depende muito das vendas para pagar contas.`);
    }
  }
  
  // Working Capital Analysis - não aplicável para bancos
  if (dataValidation?.hasValidCurrentAssets && dataValidation?.hasValidCurrentLiabilities && dataValidation?.hasValidTotalAssets && !isFinancialSector) {
    if (metrics.workingCapitalRatio >= 0.15) {
      result.scoreAdjustment += 6;
      result.positiveSignals.push(`Capital de giro saudável: A empresa tem ${(metrics.workingCapitalRatio * 100).toFixed(1)}% dos seus ativos como "dinheiro sobrando" para investir no crescimento do negócio.`);
    } else if (metrics.workingCapitalRatio < 0) {
      result.scoreAdjustment -= 12;
      result.redFlags.push(`Capital de giro negativo: A empresa deve mais no curto prazo do que tem disponível. Isso pode indicar aperto financeiro ou má gestão do caixa.`);
    }
  }
  
  // Debt Analysis - adaptado para setor financeiro
  if (isFinancialSector) {
    // Para bancos, alavancagem alta é normal e esperada
    if (metrics.debtToEquity > 20.0) {
      result.scoreAdjustment -= 15;
      result.redFlags.push(`Alavancagem excessiva: A instituição tem alavancagem de ${metrics.debtToEquity.toFixed(1)}x (acima de 20x). Mesmo para bancos, isso pode indicar risco excessivo.`);
    } else if (metrics.debtToEquity > 15.0) {
      result.scoreAdjustment -= 5;
      result.positiveSignals.push(`Alavancagem alta: A instituição opera com alavancagem de ${metrics.debtToEquity.toFixed(1)}x. Para bancos, alavancagem alta é normal, mas monitore a qualidade dos ativos.`);
    } else if (metrics.debtToEquity >= 8.0) {
      result.scoreAdjustment += 5;
      result.positiveSignals.push(`Alavancagem adequada: A instituição mantém alavancagem de ${metrics.debtToEquity.toFixed(1)}x, dentro do esperado para bancos. Boa gestão de capital.`);
    } else {
      result.scoreAdjustment += 3;
      result.positiveSignals.push(`Alavancagem conservadora: A instituição opera com alavancagem baixa de ${metrics.debtToEquity.toFixed(1)}x. Posição conservadora que pode limitar o retorno, mas reduz riscos.`);
    }
  } else {
    // Análise tradicional para outros setores
    if (metrics.debtToEquity > benchmarks.maxDebtToEquity) {
      result.scoreAdjustment -= 20;
      result.redFlags.push(`Endividamento muito alto: A empresa deve ${metrics.debtToEquity.toFixed(2)}x mais do que vale seu patrimônio (máximo recomendado: ${benchmarks.maxDebtToEquity.toFixed(1)}x). Isso pode comprometer a saúde financeira e os dividendos.`);
    } else if (metrics.debtToEquity < benchmarks.maxDebtToEquity * 0.5) {
      result.scoreAdjustment += 5;
      result.positiveSignals.push(`Endividamento controlado: A empresa deve apenas ${metrics.debtToEquity.toFixed(2)}x do valor do seu patrimônio. Isso dá segurança e espaço para crescer.`);
    }
  }
  
  // Interest Coverage Analysis - adaptado para setor financeiro
  if (isFinancialSector) {
    // Para bancos, a cobertura de juros tem interpretação diferente
    if (metrics.interestCoverage >= 5) {
      result.scoreAdjustment += 8;
      result.positiveSignals.push(`Gestão eficiente do spread bancário: A instituição apresenta cobertura de ${metrics.interestCoverage.toFixed(1)}x, indicando boa capacidade de gerar lucros líquidos em relação aos custos de captação.`);
    } else if (metrics.interestCoverage >= 2) {
      result.scoreAdjustment += 3;
      result.positiveSignals.push(`Cobertura adequada para banco: Relação de ${metrics.interestCoverage.toFixed(1)}x entre lucro e despesas de juros. Para bancos, o foco deve estar na margem líquida e ROE.`);
    } else if (metrics.interestCoverage < 1 && metrics.interestCoverage > 0.1) {
      result.scoreAdjustment -= 5; // Penalidade menor
      result.positiveSignals.push(`Cobertura baixa mas típica de bancos: Relação de ${metrics.interestCoverage.toFixed(1)}x. Para instituições financeiras, analise principalmente a rentabilidade (ROE) e qualidade dos ativos, pois a estrutura de juros é diferente de empresas tradicionais.`);
    } else if (metrics.interestCoverage <= 0.1) {
      result.scoreAdjustment -= 3; // Penalidade muito menor
      result.positiveSignals.push(`Estrutura financeira específica de banco: A análise de cobertura de juros não se aplica da mesma forma a bancos. Foque nos indicadores de rentabilidade (ROE, ROA) e qualidade da carteira de crédito.`);
    }
  } else {
    // Análise tradicional para outros setores
    if (metrics.interestCoverage >= 8) {
      result.scoreAdjustment += 8;
      result.positiveSignals.push(`Facilidade para pagar juros: A empresa ganha ${metrics.interestCoverage.toFixed(1)}x mais do que precisa para pagar os juros das dívidas. Muito seguro para o investidor.`);
    } else if (metrics.interestCoverage >= 3) {
      result.scoreAdjustment += 4;
      result.positiveSignals.push(`Consegue pagar juros: A empresa ganha ${metrics.interestCoverage.toFixed(1)}x o valor necessário para pagar juros. Situação adequada.`);
    } else if (metrics.interestCoverage < 2 && metrics.debtToEquity > 1) {
      result.scoreAdjustment -= 15;
      result.redFlags.push(`Dificuldade para pagar juros: A empresa ganha apenas ${metrics.interestCoverage.toFixed(1)}x o que precisa para pagar juros. Risco de não conseguir honrar as dívidas.`);
    }
  }
  
  return result;
}

// 3. ANÁLISE DE EFICIÊNCIA OPERACIONAL
function analyzeEfficiencyMetrics(
  metrics: AverageMetrics, 
  benchmarks: SectorBenchmarks, 
  sectorContext: SectorContext,
  dataValidation?: DataValidation
): AnalysisResult {
  const result: AnalysisResult = { scoreAdjustment: 0, redFlags: [], positiveSignals: [] };
  
  const isFinancialSector = sectorContext.type === 'FINANCIAL';
  
  // Asset Turnover Analysis - Adaptado para setor financeiro
  if (dataValidation?.hasValidTotalAssets && dataValidation?.hasValidRevenue) {
    if (isFinancialSector) {
      // Para bancos, asset turnover baixo é normal devido à natureza dos ativos (empréstimos, investimentos)
      if (metrics.assetTurnover >= 0.15) {
        result.scoreAdjustment += 8;
        result.positiveSignals.push(`Eficiência adequada dos ativos: A instituição gera R$ ${metrics.assetTurnover.toFixed(2)} em receitas para cada R$ 1,00 em ativos. Para bancos, isso indica boa gestão do portfólio de crédito e investimentos.`);
      } else if (metrics.assetTurnover >= 0.08) {
        result.scoreAdjustment += 3;
        result.positiveSignals.push(`Gestão adequada dos ativos: A instituição gera R$ ${metrics.assetTurnover.toFixed(2)} em receitas para cada R$ 1,00 em ativos. Dentro do esperado para o setor bancário, onde os ativos são principalmente empréstimos e investimentos.`);
      } else if (metrics.assetTurnover < 0.05) {
        result.scoreAdjustment -= 5; // Penalidade menor para bancos
        result.positiveSignals.push(`Eficiência dos ativos moderada: A instituição gera R$ ${metrics.assetTurnover.toFixed(2)} em receitas para cada R$ 1,00 em ativos. Para bancos, valores baixos podem ser normais devido à natureza conservadora dos ativos bancários.`);
      }
    } else {
      // Análise tradicional para outros setores
      if (metrics.assetTurnover >= 1.5) {
        result.scoreAdjustment += 12;
        result.positiveSignals.push(`Uso eficiente dos recursos: A empresa gera R$ ${metrics.assetTurnover.toFixed(2)} em vendas para cada R$ 1,00 investido em ativos (equipamentos, imóveis, etc.). Isso mostra boa produtividade.`);
      } else if (metrics.assetTurnover < 0.5) {
        result.scoreAdjustment -= 10;
        result.redFlags.push(`Recursos mal aproveitados: A empresa gera apenas R$ ${metrics.assetTurnover.toFixed(2)} em vendas para cada R$ 1,00 em ativos. Pode ter equipamentos parados ou investimentos desnecessários.`);
      }
    }
  }
  
  // Operating Margin Analysis - Adaptado para setor financeiro
  if (dataValidation?.hasValidRevenue) {
    if (isFinancialSector) {
      // Para bancos, margem operacional pode ser negativa devido à estrutura contábil específica
      if (metrics.operatingMargin >= 0.30) {
        result.scoreAdjustment += 10;
        result.positiveSignals.push(`Excelente eficiência operacional: A instituição apresenta margem operacional de ${(metrics.operatingMargin * 100).toFixed(1)}%. Boa gestão de custos operacionais e spread bancário.`);
      } else if (metrics.operatingMargin >= 0.15) {
        result.scoreAdjustment += 5;
        result.positiveSignals.push(`Boa eficiência operacional: A instituição mantém margem operacional de ${(metrics.operatingMargin * 100).toFixed(1)}%. Gestão adequada de custos administrativos.`);
      } else if (metrics.operatingMargin < -0.10) {
        result.scoreAdjustment -= 3; // Penalidade muito menor para bancos
        result.positiveSignals.push(`Estrutura operacional típica de banco: A margem operacional de ${(metrics.operatingMargin * 100).toFixed(1)}% reflete a estrutura contábil bancária, onde receitas financeiras são contabilizadas separadamente. Foque no ROE e margem líquida para avaliar a eficiência.`);
      } else if (metrics.operatingMargin >= 0 && metrics.operatingMargin < 0.15) {
        result.scoreAdjustment += 2;
        result.positiveSignals.push(`Margem operacional moderada: A instituição apresenta margem operacional de ${(metrics.operatingMargin * 100).toFixed(1)}%. Para bancos, o mais importante é a capacidade de gerar receitas financeiras líquidas.`);
      }
    } else {
      // Análise tradicional para outros setores
      if (metrics.operatingMargin >= 0.15) {
        result.scoreAdjustment += 10;
        result.positiveSignals.push(`Operação muito lucrativa: Antes de pagar juros e impostos, a empresa já lucra R$ ${(metrics.operatingMargin * 100).toFixed(1)} para cada R$ 100 vendidos. Mostra eficiência operacional.`);
      } else if (metrics.operatingMargin < 0) {
        result.scoreAdjustment -= 15;
        result.redFlags.push(`Operação com prejuízo: A empresa perde R$ ${Math.abs(metrics.operatingMargin * 100).toFixed(1)} para cada R$ 100 vendidos, antes de considerar receitas financeiras. Os custos operacionais estão muito altos.`);
      } else if (metrics.operatingMargin < 0.05) {
        result.scoreAdjustment -= 8;
        result.redFlags.push(`Operação pouco lucrativa: A empresa lucra apenas R$ ${(metrics.operatingMargin * 100).toFixed(1)} para cada R$ 100 vendidos, antes de juros e impostos. Custos operacionais podem estar altos.`);
      }
    }
  }
  
  // Receivables Turnover Analysis - só analisar se temos dados válidos de recebíveis
  if (dataValidation?.hasValidReceivables && dataValidation?.hasValidRevenue) {
    if (metrics.receivablesTurnover >= 8) {
      result.scoreAdjustment += 6;
      result.positiveSignals.push(`Cobrança rápida: A empresa recebe o dinheiro das vendas em cerca de ${(365/metrics.receivablesTurnover).toFixed(0)} dias. Isso é bom para o fluxo de caixa.`);
    } else if (metrics.receivablesTurnover < 4) {
      result.scoreAdjustment -= 8;
      result.redFlags.push(`Cobrança lenta: A empresa demora cerca de ${(365/metrics.receivablesTurnover).toFixed(0)} dias para receber das vendas. Isso pode causar problemas de caixa.`);
    }
  } else if (dataValidation && !dataValidation.hasValidReceivables) {
    // Se não temos dados de recebíveis, pode ser normal para alguns tipos de negócio
    result.positiveSignals.push(`Indicadores de cobrança não aplicáveis: Este tipo de negócio pode não ter recebíveis significativos (ex: vendas à vista, assinaturas pré-pagas).`);
  }
  
  // Inventory Turnover Analysis - só analisar se relevante para o tipo de negócio
  if (dataValidation?.hasValidInventory && !dataValidation?.isServiceCompany && !dataValidation?.isBankOrFinancial) {
    if (metrics.inventoryTurnover >= 6) {
      result.scoreAdjustment += 5;
      result.positiveSignals.push(`Estoque bem gerenciado: A empresa renova seu estoque ${metrics.inventoryTurnover.toFixed(1)} vezes por ano. Produtos não ficam parados.`);
    } else if (metrics.inventoryTurnover < 2) {
      result.scoreAdjustment -= 10;
      result.redFlags.push(`Estoque parado: A empresa demora ${(365/metrics.inventoryTurnover).toFixed(0)} dias para vender seu estoque. Produtos podem estar encalhados ou obsoletos.`);
    }
  } else if (dataValidation?.isServiceCompany) {
    // Para empresas de serviços, não analisar estoque
    result.positiveSignals.push(`Modelo de negócio sem estoque: Empresa de serviços não precisa gerenciar estoques, o que reduz riscos operacionais.`);
  } else if (dataValidation?.isBankOrFinancial) {
    // Para bancos e financeiras, não analisar estoque
    result.positiveSignals.push(`Setor financeiro: Indicadores de estoque não se aplicam a instituições financeiras.`);
  }
  
  return result;
}

// 4. ANÁLISE DE FLUXO DE CAIXA
function analyzeCashFlowQuality(metrics: AverageMetrics, benchmarks: SectorBenchmarks, sectorContext: SectorContext): AnalysisResult {
  const result: AnalysisResult = { scoreAdjustment: 0, redFlags: [], positiveSignals: [] };
  
  const isFinancialSector = sectorContext.type === 'FINANCIAL';
  
  // Operating Cash Flow Margin Analysis - Adaptado para setor financeiro
  if (metrics.operatingCashFlowMargin >= 0.15) {
    result.scoreAdjustment += 15;
    if (isFinancialSector) {
      result.positiveSignals.push(`Excelente geração de caixa: A instituição converte ${(metrics.operatingCashFlowMargin * 100).toFixed(1)}% das receitas em fluxo de caixa operacional. Boa gestão de reservas e investimentos.`);
    } else {
      result.positiveSignals.push(`Excelente geração de caixa: A empresa converte ${(metrics.operatingCashFlowMargin * 100).toFixed(1)}% das vendas em dinheiro real no caixa. Isso é muito bom para pagar dividendos e investir.`);
    }
  } else if (metrics.operatingCashFlowMargin >= 0.08) {
    result.scoreAdjustment += 8;
    if (isFinancialSector) {
      result.positiveSignals.push(`Boa geração de caixa: A instituição transforma ${(metrics.operatingCashFlowMargin * 100).toFixed(1)}% das receitas em fluxo de caixa operacional. Situação saudável.`);
    } else {
      result.positiveSignals.push(`Boa geração de caixa: A empresa transforma ${(metrics.operatingCashFlowMargin * 100).toFixed(1)}% das vendas em dinheiro no caixa. Situação saudável.`);
    }
  } else if (metrics.operatingCashFlowMargin < 0) {
    result.scoreAdjustment -= 20;
    if (isFinancialSector) {
      result.redFlags.push(`Fluxo de caixa operacional negativo: A instituição apresenta saída líquida de caixa nas operações (${(metrics.operatingCashFlowMargin * 100).toFixed(1)}%). Pode indicar alta sinistralidade ou investimentos em crescimento.`);
    } else {
      result.redFlags.push(`Queima de caixa: A empresa está gastando mais dinheiro do que recebe das operações (${(metrics.operatingCashFlowMargin * 100).toFixed(1)}%). Isso pode comprometer dividendos e investimentos.`);
    }
  }
  
  // Free Cash Flow Analysis - Adaptado para setor financeiro
  if (metrics.freeCashFlowMargin >= 0.10) {
    result.scoreAdjustment += 12;
    if (isFinancialSector) {
      result.positiveSignals.push(`Excelente fluxo de caixa livre: Após todas as operações e investimentos necessários, ainda sobram ${(metrics.freeCashFlowMargin * 100).toFixed(1)}% das receitas em caixa livre. Ótimo para dividendos.`);
    } else {
      result.positiveSignals.push(`Sobra muito dinheiro: Após pagar todas as contas e investimentos necessários, ainda sobram ${(metrics.freeCashFlowMargin * 100).toFixed(1)}% das vendas em caixa livre. Ótimo para dividendos.`);
    }
  } else if (metrics.freeCashFlowMargin >= 0.05) {
    result.scoreAdjustment += 6;
    if (isFinancialSector) {
      result.positiveSignals.push(`Bom fluxo de caixa livre: Após todas as operações, ainda restam ${(metrics.freeCashFlowMargin * 100).toFixed(1)}% das receitas livres. Bom para remunerar acionistas.`);
    } else {
      result.positiveSignals.push(`Sobra dinheiro: Após todos os gastos, ainda restam ${(metrics.freeCashFlowMargin * 100).toFixed(1)}% das vendas livres. Bom para remunerar acionistas.`);
    }
  } else if (metrics.freeCashFlowMargin < -0.05) {
    result.scoreAdjustment -= 15;
    if (isFinancialSector) {
      result.redFlags.push(`Fluxo de caixa livre negativo: Após operações e investimentos, a instituição consome ${Math.abs(metrics.freeCashFlowMargin * 100).toFixed(1)}% das receitas. Pode afetar dividendos.`);
    } else {
      result.redFlags.push(`Falta dinheiro: Após pagar contas e investimentos, a empresa fica no vermelho em ${Math.abs(metrics.freeCashFlowMargin * 100).toFixed(1)}% das vendas. Pode afetar dividendos.`);
    }
  }
  
  // Cash Conversion Quality - Adaptado para setor financeiro
  if (isFinancialSector) {
    // Para seguradoras, a conversão lucro-caixa é mais complexa devido às reservas técnicas
    if (metrics.cashConversionRatio >= 1.2) {
      result.scoreAdjustment += 10;
      result.positiveSignals.push(`Excelente conversão lucro-caixa: Para cada R$ 1,00 de lucro, a instituição gera R$ ${metrics.cashConversionRatio.toFixed(2)} em caixa. Boa gestão de reservas e investimentos.`);
    } else if (metrics.cashConversionRatio >= 0.8) {
      result.scoreAdjustment += 5;
      result.positiveSignals.push(`Boa conversão lucro-caixa: Para cada R$ 1,00 de lucro, a instituição gera R$ ${metrics.cashConversionRatio.toFixed(2)} em caixa. Conversão adequada.`);
    } else if (metrics.cashConversionRatio < 0.3) {
      result.scoreAdjustment -= 8; // Penalidade menor para setor financeiro
      result.positiveSignals.push(`Conversão lucro-caixa moderada: Para cada R$ 1,00 de lucro, a instituição gera R$ ${metrics.cashConversionRatio.toFixed(2)} em caixa. Para seguradoras, isso pode refletir aumento de reservas técnicas ou investimentos em crescimento.`);
    }
  } else {
    // Análise tradicional para outros setores
    if (metrics.cashConversionRatio >= 1.2) {
      result.scoreAdjustment += 10;
      result.positiveSignals.push(`Lucro vira dinheiro real: Para cada R$ 1,00 de lucro no papel, a empresa gera R$ ${metrics.cashConversionRatio.toFixed(2)} em dinheiro real. Excelente qualidade dos lucros.`);
    } else if (metrics.cashConversionRatio >= 0.8) {
      result.scoreAdjustment += 5;
      result.positiveSignals.push(`Lucro se transforma em caixa: Para cada R$ 1,00 de lucro, a empresa gera R$ ${metrics.cashConversionRatio.toFixed(2)} em caixa. Boa conversão.`);
    } else if (metrics.cashConversionRatio < 0.5) {
      result.scoreAdjustment -= 12;
      result.redFlags.push(`Lucro não vira dinheiro: Para cada R$ 1,00 de lucro no papel, apenas R$ ${metrics.cashConversionRatio.toFixed(2)} viram dinheiro real. Pode ser "lucro de papel" ou problemas de cobrança.`);
    }
  }
  
  return result;
}

// 5. ANÁLISE DE ESTABILIDADE E CONSISTÊNCIA
function analyzeStabilityMetrics(
  data: { income: Record<string, unknown>[]; balance: Record<string, unknown>[]; cashflow: Record<string, unknown>[] },
  metrics: AverageMetrics,
  sectorContext: SectorContext
): AnalysisResult {
  const result: AnalysisResult = { scoreAdjustment: 0, redFlags: [], positiveSignals: [] };
  
  const isFinancialSector = sectorContext.type === 'FINANCIAL';
  
  // Revenue Stability - Adaptado para setor financeiro
  if (metrics.revenueStability >= 0.8) {
    result.scoreAdjustment += 15;
    if (isFinancialSector) {
      result.positiveSignals.push(`Receitas muito previsíveis: A instituição apresenta receitas estáveis ao longo dos anos (${(metrics.revenueStability * 100).toFixed(0)}% de consistência). Para seguradoras, indica carteira bem diversificada e sinistralidade controlada.`);
    } else {
      result.positiveSignals.push(`Vendas muito previsíveis: As receitas da empresa são muito estáveis ao longo dos anos (${(metrics.revenueStability * 100).toFixed(0)}% de consistência). Isso dá segurança para planejar dividendos.`);
    }
  } else if (metrics.revenueStability >= 0.6) {
    result.scoreAdjustment += 8;
    if (isFinancialSector) {
      result.positiveSignals.push(`Receitas relativamente previsíveis: A instituição tem boa consistência nas receitas ao longo dos anos. Negócio com base sólida.`);
    } else {
      result.positiveSignals.push(`Vendas relativamente previsíveis: As receitas têm boa consistência ao longo dos anos. Empresa com negócio estável.`);
    }
  } else if (metrics.revenueStability < 0.3) {
    if (isFinancialSector) {
      result.scoreAdjustment -= 8; // Penalidade menor para setor financeiro
      result.positiveSignals.push(`Receitas com variação: As receitas variam entre os anos (${(metrics.revenueStability * 100).toFixed(0)}% de consistência). Para seguradoras, pode refletir ciclos de sinistralidade ou mudanças no portfólio, sendo comum no setor.`);
    } else {
      result.scoreAdjustment -= 15;
      result.redFlags.push(`Vendas imprevisíveis: As receitas variam muito de ano para ano (${(metrics.revenueStability * 100).toFixed(0)}% de consistência). Dificulta planejamento e pode afetar dividendos.`);
    }
  }
  
  // Margin Stability
  if (metrics.marginStability >= 0.7) {
    result.scoreAdjustment += 10;
    result.positiveSignals.push(`Lucratividade consistente: A empresa mantém margens de lucro estáveis ao longo dos anos. Mostra boa gestão de custos e preços.`);
  } else if (metrics.marginStability < 0.3) {
    result.scoreAdjustment -= 12;
    result.redFlags.push(`Lucratividade instável: As margens de lucro variam muito entre os anos. Pode indicar dificuldade em controlar custos ou pressão competitiva.`);
  }
  
  // Check for consecutive losses
  const recentNetIncomes = data.income.slice(0, 3).map(stmt => toNumber(stmt.netIncome) || 0);
  const consecutiveLosses = recentNetIncomes.filter(income => income < 0).length;
  
  if (consecutiveLosses >= 2) {
    result.scoreAdjustment -= 30;
    result.redFlags.push(`Prejuízos frequentes: A empresa teve prejuízo em ${consecutiveLosses} dos últimos 3 anos. Isso compromete a capacidade de pagar dividendos e pode indicar problemas estruturais.`);
  }
  
  return result;
}

// 5. ANÁLISE DE CRESCIMENTO SUSTENTÁVEL
function analyzeGrowthQuality(
  data: { income: Record<string, unknown>[]; balance: Record<string, unknown>[]; cashflow: Record<string, unknown>[] },
  metrics: AverageMetrics,
  sectorContext: SectorContext
): AnalysisResult {
  const result: AnalysisResult = { scoreAdjustment: 0, redFlags: [], positiveSignals: [] };
  
  // Revenue Growth Analysis
  if (metrics.revenueGrowth >= 0.15) {
    result.scoreAdjustment += 15;
    result.positiveSignals.push(`Crescimento acelerado: As vendas crescem ${(metrics.revenueGrowth * 100).toFixed(1)}% ao ano em média. Empresa em expansão, o que pode valorizar suas ações.`);
  } else if (metrics.revenueGrowth >= 0.05) {
    result.scoreAdjustment += 8;
    result.positiveSignals.push(`Crescimento sólido: As vendas crescem ${(metrics.revenueGrowth * 100).toFixed(1)}% ao ano. Ritmo saudável de expansão dos negócios.`);
  } else if (metrics.revenueGrowth < -0.05) {
    result.scoreAdjustment -= 20;
    result.redFlags.push(`Vendas em queda: As receitas estão diminuindo ${Math.abs(metrics.revenueGrowth * 100).toFixed(1)}% ao ano. Pode indicar perda de mercado ou problemas no setor.`);
  }
  
  // Net Income Growth Analysis
  if (metrics.netIncomeGrowth >= 0.10) {
    result.scoreAdjustment += 12;
    result.positiveSignals.push(`Lucros crescendo: Os lucros aumentam ${(metrics.netIncomeGrowth * 100).toFixed(1)}% ao ano. Isso pode resultar em mais dividendos e valorização das ações.`);
  } else if (metrics.netIncomeGrowth < -0.10) {
    result.scoreAdjustment -= 18;
    result.redFlags.push(`Lucros em queda: Os lucros estão diminuindo ${Math.abs(metrics.netIncomeGrowth * 100).toFixed(1)}% ao ano. Isso pode comprometer dividendos futuros.`);
  }
  
  // Growth Quality Check (revenue growth vs profit growth)
  if (metrics.revenueGrowth > 0 && metrics.netIncomeGrowth > metrics.revenueGrowth) {
    result.scoreAdjustment += 8;
    result.positiveSignals.push(`Crescimento eficiente: Os lucros crescem mais rápido que as vendas. A empresa está ficando mais eficiente e lucrativa.`);
  } else if (metrics.revenueGrowth > 0.05 && metrics.netIncomeGrowth < 0) {
    result.scoreAdjustment -= 10;
    result.redFlags.push(`Crescimento sem lucro: As vendas crescem mas os lucros caem. A empresa pode estar com problemas de custos ou competição acirrada.`);
  }
  
  return result;
}

// 6. FUNÇÃO PARA AVALIAR FORÇA DA EMPRESA BASEADA NAS MÉDIAS
function assessCompanyStrengthFromAverages(
  metrics: AverageMetrics,
  benchmarks: SectorBenchmarks,
  sectorContext: SectorContext
): StatementsAnalysis['companyStrength'] {
  let strengthScore = 0;
  
  // Rentabilidade (40% do peso)
  if (metrics.roe >= benchmarks.excellentROE) strengthScore += 40;
  else if (metrics.roe >= benchmarks.goodROE) strengthScore += 25;
  else if (metrics.roe >= benchmarks.minROE) strengthScore += 15;
  
  // Liquidez (25% do peso)
  if (metrics.currentRatio >= benchmarks.goodCurrentRatio && metrics.quickRatio >= 1.0) strengthScore += 25;
  else if (metrics.currentRatio >= benchmarks.minCurrentRatio) strengthScore += 15;
  else if (metrics.currentRatio < benchmarks.minCurrentRatio) strengthScore -= 10;
  
  // Endividamento (20% do peso)
  if (metrics.debtToEquity <= benchmarks.maxDebtToEquity * 0.5) strengthScore += 20;
  else if (metrics.debtToEquity <= benchmarks.maxDebtToEquity) strengthScore += 10;
  else strengthScore -= 15;
  
  // Estabilidade (15% do peso)
  if (metrics.revenueStability >= 0.7 && metrics.marginStability >= 0.6) strengthScore += 15;
  else if (metrics.revenueStability >= 0.5) strengthScore += 8;
  
  if (strengthScore >= 80) return 'VERY_STRONG';
  if (strengthScore >= 60) return 'STRONG';
  if (strengthScore >= 40) return 'MODERATE';
  return 'WEAK';
}

// === FUNÇÕES AUXILIARES PARA ANÁLISE CONTEXTUAL (MANTIDAS PARA COMPATIBILIDADE) ===

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


// === ANÁLISE DA COMPOSIÇÃO DO RESULTADO ===
function analyzeIncomeComposition(
  data: { income: Record<string, unknown>[]; balance: Record<string, unknown>[]; cashflow: Record<string, unknown>[] },
  sectorContext: SectorContext
): AnalysisResult {
  const result: AnalysisResult = { scoreAdjustment: 0, redFlags: [], positiveSignals: [] };

  // Não aplicar para empresas financeiras
  if (sectorContext.type === 'FINANCIAL') {
    return result;
  }

  // Verificar se temos dados suficientes
  if (data.income.length < 2) {
    return result;
  }

  // Analisar os últimos 3 anos (ou quantos estiverem disponíveis)
  const yearsToAnalyze = Math.min(3, data.income.length);
  let problematicYears = 0;
  let totalYearsAnalyzed = 0;

  for (let i = 0; i < yearsToAnalyze; i++) {
    const incomeStmt = data.income[i];
    
    // Extrair componentes do resultado usando campos do schema
    const netIncome = toNumber(incomeStmt.netIncome) || 0;
    const grossProfit = toNumber(incomeStmt.grossProfit) || 0;
    const totalOperatingExpenses = toNumber(incomeStmt.totalOperatingExpenses) || 0;
    const ebit = toNumber(incomeStmt.ebit) || 0;
    const operatingIncomeField = toNumber(incomeStmt.operatingIncome) || 0;
    
    // Campos financeiros disponíveis no schema
    const financialResult = toNumber(incomeStmt.financialResult) || 0; // Resultado financeiro líquido
    const financialIncome = toNumber(incomeStmt.financialIncome) || 0; // Receitas financeiras
    const financialExpenses = toNumber(incomeStmt.financialExpenses) || 0; // Despesas financeiras
    const interestExpense = toNumber(incomeStmt.interestExpense) || 0; // Despesas de juros
    const totalOtherIncomeExpenseNet = toNumber(incomeStmt.totalOtherIncomeExpenseNet) || 0; // Outras receitas/despesas
    const otherOperatingIncome = toNumber(incomeStmt.otherOperatingIncome) || 0; // Outras receitas operacionais
    
    // Calcular resultado operacional corretamente (mesma lógica do calculateAverageMetrics)
    // Prioridade: 1) EBIT, 2) Lucro Bruto - Despesas Operacionais, 3) Operating Income como fallback
    let operatingProfit = ebit;
    if (!operatingProfit && grossProfit > 0 && totalOperatingExpenses > 0) {
      operatingProfit = grossProfit - totalOperatingExpenses;
    } else if (!operatingProfit) {
      operatingProfit = operatingIncomeField; // Fallback
    }

    // Calcular resultado não operacional total
    // Usar financialResult se disponível, senão calcular financialIncome - financialExpenses
    let netFinancialResult = financialResult;
    if (!netFinancialResult && (financialIncome > 0 || financialExpenses > 0)) {
      netFinancialResult = financialIncome - Math.abs(financialExpenses);
    }
    
    // Somar outras receitas não operacionais
    const nonOperationalResult = netFinancialResult + totalOtherIncomeExpenseNet;
    
    // Só analisar se a empresa teve lucro líquido positivo
    if (netIncome > 0) {
      totalYearsAnalyzed++;
      
      // Verificar se o resultado operacional é negativo ou muito baixo
      // e o resultado não operacional é significativo
      if (operatingProfit <= 0) {
        // Caso 1: Resultado operacional negativo, mas lucro líquido positivo
        // Verificar se o resultado não operacional "salvou" a empresa
        if (nonOperationalResult > netIncome * 0.5) {
          problematicYears++;
        }
      } else {
        // Caso 2: Resultado operacional positivo, mas resultado não operacional
        // representa mais de 50% do lucro líquido
        const nonOpPercentage = nonOperationalResult / netIncome;
        if (nonOpPercentage > 0.5) {
          problematicYears++;
        }
      }
    }
  }

  // Se mais da metade dos anos analisados apresentaram o problema
  if (totalYearsAnalyzed >= 2 && problematicYears >= Math.ceil(totalYearsAnalyzed / 2)) {
    const yearsText = totalYearsAnalyzed === 1 ? "ano" : "anos";
    const problematicText = problematicYears === 1 ? "ano" : "anos";
    
    // Aplicar penalização significativa no score
    result.scoreAdjustment -= 200; // Penalização de 400 pontos (alta severidade)
    result.redFlags.push(`Dependência excessiva de resultados não operacionais: em ${problematicText} dos últimos ${totalYearsAnalyzed} ${yearsText}, a maior parte do lucro veio de receitas financeiras ou outras receitas não operacionais, indicando fraqueza na atividade principal`);
  } else if (totalYearsAnalyzed >= 2 && problematicYears > 0) {
    // Penalização menor se apenas alguns anos tiveram o problema
    const yearsText = totalYearsAnalyzed === 1 ? "ano" : "anos";
    result.scoreAdjustment -= 60;
    result.redFlags.push(`Qualidade dos lucros questionável: em ${problematicYears} dos últimos ${totalYearsAnalyzed} ${yearsText}, parte significativa do lucro veio de fontes não operacionais`);
  } else if (totalYearsAnalyzed >= 2) {
    // Sinal positivo se a empresa tem lucros consistentemente operacionais
    result.scoreAdjustment += 25;
    result.positiveSignals.push(`Qualidade dos lucros sólida: A empresa gera seus lucros principalmente através da atividade operacional, demonstrando sustentabilidade do negócio`);
  }

  return result;
}

// Obter contexto setorial
function getSectorContext(sector: string | null, industry: string | null, ticker?: string): SectorContext {
  const sectorLower = sector?.toLowerCase() || '';
  const industryLower = industry?.toLowerCase() || '';
  
  // Log para debug da detecção setorial
  if (ticker && ['ITUB4', 'BBAS3', 'BBSE3', 'SANB11', 'PETR4', 'VALE3', 'MGLU3', 'WEGE3'].includes(ticker.toUpperCase())) {
    console.log(`🔍 DETECÇÃO SETORIAL ${ticker}:`, {
      sector: sector,
      industry: industry,
      sectorLower: sectorLower,
      industryLower: industryLower
    });
  }
  
  // Fallback para tickers financeiros conhecidos (caso setor/indústria não estejam disponíveis)
  const knownFinancialTickers = [
    'BBSE3', 'SULA11', 'PSSA3', 'BBAS3', 'ITUB4', 'SANB11', 'BPAC11', 'BRSR6', 'PINE4', 'WIZS3', 'ABCB4', 'BPAN4',
    'ITSA4', 'PETR4', 'PETR3', 'BBDC3', 'BBDC4', 'CIEL3', 'SMTO3', 'IRBR3', 'CSAN3', 'CYRE3'
  ];
  if (ticker && knownFinancialTickers.includes(ticker.toUpperCase())) {
    const result = {
      type: 'FINANCIAL' as const,
      volatilityTolerance: 'MEDIUM' as const,
      marginExpectation: 'MEDIUM' as const,
      cashIntensive: true
    };
    if (['ITUB4', 'BBAS3', 'BBSE3', 'SANB11', 'PETR4', 'VALE3', 'MGLU3', 'WEGE3'].includes(ticker.toUpperCase())) {
      console.log(`✅ SETOR DETECTADO ${ticker}: ${result.type} (por ticker conhecido)`);
    }
    return result;
  }
  
  // Setor financeiro (expandido com mais termos em português)
  if (sectorLower.includes('financial') || sectorLower.includes('bank') || sectorLower.includes('banco') ||
      sectorLower.includes('financeiro') || sectorLower.includes('seguro') || sectorLower.includes('previdência') ||
      sectorLower.includes('capitalização') || sectorLower.includes('crédito') || sectorLower.includes('investimento') ||
      sectorLower.includes('seguridade') || sectorLower.includes('participações') || sectorLower.includes('holdings') ||
      sectorLower.includes('caixa') || sectorLower.includes('bancário') || sectorLower.includes('vida e previdência') ||
      sectorLower.includes('corretora') || sectorLower.includes('asset management') || sectorLower.includes('gestão de ativos') ||
      industryLower.includes('insurance') || industryLower.includes('seguros') || industryLower.includes('banco') ||
      industryLower.includes('financeiro') || industryLower.includes('previdência') || industryLower.includes('seguro') ||
      industryLower.includes('capitalização') || industryLower.includes('crédito') || industryLower.includes('investimento') ||
      industryLower.includes('corretora') || industryLower.includes('gestão de ativos')) {
    const result = {
      type: 'FINANCIAL' as const,
      volatilityTolerance: 'MEDIUM' as const,
      marginExpectation: 'MEDIUM' as const,
      cashIntensive: true
    };
    if (ticker && ['ITUB4', 'BBAS3', 'BBSE3', 'SANB11', 'PETR4', 'VALE3', 'MGLU3', 'WEGE3'].includes(ticker.toUpperCase())) {
      console.log(`✅ SETOR DETECTADO ${ticker}: ${result.type} (por setor/indústria)`);
    }
    return result;
  }
  
  // Setor de tecnologia
  if (sectorLower.includes('technology') || sectorLower.includes('software') || sectorLower.includes('tecnologia') ||
      sectorLower.includes('informática') || sectorLower.includes('computação') || sectorLower.includes('digital') ||
      industryLower.includes('tech') || industryLower.includes('internet') || industryLower.includes('software') ||
      industryLower.includes('tecnologia') || industryLower.includes('informática') || industryLower.includes('digital')) {
    return {
      type: 'TECH',
      volatilityTolerance: 'HIGH',
      marginExpectation: 'HIGH',
      cashIntensive: false
    };
  }
  
  // Setor cíclico (varejo, automotivo, construção, bens de consumo)
  if (sectorLower.includes('consumer') || sectorLower.includes('retail') || sectorLower.includes('varejo') ||
      sectorLower.includes('automotive') || sectorLower.includes('automotivo') || sectorLower.includes('automóveis') ||
      sectorLower.includes('construction') || sectorLower.includes('construção') || sectorLower.includes('imobiliário') ||
      sectorLower.includes('bens de consumo') || sectorLower.includes('consumo cíclico') || sectorLower.includes('têxtil') ||
      industryLower.includes('varejo') || industryLower.includes('automotivo') || industryLower.includes('construção') ||
      industryLower.includes('imobiliário') || industryLower.includes('têxtil') || industryLower.includes('consumo')) {
    return {
      type: 'CYCLICAL',
      volatilityTolerance: 'HIGH',
      marginExpectation: 'MEDIUM',
      cashIntensive: false
    };
  }
  
  // Setor defensivo (utilities, saúde, alimentos, saneamento)
  if (sectorLower.includes('utilities') || sectorLower.includes('healthcare') || sectorLower.includes('saúde') ||
      sectorLower.includes('food') || sectorLower.includes('alimentos') || sectorLower.includes('bebidas') ||
      sectorLower.includes('pharmaceutical') || sectorLower.includes('farmacêutico') || sectorLower.includes('medicamentos') ||
      sectorLower.includes('saneamento') || sectorLower.includes('energia elétrica') || sectorLower.includes('água') ||
      sectorLower.includes('consumo não cíclico') || sectorLower.includes('bens essenciais') ||
      industryLower.includes('saúde') || industryLower.includes('alimentos') || industryLower.includes('bebidas') ||
      industryLower.includes('farmacêutico') || industryLower.includes('saneamento') || industryLower.includes('energia')) {
    return {
      type: 'DEFENSIVE',
      volatilityTolerance: 'LOW',
      marginExpectation: 'MEDIUM',
      cashIntensive: false
    };
  }
  
  // Commodities (materiais básicos, mineração, petróleo, siderurgia)
  if (sectorLower.includes('materials') || sectorLower.includes('mining') || sectorLower.includes('mineração') ||
      sectorLower.includes('oil') || sectorLower.includes('petróleo') || sectorLower.includes('energia') ||
      sectorLower.includes('steel') || sectorLower.includes('siderurgia') || sectorLower.includes('metalurgia') ||
      sectorLower.includes('materiais básicos') || sectorLower.includes('papel e celulose') || sectorLower.includes('químico') ||
      sectorLower.includes('agronegócio') || sectorLower.includes('commodities') ||
      industryLower.includes('mineração') || industryLower.includes('petróleo') || industryLower.includes('siderurgia') ||
      industryLower.includes('metalurgia') || industryLower.includes('papel') || industryLower.includes('celulose') ||
      industryLower.includes('químico') || industryLower.includes('agronegócio')) {
    return {
      type: 'COMMODITY',
      volatilityTolerance: 'HIGH',
      marginExpectation: 'LOW',
      cashIntensive: false
    };
  }
  
  // Telecomunicações e Comunicação
  if (sectorLower.includes('communication') || sectorLower.includes('telecommunications') || sectorLower.includes('telecomunicações') ||
      sectorLower.includes('telecom') || sectorLower.includes('telefonia') || sectorLower.includes('internet') ||
      sectorLower.includes('mídia') || sectorLower.includes('media') || sectorLower.includes('comunicação') ||
      industryLower.includes('telecomunicações') || industryLower.includes('telecom') || industryLower.includes('telefonia') ||
      industryLower.includes('internet') || industryLower.includes('mídia') || industryLower.includes('comunicação')) {
    return {
      type: 'DEFENSIVE',
      volatilityTolerance: 'MEDIUM',
      marginExpectation: 'MEDIUM',
      cashIntensive: false
    };
  }
  
  // Transporte e Logística
  if (sectorLower.includes('transportation') || sectorLower.includes('logistics') || sectorLower.includes('transporte') ||
      sectorLower.includes('logística') || sectorLower.includes('aviação') || sectorLower.includes('portuário') ||
      sectorLower.includes('ferroviário') || sectorLower.includes('rodoviário') || sectorLower.includes('shipping') ||
      industryLower.includes('transporte') || industryLower.includes('logística') || industryLower.includes('aviação') ||
      industryLower.includes('portuário') || industryLower.includes('ferroviário') || industryLower.includes('rodoviário')) {
    return {
      type: 'CYCLICAL',
      volatilityTolerance: 'HIGH',
      marginExpectation: 'MEDIUM',
      cashIntensive: false
    };
  }
  
  const result = {
    type: 'OTHER' as const,
    volatilityTolerance: 'MEDIUM' as const,
    marginExpectation: 'MEDIUM' as const,
    cashIntensive: false
  };
  
  // Log do resultado final para debug
  if (ticker && ['ITUB4', 'BBAS3', 'BBSE3', 'SANB11', 'PETR4', 'VALE3', 'MGLU3', 'WEGE3'].includes(ticker.toUpperCase())) {
    console.log(`✅ SETOR DETECTADO ${ticker}: ${result.type}`);
  }
  
  return result;
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
    
    // Análise de lucro anual - CORRIGIDA PARA EVITAR CONTRADIÇÕES
    if (previousYearProfit !== 0 && currentProfit !== 0) {
      validProfitComparisons++;
      
      // REGRA 1: Só considerar "crescimento" se AMBOS os lucros forem POSITIVOS
      if (previousYearProfit > 0 && currentProfit > 0) {
        const profitChange = (currentProfit - previousYearProfit) / previousYearProfit;
        if (profitChange > 0.1) { // Crescimento > 10%
          profitGrowthCount++;
        } else if (profitChange < -0.1) { // Declínio > 10%
          profitDeclineCount++;
        }
      }
      // REGRA 2: Se ambos forem negativos, sempre considerar como declínio
      else if (previousYearProfit < 0 && currentProfit < 0) {
        profitDeclineCount++; // Prejuízos consistentes = declínio
      }
      // REGRA 3: Transição de prejuízo para lucro = crescimento
      else if (previousYearProfit < 0 && currentProfit > 0) {
        profitGrowthCount++; // Saiu do prejuízo = crescimento real
      }
      // REGRA 4: Transição de lucro para prejuízo = declínio severo
      else if (previousYearProfit > 0 && currentProfit < 0) {
        profitDeclineCount++; // Entrou em prejuízo = declínio severo
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
  sectorContext: SectorContext,
  incomeStatements?: Record<string, unknown>[]
): AnalysisResult {
  const result: AnalysisResult = {
    scoreAdjustment: 0,
    redFlags: [],
    positiveSignals: []
  };

  if (balanceSheets.length < 2) return result;

  // ===== ANÁLISE DE LUCRO (OBRIGATÓRIA E MAIOR PESO) =====
  // Lucro é fundamental - empresa sem lucro consistente não pode ter score alto
  if (incomeStatements && incomeStatements.length > 0) {
    // Verificar lucros dos últimos anos
    const recentProfits = incomeStatements.slice(0, Math.min(3, incomeStatements.length))
      .map(stmt => toNumber(stmt.netIncome))
      .filter(profit => profit !== null) as number[];
    
    const negativeProfitYears = recentProfits.filter(profit => profit <= 0).length;
    const totalYears = recentProfits.length;
    
    if (totalYears === 0) {
      // Sem dados de lucro - penalidade severa
      result.scoreAdjustment -= 40;
      result.redFlags.push('Dados de lucro não disponíveis - análise comprometida');
    } else if (negativeProfitYears === totalYears) {
      // Todos os anos com prejuízo - penalidade máxima
      result.scoreAdjustment -= 60;
      result.redFlags.push('Empresa com prejuízos consistentes - inviável para investimento');
    } else if (negativeProfitYears >= totalYears * 0.67) {
      // Maioria dos anos com prejuízo - penalidade alta
      result.scoreAdjustment -= 45;
      result.redFlags.push('Empresa com prejuízos frequentes - alta instabilidade');
    } else if (negativeProfitYears > 0) {
      // Alguns anos com prejuízo - penalidade moderada
      result.scoreAdjustment -= 25;
      result.redFlags.push('Empresa com prejuízos ocasionais - risco elevado');
    } else {
      // Todos os anos com lucro - bônus
      result.scoreAdjustment += 10;
      result.positiveSignals.push('Empresa com lucros consistentes');
      
      // Bônus adicional para crescimento do lucro
      if (recentProfits.length >= 2) {
        const latestProfit = recentProfits[0];
        const previousProfit = recentProfits[1];
        if (latestProfit > previousProfit && previousProfit > 0) {
          const growthRate = (latestProfit - previousProfit) / previousProfit;
          if (growthRate > 0.15) {
            result.scoreAdjustment += 8;
            result.positiveSignals.push('Crescimento acelerado dos lucros');
          } else if (growthRate > 0.05) {
            result.scoreAdjustment += 5;
            result.positiveSignals.push('Crescimento sólido dos lucros');
          }
        }
      }
    }
  } else {
    // Sem dados de demonstrativo de resultado - penalidade severa
    result.scoreAdjustment -= 35;
    result.redFlags.push('Demonstrativo de resultado não disponível - análise comprometida');
  }

  // ===== ANÁLISE DE ENDIVIDAMENTO (PESO MENOR QUE LUCRO) =====
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
  // PESO REDUZIDO: Lucro é mais importante que endividamento
  if (currentDebtRatio !== null) {
    if (currentDebtRatio > criticalDebtThreshold) {
      if (companyStrength === 'VERY_STRONG') {
        result.scoreAdjustment -= 8; // Penalidade menor para empresas muito fortes
      } else {
        result.scoreAdjustment -= 15; // Reduzido de 25 para 15
        result.redFlags.push('Endividamento excessivo');
      }
    } else if (currentDebtRatio > highDebtThreshold) {
      if (companyStrength === 'WEAK') {
        result.scoreAdjustment -= 10; // Reduzido de 15 para 10
        result.redFlags.push('Alto endividamento em empresa frágil');
      } else {
        result.scoreAdjustment -= 5; // Reduzido de 8 para 5
      }
    } else if (currentDebtRatio < 0.3) {
      result.scoreAdjustment += 3; // Reduzido de 5 para 3
      result.positiveSignals.push('Endividamento controlado');
    }
  } else {
    // Se não temos dados de endividamento, dar benefício da dúvida
    result.contextualFactors?.push('Dados de endividamento não disponíveis - benefício da dúvida aplicado');
    // REMOVIDO: Não adicionar como ponto forte se não temos dados
    // Uma empresa com prejuízos não deve ter "endividamento controlado" como ponto forte
  }

  // Avaliar crescimento do endividamento - só se temos dados válidos
  // PESO REDUZIDO: Lucro é mais importante que crescimento da dívida
  if (currentDebtRatio !== null && previousDebtRatio !== null) {
    const debtGrowth = currentDebtRatio - previousDebtRatio;
    if (debtGrowth > 0.15) {
      if (companyStrength === 'VERY_STRONG' || companyStrength === 'STRONG') {
        result.scoreAdjustment -= 5; // Reduzido de 8 para 5
      } else {
        result.scoreAdjustment -= 10; // Reduzido de 15 para 10
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
  const latestProfit = toNumber(latest.income.netIncome) || 0;
  
  if (assetTurnover > 1.0) {
    result.scoreAdjustment += 3;
    // Só considerar ponto forte se a empresa for lucrativa
    if (latestProfit > 0) {
      result.positiveSignals.push('Boa eficiência no uso de ativos');
    } else {
      result.contextualFactors?.push('Alta rotação de ativos, mas sem conversão em lucro');
    }
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
    } else if (strategies.graham.fairValue) {
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
    } else if (strategies.fcd.fairValue) {
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
    } else if (strategies.gordon.fairValue) {
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
    recommendation = 'Empresa Excelente';
  } else if (finalScore >= 90) {
    grade = 'A';
    classification = 'Excelente';
    recommendation = 'Empresa Excelente';
  } else if (finalScore >= 85) {
    grade = 'A-';
    classification = 'Muito Bom';
    recommendation = 'Empresa Excelente';
  } else if (finalScore >= 80) {
    grade = 'B+';
    classification = 'Muito Bom';
    recommendation = 'Empresa Boa';
  } else if (finalScore >= 75) {
    grade = 'B';
    classification = 'Bom';
    recommendation = 'Empresa Boa';
  } else if (finalScore >= 70) {
    grade = 'B-';
    classification = 'Bom';
    recommendation = 'Empresa Boa';
  } else if (finalScore >= 65) {
    grade = 'C+';
    classification = 'Regular';
    recommendation = 'Empresa Regular';
  } else if (finalScore >= 60) {
    grade = 'C';
    classification = 'Regular';
    recommendation = 'Empresa Regular';
  } else if (finalScore >= 50) {
    grade = 'C-';
    classification = 'Regular';
    recommendation = 'Empresa Regular';
  } else if (finalScore >= 30) {
    grade = 'D';
    classification = 'Fraco';
    recommendation = 'Empresa Fraca';
  } else {
    grade = 'F';
    classification = 'Péssimo';
    recommendation = 'Empresa Péssima';
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
