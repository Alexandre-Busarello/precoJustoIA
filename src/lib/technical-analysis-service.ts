/**
 * Serviço de Análise Técnica
 * Orquestra cálculos de indicadores técnicos e gerencia cache de 30 dias
 */

import { prisma } from '@/lib/prisma'
import { TechnicalIndicators, PriceData, TechnicalAnalysisResult } from './technical-indicators'
import { combineLevels, SupportResistanceResult } from './support-resistance'
// Importação será feita dinamicamente para evitar erro de tipo
// import { calculateAIPriceTargets } from './technical-ai-service'

export interface TechnicalAnalysisData {
  // Indicadores técnicos
  rsi: number | null;
  stochasticK: number | null;
  stochasticD: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema12: number | null;
  ema26: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  bbWidth: number | null;
  fib236: number | null;
  fib382: number | null;
  fib500: number | null;
  fib618: number | null;
  fib786: number | null;
  tenkanSen: number | null;
  kijunSen: number | null;
  senkouSpanA: number | null;
  senkouSpanB: number | null;
  chikouSpan: number | null;
  
  // Suporte e Resistência
  supportLevels: Array<{ price: number; strength: number; type: string; touches: number }>;
  resistanceLevels: Array<{ price: number; strength: number; type: string; touches: number }>;
  psychologicalLevels: Array<{ price: number; strength: number; type: string; touches: number }>;
  
  // Análise de IA
  aiMinPrice: number | null;
  aiMaxPrice: number | null;
  aiFairEntryPrice: number | null;
  aiAnalysis: string | null;
  aiConfidence: number | null;
  
  // Metadata
  calculatedAt: Date;
  expiresAt: Date;
  currentPrice: number;
}

/**
 * Busca análise técnica do cache ou recalcula se necessário
 */
export async function getOrCalculateTechnicalAnalysis(
  ticker: string,
  forceRecalculate: boolean = false
): Promise<TechnicalAnalysisData | null> {
  const tickerUpper = ticker.toUpperCase();
  
  // Buscar empresa
  const company = await prisma.company.findUnique({
    where: { ticker: tickerUpper },
    select: { id: true, name: true, sector: true }
  });
  
  if (!company) {
    return null;
  }
  
  // Verificar cache válido (usar any temporariamente até migração do Prisma)
  if (!forceRecalculate) {
    const cached = await (prisma as any).assetTechnicalAnalysis.findFirst({
      where: {
        companyId: company.id,
        isActive: true,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        calculatedAt: 'desc'
      }
    });
    
    if (cached) {
      return await convertToTechnicalAnalysisData(cached, tickerUpper);
    }
  }
  
  // Buscar dados históricos mensais para cálculos
  // IMPORTANTE: Buscar TODOS os dados, não limitar com take
  // O código de cálculo já filtra e pega apenas os últimos N meses necessários
  const historicalPrices = await prisma.historicalPrice.findMany({
    where: {
      companyId: company.id,
      interval: '1mo' // Usar APENAS dados mensais
    },
    orderBy: {
      date: 'asc'
    }
    // Não usar take aqui - queremos TODOS os dados para cálculos corretos
  });
  
  if (historicalPrices.length < 50) {
    // Dados insuficientes
    return null;
  }
  
  // Buscar preço atual: priorizar dailyQuote (se disponível), senão usar último preço mensal
  const latestQuote = await prisma.dailyQuote.findFirst({
    where: { companyId: company.id },
    orderBy: { date: 'desc' },
    select: { price: true, date: true }
  });
  
  // Preço atual: priorizar dailyQuote, senão usar último preço mensal
  let currentPrice = latestQuote 
    ? Number(latestQuote.price)
    : null;
  
  // Se não tiver dailyQuote, usar o último preço mensal
  if (!currentPrice || currentPrice <= 0) {
    const lastMonthlyPrice = historicalPrices.length > 0 
      ? Number(historicalPrices[historicalPrices.length - 1].close)
      : null;
    currentPrice = lastMonthlyPrice;
  }
  
  if (!currentPrice || currentPrice <= 0) {
    return null; // Sem preço atual válido
  }
  
  // Converter para formato PriceData
  // IMPORTANTE: Muitos registros mensais têm open/high/low = 0, mas close está preenchido
  // Nesses casos, usar close para todos os campos
  const priceData: PriceData[] = historicalPrices
    .map(hp => {
      const close = Number(hp.close);
      const open = Number(hp.open) || close; // Se open = 0, usar close
      const high = Number(hp.high) || close; // Se high = 0, usar close
      const low = Number(hp.low) || close;   // Se low = 0, usar close
      
      return {
        date: hp.date,
        open: open,
        high: Math.max(high, close), // Garantir que high >= close
        low: Math.min(low, close),   // Garantir que low <= close
        close: close,
        volume: Number(hp.volume) || 0
      };
    })
    .filter(p => 
      p.close > 0 && 
      !isNaN(p.close) && 
      !isNaN(p.high) && 
      !isNaN(p.low) && 
      !isNaN(p.open)
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime()); // Garantir ordenação por data (mais antigo primeiro)
  
  if (priceData.length < 50) {
    // Dados válidos insuficientes após filtro
    return null;
  }
  
  // Calcular todos os indicadores usando período recente para Fibonacci (12 meses)
  const technicalResult = TechnicalIndicators.calculateTechnicalAnalysis(priceData, 12);
  
  // Detectar suporte e resistência usando preço atual correto
  const supportResistance = combineLevels(priceData, 20, currentPrice);
  
  // Importar e calcular preços da IA dinamicamente
  const { calculateAIPriceTargets } = await import('./technical-ai-service')
  const aiTargets = await calculateAIPriceTargets({
    ticker: tickerUpper,
    companyName: company.name,
    sector: company.sector,
    currentPrice,
    technicalAnalysis: technicalResult,
    supportResistance
  });
  
  // Preparar dados para salvar
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 dias
  
  const dataToSave = {
    companyId: company.id,
    // Indicadores básicos
    rsi: technicalResult.currentRSI?.rsi ?? null,
    stochasticK: technicalResult.currentStochastic?.k ?? null,
    stochasticD: technicalResult.currentStochastic?.d ?? null,
    // MACD
    macd: technicalResult.currentMACD?.macd ?? null,
    macdSignal: technicalResult.currentMACD?.signal ?? null,
    macdHistogram: technicalResult.currentMACD?.histogram ?? null,
    // Médias Móveis (só salvar se não for zero)
    sma20: technicalResult.currentMovingAverages?.sma20 && technicalResult.currentMovingAverages.sma20 > 0 
      ? technicalResult.currentMovingAverages.sma20 
      : null,
    sma50: technicalResult.currentMovingAverages?.sma50 && technicalResult.currentMovingAverages.sma50 > 0 
      ? technicalResult.currentMovingAverages.sma50 
      : null,
    sma200: technicalResult.currentMovingAverages?.sma200 && technicalResult.currentMovingAverages.sma200 > 0 
      ? technicalResult.currentMovingAverages.sma200 
      : null,
    ema12: technicalResult.currentMovingAverages?.ema12 && technicalResult.currentMovingAverages.ema12 > 0 
      ? technicalResult.currentMovingAverages.ema12 
      : null,
    ema26: technicalResult.currentMovingAverages?.ema26 && technicalResult.currentMovingAverages.ema26 > 0 
      ? technicalResult.currentMovingAverages.ema26 
      : null,
    // Bollinger Bands (só salvar se valores válidos e próximos ao preço atual)
    bbUpper: technicalResult.currentBollingerBands?.upper && 
             technicalResult.currentBollingerBands.upper > 0 &&
             Math.abs(technicalResult.currentBollingerBands.upper - currentPrice) < currentPrice * 2
      ? technicalResult.currentBollingerBands.upper 
      : null,
    bbMiddle: technicalResult.currentBollingerBands?.middle && 
              technicalResult.currentBollingerBands.middle > 0 &&
              Math.abs(technicalResult.currentBollingerBands.middle - currentPrice) < currentPrice * 2
      ? technicalResult.currentBollingerBands.middle 
      : null,
    bbLower: technicalResult.currentBollingerBands?.lower && 
             technicalResult.currentBollingerBands.lower > 0 &&
             Math.abs(technicalResult.currentBollingerBands.lower - currentPrice) < currentPrice * 2
      ? technicalResult.currentBollingerBands.lower 
      : null,
    bbWidth: technicalResult.currentBollingerBands?.width && technicalResult.currentBollingerBands.width > 0
      ? technicalResult.currentBollingerBands.width 
      : null,
    // Fibonacci
    fib236: technicalResult.fibonacci?.fib236 ?? null,
    fib382: technicalResult.fibonacci?.fib382 ?? null,
    fib500: technicalResult.fibonacci?.fib500 ?? null,
    fib618: technicalResult.fibonacci?.fib618 ?? null,
    fib786: technicalResult.fibonacci?.fib786 ?? null,
    // Ichimoku
    tenkanSen: technicalResult.currentIchimoku?.tenkanSen ?? null,
    kijunSen: technicalResult.currentIchimoku?.kijunSen ?? null,
    senkouSpanA: technicalResult.currentIchimoku?.senkouSpanA ?? null,
    senkouSpanB: technicalResult.currentIchimoku?.senkouSpanB ?? null,
    chikouSpan: technicalResult.currentIchimoku?.chikouSpan ?? null,
    // Suporte e Resistência
    supportLevels: supportResistance.supportLevels,
    resistanceLevels: supportResistance.resistanceLevels,
    psychologicalLevels: supportResistance.psychologicalLevels,
    // IA
    aiMinPrice: aiTargets.minPrice,
    aiMaxPrice: aiTargets.maxPrice,
    aiFairEntryPrice: aiTargets.fairEntryPrice,
    aiAnalysis: aiTargets.analysis,
    aiConfidence: aiTargets.confidence,
    // Metadata
    calculatedAt: now,
    expiresAt,
    isActive: true
  };
  
  // Desativar análises antigas (usar any temporariamente até migração do Prisma)
  await (prisma as any).assetTechnicalAnalysis.updateMany({
    where: {
      companyId: company.id,
      isActive: true
    },
    data: {
      isActive: false
    }
  });
  
  // Salvar nova análise (usar any temporariamente até migração do Prisma)
  const saved = await (prisma as any).assetTechnicalAnalysis.create({
    data: dataToSave
  });
  
  return await convertToTechnicalAnalysisData(saved, tickerUpper);
}

/**
 * Converte dados do banco para formato TechnicalAnalysisData
 */
async function convertToTechnicalAnalysisData(
  data: any,
  ticker: string
): Promise<TechnicalAnalysisData> {
  // Buscar preço atual do banco
  const company = await prisma.company.findUnique({
    where: { ticker },
    select: {
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1,
        select: { price: true }
      }
    }
  });
  
  const currentPrice = company?.dailyQuotes[0]?.price
    ? Number(company.dailyQuotes[0].price)
    : data.aiFairEntryPrice ?? data.bbMiddle ?? 0;
  
  return {
    rsi: data.rsi ? Number(data.rsi) : null,
    stochasticK: data.stochasticK ? Number(data.stochasticK) : null,
    stochasticD: data.stochasticD ? Number(data.stochasticD) : null,
    macd: data.macd ? Number(data.macd) : null,
    macdSignal: data.macdSignal ? Number(data.macdSignal) : null,
    macdHistogram: data.macdHistogram ? Number(data.macdHistogram) : null,
    sma20: data.sma20 ? Number(data.sma20) : null,
    sma50: data.sma50 ? Number(data.sma50) : null,
    sma200: data.sma200 ? Number(data.sma200) : null,
    ema12: data.ema12 ? Number(data.ema12) : null,
    ema26: data.ema26 ? Number(data.ema26) : null,
    bbUpper: data.bbUpper ? Number(data.bbUpper) : null,
    bbMiddle: data.bbMiddle ? Number(data.bbMiddle) : null,
    bbLower: data.bbLower ? Number(data.bbLower) : null,
    bbWidth: data.bbWidth ? Number(data.bbWidth) : null,
    fib236: data.fib236 ? Number(data.fib236) : null,
    fib382: data.fib382 ? Number(data.fib382) : null,
    fib500: data.fib500 ? Number(data.fib500) : null,
    fib618: data.fib618 ? Number(data.fib618) : null,
    fib786: data.fib786 ? Number(data.fib786) : null,
    tenkanSen: data.tenkanSen ? Number(data.tenkanSen) : null,
    kijunSen: data.kijunSen ? Number(data.kijunSen) : null,
    senkouSpanA: data.senkouSpanA ? Number(data.senkouSpanA) : null,
    senkouSpanB: data.senkouSpanB ? Number(data.senkouSpanB) : null,
    chikouSpan: data.chikouSpan ? Number(data.chikouSpan) : null,
    supportLevels: (data.supportLevels as any[]) || [],
    resistanceLevels: (data.resistanceLevels as any[]) || [],
    psychologicalLevels: (data.psychologicalLevels as any[]) || [],
    aiMinPrice: data.aiMinPrice ? Number(data.aiMinPrice) : null,
    aiMaxPrice: data.aiMaxPrice ? Number(data.aiMaxPrice) : null,
    aiFairEntryPrice: data.aiFairEntryPrice ? Number(data.aiFairEntryPrice) : null,
    aiAnalysis: data.aiAnalysis,
    aiConfidence: data.aiConfidence ? Number(data.aiConfidence) : null,
    calculatedAt: data.calculatedAt,
    expiresAt: data.expiresAt,
    currentPrice
  };
}

