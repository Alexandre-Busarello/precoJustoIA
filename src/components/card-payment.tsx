'use client'

import { useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  CreditCard, 
  Loader2,
  Shield,
  CheckCircle
} from "lucide-react"
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface CardPaymentProps {
  priceId: string
  planName: string
  price: number
  onSuccess: () => void
  onError: (error: string) => void
}

function CardPaymentForm({ priceId, planName, price, onSuccess, onError }: CardPaymentProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setLoading(true)

    try {
      // Criar sessão de checkout
      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erro ao criar sessão de checkout')
      }

      const { sessionId } = await response.json()

      // Redirecionar para checkout
      const { error } = await stripe.redirectToCheckout({
        sessionId,
      })

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Erro no pagamento:', error)
      onError(error instanceof Error ? error.message : 'Erro ao processar pagamento')
    } finally {
      setLoading(false)
    }
  }

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
      <CardContent className="p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-blue-600" />
          </div>
          
          <h3 className="text-xl font-bold mb-2">Pagamento com Cartão</h3>
          <p className="text-muted-foreground">
            Assinatura recorrente processada pelo Stripe
          </p>
        </div>

        <div className="bg-white/50 dark:bg-background/50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium">{planName}</span>
            <span className="text-xl font-bold text-blue-600">
              R$ {price.toFixed(2)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Cobrança recorrente • Cancele quando quiser
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-background rounded-lg p-4 border">
            <label className="block text-sm font-medium mb-2">
              Dados do Cartão
            </label>
            <CardElement options={cardElementOptions} />
          </div>

          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-800 dark:text-green-200">
                Pagamento Seguro
              </span>
            </div>
            <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Processado pelo Stripe (certificação PCI DSS)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Dados criptografados com SSL</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Renovação automática, cancele quando quiser</span>
              </div>
            </div>
          </div>

          <Button 
            type="submit"
            disabled={!stripe || loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Finalizar Assinatura
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Ao confirmar, você concorda com nossos{' '}
            <a href="#" className="text-blue-600 hover:underline">Termos de Uso</a>
            {' '}e{' '}
            <a href="#" className="text-blue-600 hover:underline">Política de Privacidade</a>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

export function CardPayment(props: CardPaymentProps) {
  return (
    <Elements stripe={stripePromise}>
      <CardPaymentForm {...props} />
    </Elements>
  )
}
