/**
 * Serviço de Lógica para Radar de Oportunidades
 * 
 * Contém funções para calcular scores compostos, determinar status de semáforo,
 * e processar dados para exibição no radar.
 */

import { StrategyAnalysis } from './strategies';
import { TechnicalAnalysisData } from './technical-analysis-service';

export interface RadarScoreComponents {
  solidez: number; // 0-100 (Overall Score)
  valuation: number; // 0-100 (melhor upside normalizado)
  estrategia: number; // 0-100 (% de estratégias aprovadas)
  timing: number; // 0-100 (baseado em entry point técnico)
}

export interface RadarCompositeScore {
  score: number; // Score composto final (0-100)
  components: RadarScoreComponents;
}

/**
 * Calcula score composto para ranking "Explorar"
 * 
 * Pesos:
 * - Solidez (30%): Overall Score
 * - Valuation (25%): Melhor upside entre estratégias
 * - Estratégia (25%): % de estratégias aprovadas
 * - Timing (20%): Baseado em entry point técnico
 */
export function calculateRadarScore(
  overallScore: number | null,
  strategies: {
    graham: StrategyAnalysis | null;
    fcd: StrategyAnalysis | null;
    gordon: StrategyAnalysis | null;
    dividendYield: StrategyAnalysis | null;
    lowPE: StrategyAnalysis | null;
    magicFormula: StrategyAnalysis | null;
    fundamentalist: StrategyAnalysis | null;
    barsi: StrategyAnalysis | null;
  },
  technicalAnalysis: TechnicalAnalysisData | null,
  currentPrice: number
): RadarCompositeScore {
  // 1. Solidez (30%) - Overall Score
  const solidez = overallScore || 0;

  // 2. Valuation (25%) - Melhor upside entre estratégias
  const upsides: number[] = [];
  if (strategies.graham?.upside !== null && strategies.graham?.upside !== undefined) {
    upsides.push(strategies.graham.upside);
  }
  if (strategies.fcd?.upside !== null && strategies.fcd?.upside !== undefined) {
    upsides.push(strategies.fcd.upside);
  }
  if (strategies.gordon?.upside !== null && strategies.gordon?.upside !== undefined) {
    upsides.push(strategies.gordon.upside);
  }
  
  const bestUpside = upsides.length > 0 ? Math.max(...upsides) : 0;
  // Normalizar upside para 0-100: 0% = 0, 50%+ = 100
  const valuation = Math.min(100, Math.max(0, (bestUpside / 50) * 100));

  // 3. Estratégia (25%) - % de estratégias aprovadas
  const strategyList = [
    strategies.graham,
    strategies.fcd,
    strategies.gordon,
    strategies.dividendYield,
    strategies.lowPE,
    strategies.magicFormula,
    strategies.fundamentalist,
    strategies.barsi,
  ];
  const approvedCount = strategyList.filter(s => s?.isEligible === true).length;
  const totalCount = strategyList.filter(s => s !== null).length;
  const estrategia = totalCount > 0 ? (approvedCount / totalCount) * 100 : 0;

  // 4. Timing (20%) - Baseado em entry point técnico
  let timing = 50; // Default neutro
  if (technicalAnalysis?.aiFairEntryPrice && currentPrice > 0) {
    const fairPrice = technicalAnalysis.aiFairEntryPrice;
    const priceDiff = ((currentPrice - fairPrice) / fairPrice) * 100;
    
    // Se preço atual está abaixo do preço justo de entrada = bom timing
    if (priceDiff <= -5) {
      timing = 100; // Excelente timing (preço muito abaixo)
    } else if (priceDiff <= 0) {
      timing = 80; // Bom timing (preço abaixo ou igual)
    } else if (priceDiff <= 10) {
      timing = 50; // Neutro (preço próximo)
    } else if (priceDiff <= 20) {
      timing = 30; // Timing ruim (preço acima)
    } else {
      timing = 10; // Timing muito ruim (preço muito acima)
    }
  }

  // Calcular score composto final
  const score = (
    solidez * 0.30 +
    valuation * 0.25 +
    estrategia * 0.25 +
    timing * 0.20
  );

  return {
    score: Math.round(score),
    components: {
      solidez,
      valuation,
      estrategia,
      timing,
    },
  };
}

/**
 * Retorna cor do semáforo baseado em score
 */
export function getRadarStatusColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 70) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

/**
 * Determina status de entrada baseado em análise técnica
 */
export function getTechnicalEntryStatus(
  technicalAnalysis: TechnicalAnalysisData | null,
  currentPrice: number
): { status: 'green' | 'yellow' | 'red'; label: string } {
  if (!technicalAnalysis?.aiFairEntryPrice || currentPrice <= 0) {
    return { status: 'yellow', label: 'Neutro' };
  }

  const fairPrice = technicalAnalysis.aiFairEntryPrice;
  const priceDiff = ((currentPrice - fairPrice) / fairPrice) * 100;

  if (priceDiff <= -5) {
    return { status: 'green', label: 'Compra' };
  } else if (priceDiff <= 0) {
    return { status: 'green', label: 'Bom' };
  } else if (priceDiff <= 10) {
    return { status: 'yellow', label: 'Neutro' };
  } else if (priceDiff <= 20) {
    return { status: 'yellow', label: 'Atenção' };
  } else {
    return { status: 'red', label: 'Caro' };
  }
}

/**
 * Converte YouTubeAnalysis.score em status visual
 */
export function getSentimentStatus(youtubeScore: number | null | undefined): {
  status: 'green' | 'yellow' | 'red';
  label: string;
} {
  if (youtubeScore === null || youtubeScore === undefined) {
    return { status: 'yellow', label: 'N/A' };
  }

  if (youtubeScore >= 70) {
    return { status: 'green', label: 'Positivo' };
  } else if (youtubeScore >= 50) {
    return { status: 'yellow', label: 'Neutro' };
  } else {
    return { status: 'red', label: 'Negativo' };
  }
}

/**
 * Retorna cor do semáforo baseado em upside
 */
export function getValuationStatus(upside: number | null | undefined): {
  status: 'green' | 'yellow' | 'red';
  label: string;
} {
  if (upside === null || upside === undefined) {
    return { status: 'yellow', label: 'N/A' };
  }

  if (upside > 10) {
    return { status: 'green', label: `${upside.toFixed(1)}%` };
  } else if (upside >= 0) {
    return { status: 'yellow', label: `${upside.toFixed(1)}%` };
  } else {
    return { status: 'red', label: `${upside.toFixed(1)}%` };
  }
}

