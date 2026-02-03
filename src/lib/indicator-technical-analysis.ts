/**
 * Análise Técnica de Indicadores Econômicos
 * Calcula indicadores técnicos (RSI, MACD, médias móveis) para indicadores econômicos
 * Usa dados do banco de dados (EconomicIndicatorHistory) para cálculos
 */

import { prisma } from './prisma'
import { TechnicalIndicators, PriceData } from './technical-indicators'
import { 
  IndicatorName, 
  getIndicatorHistoryForTechnicalAnalysis,
  ensureIndicatorDataForPeriod,
  ensureIndicatorDataForInterval
} from './economic-indicators-service'
import { Decimal } from '@prisma/client/runtime/library'

export interface IndicatorTechnicalAnalysis {
  rsi: number | null
  macd: number | null
  macdSignal: number | null
  macdHistogram: number | null
  sma20: number | null
  sma50: number | null
  sma200: number | null
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null
  signal: 'BUY' | 'SELL' | 'NEUTRAL' | null
}

/**
 * Determina o intervalo apropriado baseado no período da projeção
 */
function getIntervalForPeriod(period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'): '1d' | '1wk' | '1mo' {
  switch (period) {
    case 'DAILY':
      return '1d'
    case 'WEEKLY':
      return '1wk'  // Semanal usa dados semanais
    case 'MONTHLY':
      return '1mo'  // Mensal usa dados mensais
    case 'ANNUAL':
      return '1mo'  // Anual também usa dados mensais (mais estável)
    default:
      return '1d'
  }
}

/**
 * Converte dados históricos de indicador para formato PriceData
 */
function convertToPriceData(
  historicalData: Array<{ date: Date; value: number }>
): PriceData[] {
  return historicalData.map((item, index) => ({
    date: item.date,
    open: index > 0 ? historicalData[index - 1].value : item.value,
    high: item.value,
    low: item.value,
    close: item.value,
    volume: 0 // Indicadores econômicos não têm volume
  }))
}

/**
 * Calcula análise técnica de um indicador econômico
 */
/**
 * Calcula análise técnica de um indicador econômico
 * Usa o intervalo apropriado para o período
 */
export async function calculateIndicatorTechnicalAnalysis(
  indicatorName: IndicatorName,
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'
): Promise<IndicatorTechnicalAnalysis | null> {
  const interval = getIntervalForPeriod(period)
  return await calculateIndicatorTechnicalAnalysisForInterval(indicatorName, interval, period)
}

/**
 * Calcula análise técnica para um indicador em um intervalo específico
 */
async function calculateIndicatorTechnicalAnalysisForInterval(
  indicatorName: IndicatorName,
  interval: '1d' | '1wk' | '1mo',
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'
): Promise<IndicatorTechnicalAnalysis | null> {
  try {
    console.log(`📊 [INDICATOR TA] Calculando análise técnica para ${indicatorName} (${interval})`)
    
    // Garantir que temos dados com esse intervalo específico
    await ensureIndicatorDataForInterval(indicatorName, interval, period)
    
    // Buscar histórico do banco com o intervalo específico
    const historicalData = await getIndicatorHistoryForTechnicalAnalysis(
      indicatorName,
      period,
      interval
    )

    console.log(`📊 [INDICATOR TA] ${indicatorName} (${interval}): ${historicalData.length} pontos históricos encontrados`)

    // Ajustar threshold mínimo baseado no intervalo
    const minDataPoints = interval === '1d' ? 50 : 
                          interval === '1wk' ? 20 : 
                          12

    if (historicalData.length < minDataPoints) {
      console.warn(`⚠️ [INDICATOR TA] ${indicatorName} (${interval}): Dados insuficientes (${historicalData.length} < ${minDataPoints})`)
      return null
    }

    // Converter para formato PriceData
    const priceData = convertToPriceData(historicalData)

    // Calcular indicadores técnicos
    const rsiResults = TechnicalIndicators.calculateRSI(priceData, 14)
    const macdResults = TechnicalIndicators.calculateMACD(priceData)
    const movingAverages = TechnicalIndicators.calculateMovingAverages(priceData)

    const currentRSI = rsiResults.length > 0 ? rsiResults[rsiResults.length - 1] : null
    const currentMACD = macdResults.length > 0 ? macdResults[macdResults.length - 1] : null
    const currentMA = movingAverages.length > 0 ? movingAverages[movingAverages.length - 1] : null

    // Determinar tendência baseada em médias móveis
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null = null
    if (currentMA && historicalData.length > 0) {
      const currentValue = historicalData[historicalData.length - 1].value
      if (currentMA.sma20 && currentMA.sma50 && currentMA.sma200) {
        if (currentValue > currentMA.sma20 && currentMA.sma20 > currentMA.sma50 && currentMA.sma50 > currentMA.sma200) {
          trend = 'BULLISH'
        } else if (currentValue < currentMA.sma20 && currentMA.sma20 < currentMA.sma50 && currentMA.sma50 < currentMA.sma200) {
          trend = 'BEARISH'
        } else {
          trend = 'NEUTRAL'
        }
      }
    }

    // Determinar sinal baseado em múltiplos indicadores
    let signal: 'BUY' | 'SELL' | 'NEUTRAL' | null = null
    let buySignals = 0
    let sellSignals = 0

    if (currentRSI) {
      if (currentRSI.rsi <= 30) buySignals++
      else if (currentRSI.rsi >= 70) sellSignals++
    }

    if (currentMACD) {
      if (currentMACD.histogram > 0 && currentMACD.macd > currentMACD.signal) buySignals++
      else if (currentMACD.histogram < 0 && currentMACD.macd < currentMACD.signal) sellSignals++
    }

    if (trend === 'BULLISH') buySignals++
    else if (trend === 'BEARISH') sellSignals++

    if (buySignals >= 2) signal = 'BUY'
    else if (sellSignals >= 2) signal = 'SELL'
    else signal = 'NEUTRAL'

    const analysis: IndicatorTechnicalAnalysis = {
      rsi: currentRSI?.rsi ?? null,
      macd: currentMACD?.macd ?? null,
      macdSignal: currentMACD?.signal ?? null,
      macdHistogram: currentMACD?.histogram ?? null,
      sma20: currentMA?.sma20 ?? null,
      sma50: currentMA?.sma50 ?? null,
      sma200: currentMA?.sma200 ?? null,
      trend,
      signal
    }

    // Salvar análise técnica no banco para a data de HOJE (não a última do histórico)
    // Isso garante que sempre salvamos para o dia atual, mesmo que os dados ainda não tenham sido persistidos
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dateOnly = today

    // Buscar registro mais recente do banco para obter symbol e valor atual
    const latestRecord = await prisma.economicIndicatorHistory.findFirst({
      where: {
        indicatorName,
        interval: interval
      },
      orderBy: {
        date: 'desc'
      }
    })

    // Buscar registro de hoje (se existir)
    const todayRecord = await prisma.economicIndicatorHistory.findUnique({
      where: {
        indicatorName_date_interval: {
          indicatorName,
          date: dateOnly,
          interval: interval
        }
      }
    })

    // Usar valor do registro de hoje ou do mais recente
    const valueToUse = todayRecord?.value 
      ? Number(todayRecord.value) 
      : (latestRecord?.value ? Number(latestRecord.value) : (historicalData.length > 0 ? historicalData[historicalData.length - 1].value : 0))

    // Obter símbolo do indicador
    const symbol = todayRecord?.symbol || latestRecord?.symbol || ''

    // Usar upsert para garantir que o registro existe e será atualizado
    // Se não existir, cria com os dados básicos + análise técnica
    // Se existir, atualiza apenas os campos de análise técnica (preserva outros campos)
    const upsertResult = await prisma.economicIndicatorHistory.upsert({
      where: {
        indicatorName_date_interval: {
          indicatorName,
          date: dateOnly,
          interval: interval
        }
      },
      update: {
        // Atualizar apenas campos de análise técnica, preservando outros campos existentes
        rsi: analysis.rsi !== null ? new Decimal(analysis.rsi) : null,
        macd: analysis.macd !== null ? new Decimal(analysis.macd) : null,
        macdSignal: analysis.macdSignal !== null ? new Decimal(analysis.macdSignal) : null,
        macdHistogram: analysis.macdHistogram !== null ? new Decimal(analysis.macdHistogram) : null,
        sma20: analysis.sma20 !== null ? new Decimal(analysis.sma20) : null,
        sma50: analysis.sma50 !== null ? new Decimal(analysis.sma50) : null,
        sma200: analysis.sma200 !== null ? new Decimal(analysis.sma200) : null,
        trend: analysis.trend,
        signal: analysis.signal,
      },
      create: {
        indicatorName,
        symbol: symbol,
        date: dateOnly,
        interval: interval,
        value: new Decimal(valueToUse),
        // Outros campos podem ser null se não existirem
        changePercent: todayRecord?.changePercent || latestRecord?.changePercent || null,
        open: todayRecord?.open || latestRecord?.open || null,
        high: todayRecord?.high || latestRecord?.high || null,
        low: todayRecord?.low || latestRecord?.low || null,
        close: todayRecord?.close || latestRecord?.close || null,
        volume: todayRecord?.volume || latestRecord?.volume || null,
        rsi: analysis.rsi !== null ? new Decimal(analysis.rsi) : null,
        macd: analysis.macd !== null ? new Decimal(analysis.macd) : null,
        macdSignal: analysis.macdSignal !== null ? new Decimal(analysis.macdSignal) : null,
        macdHistogram: analysis.macdHistogram !== null ? new Decimal(analysis.macdHistogram) : null,
        sma20: analysis.sma20 !== null ? new Decimal(analysis.sma20) : null,
        sma50: analysis.sma50 !== null ? new Decimal(analysis.sma50) : null,
        sma200: analysis.sma200 !== null ? new Decimal(analysis.sma200) : null,
        trend: analysis.trend,
        signal: analysis.signal,
      }
    })
    
    console.log(`✅ [INDICATOR TA] Análise técnica salva para ${indicatorName} (${interval}) em ${dateOnly.toISOString().split('T')[0]}`)

    return analysis
  } catch (error) {
    console.error(`❌ [INDICATOR TA] Erro ao calcular análise técnica de ${indicatorName} (${interval}):`, error)
    return null
  }
}

/**
 * Calcula análise técnica para múltiplos indicadores
 * Calcula para o intervalo apropriado do período E também para outros intervalos quando necessário
 */
export async function calculateMultipleIndicatorsTechnicalAnalysis(
  indicatorNames: IndicatorName[],
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'
): Promise<Map<IndicatorName, IndicatorTechnicalAnalysis>> {
  const interval = getIntervalForPeriod(period)
  
  // Calcular análise técnica para o intervalo do período atual
  const results = await Promise.all(
    indicatorNames.map(async (name) => {
      const analysis = await calculateIndicatorTechnicalAnalysisForInterval(name, interval, period)
      return { name, analysis }
    })
  )

  const map = new Map<IndicatorName, IndicatorTechnicalAnalysis>()
  results.forEach(({ name, analysis }) => {
    if (analysis) {
      map.set(name, analysis)
    }
  })

  // Também calcular análise técnica para outros intervalos em paralelo
  // IMPORTANTE: Aguardar para garantir que todos os intervalos sejam calculados
  const allIntervals: ('1d' | '1wk' | '1mo')[] = ['1d', '1wk', '1mo']
  const otherIntervals = allIntervals.filter(intvl => intvl !== interval)
  
  // Calcular para todos os outros intervalos em paralelo
  const otherIntervalTasks = indicatorNames.flatMap(name => 
    otherIntervals.map(intvl => 
      calculateIndicatorTechnicalAnalysisForInterval(name, intvl, period)
        .catch(error => {
          console.warn(`⚠️ [INDICATOR TA] Erro ao calcular ${name} (${intvl}):`, error)
          return null
        })
    )
  )

  // Aguardar todos os cálculos (não bloquear a resposta principal, mas garantir execução)
  Promise.all(otherIntervalTasks).then(() => {
    console.log(`✅ [INDICATOR TA] Análise técnica calculada para todos os intervalos (${otherIntervals.join(', ')})`)
  }).catch((error) => {
    console.warn(`⚠️ [INDICATOR TA] Alguns cálculos de intervalos falharam:`, error)
  })

  return map
}

/**
 * Faz cruzamento de indicadores para detectar divergências/convergências
 */
export interface CrossIndicatorAnalysis {
  divergences: Array<{
    indicator1: IndicatorName
    indicator2: IndicatorName
    type: 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE' | 'CONVERGENCE'
    description: string
  }>
  consensus: {
    bullish: IndicatorName[]
    bearish: IndicatorName[]
    neutral: IndicatorName[]
  }
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  summary: string
}

export function crossIndicatorAnalysis(
  indicators: Map<IndicatorName, IndicatorTechnicalAnalysis>
): CrossIndicatorAnalysis {
  const divergences: CrossIndicatorAnalysis['divergences'] = []
  const bullish: IndicatorName[] = []
  const bearish: IndicatorName[] = []
  const neutral: IndicatorName[] = []

  // Classificar indicadores por tendência
  indicators.forEach((analysis, name) => {
    if (analysis.trend === 'BULLISH') bullish.push(name)
    else if (analysis.trend === 'BEARISH') bearish.push(name)
    else neutral.push(name)
  })

  // Detectar divergências entre indicadores
  const indicatorArray = Array.from(indicators.entries())
  for (let i = 0; i < indicatorArray.length; i++) {
    for (let j = i + 1; j < indicatorArray.length; j++) {
      const [name1, analysis1] = indicatorArray[i]
      const [name2, analysis2] = indicatorArray[j]

      if (analysis1.trend === 'BULLISH' && analysis2.trend === 'BEARISH') {
        divergences.push({
          indicator1: name1,
          indicator2: name2,
          type: 'BULLISH_DIVERGENCE',
          description: `${name1} está em tendência de alta enquanto ${name2} está em tendência de baixa`
        })
      } else if (analysis1.trend === 'BEARISH' && analysis2.trend === 'BULLISH') {
        divergences.push({
          indicator1: name1,
          indicator2: name2,
          type: 'BEARISH_DIVERGENCE',
          description: `${name1} está em tendência de baixa enquanto ${name2} está em tendência de alta`
        })
      } else if (analysis1.trend === analysis2.trend && analysis1.trend !== 'NEUTRAL') {
        divergences.push({
          indicator1: name1,
          indicator2: name2,
          type: 'CONVERGENCE',
          description: `${name1} e ${name2} estão convergindo na mesma direção (${analysis1.trend})`
        })
      }
    }
  }

  // Determinar nível de risco
  let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'
  if (divergences.length > indicators.size / 2) {
    riskLevel = 'HIGH'
  } else if (bullish.length === indicators.size || bearish.length === indicators.size) {
    riskLevel = 'LOW'
  }

  // Gerar resumo
  const totalIndicators = indicators.size
  const consensusPercent = Math.max(
    (bullish.length / totalIndicators) * 100,
    (bearish.length / totalIndicators) * 100
  )

  let summary = `Análise de ${totalIndicators} indicadores: `
  if (consensusPercent >= 70) {
    summary += `${bullish.length > bearish.length ? 'Consenso de alta' : 'Consenso de baixa'} (${consensusPercent.toFixed(0)}% dos indicadores). `
  } else {
    summary += `Divergência entre indicadores (${divergences.length} divergências detectadas). `
  }
  summary += `Nível de risco: ${riskLevel}`

  return {
    divergences,
    consensus: {
      bullish,
      bearish,
      neutral
    },
    riskLevel,
    summary
  }
}

