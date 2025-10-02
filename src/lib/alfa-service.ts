import { prisma } from '@/lib/prisma'
import { safeQueryWithParams, safeWrite } from '@/lib/prisma-wrapper'

/**
 * SERVIÇO CENTRALIZADO PARA CONTROLE DA FASE ALFA
 * 
 * Gerencia todas as funcionalidades específicas da fase Alfa:
 * - Controle de limite de usuários
 * - Lista de interesse (waitlist)
 * - Verificação de usuários inativos
 * - Exceções para Early Adopters
 */

export type LaunchPhase = 'ALFA' | 'BETA' | 'PROD'

export interface AlfaConfig {
  phase: LaunchPhase
  userLimit: number
  endDate: Date
}

/**
 * Obtém a configuração atual da fase Alfa
 */
export function getAlfaConfig(): AlfaConfig {
  const phase = (process.env.LAUNCH_PHASE as LaunchPhase) || 'PROD'
  const userLimit = parseInt(process.env.ALFA_USER_LIMIT || '500')
  const endDate = new Date(process.env.ALFA_END_DATE || '2025-12-31')
  
  return {
    phase,
    userLimit,
    endDate
  }
}

/**
 * Verifica se estamos na fase Alfa
 */
export function isAlfaPhase(): boolean {
  return getAlfaConfig().phase === 'ALFA'
}

/**
 * Verifica se estamos na fase Beta
 */
export function isBetaPhase(): boolean {
  return getAlfaConfig().phase === 'BETA'
}

/**
 * Verifica se estamos em produção normal
 */
export function isProdPhase(): boolean {
  return getAlfaConfig().phase === 'PROD'
}

/**
 * Conta o número atual de usuários registrados (excluindo Early Adopters e inativos)
 */
export async function getCurrentUserCount(): Promise<number> {
  return await safeQueryWithParams(
    'user-count-active',
    () => prisma.user.count({
      where: {
        isEarlyAdopter: false,
        isInactive: false
      }
    }),
    { isEarlyAdopter: false, isInactive: false }
  ) as number
}

/**
 * Verifica se o limite de usuários foi atingido
 */
export async function isUserLimitReached(): Promise<boolean> {
  if (!isAlfaPhase()) {
    return false
  }
  
  const config = getAlfaConfig()
  const currentCount = await getCurrentUserCount()
  
  return currentCount >= config.userLimit
}

/**
 * Verifica se um usuário pode se cadastrar
 * - Se não for fase Alfa: sempre pode
 * - Se for Early Adopter: sempre pode
 * - Se limite não foi atingido: pode
 * - Caso contrário: não pode
 */
export async function canUserRegister(isEarlyAdopter: boolean = false): Promise<boolean> {
  if (!isAlfaPhase()) {
    return true
  }
  
  if (isEarlyAdopter) {
    return true
  }
  
  return !(await isUserLimitReached())
}

/**
 * Adiciona um usuário à lista de interesse
 */
export async function addToWaitlist(name: string, email: string): Promise<boolean> {
  try {
    await safeWrite(
      'add-to-waitlist',
      () => prisma.alfaWaitlist.create({
        data: {
          name,
          email
        }
      }),
      ['alfa_waitlist']
    )
    return true
  } catch (error) {
    // Se email já existe, ignora o erro
    console.error('Erro ao adicionar à lista de interesse:', error)
    return false
  }
}

/**
 * Obtém o próximo usuário da lista de interesse para ser convidado
 */
export async function getNextWaitlistUser() {
  return await safeQueryWithParams(
    'next-waitlist-user',
    () => prisma.alfaWaitlist.findFirst({
      where: {
        isInvited: false
      },
      orderBy: {
        createdAt: 'asc'
      }
    }),
    { isInvited: false }
  ) as any
}

/**
 * Marca um usuário da lista como convidado
 */
export async function markAsInvited(waitlistId: string): Promise<void> {
  await safeWrite(
    'mark-waitlist-invited',
    () => prisma.alfaWaitlist.update({
      where: { id: waitlistId },
      data: {
        isInvited: true,
        invitedAt: new Date()
      }
    }),
    ['alfa_waitlist']
  )
}

/**
 * Encontra usuários inativos há mais de 15 dias (que ainda não foram marcados como inativos)
 */
export async function findInactiveUsers(): Promise<string[]> {
  const fifteenDaysAgo = new Date()
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
  
  const inactiveUsers = await safeQueryWithParams(
    'find-inactive-users',
    () => prisma.user.findMany({
      where: {
        isEarlyAdopter: false,
        isInactive: false, // Apenas usuários que ainda não foram marcados como inativos
        OR: [
          {
            lastLoginAt: {
              lt: fifteenDaysAgo
            }
          },
          {
            lastLoginAt: null,
            // Se nunca fez login, considera a data de verificação do email
            emailVerified: {
              lt: fifteenDaysAgo
            }
          }
        ]
      },
      select: {
        id: true,
        email: true
      }
    }),
    { 
      isEarlyAdopter: false, 
      isInactive: false, 
      cutoffDate: fifteenDaysAgo.toISOString() 
    }
  ) as Array<{ id: string; email: string }>
  
  return inactiveUsers.map((user: { id: string; email: string }) => user.id)
}

/**
 * Marca um usuário como inativo (ao invés de deletar) e convida o próximo da lista
 */
export async function processInactiveUser(userId: string): Promise<boolean> {
  try {
    // Marcar usuário como inativo ao invés de deletar
    await safeWrite(
      'mark-user-inactive',
      () => prisma.user.update({
        where: { id: userId },
        data: {
          isInactive: true,
          inactivatedAt: new Date()
        }
      }),
      ['users']
    )
    
    // Convida o próximo da lista
    const nextUser = await getNextWaitlistUser()
    if (nextUser) {
      await markAsInvited(nextUser.id)
      // Aqui você pode implementar o envio de email de convite
      console.log(`Usuário ${nextUser.email} foi convidado da lista de interesse`)
    }
    
    return true
  } catch (error) {
    console.error('Erro ao processar usuário inativo:', error)
    return false
  }
}

/**
 * Atualiza o último login do usuário e reativa se estava inativo
 */
export async function updateLastLogin(userId: string): Promise<void> {
  try {
    // Primeiro verificar se o usuário existe
    const userExists = await safeQueryWithParams(
      'check-user-exists',
      () => prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      }),
      { userId }
    ) as { id: string } | null

    if (!userExists) {
      console.warn(`⚠️ Tentativa de atualizar login para usuário inexistente: ${userId}`)
      return
    }

    await safeWrite(
      'update-last-login',
      () => prisma.user.update({
        where: { id: userId },
        data: {
          lastLoginAt: new Date(),
          // Reativar usuário se estava inativo
          isInactive: false,
          inactivatedAt: null
        }
      }),
      ['users']
    )
  } catch (error) {
    console.error('Erro ao atualizar último login:', error)
  }
}

/**
 * Reativa um usuário que estava marcado como inativo
 */
export async function reactivateUser(userId: string): Promise<boolean> {
  try {
    await safeWrite(
      'reactivate-user',
      () => prisma.user.update({
        where: { id: userId },
        data: {
          isInactive: false,
          inactivatedAt: null,
          lastLoginAt: new Date()
        }
      }),
      ['users']
    )
    return true
  } catch (error) {
    console.error('Erro ao reativar usuário:', error)
    return false
  }
}

/**
 * Marca um usuário como Early Adopter
 */
export async function markAsEarlyAdopter(userId: string): Promise<void> {
  await safeWrite(
    'mark-early-adopter',
    () => prisma.user.update({
      where: { id: userId },
      data: {
        isEarlyAdopter: true,
        earlyAdopterDate: new Date()
      }
    }),
    ['users']
  )
}

/**
 * Verifica se um usuário é Early Adopter
 */
export async function isEarlyAdopter(userId: string): Promise<boolean> {
  const user = await safeQueryWithParams(
    'check-early-adopter',
    () => prisma.user.findUnique({
      where: { id: userId },
      select: { isEarlyAdopter: true }
    }),
    { userId }
  ) as { isEarlyAdopter: boolean } | null
  
  return user?.isEarlyAdopter || false
}

/**
 * Obtém estatísticas da fase Alfa
 */
export async function getAlfaStats() {
  const config = getAlfaConfig()
  const currentUsers = await getCurrentUserCount()
  
  const [earlyAdopters, inactiveUsers, waitlistCount] = await Promise.all([
    safeQueryWithParams(
      'count-early-adopters',
      () => prisma.user.count({
        where: { isEarlyAdopter: true }
      }),
      { isEarlyAdopter: true }
    ),
    safeQueryWithParams(
      'count-inactive-users',
      () => prisma.user.count({
        where: { 
          isInactive: true,
          isEarlyAdopter: false
        }
      }),
      { isInactive: true, isEarlyAdopter: false }
    ),
    safeQueryWithParams(
      'count-waitlist',
      () => prisma.alfaWaitlist.count({
        where: { isInvited: false }
      }),
      { isInvited: false }
    )
  ]) as [number, number, number]
  
  return {
    phase: config.phase,
    userLimit: config.userLimit,
    endDate: config.endDate,
    currentUsers,
    earlyAdopters,
    inactiveUsers,
    waitlistCount,
    spotsAvailable: Math.max(0, config.userLimit - currentUsers),
    isLimitReached: currentUsers >= config.userLimit
  }
}
