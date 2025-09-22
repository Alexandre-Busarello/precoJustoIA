import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  console.log('🔗 Stripe webhook POST request received')
  console.log('📍 Request URL:', request.url)
  console.log('🔑 Webhook secret configured:', !!webhookSecret)
  
  try {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    console.log('📦 Body length:', body.length)
    console.log('🔐 Signature present:', !!signature)

    if (!signature) {
      console.error('❌ Stripe signature header missing')
      return NextResponse.json(
        { error: 'Stripe signature header missing' },
        { status: 400 }
      )
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      )
    }

    console.log('🎯 Stripe webhook event received:', event.type)
    console.log('📦 Event ID:', event.id)

    // Processar diferentes tipos de eventos
    let success = false
    
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('🛒 Processing checkout.session.completed')
        success = await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
        console.log('🔔 Processing customer.subscription.created')
        success = await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break

      case 'setup_intent.succeeded':
        success = await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent)
        break

      case 'customer.subscription.updated':
        success = await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        success = await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        success = await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        success = await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case 'payment_intent.succeeded':
        success = await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
        break

      case 'payment_intent.payment_failed':
        success = await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
        success = true // Eventos não tratados são considerados "sucesso" para não bloquear
    }

    if (!success) {
      console.error('❌ Webhook processing failed, returning 500 to trigger retry')
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: 500 }
      )
    }

    console.log('✅ Webhook processed successfully')
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<boolean> {
  console.log('Checkout session completed:', session.id)

  const userId = session.client_reference_id || session.metadata?.userId

  if (!userId) {
    console.error('❌ User ID not found in checkout session')
    return false
  }

  try {
    // Buscar dados da assinatura
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
    
    // Atualizar usuário no banco de dados
    const currentPeriodEnd = (subscription as any).current_period_end
    const periodEndDate = currentPeriodEnd 
      ? new Date(currentPeriodEnd * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias como fallback

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: 'PREMIUM',
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0].price.id,
        stripeCurrentPeriodEnd: periodEndDate,
        premiumExpiresAt: periodEndDate,
        wasPremiumBefore: true,
        firstPremiumAt: new Date(),
        lastPremiumAt: new Date(),
        premiumCount: {
          increment: 1,
        },
      },
    })

    console.log(`✅ User ${userId} upgraded to PREMIUM`)
    return true
  } catch (error) {
    console.error('❌ Error handling checkout session completed:', error)
    return false
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<boolean> {
  console.log('🎯 Subscription created:', subscription.id)
  console.log('👤 Customer ID:', subscription.customer)
  console.log('📋 Metadata:', JSON.stringify(subscription.metadata, null, 2))
  console.log('💰 Status:', subscription.status)
  console.log('📅 Current period end:', (subscription as any).current_period_end)

  const userId = subscription.metadata?.userId
  const userEmail = subscription.metadata?.userEmail

  console.log('🔍 Extracted userId:', userId)
  console.log('📧 Extracted userEmail:', userEmail)

  if (!userId) {
    console.error('❌ User ID not found in subscription metadata')
    console.error('📋 Available metadata keys:', Object.keys(subscription.metadata || {}))
    return false
  }

  try {
    const currentPeriodEnd = (subscription as any).current_period_end
    console.log('🗓️ Raw current_period_end:', currentPeriodEnd)
    
    // Verificar se current_period_end existe e é válido
    const periodEndDate = currentPeriodEnd 
      ? new Date(currentPeriodEnd * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias a partir de agora como fallback
    
    console.log('📅 Converted period end date:', periodEndDate)
    console.log('✅ Date is valid:', !isNaN(periodEndDate.getTime()))

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: 'PREMIUM',
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0].price.id,
        stripeCurrentPeriodEnd: periodEndDate,
        premiumExpiresAt: periodEndDate,
        wasPremiumBefore: true,
        firstPremiumAt: new Date(),
        lastPremiumAt: new Date(),
        premiumCount: {
          increment: 1,
        },
      },
    })

    console.log(`✅ Subscription created successfully for user ${userId}`)
    console.log(`🎉 User ${userEmail} is now PREMIUM!`)
    return true
  } catch (error) {
    console.error('❌ Error handling subscription created:', error)
    console.error('🔍 Error details:', {
      userId,
      userEmail,
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return false
  }
}

async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent): Promise<boolean> {
  console.log('Setup Intent succeeded:', setupIntent.id)

  // O Setup Intent por si só não ativa o Premium
  // A ativação acontece quando a subscription é criada
  // Este evento é útil para logs e auditoria
  
  const userId = setupIntent.metadata?.userId
  
  if (userId) {
    console.log(`Setup Intent succeeded for user ${userId}`)
  }
  
  return true // Setup Intent sempre é considerado sucesso
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<boolean> {
  console.log('Subscription updated:', subscription.id)

  try {
    const user = await prisma.user.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    })

    if (!user) {
      console.error('❌ User not found for subscription:', subscription.id)
      return false
    }

  // Determinar o status da assinatura
  const isActive = subscription.status === 'active'
  const subscriptionTier = isActive ? 'PREMIUM' : 'FREE'

  const currentPeriodEnd = (subscription as any).current_period_end
  const periodEndDate = currentPeriodEnd 
    ? new Date(currentPeriodEnd * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias como fallback

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionTier,
      stripePriceId: subscription.items.data[0].price.id,
      stripeCurrentPeriodEnd: periodEndDate,
      premiumExpiresAt: isActive ? periodEndDate : null,
      lastPremiumAt: isActive ? new Date() : user.lastPremiumAt,
    },
  })

    console.log(`✅ Subscription updated for user ${user.id}, status: ${subscription.status}`)
    return true
  } catch (error) {
    console.error('❌ Error handling subscription updated:', error)
    return false
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<boolean> {
  console.log('Subscription deleted:', subscription.id)

  try {
    const user = await prisma.user.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    })

    if (!user) {
      console.error('User not found for subscription:', subscription.id)
      return false
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: 'FREE',
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
        premiumExpiresAt: null,
      },
    })

    console.log(`✅ Subscription deleted for user ${user.id}`)
    return true
  } catch (error) {
    console.error('❌ Error handling subscription deleted:', error)
    return false
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<boolean> {
  console.log('Invoice payment succeeded:', invoice.id)

  // Verificar se há subscription associada
  const subscriptionId = (invoice as any).subscription

  if (!subscriptionId) {
    return true // Sem subscription associada, consideramos sucesso
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const user = await prisma.user.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    })

    if (!user) {
      console.error('User not found for subscription:', subscription.id)
      return false
    }

  // Atualizar data de expiração
  const currentPeriodEnd = (subscription as any).current_period_end
  const periodEndDate = currentPeriodEnd 
    ? new Date(currentPeriodEnd * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias como fallback

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionTier: 'PREMIUM',
      stripeCurrentPeriodEnd: periodEndDate,
      premiumExpiresAt: periodEndDate,
      lastPremiumAt: new Date(),
    },
  })

    console.log(`✅ Payment succeeded for user ${user.id}`)
    return true
  } catch (error) {
    console.error('❌ Error handling invoice payment succeeded:', error)
    return false
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<boolean> {
  console.log('Invoice payment failed:', invoice.id)

  // Verificar se há subscription associada
  const subscriptionId = (invoice as any).subscription

  if (!subscriptionId) {
    return true // Sem subscription associada, consideramos sucesso
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const user = await prisma.user.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    })

    if (!user) {
      console.error('❌ User not found for subscription:', subscription.id)
      return false
    }

    // Se o pagamento falhou, podemos manter o usuário como PREMIUM até o final do período
    // ou downgrade imediatamente dependendo da política
    console.log(`⚠️ Payment failed for user ${user.id}, subscription: ${subscription.id}`)
    
    // Por enquanto, vamos manter o usuário como PREMIUM até o final do período
    // Em uma implementação real, você pode querer implementar uma lógica mais sofisticada
    return true
  } catch (error) {
    console.error('❌ Error handling invoice payment failed:', error)
    return false
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<boolean> {
  console.log('Payment Intent succeeded:', paymentIntent.id)

  const userId = paymentIntent.metadata?.userId
  const planType = paymentIntent.metadata?.planType

  if (!userId) {
    console.error('❌ User ID not found in payment intent metadata')
    return false
  }

  if (!planType || !['monthly', 'annual'].includes(planType)) {
    console.error('❌ Invalid plan type in payment intent metadata:', planType)
    return false
  }

  try {
    // Calcular data de expiração baseada no plano
    const now = new Date()
    const expiresAt = new Date(now)
    
    if (planType === 'monthly') {
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    } else if (planType === 'annual') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    }

    // Atualizar usuário no banco de dados
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: 'PREMIUM',
        premiumExpiresAt: expiresAt,
        wasPremiumBefore: true,
        firstPremiumAt: new Date(),
        lastPremiumAt: new Date(),
        premiumCount: {
          increment: 1,
        },
      },
    })

    console.log(`✅ User ${userId} upgraded to PREMIUM via Payment Intent (${planType})`)
    return true
  } catch (error) {
    console.error('❌ Error handling payment intent succeeded:', error)
    return false
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<boolean> {
  console.log('Payment Intent failed:', paymentIntent.id)

  const userId = paymentIntent.metadata?.userId

  if (!userId) {
    console.error('❌ User ID not found in payment intent metadata')
    return false
  }

  console.log(`⚠️ Payment failed for user ${userId}, payment intent: ${paymentIntent.id}`)
  
  // Por enquanto, apenas logamos o erro
  // Em uma implementação real, você pode querer notificar o usuário ou tomar outras ações
  return true // Consideramos sucesso pois processamos o evento de falha
}
