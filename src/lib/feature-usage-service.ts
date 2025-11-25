/**
 * Serviço Genérico de Uso de Features
 * Gerencia limites e rastreamento de uso de features para usuários gratuitos
 */

import { prisma } from '@/lib/prisma'

export interface FeatureLimit {
  feature: string
  freeLimit: number // Limite para usuários gratuitos (por mês)
  premiumLimit?: number | null // Limite para usuários premium (opcional, null = ilimitado)
}

// Configuração de limites por feature
const FEATURE_LIMITS: Record<string, FeatureLimit> = {
  technical_analysis: {
    feature: 'technical_analysis',
    freeLimit: 3, // 3 análises técnicas por mês para usuários gratuitos
    premiumLimit: null // Ilimitado para premium
  },
  // Adicionar outras features aqui no futuro
  // ai_report: { feature: 'ai_report', freeLimit: 1, premiumLimit: null },
  // backtest: { feature: 'backtest', freeLimit: 5, premiumLimit: null },
}

export interface UsageCheckResult {
  allowed: boolean
  remaining: number
  limit: number
  currentUsage: number
}

/**
 * Verifica se o usuário pode usar uma feature baseado em seus limites
 */
export async function checkFeatureUsage(
  userId: string,
  feature: string,
  resourceId?: string | null
): Promise<UsageCheckResult> {
  const limitConfig = FEATURE_LIMITS[feature]
  
  if (!limitConfig) {
    // Se não há configuração de limite, permitir uso
    return {
      allowed: true,
      remaining: -1, // -1 indica ilimitado
      limit: -1,
      currentUsage: 0
    }
  }

  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const year = now.getFullYear()

  // Buscar uso atual do mês
  const currentUsage = await prisma.featureUsage.count({
    where: {
      userId,
      feature,
      month,
      year,
      ...(resourceId ? { resourceId } : {})
    }
  })

  // Verificar se usuário é premium (precisamos buscar do banco)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      premiumExpiresAt: true,
      trialStartedAt: true,
      trialEndsAt: true
    }
  })

  const isPremium = user && (
    (user.subscriptionTier === 'PREMIUM' && (!user.premiumExpiresAt || user.premiumExpiresAt > now)) ||
    (user.trialStartedAt && user.trialEndsAt && 
     new Date(user.trialEndsAt) > new Date(user.trialStartedAt) &&
     new Date(user.trialEndsAt) > now)
  )

  // Se for premium e não houver limite premium, permitir
  if (isPremium && limitConfig.premiumLimit === null) {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      currentUsage
    }
  }

  // Aplicar limite apropriado
  const limit = isPremium && limitConfig.premiumLimit !== null && limitConfig.premiumLimit !== undefined
    ? limitConfig.premiumLimit 
    : limitConfig.freeLimit

  const remaining = Math.max(0, limit - currentUsage)
  const allowed = currentUsage < limit

  return {
    allowed,
    remaining,
    limit: limit ?? -1,
    currentUsage
  }
}

/**
 * Registra o uso de uma feature
 */
export async function recordFeatureUsage(
  userId: string,
  feature: string,
  resourceId?: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  // Usar upsert para evitar duplicatas (graças ao unique constraint)
  // Prisma espera null explicitamente para campos opcionais no where
  const resourceIdForWhere = resourceId ?? null
  const resourceIdForData = resourceId ?? null
  
  await prisma.featureUsage.upsert({
    where: {
      feature_usage_unique: {
        userId,
        feature,
        resourceId: resourceIdForWhere as string,
        month,
        year
      }
    },
    create: {
      userId,
      feature,
      resourceId: resourceIdForData,
      usedAt: now,
      month,
      year,
      metadata: metadata ?? undefined
    },
    update: {
      usedAt: now, // Atualizar timestamp se já existir
      metadata: metadata ?? undefined
    }
  })
}

/**
 * Obtém o uso mensal de uma feature para um usuário
 */
export async function getMonthlyUsage(
  userId: string,
  feature: string,
  month?: number,
  year?: number
): Promise<number> {
  const now = new Date()
  const targetMonth = month || now.getMonth() + 1
  const targetYear = year || now.getFullYear()

  return prisma.featureUsage.count({
    where: {
      userId,
      feature,
      month: targetMonth,
      year: targetYear
    }
  })
}

/**
 * Obtém histórico de uso de uma feature
 */
export async function getFeatureUsageHistory(
  userId: string,
  feature: string,
  limit: number = 30
): Promise<Array<{
  id: string
  resourceId: string | null
  usedAt: Date
  metadata: any
}>> {
  const usages = await prisma.featureUsage.findMany({
    where: {
      userId,
      feature
    },
    orderBy: {
      usedAt: 'desc'
    },
    take: limit,
    select: {
      id: true,
      resourceId: true,
      usedAt: true,
      metadata: true
    }
  })

  return usages
}

