/**
 * API Route para calcular projeções do IBOVESPA
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { prisma } from '@/lib/prisma'
import { getIbovData } from '@/lib/ben-tools'
import { 
  getElectionPeriod, 
  getTechnicalAnalysisForIbov, 
  getMacroEconomicEvents,
  getEconomicIndicatorsWithTechnicalAnalysis,
  getIndicatorExpectations
} from '@/lib/ibov-projection-helpers'
import { isCurrentUserPremium } from '@/lib/user-service'

/**
 * Valida se uma projeção IBOV é válida
 */
function validateIbovProjection(projection: {
  projectedValue: number
  confidence: number
  reasoning: string
  currentValue?: number
}, period?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'): boolean {
  // Validar valor projetado
  if (projection.projectedValue <= 0 || projection.projectedValue > 200000) {
    return false
  }

  // Validar variação se tiver valor atual
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
      console.warn(`Projeção IBOV rejeitada: variação de ${(variation * 100).toFixed(2)}% excede o limite de ${(maxVariation * 100).toFixed(2)}% para período ${period}`)
      return false
    }
  }

  // Validar confiança
  if (projection.confidence < 30) {
    return false
  }

  // Validar reasoning
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { period } = body // DAILY, WEEKLY, MONTHLY, ANNUAL

    if (!period || !['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL'].includes(period)) {
      return NextResponse.json(
        { error: 'Período inválido. Use: DAILY, WEEKLY, MONTHLY ou ANNUAL' },
        { status: 400 }
      )
    }

    // Buscar dados reais do IBOV
    const ibovData = await getIbovData()
    if (!ibovData.success || !ibovData.data) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Não foi possível obter dados do IBOVESPA',
          fallback: true,
          currentValue: null
        },
        { status: 200 } // Retorna 200 mas indica fallback
      )
    }

    const currentValue = ibovData.data.currentValue

    // Verificar se já existe projeção válida
    const now = new Date()
    const existingProjection = await prisma.ibovProjection.findFirst({
      where: {
        period,
        validUntil: {
          gt: now
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (existingProjection) {
      // Verificar se usuário é premium
      const isPremium = await isCurrentUserPremium()
      
      // Ofuscar dados para usuários gratuitos
      if (!isPremium) {
        return NextResponse.json({
          success: true,
          projection: {
            period: existingProjection.period,
            projectedValue: 0, // Ofuscado
            confidence: 0, // Ofuscado
            reasoning: 'Esta análise detalhada está disponível apenas para usuários Premium. Faça upgrade para desbloquear projeções completas do IBOVESPA com análises detalhadas do Ben.',
            keyIndicators: null, // Ofuscado
            validUntil: existingProjection.validUntil,
            createdAt: existingProjection.createdAt
          },
          currentValue,
          cached: true,
          isPremium: false
        })
      }

      return NextResponse.json({
        success: true,
        projection: {
          period: existingProjection.period,
          projectedValue: Number(existingProjection.projectedValue),
          confidence: existingProjection.confidence,
          reasoning: existingProjection.reasoning,
          keyIndicators: existingProjection.keyIndicators,
          validUntil: existingProjection.validUntil,
          createdAt: existingProjection.createdAt
        },
        currentValue,
        cached: true,
        isPremium: true
      })
    }

    // Calcular nova projeção usando Gemini
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { 
          success: false,
          error: 'GEMINI_API_KEY não configurada',
          fallback: true,
          currentValue
        },
        { status: 200 }
      )
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

    const prompt = `Você é um analista macroeconômico especializado no mercado brasileiro. Sua tarefa é criar uma análise didática e detalhada sobre a projeção do IBOVESPA.

**TAREFA**: Projetar o valor do IBOVESPA para o período ${period === 'DAILY' ? 'diário' : period === 'WEEKLY' ? 'semanal' : period === 'ANNUAL' ? 'anual' : 'mensal'}.

**VALOR ATUAL DO IBOVESPA**: ${currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

**INDICADORES OBRIGATÓRIOS A ANALISAR** (você DEVE avaliar TODOS e atribuir peso a cada um):

**INDICADORES PRINCIPAIS**:
1. **VIX** (índice de volatilidade) - CRÍTICO: Mede medo/volatilidade do mercado. VIX alto indica maior risco e pode impactar negativamente o IBOV
2. **DI Futuro** (taxa de juros futura) - Impacto direto no custo de oportunidade para renda variável
3. **Petróleo** (WTI/Brent) - Importante devido à alta participação da Petrobras no IBOV
4. **Minério de Ferro** - Importante devido à alta participação da Vale no IBOV
5. **Dólar** (USD/BRL) - Impacto em empresas exportadoras e importadoras
6. **S&P500** - Correlação com mercado internacional e sentimento global

**INDICADORES COMPLEMENTARES** (considere também, mas com peso menor):
7. **CDI** (taxa de juros brasileira de referência) - Complementa DI Futuro, indica custo de capital no Brasil
8. **Selic** (taxa básica de juros do Brasil) - Definida pelo COPOM, impacta diretamente o custo de capital
9. **IPCA** (índice de inflação brasileiro) - Impacta decisões do COPOM e política monetária
10. **CRB Index** (índice agregado de commodities) - Visão macro do setor de commodities
11. **Cobre** (commodity importante para economia global) - Indicador de crescimento econômico global
12. **Soja** (commodity importante para Brasil) - Impacto no agronegócio brasileiro
13. **Bond Yield Brasil 10Y** (títulos públicos brasileiros) - Mede risco país e expectativas de longo prazo
14. **Índice de Confiança do Consumidor** - Sentimento econômico doméstico, impacto no consumo

${economicIndicatorsSection}

${technicalAnalysisSection}
${electionSection}
${macroEventsSection}
**FORMATO DE RESPOSTA (JSON válido)**:
{
  "projectedValue": 125000.50,
  "confidence": 75,
  "reasoning": "[ANÁLISE DIDÁTICA DETALHADA - siga EXATAMENTE esta estrutura OBRIGATÓRIA]:\\n\\n**PROJEÇÃO: [ALTA/QUEDA/ESTABILIDADE]**\\n\\n**MOTIVOS PRINCIPAIS DA PROJEÇÃO:**\\n\\n1. **[Nome do Indicador Principal] (Peso: X%)**: [Explicação direta e clara do motivo que levou à projeção de alta/queda. Exemplo: 'O DI Futuro está em [valor]%, indicando [tendência de alta/queda de juros]. Isso [impacto direto no IBOV - explique o motivo específico].']\\n\\n2. **[Segundo Indicador] (Peso: Y%)**: [Explicação direta do motivo e impacto]\\n\\n3. **[Terceiro Indicador] (Peso: Z%)**: [Explicação direta do motivo e impacto]\\n\\n[Continue para TODOS os indicadores avaliados]\\n\\n**RESUMO**: [Síntese clara explicando por que a projeção é de alta/queda, conectando todos os indicadores de forma didática]\\n\\n⚠️ CRÍTICO: O reasoning DEVE começar com **PROJEÇÃO: [ALTA/QUEDA/ESTABILIDADE]** seguido imediatamente por **MOTIVOS PRINCIPAIS DA PROJEÇÃO:**. Esta estrutura é OBRIGATÓRIA.",
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
      }
}

**REGRAS CRÍTICAS PARA O REASONING**:

1. **SEJA DIDÁTICO E DIRETO**: Explique cada motivo de forma clara e objetiva, como se estivesse explicando para um investidor leigo
2. **EXPLIQUE MOTIVO POR MOTIVO**: Para cada indicador, explique:
   - O que está acontecendo com ele
   - Por que isso impacta o IBOV
   - Como isso leva à projeção de alta/queda
3. **INCLUA TODOS OS INDICADORES**: Priorize os 6 indicadores principais (VIX, DI Futuro, Petróleo, Minério de Ferro, Dólar, S&P500) no reasoning e keyIndicators, mas também considere os indicadores complementares (CDI, Selic, IPCA, CRB Index, Cobre, Soja, Bond Yield Brasil 10Y, Confiança do Consumidor) quando relevantes para a análise
4. **ESTRUTURA CLARA**: Use a estrutura sugerida acima com títulos e numeração para facilitar a leitura
5. **CONECTE OS INDICADORES**: No resumo final, explique como todos os indicadores juntos levam à projeção

**REGRAS PARA KEYINDICATORS**:

1. **Campo "all"**: DEVE conter os 6 indicadores principais (VIX, DI Futuro, Petróleo, Minério de Ferro, Dólar, S&P500). Indicadores complementares podem ser mencionados no reasoning quando relevantes
2. **Pesos**: A soma de todos os pesos dos indicadores principais DEVE ser igual a 1.0 (100%). Indicadores complementares não precisam ter pesos explícitos, mas devem ser considerados na análise
3. **Impact**: Indique se cada indicador está puxando para ALTA, BAIXA ou é NEUTRO
4. **Reason**: Breve explicação (1-2 frases) do impacto de cada indicador

**IMPORTANTE - TOM E CONSERVADORISMO DINÂMICO**:

1. **SEJA PÉ NO CHÃO, MAS DINÂMICO**: 
   - Quando TODOS ou MAIORIA dos indicadores apontam na mesma direção (alta ou queda), você pode usar mais do limite máximo permitido (até 80-90% do limite)
   - Quando há DIVERGÊNCIA entre indicadores, seja mais conservador (use 30-50% do limite máximo)
   - Evite extremos absolutos (caos total ou otimismo exagerado), mas não seja excessivamente conservador quando há consenso

2. **LIMITES DE VARIAÇÃO POR PERÍODO** (NÃO EXCEDA):
   - Diário: máximo 3% de variação (use 0.5-2.5% normalmente, até 2.7% quando há consenso forte)
   - Semanal: máximo 6% de variação (use 1-5% normalmente, até 5.4% quando há consenso forte)
   - Mensal: máximo 10% de variação (use 2-8% normalmente, até 9% quando há consenso forte)
   - Anual: máximo 20% de variação (use 5-15% normalmente, até 18% quando há consenso forte)

3. **LÓGICA DE CONSENSO**:
   - Se 4-5 indicadores apontam ALTA e 0-1 apontam BAIXA → Use 70-90% do limite máximo na direção de alta
   - Se 4-5 indicadores apontam BAIXA e 0-1 apontam ALTA → Use 70-90% do limite máximo na direção de queda
   - Se há equilíbrio (2-3 ALTA, 2-3 BAIXA) → Use 30-50% do limite máximo, tendendo para estabilidade
   - Se maioria aponta NEUTRO → Use 20-40% do limite máximo

4. **TOME CUIDADO COM EXTREMOS**: 
   - Evite projeções muito pessimistas (caos, colapso, queda catastrófica)
   - Evite projeções muito otimistas (explosão, crescimento excepcional)
   - Mas quando há consenso claro, não seja excessivamente conservador - use o range disponível de forma inteligente

5. **CONFIDENCE**: 
   - Com consenso forte (4-5 indicadores na mesma direção): 65-85
   - Com divergência moderada: 50-70
   - Com alta divergência: 40-60

6. **REASONING - CRÍTICO: ESTRUTURA OBRIGATÓRIA E CONSISTÊNCIA COM VALOR PROJETADO**: 
   - **ESTRUTURA OBRIGATÓRIA** (DEVE ser seguida EXATAMENTE):
     O reasoning DEVE começar com: **PROJEÇÃO: [ALTA/QUEDA/ESTABILIDADE]**
     Seguido imediatamente por: **MOTIVOS PRINCIPAIS DA PROJEÇÃO:**
     Depois listar cada indicador numerado: 1. [Indicador] (Peso: X%): [Explicação]
     E terminar com: **RESUMO**: [Síntese]
   - **ANTES DE ESCREVER O REASONING, CALCULE A DIRECÃO CORRETA**:
     * Se projectedValue > currentValue → PROJEÇÃO: ALTA
     * Se projectedValue < currentValue → PROJEÇÃO: QUEDA  
     * Se projectedValue ≈ currentValue (diferença < 0.5%) → PROJEÇÃO: ESTABILIDADE
   - O reasoning DEVE começar EXATAMENTE com "**PROJEÇÃO: [ALTA/QUEDA/ESTABILIDADE]**" seguido imediatamente por "**MOTIVOS PRINCIPAIS DA PROJEÇÃO:**"
   - O campo "PROJEÇÃO: [ALTA/QUEDA/ESTABILIDADE]" DEVE refletir EXATAMENTE a relação entre projectedValue e currentValue
   - Deve ter pelo menos 300 caracteres e explicar TODOS os indicadores de forma didática
   - Use markdown para formatação (negrito, listas, etc.)
   - Mencione o nível de consenso entre os indicadores: "Com consenso entre os indicadores..." ou "Com divergência entre os indicadores..."

7. **ESTIMATIVAS INTELIGENTES**: Use o range disponível de forma proporcional ao consenso dos indicadores. Não seja sempre conservador - quando há clara convergência de sinais, seja mais assertivo (mas sempre dentro dos limites).

${period === 'MONTHLY' || period === 'ANNUAL' ? '- Para projeções de médio/longo prazo, considere o equilíbrio entre análise técnica e fundamentos macroeconômicos\n- Períodos eleitorais e eventos macro agendados devem ser ponderados adequadamente, mas sem exagerar o impacto\n- Seja especialmente conservador em projeções anuais - 20% é o limite máximo' : ''}

Retorne APENAS o JSON, sem markdown ou texto adicional.`

    const model = 'gemini-2.5-flash-lite'
    const tools = [{ googleSearch: {} }]

    // Função helper para chamar Gemini com retry
    const callGeminiWithRetry = async (maxRetries = 3) => {
      let lastError: Error | null = null
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await ai.models.generateContentStream({
            model,
            config: {
              tools,
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
          for await (const chunk of response) {
            if (chunk.text) {
              fullResponse += chunk.text
            }
          }

          return fullResponse
        } catch (error: any) {
          lastError = error
          
          // Verificar se é erro 503 (modelo sobrecarregado) ou 429 (rate limit)
          const isRetryableError = 
            error?.status === 503 || 
            error?.status === 429 ||
            error?.message?.includes('overloaded') ||
            error?.message?.includes('UNAVAILABLE')
          
          if (!isRetryableError || attempt === maxRetries - 1) {
            throw error
          }

          // Backoff exponencial: 2s, 4s, 8s
          const delay = Math.pow(2, attempt) * 1000
          console.log(`Tentativa ${attempt + 1}/${maxRetries} falhou. Tentando novamente em ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      throw lastError || new Error('Falha após múltiplas tentativas')
    }

    const fullResponse = await callGeminiWithRetry()

    if (!fullResponse.trim()) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Resposta vazia do Gemini',
          fallback: true,
          currentValue
        },
        { status: 200 }
      )
    }

    // Extrair JSON da resposta
    const jsonMatch = fullResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Não foi possível extrair JSON da resposta',
          fallback: true,
          currentValue
        },
        { status: 200 }
      )
    }

    const projectionData = JSON.parse(jsonMatch[0])
    projectionData.currentValue = currentValue

    // Validar projeção com limite realista por período
    if (!validateIbovProjection(projectionData, period)) {
      console.warn('Projeção IBOV inválida, tentando ajustar:', projectionData)
      
      // Se a variação for muito grande, ajustar para o limite máximo permitido
      if (projectionData.currentValue && projectionData.projectedValue) {
        const variation = (projectionData.projectedValue - projectionData.currentValue) / projectionData.currentValue
        let maxVariation: number
        switch (period) {
          case 'DAILY':
            maxVariation = 0.03 // Máximo 3% para diária
            break
          case 'WEEKLY':
            maxVariation = 0.06 // Máximo 6% para semanal
            break
          case 'MONTHLY':
            maxVariation = 0.10 // Máximo 10% para mensal
            break
          case 'ANNUAL':
            maxVariation = 0.20 // Máximo 20% para anual
            break
          default:
            maxVariation = 0.20 // Padrão conservador
        }
        
        // Ajustar projeção para o limite máximo mantendo a direção (alta/baixa)
        const adjustedVariation = Math.sign(variation) * Math.min(Math.abs(variation), maxVariation)
        const originalProjectedValue = projectionData.projectedValue
        projectionData.projectedValue = projectionData.currentValue * (1 + adjustedVariation)
        projectionData.reasoning = `${projectionData.reasoning}\n\n[Nota: Projeção ajustada automaticamente de ${originalProjectedValue.toFixed(2)} para ${projectionData.projectedValue.toFixed(2)} pontos, respeitando o limite realista de ${(maxVariation * 100).toFixed(0)}% de variação para período ${period}]`
        console.log(`✅ Projeção ajustada: ${projectionData.projectedValue.toFixed(2)} (variação ajustada: ${(adjustedVariation * 100).toFixed(2)}%, original: ${(variation * 100).toFixed(2)}%)`)
        
        // Revalidar após ajuste
        if (!validateIbovProjection(projectionData, period)) {
          return NextResponse.json(
            { 
              success: false,
              error: 'Projeção inválida mesmo após ajuste',
              fallback: true,
              currentValue,
              details: 'Projeção não passou na validação de segurança'
            },
            { status: 200 }
          )
        }
      } else {
        return NextResponse.json(
          { 
            success: false,
            error: 'Projeção inválida ou com dados absurdos',
            fallback: true,
            currentValue,
            details: 'Projeção não passou na validação de segurança'
          },
          { status: 200 }
        )
      }
    }
    
    // CORRIGIR REASONING: Garantir que a direção (ALTA/QUEDA/ESTABILIDADE) reflita corretamente o valor projetado
    if (projectionData.currentValue && projectionData.projectedValue && projectionData.reasoning) {
      projectionData.reasoning = correctReasoningDirection(
        projectionData.reasoning,
        projectionData.projectedValue,
        projectionData.currentValue
      )
      console.log(`✅ Reasoning corrigido para refletir direção correta da projeção`)
    }

    // Calcular validUntil baseado no período
    const validUntil = new Date()
    switch (period) {
      case 'DAILY':
        validUntil.setDate(validUntil.getDate() + 1)
        validUntil.setHours(8, 0, 0, 0) // Próxima abertura do mercado
        break
      case 'WEEKLY':
        // Próxima segunda-feira às 08:00
        const daysUntilMonday = (8 - validUntil.getDay()) % 7 || 7
        validUntil.setDate(validUntil.getDate() + daysUntilMonday)
        validUntil.setHours(8, 0, 0, 0)
        break
      case 'MONTHLY':
      case 'ANNUAL':
        // 1º dia útil do próximo mês
        validUntil.setMonth(validUntil.getMonth() + 1)
        validUntil.setDate(1)
        validUntil.setHours(8, 0, 0, 0)
        break
    }

    // Salvar projeção no banco
    const projection = await prisma.ibovProjection.create({
      data: {
        period,
        projectedValue: projectionData.projectedValue,
        confidence: projectionData.confidence,
        reasoning: projectionData.reasoning,
        keyIndicators: projectionData.keyIndicators || null,
        validUntil
      }
    })

    // Verificar se usuário é premium antes de retornar
    const isPremium = await isCurrentUserPremium()
    
    // Ofuscar dados para usuários gratuitos
    if (!isPremium) {
      return NextResponse.json({
        success: true,
        projection: {
          period: projection.period,
          projectedValue: 0, // Ofuscado
          confidence: 0, // Ofuscado
          reasoning: 'Esta análise detalhada está disponível apenas para usuários Premium. Faça upgrade para desbloquear projeções completas do IBOVESPA com análises detalhadas do Ben.',
          keyIndicators: null, // Ofuscado
          validUntil: projection.validUntil,
          createdAt: projection.createdAt
        },
        currentValue,
        cached: false,
        isPremium: false
      })
    }

    return NextResponse.json({
      success: true,
      projection: {
        period: projection.period,
        projectedValue: Number(projection.projectedValue),
        confidence: projection.confidence,
        reasoning: projection.reasoning,
        keyIndicators: projection.keyIndicators,
        validUntil: projection.validUntil,
        createdAt: projection.createdAt
      },
      currentValue,
      cached: false,
      isPremium: true
    })
  } catch (error: any) {
    console.error('Erro ao calcular projeção IBOV:', error)
    
    // Verificar se é erro de modelo sobrecarregado
    const isOverloaded = 
      error?.status === 503 || 
      error?.status === 429 ||
      error?.message?.includes('overloaded') ||
      error?.message?.includes('UNAVAILABLE')
    
    // Em caso de erro, retornar fallback
    try {
      const ibovData = await getIbovData()
      return NextResponse.json(
        { 
          success: false,
          error: isOverloaded 
            ? 'Modelo Gemini temporariamente sobrecarregado. Tente novamente em alguns instantes.'
            : 'Erro ao calcular projeção',
          fallback: true,
          currentValue: ibovData.success ? ibovData.data?.currentValue : null,
          details: error instanceof Error ? error.message : 'Erro desconhecido',
          retryable: isOverloaded
        },
        { status: 200 }
      )
    } catch (fallbackError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Erro ao calcular projeção e obter dados do IBOV',
          fallback: true,
          currentValue: null,
          retryable: false
        },
        { status: 500 }
      )
    }
  }
}

