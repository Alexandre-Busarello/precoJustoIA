/**
 * Serviço para rastrear interações do usuário com o Ben
 */

import { prisma } from './prisma'
import type { PageContext } from './ben-page-context'

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
  pageContext?: PageContext
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

    // Contextual - baseado na página atual
    if (pageContext) {
      const { pageType, ticker } = pageContext
      
      // Se está em uma página específica de ação/BDR/análise técnica, pode sugerir perguntas
      if ((pageType === 'action' || pageType === 'bdr' || pageType === 'technical_analysis' || pageType === 'dividend_radar') && ticker) {
        // Mostrar apenas se não interagiu recentemente (últimas 24h)
        if (state.lastInteractionAt) {
          const hoursSinceLastInteraction = Math.floor(
            (Date.now() - state.lastInteractionAt.getTime()) / (1000 * 60 * 60)
          )
          
          if (hoursSinceLastInteraction >= 24) {
            return {
              shouldShow: true,
              messageType: 'contextual'
            }
          }
        } else {
          return {
            shouldShow: true,
            messageType: 'contextual'
          }
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
  pageContext?: PageContext
): { title: string; message: string; cta: string } {
  switch (messageType) {
    case 'first_time':
      return {
        title: 'Olá! Sou o Ben',
        message: 'Sou seu assistente de investimentos. Posso ajudar com análises fundamentalistas, projeções do IBOVESPA, análise técnica e responder suas dúvidas sobre o mercado brasileiro.',
        cta: 'Começar conversa'
      }
    
    case 'inactive':
      return {
        title: 'Faz um tempo que não conversamos!',
        message: 'Quer que eu analise algo para você hoje? Posso ajudar com análises, projeções ou responder suas dúvidas sobre investimentos.',
        cta: 'Conversar agora'
      }
    
    case 'contextual':
      const { pageType, ticker } = pageContext || {}
      const companyName = (pageContext as any)?.companyName
      const displayName = companyName || ticker || 'esta empresa'
      
      if (pageType === 'technical_analysis') {
        return {
          title: 'Análise Técnica',
          message: `Vejo que você está analisando a análise técnica de ${displayName}. Quer que eu explique algum indicador ou ajude a interpretar os sinais?`,
          cta: 'Perguntar ao Ben'
        }
      } else if (pageType === 'dividend_radar') {
        return {
          title: 'Dividendos',
          message: `Está analisando as projeções de dividendos de ${displayName}. Posso ajudar a avaliar a sustentabilidade dos pagamentos ou comparar com outras empresas.`,
          cta: 'Conversar sobre dividendos'
        }
      } else if (pageType === 'action' || pageType === 'bdr') {
        return {
          title: `Análise de ${displayName}`,
          message: `Quer que eu faça uma análise completa de ${displayName}? Posso avaliar fundamentos, análise técnica, dividendos e muito mais.`,
          cta: 'Analisar com Ben'
        }
      }
      
      return {
        title: 'Precisa de ajuda?',
        message: 'Posso ajudar com análises, projeções ou responder suas dúvidas sobre investimentos.',
        cta: 'Conversar com Ben'
      }
    
    default:
      return {
        title: 'Olá!',
        message: 'Como posso ajudar você hoje?',
        cta: 'Conversar'
      }
  }
}

