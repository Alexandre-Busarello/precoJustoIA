'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAlfa } from '@/contexts/alfa-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  CreditCard, 
  Smartphone, 
  Check, 
  Shield, 
  Clock,
  Star,
  Zap,
  ArrowRight,
  Lock
} from 'lucide-react'
import { OptimizedPixPayment } from './optimized-pix-payment'
import { OptimizedCardPayment } from './optimized-card-payment'

type PlanType = 'monthly' | 'annual' | 'early'
type PaymentMethod = 'pix' | 'card'

const PLANS = {
  monthly: {
    name: 'Premium Mensal',
    price: 47,
    originalPrice: 97,
    discount: '52% OFF',
    period: '/mês',
    description: 'Acesso completo por 30 dias',
    features: [
      'Análises ilimitadas de ações',
      'Comparador avançado',
      'Alertas em tempo real',
      'Suporte prioritário'
    ]
  },
  annual: {
    name: 'Premium Anual',
    price: 470,
    originalPrice: 1164,
    discount: '60% OFF',
    period: '/ano',
    description: 'Melhor valor - 12 meses completos',
    features: [
      'Tudo do plano mensal',
      '2 meses grátis',
      'Relatórios exclusivos',
      'Consultoria personalizada'
    ],
    popular: true
  },
  early: {
    name: 'Early Adopter',
    price: 249,
    originalPrice: 497,
    discount: 'PREÇO CONGELADO',
    period: '/ano',
    description: 'Oferta exclusiva - Preço congelado para sempre',
    features: [
      'Tudo do Premium Anual',
      'Preço congelado para sempre',
      'Canal exclusivo WhatsApp com CEO',
      'Acesso antecipado a novos recursos',
      'Badge especial Early Adopter'
    ],
    popular: true,
    exclusive: true
  }
}

interface OptimizedCheckoutProps {
  initialPlan?: PlanType
}

export function OptimizedCheckout({ initialPlan = 'monthly' }: OptimizedCheckoutProps) {
  const { status } = useSession()
  const { stats: alfaStats, isLoading: isLoadingStats } = useAlfa()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(
    (searchParams.get('plan') as PlanType) || initialPlan
  )
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/checkout')
    }
  }, [status, router])

  // Ajustar plano selecionado baseado na fase ALFA
  useEffect(() => {
    if (alfaStats && !isLoadingStats) {
      if (alfaStats.phase === 'ALFA') {
        // Na fase ALFA, forçar seleção do Early Adopter se não foi especificado
        if (!searchParams.get('plan')) {
          setSelectedPlan('early')
        }
      } else {
        // Fora da fase ALFA, se o plano selecionado for Early Adopter, mudar para monthly
        if (selectedPlan === 'early') {
          setSelectedPlan('monthly')
        }
      }
    }
  }, [alfaStats, isLoadingStats, searchParams, selectedPlan])

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method)
    setShowPayment(true)
  }

  const handlePaymentSuccess = () => {
    router.push('/checkout/success')
  }

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error)
    setIsProcessing(false)
  }

  if (status === 'loading' || isLoadingStats || status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {status === 'loading' ? 'Verificando autenticação...' : 
             status === 'unauthenticated' ? 'Redirecionando para login...' :
             'Carregando opções de planos...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Escolha seu Plano Premium
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Desbloqueie todo o potencial da análise de ações
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {!showPayment ? (
            <>
              {/* Aviso da Fase ALFA */}
              {alfaStats?.phase === 'ALFA' && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 mb-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Star className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-purple-800">Fase Alfa - Oferta Especial</span>
                  </div>
                  <p className="text-sm text-purple-700">
                    Durante a Fase Alfa, apenas o plano <strong>Early Adopter</strong> está disponível com preço congelado para sempre!
                  </p>
                </div>
              )}

              {/* Plan Selection */}
              <div className={`grid gap-6 mb-8 ${
                alfaStats?.phase === 'ALFA' 
                  ? 'grid-cols-1 max-w-md mx-auto' 
                  : 'md:grid-cols-2'
              }`}>
                {Object.entries(PLANS)
                  .filter(([key]) => {
                    // Durante a fase ALFA, mostrar apenas o plano Early Adopter
                    if (alfaStats?.phase === 'ALFA') {
                      return key === 'early'
                    }
                    // Fora da fase ALFA, mostrar todos os planos exceto Early Adopter
                    return key !== 'early'
                  })
                  .map(([key, plan]) => (
                  <Card 
                    key={key}
                    className={`relative cursor-pointer transition-all duration-200 hover:shadow-lg ${
                      selectedPlan === key 
                        ? 'ring-2 ring-blue-500 shadow-lg' 
                        : 'hover:shadow-md'
                    } ${(plan as any).popular ? 'border-blue-500' : ''}`}
                    onClick={() => setSelectedPlan(key as PlanType)}
                  >
                    {(plan as any).popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-blue-500 text-white px-4 py-1">
                          <Star className="w-3 h-3 mr-1" />
                          Mais Popular
                        </Badge>
                      </div>
                    )}
                    
                    <CardContent className="p-6">
                      <div className="text-center mb-4">
                        <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                        <div className="mb-2">
                          <span className="text-3xl font-bold text-blue-600">
                            R$ {plan.price}
                          </span>
                          <span className="text-gray-500 ml-1">{plan.period}</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <span className="text-sm text-gray-500 line-through">
                            R$ {plan.originalPrice}
                          </span>
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            {plan.discount}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{plan.description}</p>
                      </div>

                      <ul className="space-y-2 mb-4">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-center text-sm">
                            <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      {selectedPlan === key && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="flex items-center text-blue-700 dark:text-blue-300">
                            <Check className="w-4 h-4 mr-2" />
                            <span className="text-sm font-medium">Plano selecionado</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Payment Method Selection */}
              <Card className="mb-6">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Escolha a forma de pagamento</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* PIX Option */}
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-center space-y-2 hover:bg-green-50 hover:border-green-300 transition-colors"
                      onClick={() => handleMethodSelect('pix')}
                      disabled={isProcessing}
                    >
                      <Smartphone className="w-8 h-8 text-green-600" />
                      <div className="text-center">
                        <div className="font-medium">PIX</div>
                        <div className="text-sm text-gray-500">Aprovação instantânea</div>
                        <Badge variant="secondary" className="mt-1 bg-green-100 text-green-700">
                          <Zap className="w-3 h-3 mr-1" />
                          Mais rápido
                        </Badge>
                      </div>
                    </Button>

                    {/* Card Option */}
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-center space-y-2 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      onClick={() => handleMethodSelect('card')}
                      disabled={isProcessing}
                    >
                      <CreditCard className="w-8 h-8 text-blue-600" />
                      <div className="text-center">
                        <div className="font-medium">Cartão de Crédito</div>
                        <div className="text-sm text-gray-500">Assinatura recorrente</div>
                        <Badge variant="secondary" className="mt-1">
                          <ArrowRight className="w-3 h-3 mr-1" />
                          Automático
                        </Badge>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Trust Indicators */}
              <div className="flex items-center justify-center space-x-6 text-sm text-gray-500 mb-6">
                <div className="flex items-center">
                  <Shield className="w-4 h-4 mr-1" />
                  Pagamento Seguro
                </div>
                <div className="flex items-center">
                  <Lock className="w-4 h-4 mr-1" />
                  SSL Criptografado
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Ativação Imediata
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Payment Form */}
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Payment Component */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold">
                          {selectedMethod === 'pix' ? 'Pagamento via PIX' : 'Pagamento com Cartão'}
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPayment(false)}
                        >
                          Voltar
                        </Button>
                      </div>

                      {selectedMethod === 'pix' ? (
                        <OptimizedPixPayment
                          planType={selectedPlan}
                          price={PLANS[selectedPlan].price}
                          onSuccess={handlePaymentSuccess}
                          onError={handlePaymentError}
                        />
                      ) : (
                        <OptimizedCardPayment
                          planType={selectedPlan}
                          price={PLANS[selectedPlan].price}
                          onSuccess={handlePaymentSuccess}
                          onError={handlePaymentError}
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Order Summary */}
                <div className="lg:col-span-1">
                  <Card className="sticky top-4">
                    <CardContent className="p-6">
                      <h3 className="font-semibold mb-4">Resumo do Pedido</h3>
                      
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between">
                          <span>{PLANS[selectedPlan].name}</span>
                          <span>R$ {PLANS[selectedPlan].price}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>Desconto</span>
                          <span className="text-green-600">
                            -R$ {PLANS[selectedPlan].originalPrice - PLANS[selectedPlan].price}
                          </span>
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <div className="flex justify-between font-semibold text-lg mb-4">
                        <span>Total</span>
                        <span className="text-blue-600">R$ {PLANS[selectedPlan].price}</span>
                      </div>

                      <div className="text-xs text-gray-500 space-y-1">
                        <p>✓ Ativação imediata após pagamento</p>
                        <p>✓ Suporte 24/7 incluído</p>
                        <p>✓ Garantia de 7 dias</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

