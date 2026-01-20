/**
 * Serviço para calcular a composição detalhada da nota de uma empresa
 * Usa a função centralizada getScoreBreakdown para evitar duplicação de código
 */

import { getScoreBreakdown } from '@/lib/score-breakdown-service';

export interface ScoreComponent {
  name: string;
  score: number;
  weight: number;
  points: number;
  eligible: boolean;
  description: string;
  category: 'strategy' | 'statements' | 'youtube';
}

export interface ScoreComposition {
  score: number; // Score final (após penalidades)
  rawScore: number; // Score antes das penalidades
  contributions: ScoreComponent[];
  penalties?: {
    reason: string;
    amount: number;
    details?: string[];
  }[];
  methodology: string;
}

/**
 * Calcula a composição detalhada da nota usando a função centralizada getScoreBreakdown
 * Garante consistência total com a página "entendendo-score"
 */
export async function calculateScoreComposition(
  ticker: string
): Promise<ScoreComposition | null> {
  try {
    // Usar a função centralizada para garantir consistência
    const breakdown = await getScoreBreakdown(ticker, true, true);
    
    if (!breakdown) {
      return null;
    }

    // Converter para o formato esperado pelo sistema de monitoramento
    const contributions: ScoreComponent[] = breakdown.contributions.map(contrib => ({
      name: contrib.name,
      score: contrib.score,
      weight: contrib.weight,
      points: contrib.points,
      eligible: contrib.eligible,
      description: contrib.description,
      category: getCategoryFromName(contrib.name)
    }));

    const composition: ScoreComposition = {
      score: breakdown.score,
      rawScore: breakdown.rawScore,
      contributions,
      penalties: breakdown.penalties,
      methodology: 'Score calculado pela soma ponderada das contribuições de cada estratégia, com penalidades aplicadas quando há contradições ou alertas críticos'
    };

    // Log de validação (remover após confirmação)
    if (composition.penalties && composition.penalties.length > 0) {
      const totalPenalty = composition.rawScore - composition.score;
      console.log(`[SCORE-COMPOSITION] ${ticker}: Penalidades incluídas -`, {
        penaltiesCount: composition.penalties.length,
        totalPenalty: totalPenalty.toFixed(1),
        rawScore: composition.rawScore.toFixed(1),
        finalScore: composition.score.toFixed(1),
        penalties: composition.penalties.map(p => ({ reason: p.reason, amount: p.amount.toFixed(1) }))
      });
    }

    return composition;
  } catch (error) {
    console.error('Erro ao calcular composição do score:', error);
    return null;
  }
}

/**
 * Determina a categoria baseada no nome da contribuição
 */
function getCategoryFromName(name: string): 'strategy' | 'statements' | 'youtube' {
  if (name === 'Demonstrações Financeiras') {
    return 'statements';
  }
  if (name === 'Sentimento de Mercado') {
    return 'youtube';
  }
  return 'strategy';
}

/**
 * Compara duas composições de score e identifica as principais mudanças
 */
export function compareScoreCompositions(
  previous: ScoreComposition,
  current: ScoreComposition,
  threshold: number = 2
): {
  significantChanges: Array<{
    component: string;
    previousScore: number;
    currentScore: number;
    previousPoints: number;
    currentPoints: number;
    impact: number;
    category: string;
  }>;
  categoryChanges: Record<string, number>;
  totalImpact: number;
  penaltyChanges?: {
    previousPenalty: number;
    currentPenalty: number;
    penaltyDiff: number;
  };
} {
  const significantChanges: any[] = [];
  
  // Comparar contribuições individuais
  current.contributions.forEach(currentComp => {
    const previousComp = previous.contributions.find(p => p.name === currentComp.name);
    if (previousComp) {
      const pointsDiff = currentComp.points - previousComp.points;
      
      if (Math.abs(pointsDiff) >= threshold) {
        significantChanges.push({
          component: currentComp.name,
          previousScore: previousComp.score,
          currentScore: currentComp.score,
          previousPoints: previousComp.points,
          currentPoints: currentComp.points,
          impact: pointsDiff,
          category: currentComp.category,
        });
      }
    }
  });
  
  // Calcular mudanças por categoria
  const categoryChanges: Record<string, number> = {};
  const categories = ['strategy', 'statements', 'youtube'];
  
  categories.forEach(category => {
    const previousTotal = previous.contributions
      .filter(c => c.category === category)
      .reduce((sum, c) => sum + c.points, 0);
    
    const currentTotal = current.contributions
      .filter(c => c.category === category)
      .reduce((sum, c) => sum + c.points, 0);
    
    const diff = currentTotal - previousTotal;
    if (Math.abs(diff) >= 0.5) {
      categoryChanges[category] = diff;
    }
  });
  
  const totalImpact = current.score - previous.score;
  
  // Analisar mudanças nas penalidades
  const previousPenalty = previous.rawScore - previous.score;
  const currentPenalty = current.rawScore - current.score;
  const penaltyDiff = currentPenalty - previousPenalty;
  
  const penaltyChanges = Math.abs(penaltyDiff) >= 0.5 ? {
    previousPenalty,
    currentPenalty,
    penaltyDiff
  } : undefined;
  
  // Ordenar por impacto absoluto
  significantChanges.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  
  return {
    significantChanges,
    categoryChanges,
    totalImpact,
    penaltyChanges,
  };
}