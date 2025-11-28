/**
 * SERVIÇO DE PROCESSAMENTO DE WEBHOOKS
 * 
 * Processa eventos de webhook salvos no banco de dados.
 * Usado tanto pelos webhooks em tempo real quanto pelo cron job de conciliação.
 */

import { prisma } from '@/lib/prisma'
import { safeWrite } from '@/lib/prisma-wrapper'
import { EmailQueueService } from '@/lib/email-queue-service'
import { stripe } from '@/lib/stripe'
import { payment as mercadoPagoPayment } from '@/lib/mercadopago'

export class WebhookProcessor {
  /**
   * Processa um evento de webhook do Stripe
   */
  static async processStripeEvent(webhookEvent: any): Promise<boolean> {
    const eventType = webhookEvent.eventType
    const eventData = webhookEvent.rawData

    console.log(`🔄 Processing Stripe event: ${eventType}`)

    try {
      switch (eventType) {
        case 'checkout.session.completed':
          return await this.handleStripeCheckoutSessionCompleted(eventData)
        
        case 'customer.subscription.created':
          return await this.handleStripeSubscriptionCreated(eventData)
        
        case 'customer.subscription.updated':
          return await this.handleStripeSubscriptionUpdated(eventData)
        
        case 'customer.subscription.deleted':
          return await this.handleStripeSubscriptionDeleted(eventData)
        
        case 'invoice.payment_succeeded':
          return await this.handleStripeInvoicePaymentSucceeded(eventData)
        
        case 'invoice.payment_failed':
          return await this.handleStripeInvoicePaymentFailed(eventData)
        
        case 'payment_intent.succeeded':
          return await this.handleStripePaymentIntentSucceeded(eventData)
        
        case 'payment_intent.payment_failed':
          return await this.handleStripePaymentIntentFailed(eventData)
        
        case 'setup_intent.succeeded':
          return true // Setup Intent sempre é considerado sucesso
        
        default:
          console.log(`⚠️ Unhandled Stripe event type: ${eventType}`)
          return true // Eventos não tratados são considerados sucesso
      }
    } catch (error) {
      console.error(`❌ Error processing Stripe event ${eventType}:`, error)
      throw error
    }
  }

  /**
   * Processa um evento de webhook do MercadoPago
   */
  static async processMercadoPagoEvent(webhookEvent: any): Promise<boolean> {
    const eventType = webhookEvent.eventType
    const eventData = webhookEvent.rawData

    console.log(`🔄 Processing MercadoPago event: ${eventType}`)

    try {
      // MercadoPago envia eventos de pagamento
      if (eventType === 'payment' || eventData.type === 'payment' || eventData.action === 'payment.updated') {
        const paymentId = eventData.data?.id || eventData.id
        
        if (!paymentId) {
          console.error('❌ Payment ID not found in MercadoPago event')
          return false
        }

        // Buscar dados completos do pagamento
        const paymentData = await mercadoPagoPayment.get({ id: paymentId })
        
        if (paymentData.status === 'approved') {
          return await this.handleMercadoPagoPaymentApproved(paymentData)
        } else {
          console.log(`📋 Payment status: ${paymentData.status} - no action needed`)
          return true
        }
      }

      return true
    } catch (error) {
      console.error(`❌ Error processing MercadoPago event:`, error)
      throw error
    }
  }

  // ===== HANDLERS STRIPE =====

  private static async handleStripeCheckoutSessionCompleted(session: any): Promise<boolean> {
    const userId = session.client_reference_id || session.metadata?.userId

    if (!userId) {
      console.error('❌ User ID not found in checkout session')
      return false
    }

    try {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      const currentPeriodEnd = (subscription as any).current_period_end
      const periodEndDate = currentPeriodEnd 
        ? new Date(currentPeriodEnd * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      await safeWrite(
        'stripe-checkout-completed',
        () => prisma.user.update({
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
            premiumCount: { increment: 1 },
          },
        }),
        ['users']
      )

      console.log(`✅ User ${userId} upgraded to PREMIUM`)
      return true
    } catch (error) {
      console.error('❌ Error handling checkout session completed:', error)
      return false
    }
  }

  private static async handleStripeSubscriptionCreated(subscription: any): Promise<boolean> {
    const userId = subscription.metadata?.userId
    const userEmail = subscription.metadata?.userEmail

    if (!userId) {
      console.error('❌ User ID not found in subscription metadata')
      return false
    }

    if (subscription.status !== 'active') {
      console.log(`⚠️ Subscription ${subscription.id} created but not active (status: ${subscription.status})`)
      
      const currentPeriodEnd = (subscription as any).current_period_end
      const periodEndDate = currentPeriodEnd 
        ? new Date(currentPeriodEnd * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      await safeWrite(
        'stripe-subscription-created-pending',
        () => prisma.user.update({
          where: { id: userId },
          data: {
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0].price.id,
            stripeCurrentPeriodEnd: periodEndDate,
          },
        }),
        ['users']
      )

      return true
    }

    try {
      const currentPeriodEnd = (subscription as any).current_period_end
      const periodEndDate = currentPeriodEnd 
        ? new Date(currentPeriodEnd * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      await safeWrite(
        'stripe-subscription-created-active',
        () => prisma.user.update({
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
            premiumCount: { increment: 1 },
          },
        }),
        ['users']
      )

      if (userEmail) {
        try {
          await EmailQueueService.queueEmail({
            email: userEmail,
            emailType: 'WELCOME',
            emailData: {
              userName: undefined,
              isEarlyAdopter: false
            },
            priority: 0,
            metadata: {
              userId,
              subscriptionId: subscription.id
            }
          })
        } catch (emailError) {
          console.error('❌ Failed to queue welcome email:', emailError)
        }
      }

      return true
    } catch (error) {
      console.error('❌ Error handling subscription created:', error)
      return false
    }
  }

  private static async handleStripeSubscriptionUpdated(subscription: any): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    })

    if (!user) {
      console.error('❌ User not found for subscription:', subscription.id)
      return false
    }

    const isActive = subscription.status === 'active'
    const subscriptionTier = isActive ? 'PREMIUM' : 'FREE'
    const currentPeriodEnd = (subscription as any).current_period_end
    const periodEndDate = currentPeriodEnd 
      ? new Date(currentPeriodEnd * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await safeWrite(
      'stripe-subscription-updated',
      () => prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionTier,
          stripePriceId: subscription.items.data[0].price.id,
          stripeCurrentPeriodEnd: periodEndDate,
          premiumExpiresAt: isActive ? periodEndDate : null,
          lastPremiumAt: isActive ? new Date() : user.lastPremiumAt,
        },
      }),
      ['users']
    )

    return true
  }

  private static async handleStripeSubscriptionDeleted(subscription: any): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    })

    if (!user) {
      console.error('❌ User not found for subscription:', subscription.id)
      return false
    }

    await safeWrite(
      'stripe-subscription-deleted',
      () => prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionTier: 'FREE',
          stripeSubscriptionId: null,
          stripePriceId: null,
          stripeCurrentPeriodEnd: null,
          premiumExpiresAt: null,
        },
      }),
      ['users']
    )

    return true
  }

  private static async handleStripeInvoicePaymentSucceeded(invoice: any): Promise<boolean> {
    const subscriptionId = invoice.subscription

    if (!subscriptionId) {
      return true
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

      const currentPeriodEnd = (subscription as any).current_period_end
      const periodEndDate = currentPeriodEnd 
        ? new Date(currentPeriodEnd * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      await safeWrite(
        'stripe-invoice-payment-succeeded',
        () => prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionTier: 'PREMIUM',
            stripeCurrentPeriodEnd: periodEndDate,
            premiumExpiresAt: periodEndDate,
            lastPremiumAt: new Date(),
          },
        }),
        ['users']
      )

      if (!user.wasPremiumBefore && user.email) {
        try {
          await EmailQueueService.queueEmail({
            email: user.email,
            emailType: 'WELCOME',
            recipientName: user.name || null,
            emailData: {
              userName: user.name || undefined,
              isEarlyAdopter: false
            },
            priority: 0,
            metadata: {
              userId: user.id,
              subscriptionId: subscription.id
            }
          })
        } catch (emailError) {
          console.error('❌ Failed to queue welcome email:', emailError)
        }
      }

      return true
    } catch (error) {
      console.error('❌ Error handling invoice payment succeeded:', error)
      return false
    }
  }

  private static async handleStripeInvoicePaymentFailed(invoice: any): Promise<boolean> {
    let subscriptionId = invoice.subscription
    
    if (!subscriptionId && invoice.parent?.subscription_details?.subscription) {
      subscriptionId = invoice.parent.subscription_details.subscription
    }

    if (!subscriptionId) {
      return true
    }

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      let user = await prisma.user.findUnique({
        where: { stripeSubscriptionId: subscription.id },
      })

      if (!user) {
        const lineItems = invoice.lines?.data || []
        let userId = null
        
        for (const lineItem of lineItems) {
          if (lineItem.metadata?.userId) {
            userId = lineItem.metadata.userId
            break
          }
        }
        
        if (userId) {
          user = await prisma.user.findUnique({
            where: { id: userId },
          })
        }
      }

      if (!user) {
        console.error('❌ User not found for subscription:', subscription.id)
        return false
      }

      let failureReason = 'Falha no processamento do pagamento'
      if (invoice.last_finalization_error?.message) {
        failureReason = invoice.last_finalization_error.message
      }

      const errorTranslations: Record<string, string> = {
        'insufficient_funds': 'Saldo insuficiente no cartão',
        'card_declined': 'Cartão recusado pelo banco',
        'expired_card': 'Cartão vencido',
        'incorrect_cvc': 'Código de segurança incorreto',
        'processing_error': 'Erro no processamento do pagamento',
        'generic_decline': 'Pagamento recusado pelo banco'
      }

      const translatedReason = Object.keys(errorTranslations).find(key => 
        failureReason.toLowerCase().includes(key)
      ) ? errorTranslations[Object.keys(errorTranslations).find(key => 
        failureReason.toLowerCase().includes(key)
      )!] : failureReason

      if (user.email) {
        try {
          const baseUrl = process.env.NEXTAUTH_URL || 'https://precojusto.ai'
          const retryUrl = `${baseUrl}/checkout?retry_payment=true`
          await EmailQueueService.queueEmail({
            email: user.email,
            emailType: 'PAYMENT_FAILURE',
            recipientName: user.name || null,
            emailData: {
              retryUrl,
              userName: user.name || undefined,
              failureReason: translatedReason
            },
            priority: 1, // Prioridade alta para emails críticos
            metadata: {
              userId: user.id,
              subscriptionId: subscription.id,
              invoiceId: invoice.id
            }
          })
        } catch (emailError) {
          console.error('❌ Failed to queue payment failure email:', emailError)
        }
      }

      return true
    } catch (error) {
      console.error('❌ Error handling invoice payment failed:', error)
      return false
    }
  }

  private static async handleStripePaymentIntentSucceeded(paymentIntent: any): Promise<boolean> {
    const userId = paymentIntent.metadata?.userId
    const planType = paymentIntent.metadata?.planType

    if (!userId || !planType || !['monthly', 'annual'].includes(planType)) {
      console.error('❌ Invalid payment intent metadata')
      return false
    }

    try {
      const now = new Date()
      const expiresAt = new Date(now)
      
      if (planType === 'monthly') {
        expiresAt.setMonth(expiresAt.getMonth() + 1)
      } else {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1)
      }

      await safeWrite(
        'stripe-payment-intent-succeeded',
        () => prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionTier: 'PREMIUM',
            premiumExpiresAt: expiresAt,
            wasPremiumBefore: true,
            firstPremiumAt: new Date(),
            lastPremiumAt: new Date(),
          premiumCount: { increment: 1 },
        },
        }),
        ['users']
      )

      return true
    } catch (error) {
      console.error('❌ Error handling payment intent succeeded:', error)
      return false
    }
  }

  private static async handleStripePaymentIntentFailed(paymentIntent: any): Promise<boolean> {
    const userId = paymentIntent.metadata?.userId

    if (!userId) {
      console.error('❌ User ID not found in payment intent metadata')
      return false
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        console.error('❌ User not found:', userId)
        return false
      }

      let failureReason = 'Falha no processamento do pagamento'
      if (paymentIntent.last_payment_error?.message) {
        failureReason = paymentIntent.last_payment_error.message
      }

      const errorTranslations: Record<string, string> = {
        'insufficient_funds': 'Saldo insuficiente no cartão',
        'card_declined': 'Cartão recusado pelo banco',
        'expired_card': 'Cartão vencido',
        'incorrect_cvc': 'Código de segurança incorreto',
        'processing_error': 'Erro no processamento do pagamento',
        'generic_decline': 'Pagamento recusado pelo banco',
        'authentication_required': 'Autenticação adicional necessária'
      }

      const translatedReason = Object.keys(errorTranslations).find(key => 
        failureReason.toLowerCase().includes(key)
      ) ? errorTranslations[Object.keys(errorTranslations).find(key => 
        failureReason.toLowerCase().includes(key)
      )!] : failureReason

      if (user.email) {
        try {
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
          const retryUrl = `${baseUrl}/checkout?retry_payment=true`
          await EmailQueueService.queueEmail({
            email: user.email,
            emailType: 'PAYMENT_FAILURE',
            recipientName: user.name || null,
            emailData: {
              retryUrl,
              userName: user.name || undefined,
              failureReason: translatedReason
            },
            priority: 1, // Prioridade alta para emails críticos
            metadata: {
              userId: user.id,
              paymentIntentId: paymentIntent.id
            }
          })
        } catch (emailError) {
          console.error('❌ Failed to queue payment failure email:', emailError)
        }
      }

      return true
    } catch (error) {
      console.error('❌ Error handling payment intent failed:', error)
      return false
    }
  }

  // ===== HANDLERS MERCADOPAGO =====

  private static async handleMercadoPagoPaymentApproved(paymentData: any): Promise<boolean> {
    const userId = paymentData.external_reference?.split('-')[0]

    if (!userId) {
      console.error('❌ User ID não encontrado no external_reference')
      return false
    }

    const amount = paymentData.transaction_amount
    if (!amount || amount <= 0) {
      console.error('❌ Invalid payment amount:', amount)
      return false
    }

    // Buscar ofertas ativas do banco para determinar tipo de plano
    const offers = await prisma.offer.findMany({
      where: {
        is_active: true,
      },
      select: {
        type: true,
        price_in_cents: true,
      },
    })

    // Converter amount para centavos para comparação
    const amountInCents = Math.round(amount * 100)
    
    let planDuration: number
    let planType: string
    
    // Verificar se corresponde a alguma oferta do banco
    const monthlyOffer = offers.find((o) => o.type === 'MONTHLY')
    const annualOffer = offers.find((o) => o.type === 'ANNUAL')
    
    // Comparar com tolerância de 1 centavo (para arredondamentos)
    if (monthlyOffer && Math.abs(amountInCents - monthlyOffer.price_in_cents) <= 1) {
      planDuration = 30
      planType = 'monthly'
    } else if (annualOffer && Math.abs(amountInCents - annualOffer.price_in_cents) <= 1) {
      planDuration = 365
      planType = 'annual'
    } else {
      // Fallback: tentar determinar pelo valor
      if (amount >= 100) {
        planDuration = 365
        planType = 'annual'
      } else {
        planDuration = 30
        planType = 'monthly'
      }
      console.warn(`⚠️ Valor ${amount} não corresponde exatamente a nenhuma oferta ativa. Usando fallback: ${planType}`)
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + planDuration)

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { wasPremiumBefore: true, firstPremiumAt: true, email: true, name: true }
    })

    if (!currentUser) {
      console.error('❌ User not found in database:', userId)
      return false
    }

    const updateData: any = {
      subscriptionTier: 'PREMIUM',
      premiumExpiresAt: expiresAt,
      wasPremiumBefore: true,
      firstPremiumAt: currentUser?.firstPremiumAt || new Date(),
      lastPremiumAt: new Date(),
      premiumCount: { increment: 1 },
    }

    await safeWrite(
      'mercadopago-payment-approved',
      () => prisma.user.update({
        where: { id: userId },
        data: updateData,
      }),
      ['users']
    )

    if (currentUser.email) {
      try {
        await EmailQueueService.queueEmail({
          email: currentUser.email,
          emailType: 'WELCOME',
          recipientName: currentUser.name || null,
          emailData: {
            userName: currentUser.name || undefined,
            isEarlyAdopter: false
          },
          priority: 0,
          metadata: {
            userId,
            paymentId: paymentData.id
          }
        })
      } catch (emailError) {
        console.error('❌ Failed to queue welcome email:', emailError)
      }
    }

    return true
  }
}

