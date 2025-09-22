import { prisma } from '@/lib/prisma'

/**
 * Verificação simples de Premium - apenas verifica o subscriptionTier no banco
 */
export async function isUserPremium(userId: string): Promise<boolean> {
  try {
    console.log('🔍 isUserPremium - Procurando usuário com ID:', userId)
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        subscriptionTier: true,
        premiumExpiresAt: true
      }
    })

    console.log('👤 isUserPremium - Usuário encontrado:', user)

    if (!user) {
      console.log('❌ isUserPremium - Usuário não encontrado')
      return false
    }

    // Se o tier é PREMIUM, verificar se não expirou
    if (user.subscriptionTier === 'PREMIUM') {
      // Se não tem data de expiração, considerar como válido
      if (!user.premiumExpiresAt) {
        return true
      }
      
      // Se tem data de expiração, verificar se ainda é válida
      return user.premiumExpiresAt > new Date()
    }

    return false
  } catch (error) {
    console.error('Erro ao verificar premium simples:', error)
    return false
  }
}
