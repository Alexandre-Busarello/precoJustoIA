'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import type { Stripe } from '@stripe/stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { CheckCircle, Lock, RefreshCw } from 'lucide-react'
import { formatBRL } from '@/lib/format'
import { usePaymentVerification } from '@/components/session-refresh-provider'
import { StripeErrorDisplay, PaymentProcessingError } from '@/components/stripe-error-display'
import { formatStripeError } from '@/lib/stripe-error-handler'

// Stripe.js só é baixado quando o formulário de cartão é renderizado (não no import do módulo).
// Se o script falhar (bloqueador de anúncios, rede), a promessa resolve null e o botão fica desabilitado
// em vez de gerar uma rejeição não tratada.
let stripePromise: Promise<Stripe | null> | null = null
function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!).catch((error: unknown) => {
      console.error('Falha ao carregar o Stripe.js', error)
      stripePromise = null
      return null
    })
  }
  return stripePromise
}

interface OptimizedCardPaymentProps {
  planType: 'monthly' | 'annual' | 'special'
  price: number
  onSuccess: () => void
  onError: (error: string) => void
}

/** O CardElement roda num iframe do Stripe e não lê CSS vars: cores fixas por tema, próximas dos tokens. */
function getCardElementOptions(isDark: boolean) {
  return {
    style: {
      base: {
        fontSize: '16px',
        color: isDark ? '#eef0f3' : '#1f2230',
        iconColor: isDark ? '#a3a8b3' : '#6b7080',
        '::placeholder': {
          color: isDark ? '#8a8f99' : '#6b7080',
        },
      },
      invalid: {
        color: isDark ? '#f0877c' : '#c2352b',
        iconColor: isDark ? '#f0877c' : '#c2352b',
      },
    },
    hidePostalCode: true,
  }
}

function CardPaymentForm({ planType, price, onSuccess, onError }: OptimizedCardPaymentProps) {
  const { data: session } = useSession()
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [setupData, setSetupData] = useState<any>(null)
  const [currentError, setCurrentError] = useState<any>(null)
  const { startVerification } = usePaymentVerification()
  const { resolvedTheme } = useTheme()
  const cardElementOptions = getCardElementOptions(resolvedTheme === 'dark')

  const handleRetry = () => {
    setPaymentStatus('idle')
    setCurrentError(null)
    // Manter setupData para não recriar o Setup Intent
  }

  const handleNewCard = () => {
    setPaymentStatus('idle')
    setCurrentError(null)
    setSetupData(null) // Limpar setupData para forçar novo Setup Intent
  }

  const handleContactSupport = () => {
    window.open('/contato', '_blank')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements || !session?.user?.email) {
      onError('Erro de inicialização do pagamento')
      return
    }

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      onError('Elemento do cartão não encontrado')
      return
    }

    setLoading(true)
    setPaymentStatus('processing')
    setCurrentError(null)

    try {
      // Etapa 1: Criar Setup Intent
      if (!setupData) {
        const setupResponse = await fetch('/api/payment/create-setup-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planType }),
        })

        if (!setupResponse.ok) {
          const error = await setupResponse.json()
          throw { type: 'api_error', message: error.error || 'Erro ao criar setup intent' }
        }

        const setupResult = await setupResponse.json()
        setSetupData(setupResult)

        // Etapa 2: Confirmar Setup Intent com o cartão
        const { error: setupError, setupIntent } = await stripe.confirmCardSetup(
          setupResult.clientSecret,
          {
            payment_method: {
              card: cardElement,
              billing_details: {
                name: session.user.name || session.user.email,
                email: session.user.email,
              },
            },
          }
        )

        if (setupError) {
          throw setupError
        }

        if (setupIntent?.status !== 'succeeded') {
          throw { type: 'setup_failed', message: 'Falha ao configurar método de pagamento' }
        }

        // Etapa 3: Criar assinatura
        const subscriptionResponse = await fetch('/api/payment/create-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            setupIntentId: setupIntent.id,
            priceId: setupResult.priceId,
          }),
        })

        if (!subscriptionResponse.ok) {
          const error = await subscriptionResponse.json()
          throw { type: 'subscription_error', message: error.error || 'Erro ao criar assinatura' }
        }

        const subscriptionResult = await subscriptionResponse.json()

        if (subscriptionResult.status === 'requires_action') {
          // Confirmar pagamento adicional se necessário
          const { error: confirmError } = await stripe.confirmCardPayment(
            subscriptionResult.clientSecret
          )

          if (confirmError) {
            throw confirmError
          }
        }

        setPaymentStatus('success')
        
        // Iniciar verificação de pagamento para atualizar sessão
        startVerification()
        
        setTimeout(onSuccess, 2000)
      }
    } catch (error) {
      console.error('Erro no pagamento:', error)
      setCurrentError(error)
      setPaymentStatus('error')
      
      // Manter compatibilidade com callback de erro existente
      const errorInfo = formatStripeError(error)
      onError(errorInfo.message)
    } finally {
      setLoading(false)
    }
  }

  if (paymentStatus === 'success') {
    return (
      <div role="status" className="py-6 text-center">
        <CheckCircle className="mx-auto size-10 text-positive" strokeWidth={1.75} aria-hidden="true" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">Pagamento aprovado</h3>
        <p className="mt-1 text-sm text-muted-foreground">Sua assinatura Premium foi ativada. Redirecionando.</p>
      </div>
    )
  }

  if (paymentStatus === 'error' && currentError) {
    return (
      <PaymentProcessingError
        error={currentError}
        onRetry={handleRetry}
        onCancel={() => setPaymentStatus('idle')}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Dados do cartão</h3>
        <p className="mt-1 text-sm text-muted-foreground">Assinatura com renovação automática. Cancele quando quiser.</p>
      </div>

      {paymentStatus === 'idle' && currentError && (
        <StripeErrorDisplay
          error={currentError}
          onRetry={handleRetry}
          onNewCard={handleNewCard}
          onContactSupport={handleContactSupport}
          loading={loading}
        />
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">Número do cartão, validade e CVV</label>
        <div className="rounded-md border border-input bg-background px-3 py-3.5 focus-within:border-brand focus-within:ring-[3px] focus-within:ring-ring">
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Os dados do cartão são enviados direto ao Stripe, com criptografia. Não armazenamos o número do cartão.
      </p>

      <Button type="submit" disabled={!stripe || loading} className="h-12 w-full md:h-10">
        {loading ? (
          <>
            <RefreshCw className="size-4 animate-spin" strokeWidth={1.75} />
            Processando
          </>
        ) : (
          <>Assinar por {formatBRL(price)}</>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Ao assinar, você concorda com os{' '}
        <a href="/termos-de-uso" className="text-brand underline-offset-4 hover:underline">
          Termos de Uso
        </a>{' '}
        e a{' '}
        <a href="/lgpd" className="text-brand underline-offset-4 hover:underline">
          Política de Privacidade
        </a>
        .
      </p>
    </form>
  )
}

export function OptimizedCardPayment(props: OptimizedCardPaymentProps) {
  return (
    <Elements stripe={getStripe()}>
      <CardPaymentForm {...props} />
    </Elements>
  )
}

