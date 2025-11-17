import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { createPixPayment } from '@/lib/mercadopago'
import { prisma } from '@/lib/prisma'

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

    const { planType, userEmail, userName } = await request.json()

    if (!planType || !['early', 'monthly', 'annual'].includes(planType)) {
      return NextResponse.json(
        { error: 'Tipo de plano inválido' },
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

    // Buscar preço da tabela offers (exceto para early adopter)
    let amount: number
    
    if (planType === 'early') {
      // Early adopter tem preço fixo
      amount = 118.80
    } else {
      const offerType = planType === 'monthly' ? 'MONTHLY' : 'ANNUAL'
      const offer = await prisma.offer.findFirst({
        where: {
          type: offerType,
          is_active: true,
        },
        select: {
          price_in_cents: true,
        },
      })
      
      if (!offer) {
        return NextResponse.json(
          { error: `Oferta ${offerType} não encontrada ou inativa` },
          { status: 404 }
        )
      }
      
      // Converter centavos para reais
      amount = offer.price_in_cents / 100
    }

    // Gerar chave de idempotência única
    const idempotencyKey = `pix-${user.id}-${planType}-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    // Criar pagamento PIX direto no MercadoPago
    const pixPayment = await createPixPayment({
      planType: planType as 'monthly' | 'annual' | 'early',
      amount,
      userId: user.id,
      userEmail: userEmail || user.email,
      userName: userName || user.name || undefined,
      idempotencyKey,
    })

    return NextResponse.json({
      id: pixPayment.id,
      status: pixPayment.status,
      qr_code: pixPayment.qr_code,
      qr_code_base64: pixPayment.qr_code_base64,
      ticket_url: pixPayment.ticket_url,
    })
  } catch (error) {
    console.error('Erro ao criar pagamento PIX:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
