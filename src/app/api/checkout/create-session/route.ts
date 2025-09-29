import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { createCheckoutSession } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    // Verificar usuário atual - ÚNICA FONTE DA VERDADE
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    const { planType, priceId } = await request.json()

    // Se priceId não foi fornecido, determinar baseado no planType
    let finalPriceId = priceId
    
    if (!finalPriceId && planType) {
      if (planType === 'monthly') {
        finalPriceId = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID
      } else if (planType === 'annual') {
        finalPriceId = process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID
      }
    }

    if (!finalPriceId) {
      return NextResponse.json(
        { error: 'Price ID ou planType é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se o usuário já tem uma assinatura ativa
    if (user.isPremium && user.subscriptionTier !== 'FREE') {
      return NextResponse.json(
        { error: 'Usuário já possui uma assinatura ativa' },
        { status: 400 }
      )
    }

    // Criar sessão de checkout do Stripe
    const checkoutSession = await createCheckoutSession({
      priceId: finalPriceId,
      userId: user.id,
      userEmail: user.email,
    })

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    })
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
