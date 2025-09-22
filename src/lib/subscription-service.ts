import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { SubscriptionTier } from '@prisma/client'

export interface SubscriptionStatus {
  isActive: boolean
  tier: SubscriptionTier
  expiresAt: Date | null
  stripeStatus?: string
  cancelAtPeriodEnd?: boolean
}

/**
 * Verifica o status da assinatura de um usuário no Stripe e atualiza no banco
 */
export async function syncUserSubscription(userId: string): Promise<SubscriptionStatus> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionTier: true,
        premiumExpiresAt: true,
      },
    })

    if (!user) {
      throw new Error('Usuário não encontrado')
    }

    // Se não tem subscription ID, retorna status atual
    if (!user.stripeSubscriptionId) {
      return {
        isActive: user.subscriptionTier === 'PREMIUM',
        tier: user.subscriptionTier,
        expiresAt: user.premiumExpiresAt,
      }
    }

    // Buscar dados da assinatura no Stripe
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
    
    const isActive = subscription.status === 'active'
    const tier: SubscriptionTier = isActive ? 'PREMIUM' : 'FREE'
    
    const currentPeriodEnd = (subscription as any).current_period_end
    const expiresAt = currentPeriodEnd 
      ? new Date(currentPeriodEnd * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias como fallback

    // Atualizar dados no banco se necessário
    if (user.subscriptionTier !== tier || 
        user.premiumExpiresAt?.getTime() !== expiresAt.getTime()) {
      
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionTier: tier,
          premiumExpiresAt: isActive ? expiresAt : null,
          stripeCurrentPeriodEnd: expiresAt,
          lastPremiumAt: isActive ? new Date() : user.premiumExpiresAt,
        },
      })
    }

    return {
      isActive,
      tier,
      expiresAt: isActive ? expiresAt : null,
      stripeStatus: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    }
  } catch (error) {
    console.error('Erro ao sincronizar assinatura:', error)
    
    // Em caso de erro, retorna status atual do banco
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        premiumExpiresAt: true,
      },
    })

    return {
      isActive: user?.subscriptionTier === 'PREMIUM' || false,
      tier: user?.subscriptionTier || 'FREE',
      expiresAt: user?.premiumExpiresAt || null,
    }
  }
}

/**
 * Verifica se um usuário tem acesso premium válido
 */
export async function hasValidPremiumAccess(userId: string): Promise<boolean> {
  try {
    const status = await syncUserSubscription(userId)
    
    // Se tem assinatura ativa, tem acesso
    if (status.isActive && status.expiresAt && status.expiresAt > new Date()) {
      return true
    }

    return false
  } catch (error) {
    console.error('Erro ao verificar acesso premium:', error)
    return false
  }
}

/**
 * Atualiza automaticamente o status de todos os usuários premium expirados
 */
export async function updateExpiredSubscriptions(): Promise<void> {
  try {
    const now = new Date()
    
    // Buscar usuários premium com assinatura expirada
    const expiredUsers = await prisma.user.findMany({
      where: {
        subscriptionTier: 'PREMIUM',
        premiumExpiresAt: {
          lt: now,
        },
        stripeSubscriptionId: {
          not: null,
        },
      },
      select: {
        id: true,
        stripeSubscriptionId: true,
      },
    })

    console.log(`Encontrados ${expiredUsers.length} usuários com assinatura expirada`)

    // Verificar cada usuário no Stripe
    for (const user of expiredUsers) {
      try {
        await syncUserSubscription(user.id)
        console.log(`Usuário ${user.id} sincronizado`)
      } catch (error) {
        console.error(`Erro ao sincronizar usuário ${user.id}:`, error)
      }
    }
  } catch (error) {
    console.error('Erro ao atualizar assinaturas expiradas:', error)
  }
}

/**
 * Cria um portal do cliente para gerenciar assinatura
 */
export async function createCustomerPortal(userId: string, returnUrl: string): Promise<string> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeCustomerId: true,
      },
    })

    if (!user?.stripeCustomerId) {
      throw new Error('Cliente não encontrado no Stripe')
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    })

    return session.url
  } catch (error) {
    console.error('Erro ao criar portal do cliente:', error)
    throw error
  }
}

/**
 * Cancela uma assinatura (no final do período)
 */
export async function cancelSubscription(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeSubscriptionId: true,
      },
    })

    if (!user?.stripeSubscriptionId) {
      throw new Error('Assinatura não encontrada')
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    console.log(`Assinatura ${user.stripeSubscriptionId} cancelada no final do período`)
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error)
    throw error
  }
}

/**
 * Reativa uma assinatura cancelada
 */
export async function reactivateSubscription(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeSubscriptionId: true,
      },
    })

    if (!user?.stripeSubscriptionId) {
      throw new Error('Assinatura não encontrada')
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    })

    console.log(`Assinatura ${user.stripeSubscriptionId} reativada`)
  } catch (error) {
    console.error('Erro ao reativar assinatura:', error)
    throw error
  }
}

/**
 * Middleware para verificar acesso premium em tempo real
 */
export async function requirePremiumAccess(userId: string): Promise<boolean> {
  const hasAccess = await hasValidPremiumAccess(userId)
  
  if (!hasAccess) {
    throw new Error('Acesso premium necessário')
  }
  
  return true
}
