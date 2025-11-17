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
import { usePricing } from '@/hooks/use-pricing'
import { formatPrice, calculateDiscount, calculatePixDiscount, getPixDiscountAmount } from '@/lib/price-utils'

type PlanType = 'monthly' | 'annual' | 'early'
type PaymentMethod = 'pix' | 'card'

interface OptimizedCheckoutProps {
  initialPlan?: PlanType
}

export function OptimizedCheckout({ initialPlan = 'monthly' }: OptimizedCheckoutProps) {
  const { status } = useSession()
  const { stats: alfaStats, isLoading: isLoadingStats } = useAlfa()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { monthly, annual, isLoading: isLoadingPricing } = usePricing()
  
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(
    (searchParams.get('plan') as PlanType) || initialPlan
  )
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Obter dados do plano selecionado baseado nas ofertas do backend
  const getPlanData = (planType: PlanType) => {
    if (planType === 'early') {
      return {
        name: 'Early Adopter',
        price: 118.80,
        originalPrice: null,
        discount: 'CONTRIBUIÇÃO',
        period: '/ano',
        description: 'Apoie o projeto com uma contribuição simbólica',
        features: [
          'Acesso antecipado a todas as novas features',
          'Badge exclusiva de Early Adopter',
          'Grupo WhatsApp exclusivo com CEO',
          'Seja reconhecido como pioneiro da plataforma'
        ],
        popular: true,
        exclusive: true,
        offerId: null,
      }
    }
    
    if (planType === 'monthly' && monthly) {
      return {
        name: 'Premium Mensal',
        price: monthly.price_in_cents / 100,
        originalPrice: null,
        discount: null,
        period: '/mês',
        description: 'Acesso completo por 30 dias',
        features: [
          'Análises ilimitadas de ações',
          'Comparador avançado',
          'Alertas em tempo real',
          'Suporte prioritário'
        ],
        offerId: monthly.id,
      }
    }
    
    if (planType === 'annual' && annual && monthly) {
      const discount = calculateDiscount(monthly.price_in_cents, annual.price_in_cents)
      return {
        name: 'Premium Anual',
        price: annual.price_in_cents / 100,
        originalPrice: (monthly.price_in_cents * 12) / 100,
        discount: `${Math.round(discount * 100)}% OFF`,
        period: '/ano',
        description: 'Melhor valor - 12 meses completos',
        features: [
          'Tudo do plano mensal',
          '2 meses grátis',
          'Relatórios exclusivos',
          'Consultoria personalizada'
        ],
        popular: true,
        offerId: annual.id,
      }
    }
    
    // Fallback para quando ainda está carregando
    return {
      name: planType === 'monthly' ? 'Premium Mensal' : 'Premium Anual',
      price: planType === 'monthly' ? 19.90 : 189.90,
      originalPrice: planType === 'annual' ? 238.80 : null,
      discount: planType === 'annual' ? '20% OFF' : null,
      period: planType === 'monthly' ? '/mês' : '/ano',
      description: planType === 'monthly' ? 'Acesso completo por 30 dias' : 'Melhor valor - 12 meses completos',
      features: [],
      offerId: null,
    }
  }

  const currentPlan = getPlanData(selectedPlan)
  
  // Calcular preço com desconto PIX
  const getPixPrice = () => {
    if (selectedPlan === 'early') return currentPlan.price
    const priceInCents = currentPlan.price * 100
    return calculatePixDiscount(priceInCents) / 100
  }
  
  const pixPrice = getPixPrice()
  const pixDiscountAmount = selectedPlan !== 'early' ? getPixDiscountAmount(currentPlan.price * 100) : 0

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

  if (status === 'loading' || isLoadingStats || isLoadingPricing || status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {status === 'loading' ? 'Verificando autenticação...' : 
             status === 'unauthenticated' ? 'Redirecionando para login...' :
             isLoadingPricing ? 'Carregando preços...' :
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
                    <span className="font-semibold text-purple-800">Fase Alfa - Seja um Early Adopter</span>
                  </div>
                  <p className="text-sm text-purple-700">
                    Apoie o projeto com uma <strong>contribuição simbólica</strong> e ganhe acesso Premium completo + benefícios exclusivos!
                  </p>
                </div>
              )}

              {/* Plan Selection */}
              <div className={`grid gap-6 mb-8 ${
                alfaStats?.phase === 'ALFA' 
                  ? 'grid-cols-1 max-w-md mx-auto' 
                  : 'md:grid-cols-2'
              }`}>
                {(() => {
                  const plansToShow: Array<{ key: PlanType; plan: ReturnType<typeof getPlanData> }> = []
                  
                  // Durante a fase ALFA, mostrar apenas o plano Early Adopter
                  if (alfaStats?.phase === 'ALFA') {
                    plansToShow.push({ key: 'early', plan: getPlanData('early') })
                  } else {
                    // Fora da fase ALFA, mostrar mensal e anual
                    if (monthly) {
                      plansToShow.push({ key: 'monthly', plan: getPlanData('monthly') })
                    }
                    if (annual) {
                      plansToShow.push({ key: 'annual', plan: getPlanData('annual') })
                    }
                  }
                  
                  return plansToShow.map(({ key, plan }) => (
                  <Card 
                    key={key}
                    className={`relative cursor-pointer transition-all duration-200 hover:shadow-lg ${
                      selectedPlan === key 
                        ? 'ring-2 ring-blue-500 shadow-lg' 
                        : 'hover:shadow-md'
                    } ${plan.popular ? 'border-blue-500' : ''}`}
                    onClick={() => setSelectedPlan(key)}
                  >
                    {plan.popular && (
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
                            {formatPrice(plan.price * 100)}
                          </span>
                          <span className="text-gray-500 ml-1">{plan.period}</span>
                        </div>
                        {plan.originalPrice && (
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <span className="text-sm text-gray-500 line-through">
                              {formatPrice(plan.originalPrice * 100)}
                            </span>
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              {plan.discount}
                            </Badge>
                          </div>
                        )}
                        {!plan.originalPrice && plan.discount && (
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                              {plan.discount}
                            </Badge>
                          </div>
                        )}
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
                  ))
                })()}
              </div>

              {/* Payment Method Selection */}
              <Card className="mb-6">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Escolha a forma de pagamento</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* PIX Option */}
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-center space-y-2 hover:bg-green-50 hover:border-green-300 transition-colors border-green-200"
                      onClick={() => handleMethodSelect('pix')}
                      disabled={isProcessing}
                    >
                      <Smartphone className="w-8 h-8 text-green-600" />
                      <div className="text-center">
                        <div className="font-medium">PIX</div>
                        <div className="text-sm text-gray-500">Aprovação instantânea</div>
                        <Badge variant="secondary" className="mt-1 bg-green-100 text-green-700 font-bold">
                          <Zap className="w-3 h-3 mr-1" />
                          5% OFF
                        </Badge>
                        {selectedPlan !== 'early' && (
                          <div className="text-xs text-green-600 font-semibold mt-1">
                            Economize {formatPrice(pixDiscountAmount)}
                          </div>
                        )}
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
                          price={pixPrice}
                          onSuccess={handlePaymentSuccess}
                          onError={handlePaymentError}
                        />
                      ) : (
                        <OptimizedCardPayment
                          planType={selectedPlan}
                          price={currentPlan.price}
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
                          <span>{currentPlan.name}</span>
                          <span>
                            {currentPlan.originalPrice ? (
                              <>
                                <span className="text-muted-foreground line-through mr-2">
                                  {formatPrice(currentPlan.originalPrice * 100)}
                                </span>
                                <span>{formatPrice(currentPlan.price * 100)}</span>
                              </>
                            ) : (
                              formatPrice(currentPlan.price * 100)
                            )}
                          </span>
                        </div>
                        {currentPlan.originalPrice && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Desconto Anual</span>
                            <span className="text-green-600 font-medium">
                              -{formatPrice((currentPlan.originalPrice - currentPlan.price) * 100)}
                            </span>
                          </div>
                        )}
                        {selectedMethod === 'pix' && selectedPlan !== 'early' && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Desconto PIX</span>
                            <span className="text-green-600 font-medium">
                              -{formatPrice(pixDiscountAmount)}
                            </span>
                          </div>
                        )}
                      </div>

                      <Separator className="my-4" />

                      <div className="flex justify-between font-semibold text-lg mb-4">
                        <span>Total</span>
                        <span className="text-blue-600">
                          {selectedMethod === 'pix' && selectedPlan !== 'early' 
                            ? formatPrice(pixPrice * 100)
                            : formatPrice(currentPlan.price * 100)}
                        </span>
                      </div>
                      {selectedMethod === 'pix' && selectedPlan !== 'early' && (
                        <div className="text-xs text-green-600 font-medium text-center mb-2">
                          💰 Você economiza {formatPrice(pixDiscountAmount)} pagando com PIX!
                        </div>
                      )}

                      <div className="text-xs text-gray-500 space-y-1">
                        <p>✓ Ativação imediata após pagamento</p>
                        <p>✓ Suporte incluído</p>
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

