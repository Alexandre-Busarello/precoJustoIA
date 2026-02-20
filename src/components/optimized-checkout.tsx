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
  ArrowLeft,
  Lock,
  ChevronDown
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { OptimizedPixPayment } from './optimized-pix-payment'
import { buildCheckoutUrl } from './kiwify-checkout-link'
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
  const { status, data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { monthly, annual, special, isLoading: isLoadingPricing } = usePricing()
  
  const [step, setStep] = useState<'plan' | 'payment'>('plan')
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null)
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
          'Análise de IA e Relatórios',
          'Análise Técnica e Preço Justo Técnico',
          'Radar de Oportunidades',
          'Análise de Sentimento de Mercado',
          'Radar de Dividendos com projeções por IA',
          'Valuation e Screening Completo',
          'Backtesting e Carteiras',
          'Comparador completo',
          'Rankings ilimitados',
          'Análise individual por empresa',
          'Relatórios mensais personalizados',
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
          'Análise de IA e Relatórios',
          'Análise Técnica e Preço Justo Técnico',
          'Radar de Oportunidades',
          'Análise de Sentimento de Mercado',
          'Radar de Dividendos com projeções por IA',
          'Valuation e Screening Completo',
          'Backtesting e Carteiras',
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

  const currentPlan = selectedPlan ? getPlanData(selectedPlan) : null
  
  // Calcular preço com desconto PIX
  const getPixPrice = () => {
    if (!currentPlan) return 0
    const priceInCents = currentPlan.price * 100
    return calculatePixDiscount(priceInCents) / 100
  }
  
  const pixPrice = getPixPrice()
  const pixDiscountAmount = currentPlan ? getPixDiscountAmount(currentPlan.price * 100) : 0

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/checkout')
    }
  }, [status, router])

  const handlePlanSelect = (plan: PlanType) => {
    setSelectedPlan(plan)
    if (plan === 'monthly') {
      // Mensal: somente PIX - vai direto para geração do PIX, sem etapa de seleção
      setSelectedMethod('pix')
      setShowPayment(true)
    } else {
      setStep('payment')
    }
  }

  const handleBackToPlans = () => {
    setStep('plan')
    setSelectedPlan(null)
    setSelectedMethod(null)
    setShowPayment(false)
  }

  const handleMethodSelect = (method: PaymentMethod) => {
    // Cartão: apenas para plano anual - redireciona para Kiwify
    if (method === 'card' && selectedPlan === 'annual') {
      const userEmail = session?.user?.email ?? null
      const kiwifyUrl = buildCheckoutUrl(searchParams, { email: userEmail })
      window.location.href = kiwifyUrl
      return
    }
    setSelectedMethod(method)
    setShowPayment(true)
  }

  const handleBackToPaymentMethods = () => {
    setShowPayment(false)
    setSelectedMethod(null)
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
                        Aproveite nossa oferta especial com desconto exclusivo. {specialDiscount.formatted} de economia ({specialDiscount.percentage}% OFF) em comparação com nosso plano anual ativo!
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
            {showPayment 
              ? 'Pagamento via PIX' 
              : step === 'plan' 
                ? 'Escolha seu Plano Premium' 
                : 'Escolha a forma de pagamento'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {showPayment && currentPlan
              ? `${currentPlan.name} — ${formatPrice(pixPrice * 100)} com 5% OFF`
              : step === 'plan' 
                ? 'Desbloqueie todo o potencial da análise de ações' 
                : currentPlan 
                  ? `${currentPlan.name} - ${formatPrice(currentPlan.price * 100)}${currentPlan.period}`
                  : 'Desbloqueie todo o potencial da análise de ações'}
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {showPayment ? (
            <>
              {/* Etapa 3: Formulário PIX (mensal vai direto, anual após escolher PIX) */}
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold">Pagamento via PIX</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={selectedPlan === 'monthly' ? handleBackToPlans : handleBackToPaymentMethods}
                          className="flex items-center gap-1"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Voltar
                        </Button>
                      </div>

                      {selectedPlan && (
                        <OptimizedPixPayment
                          planType={selectedPlan}
                          price={pixPrice}
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
                      
                      {currentPlan && (
                        <>
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
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Desconto PIX</span>
                              <span className="text-green-600 font-medium">
                                -{formatPrice(pixDiscountAmount)}
                              </span>
                            </div>
                          </div>

                          <Separator className="my-4" />

                          <div className="flex justify-between font-semibold text-lg mb-4">
                            <span>Total</span>
                            <span className="text-blue-600">
                              {formatPrice(pixPrice * 100)}
                            </span>
                          </div>
                          <div className="text-xs text-green-600 font-medium text-center mb-2">
                            💰 Você economiza {formatPrice(pixDiscountAmount)} pagando com PIX!
                          </div>
                        </>
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
          ) : step === 'payment' ? (
            <>
              {/* Etapa 2: Método de pagamento (apenas anual) */}
              <Card className="mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBackToPlans}
                      className="flex items-center gap-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Voltar
                    </Button>
                    {currentPlan && (
                      <div className="flex-1 text-sm text-gray-600">
                        Plano selecionado: <span className="font-semibold text-gray-900 dark:text-white">{currentPlan.name}</span>
                        {' '}— {formatPrice(currentPlan.price * 100)}{currentPlan.period}
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-4">Escolha a forma de pagamento</h3>
                  
                  <div className="grid gap-4 md:grid-cols-2">
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

                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-center space-y-2 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      onClick={() => handleMethodSelect('card')}
                      disabled={isProcessing}
                    >
                      <CreditCard className="w-8 h-8 text-blue-600" />
                      <div className="text-center">
                        <div className="font-medium">Cartão de Crédito</div>
                        <Badge variant="secondary" className="mt-1">
                          <ArrowRight className="w-3 h-3 mr-1" />
                          Checkout Kiwify
                        </Badge>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>

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
              {/* Etapa 1: Seleção de plano */}
              {(() => {
                const plansToShow: Array<{ key: PlanType; plan: ReturnType<typeof getPlanData> }> = []
                if (monthly) plansToShow.push({ key: 'monthly', plan: getPlanData('monthly') })
                if (annual) plansToShow.push({ key: 'annual', plan: getPlanData('annual') })
                const annualDiscount = monthly && annual 
                  ? Math.round(calculateDiscount(monthly.price_in_cents, annual.price_in_cents) * 100) 
                  : 20

                const PlanCardContent = ({ planKey, plan }: { planKey: PlanType; plan: ReturnType<typeof getPlanData> }) => (
                  <>
                    <div className="text-center mb-4">
                      <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                      <div className="mb-2">
                        <span className={`font-bold ${planKey === 'annual' ? 'text-3xl text-blue-600' : 'text-2xl text-gray-700 dark:text-gray-300'}`}>
                          {formatPrice(plan.price * 100)}
                        </span>
                        <span className="text-gray-500 ml-1">{plan.period}</span>
                      </div>
                      {plan.originalPrice && (
                        <div className="flex flex-col items-center gap-1 mb-2">
                          <span className="text-sm text-gray-500 line-through">
                            {formatPrice(plan.originalPrice * 100)}/ano (12x mensal)
                          </span>
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 font-bold">
                            {plan.discount} — Economia garantida
                          </Badge>
                        </div>
                      )}
                      {planKey === 'annual' && (
                        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 py-2 px-3 rounded-lg mt-2">
                          Tudo do plano mensal + {annualDiscount}% de desconto
                        </p>
                      )}
                      {planKey === 'monthly' && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 py-1.5 px-2 rounded mt-2">
                          Pagamento apenas via PIX (5% OFF)
                        </p>
                      )}
                    </div>
                    <ul className="space-y-2 mb-4">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center text-sm">
                          <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                      {planKey === 'annual' && (
                        <li className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400">
                          <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                          PIX ou Cartão de Crédito
                        </li>
                      )}
                    </ul>
                    <div className={`mt-4 flex items-center justify-center font-medium text-sm ${
                      planKey === 'annual' ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 py-2 rounded-lg' : 'text-gray-600'
                    }`}>
                      {planKey === 'monthly' ? 'Pagar com PIX' : 'Escolher forma de pagamento'}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </>
                )

                return (
                  <>
                    {/* Mobile: Accordion com header de oferta + benefícios expandíveis */}
                    <div className="md:hidden space-y-4 mb-8">
                      {plansToShow.map(({ key, plan }) => (
                        <Card
                          key={key}
                          className={`relative overflow-hidden ${
                            key === 'annual' 
                              ? 'ring-2 ring-blue-500 border-2 border-blue-500 shadow-lg bg-blue-50/30 dark:bg-blue-950/20' 
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {/* Header: destaque da oferta - clicável para selecionar */}
                          <div
                            className="p-4 cursor-pointer"
                            onClick={() => handlePlanSelect(key)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <h3 className="text-lg font-bold">{plan.name}</h3>
                                  {key === 'annual' && (
                                    <Badge className="bg-blue-500 text-white text-xs">
                                      <Star className="w-3 h-3 mr-0.5" />
                                      Melhor valor
                                    </Badge>
                                  )}
                                  {key === 'monthly' && (
                                    <Badge variant="outline" className="text-xs bg-green-50 border-green-300 text-green-700">
                                      <Smartphone className="w-3 h-3 mr-0.5" />
                                      PIX
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-baseline gap-1">
                                  <span className={`text-2xl font-bold ${key === 'annual' ? 'text-blue-600' : 'text-gray-900 dark:text-white'}`}>
                                    {formatPrice(plan.price * 100)}
                                  </span>
                                  <span className="text-sm text-gray-500">{plan.period}</span>
                                </div>
                                {plan.originalPrice && (
                                  <p className="text-xs text-gray-500 mt-0.5 line-through">
                                    {formatPrice(plan.originalPrice * 100)}/ano
                                  </p>
                                )}
                              </div>
                              <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                            </div>
                          </div>

                          {/* Accordion: benefícios expandíveis */}
                          <Collapsible>
                            <CollapsibleTrigger
                              onClick={(e) => e.stopPropagation()}
                              className="group flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 border-t"
                            >
                              Ver benefícios
                              <ChevronDown className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="px-4 pb-4 pt-2 border-t bg-gray-50/50 dark:bg-gray-800/30">
                                <ul className="space-y-2">
                                  {plan.features.map((feature, index) => (
                                    <li key={index} className="flex items-center text-sm">
                                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                                      {feature}
                                    </li>
                                  ))}
                                  {key === 'annual' && (
                                    <li className="flex items-center text-sm font-medium text-blue-600">
                                      <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                                      PIX ou Cartão de Crédito
                                    </li>
                                  )}
                                </ul>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </Card>
                      ))}
                    </div>

                    {/* Desktop: cards completos */}
                    <div className="hidden md:grid gap-6 mb-8 md:grid-cols-2">
                      {plansToShow.map(({ key, plan }) => (
                        <Card 
                          key={key}
                          className={`relative cursor-pointer transition-all duration-200 hover:shadow-lg ${
                            key === 'annual' 
                              ? 'ring-2 ring-blue-500 border-2 border-blue-500 shadow-lg bg-blue-50/30 dark:bg-blue-950/20' 
                              : 'hover:shadow-md border-gray-200 dark:border-gray-700'
                          }`}
                          onClick={() => handlePlanSelect(key)}
                        >
                          {key === 'annual' && (
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                              <Badge className="bg-blue-500 text-white px-4 py-1">
                                <Star className="w-3 h-3 mr-1" />
                                Melhor valor
                              </Badge>
                            </div>
                          )}
                          {key === 'monthly' && (
                            <div className="absolute -top-3 right-4">
                              <Badge variant="outline" className="bg-green-50 border-green-300 text-green-700 dark:bg-green-950/50 dark:border-green-700 dark:text-green-400">
                                <Smartphone className="w-3 h-3 mr-1" />
                                Somente PIX
                              </Badge>
                            </div>
                          )}
                          <CardContent className="p-6">
                            <PlanCardContent planKey={key} plan={plan} />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )
              })()}

              {/* Comparativo: Anual vs Mensal */}
              {monthly && annual && (
                <div className="mb-6 p-4 rounded-lg bg-white/80 dark:bg-gray-800/80 border border-blue-200 dark:border-blue-800">
                  <p className="text-center text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">Plano Anual:</span> inclui tudo do mensal com desconto + opção de pagar com PIX ou Cartão. 
                    <span className="font-semibold text-green-600 dark:text-green-400"> Plano Mensal:</span> pagamento somente via PIX (com 5% OFF).
                  </p>
                </div>
              )}

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
          )}
        </div>
      </div>
    </div>
  )
}
