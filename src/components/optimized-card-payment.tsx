'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  CreditCard, 
  Lock, 
  CheckCircle,
  RefreshCw,
  Shield
} from 'lucide-react'
import { usePaymentVerification } from '@/components/session-refresh-provider'
import { StripeErrorDisplay, PaymentProcessingError } from '@/components/stripe-error-display'
import { formatStripeError } from '@/lib/stripe-error-handler'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface OptimizedCardPaymentProps {
  planType: 'monthly' | 'annual' | 'special'
  price: number
  onSuccess: () => void
  onError: (error: string) => void
}

const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
      padding: '12px',
    },
    invalid: {
      color: '#9e2146',
    },
  },
  hidePostalCode: true,
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
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-green-600 mb-2">
          Pagamento Aprovado!
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Sua assinatura Premium foi ativada com sucesso
        </p>
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Dados do Cartão</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Assinatura recorrente - cancele quando quiser
        </p>
      </div>

      {/* Error Display - Inline */}
      {paymentStatus === 'idle' && currentError && (
        <StripeErrorDisplay
          error={currentError}
          onRetry={handleRetry}
          onNewCard={handleNewCard}
          onContactSupport={handleContactSupport}
          loading={loading}
        />
      )}

      {/* Card Input */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Número do cartão, validade e CVV
              </label>
              <div className="border rounded-lg p-3 bg-white dark:bg-gray-800">
                <CardElement options={cardElementOptions} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Info */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              Pagamento Seguro
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Seus dados são protegidos com criptografia SSL de 256 bits. 
              Processamento via Stripe, líder mundial em segurança de pagamentos.
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          ✨ Sua assinatura inclui:
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Renovação automática</li>
          <li>• Cancele a qualquer momento</li>
          <li>• Acesso imediato após pagamento</li>
          <li>• Suporte prioritário</li>
        </ul>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={!stripe || loading}
        size="lg"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
      >
        {loading ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 mr-2" />
            Finalizar Assinatura - R$ {price}
          </>
        )}
      </Button>

      {/* Terms */}
      <p className="text-xs text-gray-500 text-center">
        Ao finalizar, você concorda com nossos{' '}
        <a href="/termos-de-uso" className="text-blue-600 hover:underline">
          Termos de Uso
        </a>{' '}
        e{' '}
        <a href="/lgpd" className="text-blue-600 hover:underline">
          Política de Privacidade
        </a>
      </p>
    </form>
  )
}

export function OptimizedCardPayment(props: OptimizedCardPaymentProps) {
  return (
    <Elements stripe={stripePromise}>
      <CardPaymentForm {...props} />
    </Elements>
  )
}

