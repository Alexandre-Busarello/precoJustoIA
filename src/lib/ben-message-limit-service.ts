/**
 * Serviço para verificar limite de mensagens do Ben para usuários gratuitos
 */

import { prisma } from './prisma'
import { isUserPremium } from './user-service'

export interface BenMessageLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  currentUsage: number
}

/**
 * Verifica se o usuário pode enviar mensagens ao Ben
 * Limite: 2 mensagens por dia para usuários gratuitos, ilimitado para premium
 * 
 * @param userId - ID do usuário
 * @returns Resultado com informações sobre limite e uso atual
 */
export async function checkBenMessageLimit(userId: string): Promise<BenMessageLimitResult> {
  try {
    // Verificar se usuário é premium (pular cache para garantir dados atualizados)
    const isPremium = await isUserPremium(userId, true) // skipCache = true
    
    // Log para debug em produção
    console.log(`[Ben Message Limit] User ${userId} - Premium: ${isPremium}`)
    
    // Premium: sem limite
    if (isPremium) {
      console.log(`[Ben Message Limit] User ${userId} é premium - acesso ilimitado`)
      return {
        allowed: true,
        remaining: -1, // -1 indica ilimitado
        limit: -1,
        currentUsage: 0
      }
    }

    // Free: limite de 2 mensagens por dia
    const limit = 2

    // Obter início do dia atual no timezone do Brasil (America/Sao_Paulo)
    const now = new Date()
    const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const startOfDay = new Date(brazilTime)
    startOfDay.setHours(0, 0, 0, 0)
    startOfDay.setMinutes(0)
    startOfDay.setSeconds(0)
    startOfDay.setMilliseconds(0)
    
    // Converter de volta para UTC para consulta no banco
    const startOfDayUTC = new Date(startOfDay.toLocaleString('en-US', { timeZone: 'UTC' }))
    
    // Contar mensagens do usuário enviadas hoje (role: USER)
    const currentUsage = await prisma.benMessage.count({
      where: {
        conversation: {
          userId
        },
        role: 'USER',
        createdAt: {
          gte: startOfDayUTC
        }
      }
    })

    const remaining = Math.max(0, limit - currentUsage)
    const allowed = currentUsage < limit

    console.log(`[Ben Message Limit] User ${userId} - Usage: ${currentUsage}/${limit}, Allowed: ${allowed}, Remaining: ${remaining}`)

    return {
      allowed,
      remaining,
      limit,
      currentUsage
    }
  } catch (error) {
    console.error('[Ben Message Limit] Erro ao verificar limite:', error)
    console.error('[Ben Message Limit] Stack trace:', error instanceof Error ? error.stack : 'N/A')
    // Em caso de erro, permitir (fail open)
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      currentUsage: 0
    }
  }
}


