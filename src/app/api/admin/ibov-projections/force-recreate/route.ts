/**
 * API: Forçar Recriação de Projeções IBOV
 * POST /api/admin/ibov-projections/force-recreate
 * 
 * Força recriação de todas as projeções IBOV ou períodos específicos
 * Usa novos indicadores e análise técnica atualizada
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { getIbovData } from '@/lib/ben-tools'
import { GoogleGenAI } from '@google/genai'
import { 
  getElectionPeriod, 
  getTechnicalAnalysisForIbov, 
  getMacroEconomicEvents,
  getEconomicIndicatorsWithTechnicalAnalysis,
  getIndicatorExpectations
} from '@/lib/ibov-projection-helpers'

export const maxDuration = 60 // Máximo permitido no plano hobby (60 segundos)

type ProjectionPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'

interface RecreateResult {
  success: boolean
  projectionId?: string
  error?: string
}

/**
 * Calcula projeção IBOV para um período específico
 * Reutiliza lógica do cron job
 */
async function calculateProjection(
  period: ProjectionPeriod,
  forceRecreate: boolean = true
): Promise<RecreateResult> {
  try {
    const now = new Date()

    // Se forceRecreate, deletar projeções existentes válidas
    if (forceRecreate) {
      await prisma.ibovProjection.deleteMany({
        where: {
          period,
          validUntil: {
            gt: now
          }
        }
      })
    }

    // Buscar dados reais do IBOV
    const ibovData = await getIbovData()
    if (!ibovData.success || !ibovData.data) {
      return {
        success: false,
        error: 'Não foi possível obter dados do IBOVESPA'
      }
    }

    const currentValue = ibovData.data.currentValue

    if (!process.env.GEMINI_API_KEY) {
      return {
        success: false,
        error: 'GEMINI_API_KEY não configurada'
      }
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!
    })

    // Buscar indicadores econômicos com análise técnica
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
      
      economicIndicatorsSection = `
**INDICADORES ECONÔMICOS ATUAIS COM ANÁLISE TÉCNICA**:
${indicatorsList.join('\n')}

${economicIndicators.crossAnalysis ? `
**CRUZAMENTO DE INDICADORES**:
${economicIndicators.crossAnalysis.summary}
Nível de Risco: ${economicIndicators.crossAnalysis.riskLevel}
` : ''}
`
    }

    // Buscar contexto adicional para projeções mensal/anual
    let technicalAnalysisSection = ''
    let electionSection = ''
    let macroEventsSection = ''

    if (period === 'MONTHLY' || period === 'ANNUAL') {
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
`
      }

      const electionPeriod = getElectionPeriod()
      if (electionPeriod.isElectionPeriod || electionPeriod.electionType !== 'NONE') {
        electionSection = `
**CONTEXTO POLÍTICO E ELEITORAL**:
- Período Eleitoral: ${electionPeriod.isElectionPeriod ? 'SIM' : 'NÃO'}
- Tipo de Eleição: ${electionPeriod.electionType === 'PRESIDENTIAL' ? 'PRESIDENCIAL' : electionPeriod.electionType === 'MUNICIPAL' ? 'MUNICIPAL' : 'NENHUMA'}
- Descrição: ${electionPeriod.description}
`
      }

      const macroEvents = await getMacroEconomicEvents(period)
      if (macroEvents.events.length > 0 || macroEvents.summary) {
        const eventsList = macroEvents.events.map(e => 
          `- ${e.date}: ${e.event} (Importância: ${e.importance === 'HIGH' ? 'ALTA' : e.importance === 'LOW' ? 'BAIXA' : 'MÉDIA'})`
        ).join('\n')
        
        macroEventsSection = `
**EVENTOS MACROECONÔMICOS AGENDADOS**:
${eventsList || 'Nenhum evento específico encontrado'}

Resumo: ${macroEvents.summary}
`
      }
    }

    // Calcular validUntil baseado no período
    const validUntil = new Date()
    switch (period) {
      case 'DAILY':
        validUntil.setDate(validUntil.getDate() + 1)
        break
      case 'WEEKLY':
        validUntil.setDate(validUntil.getDate() + 7)
        break
      case 'MONTHLY':
        validUntil.setMonth(validUntil.getMonth() + 1)
        break
      case 'ANNUAL':
        validUntil.setFullYear(validUntil.getFullYear() + 1)
        break
    }

    // Construir prompt simplificado (similar ao endpoint principal)
    const prompt = `Você é um analista macroeconômico especializado no mercado brasileiro. Projete o valor do IBOVESPA para o período ${period === 'DAILY' ? 'diário' : period === 'WEEKLY' ? 'semanal' : period === 'ANNUAL' ? 'anual' : 'mensal'}.

**VALOR ATUAL DO IBOVESPA**: ${currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

**INDICADORES OBRIGATÓRIOS**: VIX, DI Futuro, Petróleo, Minério de Ferro, Dólar, S&P500

${economicIndicatorsSection}
${technicalAnalysisSection}
${electionSection}
${macroEventsSection}

Retorne APENAS JSON válido:
{
  "projectedValue": 125000.50,
  "confidence": 75,
  "reasoning": "[ANÁLISE DIDÁTICA DETALHADA - siga EXATAMENTE esta estrutura OBRIGATÓRIA]:\n\n**PROJEÇÃO: [ALTA/QUEDA/ESTABILIDADE]**\n\n**MOTIVOS PRINCIPAIS DA PROJEÇÃO:**\n\n1. **[Nome do Indicador Principal] (Peso: X%)**: [Explicação direta e clara do motivo que levou à projeção de alta/queda]\n\n2. **[Segundo Indicador] (Peso: Y%)**: [Explicação direta do motivo e impacto]\n\n[Continue para TODOS os indicadores avaliados]\n\n**RESUMO**: [Síntese clara explicando por que a projeção é de alta/queda, conectando todos os indicadores de forma didática]\n\n⚠️ CRÍTICO: O reasoning DEVE começar com **PROJEÇÃO: [ALTA/QUEDA/ESTABILIDADE]** seguido imediatamente por **MOTIVOS PRINCIPAIS DA PROJEÇÃO:**. Esta estrutura é OBRIGATÓRIA.",
  "keyIndicators": {
    "primary": "VIX",
    "all": {
      "VIX": { "weight": 0.20, "impact": "ALTA", "reason": "..." },
      "DI Futuro": { "weight": 0.25, "impact": "ALTA", "reason": "..." },
      "Petróleo": { "weight": 0.20, "impact": "NEUTRO", "reason": "..." },
      "Minério de Ferro": { "weight": 0.15, "impact": "BAIXA", "reason": "..." },
      "Dólar": { "weight": 0.12, "impact": "NEUTRO", "reason": "..." },
      "S&P500": { "weight": 0.08, "impact": "ALTA", "reason": "..." }
    }
  }
}

**REGRAS CRÍTICAS PARA O REASONING**:
- O reasoning DEVE começar EXATAMENTE com "**PROJEÇÃO: [ALTA/QUEDA/ESTABILIDADE]**" seguido imediatamente por "**MOTIVOS PRINCIPAIS DA PROJEÇÃO:**"
- A direção (ALTA/QUEDA/ESTABILIDADE) DEVE refletir EXATAMENTE a relação entre projectedValue e currentValue
- Use markdown para formatação (negrito, listas, etc.)`

    // Função helper para chamar Gemini com retry
    const callGeminiWithRetry = async (maxRetries: number = 3): Promise<string> => {
      let lastError: Error | null = null
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 [${period}] Tentativa ${attempt}/${maxRetries} de chamada ao Gemini`)
          
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

          let fullResponse = ''
          let chunkCount = 0
          let hasTextChunks = false
          
          for await (const chunk of response) {
            chunkCount++
            if (chunk.text) {
              fullResponse += chunk.text
              hasTextChunks = true
            }
          }

          // Se não recebeu nenhum chunk com texto, considerar erro retryable
          if (!hasTextChunks && chunkCount === 0) {
            throw new Error('Resposta vazia do Gemini (nenhum chunk recebido)')
          }

          // Se recebeu chunks mas sem texto, também considerar erro retryable
          if (!hasTextChunks && chunkCount > 0) {
            console.warn(`[${period}] Recebeu ${chunkCount} chunks mas nenhum com texto. Tentando novamente...`)
            throw new Error('Resposta vazia do Gemini (chunks sem texto)')
          }

          if (fullResponse.trim().length === 0) {
            throw new Error('Resposta vazia do Gemini')
          }

          return fullResponse
        } catch (error: any) {
          lastError = error
          
          // Verificar se é erro 503 (modelo sobrecarregado) ou 429 (rate limit)
          const isOverloaded = 
            error?.status === 503 || 
            error?.status === 429 ||
            error?.message?.includes('overloaded') ||
            error?.message?.includes('UNAVAILABLE') ||
            error?.code === 503 ||
            error?.code === 429

          if (isOverloaded && attempt < maxRetries) {
            // Backoff exponencial: 2s, 4s, 8s
            const delayMs = Math.min(2000 * Math.pow(2, attempt - 1), 10000)
            console.warn(`⚠️ [${period}] Gemini sobrecarregado (tentativa ${attempt}/${maxRetries}). Aguardando ${delayMs}ms antes de tentar novamente...`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
            continue
          }

          // Se não é erro retryable ou esgotou tentativas, lançar erro
          throw error
        }
      }

      // Se chegou aqui, todas as tentativas falharam
      throw lastError || new Error('Falha ao chamar Gemini após múltiplas tentativas')
    }

    const fullResponse = await callGeminiWithRetry(3)

    // Extrair JSON da resposta
    const jsonMatch = fullResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        success: false,
        error: 'Resposta do Gemini não contém JSON válido'
      }
    }

    const projectionData = JSON.parse(jsonMatch[0])

    // Validar projeção
    const variation = Math.abs((projectionData.projectedValue - currentValue) / currentValue)
    let maxVariation: number
    switch (period) {
      case 'DAILY':
        maxVariation = 0.03
        break
      case 'WEEKLY':
        maxVariation = 0.06
        break
      case 'MONTHLY':
        maxVariation = 0.10
        break
      case 'ANNUAL':
        maxVariation = 0.20
        break
      default:
        maxVariation = 0.20
    }

    if (variation > maxVariation) {
      return {
        success: false,
        error: `Variação de ${(variation * 100).toFixed(2)}% excede limite de ${(maxVariation * 100).toFixed(2)}%`
      }
    }

    // Salvar projeção
    const projection = await prisma.ibovProjection.create({
      data: {
        period,
        projectedValue: projectionData.projectedValue,
        confidence: projectionData.confidence,
        reasoning: projectionData.reasoning,
        keyIndicators: projectionData.keyIndicators,
        validUntil
      }
    })

    return {
      success: true,
      projectionId: projection.id
    }
  } catch (error) {
    console.error(`❌ [FORCE RECREATE] Erro ao calcular projeção ${period}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar se usuário é admin
    const user = await requireAdminUser()
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { periods, skipValidation } = body

    // Determinar períodos para recriar (sem diária)
    const periodsToRecreate: ProjectionPeriod[] = periods && Array.isArray(periods)
      ? periods.filter((p: string) => ['WEEKLY', 'MONTHLY', 'ANNUAL'].includes(p))
      : ['WEEKLY', 'MONTHLY', 'ANNUAL']

    const results: Record<string, RecreateResult> = {}
    const errors: string[] = []

    // Processar períodos sequencialmente com delays para evitar sobrecarregar o Gemini
    for (let i = 0; i < periodsToRecreate.length; i++) {
      const period = periodsToRecreate[i]
      
      // Adicionar delay entre períodos para evitar sobrecarregar o Gemini
      if (i > 0) {
        const delayMs = 3000 // 3 segundos entre períodos
        console.log(`⏳ [FORCE RECREATE] Aguardando ${delayMs}ms antes de processar ${period}...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
      
      try {
        console.log(`🔄 [FORCE RECREATE] Processando projeção ${period}...`)
        const result = await calculateProjection(period, true)
        results[period] = result
        if (!result.success && result.error) {
          errors.push(`${period}: ${result.error}`)
        } else {
          console.log(`✅ [FORCE RECREATE] Projeção ${period} criada com sucesso`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
        results[period] = {
          success: false,
          error: errorMessage
        }
        errors.push(`${period}: ${errorMessage}`)
        
        // Se for erro 503, adicionar delay maior antes do próximo período
        const isOverloaded = 
          error instanceof Error && (
            (error as any)?.status === 503 ||
            (error as any)?.code === 503 ||
            error.message?.includes('overloaded') ||
            error.message?.includes('UNAVAILABLE')
          )
        
        if (isOverloaded && i < periodsToRecreate.length - 1) {
          const delayMs = 10000 // 10 segundos após erro 503
          console.log(`⚠️ [FORCE RECREATE] Erro 503 detectado. Aguardando ${delayMs}ms antes do próximo período...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
    }

    const totalRecreated = Object.values(results).filter(r => r.success).length

    return NextResponse.json({
      success: totalRecreated > 0,
      recreated: results,
      totalRecreated,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('❌ [FORCE RECREATE] Erro geral:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    )
  }
}

