import { prisma } from '@/lib/prisma'
import { safeQueryWithParams, safeWrite } from '@/lib/prisma-wrapper'

/**
 * SERVIÇO PARA EARLY ADOPTERS
 * 
 * Mantém apenas funcionalidades relacionadas a Early Adopters.
 * A fase sempre é PROD agora.
 */

export type LaunchPhase = 'PROD'

/**
 * Verifica se estamos em produção normal
 * Sempre retorna true agora que removemos ALFA e BETA
 */
export function isProdPhase(): boolean {
  return true
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
