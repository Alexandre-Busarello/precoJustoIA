import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { safeQueryWithParams } from '@/lib/prisma-wrapper'

/**
 * GET /api/profile
 * Retorna os dados completos do perfil do usuário atual
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Buscar dados completos do usuário incluindo stripeSubscriptionId
    const fullUser = await safeQueryWithParams(
      'user-profile-data',
      () => prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          subscriptionTier: true,
          premiumExpiresAt: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          stripeCurrentPeriodEnd: true,
        }
      }),
      { userId: user.id }
    ) as any

    if (!fullUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se tem assinatura ativa no Stripe
    let hasActiveSubscription = false
    let cancelAtPeriodEnd = false

    if (fullUser.stripeSubscriptionId) {
      try {
        const { stripe } = await import('@/lib/stripe')
        const subscription = await stripe.subscriptions.retrieve(fullUser.stripeSubscriptionId)
        hasActiveSubscription = subscription.status === 'active' || subscription.status === 'trialing'
        cancelAtPeriodEnd = subscription.cancel_at_period_end || false
      } catch (error) {
        console.error('Erro ao verificar assinatura Stripe:', error)
        // Continuar mesmo se houver erro ao verificar no Stripe
      }
    }

    return NextResponse.json({
      id: fullUser.id,
      name: fullUser.name,
      email: fullUser.email,
      subscriptionTier: fullUser.subscriptionTier,
      premiumExpiresAt: fullUser.premiumExpiresAt,
      stripeCustomerId: fullUser.stripeCustomerId,
      stripeSubscriptionId: fullUser.stripeSubscriptionId,
      stripeCurrentPeriodEnd: fullUser.stripeCurrentPeriodEnd,
      hasActiveSubscription,
      cancelAtPeriodEnd,
      isPremium: user.isPremium,
    })
  } catch (error) {
    console.error('Erro ao buscar perfil:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

