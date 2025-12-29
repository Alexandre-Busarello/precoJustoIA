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
  flagPenalty?: {
    value: number;
    reason: string;
    flagId: string;
    reportId?: string;
  };
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
    
    // Verificar se há penalização de flag
    const flagPenalty = (overallScoreWithBreakdown as any).penaltyInfo;
    const flagPenaltyAmount = flagPenalty?.applied ? Math.abs(flagPenalty.value) : 0;
    
    // Calcular penalidades gerais (excluindo penalização de flag)
    // O rawScore não inclui a penalização de flag, então:
    // finalScore = rawScore - outrasPenalidades - flagPenalty
    // Portanto: outrasPenalidades = rawScore - finalScore - flagPenalty
    const totalPenaltyAmount = rawScore - finalScore;
    const generalPenaltyAmount = totalPenaltyAmount - flagPenaltyAmount;
    
    // Calcular penalidades e extrair detalhes
    const penalties = [];

    if (generalPenaltyAmount > 0.5) {
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
        amount: -generalPenaltyAmount,
        details: penaltyDetails
      });
    }

    // Buscar reportId e reason do flag se existir
    let flagReportId: string | undefined;
    let flagReason = flagPenalty?.reason || '';
    
    if (flagPenalty?.flagId) {
      try {
        const flag = await prisma.companyFlag.findUnique({
          where: { id: flagPenalty.flagId },
          select: { 
            reportId: true,
            reason: true,
            report: {
              select: {
                id: true,
                content: true,
                type: true,
              }
            }
          }
        });
        
        if (flag) {
          flagReportId = flag.reportId;
          
          // Se o reason for um código (como "PERDA_DE_FUNDAMENTO"), tentar extrair trecho do relatório
          if (flag.reason && flag.report && flag.report.content) {
            flagReason = flag.reason;
            
            // Verificar se o reason é um código (contém apenas letras maiúsculas, números e underscore)
            const isCodePattern = /^[A-Z0-9_]+$/.test(flagReason);
            
            if (isCodePattern) {
              // Tentar extrair o raciocínio da análise do relatório
              const reportContent = flag.report.content;
              
              // Para PRICE_VARIATION, buscar a seção "Raciocínio:" após "### Sobre a Queda de Preço"
              if (flag.report.type === 'PRICE_VARIATION') {
                const reasoningMatch = reportContent.match(/## Análise de Impacto Fundamental[\s\S]*?### Sobre a Queda de Preço[\s\S]*?\*\*Raciocínio\*\*:\s*([\s\S]*?)(?=\n##|\n###|$)/i);
                if (reasoningMatch && reasoningMatch[1]) {
                  let reasoning = reasoningMatch[1].trim();
                  // Limitar tamanho e remover markdown excessivo
                  if (reasoning.length > 300) {
                    reasoning = reasoning.substring(0, 297) + '...';
                  }
                  // Remover múltiplas quebras de linha
                  reasoning = reasoning.replace(/\n{3,}/g, '\n\n');
                  flagReason = reasoning;
                } else {
                  // Fallback: buscar qualquer texto após a conclusão
                  const conclusionMatch = reportContent.match(/## Análise de Impacto Fundamental[\s\S]*?\*\*Conclusão\*\*:[^\n]*\n([\s\S]{100,500})/i);
                  if (conclusionMatch && conclusionMatch[1]) {
                    let fallbackText = conclusionMatch[1].trim();
                    if (fallbackText.length > 300) {
                      fallbackText = fallbackText.substring(0, 297) + '...';
                    }
                    flagReason = fallbackText.replace(/\n{3,}/g, '\n\n');
                  }
                }
              } else {
                // Para outros tipos de relatório, buscar primeiro parágrafo significativo
                const firstParagraphMatch = reportContent.match(/\n\n([^\n]{50,300})/);
                if (firstParagraphMatch && firstParagraphMatch[1]) {
                  flagReason = firstParagraphMatch[1].trim();
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('Erro ao buscar reportId do flag:', error);
      }
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
      rawScore,
      flagPenalty: flagPenalty?.applied ? {
        value: flagPenalty.value,
        reason: flagReason, // Usar reason extraído do relatório se necessário
        flagId: flagPenalty.flagId,
        reportId: flagReportId
      } : undefined
    };
  } catch (error) {
    console.error('Erro ao buscar breakdown do score:', error);
    return null;
  }
}

// Função removida - descrições agora vêm diretamente do calculateOverallScore()