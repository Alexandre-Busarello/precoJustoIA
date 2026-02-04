/**
 * Helpers para projeções IBOV mensal e anual
 * Inclui detecção de período eleitoral, análise técnica e eventos macroeconômicos
 */

import { getTechnicalAnalysis } from './ben-tools'
import { GoogleGenAI } from '@google/genai'
import { 
  fetchMultipleIndicators, 
  EconomicIndicator, 
  IndicatorName,
  persistIndicatorExpectations
} from './economic-indicators-service'
import { 
  calculateMultipleIndicatorsTechnicalAnalysis,
  crossIndicatorAnalysis,
  CrossIndicatorAnalysis,
  IndicatorTechnicalAnalysis
} from './indicator-technical-analysis'

export interface ElectionPeriod {
  isElectionPeriod: boolean
  electionType: 'PRESIDENTIAL' | 'MUNICIPAL' | 'NONE'
  electionYear?: number
  monthsUntilElection?: number
  description: string
}

export interface MacroEconomicEvents {
  events: Array<{
    date: string
    event: string
    importance: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  summary: string
}

/**
 * Detecta se estamos em período eleitoral brasileiro
 * Eleições presidenciais: anos pares divisíveis por 4 (2022, 2026, 2030...)
 * Eleições municipais: anos pares não divisíveis por 4 (2024, 2028, 2032...)
 */
export function getElectionPeriod(date: Date = new Date()): ElectionPeriod {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-12
  
  // Eleições presidenciais acontecem em outubro de anos pares divisíveis por 4
  // Campanha eleitoral geralmente começa em junho/julho
  const isPresidentialElectionYear = year % 4 === 0 && year % 2 === 0
  
  // Eleições municipais acontecem em outubro de anos pares não divisíveis por 4
  const isMunicipalElectionYear = year % 4 !== 0 && year % 2 === 0
  
  // Período eleitoral: junho a outubro (meses 6-10)
  const isElectionSeason = month >= 6 && month <= 10
  
  if (isPresidentialElectionYear && isElectionSeason) {
    const monthsUntilElection = 10 - month
    return {
      isElectionPeriod: true,
      electionType: 'PRESIDENTIAL',
      electionYear: year,
      monthsUntilElection,
      description: `Período eleitoral presidencial ${year}. Eleições em outubro (${monthsUntilElection} ${monthsUntilElection === 1 ? 'mês' : 'meses'} restantes).`
    }
  }
  
  if (isMunicipalElectionYear && isElectionSeason) {
    const monthsUntilElection = 10 - month
    return {
      isElectionPeriod: true,
      electionType: 'MUNICIPAL',
      electionYear: year,
      monthsUntilElection,
      description: `Período eleitoral municipal ${year}. Eleições em outubro (${monthsUntilElection} ${monthsUntilElection === 1 ? 'mês' : 'meses'} restantes).`
    }
  }
  
  // Verificar se estamos próximo de um ano eleitoral (3-6 meses antes)
  const nextPresidentialYear = Math.ceil(year / 4) * 4
  const nextMunicipalYear = year % 2 === 0 ? year + 2 : year + 1
  
  if (isPresidentialElectionYear && month < 6) {
    const monthsUntilElection = 6 - month
    return {
      isElectionPeriod: false,
      electionType: 'PRESIDENTIAL',
      electionYear: year,
      monthsUntilElection,
      description: `Próximo período eleitoral presidencial em ${year} (${monthsUntilElection} ${monthsUntilElection === 1 ? 'mês' : 'meses'} até o início da campanha).`
    }
  }
  
  if (isMunicipalElectionYear && month < 6) {
    const monthsUntilElection = 6 - month
    return {
      isElectionPeriod: false,
      electionType: 'MUNICIPAL',
      electionYear: year,
      monthsUntilElection,
      description: `Próximo período eleitoral municipal em ${year} (${monthsUntilElection} ${monthsUntilElection === 1 ? 'mês' : 'meses'} até o início da campanha).`
    }
  }
  
  return {
    isElectionPeriod: false,
    electionType: 'NONE',
    description: 'Não estamos em período eleitoral próximo.'
  }
}

/**
 * Obtém análise técnica do IBOVESPA usando o ticker ^BVSP
 */
export async function getTechnicalAnalysisForIbov() {
  try {
    const analysis = await getTechnicalAnalysis('^BVSP')
    
    if (!analysis.success || !analysis.data) {
      return {
        success: false,
        error: 'Não foi possível obter análise técnica do IBOVESPA'
      }
    }
    
    const data = analysis.data
    
    return {
      success: true,
      data: {
        rsi: data.rsi,
        macd: data.macd,
        macdSignal: data.macdSignal,
        macdHistogram: data.macdHistogram,
        sma20: data.sma20,
        sma50: data.sma50,
        sma200: data.sma200,
        overallSignal: data.overallSignal,
        supportLevels: data.supportLevels,
        resistanceLevels: data.resistanceLevels,
        aiMinPrice: data.aiMinPrice,
        aiMaxPrice: data.aiMaxPrice,
        aiFairEntryPrice: data.aiFairEntryPrice,
        currentPrice: data.currentPrice,
        aiAnalysis: data.aiAnalysis,
        aiConfidence: data.aiConfidence
      }
    }
  } catch (error) {
    console.error('[IBOV Projection] Erro ao obter análise técnica:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }
  }
}

/**
 * Busca eventos macroeconômicos relevantes via web search
 */
export async function getMacroEconomicEvents(period: 'MONTHLY' | 'ANNUAL'): Promise<MacroEconomicEvents> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return {
        events: [],
        summary: 'API key não configurada para busca de eventos macroeconômicos.'
      }
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    })

    const searchQuery = period === 'MONTHLY'
      ? 'calendário econômico Brasil próximos 30 dias COPOM decisão taxa de juros IPCA PIB'
      : 'calendário econômico Brasil próximos 12 meses eventos macroeconômicos COPOM IPCA PIB decisões importantes'

    const response = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-lite',
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: {
          thinkingBudget: 0
        }
      },
      contents: [
        {
          role: 'user',
          parts: [{
            text: `Busque informações sobre eventos macroeconômicos relevantes para o mercado brasileiro nos próximos ${period === 'MONTHLY' ? '30 dias' : '12 meses'}. 
            
            Foque em:
            - Decisões do COPOM (Comitê de Política Monetária)
            - Divulgação de IPCA e outros índices de inflação
            - Dados de PIB
            - Eventos políticos relevantes
            - Decisões de política fiscal
            
            Retorne uma lista estruturada com datas aproximadas e importância de cada evento.
            
            Formato esperado:
            - Data: [data aproximada]
            - Evento: [nome do evento]
            - Importância: ALTA/MÉDIA/BAIXA
            
            Se não encontrar eventos específicos, retorne uma análise geral do contexto macroeconômico atual.`
          }]
        }
      ]
    })

    let fullResponse = ''
    for await (const chunk of response) {
      if (chunk.text) {
        fullResponse += chunk.text
      }
    }

    // Tentar extrair eventos estruturados da resposta
    const events: MacroEconomicEvents['events'] = []
    const lines = fullResponse.split('\n')
    
    let currentEvent: Partial<MacroEconomicEvents['events'][0]> | null = null
    
    for (const line of lines) {
      if (line.includes('Data:') || line.includes('data:')) {
        const dateMatch = line.match(/(\d{1,2}\/\d{1,2}|\d{1,2} de \w+)/i)
        if (dateMatch) {
          if (currentEvent) events.push(currentEvent as MacroEconomicEvents['events'][0])
          currentEvent = { date: dateMatch[1], event: '', importance: 'MEDIUM' }
        }
      } else if (line.includes('Evento:') || line.includes('evento:')) {
        const eventMatch = line.match(/Evento:\s*(.+)/i)
        if (eventMatch && currentEvent) {
          currentEvent.event = eventMatch[1].trim()
        }
      } else if (line.includes('Importância:') || line.includes('importância:')) {
        const importanceMatch = line.match(/Importância:\s*(ALTA|MÉDIA|BAIXA|HIGH|MEDIUM|LOW)/i)
        if (importanceMatch && currentEvent) {
          const importance = importanceMatch[1].toUpperCase()
          currentEvent.importance = importance === 'ALTA' || importance === 'HIGH' ? 'HIGH' : 
                                    importance === 'BAIXA' || importance === 'LOW' ? 'LOW' : 'MEDIUM'
        }
      }
    }
    
    if (currentEvent) {
      events.push(currentEvent as MacroEconomicEvents['events'][0])
    }

    return {
      events: events.length > 0 ? events : [],
      summary: fullResponse.substring(0, 500) // Limitar resumo
    }
  } catch (error) {
    console.error('[IBOV Projection] Erro ao buscar eventos macroeconômicos:', error)
    return {
      events: [],
      summary: 'Não foi possível buscar eventos macroeconômicos no momento.'
    }
  }
}

/**
 * Converte string de data em português para Date (função local para evitar problemas de cache)
 */
function parsePortugueseDateLocal(dateString: string): Date | null {
  if (!dateString || typeof dateString !== 'string') {
    return null
  }

  const monthMap: Record<string, number> = {
    'janeiro': 0, 'fevereiro': 1, 'março': 2, 'marco': 2,
    'abril': 3, 'maio': 4, 'junho': 5,
    'julho': 6, 'agosto': 7, 'setembro': 8,
    'outubro': 9, 'novembro': 10, 'dezembro': 11
  }

  try {
    let cleaned = dateString
      .replace(/^(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)[- ]feira[,]?\s*/i, '')
      .replace(/,/g, '')
      .trim()

    const simpleMatch = cleaned.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i)
    if (simpleMatch) {
      const day = parseInt(simpleMatch[1], 10)
      const monthName = simpleMatch[2].toLowerCase()
      const year = parseInt(simpleMatch[3], 10)
      
      const month = monthMap[monthName]
      if (month !== undefined && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
        const date = new Date(year, month, day)
        if (date instanceof Date && !isNaN(date.getTime())) {
          return date
        }
      }
    }

    // Tentar formato com range: "27 e 28 de janeiro de 2026" ou "27-28 de janeiro de 2026" (pegar a primeira data)
    const rangeMatchE = cleaned.match(/(\d{1,2})\s+e\s+\d{1,2}\s+de\s+(\w+)\s+de\s+(\d{4})/i)
    const rangeMatchHifen = cleaned.match(/(\d{1,2})[-–]\d{1,2}\s+de\s+(\w+)\s+de\s+(\d{4})/i)
    const rangeMatch = rangeMatchE || rangeMatchHifen
    
    if (rangeMatch) {
      const day = parseInt(rangeMatch[1], 10)
      const monthName = rangeMatch[2].toLowerCase()
      const year = parseInt(rangeMatch[3], 10)
      
      const month = monthMap[monthName]
      if (month !== undefined && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
        const date = new Date(year, month, day)
        if (date instanceof Date && !isNaN(date.getTime())) {
          return date
        }
      }
    }

    // Tentar múltiplas datas separadas por ponto e vírgula ou vírgula
    // Ex: "27-28 de janeiro; 17-18 de março" - pegar a próxima data que ainda não passou
    const multipleDatesMatch = cleaned.match(/(\d{1,2})[-–]\d{1,2}\s+de\s+(\w+)\s+de\s+(\d{4})/gi)
    if (multipleDatesMatch && multipleDatesMatch.length > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // Tentar encontrar a próxima data que ainda não passou
      for (const dateStr of multipleDatesMatch) {
        const singleMatch = dateStr.match(/(\d{1,2})[-–]\d{1,2}\s+de\s+(\w+)\s+de\s+(\d{4})/i)
        if (singleMatch) {
          const day = parseInt(singleMatch[1], 10)
          const monthName = singleMatch[2].toLowerCase()
          const year = parseInt(singleMatch[3], 10)
          
          const month = monthMap[monthName]
          if (month !== undefined && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
            const date = new Date(year, month, day)
            if (date instanceof Date && !isNaN(date.getTime()) && date >= today) {
              return date // Retornar a primeira data futura encontrada
            }
          }
        }
      }
      
      // Se não encontrou data futura, retornar a primeira data encontrada
      const firstMatch = multipleDatesMatch[0].match(/(\d{1,2})[-–]\d{1,2}\s+de\s+(\w+)\s+de\s+(\d{4})/i)
      if (firstMatch) {
        const day = parseInt(firstMatch[1], 10)
        const monthName = firstMatch[2].toLowerCase()
        const year = parseInt(firstMatch[3], 10)
        
        const month = monthMap[monthName]
        if (month !== undefined && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
          const date = new Date(year, month, day)
          if (date instanceof Date && !isNaN(date.getTime())) {
            return date
          }
        }
      }
    }

    const isoDate = new Date(dateString)
    if (isoDate instanceof Date && !isNaN(isoDate.getTime())) {
      return isoDate
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * Busca indicadores econômicos com análise técnica para projeções IBOV
 */
export async function getEconomicIndicatorsWithTechnicalAnalysis(
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'
): Promise<{
  indicators: Map<IndicatorName, Omit<EconomicIndicator, 'technicalAnalysis'> & { technicalAnalysis: IndicatorTechnicalAnalysis | null }>
  crossAnalysis: CrossIndicatorAnalysis | null
}> {
  try {
    // Indicadores principais e complementares para projeções IBOV
    const indicatorNames: IndicatorName[] = [
      // Principais
      'VIX',
      'DI_FUTURO',
      'PETROLEO_WTI',
      'PETROLEO_BRENT',
      'MINERIO_FERRO',
      'DOLAR',
      'SP500',
      // Complementares
      'CDI',
      'SELIC',
      'IPCA',
      'CRB_INDEX',
      'COBRE',
      'SOJA',
      'BOND_YIELD_BR_10Y',
      'CONFIANCA_CONSUMIDOR'
    ]

    // Buscar indicadores atualizados (sem cache)
    const indicators = await fetchMultipleIndicators(indicatorNames, true)

    // Calcular análise técnica para cada indicador
    const technicalAnalyses = await calculateMultipleIndicatorsTechnicalAnalysis(
      indicatorNames,
      period
    )

    // Combinar indicadores com análise técnica
    const indicatorsWithTA = new Map<
      IndicatorName,
      Omit<EconomicIndicator, 'technicalAnalysis'> & { technicalAnalysis: IndicatorTechnicalAnalysis | null }
    >()

    indicators.forEach((indicator, name) => {
      const ta = technicalAnalyses.get(name) || null
      const { technicalAnalysis: _, ...indicatorWithoutTA } = indicator
      indicatorsWithTA.set(name, {
        ...indicatorWithoutTA,
        technicalAnalysis: ta
      })
    })

    // Fazer cruzamento de indicadores
    const crossAnalysis = technicalAnalyses.size > 0 
      ? crossIndicatorAnalysis(technicalAnalyses)
      : null

    // Buscar e salvar expectativas
    const expectations = await getIndicatorExpectations()
    if (expectations.size > 0) {
      const today = new Date()
      for (const [indicatorName, exp] of expectations.entries()) {
        try {
          await persistIndicatorExpectations(indicatorName, today, exp)
        } catch (error) {
          console.warn(`⚠️ [IBOV Projection] Erro ao salvar expectativas de ${indicatorName}:`, error)
        }
      }
    }

    return {
      indicators: indicatorsWithTA,
      crossAnalysis
    }
  } catch (error) {
    console.error('[IBOV Projection] Erro ao buscar indicadores econômicos:', error)
    return {
      indicators: new Map(),
      crossAnalysis: null
    }
  }
}

/**
 * Busca expectativas/forecasts do dia para indicadores econômicos
 */
export async function getIndicatorExpectations(): Promise<Map<IndicatorName, {
  forecast: number | string | null
  consensus: string | null
  nextEvent: string | null
  eventDate: Date | string | null
}>> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return new Map()
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    })

    const response = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-lite',
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: {
          thinkingBudget: 0
        }
      },
      contents: [
        {
          role: 'user',
          parts: [{
            text: `Busque expectativas e forecasts do dia para os seguintes indicadores econômicos brasileiros:
            - DI Futuro (taxa de juros futura)
            - Selic (taxa básica de juros)
            - IPCA (inflação)
            - Dólar (USD/BRL)
            
            Retorne informações sobre:
            - Forecasts/expectativas de mercado
            - Consenso de analistas
            - Próximos eventos agendados (COPOM, divulgação de dados, etc.)
            
            Formato JSON:
            {
              "DI_FUTURO": { "forecast": null, "consensus": "...", "nextEvent": "...", "eventDate": null },
              "SELIC": { ... },
              "IPCA": { ... },
              "DOLAR": { ... }
            }`
          }]
        }
      ]
    })

    let fullResponse = ''
    for await (const chunk of response) {
      if (chunk.text) {
        fullResponse += chunk.text
      }
    }

    // Tentar extrair JSON da resposta
    const jsonMatch = fullResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const expectations = JSON.parse(jsonMatch[0])
        const map = new Map()
        
        Object.entries(expectations).forEach(([key, value]: [string, any]) => {
          // Extrair número do forecast se for string
          let forecast: number | string | null = value.forecast || null
          if (forecast && typeof forecast === 'string') {
            // Tentar extrair número da string
            const numberMatch = forecast.match(/(\d+[,.]?\d*)/)
            if (numberMatch) {
              const numberStr = numberMatch[1].replace(',', '.')
              const parsed = parseFloat(numberStr)
              // Ignorar anos (4 dígitos entre 1900-2100)
              if (!isNaN(parsed) && !(parsed >= 1900 && parsed <= 2100 && numberStr.length === 4)) {
                forecast = parsed
              }
            }
          }

          // Validar eventDate
          let eventDate: Date | string | null = null
          if (value.eventDate) {
            try {
              // Se já for uma Date válida, usar diretamente
              if (value.eventDate instanceof Date && !isNaN(value.eventDate.getTime())) {
                eventDate = value.eventDate
              } else if (typeof value.eventDate === 'string') {
                // Tentar parsear como data em português primeiro
                const parsedPtDate = parsePortugueseDateLocal(value.eventDate)
                
                if (parsedPtDate) {
                  eventDate = parsedPtDate
                } else {
                  // Tentar formato padrão
                  const standardDate = new Date(value.eventDate)
                  if (!isNaN(standardDate.getTime())) {
                    eventDate = standardDate
                  } else {
                    // Manter como string para tentar parsear depois
                    eventDate = value.eventDate
                  }
                }
              } else {
                const stringDate = new Date(String(value.eventDate))
                eventDate = !isNaN(stringDate.getTime()) ? stringDate : null
              }
            } catch (error) {
              // Ignorar datas inválidas
              eventDate = null
            }
          }

          map.set(key as IndicatorName, {
            forecast: forecast,
            consensus: value.consensus || null,
            nextEvent: value.nextEvent || null,
            eventDate: eventDate
          })
        })

        return map
      } catch (parseError) {
        console.warn('[IBOV Projection] Erro ao parsear expectativas:', parseError)
      }
    }

    return new Map()
  } catch (error) {
    console.error('[IBOV Projection] Erro ao buscar expectativas:', error)
    return new Map()
  }
}

/**
 * Calcula correlações entre indicadores e IBOV
 */
export async function getIndicatorCorrelation(): Promise<Map<string, number>> {
  // TODO: Implementar cálculo de correlação histórica
  // Por enquanto retorna mapa vazio
  return new Map()
}

/**
 * Interface para análise de sequências consecutivas
 */
export interface ConsecutiveSequenceAnalysis {
  hasStrongSequence: boolean
  sequenceType: 'HIGH' | 'LOW' | 'BROKEN' | 'NONE'
  consecutiveDays: number
  accumulatedChange: number // percentual
  correctionProbability: number // 0-1
  analysis: string
  shouldConsiderCorrection: boolean
}

/**
 * Analisa sequências consecutivas de altas/baixas no IBOV
 * 
 * @param historicalData Array de dados históricos com { date: string, value: number }
 * @param period Período da projeção (DAILY, WEEKLY, MONTHLY)
 * @returns Análise da sequência consecutiva
 */
export function analyzeConsecutiveSequences(
  historicalData: Array<{ date: string | Date, value: number }>,
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'
): ConsecutiveSequenceAnalysis {
  try {
    // Determinar janela de análise baseada no período
    let analysisWindow: number
    switch (period) {
      case 'DAILY':
        analysisWindow = 5
        break
      case 'WEEKLY':
        analysisWindow = 10
        break
      case 'MONTHLY':
        analysisWindow = 20
        break
      case 'ANNUAL':
        analysisWindow = 20 // Usar mesmo que mensal para análise anual
        break
      default:
        analysisWindow = 10
    }

    // Garantir que temos dados suficientes
    if (!historicalData || historicalData.length < 2) {
      return {
        hasStrongSequence: false,
        sequenceType: 'NONE',
        consecutiveDays: 0,
        accumulatedChange: 0,
        correctionProbability: 0,
        analysis: 'Dados históricos insuficientes para análise de sequências.',
        shouldConsiderCorrection: false
      }
    }

    // Pegar apenas os últimos N dias (ou todos se tivermos menos)
    const recentData = historicalData.slice(-analysisWindow)
    
    if (recentData.length < 2) {
      return {
        hasStrongSequence: false,
        sequenceType: 'NONE',
        consecutiveDays: 0,
        accumulatedChange: 0,
        correctionProbability: 0,
        analysis: 'Dados históricos insuficientes para análise de sequências.',
        shouldConsiderCorrection: false
      }
    }

    // Calcular variações diárias
    const variations: Array<{ date: string | Date, change: number, changePercent: number }> = []
    for (let i = 1; i < recentData.length; i++) {
      const prevValue = recentData[i - 1].value
      const currValue = recentData[i].value
      const change = currValue - prevValue
      const changePercent = (change / prevValue) * 100
      
      variations.push({
        date: recentData[i].date,
        change,
        changePercent
      })
    }

    if (variations.length === 0) {
      return {
        hasStrongSequence: false,
        sequenceType: 'NONE',
        consecutiveDays: 0,
        accumulatedChange: 0,
        correctionProbability: 0,
        analysis: 'Não foi possível calcular variações.',
        shouldConsiderCorrection: false
      }
    }

    // Analisar sequências consecutivas (começando do mais recente)
    let currentSequenceType: 'HIGH' | 'LOW' | null = null
    let consecutiveDays = 0
    let accumulatedChange = 0
    let sequenceBroken = false

    // Analisar de trás para frente (do mais recente para o mais antigo)
    for (let i = variations.length - 1; i >= 0; i--) {
      const variation = variations[i]
      
      // Determinar se é alta ou queda
      const isHigh = variation.changePercent > 0
      const isLow = variation.changePercent < 0
      const isNeutral = Math.abs(variation.changePercent) < 0.1 // Considerar neutro se variação < 0.1%

      // Se for neutro, quebra a sequência
      if (isNeutral) {
        if (consecutiveDays > 0) {
          sequenceBroken = true
        }
        break
      }

      // Se ainda não começou uma sequência
      if (currentSequenceType === null) {
        if (isHigh) {
          currentSequenceType = 'HIGH'
          consecutiveDays = 1
          accumulatedChange = variation.changePercent
        } else if (isLow) {
          currentSequenceType = 'LOW'
          consecutiveDays = 1
          accumulatedChange = variation.changePercent
        }
        continue
      }

      // Se já temos uma sequência, verificar se continua
      if (currentSequenceType === 'HIGH' && isHigh) {
        consecutiveDays++
        accumulatedChange += variation.changePercent
      } else if (currentSequenceType === 'LOW' && isLow) {
        consecutiveDays++
        accumulatedChange += variation.changePercent
      } else {
        // Sequência quebrada (mudou de direção)
        sequenceBroken = true
        break
      }
    }

    // Determinar se é sequência forte: 3+ dias consecutivos E variação acumulada >= 3%
    const isStrongSequence = consecutiveDays >= 3 && Math.abs(accumulatedChange) >= 3.0

    // Determinar tipo de sequência
    let sequenceType: 'HIGH' | 'LOW' | 'BROKEN' | 'NONE'
    if (sequenceBroken) {
      sequenceType = 'BROKEN'
    } else if (isStrongSequence && currentSequenceType === 'HIGH') {
      sequenceType = 'HIGH'
    } else if (isStrongSequence && currentSequenceType === 'LOW') {
      sequenceType = 'LOW'
    } else {
      sequenceType = 'NONE'
    }

    // Calcular probabilidade de correção
    let correctionProbability = 0
    let shouldConsiderCorrection = false
    let analysis = ''

    if (sequenceType === 'BROKEN') {
      // Sequência quebrada: zera o peso deste critério
      correctionProbability = 0
      shouldConsiderCorrection = false
      analysis = `Sequência quebrada detectada. O mercado interrompeu a sequência anterior (${consecutiveDays} dias consecutivos de ${currentSequenceType === 'HIGH' ? 'alta' : 'queda'}). Este critério não será considerado na análise, focando apenas nos indicadores macroeconômicos.`
    } else if (sequenceType === 'HIGH') {
      // Sequência forte de alta: alta probabilidade de correção (queda)
      correctionProbability = Math.min(0.6 + (consecutiveDays - 3) * 0.05 + (Math.abs(accumulatedChange) - 3) * 0.02, 0.8)
      shouldConsiderCorrection = true
      analysis = `Sequência forte de ALTA detectada: ${consecutiveDays} dias consecutivos com alta acumulada de ${accumulatedChange.toFixed(2)}%. Alta probabilidade de correção (${(correctionProbability * 100).toFixed(0)}%). O mercado pode estar sobrecomprado e uma correção é provável.`
    } else if (sequenceType === 'LOW') {
      // Sequência forte de queda: probabilidade moderada de correção (alta)
      correctionProbability = Math.min(0.4 + (consecutiveDays - 3) * 0.03 + (Math.abs(accumulatedChange) - 3) * 0.02, 0.6)
      shouldConsiderCorrection = true
      analysis = `Sequência forte de QUEDA detectada: ${consecutiveDays} dias consecutivos com queda acumulada de ${accumulatedChange.toFixed(2)}%. Probabilidade moderada de correção para alta (${(correctionProbability * 100).toFixed(0)}%). O mercado pode estar sobrevendido e uma correção para alta é possível.`
    } else {
      // Sem sequência forte
      correctionProbability = 0
      shouldConsiderCorrection = false
      analysis = `Nenhuma sequência forte detectada nos últimos ${analysisWindow} dias. Sequência atual: ${consecutiveDays} dias consecutivos de ${currentSequenceType === 'HIGH' ? 'alta' : currentSequenceType === 'LOW' ? 'queda' : 'variação mista'} com variação acumulada de ${accumulatedChange.toFixed(2)}%. Este critério não será considerado na análise, focando apenas nos indicadores macroeconômicos.`
    }

    return {
      hasStrongSequence: isStrongSequence,
      sequenceType,
      consecutiveDays,
      accumulatedChange,
      correctionProbability,
      analysis,
      shouldConsiderCorrection
    }
  } catch (error) {
    console.error('[IBOV Projection] Erro ao analisar sequências consecutivas:', error)
    return {
      hasStrongSequence: false,
      sequenceType: 'NONE',
      consecutiveDays: 0,
      accumulatedChange: 0,
      correctionProbability: 0,
      analysis: `Erro ao analisar sequências consecutivas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      shouldConsiderCorrection: false
    }
  }
}


