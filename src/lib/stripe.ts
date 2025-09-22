import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
  typescript: true,
})

// Configurações dos produtos
export const STRIPE_CONFIG = {
  products: {
    premium: {
      monthly: {
        priceId: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID!,
        amount: 4700, // R$ 47.00 em centavos
        currency: 'brl',
        interval: 'month' as const,
      },
      annual: {
        priceId: process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID!,
        amount: 49700, // R$ 497.00 em centavos
        currency: 'brl',
        interval: 'year' as const,
      },
    },
  },
  
  // Métodos de pagamento suportados
  paymentMethods: ['card'] as const,
  
  // URLs de redirecionamento
  urls: {
    success: `${process.env.NEXTAUTH_URL}/checkout/success`,
    cancel: `${process.env.NEXTAUTH_URL}/checkout/cancel`,
  },
}

// Função para criar sessão de checkout
export async function createCheckoutSession({
  priceId,
  userId,
  userEmail,
  successUrl,
  cancelUrl,
}: {
  priceId: string
  userId: string
  userEmail: string
  successUrl?: string
  cancelUrl?: string
}) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || STRIPE_CONFIG.urls.success + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl || STRIPE_CONFIG.urls.cancel,
      customer_email: userEmail,
      client_reference_id: userId,
      metadata: {
        userId,
        userEmail,
      },
      subscription_data: {
        metadata: {
          userId,
          userEmail,
        },
      },
      // Configurações específicas para o Brasil
      locale: 'pt-BR',
      currency: 'brl',
      // Permitir códigos promocionais
      allow_promotion_codes: true,
      // Configurar cobrança automática
      billing_address_collection: 'required',
      // Configurar trial period se necessário
      // subscription_data: {
      //   trial_period_days: 7,
      // },
    })

    return session
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error)
    throw error
  }
}

// Função para verificar status da assinatura
export async function getSubscriptionStatus(customerId: string) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    })

    return subscriptions.data[0] || null
  } catch (error) {
    console.error('Erro ao verificar status da assinatura:', error)
    return null
  }
}

// Função para cancelar assinatura
export async function cancelSubscription(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })

    return subscription
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error)
    throw error
  }
}

// Função para reativar assinatura
export async function reactivateSubscription(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    })

    return subscription
  } catch (error) {
    console.error('Erro ao reativar assinatura:', error)
    throw error
  }
}

// Função para criar portal do cliente
export async function createCustomerPortalSession(customerId: string, returnUrl: string) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    return session
  } catch (error) {
    console.error('Erro ao criar sessão do portal do cliente:', error)
    throw error
  }
}
