import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/user-service'
import { syncUserSubscription } from '@/lib/subscription-service'

// GET /api/debug/user-status - Debug do status do usuário
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Usar o serviço centralizado para obter o usuário válido
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Buscar dados completos do usuário no banco
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true,
        premiumExpiresAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeCurrentPeriodEnd: true,
        isAdmin: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Dados do usuário não encontrados' }, { status: 404 })
    }

    // Verificar status da assinatura
    let subscriptionStatus = null
    let premiumAccess = false
    
    try {
      subscriptionStatus = await syncUserSubscription(currentUser.id)
      premiumAccess = currentUser.isPremium || false
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error)
    }

    return NextResponse.json({
      user,
      session: {
        subscriptionTier: session.user.subscriptionTier,
        premiumExpiresAt: session.user.premiumExpiresAt
      },
      subscriptionStatus,
      premiumAccess,
      currentTime: new Date().toISOString()
    })

  } catch (error) {
    console.error('Erro no debug:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
