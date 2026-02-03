/**
 * Serviço de Indicadores Econômicos
 * Busca e persiste indicadores econômicos para projeções IBOV
 * CRÍTICO: Sempre usa métodos sem cache do Yahoo Finance para projeções
 */

import { prisma } from './prisma'
import { YahooFinance2Service } from './yahooFinance2-service'
import { GoogleGenAI } from '@google/genai'
import { Decimal } from '@prisma/client/runtime/library'

export type IndicatorName = 
  | 'VIX'
  | 'DI_FUTURO'
  | 'PETROLEO_WTI'
  | 'PETROLEO_BRENT'
  | 'MINERIO_FERRO'
  | 'DOLAR'
  | 'SP500'
  | 'CDI'
  | 'SELIC'
  | 'IPCA'
  | 'CRB_INDEX'
  | 'COBRE'
  | 'SOJA'
  | 'BOND_YIELD_BR_10Y'
  | 'CONFIANCA_CONSUMIDOR'

export interface EconomicIndicator {
  name: IndicatorName
  symbol: string
  currentValue: number
  changePercent: number | null
  date: Date
  technicalAnalysis?: {
    rsi: number | null
    macd: number | null
    macdSignal: number | null
    sma20: number | null
    sma50: number | null
    sma200: number | null
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null
    signal: 'BUY' | 'SELL' | 'NEUTRAL' | null
  }
  expectations?: {
    forecast: number | string | null
    consensus: string | null
    nextEvent: string | null
    eventDate: Date | null
  }
  historicalData: Array<{ date: Date; value: number }>
}

export interface IndicatorConfig {
  name: IndicatorName
  symbol: string
  source: 'YAHOO' | 'WEB_SEARCH' | 'API'
  apiUrl?: string
}

const INDICATOR_CONFIGS: IndicatorConfig[] = [
  { name: 'VIX', symbol: '^VIX', source: 'YAHOO' },
  { name: 'PETROLEO_WTI', symbol: 'CL=F', source: 'YAHOO' },
  { name: 'PETROLEO_BRENT', symbol: 'BZ=F', source: 'YAHOO' },
  { name: 'DOLAR', symbol: 'USDBRL=X', source: 'YAHOO' },
  { name: 'SP500', symbol: '^GSPC', source: 'YAHOO' },
  { name: 'CRB_INDEX', symbol: '^CRB', source: 'YAHOO' },
  { name: 'COBRE', symbol: 'HG=F', source: 'YAHOO' },
  { name: 'SOJA', symbol: 'ZS=F', source: 'YAHOO' },
  { name: 'DI_FUTURO', symbol: '', source: 'WEB_SEARCH' },
  { name: 'MINERIO_FERRO', symbol: '', source: 'WEB_SEARCH' },
  { name: 'CDI', symbol: '', source: 'WEB_SEARCH' },
  { name: 'SELIC', symbol: '', source: 'WEB_SEARCH' },
  { name: 'IPCA', symbol: '', source: 'WEB_SEARCH' },
  { name: 'BOND_YIELD_BR_10Y', symbol: '', source: 'WEB_SEARCH' },
  { name: 'CONFIANCA_CONSUMIDOR', symbol: '', source: 'WEB_SEARCH' },
]

/**
 * Busca dados atualizados de um indicador do Yahoo Finance SEM CACHE
 */
async function fetchYahooIndicator(
  symbol: string,
  indicatorName: IndicatorName
): Promise<{ value: number; changePercent: number | null; date: Date } | null> {
  try {
    // CRÍTICO: Usar getQuoteWithoutCache para garantir dados atualizados
    const quote = await YahooFinance2Service.getQuoteWithoutCache(symbol)
    
    if (!quote?.regularMarketPrice) {
      console.warn(`⚠️ [ECONOMIC INDICATORS] ${indicatorName}: Sem preço disponível`)
      return null
    }

    const value = Number(quote.regularMarketPrice)
    const previousClose = quote.regularMarketPreviousClose 
      ? Number(quote.regularMarketPreviousClose) 
      : null
    
    const changePercent = previousClose && previousClose > 0
      ? ((value - previousClose) / previousClose) * 100
      : null

    const date = new Date()

    console.log(`✅ [ECONOMIC INDICATORS] ${indicatorName}: ${value} (${changePercent !== null ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%` : 'N/A'})`)

    return { value, changePercent, date }
  } catch (error) {
    console.error(`❌ [ECONOMIC INDICATORS] Erro ao buscar ${indicatorName}:`, error)
    return null
  }
}

/**
 * Busca dados históricos de um indicador do Yahoo Finance SEM CACHE
 */
async function fetchYahooHistorical(
  symbol: string,
  startDate: Date,
  endDate: Date,
  interval: '1d' | '1wk' | '1mo' = '1d'
): Promise<Array<{ date: Date; value: number }>> {
  try {
    // CRÍTICO: Usar getChartWithoutCache para garantir dados atualizados
    const chartResult = await YahooFinance2Service.getChartWithoutCache(symbol, {
      period1: startDate,
      period2: endDate,
      interval: interval,
      return: 'array'
    })

    // O resultado pode vir como array direto ou como objeto com quotes
    let chartData: any[] = []
    if (Array.isArray(chartResult)) {
      chartData = chartResult
    } else if (chartResult?.quotes && Array.isArray(chartResult.quotes)) {
      chartData = chartResult.quotes
    } else if (chartResult?.result && Array.isArray(chartResult.result)) {
      chartData = chartResult.result
    } else {
      console.warn(`⚠️ [ECONOMIC INDICATORS] Formato inesperado de retorno do Yahoo para ${symbol}`)
      return []
    }

    if (chartData.length === 0) {
      return []
    }

    const historicalData = chartData
      .filter((item: any) => {
        // Verificar se tem close ou adjClose
        const value = item.close || item.adjClose
        return value && value > 0
      })
      .map((item: any) => {
        const value = item.close || item.adjClose || 0
        const date = item.date ? new Date(item.date) : null
        
        if (!date || isNaN(date.getTime())) {
          return null
        }

        return {
          date,
          value: Number(value)
        }
      })
      .filter((item: any): item is { date: Date; value: number } => item !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    return historicalData
  } catch (error) {
    console.error(`❌ [ECONOMIC INDICATORS] Erro ao buscar histórico de ${symbol}:`, error)
    return []
  }
}

/**
 * Busca indicador via web search usando Gemini
 */
async function fetchWebSearchIndicator(
  indicatorName: IndicatorName,
  searchQuery: string
): Promise<{ value: number; changePercent: number | null; date: Date } | null> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn(`⚠️ [ECONOMIC INDICATORS] GEMINI_API_KEY não configurada para ${indicatorName}`)
      return null
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
            text: `Busque o valor atual de ${searchQuery}. Retorne APENAS um número (valor atual) e opcionalmente a variação percentual. Formato: "valor: X.XX" ou "valor: X.XX, variação: Y.YY%"`
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

    // Extrair valor numérico da resposta
    const valueMatch = fullResponse.match(/valor[:\s]+([\d,]+\.?\d*)/i)
    const changeMatch = fullResponse.match(/variação[:\s]+([+-]?[\d,]+\.?\d*)%/i)

    if (!valueMatch) {
      console.warn(`⚠️ [ECONOMIC INDICATORS] ${indicatorName}: Não foi possível extrair valor da resposta`)
      return null
    }

    const value = parseFloat(valueMatch[1].replace(',', '.'))
    const changePercent = changeMatch ? parseFloat(changeMatch[1].replace(',', '.')) : null

    console.log(`✅ [ECONOMIC INDICATORS] ${indicatorName}: ${value} (${changePercent !== null ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%` : 'N/A'})`)

    return { value, changePercent, date: new Date() }
  } catch (error) {
    console.error(`❌ [ECONOMIC INDICATORS] Erro ao buscar ${indicatorName} via web search:`, error)
    return null
  }
}

/**
 * Persiste dados de indicador na tabela EconomicIndicatorHistory
 */
async function persistIndicatorData(
  indicatorName: IndicatorName,
  symbol: string,
  data: {
    date: Date
    value: number
    changePercent: number | null
    interval?: string
    open?: number
    high?: number
    low?: number
    close?: number
    volume?: number
    forecast?: number | null
    consensus?: string | null
    nextEvent?: string | null
    eventDate?: Date | null
  }
): Promise<void> {
  try {
    const interval = data.interval || '1d'
    const dateOnly = new Date(data.date.getFullYear(), data.date.getMonth(), data.date.getDate())
    const eventDateOnly = data.eventDate 
      ? new Date(data.eventDate.getFullYear(), data.eventDate.getMonth(), data.eventDate.getDate())
      : null

    await prisma.economicIndicatorHistory.upsert({
      where: {
        indicatorName_date_interval: {
          indicatorName,
          date: dateOnly,
          interval
        }
      },
      create: {
        indicatorName,
        symbol,
        date: dateOnly,
        interval,
        value: new Decimal(data.value),
        changePercent: data.changePercent !== null ? new Decimal(data.changePercent) : null,
        open: data.open !== undefined ? new Decimal(data.open) : null,
        high: data.high !== undefined ? new Decimal(data.high) : null,
        low: data.low !== undefined ? new Decimal(data.low) : null,
        close: data.close !== undefined ? new Decimal(data.close) : null,
        volume: data.volume !== undefined ? new Decimal(data.volume) : null,
        forecast: data.forecast !== null && data.forecast !== undefined ? new Decimal(data.forecast) : null,
        consensus: data.consensus || null,
        nextEvent: data.nextEvent || null,
        eventDate: eventDateOnly,
      },
      update: {
        value: new Decimal(data.value),
        changePercent: data.changePercent !== null ? new Decimal(data.changePercent) : null,
        open: data.open !== undefined ? new Decimal(data.open) : null,
        high: data.high !== undefined ? new Decimal(data.high) : null,
        low: data.low !== undefined ? new Decimal(data.low) : null,
        close: data.close !== undefined ? new Decimal(data.close) : null,
        volume: data.volume !== undefined ? new Decimal(data.volume) : null,
        forecast: data.forecast !== null && data.forecast !== undefined ? new Decimal(data.forecast) : null,
        consensus: data.consensus || null,
        nextEvent: data.nextEvent || null,
        eventDate: eventDateOnly,
        updatedAt: new Date(),
      }
    })
  } catch (error) {
    console.error(`❌ [ECONOMIC INDICATORS] Erro ao persistir dados de ${indicatorName}:`, error)
    throw error
  }
}

/**
 * Extrai número de uma string (ex: "12,25%" -> 12.25)
 */
function extractNumberFromString(value: string | number | null): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return null

  // Tentar extrair número da string (suporta formatos como "12,25%", "R$ 4,73", etc.)
  // Ignorar anos (4 dígitos isolados como "2024", "2026")
  const numberMatch = value.match(/(\d+[,.]?\d*)/)
  if (!numberMatch) return null

  const numberStr = numberMatch[1].replace(',', '.')
  const parsed = parseFloat(numberStr)
  
  // Se for um ano (4 dígitos entre 1900-2100), não retornar
  if (parsed >= 1900 && parsed <= 2100 && numberStr.length === 4) {
    return null
  }
  
  return isNaN(parsed) ? null : parsed
}

/**
 * Valida se uma data é válida
 */
function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * Converte string de data em português para Date
 * Suporta formatos como:
 * - "27 e 28 de janeiro de 2026"
 * - "Segunda-feira, 2 de fevereiro de 2026"
 * - "10 de fevereiro de 2026"
 * - "18 e 19 de março de 2026"
 */
export function parsePortugueseDate(dateString: string): Date | null {
  if (!dateString || typeof dateString !== 'string') {
    return null
  }

  // Mapeamento de meses em português
  const monthMap: Record<string, number> = {
    'janeiro': 0, 'fevereiro': 1, 'março': 2, 'marco': 2,
    'abril': 3, 'maio': 4, 'junho': 5,
    'julho': 6, 'agosto': 7, 'setembro': 8,
    'outubro': 9, 'novembro': 10, 'dezembro': 11
  }

  try {
    // Remover dias da semana e vírgulas
    let cleaned = dateString
      .replace(/^(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)[- ]feira[,]?\s*/i, '')
      .replace(/,/g, '')
      .trim()

    // Tentar extrair data do formato "X de Y de Z" ou "X e Y de Z de W"
    // Primeiro, tentar formato simples: "10 de fevereiro de 2026"
    const simpleMatch = cleaned.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i)
    if (simpleMatch) {
      const day = parseInt(simpleMatch[1], 10)
      const monthName = simpleMatch[2].toLowerCase()
      const year = parseInt(simpleMatch[3], 10)
      
      const month = monthMap[monthName]
      if (month !== undefined && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
        const date = new Date(year, month, day)
        if (isValidDate(date)) {
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
        if (isValidDate(date)) {
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
            if (isValidDate(date) && date >= today) {
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
          if (isValidDate(date)) {
            return date
          }
        }
      }
    }

    // Tentar formato ISO ou padrão
    const isoDate = new Date(dateString)
    if (isValidDate(isoDate)) {
      return isoDate
    }

    return null
  } catch (error) {
    console.warn(`⚠️ [ECONOMIC INDICATORS] Erro ao parsear data em português: "${dateString}"`, error)
    return null
  }
}

/**
 * Atualiza expectativas de um indicador na tabela
 */
export async function persistIndicatorExpectations(
  indicatorName: IndicatorName,
  date: Date,
  expectations: {
    forecast: number | string | null
    consensus: string | null
    nextEvent: string | null
    eventDate: Date | string | null
  }
): Promise<void> {
  try {
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    
    // Validar e converter eventDate
    let eventDateOnly: Date | null = null
    if (expectations.eventDate) {
      let eventDate: Date | null = null
      
      if (expectations.eventDate instanceof Date) {
        eventDate = isValidDate(expectations.eventDate) ? expectations.eventDate : null
      } else if (typeof expectations.eventDate === 'string') {
        // Tentar parsear como data em português primeiro
        eventDate = parsePortugueseDate(expectations.eventDate)
        
        // Se não funcionar, tentar formato padrão
        if (!eventDate) {
          const standardDate = new Date(expectations.eventDate)
          eventDate = isValidDate(standardDate) ? standardDate : null
        }
      } else {
        const stringDate = new Date(String(expectations.eventDate))
        eventDate = isValidDate(stringDate) ? stringDate : null
      }
      
      // Verificar se a data é válida
      if (eventDate && isValidDate(eventDate)) {
        eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())
      } else {
        console.warn(`⚠️ [ECONOMIC INDICATORS] Data inválida para ${indicatorName}: ${expectations.eventDate}`)
      }
    }

    // Extrair número do forecast se for string
    const forecastNumber = extractNumberFromString(expectations.forecast)

    await prisma.economicIndicatorHistory.updateMany({
      where: {
        indicatorName,
        date: dateOnly,
        interval: '1d'
      },
      data: {
        forecast: forecastNumber !== null ? new Decimal(forecastNumber) : null,
        consensus: expectations.consensus || null,
        nextEvent: expectations.nextEvent || null,
        eventDate: eventDateOnly,
        updatedAt: new Date(),
      }
    })
  } catch (error) {
    console.error(`❌ [ECONOMIC INDICATORS] Erro ao persistir expectativas de ${indicatorName}:`, error)
    // Não lançar erro, apenas logar
  }
}

/**
 * Busca dados históricos do banco de dados
 */
async function getHistoricalFromDatabase(
  indicatorName: IndicatorName,
  startDate: Date,
  endDate: Date,
  interval: string = '1d'
): Promise<Array<{ date: Date; value: number }>> {
  try {
    const records = await prisma.economicIndicatorHistory.findMany({
      where: {
        indicatorName,
        interval,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        date: 'asc'
      },
      select: {
        date: true,
        value: true
      }
    })

    return records.map(record => ({
      date: record.date,
      value: Number(record.value)
    }))
  } catch (error) {
    console.error(`❌ [ECONOMIC INDICATORS] Erro ao buscar histórico do banco para ${indicatorName}:`, error)
    return []
  }
}

/**
 * Busca último registro de um indicador no banco
 */
async function getLastIndicatorDate(
  indicatorName: IndicatorName,
  interval: string = '1d'
): Promise<Date | null> {
  try {
    const lastRecord = await prisma.economicIndicatorHistory.findFirst({
      where: {
        indicatorName,
        interval
      },
      orderBy: {
        date: 'desc'
      },
      select: {
        date: true
      }
    })

    return lastRecord?.date || null
  } catch (error) {
    console.error(`❌ [ECONOMIC INDICATORS] Erro ao buscar última data de ${indicatorName}:`, error)
    return null
  }
}

/**
 * Busca indicador econômico atualizado (sem cache) e persiste no banco
 */
export async function fetchEconomicIndicator(
  indicatorName: IndicatorName,
  useForProjection: boolean = true
): Promise<EconomicIndicator | null> {
  const config = INDICATOR_CONFIGS.find(c => c.name === indicatorName)
  if (!config) {
    console.error(`❌ [ECONOMIC INDICATORS] Configuração não encontrada para ${indicatorName}`)
    return null
  }

  try {
    let currentData: { value: number; changePercent: number | null; date: Date } | null = null

    // Buscar dados atualizados
    if (config.source === 'YAHOO' && config.symbol) {
      currentData = await fetchYahooIndicator(config.symbol, indicatorName)
      
      if (currentData) {
        // Persistir dados atuais
        await persistIndicatorData(indicatorName, config.symbol, {
          ...currentData,
          interval: '1d'
        })
      }
    } else if (config.source === 'WEB_SEARCH') {
      // Buscar via web search
      const searchQueries: Record<IndicatorName, string> = {
        'DI_FUTURO': 'DI Futuro taxa de juros Brasil B3',
        'MINERIO_FERRO': 'preço minério de ferro atual Brasil',
        'CDI': 'taxa CDI atual Brasil',
        'SELIC': 'taxa Selic atual Brasil COPOM',
        'IPCA': 'IPCA inflação Brasil atual',
        'BOND_YIELD_BR_10Y': 'bond yield Brasil 10 anos título público',
        'CONFIANCA_CONSUMIDOR': 'índice confiança consumidor Brasil FGV IBGE',
        'VIX': '',
        'PETROLEO_WTI': '',
        'PETROLEO_BRENT': '',
        'DOLAR': '',
        'SP500': '',
        'CRB_INDEX': '',
        'COBRE': '',
        'SOJA': '',
      }

      currentData = await fetchWebSearchIndicator(indicatorName, searchQueries[indicatorName])
      
      if (currentData) {
        await persistIndicatorData(indicatorName, config.symbol || indicatorName, {
          ...currentData,
          interval: '1d'
        })
      }
    }

    if (!currentData) {
      return null
    }

    // Buscar histórico do banco (se disponível)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 365) // Último ano

    const historicalData = await getHistoricalFromDatabase(
      indicatorName,
      startDate,
      endDate,
      '1d'
    )

    return {
      name: indicatorName,
      symbol: config.symbol || indicatorName,
      currentValue: currentData.value,
      changePercent: currentData.changePercent,
      date: currentData.date,
      historicalData: [...historicalData, { date: currentData.date, value: currentData.value }]
        .sort((a, b) => a.date.getTime() - b.date.getTime())
    }
  } catch (error) {
    console.error(`❌ [ECONOMIC INDICATORS] Erro ao buscar ${indicatorName}:`, error)
    return null
  }
}

/**
 * Busca múltiplos indicadores em paralelo
 */
export async function fetchMultipleIndicators(
  indicatorNames: IndicatorName[],
  useForProjection: boolean = true
): Promise<Map<IndicatorName, EconomicIndicator>> {
  const results = await Promise.all(
    indicatorNames.map(async (name) => {
      const indicator = await fetchEconomicIndicator(name, useForProjection)
      return { name, indicator }
    })
  )

  const map = new Map<IndicatorName, EconomicIndicator>()
  results.forEach(({ name, indicator }) => {
    if (indicator) {
      map.set(name, indicator)
    }
  })

  return map
}

/**
 * Determina o intervalo apropriado baseado no período da projeção
 */
function getIntervalForPeriod(period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'): '1d' | '1wk' | '1mo' {
  switch (period) {
    case 'DAILY':
      return '1d'
    case 'WEEKLY':
      return '1wk'
    case 'MONTHLY':
      return '1mo'
    case 'ANNUAL':
      return '1mo'
    default:
      return '1d'
  }
}

/**
 * Garante que temos dados históricos para um intervalo específico
 */
export async function ensureIndicatorDataForInterval(
  indicatorName: IndicatorName,
  interval: '1d' | '1wk' | '1mo',
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'
): Promise<void> {
  const config = INDICATOR_CONFIGS.find(c => c.name === indicatorName)
  if (!config || config.source !== 'YAHOO' || !config.symbol) {
    return
  }

  const endDate = new Date()
  const startDate = new Date()
  
  // Ajustar janelas de tempo baseado no intervalo
  switch (interval) {
    case '1d':
      startDate.setDate(startDate.getDate() - 30) // Últimos 30 dias
      break
    case '1wk':
      startDate.setDate(startDate.getDate() - 90) // Últimos 90 dias (≈13 semanas)
      break
    case '1mo':
      // Para mensal, usar período maior baseado no período da projeção
      if (period === 'ANNUAL') {
        startDate.setFullYear(startDate.getFullYear() - 5) // Últimos 5 anos (60 meses)
      } else {
        startDate.setMonth(startDate.getMonth() - 24) // Últimos 24 meses
      }
      break
  }

  // Verificar se já temos dados suficientes com esse intervalo
  const existingData = await getHistoricalFromDatabase(indicatorName, startDate, endDate, interval)
  
  // Se não tiver dados suficientes, buscar do Yahoo Finance
  const minRequired = interval === '1d' ? 20 : interval === '1wk' ? 10 : 12
  if (existingData.length < minRequired) {
    try {
      const yahooData = await fetchYahooHistorical(config.symbol, startDate, endDate, interval)
      
      for (const item of yahooData) {
        try {
          await persistIndicatorData(indicatorName, config.symbol, {
            date: item.date,
            value: item.value,
            changePercent: null,
            interval  // Salvar com o intervalo correto
          })
        } catch (error) {
          // Ignorar erros de duplicação
        }
      }
    } catch (error) {
      console.warn(`⚠️ [ECONOMIC INDICATORS] Erro ao buscar dados ${interval} para ${indicatorName}:`, error)
    }
  }
}

/**
 * Garante que temos dados históricos com o intervalo apropriado para o período
 * E também garante dados para outros intervalos quando necessário
 */
export async function ensureIndicatorDataForPeriod(
  indicatorName: IndicatorName,
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'
): Promise<void> {
  const interval = getIntervalForPeriod(period)
  
  // Garantir dados para o intervalo principal do período
  await ensureIndicatorDataForInterval(indicatorName, interval, period)
  
  // Também garantir dados para outros intervalos em background
  const allIntervals: ('1d' | '1wk' | '1mo')[] = ['1d', '1wk', '1mo']
  const otherIntervals = allIntervals.filter(intvl => intvl !== interval)
  
  await Promise.all(
    otherIntervals.map(intvl => 
      ensureIndicatorDataForInterval(indicatorName, intvl, period)
        .catch(error => {
          console.warn(`⚠️ [ECONOMIC INDICATORS] Erro ao garantir dados ${intvl} para ${indicatorName}:`, error)
        })
    )
  )
}

/**
 * Busca histórico de um indicador para análise técnica
 */
export async function getIndicatorHistoryForTechnicalAnalysis(
  indicatorName: IndicatorName,
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL',
  interval?: '1d' | '1wk' | '1mo'  // Tornar opcional
): Promise<Array<{ date: Date; value: number }>> {
  const endDate = new Date()
  const startDate = new Date()

  // Determinar intervalo se não fornecido
  if (!interval) {
    interval = getIntervalForPeriod(period)
  }

  // Ajustar janelas de tempo por período e intervalo
  switch (period) {
    case 'DAILY':
      startDate.setDate(startDate.getDate() - 30) // Últimos 30 dias
      break
    case 'WEEKLY':
      if (interval === '1wk') {
        startDate.setDate(startDate.getDate() - 90) // Últimos 90 dias (≈13 semanas)
      } else {
        startDate.setDate(startDate.getDate() - 30) // Fallback para diário
      }
      break
    case 'MONTHLY':
      if (interval === '1mo') {
        startDate.setMonth(startDate.getMonth() - 24) // Últimos 24 meses
      } else {
        startDate.setMonth(startDate.getMonth() - 12) // Fallback
      }
      break
    case 'ANNUAL':
      if (interval === '1mo') {
        startDate.setFullYear(startDate.getFullYear() - 5) // Últimos 5 anos (60 meses)
      } else {
        startDate.setFullYear(startDate.getFullYear() - 3) // Fallback
      }
      break
  }

  // Buscar do banco primeiro
  const dbData = await getHistoricalFromDatabase(indicatorName, startDate, endDate, interval)

  // Ajustar threshold mínimo baseado no intervalo
  const minRequired = interval === '1d' ? 20 : interval === '1wk' ? 10 : 12

  // Se não houver dados suficientes no banco, buscar do Yahoo Finance (sem cache)
  if (dbData.length < minRequired) {
    const config = INDICATOR_CONFIGS.find(c => c.name === indicatorName)
    if (config?.source === 'YAHOO' && config.symbol) {
      try {
        const yahooData = await fetchYahooHistorical(config.symbol, startDate, endDate, interval)
        
        // Persistir dados novos apenas se houver dados válidos
        if (yahooData.length > 0) {
          for (const item of yahooData) {
            try {
              await persistIndicatorData(indicatorName, config.symbol, {
                date: item.date,
                value: item.value,
                changePercent: null,
                interval
              })
            } catch (error) {
              console.warn(`⚠️ [ECONOMIC INDICATORS] Erro ao persistir histórico de ${indicatorName} para ${item.date}:`, error)
            }
          }
          return yahooData
        }
      } catch (error) {
        console.warn(`⚠️ [ECONOMIC INDICATORS] Erro ao buscar histórico do Yahoo para ${indicatorName} (${config.symbol}):`, error)
        // Continuar com dados do banco mesmo que sejam insuficientes
      }
    }
  }

  return dbData
}

