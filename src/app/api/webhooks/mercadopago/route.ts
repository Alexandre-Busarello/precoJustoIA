import { NextRequest, NextResponse } from 'next/server'
import { processWebhookNotification, validateWebhookSignature } from '@/lib/mercadopago'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/email-service'

export async function POST(request: NextRequest) {
  console.log('🔗 MercadoPago webhook POST request received')
  
  try {
    // Obter headers necessários para validação
    const xSignature = request.headers.get('x-signature')
    const xRequestId = request.headers.get('x-request-id')
    const dataId = request.nextUrl.searchParams.get('data.id')
    
    console.log('🔍 Webhook headers:', {
      hasXSignature: !!xSignature,
      hasXRequestId: !!xRequestId,
      dataId,
    })

    // Ler o corpo da requisição
    const rawBody = await request.text()
    let body: any
    
    try {
      body = JSON.parse(rawBody)
    } catch (error) {
      console.error('❌ Invalid JSON in webhook body')
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      )
    }
    
    console.log('🎯 MercadoPago webhook received:', body)

    // Validar assinatura do webhook (apenas em produção)
    if (process.env.NODE_ENV === 'production') {
      if (!xSignature || !xRequestId || !dataId) {
        console.error('❌ Missing required headers for webhook validation')
        return NextResponse.json(
          { error: 'Missing required headers' },
          { status: 401 }
        )
      }

      const isValidSignature = validateWebhookSignature(
        xSignature,
        xRequestId,
        dataId,
        rawBody
      )

      if (!isValidSignature) {
        console.error('❌ Invalid webhook signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }

      console.log('✅ Webhook signature validated successfully')
    } else {
      console.log('⚠️ Skipping webhook signature validation in development mode')
    }

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
    // R$ 47 = mensal (30 dias), R$ 249 = early adopter (365 dias), R$ 497 = anual (365 dias)
    let planDuration: number
    let planType: string
    
    if (amount >= 200) {
      planDuration = 365 // anual ou early adopter
      planType = amount <= 300 ? 'early' : 'annual' // R$ 249 = early, R$ 497 = annual
    } else {
      planDuration = 30 // mensal
      planType = 'monthly'
    }

    console.log(`📅 Plan type: ${planType}, duration: ${planDuration} days`)

    // Calcular data de expiração
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + planDuration)

    console.log('🔍 Looking up user in database...')
    // Buscar usuário atual para verificar se já foi premium
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { wasPremiumBefore: true, firstPremiumAt: true, email: true, name: true }
    })

    if (!currentUser) {
      console.error('❌ User not found in database:', userId)
      return false
    }

    console.log('👤 User found:', currentUser.email)

    console.log('💾 Updating user in database...')
    
    // Preparar dados de atualização baseados no tipo de plano
    const updateData: any = {
      subscriptionTier: 'PREMIUM',
      premiumExpiresAt: expiresAt,
      wasPremiumBefore: true,
      firstPremiumAt: currentUser?.firstPremiumAt || new Date(),
      lastPremiumAt: new Date(),
      premiumCount: {
        increment: 1,
      },
    }

    // Se for Early Adopter, marcar campos especiais
    if (planType === 'early') {
      updateData.isEarlyAdopter = true
      updateData.earlyAdopterDate = new Date()
      console.log('🎉 Marking user as Early Adopter!')
    }

    // Atualizar usuário no banco de dados
    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    console.log(`✅ User ${userId} (${currentUser.email}) upgraded to PREMIUM via PIX (${planType}) until ${expiresAt}`)
    console.log(`🎉 PIX payment processed successfully! Amount: R$ ${amount}`)
    
    // Enviar email de boas-vindas
    if (currentUser.email) {
      try {
        // Verificar se é Early Adopter baseado no tipo de plano
        const isEarlyAdopter = planType === 'early'
        
        await sendWelcomeEmail(currentUser.email, currentUser.name || undefined, isEarlyAdopter)
        console.log(`📧 Welcome email sent to ${currentUser.email} (Early Adopter: ${isEarlyAdopter})`)
      } catch (emailError) {
        console.error('❌ Failed to send welcome email:', emailError)
        // Não falhar o webhook por causa do email
      }
    }
    
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
