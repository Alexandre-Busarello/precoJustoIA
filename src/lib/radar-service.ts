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
 * Determina status do semáforo baseado em análise técnica
 * 
 * Lógica:
 * - VERMELHO: Preço fora dos limites (abaixo de aiMinPrice OU acima de aiMaxPrice)
 * - VERDE: Preço dentro dos limites E abaixo/igual ao preço justo
 * - AMARELO: Preço dentro dos limites mas acima do preço justo
 * 
 * IMPORTANTE: Não recomenda compra se score fundamentalista < 50
 */
export function getTechnicalTrafficLightStatus(
  technicalAnalysis: TechnicalAnalysisData | null,
  currentPrice: number,
  overallScore?: number | null
): { status: 'green' | 'yellow' | 'red'; label: string; description: string } {
  // Validações básicas
  if (!technicalAnalysis?.aiFairEntryPrice || currentPrice <= 0) {
    return { 
      status: 'yellow', 
      label: 'Neutro',
      description: 'Dados de análise técnica não disponíveis.'
    };
  }

  const fairPrice = technicalAnalysis.aiFairEntryPrice;
  const minPrice = technicalAnalysis.aiMinPrice;
  const maxPrice = technicalAnalysis.aiMaxPrice;

  // Se não temos limites mínimo e máximo, usar lógica simplificada baseada apenas no preço justo
  if (!minPrice || !maxPrice) {
    const priceDiff = ((currentPrice - fairPrice) / fairPrice) * 100;
    const hasMinimumFundamentalScore = overallScore !== null && overallScore !== undefined && overallScore >= 50;

    if (priceDiff <= 0 && hasMinimumFundamentalScore) {
      return { 
        status: 'green', 
        label: 'Compra',
        description: 'Preço abaixo ou igual ao preço justo técnico.'
      };
    } else if (priceDiff <= 10) {
      return { 
        status: 'yellow', 
        label: 'Neutro',
        description: 'Preço próximo do preço justo técnico.'
      };
    } else {
      return { 
        status: 'red', 
        label: 'Caro',
        description: 'Preço acima do preço justo técnico.'
      };
    }
  }

  // Verificar se está fora dos limites (VERMELHO)
  if (currentPrice < minPrice) {
    return { 
      status: 'red', 
      label: 'Abaixo do Limite',
      description: `Preço abaixo do limite mínimo previsto (R$ ${minPrice.toFixed(2)}). Pode indicar movimento atípico no mercado.`
    };
  }

  if (currentPrice > maxPrice) {
    return { 
      status: 'red', 
      label: 'Acima do Limite',
      description: `Preço acima do limite máximo previsto (R$ ${maxPrice.toFixed(2)}). Avalie se há fundamentos que justifiquem.`
    };
  }

  // Dentro dos limites - verificar relação com preço justo
  const hasMinimumFundamentalScore = overallScore !== null && overallScore !== undefined && overallScore >= 50;

  if (currentPrice <= fairPrice) {
    // Preço abaixo ou igual ao justo e dentro dos limites
    if (hasMinimumFundamentalScore) {
      return { 
        status: 'green', 
        label: 'Compra',
        description: `Preço dentro da faixa prevista (R$ ${minPrice.toFixed(2)} - R$ ${maxPrice.toFixed(2)}) e abaixo ou igual ao preço justo técnico (R$ ${fairPrice.toFixed(2)}). Região segura para entrada.`
      };
    } else {
      return { 
        status: 'yellow', 
        label: 'Neutro',
        description: 'Preço técnico favorável, mas score fundamentalista abaixo do mínimo recomendado.'
      };
    }
  } else {
    // Preço acima do justo mas dentro dos limites (AMARELO)
    const priceDiff = ((currentPrice - fairPrice) / fairPrice) * 100;
    return { 
      status: 'yellow', 
      label: 'Atenção',
      description: `Preço dentro da faixa prevista, mas ${priceDiff.toFixed(1)}% acima do preço justo técnico (R$ ${fairPrice.toFixed(2)}). Aguarde melhor oportunidade de entrada.`
    };
  }
}

/**
 * Determina status de entrada baseado em análise técnica
 * IMPORTANTE: Não recomenda compra se score fundamentalista < 50
 * 
 * @deprecated Use getTechnicalTrafficLightStatus para lógica completa com limites
 */
export function getTechnicalEntryStatus(
  technicalAnalysis: TechnicalAnalysisData | null,
  currentPrice: number,
  overallScore?: number | null
): { status: 'green' | 'yellow' | 'red'; label: string } {
  const result = getTechnicalTrafficLightStatus(technicalAnalysis, currentPrice, overallScore);
  return { status: result.status, label: result.label };
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

