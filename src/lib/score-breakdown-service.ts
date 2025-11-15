/**
 * Serviço centralizado para cálculo do breakdown do score
 * Usado tanto na página "entendendo-score" quanto no sistema de monitoramento
 * 
 * ATUALIZADO: Agora usa o breakdown calculado diretamente do calculateOverallScore()
 * para garantir consistência total com a tela principal (/acao/ticker)
 */

import { calculateCompanyOverallScore } from '@/lib/calculate-company-score-service';
import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/strategies';
import { OverallScoreWithBreakdown } from '@/lib/strategies/overall-score';

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
      includeStrategies: true,
      includeBreakdown: true // ← IMPORTANTE: Solicitar breakdown do calculateOverallScore
    });

    if (!analysisResult || !analysisResult.overallScore) {
      return null;
    }

    // O overallScore agora já vem com breakdown incluído (OverallScoreWithBreakdown)
    const overallScoreWithBreakdown = analysisResult.overallScore as OverallScoreWithBreakdown;
    
    // Verificar se tem breakdown (deve ter se includeBreakdown foi true)
    if (!overallScoreWithBreakdown.contributions || overallScoreWithBreakdown.rawScore === undefined) {
      console.warn(`⚠️ Breakdown não disponível para ${ticker} - retornando null`);
      return null;
    }

    const rawScore = overallScoreWithBreakdown.rawScore;
    const finalScore = overallScoreWithBreakdown.score;
    const penaltyAmount = rawScore - finalScore;
    
    // Calcular penalidades e extrair detalhes
    const penalties = [];

    if (penaltyAmount > 0.5) {
      // Coletar detalhes das penalidades
      const penaltyDetails: string[] = [];
      
      // Red flags das demonstrações financeiras
      if (overallScoreWithBreakdown.statementsAnalysis?.redFlags) {
        const redFlags = overallScoreWithBreakdown.statementsAnalysis.redFlags;
        if (redFlags.length > 0) {
          penaltyDetails.push(`🚩 ${redFlags.length} alerta(s) crítico(s) identificado(s):`);
          redFlags.forEach(flag => {
            penaltyDetails.push(`   • ${flag}`);
          });
        }
      }

      // Weaknesses do overall score
      if (overallScoreWithBreakdown.weaknesses && overallScoreWithBreakdown.weaknesses.length > 0) {
        const weaknessCount = overallScoreWithBreakdown.weaknesses.length;
        const strengthCount = overallScoreWithBreakdown.strengths?.length || 0;
        
        if (weaknessCount > strengthCount) {
          penaltyDetails.push(`⚠️ Proporção desfavorável: ${weaknessCount} pontos fracos vs ${strengthCount} pontos fortes`);
        }
      }

      // Nível de risco
      if (overallScoreWithBreakdown.statementsAnalysis?.riskLevel) {
        const riskLevel = overallScoreWithBreakdown.statementsAnalysis.riskLevel;
        if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
          penaltyDetails.push(`⚠️ Nível de risco: ${riskLevel === 'HIGH' ? 'ALTO' : 'CRÍTICO'}`);
        }
      }

      // Força da empresa com detalhamento
      if (overallScoreWithBreakdown.statementsAnalysis?.companyStrength) {
        const strength = overallScoreWithBreakdown.statementsAnalysis.companyStrength;
        const contextualFactors = overallScoreWithBreakdown.statementsAnalysis.contextualFactors || [];
        
        if (strength === 'WEAK' || strength === 'MODERATE') {
          penaltyDetails.push('');
          penaltyDetails.push(`⚠️ Força Fundamentalista: ${strength === 'WEAK' ? 'FRACA' : 'MODERADA'}`);
          
          // Adicionar TODOS os fatores contextuais disponíveis
          if (contextualFactors.length > 0) {
            penaltyDetails.push('Análise detalhada dos fundamentos:');
            contextualFactors.forEach(factor => {
              penaltyDetails.push(`   • ${factor}`);
            });
          } else {
            // Se não há contextualFactors, adicionar análise baseada nos dados brutos
            penaltyDetails.push('Análise dos fundamentos:');
            
            // Extrair weaknesses do overallScore
            if (overallScoreWithBreakdown.weaknesses && overallScoreWithBreakdown.weaknesses.length > 0) {
              overallScoreWithBreakdown.weaknesses.slice(0, 5).forEach(weakness => {
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
      grade: overallScoreWithBreakdown.grade,
      classification: overallScoreWithBreakdown.classification,
      strengths: overallScoreWithBreakdown.strengths || [],
      weaknesses: overallScoreWithBreakdown.weaknesses || [],
      recommendation: overallScoreWithBreakdown.recommendation,
      contributions: overallScoreWithBreakdown.contributions.map(c => ({
        name: c.name,
        score: c.score,
        weight: c.weight,
        points: c.points,
        eligible: c.eligible,
        description: c.description || ''
      })),
      penalties: penalties.length > 0 ? penalties : undefined,
      rawScore
    };
  } catch (error) {
    console.error('Erro ao buscar breakdown do score:', error);
    return null;
  }
}

// Função removida - descrições agora vêm diretamente do calculateOverallScore()