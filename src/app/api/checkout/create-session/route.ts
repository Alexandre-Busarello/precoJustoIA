import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { createCheckoutSession } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { isOfferExpired } from '@/lib/offer-utils'

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

    // Se priceId não foi fornecido, buscar da tabela offers baseado no planType
    let finalPriceId = priceId
    
    if (!finalPriceId && planType) {
      const offerType = planType === 'monthly' ? 'MONTHLY' : planType === 'annual' ? 'ANNUAL' : planType === 'special' ? 'SPECIAL' : null
      
      if (offerType) {
        const offer = await prisma.offer.findFirst({
          where: {
            type: offerType,
            is_active: true,
          },
          select: {
            stripe_price_id: true,
            expires_at: true,
          },
        })
        
        if (offer?.stripe_price_id) {
          finalPriceId = offer.stripe_price_id
        } else {
          // Para oferta especial sem stripe_price_id, retornar erro
          if (planType === 'special') {
            return NextResponse.json(
              { error: 'Esta oferta especial não está disponível para pagamento com cartão' },
              { status: 400 }
            )
          }
          
          // Fallback para env vars se não encontrar no banco (compatibilidade)
          if (planType === 'monthly') {
            finalPriceId = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID
          } else if (planType === 'annual') {
            finalPriceId = process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID
          }
        }

        // Validar se oferta especial não está expirada
        if (planType === 'special' && offer && isOfferExpired(offer)) {
          return NextResponse.json(
            { error: 'Esta oferta especial expirou' },
            { status: 400 }
          )
        }
      }
    }

    if (!finalPriceId) {
      return NextResponse.json(
        { error: 'Price ID ou planType é obrigatório' },
        { status: 400 }
      )
    }

    // Para ofertas especiais, não bloquear usuários Premium (eles podem comprar para estender)
    if (planType !== 'special' && user.isPremium && user.subscriptionTier !== 'FREE') {
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
