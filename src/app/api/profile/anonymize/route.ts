import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { safeWrite } from '@/lib/prisma-wrapper'
import { z } from 'zod'
import crypto from 'crypto'

const anonymizeSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Você deve confirmar a anonimização' })
  }),
})

/**
 * POST /api/profile/anonymize
 * Anonimiza a conta do usuário (LGPD)
 * - Anonimiza nome e email
 * - Cancela assinatura se existir
 * - Usuário perde acesso (não tem volta)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = anonymizeSchema.parse(body)

    // Buscar dados completos do usuário
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        stripeSubscriptionId: true,
        stripeCustomerId: true,
        email: true,
        name: true,
      }
    })

    if (!fullUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Cancelar assinatura Stripe se existir
    if (fullUser.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(fullUser.stripeSubscriptionId)
        
        // Se ainda está ativa, cancelar imediatamente
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          await stripe.subscriptions.cancel(fullUser.stripeSubscriptionId)
        }
      } catch (error) {
        console.error('Erro ao cancelar assinatura durante anonimização:', error)
        // Continuar mesmo se houver erro ao cancelar no Stripe
      }
    }

    // Gerar valores anonimizados
    const anonymizedEmail = `anon_${crypto.randomBytes(16).toString('hex')}@anonimizado.local`
    const anonymizedName = 'Usuário Anonimizado'

    // Anonimizar dados do usuário
    await safeWrite(
      'anonymize-user',
      () => prisma.user.update({
        where: { id: user.id },
        data: {
          name: anonymizedName,
          email: anonymizedEmail,
          password: null, // Remover senha para impossibilitar login
          subscriptionTier: 'FREE',
          premiumExpiresAt: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripePriceId: null,
          stripeCurrentPeriodEnd: null,
          isInactive: true,
          inactivatedAt: new Date(),
        }
      }),
      ['users']
    )

    // Invalidar todas as sessões do usuário
    await prisma.session.deleteMany({
      where: { userId: user.id }
    })

    return NextResponse.json({
      success: true,
      message: 'Conta anonimizada com sucesso. Você será redirecionado para a página inicial.'
    })
  } catch (error) {
    console.error('Erro ao anonimizar conta:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', errors: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

