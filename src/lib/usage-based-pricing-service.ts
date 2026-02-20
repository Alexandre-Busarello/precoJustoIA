/**
 * Serviço Unificado de Precificação por Uso
 *
 * Centraliza verificação e registro de uso de features para:
 * - Anônimos: 1 uso por feature (por IP)
 * - Gratuitos: 3 usos/mês por feature (renovação mensal)
 * - Premium: ilimitado
 */

import { prisma } from '@/lib/prisma'
import { hashIP } from '@/lib/ip-protection-service'
import { safeQueryWithParams, safeWrite } from '@/lib/prisma-wrapper'

export type UsageTier = 'ANONYMOUS' | 'FREE' | 'PREMIUM'

export interface UsageCheckResult {
  allowed: boolean
  remaining: number
  limit: number
  currentUsage: number
  shouldConvertLead: boolean
  shouldConvertPremium: boolean
  tier: UsageTier
}

// Limites por feature: [anonLimit, freeLimit]
// -1 = ilimitado, para anônimo 1 = uso único total
// anon_full_view: 2 usos totais por IP (empresa + BDR + comparador combinados)
const FEATURE_LIMITS: Record<string, { anonLimit: number; freeLimit: number }> = {
  anon_full_view: { anonLimit: 2, freeLimit: -1 }, // Apenas para anônimos; free/premium usam sessão
  company_full_view: { anonLimit: 1, freeLimit: 3 },
  ranking_create: { anonLimit: 1, freeLimit: 3 },
  comparator_use: { anonLimit: 1, freeLimit: 3 },
  backtest_run: { anonLimit: 1, freeLimit: 1 },
  screening_run: { anonLimit: 1, freeLimit: 3 },
}

const ANON_RESOURCE_PLACEHOLDER = ''

function normalizeResourceId(feature: string, resourceId?: string | null): string | null {
  if (resourceId != null && resourceId !== '') return resourceId
  return null
}

function getAnonResourceId(feature: string, resourceId?: string | null): string {
  const normalized = normalizeResourceId(feature, resourceId)
  return normalized ?? ANON_RESOURCE_PLACEHOLDER
}

/**
 * Verifica se pode usar a feature e, se permitido, registra o uso.
 * Para anônimos: resourceId vazio = 1 uso total por feature; com resourceId = 1 por recurso (ex: ticker).
 */
export async function checkAndRecordUsage(params: {
  userId?: string | null
  ip?: string
  feature: string
  resourceId?: string | null
  recordUsage?: boolean
}): Promise<UsageCheckResult> {
  const { userId, ip, feature, resourceId, recordUsage = true } = params

  const limits = FEATURE_LIMITS[feature]
  if (!limits) {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      currentUsage: 0,
      shouldConvertLead: false,
      shouldConvertPremium: false,
      tier: 'PREMIUM',
    }
  }

  // anon_full_view: apenas para anônimos; usuários logados sempre têm acesso completo
  if (userId && feature === 'anon_full_view') {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      currentUsage: 0,
      shouldConvertLead: false,
      shouldConvertPremium: false,
      tier: 'PREMIUM',
    }
  }

  // Premium: sempre permitir (não registrar uso)
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        premiumExpiresAt: true,
        trialStartedAt: true,
        trialEndsAt: true,
        bonusUsageCredits: true,
      },
    });

    if (user) {
      const now = new Date()
      const hasPremium =
        user.subscriptionTier === 'PREMIUM' &&
        (!user.premiumExpiresAt || user.premiumExpiresAt > now)
      const hasTrial =
        user.trialStartedAt &&
        user.trialEndsAt &&
        new Date(user.trialEndsAt) > new Date(user.trialStartedAt) &&
        new Date(user.trialEndsAt) > now

      if (hasPremium || hasTrial) {
        return {
          allowed: true,
          remaining: -1,
          limit: -1,
          currentUsage: 0,
          shouldConvertLead: false,
          shouldConvertPremium: false,
          tier: 'PREMIUM',
        }
      }

      // Free: verificar FeatureUsage + bonusUsageCredits
      const freeLimit = limits.freeLimit
      const month = now.getMonth() + 1
      const year = now.getFullYear()

      const usageCount = await safeQueryWithParams(
        'usage-count-free',
        () =>
          prisma.featureUsage.count({
            where: {
              userId: userId!,
              feature,
              month,
              year,
            },
          }),
        { userId, feature, month, year }
      )

      const bonusCredits = user.bonusUsageCredits ?? 0
      const effectiveLimit = freeLimit + bonusCredits
      const remaining = Math.max(0, effectiveLimit - usageCount)
      const allowed = usageCount < effectiveLimit

      if (allowed && recordUsage) {
        await recordFreeUsage(userId!, feature, resourceId)
      }

      return {
        allowed,
        remaining,
        limit: effectiveLimit,
        currentUsage: usageCount,
        shouldConvertLead: false,
        shouldConvertPremium: !allowed,
        tier: 'FREE',
      }
    }
  }

  // Anônimo: verificar AnonymousFeatureUsage por IP
  const ipHash = ip ? hashIP(ip) : null
  if (!ipHash) {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      currentUsage: 0,
      shouldConvertLead: false,
      shouldConvertPremium: false,
      tier: 'ANONYMOUS',
    }
  }

  const anonResourceId = getAnonResourceId(feature, resourceId)
  const anonLimit = limits.anonLimit

  // anon_full_view: contar total por IP (qualquer resourceId); demais features: por resourceId
  const countWhere =
    feature === 'anon_full_view'
      ? { ipHash, feature }
      : { ipHash, feature, resourceId: anonResourceId }

  const existingCount = await safeQueryWithParams(
    'usage-count-anon',
    () => prisma.anonymousFeatureUsage.count({ where: countWhere }),
    { ipHash, feature }
  )

  const remaining = Math.max(0, anonLimit - existingCount)
  const allowed = existingCount < anonLimit

  if (allowed && recordUsage) {
    await recordAnonymousUsage(
      ipHash,
      feature,
      anonResourceId === ANON_RESOURCE_PLACEHOLDER ? ANON_RESOURCE_PLACEHOLDER : anonResourceId
    )
  }

  return {
    allowed,
    remaining,
    limit: anonLimit,
    currentUsage: existingCount,
    shouldConvertLead: !allowed,
    shouldConvertPremium: false,
    tier: 'ANONYMOUS',
  }
}

/**
 * Apenas verifica uso sem registrar (para checagem prévia).
 */
export async function checkUsage(params: {
  userId?: string | null
  ip?: string
  feature: string
  resourceId?: string | null
}): Promise<UsageCheckResult> {
  return checkAndRecordUsage({ ...params, recordUsage: false })
}

async function recordFreeUsage(
  userId: string,
  feature: string,
  resourceId?: string | null
): Promise<void> {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const normalizedResId = normalizeResourceId(feature, resourceId)

  // Para company_full_view: usar ticker com upsert (evitar duplicata por mesmo ticker). Para outras: id único.
  const resourceIdForRecord =
    normalizedResId ?? `usage_${Date.now()}_${Math.random().toString(36).slice(2)}`

  if (normalizedResId != null) {
    await safeWrite(
      'record-free-usage-upsert',
      () =>
        prisma.featureUsage.upsert({
          where: {
            feature_usage_unique: {
              userId,
              feature,
              resourceId: normalizedResId,
              month,
              year,
            },
          },
          create: {
            userId,
            feature,
            resourceId: resourceIdForRecord,
            month,
            year,
          },
          update: { usedAt: now },
        }),
      ['feature_usage']
    )
  } else {
    await safeWrite(
      'record-free-usage-create',
      () =>
        prisma.featureUsage.create({
          data: {
            userId,
            feature,
            resourceId: resourceIdForRecord,
            month,
            year,
          },
        }),
      ['feature_usage']
    )
  }

  // Consumir bonus se existir
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bonusUsageCredits: true },
  })
  if (user && (user.bonusUsageCredits ?? 0) > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { bonusUsageCredits: Math.max(0, (user.bonusUsageCredits ?? 0) - 1) },
    })
  }
}

async function recordAnonymousUsage(
  ipHash: string,
  feature: string,
  resourceId: string
): Promise<void> {
  const now = new Date()
  const resourceIdValue = resourceId === ANON_RESOURCE_PLACEHOLDER ? null : resourceId

  if (feature === 'anon_full_view' && resourceIdValue) {
    // Upsert: revisitar mesmo recurso não incrementa contagem
    await safeWrite(
      'record-anon-usage-upsert',
      () =>
        prisma.anonymousFeatureUsage.upsert({
          where: {
            anonymous_feature_usage_unique: {
              ipHash,
              feature,
              resourceId: resourceIdValue,
            },
          },
          create: {
            ipHash,
            feature,
            resourceId: resourceIdValue,
          },
          update: { usedAt: now },
        }),
      ['anonymous_feature_usage']
    )
  } else {
    await safeWrite(
      'record-anon-usage',
      () =>
        prisma.anonymousFeatureUsage.create({
          data: {
            ipHash,
            feature,
            resourceId: resourceIdValue,
          },
        }),
      ['anonymous_feature_usage']
    )
  }
}

/**
 * Lista features suportadas pelo serviço.
 */
export function getSupportedFeatures(): string[] {
  return Object.keys(FEATURE_LIMITS)
}
