import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

/**
 * POST /api/profile/cancel-subscription
 * Cancela a assinatura Stripe do usuário (mantém acesso até premiumExpiresAt)
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

    // Buscar dados completos do usuário
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        stripeSubscriptionId: true,
        premiumExpiresAt: true,
      }
    })

    if (!fullUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    if (!fullUser.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Usuário não possui assinatura ativa' },
        { status: 400 }
      )
    }

    // Verificar status da assinatura no Stripe
    let subscription
    try {
      subscription = await stripe.subscriptions.retrieve(fullUser.stripeSubscriptionId)
    } catch (error) {
      console.error('Erro ao buscar assinatura no Stripe:', error)
      return NextResponse.json(
        { error: 'Erro ao verificar assinatura no Stripe' },
        { status: 500 }
      )
    }

    // Se já está cancelada, retornar sucesso
    if (subscription.cancel_at_period_end) {
      return NextResponse.json({
        success: true,
        message: 'Assinatura já está marcada para cancelamento',
        premiumExpiresAt: fullUser.premiumExpiresAt
      })
    }

    // Cancelar assinatura (mantém ativa até o fim do período)
    try {
      await stripe.subscriptions.update(fullUser.stripeSubscriptionId, {
        cancel_at_period_end: true,
      })
    } catch (error) {
      console.error('Erro ao cancelar assinatura no Stripe:', error)
      return NextResponse.json(
        { error: 'Erro ao cancelar assinatura' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Assinatura cancelada com sucesso. Você manterá acesso Premium até ' + 
               (fullUser.premiumExpiresAt ? new Date(fullUser.premiumExpiresAt).toLocaleDateString('pt-BR') : 'o fim do período'),
      premiumExpiresAt: fullUser.premiumExpiresAt
    })
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

