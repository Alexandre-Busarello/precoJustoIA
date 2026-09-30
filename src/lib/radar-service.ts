/**
 * Serviço de Lógica para Radar de Oportunidades
 * 
 * Contém funções para calcular scores compostos, determinar status de semáforo,
 * e processar dados para exibição no radar.
 */

import type { StrategyAnalysis } from './strategies';
import type { TechnicalAnalysisData } from './technical-analysis-service';
import { formatBRL, formatDeltaPct, formatNumber, formatPct } from './format';

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

/** Rótulos do status técnico. Descrevem a posição do preço; nunca são recomendação de compra ou venda. */
export const TECHNICAL_LABELS = {
  neutral: 'Neutro',
  belowEstimate: 'Abaixo do valor estimado',
  aboveEstimate: 'Acima do valor estimado',
  belowRange: 'Abaixo da faixa estimada',
  aboveRange: 'Acima da faixa estimada',
  /** Sem faixa mínima/máxima: só a comparação com a entrada técnica. */
  belowEntry: 'Até a entrada técnica',
  aboveEntry: 'Acima da entrada técnica',
} as const;

/**
 * Determina o status técnico a partir da faixa estimada por IA (30 dias) e da entrada técnica.
 *
 * - `red`: preço fora da faixa estimada (abaixo do mínimo ou acima do máximo): movimento atípico.
 *   Sem faixa: preço mais de 10% acima da entrada técnica.
 * - `green`: preço dentro da faixa (ou, sem faixa, até a entrada técnica) com score fundamentalista ≥ 50.
 * - `yellow`: demais casos (acima da entrada técnica ou score fundamentalista baixo).
 *
 * O status é descritivo: não é recomendação de investimento.
 */
export function getTechnicalTrafficLightStatus(
  technicalAnalysis: Pick<TechnicalAnalysisData, 'aiFairEntryPrice' | 'aiMinPrice' | 'aiMaxPrice'> | null,
  currentPrice: number,
  overallScore?: number | null
): { status: 'green' | 'yellow' | 'red'; label: string; description: string } {
  // Validações básicas
  if (!technicalAnalysis?.aiFairEntryPrice || currentPrice <= 0) {
    return {
      status: 'yellow',
      label: TECHNICAL_LABELS.neutral,
      description: 'Dados de análise técnica não disponíveis.'
    };
  }

  const fairPrice = technicalAnalysis.aiFairEntryPrice;
  const minPrice = technicalAnalysis.aiMinPrice;
  const maxPrice = technicalAnalysis.aiMaxPrice;
  const hasMinimumFundamentalScore = overallScore !== null && overallScore !== undefined && overallScore >= 50;
  const distance = currentPrice / fairPrice - 1;

  // Sem faixa mínima/máxima: compara apenas com a entrada técnica
  if (!minPrice || !maxPrice) {
    if (distance <= 0 && hasMinimumFundamentalScore) {
      return {
        status: 'green',
        label: TECHNICAL_LABELS.belowEntry,
        description: `Preço até a entrada técnica estimada (${formatBRL(fairPrice)}). Não há faixa estimada para comparar.`
      };
    }
    if (distance <= 0.1) {
      return {
        status: 'yellow',
        label: TECHNICAL_LABELS.neutral,
        description: `Preço próximo da entrada técnica estimada (${formatBRL(fairPrice)}).`
      };
    }
    return {
      status: 'red',
      label: TECHNICAL_LABELS.aboveEntry,
      description: `Preço ${formatPct(distance)} acima da entrada técnica estimada (${formatBRL(fairPrice)}).`
    };
  }

  const range = `${formatBRL(minPrice)} a ${formatBRL(maxPrice)}`;

  // Fora da faixa estimada
  if (currentPrice < minPrice) {
    return {
      status: 'red',
      label: TECHNICAL_LABELS.belowRange,
      description: `Preço abaixo da faixa estimada (${range}). Pode indicar um movimento atípico do mercado.`
    };
  }

  if (currentPrice > maxPrice) {
    return {
      status: 'red',
      label: TECHNICAL_LABELS.aboveRange,
      description: `Preço acima da faixa estimada (${range}). Verifique se há fatos novos que expliquem o movimento.`
    };
  }

  // Dentro da faixa: relação com a entrada técnica
  if (distance <= 0) {
    if (hasMinimumFundamentalScore) {
      return {
        status: 'green',
        label: TECHNICAL_LABELS.belowEstimate,
        description: `Dentro da faixa estimada (${range}) e até a entrada técnica estimada (${formatBRL(fairPrice)}).`
      };
    }
    return {
      status: 'yellow',
      label: TECHNICAL_LABELS.neutral,
      description: 'Preço dentro da faixa estimada, mas o score fundamentalista está abaixo de 50.'
    };
  }

  return {
    status: 'yellow',
    label: TECHNICAL_LABELS.aboveEstimate,
    description: `Dentro da faixa estimada (${range}), ${formatPct(distance)} acima da entrada técnica estimada (${formatBRL(fairPrice)}).`
  };
}

/** Rótulos antigos (ainda presentes em respostas em cache), em minúsculas → rótulos atuais. */
const LEGACY_TECHNICAL_LABELS: Record<string, string> = {
  compra: TECHNICAL_LABELS.belowEstimate,
  // "Atenção" só existia dentro da faixa, acima da entrada técnica
  'atenção': TECHNICAL_LABELS.aboveEstimate,
  // "Caro" só existia sem faixa, com o preço mais de 10% acima da entrada técnica
  caro: TECHNICAL_LABELS.aboveEntry,
  'abaixo do limite': TECHNICAL_LABELS.belowRange,
  'acima do limite': TECHNICAL_LABELS.aboveRange,
};

/** Normaliza o rótulo técnico, convertendo os rótulos antigos. `null` quando não há dado. */
export function normalizeTechnicalLabel(label: string | null | undefined): string | null {
  if (!label || label === 'N/A') return null;
  return LEGACY_TECHNICAL_LABELS[label.toLowerCase()] ?? label;
}

const TECHNICAL_RANGE_TEXT: Record<string, string> = {
  [TECHNICAL_LABELS.belowRange]: 'Abaixo da faixa',
  [TECHNICAL_LABELS.aboveRange]: 'Acima da faixa',
  [TECHNICAL_LABELS.belowEstimate]: 'Dentro da faixa',
  [TECHNICAL_LABELS.aboveEstimate]: 'Dentro da faixa, acima da entrada',
  [TECHNICAL_LABELS.belowEntry]: 'Até a entrada',
  [TECHNICAL_LABELS.aboveEntry]: 'Acima da entrada',
  [TECHNICAL_LABELS.neutral]: 'Neutro',
};

/**
 * Texto curto da coluna "Técnica" do radar: posição do preço em relação à faixa técnica.
 * "Acima/Abaixo da faixa" só quando o preço está fora da faixa estimada. `—` quando não há análise técnica.
 */
export function technicalRangeText(label: string | null | undefined): string {
  const normalized = normalizeTechnicalLabel(label);
  if (!normalized) return '—';
  return TECHNICAL_RANGE_TEXT[normalized] ?? normalized;
}

/**
 * Posição de um preço numa faixa [min, max], para a barra da faixa estimada.
 * `fraction` vai de 0 a 1 (limitada às pontas); `position` diz se o preço está dentro ou fora.
 */
export function priceRangePosition(
  min: number | null | undefined,
  max: number | null | undefined,
  price: number | null | undefined
): { fraction: number; position: 'below' | 'within' | 'above' } | null {
  if (typeof min !== 'number' || typeof max !== 'number' || typeof price !== 'number') return null;
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(price) || max <= min) return null;
  if (price < min) return { fraction: 0, position: 'below' };
  if (price > max) return { fraction: 1, position: 'above' };
  return { fraction: (price - min) / (max - min), position: 'within' };
}

/**
 * Determina status de entrada baseado em análise técnica
 * Com score fundamentalista < 50 o status nunca fica verde.
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
    return { status: 'yellow', label: '—' };
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
    return { status: 'yellow', label: '—' };
  }

  // `upside` chega em pontos percentuais (12,5 = 12,5%)
  const label = formatDeltaPct(upside / 100);
  if (upside > 10) {
    return { status: 'green', label };
  } else if (upside >= 0) {
    return { status: 'yellow', label };
  } else {
    return { status: 'red', label };
  }
}

/** Semáforo de valuation para FIIs com base em P/VP (e linha de detalhe com DY). */
export function getFiiValuationStatus(
  pvp: number | null | undefined,
  dividendYieldRatio: number | null | undefined
): {
  status: 'green' | 'yellow' | 'red';
  label: string;
  detail: string;
} {
  let status: 'green' | 'yellow' | 'red' = 'yellow';
  if (pvp != null && Number.isFinite(pvp)) {
    if (pvp < 0.97) status = 'green';
    else if (pvp <= 1.08) status = 'yellow';
    else status = 'red';
  }

  const pvpStr = formatNumber(pvp, { digits: 2 });
  const dyStr = formatPct(dividendYieldRatio);

  return {
    status,
    label: 'P/VP · DY',
    detail: `${pvpStr} · ${dyStr}`,
  };
}

