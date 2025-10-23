/**
 * Serviço centralizado para cálculo do breakdown do score
 * Usado tanto na página "entendendo-score" quanto no sistema de monitoramento
 */

import { calculateCompanyOverallScore } from '@/lib/calculate-company-score-service';
import { prisma } from '@/lib/prisma';

export interface OverallScoreBreakdown {
  score: number;
  grade: string;
  classification: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  contributions: {
    name: string;
    score: number;
    weight: number;
    points: number;
    eligible: boolean;
    description: string;
  }[];
  penalties?: {
    reason: string;
    amount: number;
    details?: string[]; // Detalhes específicos (red flags, contradições, etc)
  }[];
  rawScore: number; // Score antes das penalidades
}

/**
 * Calcula o breakdown detalhado do score de uma empresa
 * FUNÇÃO CENTRALIZADA - usada em múltiplos lugares
 */
export async function getScoreBreakdown(ticker: string, isPremium: boolean, isLoggedIn: boolean): Promise<OverallScoreBreakdown | null> {
  try {
    // SEMPRE buscar dados completos (mesmo para não-premium) para mostrar a página
    // A proteção será feita no overlay visual, não no fetch de dados
    // Os parâmetros isPremium/isLoggedIn são recebidos mas não usados (prefixados com _)
    const analysisResult = await calculateCompanyOverallScore(ticker, {
      isPremium: true, // ← Sempre buscar dados completos
      isLoggedIn: true,
      includeStatements: true, // ← Sempre incluir statements
      includeStrategies: true
    });

    if (!analysisResult || !analysisResult.overallScore) {
      return null;
    }

    // Buscar análise do YouTube separadamente (se disponível)
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      include: {
        youtubeAnalyses: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    const youtubeAnalysis = company?.youtubeAnalyses[0] ? {
      score: typeof company.youtubeAnalyses[0].score === 'object' 
        ? (company.youtubeAnalyses[0].score as any).toNumber() 
        : Number(company.youtubeAnalyses[0].score)
    } : null;

    const data = {
      overallScore: analysisResult.overallScore,
      strategies: analysisResult.strategies
    };

    // Calcular contribuições (mesma lógica do cálculo original)
    const hasYouTubeAnalysis = !!youtubeAnalysis;
    const baseMultiplier = hasYouTubeAnalysis ? 0.90 : 1.00;
    
    const weights = {
      graham: { weight: 0.08 * baseMultiplier, label: 'Graham (Valor Intrínseco)' },
      dividendYield: { weight: 0.08 * baseMultiplier, label: 'Dividend Yield' },
      lowPE: { weight: 0.15 * baseMultiplier, label: 'Low P/E' },
      magicFormula: { weight: 0.13 * baseMultiplier, label: 'Fórmula Mágica' },
      fcd: { weight: 0.15 * baseMultiplier, label: 'Fluxo de Caixa Descontado' },
      gordon: { weight: 0.01 * baseMultiplier, label: 'Gordon (Dividendos)' },
      fundamentalist: { weight: 0.20 * baseMultiplier, label: 'Fundamentalista 3+1' },
      statements: { weight: 0.20 * baseMultiplier, label: 'Demonstrações Financeiras' },
      youtube: { weight: hasYouTubeAnalysis ? 0.10 : 0, label: 'Sentimento de Mercado' }
    };

    const contributions = [];
    let rawScore = 0;

    // Adicionar contribuições de estratégias (se disponíveis na resposta)
    if (data.strategies) {
      const strategyKeys = ['graham', 'dividendYield', 'lowPE', 'magicFormula', 'fcd', 'gordon', 'fundamentalist'] as const;
      
      strategyKeys.forEach((key) => {
        const strategy = data.strategies?.[key];
        const config = weights[key];
        
        if (strategy && config) {
          const points = strategy.score * config.weight;
          rawScore += points;
          
          contributions.push({
            name: config.label,
            score: strategy.score,
            weight: config.weight,
            points,
            eligible: strategy.isEligible || false,
            description: getStrategyDescription(key)
          });
        }
      });
    }

    // Adicionar Demonstrações Financeiras
    if (data.overallScore.statementsAnalysis) {
      const statementsScore = data.overallScore.statementsAnalysis.score;
      const points = statementsScore * weights.statements.weight;
      rawScore += points;
      
      contributions.push({
        name: weights.statements.label,
        score: statementsScore,
        weight: weights.statements.weight,
        points,
        eligible: statementsScore >= 60,
        description: 'Análise profunda dos balanços, DRE e demonstrações de fluxo de caixa'
      });
    }

    // Adicionar YouTube se disponível
    if (hasYouTubeAnalysis && youtubeAnalysis) {
      const youtubeScore = youtubeAnalysis.score;
      const points = youtubeScore * weights.youtube.weight;
      rawScore += points;
      
      contributions.push({
        name: weights.youtube.label,
        score: youtubeScore,
        weight: weights.youtube.weight,
        points,
        eligible: youtubeScore >= 70,
        description: 'Sentimento agregado de múltiplas fontes especializadas de mercado'
      });
    }

    // Ordenar por contribuição
    contributions.sort((a, b) => b.points - a.points);

    // Calcular penalidades e extrair detalhes
    const penalties = [];
    const finalScore = data.overallScore.score;
    const penaltyAmount = rawScore - finalScore;

    if (penaltyAmount > 0.5) {
      // Coletar detalhes das penalidades
      const penaltyDetails: string[] = [];
      
      // Red flags das demonstrações financeiras
      if (data.overallScore.statementsAnalysis?.redFlags) {
        const redFlags = data.overallScore.statementsAnalysis.redFlags;
        if (redFlags.length > 0) {
          penaltyDetails.push(`🚩 ${redFlags.length} alerta(s) crítico(s) identificado(s):`);
          redFlags.forEach(flag => {
            penaltyDetails.push(`   • ${flag}`);
          });
        }
      }

      // Weaknesses do overall score
      if (data.overallScore.weaknesses && data.overallScore.weaknesses.length > 0) {
        const weaknessCount = data.overallScore.weaknesses.length;
        const strengthCount = data.overallScore.strengths?.length || 0;
        
        if (weaknessCount > strengthCount) {
          penaltyDetails.push(`⚠️ Proporção desfavorável: ${weaknessCount} pontos fracos vs ${strengthCount} pontos fortes`);
        }
      }

      // Nível de risco
      if (data.overallScore.statementsAnalysis?.riskLevel) {
        const riskLevel = data.overallScore.statementsAnalysis.riskLevel;
        if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
          penaltyDetails.push(`⚠️ Nível de risco: ${riskLevel === 'HIGH' ? 'ALTO' : 'CRÍTICO'}`);
        }
      }

      // Força da empresa com detalhamento
      if (data.overallScore.statementsAnalysis?.companyStrength) {
        const strength = data.overallScore.statementsAnalysis.companyStrength;
        const contextualFactors = data.overallScore.statementsAnalysis.contextualFactors || [];
        
        // Debug: log dos contextual factors
        console.log(`[DEBUG] Company Strength: ${strength}`);
        console.log(`[DEBUG] Contextual Factors (${contextualFactors.length}):`, contextualFactors);
        
        if (strength === 'WEAK' || strength === 'MODERATE') {
          penaltyDetails.push('');
          penaltyDetails.push(`⚠️ Força Fundamentalista: ${strength === 'WEAK' ? 'FRACA' : 'MODERADA'}`);
          
          // Adicionar TODOS os fatores contextuais disponíveis
          if (contextualFactors.length > 0) {
            penaltyDetails.push('Análise detalhada dos fundamentos:');
            // Mostrar todos os fatores sem filtro
            contextualFactors.forEach(factor => {
              penaltyDetails.push(`   • ${factor}`);
            });
          } else {
            // Se não há contextualFactors, adicionar análise baseada nos dados brutos
            penaltyDetails.push('Análise dos fundamentos:');
            
            // Extrair weaknesses do overallScore
            if (data.overallScore.weaknesses && data.overallScore.weaknesses.length > 0) {
              data.overallScore.weaknesses.slice(0, 5).forEach(weakness => {
                penaltyDetails.push(`   • ${weakness}`);
              });
            } else {
              penaltyDetails.push('   • Indicadores fundamentalistas abaixo do esperado');
              penaltyDetails.push('   • Empresa não atende critérios de qualidade mínima');
            }
          }
        }
      }

      // Se não há detalhes específicos, adicionar mensagem genérica
      if (penaltyDetails.length === 0) {
        penaltyDetails.push('Ajustes conservadores baseados na análise qualitativa');
      }

      penalties.push({
        reason: 'Penalidades por Qualidade e Riscos Identificados',
        amount: -penaltyAmount,
        details: penaltyDetails
      });
    }

    return {
      score: finalScore,
      grade: data.overallScore.grade,
      classification: data.overallScore.classification,
      strengths: data.overallScore.strengths || [],
      weaknesses: data.overallScore.weaknesses || [],
      recommendation: data.overallScore.recommendation,
      contributions,
      penalties: penalties.length > 0 ? penalties : undefined,
      rawScore
    };
  } catch (error) {
    console.error('Erro ao buscar breakdown do score:', error);
    return null;
  }
}

function getStrategyDescription(key: string): string {
  const descriptions: Record<string, string> = {
    graham: 'Avalia se a ação está sendo negociada abaixo do seu valor intrínseco calculado',
    dividendYield: 'Analisa a qualidade e sustentabilidade dos dividendos pagos',
    lowPE: 'Verifica se o P/L está abaixo da média do setor indicando subavaliação',
    magicFormula: 'Combina ROE elevado com P/L baixo para identificar boas empresas baratas',
    fcd: 'Calcula o valor presente dos fluxos de caixa futuros da empresa',
    gordon: 'Valuation baseado no crescimento perpétuo de dividendos',
    fundamentalist: 'Análise completa de qualidade, preço, endividamento e dividendos'
  };
  return descriptions[key] || '';
}