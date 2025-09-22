'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { 
  CreditCard, 
  Smartphone, 
  CheckCircle,
  AlertCircle
} from "lucide-react"
import { PixPayment } from './pix-payment'
import { CardPayment } from './card-payment'
import { useRouter } from 'next/navigation'

interface CheckoutFormProps {
  priceId: string
  planName: string
  price: number
  planType: 'monthly' | 'annual'
}

export function CheckoutForm({ priceId, planName, price, planType }: CheckoutFormProps) {
  const [selectedMethod, setSelectedMethod] = useState<'pix' | 'card'>('pix')
  const [error, setError] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const router = useRouter()

  const handleSuccess = () => {
    router.push('/checkout/success')
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
  }

  return (
    <div className="space-y-6">
      {/* Seleção do Método de Pagamento */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Escolha o método de pagamento</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PIX */}
          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              selectedMethod === 'pix' 
                ? 'border-2 border-green-500 bg-green-50 dark:bg-green-950/20' 
                : 'border hover:border-green-300'
            }`}
            onClick={() => setSelectedMethod('pix')}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold">PIX</h4>
                    <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs px-2 py-1 rounded-full font-medium">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Via MercadoPago • Instantâneo
                  </p>
                </div>
                {selectedMethod === 'pix' && (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cartão */}
          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              selectedMethod === 'card' 
                ? 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                : 'border hover:border-blue-300'
            }`}
            onClick={() => setSelectedMethod('card')}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold">Cartão de Crédito/Débito</h4>
                  <p className="text-sm text-muted-foreground">
                    Via Stripe • Recorrente
                  </p>
                </div>
                {selectedMethod === 'card' && (
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Informações do Método Selecionado */}
      {selectedMethod === 'pix' && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-green-600 mt-1" />
              <div>
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                  Como funciona o pagamento via PIX:
                </h4>
                <ol className="text-sm text-green-800 dark:text-green-200 space-y-1">
                  <li>1. Clique em Finalizar Pagamento</li>
                  <li>2. Você será redirecionado para o MercadoPago</li>
                  <li>3. Escaneie o QR Code ou copie o código PIX</li>
                  <li>4. Confirme o pagamento no seu banco</li>
                  <li>5. Sua conta será ativada instantaneamente</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedMethod === 'card' && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Pagamento com cartão:
                </h4>
                <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <p>• Assinatura recorrente automática</p>
                  <p>• Suporte a Visa, Mastercard, Elo e outros</p>
                  <p>• Processamento seguro via Stripe</p>
                  <p>• Renovação automática sem interrupção</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Erro */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div>
                <h4 className="font-semibold text-red-900 dark:text-red-100">
                  Erro no pagamento
                </h4>
                <p className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botão para mostrar pagamento */}
      {!showPayment && (
        <Card className="border-2 border-violet-200 dark:border-violet-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold">{planName}</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedMethod === 'pix' ? 'Pagamento via PIX (MercadoPago)' : 'Assinatura via Cartão (Stripe)'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  R$ {price.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedMethod === 'pix' ? 'À vista' : 'Recorrente'}
                </div>
              </div>
            </div>

            <Button 
              onClick={() => setShowPayment(true)}
              className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-4 text-lg"
              size="lg"
            >
              {selectedMethod === 'pix' ? (
                <>
                  <Smartphone className="w-5 h-5 mr-2" />
                  Gerar PIX
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Pagar com Cartão
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Ao continuar, você concorda com nossos{' '}
              <a href="#" className="text-violet-600 hover:underline">Termos de Uso</a>
              {' '}e{' '}
              <a href="#" className="text-violet-600 hover:underline">Política de Privacidade</a>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Componentes de Pagamento Integrados */}
      {showPayment && (
        <div className="space-y-6">
          {selectedMethod === 'pix' ? (
            <PixPayment
              planType={planType}
              planName={planName}
              price={price}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          ) : (
            <CardPayment
              priceId={priceId}
              planName={planName}
              price={price}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          )}

          <Button 
            onClick={() => setShowPayment(false)}
            variant="outline"
            className="w-full"
          >
            Voltar à Seleção de Método
          </Button>
        </div>
      )}
    </div>
  )
}
