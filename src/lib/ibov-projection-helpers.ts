/**
 * Helpers para projeções IBOV mensal e anual
 * Inclui detecção de período eleitoral, análise técnica e eventos macroeconômicos
 */

import { getTechnicalAnalysis } from './ben-tools'
import { GoogleGenAI } from '@google/genai'

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


