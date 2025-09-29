import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Verificar se o usuário está autenticado
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    const { setupIntentId, priceId } = await request.json()

    if (!setupIntentId || !priceId) {
      return NextResponse.json(
        { error: 'Setup Intent ID e Price ID são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar dados do usuário no banco
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user || !user.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Usuário ou Customer ID não encontrado' },
        { status: 404 }
      )
    }

    // Buscar o Setup Intent para obter o payment method
    console.log('Retrieving Setup Intent:', setupIntentId)
    let setupIntent
    
    try {
      setupIntent = await stripe.setupIntents.retrieve(setupIntentId)
      console.log('Setup Intent status:', setupIntent.status)
    } catch (stripeError: any) {
      console.error('Error retrieving Setup Intent:', stripeError)
      return NextResponse.json(
        { 
          error: 'Setup Intent não encontrado',
          code: stripeError.code,
          type: stripeError.type
        },
        { status: 400 }
      )
    }
    
    if (setupIntent.status !== 'succeeded') {
      console.error('Setup Intent not succeeded:', setupIntent.status)
      return NextResponse.json(
        { 
          error: 'Setup Intent não foi confirmado',
          code: 'setup_intent_not_succeeded',
          status: setupIntent.status
        },
        { status: 400 }
      )
    }

    const paymentMethodId = setupIntent.payment_method as string
    console.log('Payment Method ID:', paymentMethodId)

    if (!paymentMethodId) {
      console.error('No payment method found in Setup Intent')
      return NextResponse.json(
        { error: 'Método de pagamento não encontrado' },
        { status: 400 }
      )
    }

    // Verificar se o método de pagamento já está anexado ao customer
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
      console.log('Payment Method customer:', paymentMethod.customer)
      
      if (paymentMethod.customer !== user.stripeCustomerId) {
        console.log('Attaching payment method to customer')
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: user.stripeCustomerId,
        })
      }
    } catch (attachError) {
      console.error('Error attaching payment method:', attachError)
      // Continuar mesmo se falhar, pode já estar anexado
    }

    // Definir como método de pagamento padrão
    console.log('Setting default payment method')
    await stripe.customers.update(user.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    // Criar a assinatura
    console.log('Creating subscription with:', {
      customer: user.stripeCustomerId,
      priceId,
      userId: user.id,
    })

    const subscription = await stripe.subscriptions.create({
      customer: user.stripeCustomerId,
      items: [
        {
          price: priceId,
        },
      ],
      default_payment_method: paymentMethodId,
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId: user.id,
        userEmail: user.email,
      },
    })

    console.log('Subscription created:', {
      id: subscription.id,
      status: subscription.status,
      latest_invoice: subscription.latest_invoice,
    })

    const latestInvoice = subscription.latest_invoice as any
    const paymentIntent = latestInvoice?.payment_intent

    console.log('Payment Intent details:', {
      exists: !!paymentIntent,
      status: paymentIntent?.status,
      client_secret: !!paymentIntent?.client_secret,
    })

    // Verificar diferentes cenários de status
    if (subscription.status === 'active') {
      console.log('Subscription is active immediately')
      return NextResponse.json({
        subscriptionId: subscription.id,
        status: 'succeeded',
      })
    }
    
    if (paymentIntent?.status === 'requires_action') {
      console.log('Payment requires action')
      return NextResponse.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
        status: 'requires_action',
      })
    } 
    
    if (paymentIntent?.status === 'succeeded') {
      console.log('Payment succeeded immediately')
      return NextResponse.json({
        subscriptionId: subscription.id,
        status: 'succeeded',
      })
    }
    
    if (subscription.status === 'incomplete' && paymentIntent?.status === 'requires_payment_method') {
      console.log('Payment requires payment method')
      return NextResponse.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
        status: 'requires_payment_method',
      })
    }
    
    // Se chegou aqui, algo inesperado aconteceu
    console.error('Unexpected subscription/payment status:', {
      paymentIntentStatus: paymentIntent?.status,
      subscriptionStatus: subscription.status,
      latestInvoiceStatus: latestInvoice?.status,
    })
    
    return NextResponse.json(
      { 
        error: 'Erro inesperado ao criar assinatura',
        debug: {
          subscriptionStatus: subscription.status,
          paymentIntentStatus: paymentIntent?.status,
          latestInvoiceStatus: latestInvoice?.status,
        }
      },
      { status: 500 }
    )
  } catch (error) {
    console.error('Erro ao criar assinatura:', error)
    
    // Log detalhado do erro
    if (error && typeof error === 'object') {
      console.error('Error details:', {
        message: (error as any).message,
        type: (error as any).type,
        code: (error as any).code,
        param: (error as any).param,
        decline_code: (error as any).decline_code,
        stack: (error as any).stack,
      })
    }
    
    // Retornar erro estruturado do Stripe se disponível
    if (error && typeof error === 'object' && (error as any).type) {
      return NextResponse.json(
        { 
          error: (error as any).message || 'Erro no pagamento',
          code: (error as any).code,
          type: (error as any).type,
          decline_code: (error as any).decline_code,
          param: (error as any).param
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
