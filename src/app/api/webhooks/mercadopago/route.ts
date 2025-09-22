import { NextRequest, NextResponse } from 'next/server'
import { processWebhookNotification } from '@/lib/mercadopago'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  console.log('🔗 MercadoPago webhook POST request received')
  
  try {
    const body = await request.json()
    
    console.log('🎯 MercadoPago webhook received:', body)

    // Processar notificação do webhook
    const paymentData = await processWebhookNotification(body)
    
    if (!paymentData) {
      console.log('📭 No payment data to process, considering success')
      return NextResponse.json({ received: true })
    }

    let success = false

    // Processar apenas pagamentos aprovados
    if (paymentData.status === 'approved') {
      console.log('💰 Processing approved payment')
      success = await handlePaymentApproved(paymentData)
    } else {
      console.log(`📋 Payment status: ${paymentData.status} - no action needed`)
      success = true // Outros status são considerados sucesso (não precisam retry)
    }

    if (!success) {
      console.error('❌ MercadoPago webhook processing failed, returning 500 to trigger retry')
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: 500 }
      )
    }

    console.log('✅ MercadoPago webhook processed successfully')
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('❌ Webhook MercadoPago error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handlePaymentApproved(paymentData: any): Promise<boolean> {
  console.log('🎯 Processing approved PIX payment:', paymentData.id)
  console.log('💰 Amount:', paymentData.transaction_amount)
  console.log('👤 External reference:', paymentData.external_reference)
  
  try {
    const userId = paymentData.external_reference

    if (!userId) {
      console.error('❌ User ID não encontrado no external_reference:', paymentData)
      return false
    }

    // Validar dados do pagamento
    const amount = paymentData.transaction_amount
    if (!amount || amount <= 0) {
      console.error('❌ Invalid payment amount:', amount)
      return false
    }

    // Determinar duração baseada no valor do pagamento
    // R$ 47 = mensal (30 dias), R$ 470 = anual (365 dias)
    const planDuration = amount >= 400 ? 365 : 30 // anual ou mensal
    const planType = amount >= 400 ? 'annual' : 'monthly'

    console.log(`📅 Plan type: ${planType}, duration: ${planDuration} days`)

    // Calcular data de expiração
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + planDuration)

    console.log('🔍 Looking up user in database...')
    // Buscar usuário atual para verificar se já foi premium
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { wasPremiumBefore: true, firstPremiumAt: true, email: true }
    })

    if (!currentUser) {
      console.error('❌ User not found in database:', userId)
      return false
    }

    console.log('👤 User found:', currentUser.email)

    console.log('💾 Updating user in database...')
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

    console.log(`✅ User ${userId} (${currentUser.email}) upgraded to PREMIUM via PIX (${planType}) until ${expiresAt}`)
    console.log(`🎉 PIX payment processed successfully! Amount: R$ ${amount}`)
    return true
  } catch (error) {
    console.error('❌ Error handling PIX payment approved:', error)
    console.error('🔍 Error details:', {
      userId: paymentData.external_reference,
      amount: paymentData.transaction_amount,
      paymentId: paymentData.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return false
  }
}
