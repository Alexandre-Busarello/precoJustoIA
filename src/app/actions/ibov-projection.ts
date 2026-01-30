'use server'

/**
 * Server Actions para projeções IBOV
 */

import { prisma } from '@/lib/prisma'
import { getIbovData } from '@/lib/ben-tools'
import { isCurrentUserPremium } from '@/lib/user-service'

/**
 * Determina a data de referência para projeção diária baseada no horário de 08:00 (Brasil)
 * Se for antes das 08:00, usa o dia anterior. Se for depois, usa o dia atual.
 */
function getProjectionReferenceDate(): Date {
  const now = new Date()
  // Converter para horário do Brasil (UTC-3)
  const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const hour = brazilTime.getHours()
  
  // Criar data de referência (início do dia)
  const referenceDate = new Date(brazilTime)
  referenceDate.setHours(0, 0, 0, 0)
  
  // Se for antes das 08:00, usar dia anterior
  if (hour < 8) {
    referenceDate.setDate(referenceDate.getDate() - 1)
  }
  
  return referenceDate
}

/**
 * Verifica se já passou das 08:00 (horário do Brasil)
 */
function isAfterUpdateTime(): boolean {
  const now = new Date()
  const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  return brazilTime.getHours() >= 8
}

/**
 * Obtém ou cria projeção IBOV para um período
 */
export async function getOrCreateIbovProjection(period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL') {
  try {
    const now = new Date()
    const referenceDate = period === 'DAILY' ? getProjectionReferenceDate() : now
    const isAfterUpdate = period === 'DAILY' ? isAfterUpdateTime() : true

    // Para projeção diária, buscar projeção criada no dia de referência
    // Para outros períodos, usar validUntil como antes
    const startOfDay = new Date(referenceDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(referenceDate)
    endOfDay.setHours(23, 59, 59, 999)
    
    const whereClause = period === 'DAILY' 
      ? {
          period,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      : {
          period,
          validUntil: {
            gt: now
          }
        }

    // Verificar se existe projeção válida
    // @ts-ignore - Prisma Client será gerado após migração
    const existingProjection = await prisma.ibovProjection.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    })

    // Buscar valor atual do IBOV para comparação (sempre buscar para mostrar valor atual)
    let currentValue: number | null = null
    try {
      const ibovData = await getIbovData()
      currentValue = ibovData.success && ibovData.data?.currentValue !== undefined 
        ? ibovData.data.currentValue 
        : null
    } catch (error) {
      console.error('Erro ao buscar valor atual do IBOV:', error)
    }

    if (existingProjection) {
      // Verificar se usuário é premium
      const isPremium = await isCurrentUserPremium()
      
      // Determinar se é projeção do dia anterior ou atual
      const projectionDate = new Date(existingProjection.createdAt)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const isPreviousDay = projectionDate < today

      // Ofuscar dados para usuários gratuitos
      if (!isPremium) {
        return {
          success: true,
          projection: {
            period: existingProjection.period,
            projectedValue: 0, // Ofuscado
            confidence: 0, // Ofuscado
            reasoning: 'Esta análise detalhada está disponível apenas para usuários Premium. Faça upgrade para desbloquear projeções completas do IBOVESPA com análises detalhadas do Ben.', // Mensagem de conversão
            keyIndicators: null, // Ofuscado
            validUntil: existingProjection.validUntil,
            createdAt: existingProjection.createdAt,
            isPreviousDay: period === 'DAILY' ? isPreviousDay : false,
            updateTime: '08:00'
          },
          currentValue,
          cached: true,
          isPremium: false
        }
      }

      return {
        success: true,
        projection: {
          period: existingProjection.period,
          projectedValue: Number(existingProjection.projectedValue),
          confidence: existingProjection.confidence,
          reasoning: existingProjection.reasoning,
          keyIndicators: existingProjection.keyIndicators,
          validUntil: existingProjection.validUntil,
          createdAt: existingProjection.createdAt,
          isPreviousDay: period === 'DAILY' ? isPreviousDay : false,
          updateTime: '08:00'
        },
        currentValue,
        cached: true,
        isPremium: true
      }
    }

    // Se não existe e já passou das 08:00 (para diária), indicar que precisa calcular on-demand
    // Se for antes das 08:00, não calcular automaticamente (mostrar mensagem)
    if (period === 'DAILY' && !isAfterUpdate) {
      return {
        success: false,
        needsCalculation: false, // Não calcular automaticamente antes das 08:00
        currentValue,
        message: 'A projeção será atualizada às 08:00'
      }
    }

    // Se não existe e já passou das 08:00 (ou não é diária), calcular on-demand
    return {
      success: false,
      needsCalculation: true,
      currentValue // Retornar valor atual mesmo sem projeção
    }
  } catch (error) {
    console.error('Erro ao buscar projeção IBOV:', error)
    
    // Tentar buscar valor atual mesmo em caso de erro
    let currentValue: number | null = null
    try {
      const ibovData = await getIbovData()
      currentValue = ibovData.success && ibovData.data?.currentValue !== undefined 
        ? ibovData.data.currentValue 
        : null
    } catch {
      // Ignorar erro ao buscar valor atual
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      currentValue
    }
  }
}

/**
 * Calcula nova projeção IBOV (chama API interna)
 */
export async function calculateIbovProjection(period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL') {
  try {
    const url = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ben/project-ibov`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ period })
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Erro ao calcular projeção IBOV:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }
  }
}

