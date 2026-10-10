/**
 * Serviço para rastrear interações do usuário com o Ben
 */

import { prisma } from './prisma'
import type { BenPageContext } from './ben-context/types'

export interface BenInteractionState {
  hasInteracted: boolean
  lastInteractionAt: Date | null
  interactionCount: number
  firstInteractionAt: Date | null
}

/**
 * Obtém o estado de interação do usuário com o Ben
 */
export async function getUserBenInteractionState(userId: string): Promise<BenInteractionState> {
  try {
    // Buscar primeira e última conversa do usuário
    const [firstConversation, lastConversation, conversationCount, messageCount] = await Promise.all([
      prisma.benConversation.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      }),
      prisma.benConversation.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
      }),
      prisma.benConversation.count({
        where: { userId }
      }),
      prisma.benMessage.count({
        where: {
          conversation: {
            userId
          },
          role: 'USER' // Contar apenas mensagens do usuário
        }
      })
    ])

    return {
      hasInteracted: conversationCount > 0,
      lastInteractionAt: lastConversation?.updatedAt || null,
      interactionCount: messageCount,
      firstInteractionAt: firstConversation?.createdAt || null
    }
  } catch (error) {
    console.error('[Ben Interaction] Erro ao obter estado de interação:', error)
    return {
      hasInteracted: false,
      lastInteractionAt: null,
      interactionCount: 0,
      firstInteractionAt: null
    }
  }
}

/**
 * Registra uma nova interação do usuário com o Ben
 * (chamado quando usuário envia uma mensagem)
 */
export async function recordBenInteraction(userId: string): Promise<void> {
  try {
    // A interação já está registrada através da criação/atualização de conversas e mensagens
    // Esta função pode ser usada para futuras análises ou métricas adicionais
    // Por enquanto, não precisamos fazer nada adicional
  } catch (error) {
    console.error('[Ben Interaction] Erro ao registrar interação:', error)
  }
}

/**
 * Determina se deve mostrar mensagem proativa baseado no estado do usuário e contexto da página
 */
export async function shouldShowProactiveMessage(
  userId: string,
  pageContext?: BenPageContext
): Promise<{ shouldShow: boolean; messageType: 'first_time' | 'inactive' | 'contextual' | null }> {
  try {
    const state = await getUserBenInteractionState(userId)

    // Primeira vez - nunca interagiu
    if (!state.hasInteracted) {
      return {
        shouldShow: true,
        messageType: 'first_time'
      }
    }

    // Inativo - não interage há mais de 7 dias
    if (state.lastInteractionAt) {
      const daysSinceLastInteraction = Math.floor(
        (Date.now() - state.lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24)
      )
      
      if (daysSinceLastInteraction >= 7) {
        return {
          shouldShow: true,
          messageType: 'inactive'
        }
      }
    }

    // Contextual - página de um ativo, se não interagiu nas últimas 24h
    if (pageContext?.kind === 'asset') {
      const hoursSinceLastInteraction = state.lastInteractionAt
        ? Math.floor((Date.now() - state.lastInteractionAt.getTime()) / (1000 * 60 * 60))
        : Infinity
      if (hoursSinceLastInteraction >= 24) {
        return {
          shouldShow: true,
          messageType: 'contextual'
        }
      }
    }

    return {
      shouldShow: false,
      messageType: null
    }
  } catch (error) {
    console.error('[Ben Interaction] Erro ao verificar mensagem proativa:', error)
    return {
      shouldShow: false,
      messageType: null
    }
  }
}

/**
 * Gera mensagem proativa baseada no tipo
 */
export function generateProactiveMessage(
  messageType: 'first_time' | 'inactive' | 'contextual',
  pageContext?: BenPageContext
): { title: string; message: string; cta: string } {
  switch (messageType) {
    case 'first_time':
      return {
        title: 'Olá, sou o Ben',
        message: 'Explico os números da plataforma: preço justo por modelo, fundamentos, dividendos, análise técnica e projeções do Ibovespa. Não é recomendação de investimento.',
        cta: 'Começar conversa'
      }

    case 'inactive':
      return {
        title: 'Faz um tempo que não conversamos',
        message: 'Quer que eu explique algo da plataforma hoje? Posso ajudar com análises de ativos, projeções e dúvidas sobre os modelos.',
        cta: 'Conversar agora'
      }

    case 'contextual': {
      if (pageContext?.kind !== 'asset') {
        return {
          title: 'Precisa de ajuda?',
          message: 'Posso explicar o que está nesta página ou responder dúvidas sobre os modelos da plataforma.',
          cta: 'Conversar com o Ben'
        }
      }
      const displayName = pageContext.companyName || pageContext.ticker
      if (pageContext.section === 'technical') {
        return {
          title: 'Análise técnica',
          message: `Está vendo a análise técnica de ${displayName}. Quer que eu explique algum indicador?`,
          cta: 'Perguntar ao Ben'
        }
      }
      if (pageContext.section === 'dividends') {
        return {
          title: 'Dividendos',
          message: `Está vendo as projeções de dividendos de ${displayName}. Posso explicar a sustentabilidade dos pagamentos ou comparar com outras empresas.`,
          cta: 'Conversar sobre dividendos'
        }
      }
      return {
        title: `Análise de ${displayName}`,
        message: `Quer um resumo de ${displayName}? Explico fundamentos, preço justo por modelo, dividendos e análise técnica.`,
        cta: 'Perguntar ao Ben'
      }
    }

    default:
      return {
        title: 'Olá',
        message: 'Como posso ajudar você hoje?',
        cta: 'Conversar'
      }
  }
}
