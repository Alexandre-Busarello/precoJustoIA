'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { isOfferActiveForPurchase } from '@/lib/offer-utils'
import Link from 'next/link'

type PlanType = 'monthly' | 'annual'
type PaymentMethod = 'pix' | 'card'

interface OptimizedCheckoutProps {
  initialPlan?: PlanType
}

export function OptimizedCheckout({ initialPlan = 'monthly' }: OptimizedCheckoutProps) {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { monthly, annual, special, isLoading: isLoadingPricing } = usePricing()
  
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(
    (searchParams.get('plan') as PlanType) || initialPlan
  )
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Obter dados do plano selecionado baseado nas ofertas do backend
  const getPlanData = (planType: PlanType) => {
    if (planType === 'monthly' && monthly) {
      return {
        name: 'Premium Mensal',
        price: monthly.price_in_cents / 100,
        originalPrice: null,
        discount: null,
        period: '/mês',
        description: 'Acesso completo por 30 dias',
        features: [
          'Tudo do plano gratuito',
          '8 modelos de valuation',
          '🤖 Análise com IA (Gemini)',
          '🚀 Backtesting de Carteiras',
          'Comparador completo',
          'Rankings ilimitados',
          'Análise individual por empresacompleta',
          'Relatórios mensais personalizados por IA',
          'Suporte prioritário',
          'Central de Suporte Premium'
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
          'Tudo do Premium Mensal',
          `${Math.round(discount * 100)}% de desconto`,
          'Acesso antecipado a novos recursos',
          'Suporte VIP',
          'Central de Suporte Premium'
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
    const priceInCents = currentPlan.price * 100
    return calculatePixDiscount(priceInCents) / 100
  }
  
  const pixPrice = getPixPrice()
  const pixDiscountAmount = getPixDiscountAmount(currentPlan.price * 100)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/checkout')
    }
  }, [status, router])


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

  if (status === 'loading' || isLoadingPricing || status === 'unauthenticated') {
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

  // Verificar se há oferta especial ativa
  const hasActiveSpecialOffer = special && isOfferActiveForPurchase({
    is_active: true,
    expires_at: special.expires_at ? new Date(special.expires_at) : null
  })

  // Calcular desconto da oferta especial comparando com oferta anual
  const calculateSpecialDiscount = () => {
    if (!special || !annual) return null
    
    const annualPrice = annual.price_in_cents
    const specialPrice = special.price_in_cents
    const discountAmount = annualPrice - specialPrice
    
    if (discountAmount <= 0) return null
    
    return {
      amount: discountAmount,
      formatted: formatPrice(discountAmount),
      percentage: Math.round((discountAmount / annualPrice) * 100)
    }
  }
  
  const specialDiscount = calculateSpecialDiscount()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Special Offer Banner */}
        {hasActiveSpecialOffer && (
          <Card className="mb-6 border-2 border-orange-500 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                      ⚡ Oferta Especial Disponível!
                    </h3>
                    <Badge variant="default" className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                      Oferta Limitada
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {specialDiscount ? (
                      <>
                        Aproveite nossa oferta especial com desconto exclusivo. {specialDiscount.formatted} de economia ({specialDiscount.percentage}% OFF)!
                      </>
                    ) : (
                      'Aproveite nossa oferta especial com desconto exclusivo. Oportunidade única!'
                    )}
                  </p>
                </div>
                <Link href="/checkout/oferta-especial">
                  <Button className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold">
                    Ver Oferta Especial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

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
              {/* Plan Selection */}
              <div className="grid gap-6 mb-8 md:grid-cols-2">
                {(() => {
                  const plansToShow: Array<{ key: PlanType; plan: ReturnType<typeof getPlanData> }> = []
                  
                  // Mostrar mensal e anual
                  if (monthly) {
                    plansToShow.push({ key: 'monthly', plan: getPlanData('monthly') })
                  }
                  if (annual) {
                    plansToShow.push({ key: 'annual', plan: getPlanData('annual') })
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
                        <div className="text-xs text-green-600 font-semibold mt-1">
                          Economize {formatPrice(pixDiscountAmount)}
                        </div>
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
                        {selectedMethod === 'pix' && (
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
                          {selectedMethod === 'pix' 
                            ? formatPrice(pixPrice * 100)
                            : formatPrice(currentPlan.price * 100)}
                        </span>
                      </div>
                      {selectedMethod === 'pix' && (
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

