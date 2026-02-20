'use server'

/**
 * Server Actions para projeções IBOV
 */

import { prisma } from '@/lib/prisma'
import { getIbovData } from '@/lib/ben-tools'
import { isCurrentUserPremium } from '@/lib/user-service'

/**
 * Obtém ou cria projeção IBOV para um período (WEEKLY, MONTHLY, ANNUAL)
 */
export async function getOrCreateIbovProjection(period: 'WEEKLY' | 'MONTHLY' | 'ANNUAL') {
  try {
    const now = new Date()

    // Verificar se existe projeção válida
    // @ts-ignore - Prisma Client será gerado após migração
    const existingProjection = await prisma.ibovProjection.findFirst({
      where: {
        period,
        validUntil: {
          gt: now
        }
      },
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
          updateTime: '08:00'
        },
        currentValue,
        cached: true,
        isPremium: true
      }
    }

    // Se não existe, calcular on-demand
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
export async function calculateIbovProjection(period: 'WEEKLY' | 'MONTHLY' | 'ANNUAL') {
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

