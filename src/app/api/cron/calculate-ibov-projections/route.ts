/**
 * Cron Job: Calcular Projeções IBOV
 * 
 * Executa automaticamente:
 * - Diário: Todo dia útil às 08:00 ou após se ainda não foi calculado (horário de Brasília)
 * - Semanal: Toda segunda-feira útil às 08:00 ou após se ainda não foi calculado
 * - Mensal: Todo dia 1 útil às 08:00 ou após se ainda não foi calculado
 * - Anual: Todo dia 1 de cada mês útil às 08:00 ou após se ainda não foi calculado (revisão mensal)
 * 
 * IMPORTANTE: Regras de execução
 * - NÃO executa em sábados, domingos ou feriados nacionais do Brasil
 * - Verifica se já existe projeção válida antes de calcular
 * - Permite cálculo após as 08:00 se ainda não tiver sido calculado para o período
 * - Tolerante a falhas: não recalcula se já existe projeção válida para o período
 * - Projeção anual é revisada mensalmente (todo dia 1 de cada mês)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GoogleGenAI } from '@google/genai'
import { getIbovData } from '@/lib/ben-tools'
import { 
  getElectionPeriod, 
  getTechnicalAnalysisForIbov, 
  getMacroEconomicEvents,
  getEconomicIndicatorsWithTechnicalAnalysis,
  getIndicatorExpectations,
  analyzeConsecutiveSequences
} from '@/lib/ibov-projection-helpers'
import { getTodayInBrazil } from '@/lib/market-status'

export const maxDuration = 60 // Limite da Vercel

/**
 * Verifica se é feriado nacional do Brasil
 * Retorna true se for feriado nacional fixo
 */
function isBrazilianNationalHoliday(date: Date): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  
  const parts = formatter.formatToParts(date)
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10)
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10)
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10)
  
  // Feriados nacionais fixos do Brasil
  const fixedHolidays = [
    { month: 1, day: 1 },   // Ano Novo
    { month: 4, day: 21 },  // Tiradentes
    { month: 5, day: 1 },   // Dia do Trabalhador
    { month: 9, day: 7 },   // Independência
    { month: 10, day: 12 }, // Nossa Senhora Aparecida
    { month: 11, day: 2 },  // Finados
    { month: 11, day: 15 }, // Proclamação da República
    { month: 12, day: 25 }, // Natal
  ]
  
  // Verificar feriados fixos
  for (const holiday of fixedHolidays) {
    if (month === holiday.month && day === holiday.day) {
      return true
    }
  }
  
  // Verificar Carnaval (terça-feira, 47 dias antes da Páscoa)
  // Páscoa: primeiro domingo após a primeira lua cheia após 21 de março
  const easter = calculateEaster(year)
  const carnival = new Date(easter)
  carnival.setDate(easter.getDate() - 47)
  
  const carnivalFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  const carnivalParts = carnivalFormatter.formatToParts(carnival)
  const carnivalMonth = parseInt(carnivalParts.find(p => p.type === 'month')?.value || '0', 10)
  const carnivalDay = parseInt(carnivalParts.find(p => p.type === 'day')?.value || '0', 10)
  
  if (month === carnivalMonth && day === carnivalDay) {
    return true
  }
  
  // Verificar Sexta-feira Santa (2 dias antes da Páscoa)
  const goodFriday = new Date(easter)
  goodFriday.setDate(easter.getDate() - 2)
  
  const goodFridayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  const goodFridayParts = goodFridayFormatter.formatToParts(goodFriday)
  const goodFridayMonth = parseInt(goodFridayParts.find(p => p.type === 'month')?.value || '0', 10)
  const goodFridayDay = parseInt(goodFridayParts.find(p => p.type === 'day')?.value || '0', 10)
  
  if (month === goodFridayMonth && day === goodFridayDay) {
    return true
  }
  
  return false
}

/**
 * Calcula a data da Páscoa para um ano específico
 * Algoritmo de Meeus/Jones/Butcher
 * Retorna uma Date que representa a Páscoa no timezone de Brasília
 */
function calculateEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  
  // Criar data UTC que representa 00:00:00 no timezone de Brasília
  // Usar uma abordagem similar à getTodayInBrazil para garantir timezone correto
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  
  // Criar uma data de teste para descobrir o offset de Brasília
  const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
  const testParts = formatter.formatToParts(testDate)
  const testHour = parseInt(testParts.find(p => p.type === 'hour')?.value || '0', 10)
  
  // Calcular offset: se testDate é 12:00 UTC e em Brasília é testHour, então:
  // offset = 12 - testHour
  const offset = 12 - testHour
  
  // Criar data UTC que representa 00:00:00 em Brasília
  const utcHour = 0 + offset
  return new Date(Date.UTC(year, month - 1, day, utcHour, 0, 0, 0))
}

/**
 * Verifica se é dia útil no Brasil (não é sábado, domingo nem feriado nacional)
 */
function isTradingDay(date: Date): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  })
  
  const weekday = formatter.formatToParts(date).find(p => p.type === 'weekday')?.value || ''
  const dayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0
  }
  const dayOfWeek = dayMap[weekday] ?? 0
  
  // Verificar se é sábado ou domingo
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false
  }
  
  // Verificar se é feriado nacional
  if (isBrazilianNationalHoliday(date)) {
    return false
  }
  
  return true
}

/**
 * Valida se uma projeção IBOV é válida
 */
function validateIbovProjection(projection: {
  projectedValue: number
  confidence: number
  reasoning: string
  currentValue?: number
}, period?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'): boolean {
  if (projection.projectedValue <= 0 || projection.projectedValue > 200000) {
    return false
  }

  if (projection.currentValue) {
    const variation = Math.abs(
      (projection.projectedValue - projection.currentValue) / projection.currentValue
    )
    
    // Limites conservadores por período (estimativas realistas)
    let maxVariation: number
    switch (period) {
      case 'DAILY':
        maxVariation = 0.03 // Máximo 3% de variação em um dia
        break
      case 'WEEKLY':
        maxVariation = 0.06 // Máximo 6% de variação em uma semana
        break
      case 'MONTHLY':
        maxVariation = 0.10 // Máximo 10% de variação em um mês
        break
      case 'ANNUAL':
        maxVariation = 0.20 // Máximo 20% de variação em um ano
        break
      default:
        maxVariation = 0.20 // Padrão conservador
    }
    
    if (variation > maxVariation) {
      return false
    }
  }

  if (projection.confidence < 30) {
    return false
  }

  if (!projection.reasoning || projection.reasoning.trim().length < 50) {
    return false
  }

  return true
}

/**
 * Corrige o reasoning para garantir que reflita a direção correta da projeção
 */
function correctReasoningDirection(
  reasoning: string,
  projectedValue: number,
  currentValue: number
): string {
  // Determinar a direção correta
  const variation = (projectedValue - currentValue) / currentValue
  const absVariation = Math.abs(variation)
  
  let correctDirection: string
  if (absVariation < 0.005) { // Menos de 0.5% de diferença
    correctDirection = 'ESTABILIDADE'
  } else if (variation > 0) {
    correctDirection = 'ALTA'
  } else {
    correctDirection = 'QUEDA'
  }
  
  // Verificar se o reasoning já tem a direção correta
  const reasoningUpper = reasoning.toUpperCase()
  const hasAlta = reasoningUpper.includes('PROJEÇÃO: ALTA') || reasoningUpper.includes('**PROJEÇÃO: ALTA')
  const hasQueda = reasoningUpper.includes('PROJEÇÃO: QUEDA') || reasoningUpper.includes('**PROJEÇÃO: QUEDA')
  const hasEstabilidade = reasoningUpper.includes('PROJEÇÃO: ESTABILIDADE') || reasoningUpper.includes('**PROJEÇÃO: ESTABILIDADE')
  
  const currentDirection = hasAlta ? 'ALTA' : hasQueda ? 'QUEDA' : hasEstabilidade ? 'ESTABILIDADE' : null
  
  // Se já está correto, retornar sem alterações
  if (currentDirection === correctDirection) {
    return reasoning
  }
  
  // Corrigir o reasoning
  let correctedReasoning = reasoning
  
  // Substituir qualquer ocorrência de PROJEÇÃO: ALTA/QUEDA/ESTABILIDADE
  correctedReasoning = correctedReasoning.replace(
    /\*\*PROJEÇÃO:\s*(ALTA|QUEDA|ESTABILIDADE)\*\*/gi,
    `**PROJEÇÃO: ${correctDirection}**`
  )
  correctedReasoning = correctedReasoning.replace(
    /PROJEÇÃO:\s*(ALTA|QUEDA|ESTABILIDADE)/gi,
    `PROJEÇÃO: ${correctDirection}`
  )
  
  // Se não encontrou nenhuma ocorrência, adicionar no início
  if (!hasAlta && !hasQueda && !hasEstabilidade) {
    // Tentar encontrar onde inserir
    const lines = correctedReasoning.split('\n')
    const firstLineIndex = lines.findIndex(line => 
      line.trim().toUpperCase().includes('PROJEÇÃO') || 
      line.trim().toUpperCase().includes('MOTIVOS')
    )
    
    if (firstLineIndex >= 0) {
      lines.splice(firstLineIndex, 0, `**PROJEÇÃO: ${correctDirection}**`)
      correctedReasoning = lines.join('\n')
    } else {
      // Adicionar no início
      correctedReasoning = `**PROJEÇÃO: ${correctDirection}**\n\n${correctedReasoning}`
    }
  }
  
  // Adicionar nota de correção se necessário
  if (currentDirection && currentDirection !== correctDirection) {
    const variationPercent = (variation * 100).toFixed(2)
    correctedReasoning += `\n\n[Nota: A direção da projeção foi corrigida automaticamente para refletir que o valor projetado (${projectedValue.toFixed(2)}) representa uma ${correctDirection === 'ALTA' ? 'alta' : correctDirection === 'QUEDA' ? 'queda' : 'estabilidade'} de ${variationPercent}% em relação ao valor atual (${currentValue.toFixed(2)})]`
  }
  
  return correctedReasoning
}

/**
 * Calcula projeção IBOV para um período específico
 */
async function calculateProjection(period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL', forceNextMonth = false) {
  try {
    const now = new Date()

    // Verificar se já existe projeção válida
    const existingProjection = await prisma.ibovProjection.findFirst({
      where: {
        period,
        validUntil: {
          gt: now
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (existingProjection && !forceNextMonth) {
      console.log(`✅ Projeção ${period} já existe e está válida até ${existingProjection.validUntil}`)
      return {
        success: true,
        cached: true,
        period
      }
    }

    // Determinar quantos dias de histórico precisamos para análise de sequências
    let historicalDays: number
    switch (period) {
      case 'DAILY':
        historicalDays = 5
        break
      case 'WEEKLY':
        historicalDays = 10
        break
      case 'MONTHLY':
        historicalDays = 20
        break
      case 'ANNUAL':
        historicalDays = 20
        break
      default:
        historicalDays = 10
    }

    // Buscar dados reais do IBOV com histórico suficiente
    const ibovData = await getIbovData(historicalDays)
    if (!ibovData.success || !ibovData.data) {
      throw new Error('Não foi possível obter dados do IBOVESPA')
    }

    const currentValue = ibovData.data.currentValue

    // Analisar sequências consecutivas
    const sequenceAnalysis = ibovData.data.historicalData && ibovData.data.historicalData.length > 0
      ? analyzeConsecutiveSequences(ibovData.data.historicalData, period)
      : null

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada')
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!
    })

    // Buscar indicadores econômicos com análise técnica (para todos os períodos)
    const economicIndicators = await getEconomicIndicatorsWithTechnicalAnalysis(period)
    const expectations = await getIndicatorExpectations()

    // Construir seção de indicadores econômicos
    let economicIndicatorsSection = ''
    if (economicIndicators.indicators.size > 0) {
      const indicatorsList: string[] = []
      
      economicIndicators.indicators.forEach((indicator, name) => {
        const ta = indicator.technicalAnalysis
        const exp = expectations.get(name)
        
        let indicatorText = `\n**${name}**:`
        indicatorText += `\n- Valor Atual: ${indicator.currentValue.toFixed(2)}`
        if (indicator.changePercent !== null) {
          indicatorText += ` (${indicator.changePercent >= 0 ? '+' : ''}${indicator.changePercent.toFixed(2)}%)`
        }
        
        if (ta) {
          indicatorText += `\n- Análise Técnica:`
          if (ta.rsi !== null) indicatorText += `\n  * RSI: ${ta.rsi.toFixed(2)}`
          if (ta.macd !== null) indicatorText += `\n  * MACD: ${ta.macd.toFixed(4)}`
          if (ta.macdSignal !== null) indicatorText += ` (Sinal: ${ta.macdSignal.toFixed(4)})`
          if (ta.sma20 !== null) indicatorText += `\n  * SMA 20: ${ta.sma20.toFixed(2)}`
          if (ta.sma50 !== null) indicatorText += `\n  * SMA 50: ${ta.sma50.toFixed(2)}`
          if (ta.sma200 !== null) indicatorText += `\n  * SMA 200: ${ta.sma200.toFixed(2)}`
          if (ta.trend) indicatorText += `\n  * Tendência: ${ta.trend}`
          if (ta.signal) indicatorText += `\n  * Sinal: ${ta.signal}`
        }
        
        if (exp) {
          indicatorText += `\n- Expectativas:`
          if (exp.forecast !== null) {
            const forecastValue = typeof exp.forecast === 'number' 
              ? exp.forecast.toFixed(2) 
              : String(exp.forecast)
            indicatorText += `\n  * Forecast: ${forecastValue}`
          }
          if (exp.consensus) indicatorText += `\n  * Consenso: ${exp.consensus}`
          if (exp.nextEvent) indicatorText += `\n  * Próximo Evento: ${exp.nextEvent}`
        }
        
        indicatorsList.push(indicatorText)
      })
      
      // Separar indicadores principais e complementares
      const mainIndicators = ['VIX', 'DI_FUTURO', 'PETROLEO_WTI', 'PETROLEO_BRENT', 'MINERIO_FERRO', 'DOLAR', 'SP500']
      const complementaryIndicators = ['CDI', 'SELIC', 'IPCA', 'CRB_INDEX', 'COBRE', 'SOJA', 'BOND_YIELD_BR_10Y', 'CONFIANCA_CONSUMIDOR']
      
      const mainList: string[] = []
      const complementaryList: string[] = []
      
      indicatorsList.forEach(indicatorText => {
        const isMain = mainIndicators.some(name => indicatorText.includes(`**${name}**`))
        if (isMain) {
          mainList.push(indicatorText)
        } else {
          complementaryList.push(indicatorText)
        }
      })
      
      economicIndicatorsSection = `
**INDICADORES ECONÔMICOS PRINCIPAIS COM ANÁLISE TÉCNICA**:
${mainList.join('\n')}

${complementaryList.length > 0 ? `
**INDICADORES COMPLEMENTARES** (considere quando relevantes):
${complementaryList.join('\n')}
` : ''}

${economicIndicators.crossAnalysis ? `
**CRUZAMENTO DE INDICADORES**:
${economicIndicators.crossAnalysis.summary}
${economicIndicators.crossAnalysis.divergences.length > 0 ? `
Divergências Detectadas:
${economicIndicators.crossAnalysis.divergences.map(d => `- ${d.description}`).join('\n')}
` : ''}
Nível de Risco: ${economicIndicators.crossAnalysis.riskLevel}
` : ''}

IMPORTANTE: 
- **Indicadores Principais**: Analise TODOS considerando valor atual, variação percentual, análise técnica, expectativas e impacto no IBOVESPA
- **Indicadores Complementares**: Considere quando relevantes para o contexto (ex: CDI/Selic para contexto de juros, IPCA para inflação, commodities para setores específicos)
- **VIX**: Especialmente importante - mede volatilidade/medo do mercado. VIX alto geralmente indica maior risco e pode impactar negativamente o IBOV
- **Consenso/Divergência**: Avalie se indicadores convergem ou divergem na mesma direção
`
    }

    // Para projeções mensal e anual, buscar contexto adicional
    let technicalAnalysisSection = ''
    let electionSection = ''
    let macroEventsSection = ''

    if (period === 'MONTHLY' || period === 'ANNUAL') {
      // Buscar análise técnica do IBOV
      const techAnalysis = await getTechnicalAnalysisForIbov()
      if (techAnalysis.success && techAnalysis.data) {
        const ta = techAnalysis.data
        technicalAnalysisSection = `
**ANÁLISE TÉCNICA DO IBOVESPA**:
- RSI: ${ta.rsi?.toFixed(2) || 'N/A'}
- MACD: ${ta.macd?.toFixed(2) || 'N/A'} (Sinal: ${ta.macdSignal?.toFixed(2) || 'N/A'})
- Sinais Técnicos: ${ta.overallSignal || 'NEUTRO'}
- Média Móvel 20 dias: ${ta.sma20?.toFixed(2) || 'N/A'}
- Média Móvel 50 dias: ${ta.sma50?.toFixed(2) || 'N/A'}
- Média Móvel 200 dias: ${ta.sma200?.toFixed(2) || 'N/A'}
- Suportes: ${ta.supportLevels?.join(', ') || 'N/A'}
- Resistências: ${ta.resistanceLevels?.join(', ') || 'N/A'}
- Preço Justo (IA): ${ta.aiFairEntryPrice?.toFixed(2) || 'N/A'}
- Análise IA: ${ta.aiAnalysis || 'N/A'}
- Confiança Técnica: ${ta.aiConfidence || 'N/A'}%

IMPORTANTE: Considere a análise técnica do próprio IBOV na sua projeção. Se os indicadores técnicos indicam sobrecompra ou sobrevenda, isso deve influenciar sua projeção.
`
      }

      // Buscar período eleitoral
      const electionPeriod = getElectionPeriod()
      if (electionPeriod.isElectionPeriod || electionPeriod.electionType !== 'NONE') {
        electionSection = `
**CONTEXTO POLÍTICO E ELEITORAL**:
- Período Eleitoral: ${electionPeriod.isElectionPeriod ? 'SIM' : 'NÃO'}
- Tipo de Eleição: ${electionPeriod.electionType === 'PRESIDENTIAL' ? 'PRESIDENCIAL' : electionPeriod.electionType === 'MUNICIPAL' ? 'MUNICIPAL' : 'NENHUMA'}
- Ano Eleitoral: ${electionPeriod.electionYear || 'N/A'}
- Descrição: ${electionPeriod.description}

IMPORTANTE: Períodos eleitorais historicamente causam volatilidade no mercado brasileiro. Considere o impacto histórico de eleições presidenciais e municipais nas projeções de médio e longo prazo.
`
      }

      // Buscar eventos macroeconômicos
      const macroEvents = await getMacroEconomicEvents(period)
      if (macroEvents.events.length > 0 || macroEvents.summary) {
        const eventsList = macroEvents.events.map(e => 
          `- ${e.date}: ${e.event} (Importância: ${e.importance === 'HIGH' ? 'ALTA' : e.importance === 'LOW' ? 'BAIXA' : 'MÉDIA'})`
        ).join('\n')
        
        macroEventsSection = `
**EVENTOS MACROECONÔMICOS AGENDADOS**:
${eventsList || 'Nenhum evento específico encontrado'}

Resumo do Contexto Macroeconômico:
${macroEvents.summary}

IMPORTANTE: Considere o impacto desses eventos na sua projeção. Decisões do COPOM, dados de inflação e PIB têm impacto significativo no mercado de ações brasileiro.
`
      }
    }

    // ============================================
    // SISTEMA DE 3 ETAPAS PARA GARANTIR QUALIDADE
    // ============================================
    
    // ETAPA 1: CONSULTA DE DADOS
    const step1Prompt = `Você é um analista macroeconômico especializado no mercado brasileiro. Sua tarefa é CONSULTAR e COLETAR dados atualizados sobre os indicadores macroeconômicos que impactam o IBOVESPA.

**ETAPA 1: CONSULTA DE DADOS**

**VALOR ATUAL DO IBOVESPA**: ${currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

**PERÍODO DA PROJEÇÃO**: ${period === 'DAILY' ? 'diário' : period === 'WEEKLY' ? 'semanal' : period === 'ANNUAL' ? 'anual' : 'mensal'}

**TAREFA**: Use a ferramenta de busca do Google para coletar dados ATUAIS e RELEVANTES sobre os seguintes indicadores:

**INDICADORES PRINCIPAIS**:
1. **VIX** (índice de volatilidade) - CRÍTICO: Mede medo/volatilidade do mercado. Busque valor atual e tendências
2. **DI Futuro** (taxa de juros futura) - Busque a cotação atual e tendências
3. **Petróleo** (WTI/Brent) - Busque preços atuais e tendências
4. **Minério de Ferro** - Busque preços atuais e tendências
5. **Dólar** (USD/BRL) - Busque cotação atual e tendências
6. **S&P500** - Busque valor atual e tendências

**INDICADORES COMPLEMENTARES** (considere também):
7. **CDI** (taxa de juros brasileira de referência) - Complementa DI Futuro
8. **Selic** (taxa básica de juros do Brasil) - Definida pelo COPOM
9. **IPCA** (índice de inflação brasileiro) - Impacta decisões do COPOM
10. **CRB Index** (índice agregado de commodities) - Visão macro de commodities
11. **Cobre** - Indicador de crescimento econômico global
12. **Soja** - Impacto no agronegócio brasileiro
13. **Bond Yield Brasil 10Y** - Mede risco país e expectativas
14. **Índice de Confiança do Consumidor** - Sentimento econômico doméstico

${economicIndicatorsSection}

${sequenceAnalysis ? `
**ANÁLISE DE SEQUÊNCIAS CONSECUTIVAS** (PESO: 30% DA ANÁLISE):
${sequenceAnalysis.analysis}

**TIPO DE SEQUÊNCIA**: ${sequenceAnalysis.sequenceType === 'HIGH' ? 'SEQUÊNCIA FORTE DE ALTA' : sequenceAnalysis.sequenceType === 'LOW' ? 'SEQUÊNCIA FORTE DE QUEDA' : sequenceAnalysis.sequenceType === 'BROKEN' ? 'SEQUÊNCIA QUEBRADA' : 'SEM SEQUÊNCIA FORTE'}
**DIAS CONSECUTIVOS**: ${sequenceAnalysis.consecutiveDays}
**VARIAÇÃO ACUMULADA**: ${sequenceAnalysis.accumulatedChange >= 0 ? '+' : ''}${sequenceAnalysis.accumulatedChange.toFixed(2)}%
**PROBABILIDADE DE CORREÇÃO**: ${(sequenceAnalysis.correctionProbability * 100).toFixed(0)}%

**REGRAS CRÍTICAS PARA ANÁLISE DE SEQUÊNCIAS** (PESO: 30% DA ANÁLISE TOTAL):

⚠️ **ANÁLISE COMBINADA**: Você deve interpretar e combinar tanto a análise de sequências quanto os indicadores macroeconômicos para determinar a projeção final. Não há precedência absoluta - ambos os fatores devem ser considerados em conjunto.

1. **SEQUÊNCIA FORTE DE ALTA** (${sequenceAnalysis.sequenceType === 'HIGH' ? 'DETECTADA' : 'NÃO DETECTADA'}):
   - Se detectada: O mercado vem de ${sequenceAnalysis.consecutiveDays} dias consecutivos de alta com variação acumulada de ${sequenceAnalysis.accumulatedChange.toFixed(2)}%
   - **SINAL DE CORREÇÃO**: Alta probabilidade de correção (${(sequenceAnalysis.correctionProbability * 100).toFixed(0)}%)
   - O mercado está sobrecomprado após ${sequenceAnalysis.consecutiveDays} dias consecutivos de alta - uma correção é altamente provável
   - **INTERPRETAÇÃO**: Considere este sinal de correção (tendência para QUEDA) em conjunto com os indicadores macro
   - Se os indicadores macro também apontam para queda → projeção de queda mais forte
   - Se os indicadores macro apontam para alta → avalie se a correção da sequência é mais forte que o impulso dos indicadores macro

2. **SEQUÊNCIA FORTE DE QUEDA** (${sequenceAnalysis.sequenceType === 'LOW' ? 'DETECTADA' : 'NÃO DETECTADA'}):
   - Se detectada: O mercado vem de ${sequenceAnalysis.consecutiveDays} dias consecutivos de queda com variação acumulada de ${sequenceAnalysis.accumulatedChange.toFixed(2)}%
   - **SINAL DE CORREÇÃO**: Probabilidade moderada de correção para alta (${(sequenceAnalysis.correctionProbability * 100).toFixed(0)}%)
   - O mercado está sobrevendido após ${sequenceAnalysis.consecutiveDays} dias consecutivos de queda - uma correção para alta é provável
   - **INTERPRETAÇÃO**: Considere este sinal de correção (tendência para ALTA) em conjunto com os indicadores macro
   - Se os indicadores macro também apontam para alta → projeção de alta mais forte
   - Se os indicadores macro apontam para queda → avalie se a correção da sequência é mais forte que o impulso dos indicadores macro

3. **SEQUÊNCIA QUEBRADA** (${sequenceAnalysis.sequenceType === 'BROKEN' ? 'DETECTADA' : 'NÃO DETECTADA'}):
   - Se detectada: O mercado interrompeu a sequência anterior
   - **AÇÃO**: ZERAR o peso deste critério (0%). Focar APENAS nos indicadores macroeconômicos (100% do peso)
   - Não considerar análise de sequências na projeção final

4. **SEM SEQUÊNCIA FORTE** (${sequenceAnalysis.sequenceType === 'NONE' ? 'DETECTADO' : 'NÃO DETECTADO'}):
   - Se não há sequência forte detectada
   - **AÇÃO**: ZERAR o peso deste critério (0%). Focar APENAS nos indicadores macroeconômicos (100% do peso)
   - Não considerar análise de sequências na projeção final

**IMPORTANTE - ANÁLISE COMBINADA**: 
- ⚠️ **CRÍTICO**: Quando há sequência forte detectada, você deve INTERPRETAR e COMBINAR ambos os fatores (sequências + indicadores macro) para determinar a projeção final
- Não há precedência absoluta - avalie qual fator é mais forte no contexto atual
- Se a sequência indica correção e os indicadores macro concordam → projeção mais forte nessa direção
- Se a sequência indica correção mas os indicadores macro apontam na direção oposta → avalie qual sinal é mais forte e faça uma projeção balanceada considerando ambos
- A análise de sequências representa 30% do peso e os indicadores macro 70%, mas você deve fazer uma interpretação inteligente combinando ambos
- Quando sequência é quebrada ou não há sequência forte, ignore completamente este critério e use apenas indicadores macro (100% do peso)
- Inclua no reasoning como você combinou e interpretou ambos os fatores para chegar à projeção final
` : ''}

${technicalAnalysisSection}
${electionSection}
${macroEventsSection}

**FORMATO DE RESPOSTA (JSON válido)**:
{
  "dataCollection": {
    "diFuturo": {
      "currentValue": "valor atual ou descrição",
      "trend": "ALTA/BAIXA/ESTAVEL",
      "source": "fonte da informação",
      "notes": "observações relevantes"
    },
    "petroleo": {
      "currentValue": "valor atual ou descrição",
      "trend": "ALTA/BAIXA/ESTAVEL",
      "source": "fonte da informação",
      "notes": "observações relevantes"
    },
    "minerioFerro": {
      "currentValue": "valor atual ou descrição",
      "trend": "ALTA/BAIXA/ESTAVEL",
      "source": "fonte da informação",
      "notes": "observações relevantes"
    },
    "dolar": {
      "currentValue": "valor atual ou descrição",
      "trend": "ALTA/BAIXA/ESTAVEL",
      "source": "fonte da informação",
      "notes": "observações relevantes"
    },
    "sp500": {
      "currentValue": "valor atual ou descrição",
      "trend": "ALTA/BAIXA/ESTAVEL",
      "source": "fonte da informação",
      "notes": "observações relevantes"
    }
  },
  "summary": "Resumo breve dos dados coletados e principais tendências identificadas"
}

**IMPORTANTE**: 
- Use a ferramenta de busca para obter dados ATUAIS
- Seja preciso e objetivo
- Anote a fonte de cada informação
- Identifique tendências claras (alta, baixa ou estável)

Retorne APENAS o JSON, sem markdown ou texto adicional.`

    // ETAPA 2: ANÁLISE DE DADOS
    const createStep2Prompt = (step1Data: any) => `Você é um analista macroeconômico especializado no mercado brasileiro. Sua tarefa é ANALISAR os dados coletados e determinar o impacto de cada indicador no IBOVESPA.

**ETAPA 2: ANÁLISE DE DADOS**

**VALOR ATUAL DO IBOVESPA**: ${currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

**PERÍODO DA PROJEÇÃO**: ${period === 'DAILY' ? 'diário' : period === 'WEEKLY' ? 'semanal' : period === 'ANNUAL' ? 'anual' : 'mensal'}

**DADOS COLETADOS NA ETAPA 1**:
${JSON.stringify(step1Data, null, 2)}

${sequenceAnalysis ? `
**ANÁLISE DE SEQUÊNCIAS CONSECUTIVAS** (PESO: 30% DA ANÁLISE):
${sequenceAnalysis.analysis}

**TIPO DE SEQUÊNCIA**: ${sequenceAnalysis.sequenceType === 'HIGH' ? 'SEQUÊNCIA FORTE DE ALTA' : sequenceAnalysis.sequenceType === 'LOW' ? 'SEQUÊNCIA FORTE DE QUEDA' : sequenceAnalysis.sequenceType === 'BROKEN' ? 'SEQUÊNCIA QUEBRADA' : 'SEM SEQUÊNCIA FORTE'}
**DIAS CONSECUTIVOS**: ${sequenceAnalysis.consecutiveDays}
**VARIAÇÃO ACUMULADA**: ${sequenceAnalysis.accumulatedChange >= 0 ? '+' : ''}${sequenceAnalysis.accumulatedChange.toFixed(2)}%
**PROBABILIDADE DE CORREÇÃO**: ${(sequenceAnalysis.correctionProbability * 100).toFixed(0)}%

**REGRAS PARA ANÁLISE DE SEQUÊNCIAS** (30% DO PESO - ANÁLISE COMBINADA):
⚠️ **CRÍTICO**: Você deve INTERPRETAR e COMBINAR a análise de sequências com os indicadores macro. Não há precedência absoluta - avalie ambos os fatores em conjunto.
- Sequência forte de alta: Considere sinal de correção (tendência para QUEDA) e combine com indicadores macro para determinar a projeção final
- Sequência forte de queda: Considere sinal de correção (tendência para ALTA) e combine com indicadores macro para determinar a projeção final
- Sequência quebrada ou sem sequência forte: Ignore este critério (peso zerado), use apenas indicadores macro
` : ''}

**TAREFA**: Analise cada indicador e determine:
1. Qual o impacto esperado no IBOVESPA (ALTA, BAIXA ou NEUTRO)
2. Qual o peso/importância relativa de cada indicador (soma deve ser 1.0)
3. Por que cada indicador impacta o IBOV da forma identificada

**LIMITES DE VARIAÇÃO POR PERÍODO**:
- Diário: máximo 3% de variação
- Semanal: máximo 6% de variação
- Mensal: máximo 10% de variação
- Anual: máximo 20% de variação

**FORMATO DE RESPOSTA (JSON válido)**:
{
  "analysis": {
    "diFuturo": {
      "impact": "ALTA" ou "BAIXA" ou "NEUTRO",
      "weight": 0.35,
      "reason": "Explicação detalhada do impacto deste indicador no IBOV",
      "expectedDirection": "ALTA" ou "BAIXA" ou "NEUTRO"
    },
    "petroleo": {
      "impact": "ALTA" ou "BAIXA" ou "NEUTRO",
      "weight": 0.25,
      "reason": "Explicação detalhada do impacto deste indicador no IBOV",
      "expectedDirection": "ALTA" ou "BAIXA" ou "NEUTRO"
    },
    "minerioFerro": {
      "impact": "ALTA" ou "BAIXA" ou "NEUTRO",
      "weight": 0.15,
      "reason": "Explicação detalhada do impacto deste indicador no IBOV",
      "expectedDirection": "ALTA" ou "BAIXA" ou "NEUTRO"
    },
    "dolar": {
      "impact": "ALTA" ou "BAIXA" ou "NEUTRO",
      "weight": 0.15,
      "reason": "Explicação detalhada do impacto deste indicador no IBOV",
      "expectedDirection": "ALTA" ou "BAIXA" ou "NEUTRO"
    },
    "sp500": {
      "impact": "ALTA" ou "BAIXA" ou "NEUTRO",
      "weight": 0.10,
      "reason": "Explicação detalhada do impacto deste indicador no IBOV",
      "expectedDirection": "ALTA" ou "BAIXA" ou "NEUTRO"
    }
  },
  "consensus": {
    "altaCount": 0,
    "baixaCount": 0,
    "neutroCount": 0,
    "overallDirection": "ALTA" ou "BAIXA" ou "ESTABILIDADE",
    "confidenceLevel": "ALTA" ou "MÉDIA" ou "BAIXA"
  },
  "summary": "Resumo da análise: quantos indicadores apontam para alta, baixa ou neutro, e qual a direção geral esperada"
}

**REGRAS CRÍTICAS**:
- A soma de todos os pesos DEVE ser igual a 1.0 (100%)
- Seja objetivo e baseado nos dados coletados
- Identifique claramente o consenso entre os indicadores
- Considere o período da projeção (diário/semanal/mensal/anual) ao avaliar o impacto

Retorne APENAS o JSON, sem markdown ou texto adicional.`

    // ETAPA 3: REVISÃO E PROJEÇÃO FINAL
    const createStep3Prompt = (step1Data: any, step2Data: any) => `Você é um analista macroeconômico especializado no mercado brasileiro. Sua tarefa é REVISAR a análise e criar a PROJEÇÃO FINAL do IBOVESPA.

**ETAPA 3: REVISÃO E PROJEÇÃO FINAL**

**VALOR ATUAL DO IBOVESPA**: ${currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

**PERÍODO DA PROJEÇÃO**: ${period === 'DAILY' ? 'diário' : period === 'WEEKLY' ? 'semanal' : period === 'ANNUAL' ? 'anual' : 'mensal'}

**DADOS COLETADOS (ETAPA 1)**:
${JSON.stringify(step1Data, null, 2)}

**ANÁLISE REALIZADA (ETAPA 2)**:
${JSON.stringify(step2Data, null, 2)}

${sequenceAnalysis ? `
**ANÁLISE DE SEQUÊNCIAS CONSECUTIVAS** (PESO: 30% DA ANÁLISE):
${sequenceAnalysis.analysis}

**TIPO DE SEQUÊNCIA**: ${sequenceAnalysis.sequenceType === 'HIGH' ? 'SEQUÊNCIA FORTE DE ALTA' : sequenceAnalysis.sequenceType === 'LOW' ? 'SEQUÊNCIA FORTE DE QUEDA' : sequenceAnalysis.sequenceType === 'BROKEN' ? 'SEQUÊNCIA QUEBRADA' : 'SEM SEQUÊNCIA FORTE'}
**DIAS CONSECUTIVOS**: ${sequenceAnalysis.consecutiveDays}
**VARIAÇÃO ACUMULADA**: ${sequenceAnalysis.accumulatedChange >= 0 ? '+' : ''}${sequenceAnalysis.accumulatedChange.toFixed(2)}%
**PROBABILIDADE DE CORREÇÃO**: ${(sequenceAnalysis.correctionProbability * 100).toFixed(0)}%

**REGRAS CRÍTICAS PARA ANÁLISE DE SEQUÊNCIAS** (30% DO PESO TOTAL - ANÁLISE COMBINADA):
⚠️ **CRÍTICO**: Você deve INTERPRETAR e COMBINAR a análise de sequências com os indicadores macro. Não há precedência absoluta - avalie ambos os fatores em conjunto para determinar a projeção final.
- Sequência forte de alta: Alta probabilidade de correção - Considere sinal de QUEDA e combine com indicadores macro (se concordam → queda mais forte, se divergem → avalie qual sinal é mais forte)
- Sequência forte de queda: Probabilidade moderada de correção para alta - Considere sinal de ALTA e combine com indicadores macro (se concordam → alta mais forte, se divergem → avalie qual sinal é mais forte)
- Sequência quebrada ou sem sequência forte: ZERAR peso deste critério - usar apenas indicadores macro (100% do peso)
- Faça uma interpretação inteligente combinando ambos os fatores (sequências 30% + indicadores macro 70%) para chegar à projeção final
` : ''}

**TAREFA**: 
1. REVISAR se a análise faz sentido considerando os dados coletados
2. CALCULAR o valor projetado baseado no consenso dos indicadores
3. GARANTIR que a projeção está dentro dos limites realistas
4. CRIAR um reasoning didático explicando a projeção

**LIMITES DE VARIAÇÃO POR PERÍODO** (NÃO EXCEDA):
- Diário: máximo 3% de variação (use 0.5-2.5% normalmente, até 2.7% quando há consenso forte)
- Semanal: máximo 6% de variação (use 1-5% normalmente, até 5.4% quando há consenso forte)
- Mensal: máximo 10% de variação (use 2-8% normalmente, até 9% quando há consenso forte)
- Anual: máximo 20% de variação (use 5-15% normalmente, até 18% quando há consenso forte)

**LÓGICA DE CONSENSO**:
- Se 4-5 indicadores apontam ALTA e 0-1 apontam BAIXA → Use 70-90% do limite máximo na direção de alta
- Se 4-5 indicadores apontam BAIXA e 0-1 apontam ALTA → Use 70-90% do limite máximo na direção de queda
- Se há equilíbrio (2-3 ALTA, 2-3 BAIXA) → Use 30-50% do limite máximo, tendendo para estabilidade
- Se maioria aponta NEUTRO → Use 20-40% do limite máximo

**FORMATO DE RESPOSTA (JSON válido)**:
{
  "projectedValue": 125000.50,
  "confidence": 75,
  "reasoning": "[ANÁLISE DIDÁTICA DETALHADA - siga EXATAMENTE esta estrutura OBRIGATÓRIA]:\n\n**PROJEÇÃO: [ALTA/QUEDA/ESTABILIDADE]**\n\n**MOTIVOS PRINCIPAIS DA PROJEÇÃO:**\n\n1. **[Nome do Indicador Principal] (Peso: X%)**: [Explicação direta e clara do motivo que levou à projeção de alta/queda. Exemplo: 'O DI Futuro está em [valor]%, indicando [tendência de alta/queda de juros]. Isso [impacto direto no IBOV - explique o motivo específico].'\n\n2. **[Segundo Indicador] (Peso: Y%)**: [Explicação direta do motivo e impacto]\n\n3. **[Terceiro Indicador] (Peso: Z%)**: [Explicação direta do motivo e impacto]\n\n[Continue para TODOS os indicadores avaliados]\n\n**RESUMO**: [Síntese clara explicando por que a projeção é de alta/queda, conectando todos os indicadores de forma didática]\n\n⚠️ CRÍTICO: O reasoning DEVE começar com **PROJEÇÃO: [ALTA/QUEDA/ESTABILIDADE]** seguido imediatamente por **MOTIVOS PRINCIPAIS DA PROJEÇÃO:**. Esta estrutura é OBRIGATÓRIA.",
      "keyIndicators": {
        "primary": "VIX" ou "DI Futuro",
        "all": {
          "VIX": {
            "weight": 0.20,
            "impact": "ALTA" ou "BAIXA" ou "NEUTRO",
            "reason": "Breve explicação do impacto deste indicador (volatilidade/medo do mercado)"
          },
          "DI Futuro": {
            "weight": 0.25,
            "impact": "ALTA" ou "BAIXA" ou "NEUTRO",
            "reason": "Breve explicação do impacto deste indicador"
          },
          "Petróleo": {
            "weight": 0.20,
            "impact": "ALTA" ou "BAIXA" ou "NEUTRO",
            "reason": "Breve explicação do impacto deste indicador"
          },
          "Minério de Ferro": {
            "weight": 0.15,
            "impact": "ALTA" ou "BAIXA" ou "NEUTRO",
            "reason": "Breve explicação do impacto deste indicador"
          },
          "Dólar": {
            "weight": 0.12,
            "impact": "ALTA" ou "BAIXA" ou "NEUTRO",
            "reason": "Breve explicação do impacto deste indicador"
          },
          "S&P500": {
            "weight": 0.08,
            "impact": "ALTA" ou "BAIXA" ou "NEUTRO",
            "reason": "Breve explicação do impacto deste indicador"
          }
        },
        "weights": {
          "VIX": 0.20,
          "DI Futuro": 0.25,
          "Petróleo": 0.20,
          "Minério de Ferro": 0.15,
          "Dólar": 0.12,
          "S&P500": 0.08
        }
      },
  "review": {
    "makesSense": true,
    "validationNotes": "Notas sobre a validação da projeção",
    "calculatedVariation": 0.05,
    "withinLimits": true
  }
}

**REGRAS CRÍTICAS**:

1. **ANTES DE CALCULAR O VALOR PROJETADO, CALCULE A DIRECÃO CORRETA**:
   - Se a maioria dos indicadores aponta ALTA → projectedValue > currentValue
   - Se a maioria dos indicadores aponta BAIXA → projectedValue < currentValue
   - Se há equilíbrio ou maioria NEUTRO → projectedValue ≈ currentValue

2. **O campo "PROJEÇÃO: [ALTA/QUEDA/ESTABILIDADE]" DEVE refletir EXATAMENTE a relação entre projectedValue e currentValue**

3. **CONFIDENCE**: 
   - Com consenso forte (4-5 indicadores na mesma direção): 65-85
   - Com divergência moderada: 50-70
   - Com alta divergência: 40-60

4. **REASONING - ESTRUTURA OBRIGATÓRIA**: 
   - **ESTRUTURA OBRIGATÓRIA** (DEVE ser seguida EXATAMENTE):
     O reasoning DEVE começar com: **PROJEÇÃO: [ALTA/QUEDA/ESTABILIDADE]**
     Seguido imediatamente por: **MOTIVOS PRINCIPAIS DA PROJEÇÃO:**
     Depois listar cada indicador numerado: 1. [Indicador] (Peso: X%): [Explicação]
     E terminar com: **RESUMO**: [Síntese]
   - O reasoning DEVE começar EXATAMENTE com "**PROJEÇÃO: [ALTA/QUEDA/ESTABILIDADE]**" seguido imediatamente por "**MOTIVOS PRINCIPAIS DA PROJEÇÃO:**"
   - Deve ter pelo menos 300 caracteres
   - Deve explicar TODOS os indicadores de forma didática
   - ${sequenceAnalysis && sequenceAnalysis.shouldConsiderCorrection ? `DEVE incluir análise de sequências no reasoning explicando como você INTERPRETOU e COMBINOU a análise de sequências (sequência forte de ${sequenceAnalysis.sequenceType === 'HIGH' ? 'alta' : 'queda'} com probabilidade de correção de ${(sequenceAnalysis.correctionProbability * 100).toFixed(0)}%) com os indicadores macroeconômicos para chegar à projeção final. Explique qual fator foi mais forte e como você balanceou ambos na sua decisão. Não há precedência absoluta - explique como você combinou ambos os sinais.` : sequenceAnalysis && (sequenceAnalysis.sequenceType === 'BROKEN' || sequenceAnalysis.sequenceType === 'NONE') ? 'Se análise de sequências não foi considerada, mencionar brevemente que o peso foi zerado e a análise focou apenas nos indicadores macroeconômicos.' : 'Se análise de sequências estiver disponível, inclua conforme as regras acima.'}
   - Use markdown para formatação (negrito, listas, etc.)

5. **VALIDAÇÃO**: 
   - Verifique se a variação calculada está dentro dos limites
   - Verifique se faz sentido considerando o consenso dos indicadores
   - Se não fizer sentido, ajuste o valor projetado

Retorne APENAS o JSON, sem markdown ou texto adicional.`

    // Função helper para chamar Gemini com retry (usada nas 3 etapas)
    const callGeminiWithRetry = async (prompt: string, stepName: string, maxRetries = 3) => {
      let lastError: Error | null = null
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`[${period}] [${stepName}] Tentativa ${attempt + 1}/${maxRetries} de chamada ao Gemini...`)
          
          const promptLength = prompt.length
          // Para projeções anuais com prompts muito longos, usar generateContent ao invés de stream
          // para evitar problemas com respostas vazias
          const useStream = period !== 'ANNUAL' || promptLength < 30000
          
          let fullResponse = ''
          let chunkCount = 0
          let hasTextChunks = false
          
          if (useStream) {
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
                  parts: [{ text: prompt }]
                }
              ]
            })
            
            // Timeout de 45 segundos para evitar travamento
            const timeoutPromise = new Promise<string>((_, reject) => {
              setTimeout(() => reject(new Error('Timeout ao receber resposta do Gemini')), 45000)
            })
            
            const streamPromise = (async () => {
              for await (const chunk of response) {
                chunkCount++
                if (chunk.text) {
                  fullResponse += chunk.text
                  hasTextChunks = true
                } else {
                  // Log chunks não-texto para debug
                  console.log(`[${period}] [${stepName}] Chunk ${chunkCount} sem texto:`, Object.keys(chunk))
                }
              }
              return fullResponse
            })()
            
            fullResponse = await Promise.race([streamPromise, timeoutPromise])
          } else {
            // Para projeções anuais, usar generateContent (não-stream) para maior confiabilidade
            console.log(`[${period}] [${stepName}] Usando generateContent (não-stream) devido ao tamanho do prompt`)
            const response = await ai.models.generateContent({
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
                  parts: [{ text: prompt }]
                }
              ]
            })
            
            // @ts-expect-error - response.text pode não estar tipado
            fullResponse = response.text || ''
            chunkCount = 1
            hasTextChunks = !!fullResponse
          }

          console.log(`[${period}] [${stepName}] Resposta recebida: ${chunkCount} chunks, ${fullResponse.length} caracteres, tem texto: ${hasTextChunks}`)

          // Se não recebeu nenhum chunk com texto, considerar erro retryable
          if (!hasTextChunks && chunkCount === 0) {
            throw new Error('Resposta vazia do Gemini (nenhum chunk recebido)')
          }

          // Se recebeu chunks mas sem texto, também considerar erro retryable
          if (!hasTextChunks && chunkCount > 0) {
            console.warn(`[${period}] [${stepName}] Recebeu ${chunkCount} chunks mas nenhum com texto. Tentando novamente...`)
            throw new Error('Resposta vazia do Gemini (chunks sem texto)')
          }

          if (!fullResponse.trim()) {
            throw new Error('Resposta vazia do Gemini (texto vazio após processamento)')
          }

          return fullResponse
        } catch (error: any) {
          lastError = error
          
          const isRetryableError = 
            error?.status === 503 || 
            error?.status === 429 ||
            error?.message?.includes('overloaded') ||
            error?.message?.includes('UNAVAILABLE') ||
            error?.message?.includes('Resposta vazia')
          
          console.error(`[${period}] [${stepName}] Erro na tentativa ${attempt + 1}/${maxRetries}:`, error?.message || error)
          
          if (!isRetryableError || attempt === maxRetries - 1) {
            throw error
          }

          const delay = Math.pow(2, attempt) * 1000
          console.log(`[${period}] [${stepName}] Tentativa ${attempt + 1}/${maxRetries} falhou. Tentando novamente em ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      throw lastError || new Error('Falha após múltiplas tentativas')
    }

    // ============================================
    // EXECUTAR AS 3 ETAPAS SEQUENCIALMENTE
    // ============================================
    
    let step1Data: any
    let step2Data: any
    let projectionData: any
    
    try {
      // ETAPA 1: CONSULTA DE DADOS
      console.log(`[${period}] 🟢 Iniciando ETAPA 1: Consulta de Dados...`)
      let step1Response: string
      try {
        step1Response = await callGeminiWithRetry(step1Prompt, 'ETAPA 1')
      } catch (error: any) {
        console.error(`[${period}] Erro na ETAPA 1:`, error?.message || error)
        throw new Error(`Erro na ETAPA 1 (Consulta de Dados): ${error?.message || 'Erro desconhecido'}`)
      }
      
      if (!step1Response || !step1Response.trim()) {
        throw new Error('Resposta vazia na ETAPA 1')
      }
      
      const step1JsonMatch = step1Response.match(/\{[\s\S]*\}/)
      if (!step1JsonMatch) {
        throw new Error('Não foi possível extrair JSON da ETAPA 1')
      }
      
      step1Data = JSON.parse(step1JsonMatch[0])
      console.log(`[${period}] ✅ ETAPA 1 concluída: Dados coletados`)
      
      // ETAPA 2: ANÁLISE DE DADOS
      console.log(`[${period}] 🟡 Iniciando ETAPA 2: Análise de Dados...`)
      const step2Prompt = createStep2Prompt(step1Data)
      let step2Response: string
      try {
        step2Response = await callGeminiWithRetry(step2Prompt, 'ETAPA 2')
      } catch (error: any) {
        console.error(`[${period}] Erro na ETAPA 2:`, error?.message || error)
        throw new Error(`Erro na ETAPA 2 (Análise de Dados): ${error?.message || 'Erro desconhecido'}`)
      }
      
      if (!step2Response || !step2Response.trim()) {
        throw new Error('Resposta vazia na ETAPA 2')
      }
      
      const step2JsonMatch = step2Response.match(/\{[\s\S]*\}/)
      if (!step2JsonMatch) {
        throw new Error('Não foi possível extrair JSON da ETAPA 2')
      }
      
      step2Data = JSON.parse(step2JsonMatch[0])
      console.log(`[${period}] ✅ ETAPA 2 concluída: Análise realizada`)
      
      // ETAPA 3: REVISÃO E PROJEÇÃO FINAL
      console.log(`[${period}] 🔴 Iniciando ETAPA 3: Revisão e Projeção Final...`)
      const step3Prompt = createStep3Prompt(step1Data, step2Data)
      let step3Response: string
      try {
        step3Response = await callGeminiWithRetry(step3Prompt, 'ETAPA 3')
      } catch (error: any) {
        console.error(`[${period}] Erro na ETAPA 3:`, error?.message || error)
        throw new Error(`Erro na ETAPA 3 (Revisão e Projeção): ${error?.message || 'Erro desconhecido'}`)
      }
      
      if (!step3Response || !step3Response.trim()) {
        throw new Error('Resposta vazia na ETAPA 3')
      }
      
      const step3JsonMatch = step3Response.match(/\{[\s\S]*\}/)
      if (!step3JsonMatch) {
        throw new Error('Não foi possível extrair JSON da ETAPA 3')
      }
      
      projectionData = JSON.parse(step3JsonMatch[0])
      projectionData.currentValue = currentValue
      console.log(`[${period}] ✅ ETAPA 3 concluída: Projeção final gerada`)
      
    } catch (error: any) {
      console.error(`[${period}] Erro ao executar as 3 etapas:`, error?.message || error)
      throw new Error(`Erro no processo de 3 etapas para projeção ${period}: ${error?.message || 'Erro desconhecido'}`)
    }

    // Validar projeção com limite realista por período
    if (!validateIbovProjection(projectionData, period)) {
      // Se a variação for muito grande, ajustar para o limite máximo permitido
      if (projectionData.currentValue && projectionData.projectedValue) {
        const variation = (projectionData.projectedValue - projectionData.currentValue) / projectionData.currentValue
        let maxVariation: number
        switch (period) {
          case 'DAILY':
            maxVariation = 0.03 // Máximo 3% de variação em um dia
            break
          case 'WEEKLY':
            maxVariation = 0.06 // Máximo 6% de variação em uma semana
            break
          case 'MONTHLY':
            maxVariation = 0.10 // Máximo 10% de variação em um mês
            break
          case 'ANNUAL':
            maxVariation = 0.20 // Máximo 20% de variação em um ano
            break
          default:
            maxVariation = 0.20 // Padrão conservador
        }
        
        // Ajustar projeção para o limite máximo mantendo a direção (alta/baixa)
        const adjustedVariation = Math.sign(variation) * Math.min(Math.abs(variation), maxVariation)
        const originalProjectedValue = projectionData.projectedValue
        projectionData.projectedValue = projectionData.currentValue * (1 + adjustedVariation)
        projectionData.reasoning = `${projectionData.reasoning}\n\n[Nota: Projeção ajustada automaticamente de ${originalProjectedValue.toFixed(2)} para ${projectionData.projectedValue.toFixed(2)} pontos, respeitando o limite realista de ${(maxVariation * 100).toFixed(0)}% de variação para período ${period}]`
        console.log(`✅ [CRON] Projeção ajustada: ${projectionData.projectedValue.toFixed(2)} (variação ajustada: ${(adjustedVariation * 100).toFixed(2)}%, original: ${(variation * 100).toFixed(2)}%)`)
        
        // Revalidar após ajuste
        if (!validateIbovProjection(projectionData, period)) {
          throw new Error('Projeção inválida mesmo após ajuste')
        }
      } else {
        throw new Error('Projeção inválida ou com dados absurdos')
      }
    }
    
    // CORRIGIR REASONING: Garantir que a direção (ALTA/QUEDA/ESTABILIDADE) reflita corretamente o valor projetado
    if (projectionData.currentValue && projectionData.projectedValue && projectionData.reasoning) {
      projectionData.reasoning = correctReasoningDirection(
        projectionData.reasoning,
        projectionData.projectedValue,
        projectionData.currentValue
      )
      console.log(`✅ [CRON] Reasoning corrigido para refletir direção correta da projeção`)
    }

    // Calcular validUntil baseado no período
    const validUntil = new Date()
    switch (period) {
      case 'DAILY':
        validUntil.setDate(validUntil.getDate() + 1)
        validUntil.setHours(8, 0, 0, 0)
        break
      case 'WEEKLY':
        const daysUntilMonday = (8 - validUntil.getDay()) % 7 || 7
        validUntil.setDate(validUntil.getDate() + daysUntilMonday)
        validUntil.setHours(8, 0, 0, 0)
        break
      case 'MONTHLY':
        if (forceNextMonth) {
          // Se forçado no fim do mês, calcular para o mês seguinte
          validUntil.setMonth(validUntil.getMonth() + 2) // +2 porque queremos o próximo mês após o atual
        } else {
          validUntil.setMonth(validUntil.getMonth() + 1)
        }
        validUntil.setDate(1)
        validUntil.setHours(8, 0, 0, 0)
        break
      case 'ANNUAL':
        if (forceNextMonth) {
          // Se forçado no fim do ano, calcular para o ano seguinte
          validUntil.setFullYear(validUntil.getFullYear() + 1)
        } else {
          validUntil.setMonth(validUntil.getMonth() + 1)
        }
        validUntil.setDate(1)
        validUntil.setHours(8, 0, 0, 0)
        break
    }

    // Salvar projeção no banco
    await prisma.ibovProjection.create({
      data: {
        period,
        projectedValue: projectionData.projectedValue,
        confidence: projectionData.confidence,
        reasoning: projectionData.reasoning,
        keyIndicators: projectionData.keyIndicators || null,
        validUntil
      }
    })

    console.log(`✅ Projeção ${period} calculada e salva com sucesso`)
    return {
      success: true,
      cached: false,
      period
    }
  } catch (error) {
    console.error(`❌ Erro ao calcular projeção ${period}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      period
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Validar CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Tentativa de acesso não autorizada ao cron job')
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se há parâmetro de período específico para forçar cálculo
    const { searchParams } = new URL(request.url)
    const forcePeriodParam = searchParams.get('period')
    const forcePeriod = ['WEEKLY', 'MONTHLY', 'ANNUAL'].includes(forcePeriodParam || '')
      ? (forcePeriodParam as 'WEEKLY' | 'MONTHLY' | 'ANNUAL')
      : null
    const forceAll = searchParams.get('force') === 'true'

    // Se forçar período específico ou todos, calcular independente do horário
    if (forcePeriod || forceAll) {
      console.log(`🔄 Modo FORÇADO: ${forceAll ? 'calculando todos os períodos' : `calculando apenas ${forcePeriod}`}`)
      const results: any[] = []
      
      const periodsToCalculate = forceAll 
        ? (['WEEKLY', 'MONTHLY', 'ANNUAL'] as const)
        : [forcePeriod!] as const

      // Verificar se estamos no fim do mês (últimos 3 dias) para calcular mês seguinte
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
      })
      const nowParts = formatter.formatToParts(new Date())
      const dayOfMonth = parseInt(nowParts.find(p => p.type === 'day')?.value || '0', 10)
      const daysInMonth = new Date(
        parseInt(nowParts.find(p => p.type === 'year')?.value || '2024', 10),
        parseInt(nowParts.find(p => p.type === 'month')?.value || '1', 10),
        0
      ).getDate()
      const isEndOfMonth = dayOfMonth >= daysInMonth - 2 // Últimos 3 dias do mês

      // Processar todos os períodos em paralelo para agilizar execução
      const projectionPromises = periodsToCalculate.map(async (period) => {
        console.log(`📅 Iniciando cálculo paralelo da projeção ${period}...`)
        const shouldForceNextMonth = (period === 'MONTHLY' || period === 'ANNUAL') && isEndOfMonth
        if (shouldForceNextMonth) {
          console.log(`📅 Calculando projeção ${period} para o próximo período (fim do mês detectado)`)
        }
        try {
          const result = await calculateProjection(period, shouldForceNextMonth)
          console.log(`✅ Projeção ${period} concluída`)
          return result
        } catch (error) {
          console.error(`❌ Erro ao calcular projeção ${period}:`, error)
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
            period
          }
        }
      })
      
      // Aguardar todas as projeções em paralelo
      const parallelResults = await Promise.all(projectionPromises)
      results.push(...parallelResults)

      return NextResponse.json({
        success: true,
        results,
        timestamp: new Date().toISOString(),
        forced: true
      })
    }

    // Obter hora atual em Brasília usando Intl.DateTimeFormat
    const now = new Date()
    const todayInBrazil = getTodayInBrazil()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      minute: 'numeric',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      weekday: 'short',
      hour12: false
    })
    
    const parts = formatter.formatToParts(now)
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10)
    const dayOfMonth = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10)
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1 // 0-indexed
    const weekday = parts.find(p => p.type === 'weekday')?.value || ''
    
    // Mapear dia da semana
    const dayMap: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0
    }
    const dayOfWeek = dayMap[weekday] ?? 0

    console.log(`🕐 Executando cron job de projeções IBOV`)
    console.log(`   UTC: ${now.toISOString()}`)
    console.log(`   Horário de Brasília: ${hour}:${parts.find(p => p.type === 'minute')?.value || '00'}`)
    console.log(`   Dia da semana: ${dayOfWeek} (${weekday}), Dia do mês: ${dayOfMonth}, Mês: ${month + 1}`)

    // Verificar se é dia útil (não é sábado, domingo nem feriado nacional)
    const isTradingDayToday = isTradingDay(todayInBrazil)
    
    if (!isTradingDayToday) {
      const holidayCheck = isBrazilianNationalHoliday(todayInBrazil)
      const reason = dayOfWeek === 0 ? 'domingo' : dayOfWeek === 6 ? 'sábado' : holidayCheck ? 'feriado nacional' : 'não é dia útil'
      console.log(`⏸️ Cron job de projeções IBOV pulado: ${reason}`)
      return NextResponse.json({
        success: true,
        message: `Nenhuma projeção calculada: ${reason}`,
        timestamp: now.toISOString(),
        skipped: true
      })
    }

    const results: any[] = []

    // Verificar se já existe projeção válida para cada período
    const checkExistingProjection = async (period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'): Promise<boolean> => {
      const existing = await prisma.ibovProjection.findFirst({
        where: {
          period,
          validUntil: {
            gt: now
          }
        },
        orderBy: { createdAt: 'desc' }
      })
      return !!existing
    }

    // Verificar se estamos próximo do fim do mês (últimos 3 dias)
    const daysInMonth = new Date(
      parseInt(parts.find(p => p.type === 'year')?.value || '2024', 10),
      parseInt(parts.find(p => p.type === 'month')?.value || '1', 10),
      0
    ).getDate()
    const isEndOfMonth = dayOfMonth >= daysInMonth - 2 // Últimos 3 dias do mês

    // Coletar todas as projeções que precisam ser calculadas para processar em paralelo
    const projectionPromises: Promise<any>[] = []

    // Semanal: Toda segunda-feira às 08:00 ou após se ainda não foi calculado (horário de Brasília)
    // Se estamos próximo do fim do mês, calcular mesmo que não seja segunda-feira (considerar próxima semana)
    // Se não existe projeção válida, calcular mesmo que não seja segunda-feira (para permitir recuperação)
    if (hour >= 8) {
      const hasWeeklyProjection = await checkExistingProjection('WEEKLY')
      const shouldCalculateWeekly = !hasWeeklyProjection || dayOfWeek === 1 || isEndOfMonth
      
      if (shouldCalculateWeekly) {
        if (!hasWeeklyProjection) {
          if (isEndOfMonth && dayOfWeek !== 1) {
            console.log('📅 Agendando cálculo paralelo da projeção SEMANAL (fim do mês detectado, considerando próxima semana)...')
          } else if (dayOfWeek === 1) {
            console.log('📅 Agendando cálculo paralelo da projeção SEMANAL (segunda-feira)...')
          } else {
            console.log('📅 Agendando cálculo paralelo da projeção SEMANAL (não existe projeção válida)...')
          }
        } else if (dayOfWeek === 1 || isEndOfMonth) {
          // Recalcular se é segunda-feira ou fim do mês (mesmo que já exista)
          if (isEndOfMonth && dayOfWeek !== 1) {
            console.log('📅 Agendando recálculo paralelo da projeção SEMANAL (fim do mês detectado, considerando próxima semana)...')
          } else {
            console.log('📅 Agendando recálculo paralelo da projeção SEMANAL (segunda-feira)...')
          }
        }
        if (shouldCalculateWeekly) {
          projectionPromises.push(
            calculateProjection('WEEKLY').catch(error => ({
              success: false,
              error: error instanceof Error ? error.message : 'Erro desconhecido',
              period: 'WEEKLY' as const
            }))
          )
        }
      } else {
        console.log('ℹ️ Projeção SEMANAL já existe e está válida')
      }
    }

    // Mensal: Todo dia 1 às 08:00 ou após se ainda não foi calculado (horário de Brasília)
    // Se não existe projeção válida, calcular mesmo que não seja dia 1 (para permitir recuperação)
    if (hour >= 8) {
      const hasMonthlyProjection = await checkExistingProjection('MONTHLY')
      // Calcular se não existe projeção válida OU se é dia 1 (revisão mensal)
      if (!hasMonthlyProjection || dayOfMonth === 1) {
        if (!hasMonthlyProjection) {
          console.log('📅 Agendando cálculo paralelo da projeção MENSAL (não existe projeção válida)...')
        } else {
          console.log('📅 Agendando recálculo paralelo da projeção MENSAL (revisão mensal no dia 1)...')
        }
        projectionPromises.push(
          calculateProjection('MONTHLY').catch(error => ({
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
            period: 'MONTHLY' as const
          }))
        )
      } else {
        console.log('ℹ️ Projeção MENSAL já existe e está válida')
      }
    }

    // Anual: Todo dia 1 de cada mês às 08:00 ou após se ainda não foi calculado (horário de Brasília)
    // Revisão mensal da projeção anual
    // Se não existe projeção válida, calcular mesmo que não seja dia 1 (para permitir recuperação)
    if (hour >= 8) {
      const hasAnnualProjection = await checkExistingProjection('ANNUAL')
      // Calcular se não existe projeção válida OU se é dia 1 (revisão mensal)
      if (!hasAnnualProjection || dayOfMonth === 1) {
        if (!hasAnnualProjection) {
          console.log('📅 Agendando cálculo paralelo da projeção ANUAL (não existe projeção válida)...')
        } else {
          console.log('📅 Agendando recálculo paralelo da projeção ANUAL (revisão mensal no dia 1)...')
        }
        projectionPromises.push(
          calculateProjection('ANNUAL').catch(error => ({
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
            period: 'ANNUAL' as const
          }))
        )
      } else {
        console.log('ℹ️ Projeção ANUAL já existe e está válida')
      }
    }

    // Executar todas as projeções em paralelo
    if (projectionPromises.length > 0) {
      console.log(`🚀 Executando ${projectionPromises.length} projeção(ões) em paralelo...`)
      const parallelResults = await Promise.all(projectionPromises)
      results.push(...parallelResults)
      console.log(`✅ Todas as ${projectionPromises.length} projeção(ões) concluídas`)
    }

    if (results.length === 0) {
      console.log('ℹ️ Nenhuma projeção precisa ser calculada neste momento')
      return NextResponse.json({
        success: true,
        message: 'Nenhuma projeção precisa ser calculada neste momento',
        timestamp: now.toISOString()
      })
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: now.toISOString()
    })
  } catch (error) {
    console.error('❌ Erro no cron job de projeções IBOV:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

