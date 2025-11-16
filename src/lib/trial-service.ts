import { prisma } from '@/lib/prisma'
import { safeQueryWithParams, safeWrite } from '@/lib/prisma-wrapper'
import { isProdPhase } from './alfa-service'

/**
 * SERVIÇO CENTRALIZADO PARA CONTROLE DE TRIAL PREMIUM
 * 
 * Gerencia todas as funcionalidades relacionadas ao trial de 7 dias:
 * - Início de trial para novos usuários
 * - Verificação de trial ativo
 * - Cálculo de dias restantes
 * - Controle via variável de ambiente
 */

const TRIAL_DURATION_DAYS = 7

/**
 * Verifica se a feature de trial está habilitada via ENV
 */
export function isTrialEnabled(): boolean {
  return process.env.ENABLE_TRIAL === 'true'
}

/**
 * Verifica se um usuário pode receber trial
 * - Trial só pode ser iniciado uma vez por usuário
 * - Trial só é iniciado quando fase PROD começar (não durante ALFA)
 * - Feature deve estar habilitada via ENV (mas usuários em trial continuam mesmo se desativado)
 */
export async function shouldStartTrial(userId: string): Promise<boolean> {
  // Se não está em PROD, não iniciar trial
  if (!isProdPhase()) {
    return false
  }

  // Se feature está desabilitada, não iniciar trial para novos usuários
  // Mas usuários que já estão em trial continuam (verificado em hasActiveTrial)
  if (!isTrialEnabled()) {
    return false
  }

  // Verificar se usuário já teve trial
  const user = await safeQueryWithParams(
    'check-trial-started',
    () => prisma.user.findUnique({
      where: { id: userId },
      select: {
        trialStartedAt: true,
        subscriptionTier: true
      }
    }),
    { userId }
  ) as { trialStartedAt: Date | null; subscriptionTier: string } | null

  if (!user) {
    return false
  }

  // Se já é Premium, não precisa de trial
  if (user.subscriptionTier === 'PREMIUM') {
    return false
  }

  // Se já iniciou trial alguma vez, não pode iniciar novamente
  if (user.trialStartedAt) {
    return false
  }

  return true
}

/**
 * Inicia trial de 7 dias para um usuário
 */
export async function startTrialForUser(userId: string): Promise<boolean> {
  try {
    // Verificar se pode iniciar trial
    if (!(await shouldStartTrial(userId))) {
      return false
    }

    const now = new Date()
    // Usar setTime para evitar problemas com timezone e mudanças de mês
    const trialEndsAt = new Date(now.getTime() + (TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000))

    await safeWrite(
      'start-trial',
      () => prisma.user.update({
        where: { id: userId },
        data: {
          trialStartedAt: now,
          trialEndsAt: trialEndsAt
        }
      }),
      ['users']
    )

    return true
  } catch (error) {
    console.error('Erro ao iniciar trial:', error)
    return false
  }
}

/**
 * Verifica se um usuário tem trial ativo
 * IMPORTANTE: Esta função sempre funciona, mesmo se ENABLE_TRIAL=false
 * Isso garante que usuários que já estão em trial não sejam afetados
 */
export async function hasActiveTrial(userId: string): Promise<boolean> {
  try {
    const user = await safeQueryWithParams(
      'check-active-trial',
      () => prisma.user.findUnique({
        where: { id: userId },
        select: {
          trialStartedAt: true,
          trialEndsAt: true
        }
      }),
      { userId }
    ) as { trialStartedAt: Date | null; trialEndsAt: Date | null } | null

    if (!user || !user.trialStartedAt || !user.trialEndsAt) {
      return false
    }

    const now = new Date()
    const trialStartedAt = new Date(user.trialStartedAt)
    const trialEndsAt = new Date(user.trialEndsAt)

    // Trial está ativo se:
    // 1. trialEndsAt > trialStartedAt (datas válidas)
    // 2. trialEndsAt > now (ainda não expirou)
    return trialEndsAt > trialStartedAt && trialEndsAt > now
  } catch (error) {
    console.error('Erro ao verificar trial ativo:', error)
    return false
  }
}

/**
 * Obtém os dias restantes do trial
 * Retorna null se não há trial ativo
 */
export async function getTrialDaysRemaining(userId: string): Promise<number | null> {
  try {
    const user = await safeQueryWithParams(
      'get-trial-days',
      () => prisma.user.findUnique({
        where: { id: userId },
        select: {
          trialEndsAt: true
        }
      }),
      { userId }
    ) as { trialEndsAt: Date | null } | null

    if (!user || !user.trialEndsAt) {
      return null
    }

    const now = new Date()
    const trialEndsAt = new Date(user.trialEndsAt)

    if (trialEndsAt <= now) {
      return null
    }

    const diffTime = trialEndsAt.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return diffDays > 0 ? diffDays : null
  } catch (error) {
    console.error('Erro ao calcular dias restantes do trial:', error)
    return null
  }
}

/**
 * Obtém informações completas do trial de um usuário
 */
export async function getTrialInfo(userId: string): Promise<{
  isTrialActive: boolean
  trialStartedAt: Date | null
  trialEndsAt: Date | null
  daysRemaining: number | null
}> {
  try {
    const user = await safeQueryWithParams(
      'get-trial-info',
      () => prisma.user.findUnique({
        where: { id: userId },
        select: {
          trialStartedAt: true,
          trialEndsAt: true
        }
      }),
      { userId }
    ) as { trialStartedAt: Date | null; trialEndsAt: Date | null } | null

    if (!user || !user.trialStartedAt || !user.trialEndsAt) {
      return {
        isTrialActive: false,
        trialStartedAt: null,
        trialEndsAt: null,
        daysRemaining: null
      }
    }

    const now = new Date()
    const trialEndsAt = new Date(user.trialEndsAt)
    const isTrialActive = trialEndsAt > now

    let daysRemaining: number | null = null
    if (isTrialActive) {
      const diffTime = trialEndsAt.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      daysRemaining = diffDays > 0 ? diffDays : null
    }

    return {
      isTrialActive,
      trialStartedAt: user.trialStartedAt,
      trialEndsAt: user.trialEndsAt,
      daysRemaining
    }
  } catch (error) {
    console.error('Erro ao obter informações do trial:', error)
    return {
      isTrialActive: false,
      trialStartedAt: null,
      trialEndsAt: null,
      daysRemaining: null
    }
  }
}

/**
 * Inicia trial para todos os usuários FREE quando PROD começar
 * Esta função deve ser chamada uma vez quando a fase PROD for ativada
 */
export async function startTrialForAllFreeUsers(): Promise<number> {
  if (!isProdPhase() || !isTrialEnabled()) {
    return 0
  }

  try {
    // Buscar todos os usuários FREE que ainda não iniciaram trial
    const freeUsers = await safeQueryWithParams(
      'find-free-users-without-trial',
      () => prisma.user.findMany({
        where: {
          subscriptionTier: 'FREE',
          trialStartedAt: null
        },
        select: {
          id: true
        }
      }),
      { subscriptionTier: 'FREE' }
    ) as Array<{ id: string }>

    let startedCount = 0
    const now = new Date()
    // Usar setTime para evitar problemas com timezone e mudanças de mês
    const trialEndsAt = new Date(now.getTime() + (TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000))

    // Iniciar trial para cada usuário
    for (const user of freeUsers) {
      try {
        await safeWrite(
          'start-trial-batch',
          () => prisma.user.update({
            where: { id: user.id },
            data: {
              trialStartedAt: now,
              trialEndsAt: trialEndsAt
            }
          }),
          ['users']
        )
        startedCount++
      } catch (error) {
        console.error(`Erro ao iniciar trial para usuário ${user.id}:`, error)
      }
    }

    return startedCount
  } catch (error) {
    console.error('Erro ao iniciar trial para usuários FREE:', error)
    return 0
  }
}

