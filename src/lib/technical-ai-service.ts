/**
 * Serviço de IA para Análise Técnica
 * Sistema híbrido: regras baseadas em indicadores + Gemini para análise contextual
 */

import { GoogleGenAI } from '@google/genai'
import { TechnicalAnalysisResult } from './technical-indicators'
import { SupportResistanceResult } from './support-resistance'

export interface AIPriceTargets {
  minPrice: number | null;
  maxPrice: number | null;
  fairEntryPrice: number | null;
  analysis: string | null;
  confidence: number | null;
}

interface AICalculationParams {
  ticker: string;
  companyName: string;
  sector: string | null;
  currentPrice: number;
  technicalAnalysis: TechnicalAnalysisResult;
  supportResistance: SupportResistanceResult;
}

/**
 * Calcula preços usando sistema híbrido (regras + Gemini)
 */
export async function calculateAIPriceTargets(
  params: AICalculationParams
): Promise<AIPriceTargets> {
  // Primeiro, calcular usando regras baseadas em indicadores
  const ruleBasedTargets = calculateRuleBasedTargets(params);
  
  // Se não houver API key do Gemini, retornar apenas regras
  if (!process.env.GEMINI_API_KEY) {
    return {
      ...ruleBasedTargets,
      analysis: 'Análise baseada apenas em regras técnicas (IA não disponível)',
      confidence: ruleBasedTargets.confidence ? ruleBasedTargets.confidence * 0.7 : null // Reduzir confiança sem IA
    };
  }
  
  try {
    // Chamar Gemini para análise contextual
    const geminiAnalysis = await callGeminiForPriceAnalysis(params, ruleBasedTargets);
    
    // Usar valores das regras (já validados) e apenas a análise textual da IA
    // A IA não deve alterar os preços, apenas fornecer explicação
    return {
      minPrice: ruleBasedTargets.minPrice,
      maxPrice: ruleBasedTargets.maxPrice,
      fairEntryPrice: ruleBasedTargets.fairEntryPrice,
      analysis: geminiAnalysis.analysis || ruleBasedTargets.analysis,
      confidence: geminiAnalysis.confidence || ruleBasedTargets.confidence
    };
  } catch (error) {
    console.error('Erro ao chamar Gemini para análise técnica:', error);
    // Em caso de erro, retornar apenas regras
    return {
      ...ruleBasedTargets,
      analysis: ruleBasedTargets.analysis + ' (Análise de IA indisponível)',
      confidence: ruleBasedTargets.confidence ? ruleBasedTargets.confidence * 0.8 : null
    };
  }
}

/**
 * Calcula preços baseado em regras técnicas
 */
function calculateRuleBasedTargets(params: AICalculationParams): AIPriceTargets {
  const { currentPrice, technicalAnalysis, supportResistance } = params;
  
  // Calcular preço mínimo (baseado em suporte mais forte)
  // Para dados mensais, usar range mais conservador (10-12% ao invés de 15%)
  const strongestSupport = supportResistance.supportLevels
    .sort((a, b) => b.strength - a.strength)[0];
  const minPrice = strongestSupport
    ? Math.min(currentPrice * 0.88, strongestSupport.price * 0.97) // 12% abaixo ou próximo ao suporte
    : currentPrice * 0.88;
  
  // Calcular preço máximo (baseado em resistência mais forte)
  const strongestResistance = supportResistance.resistanceLevels
    .sort((a, b) => b.strength - a.strength)[0];
  const maxPrice = strongestResistance
    ? Math.max(currentPrice * 1.12, strongestResistance.price * 1.03) // 12% acima ou próximo à resistência
    : currentPrice * 1.12;
  
  // Calcular preço justo de entrada (baseado em múltiplos fatores)
  let fairEntryPrice = currentPrice;
  let confidence = 50; // Base
  
  // Ajustar baseado em RSI (ajustes menores para dados mensais)
  if (technicalAnalysis.currentRSI) {
    if (technicalAnalysis.currentRSI.signal === 'SOBREVENDA') {
      fairEntryPrice = currentPrice * 0.97; // 3% abaixo se sobrevenda (mais conservador para mensal)
      confidence += 15;
    } else if (technicalAnalysis.currentRSI.signal === 'SOBRECOMPRA') {
      fairEntryPrice = currentPrice * 1.03; // 3% acima se sobrecompra (esperar correção)
      confidence -= 10;
    }
  }
  
  // Ajustar baseado em MACD
  if (technicalAnalysis.currentMACD) {
    if (technicalAnalysis.currentMACD.histogram > 0) {
      // Tendência de alta
      fairEntryPrice = Math.min(fairEntryPrice, currentPrice * 0.99);
      confidence += 10;
    } else {
      // Tendência de baixa
      fairEntryPrice = Math.max(fairEntryPrice, currentPrice * 1.01);
      confidence -= 5;
    }
  }
  
  // Ajustar baseado em Bollinger Bands
  if (technicalAnalysis.currentBollingerBands) {
    const bb = technicalAnalysis.currentBollingerBands;
    if (currentPrice < bb.lower) {
      // Preço abaixo da banda inferior = sobrevenda
      fairEntryPrice = Math.min(fairEntryPrice, bb.lower * 1.01);
      confidence += 10;
    } else if (currentPrice > bb.upper) {
      // Preço acima da banda superior = sobrecompra
      fairEntryPrice = Math.max(fairEntryPrice, bb.upper * 0.99);
      confidence -= 10;
    }
  }
  
  // Ajustar baseado em médias móveis
  if (technicalAnalysis.currentMovingAverages) {
    const ma = technicalAnalysis.currentMovingAverages;
    if (ma.sma50 && ma.sma200 && currentPrice < ma.sma50 && ma.sma50 < ma.sma200) {
      // Tendência de baixa
      fairEntryPrice = Math.max(fairEntryPrice, ma.sma50 * 0.97);
      confidence -= 5;
    } else if (ma.sma50 && ma.sma200 && currentPrice > ma.sma50 && ma.sma50 > ma.sma200) {
      // Tendência de alta
      fairEntryPrice = Math.min(fairEntryPrice, ma.sma50 * 1.03);
      confidence += 10;
    }
  }
  
  // Ajustar baseado em Fibonacci (usar nível de 61.8% como suporte forte)
  if (technicalAnalysis.fibonacci) {
    const fib = technicalAnalysis.fibonacci;
    // Se o preço atual está acima do nível 61.8%, usar esse nível como suporte
    if (currentPrice > fib.fib618 && fib.fib618 > 0) {
      fairEntryPrice = Math.min(fairEntryPrice, fib.fib618 * 1.02); // 2% acima do suporte Fibonacci
      confidence += 5;
    }
    // Se o preço está abaixo do nível 38.2%, pode ser uma oportunidade
    if (currentPrice < fib.fib382 && fib.fib382 > 0) {
      fairEntryPrice = Math.max(fairEntryPrice, fib.fib382 * 0.98); // 2% abaixo do nível Fibonacci
      confidence += 10;
    }
  }
  
  // Ajustar baseado em Ichimoku Cloud
  if (technicalAnalysis.currentIchimoku) {
    const ichi = technicalAnalysis.currentIchimoku;
    // Se preço está acima da nuvem (Senkou Span A e B), tendência de alta
    if (ichi.senkouSpanA > 0 && ichi.senkouSpanB > 0) {
      const cloudTop = Math.max(ichi.senkouSpanA, ichi.senkouSpanB);
      const cloudBottom = Math.min(ichi.senkouSpanA, ichi.senkouSpanB);
      
      if (currentPrice > cloudTop) {
        // Preço acima da nuvem = tendência de alta
        fairEntryPrice = Math.min(fairEntryPrice, cloudTop * 1.02);
        confidence += 10;
      } else if (currentPrice < cloudBottom) {
        // Preço abaixo da nuvem = tendência de baixa
        fairEntryPrice = Math.max(fairEntryPrice, cloudBottom * 0.98);
        confidence -= 5;
      }
      
      // Usar Kijun-sen como nível de suporte/resistência
      if (ichi.kijunSen > 0) {
        if (currentPrice > ichi.kijunSen) {
          fairEntryPrice = Math.min(fairEntryPrice, ichi.kijunSen * 1.01);
        } else {
          fairEntryPrice = Math.max(fairEntryPrice, ichi.kijunSen * 0.99);
        }
      }
    }
  }
  
  // Garantir que preço justo está dentro do range mínimo-máximo
  fairEntryPrice = Math.max(minPrice, Math.min(maxPrice, fairEntryPrice));
  
  // Limitar confiança entre 0-100
  confidence = Math.max(0, Math.min(100, confidence));
  
  return {
    minPrice: Number(minPrice.toFixed(4)),
    maxPrice: Number(maxPrice.toFixed(4)),
    fairEntryPrice: Number(fairEntryPrice.toFixed(4)),
    analysis: null, // Será preenchido pelo Gemini
    confidence
  };
}

/**
 * Chama Gemini para análise contextual de preços
 */
async function callGeminiForPriceAnalysis(
  params: AICalculationParams,
  ruleBasedTargets: AIPriceTargets
): Promise<AIPriceTargets> {
  const prompt = buildAIPrompt(params, ruleBasedTargets);
  
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!
  });
  
  const model = 'gemini-2.5-flash-lite';
  const contents = [
    {
      role: 'user',
      parts: [{ text: prompt }]
    }
  ];
  
  const response = await ai.models.generateContentStream({
    model,
    contents
  });
  
  let fullResponse = '';
  for await (const chunk of response) {
    if (chunk.text) {
      fullResponse += chunk.text;
    }
  }
  
  return parseAIResponse(fullResponse, ruleBasedTargets);
}

/**
 * Constrói prompt estruturado para Gemini
 */
function buildAIPrompt(
  params: AICalculationParams,
  ruleBasedTargets: AIPriceTargets
): string {
  const { ticker, companyName, sector, currentPrice, technicalAnalysis, supportResistance } = params;
  
  return `Você é um analista técnico especializado em análise de ações brasileiras para INVESTIMENTO DE LONGO PRAZO (não day trade).

⚠️ IMPORTANTE: TODOS os indicadores técnicos abaixo foram calculados usando dados MENSais (não diários). 
Isso significa que os movimentos de preço são mais suaves e as previsões devem ser ajustadas para essa granularidade.

CONTEXTO DO ATIVO:
- Ticker: ${ticker}
- Empresa: ${companyName}
- Setor: ${sector || 'N/A'}
- Preço Atual: R$ ${currentPrice.toFixed(2)}
- Fonte de Dados: Histórico MENSAL (1mo) - não diário

INDICADORES TÉCNICOS ATUAIS:
${technicalAnalysis.currentRSI ? `- RSI: ${technicalAnalysis.currentRSI.rsi.toFixed(2)} (${technicalAnalysis.currentRSI.signal})` : '- RSI: N/A'}
${technicalAnalysis.currentStochastic ? `- Estocástico: K=${technicalAnalysis.currentStochastic.k.toFixed(2)}, D=${technicalAnalysis.currentStochastic.d.toFixed(2)} (${technicalAnalysis.currentStochastic.signal})` : '- Estocástico: N/A'}
${technicalAnalysis.currentMACD ? `- MACD: ${technicalAnalysis.currentMACD.macd.toFixed(4)}, Signal: ${technicalAnalysis.currentMACD.signal.toFixed(4)}, Histogram: ${technicalAnalysis.currentMACD.histogram.toFixed(4)}` : '- MACD: N/A'}
${technicalAnalysis.currentMovingAverages ? `
- Médias Móveis:
  * SMA 20: R$ ${technicalAnalysis.currentMovingAverages.sma20.toFixed(2)}
  * SMA 50: R$ ${technicalAnalysis.currentMovingAverages.sma50.toFixed(2)}
  * SMA 200: R$ ${technicalAnalysis.currentMovingAverages.sma200.toFixed(2)}
  * EMA 12: R$ ${technicalAnalysis.currentMovingAverages.ema12.toFixed(2)}
  * EMA 26: R$ ${technicalAnalysis.currentMovingAverages.ema26.toFixed(2)}` : ''}
${technicalAnalysis.currentBollingerBands ? `
- Bollinger Bands:
  * Superior: R$ ${technicalAnalysis.currentBollingerBands.upper.toFixed(2)}
  * Média: R$ ${technicalAnalysis.currentBollingerBands.middle.toFixed(2)}
  * Inferior: R$ ${technicalAnalysis.currentBollingerBands.lower.toFixed(2)}
  * Largura: R$ ${technicalAnalysis.currentBollingerBands.width.toFixed(2)}` : ''}
${technicalAnalysis.fibonacci ? `
- Níveis de Fibonacci:
  * 23.6%: R$ ${technicalAnalysis.fibonacci.fib236.toFixed(2)}
  * 38.2%: R$ ${technicalAnalysis.fibonacci.fib382.toFixed(2)}
  * 50%: R$ ${technicalAnalysis.fibonacci.fib500.toFixed(2)}
  * 61.8%: R$ ${technicalAnalysis.fibonacci.fib618.toFixed(2)}
  * 78.6%: R$ ${technicalAnalysis.fibonacci.fib786.toFixed(2)}` : ''}
${technicalAnalysis.currentIchimoku ? `
- Ichimoku Cloud:
  * Tenkan-sen: R$ ${technicalAnalysis.currentIchimoku.tenkanSen.toFixed(2)}
  * Kijun-sen: R$ ${technicalAnalysis.currentIchimoku.kijunSen.toFixed(2)}
  * Senkou Span A: R$ ${technicalAnalysis.currentIchimoku.senkouSpanA.toFixed(2)}
  * Senkou Span B: R$ ${technicalAnalysis.currentIchimoku.senkouSpanB.toFixed(2)}
  * Chikou Span: R$ ${technicalAnalysis.currentIchimoku.chikouSpan.toFixed(2)}` : ''}

SUPORTE E RESISTÊNCIA:
- Níveis de Suporte (top 3): ${supportResistance.supportLevels.slice(0, 3).map(s => `R$ ${s.price.toFixed(2)} (força: ${s.strength})`).join(', ') || 'N/A'}
- Níveis de Resistência (top 3): ${supportResistance.resistanceLevels.slice(0, 3).map(r => `R$ ${r.price.toFixed(2)} (força: ${r.strength})`).join(', ') || 'N/A'}

PREVISÕES BASEADAS EM REGRAS:
- Preço Mínimo (30 dias): R$ ${ruleBasedTargets.minPrice?.toFixed(2) || 'N/A'}
- Preço Máximo (30 dias): R$ ${ruleBasedTargets.maxPrice?.toFixed(2) || 'N/A'}
- Preço Justo de Entrada: R$ ${ruleBasedTargets.fairEntryPrice?.toFixed(2) || 'N/A'}

INSTRUÇÕES CRÍTICAS:
1. Você DEVE usar EXATAMENTE os valores de previsão fornecidos abaixo:
   - Preço Mínimo: R$ ${ruleBasedTargets.minPrice?.toFixed(2) || 'N/A'}
   - Preço Máximo: R$ ${ruleBasedTargets.maxPrice?.toFixed(2) || 'N/A'}
   - Preço Justo de Entrada: R$ ${ruleBasedTargets.fairEntryPrice?.toFixed(2) || 'N/A'}

2. NÃO altere esses valores! Use-os EXATAMENTE como estão.

3. Sua única tarefa é escrever uma análise TEXTUAL SIMPLES e DIRETA explicando:
   - Por que esses preços foram calculados
   - O que os indicadores técnicos indicam de forma simples
   - Uma recomendação simples para o investidor de longo prazo

REGRAS PARA A ANÁLISE TEXTUAL:
- Use linguagem SIMPLES e DIRETA, evite jargões técnicos complexos
- Explique de forma que qualquer pessoa entenda
- Foque no que é importante para investimento de LONGO PRAZO
- Seja objetivo e prático
- Mencione os principais indicadores de forma simples
- Dê uma recomendação clara sobre quando comprar
- Máximo 250 palavras

FORMATO DA ANÁLISE:
- Comece com um resumo simples (2-3 frases)
- Explique os principais indicadores de forma simples (RSI, MACD, suporte/resistência)
- Mencione suporte e resistência de forma clara
- Termine com uma recomendação prática

IMPORTANTE SOBRE OS DADOS:
- Preço Atual: R$ ${currentPrice.toFixed(2)}
- Os dados são MENSais (não diários) - cada ponto representa o fechamento de um mês
- IMPORTANTE: As datas nos dados históricos podem aparecer como dia 1 do mês seguinte (ex: 2025-12-01 representa fechamento de Novembro/2025)
- Isso é NORMAL e CORRETO - os cálculos técnicos foram feitos usando a sequência temporal correta dos preços
- Os indicadores (RSI, MACD, suporte/resistência) foram calculados corretamente usando a ordem cronológica dos preços
- Foco em INVESTIMENTO DE LONGO PRAZO (não day trade)
- Seja conservador e prático

Retorne APENAS um objeto JSON válido (sem markdown) com esta estrutura:
{
  "minPrice": ${ruleBasedTargets.minPrice?.toFixed(2) || 'null'} (use EXATAMENTE este valor),
  "maxPrice": ${ruleBasedTargets.maxPrice?.toFixed(2) || 'null'} (use EXATAMENTE este valor),
  "fairEntryPrice": ${ruleBasedTargets.fairEntryPrice?.toFixed(2) || 'null'} (use EXATAMENTE este valor),
  "analysis": "análise textual SIMPLES e DIRETA em português brasileiro, máximo 250 palavras",
  "confidence": ${ruleBasedTargets.confidence || 50} (use este valor ou ajuste levemente se necessário)
}`;
}

/**
 * Extrai e parseia resposta da IA
 */
function parseAIResponse(response: string, fallback: AIPriceTargets): AIPriceTargets {
  try {
    // Tentar extrair JSON da resposta
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallback;
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // IMPORTANTE: Usar os valores do fallback (regras) se a IA não retornar valores válidos
    // A IA deve usar os mesmos valores, apenas fornecer análise textual
    return {
      minPrice: fallback.minPrice, // Sempre usar valor das regras
      maxPrice: fallback.maxPrice, // Sempre usar valor das regras
      fairEntryPrice: fallback.fairEntryPrice, // Sempre usar valor das regras
      analysis: parsed.analysis || fallback.analysis,
      confidence: parsed.confidence ? Number(parsed.confidence) : fallback.confidence
    };
  } catch (error) {
    console.error('Erro ao parsear resposta da IA:', error);
    return fallback;
  }
}

/**
 * Combina dois preços com pesos
 */
function combinePrices(
  price1: number | null,
  price2: number | null,
  weight1: number,
  weight2: number
): number | null {
  if (!price1 && !price2) return null;
  if (!price1) return price2;
  if (!price2) return price1;
  
  return Number(((price1! * weight1 + price2! * weight2) / (weight1 + weight2)).toFixed(4));
}

