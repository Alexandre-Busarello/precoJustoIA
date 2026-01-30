import { prisma } from '@/lib/prisma'
import { safeQueryWithParams } from '@/lib/prisma-wrapper'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import type { Session } from 'next-auth'

/**
 * ÚNICA FONTE DA VERDADE PARA VERIFICAÇÕES DE USUÁRIO E PREMIUM
 * 
 * Este serviço centraliza toda a lógica de:
 * - Resolução de ID de usuário (sessão vs banco)
 * - Verificação de status Premium
 * - Verificação de trial ativo
 * - Dados do usuário
 */

export interface UserData {
  id: string
  email: string
  name?: string | null
  subscriptionTier: 'FREE' | 'PREMIUM'
  premiumExpiresAt?: Date | null
  isAdmin: boolean
  isPremium: boolean
  stripeCustomerId?: string | null
  trialStartedAt?: Date | null
  trialEndsAt?: Date | null
}

/**
 * Resolve o usuário real no banco baseado na sessão
 * Tenta primeiro pelo ID da sessão, depois pelo email como fallback
 */
export async function resolveUserFromSession(session: Session): Promise<UserData | null> {
  if (!session?.user) {
    return null
  }

  let user = null

  // Tentar primeiro pelo ID da sessão
  if (session.user.id) {
    user = await safeQueryWithParams(
      'user-by-session-id',
      () => prisma.user.findUnique({
        where: { id: session.user.id },
          select: {
            id: true,
            email: true,
            name: true,
            subscriptionTier: true,
            premiumExpiresAt: true,
            isAdmin: true,
            stripeCustomerId: true,
            trialStartedAt: true,
            trialEndsAt: true
          }
      }),
      { userId: session.user.id }
    ) as any
  }

  // Se não encontrar pelo ID, tentar pelo email
  if (!user && session.user.email) {
    user = await safeQueryWithParams(
      'user-by-session-email',
      () => prisma.user.findUnique({
        where: { email: session.user.email! },
          select: {
            id: true,
            email: true,
            name: true,
            subscriptionTier: true,
            premiumExpiresAt: true,
            isAdmin: true,
            stripeCustomerId: true,
            trialStartedAt: true,
            trialEndsAt: true
          }
      }),
      { email: session.user.email }
    ) as any
  }

  if (!user) {
    return null
  }

  // Calcular status Premium
  const now = new Date()
  const hasValidPremium = user.subscriptionTier === 'PREMIUM' && 
                         (!user.premiumExpiresAt || user.premiumExpiresAt > now)
  
  // Verificar se tem trial ativo
  // Garantir que trialEndsAt > trialStartedAt E trialEndsAt > now
  const hasTrial = user.trialStartedAt && user.trialEndsAt && 
                   new Date(user.trialEndsAt) > new Date(user.trialStartedAt) &&
                   new Date(user.trialEndsAt) > now
  
  // Trial também dá acesso Premium
  const isPremium = hasValidPremium || hasTrial

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    subscriptionTier: user.subscriptionTier,
    premiumExpiresAt: user.premiumExpiresAt,
    isAdmin: user.isAdmin,
    isPremium,
    stripeCustomerId: user.stripeCustomerId,
    trialStartedAt: user.trialStartedAt,
    trialEndsAt: user.trialEndsAt
  }
}

/**
 * Obtém dados completos do usuário atual da sessão
 */
export async function getCurrentUser(): Promise<UserData | null> {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return null
    }

    return await resolveUserFromSession(session)
  } catch (error) {
    console.error('Erro ao obter usuário atual:', error)
    return null
  }
}

/**
 * Verifica se o usuário atual é Premium
 * ÚNICA FONTE DA VERDADE para verificação Premium
 */
export async function isCurrentUserPremium(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.isPremium || false
}

/**
 * Verifica se um usuário específico é Premium (por ID ou email)
 */
export async function isUserPremium(identifier: string, skipCache: boolean = false): Promise<boolean> {
  try {
    // Tentar como ID primeiro
    let user = await safeQueryWithParams(
      'user-premium-by-id',
      () => prisma.user.findUnique({
        where: { id: identifier },
        select: {
          subscriptionTier: true,
          premiumExpiresAt: true,
          trialStartedAt: true,
          trialEndsAt: true
        }
      }),
      { identifier, type: 'id' },
      { skipCache }
    ) as any

    // Se não encontrar, tentar como email
    if (!user) {
      user = await safeQueryWithParams(
        'user-premium-by-email',
        () => prisma.user.findUnique({
          where: { email: identifier },
          select: {
            subscriptionTier: true,
            premiumExpiresAt: true,
            trialStartedAt: true,
            trialEndsAt: true
          }
        }),
        { identifier, type: 'email' },
        { skipCache }
      ) as any
    }

    if (!user) {
      console.log(`[isUserPremium] Usuário não encontrado: ${identifier}`)
      return false
    }

    const now = new Date()
    const hasValidPremium = user.subscriptionTier === 'PREMIUM' && 
                           (!user.premiumExpiresAt || user.premiumExpiresAt > now)
    
    // Verificar se tem trial ativo
    // Garantir que trialEndsAt > trialStartedAt E trialEndsAt > now
    const hasTrial = user.trialStartedAt && user.trialEndsAt &&
                     new Date(user.trialEndsAt) > new Date(user.trialStartedAt) &&
                     new Date(user.trialEndsAt) > now
    
    const isPremium = hasValidPremium || hasTrial
    
    // Log detalhado para debug
    console.log(`[isUserPremium] User ${identifier}:`, {
      subscriptionTier: user.subscriptionTier,
      premiumExpiresAt: user.premiumExpiresAt,
      trialStartedAt: user.trialStartedAt,
      trialEndsAt: user.trialEndsAt,
      now: now.toISOString(),
      hasValidPremium,
      hasTrial,
      isPremium,
      skipCache
    })
    
    // Durante a fase Alfa, todos os usuários têm acesso Premium
    // Trial também dá acesso Premium
    return isPremium
  } catch (error) {
    console.error('[isUserPremium] Erro ao verificar status Premium:', error)
    console.error('[isUserPremium] Stack trace:', error instanceof Error ? error.stack : 'N/A')
    return false
  }
}

/**
 * Middleware para APIs que requerem Premium
 * Retorna os dados do usuário se for Premium, null caso contrário
 */
export async function requirePremiumUser(): Promise<UserData | null> {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }

  if (!user.isPremium) {
    return null
  }

  return user
}

/**
 * Middleware para APIs que requerem Admin
 */
export async function requireAdminUser(): Promise<UserData | null> {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }

  if (!user.isAdmin) {
    return null
  }

  return user
}

/**
 * Obtém dados do usuário por ID (com resolução robusta)
 */
export async function getUserById(userId: string): Promise<UserData | null> {
  try {
    const user = await safeQueryWithParams(
      'user-by-id',
      () => prisma.user.findUnique({
        where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            subscriptionTier: true,
            premiumExpiresAt: true,
            isAdmin: true,
            stripeCustomerId: true,
            trialStartedAt: true,
            trialEndsAt: true
          }
      }),
      { userId }
    ) as any

    if (!user) {
      return null
    }

    const now = new Date()
    const hasValidPremium = user.subscriptionTier === 'PREMIUM' && 
                           (!user.premiumExpiresAt || user.premiumExpiresAt > now)
    
    // Verificar se tem trial ativo
    // Garantir que trialEndsAt > trialStartedAt E trialEndsAt > now
    const hasTrial = user.trialStartedAt && user.trialEndsAt &&
                     new Date(user.trialEndsAt) > new Date(user.trialStartedAt) &&
                     new Date(user.trialEndsAt) > now
    
    // Durante a fase Alfa, todos os usuários têm acesso Premium
    // Trial também dá acesso Premium
    const isPremium = hasValidPremium || hasTrial

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      subscriptionTier: user.subscriptionTier,
      premiumExpiresAt: user.premiumExpiresAt,
      isAdmin: user.isAdmin,
      isPremium,
      stripeCustomerId: user.stripeCustomerId,
      trialStartedAt: user.trialStartedAt,
      trialEndsAt: user.trialEndsAt
    }
  } catch (error) {
    console.error('Erro ao buscar usuário por ID:', error)
    return null
  }
}

/**
 * Hook para uso no frontend (client-side)
 * Retorna dados do usuário da sessão NextAuth
 */
export function useUserData() {
  // Este será implementado no frontend com useSession
  // Por enquanto, apenas definindo a interface
  return {
    user: null as UserData | null,
    loading: true,
    error: null as string | null
  }
}
