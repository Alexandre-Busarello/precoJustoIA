import { NextRequest, NextResponse } from 'next/server'
import { processWebhookNotification } from '@/lib/mercadopago'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('MercadoPago webhook received:', body)

    // Processar notificação do webhook
    const paymentData = await processWebhookNotification(body)
    
    if (!paymentData) {
      return NextResponse.json({ received: true })
    }

    // Processar apenas pagamentos aprovados
    if (paymentData.status === 'approved') {
      await handlePaymentApproved(paymentData)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook MercadoPago error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handlePaymentApproved(paymentData: any) {
  try {
    const userId = paymentData.external_reference

    if (!userId) {
      console.error('User ID não encontrado no external_reference:', paymentData)
      return
    }

    // Determinar duração baseada no valor do pagamento
    // R$ 47 = mensal (30 dias), R$ 470 = anual (365 dias)
    const amount = paymentData.transaction_amount
    const planDuration = amount >= 400 ? 365 : 30 // anual ou mensal
    const planType = amount >= 400 ? 'annual' : 'monthly'

    // Calcular data de expiração
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + planDuration)

    // Buscar usuário atual para verificar se já foi premium
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { wasPremiumBefore: true, firstPremiumAt: true }
    })

    // Atualizar usuário no banco de dados
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: 'PREMIUM',
        premiumExpiresAt: expiresAt,
        wasPremiumBefore: true,
        firstPremiumAt: currentUser?.firstPremiumAt || new Date(),
        lastPremiumAt: new Date(),
        premiumCount: {
          increment: 1,
        },
      },
    })

    console.log(`User ${userId} upgraded to PREMIUM via PIX (${planType}) until ${expiresAt}`)
  } catch (error) {
    console.error('Error handling payment approved:', error)
  }
}
