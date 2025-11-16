/**
 * Verificação simples de Premium
 * DEPRECATED: Use isUserPremium() do user-service.ts que é a fonte única da verdade
 * Mantido para compatibilidade, mas agora usa user-service.ts internamente
 * 
 * Esta função agora inclui verificação de trial ativo também
 */
export async function isUserPremium(userId: string): Promise<boolean> {
  try {
    // Usar a fonte única da verdade do user-service.ts
    const { isUserPremium: checkPremium } = await import('@/lib/user-service')
    return await checkPremium(userId)
  } catch (error) {
    console.error('Erro ao verificar premium:', error)
    return false
  }
}
