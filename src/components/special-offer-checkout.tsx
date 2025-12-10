'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
  Zap,
  Lock,
  AlertCircle,
  Timer
} from 'lucide-react'
import { OptimizedPixPayment } from './optimized-pix-payment'
import { OptimizedCardPayment } from './optimized-card-payment'
import { usePricing } from '@/hooks/use-pricing'
import { formatPrice } from '@/lib/price-utils'
import { formatTimeUntilExpiration, getTimeUntilExpiration } from '@/lib/offer-utils'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import Link from 'next/link'

type PaymentMethod = 'pix' | 'card'

export function SpecialOfferCheckout() {
  const { status } = useSession()
  const router = useRouter()
  const { special, monthly, annual, isLoading: isLoadingPricing } = usePricing()
  const { isPremium } = usePremiumStatus()
  
  // Calcular desconto comparando com oferta anual
  const calculateDiscount = () => {
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
  
  const discount = calculateDiscount()
  
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<{ days: number; hours: number; minutes: number } | null>(null)

  // Atualizar timer a cada minuto
  useEffect(() => {
    if (!special || !special.expires_at) return

    const updateTimer = () => {
      const time = getTimeUntilExpiration({ expires_at: special.expires_at ? new Date(special.expires_at) : null })
      setTimeRemaining(time)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 60000) // Atualizar a cada minuto

    return () => clearInterval(interval)
  }, [special])

  const isExpired = special?.is_expired || false
  const hasStripePriceId = !!special?.stripe_price_id

  // Obter dados da oferta especial
  const getSpecialOfferData = () => {
    if (!special) {
      return null
    }

    const durationDays = special.premium_duration_days || 365
    const durationMonths = Math.floor(durationDays / 30)
    const durationYears = Math.floor(durationDays / 365)

    let durationText = ''
    if (durationYears > 0) {
      durationText = `${durationYears} ${durationYears === 1 ? 'ano' : 'anos'}`
    } else if (durationMonths > 0) {
      durationText = `${durationMonths} ${durationMonths === 1 ? 'mês' : 'meses'}`
    } else {
      durationText = `${durationDays} ${durationDays === 1 ? 'dia' : 'dias'}`
    }

    return {
      name: 'Oferta Especial Premium',
      price: special.price_in_cents / 100,
      period: durationText,
      description: `Acesso Premium por ${durationText}`,
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
        'Central de Suporte Premium',
        `${durationText} de acesso Premium`
      ],
      offerId: special.id,
      expiresAt: special.expires_at,
      isExpired,
      hasStripePriceId,
    }
  }

  const offerData = getSpecialOfferData()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/checkout/oferta-especial')
    }
  }, [status, router])

  // Se não há oferta especial, redirecionar para checkout normal
  useEffect(() => {
    if (!isLoadingPricing && !special) {
      router.push('/checkout')
    }
  }, [special, isLoadingPricing, router])

  const handleMethodSelect = (method: PaymentMethod) => {
    if (isExpired) return
    if (method === 'card' && !hasStripePriceId) return
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
             isLoadingPricing ? 'Carregando oferta especial...' :
             'Carregando...'}
          </p>
        </div>
      </div>
    )
  }

  if (!offerData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Oferta Especial não encontrada</h2>
          <p className="text-muted-foreground mb-4">
            Esta oferta especial não está mais disponível.
          </p>
          <Link href="/checkout">
            <Button>Ver Planos Disponíveis</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 rounded-full mb-3 sm:mb-4 border border-orange-200 dark:border-orange-800">
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-orange-600 dark:text-orange-400 animate-pulse flex-shrink-0" />
            <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 whitespace-nowrap">OFERTA RELÂMPAGO</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-extrabold mb-2 sm:mb-3 bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent break-words">
            Invista como um Profissional
          </h1>
          <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-700 dark:text-gray-300 font-medium break-words">
            {discount ? (
              <>
                <span className="whitespace-normal">{discount.formatted} de desconto ({discount.percentage}% OFF) em comparação com nosso plano anual ativo</span>
                <span className="block sm:inline"> - Oportunidade única!</span>
              </>
            ) : (
              'Oportunidade única com desconto especial!'
            )}
          </p>
        </div>

        <div className="w-full max-w-6xl mx-auto">
          {!showPayment ? (
            <div className="grid lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
              {/* Left Column - Main Offer Card (2/3 width on desktop) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Special Offer Card - Compact Header */}
                <Card className={`relative overflow-hidden border-2 ${isExpired ? 'opacity-75 border-gray-300' : 'border-orange-500 shadow-xl'}`}>
                  {/* Background gradient effect */}
                  {!isExpired && (
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50 dark:from-orange-950/20 dark:via-red-950/20 dark:to-yellow-950/20 opacity-50"></div>
                  )}
                  
                  <CardContent className="p-3 sm:p-4 md:p-6 relative z-10">
                    {/* Compact Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2 sm:gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md flex-shrink-0">
                          <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white break-words">
                            {offerData.name}
                          </h3>
                          {!isExpired && (
                            <Badge className="mt-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 text-[10px] sm:text-xs">
                              Oferta Limitada
                            </Badge>
                          )}
                        </div>
                      </div>
                      {timeRemaining && !isExpired && (
                        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg border border-orange-300 dark:border-orange-700 flex-shrink-0 self-start sm:self-auto">
                          <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                          <span className="text-[10px] sm:text-xs font-bold text-orange-700 dark:text-orange-300 whitespace-nowrap">
                            {formatTimeUntilExpiration(timeRemaining)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Price - Compact but Prominent */}
                    <div className="text-center mb-3 sm:mb-4">
                      <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 mb-1">Por apenas</div>
                      <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1 break-words">
                        {formatPrice(offerData.price * 100)}
                      </div>
                      <div className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 break-words">
                        {offerData.description}
                      </div>
                      {discount && (
                        <div className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-green-100 dark:bg-green-900/30 rounded-full mb-3 sm:mb-4">
                          <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                          <span className="text-[10px] sm:text-xs font-semibold text-green-700 dark:text-green-300 whitespace-nowrap">
                            Economia de {discount.formatted}
                          </span>
                        </div>
                      )}
                      
                      {/* Disclaimer para usuários Premium */}
                      {!isExpired && isPremium && (
                        <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <div className="flex items-start gap-1.5 sm:gap-2">
                            <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <div className="text-[10px] sm:text-xs text-blue-800 dark:text-blue-200 break-words min-w-0">
                              <p className="font-semibold mb-0.5 sm:mb-1">Você já possui Premium ativo</p>
                              <p className="break-words leading-tight">
                                Ao efetuar esta compra, os <strong>{offerData.period}</strong> de acesso Premium serão <strong>somados</strong> à sua assinatura vigente, estendendo seu período de acesso.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* CTA Button - Pagar Agora com PIX */}
                      {!isExpired && (
                        <Button
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-sm sm:text-base md:text-lg py-4 sm:py-5 md:py-6 shadow-lg hover:shadow-xl transition-all"
                          onClick={() => handleMethodSelect('pix')}
                          disabled={isProcessing}
                        >
                          <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
                            <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 flex-shrink-0" />
                            <span className="whitespace-nowrap text-xs sm:text-sm md:text-base">Pagar Agora com PIX</span>
                            <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                          </div>
                          <div className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 opacity-90 font-normal">
                            Aprovação instantânea
                          </div>
                        </Button>
                      )}
                    </div>

                    {/* Features - Compact Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                      {offerData.features.slice(0, 6).map((feature, index) => (
                        <div 
                          key={index} 
                          className="flex items-start gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 min-w-0"
                        >
                          <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="break-words min-w-0 leading-tight">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {isExpired && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2.5 sm:p-3">
                        <div className="flex items-start gap-1.5 sm:gap-2 text-yellow-800 dark:text-yellow-200">
                          <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                          <p className="text-[10px] sm:text-xs font-medium break-words">
                            Oferta expirada. Confira nossos planos regulares abaixo.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Features Expanded - Collapsible on mobile */}
                <Card className="lg:hidden">
                  <CardContent className="p-3 sm:p-4">
                    <h4 className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3">Todos os benefícios incluídos:</h4>
                    <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
                      {offerData.features.map((feature, index) => (
                        <div 
                          key={index} 
                          className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm min-w-0"
                        >
                          <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="break-words min-w-0 leading-tight">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Payment Methods (1/3 width on desktop, full on mobile) */}
              {!isExpired && (
                <div className="lg:col-span-1 w-full">
                  <Card className="sticky top-4 border-2 border-blue-200 dark:border-blue-800 shadow-lg">
                    <CardContent className="p-3 sm:p-4 md:p-6">
                      <h3 className="text-sm sm:text-base md:text-lg font-bold mb-1 text-center">Escolha o pagamento</h3>
                      <p className="text-[10px] sm:text-xs text-gray-500 text-center mb-3 sm:mb-4">Aprovação imediata</p>
                      
                      {/* Disclaimer para usuários Premium */}
                      {isPremium && (
                        <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <div className="flex items-start gap-1.5 sm:gap-2">
                            <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <div className="text-[10px] sm:text-xs text-blue-800 dark:text-blue-200 break-words min-w-0">
                              <p className="font-semibold mb-0.5 sm:mb-1">Você já possui Premium</p>
                              <p className="break-words leading-tight">
                                Os <strong>{offerData?.period}</strong> serão <strong>somados</strong> à sua assinatura vigente.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2 sm:space-y-3">
                        {/* PIX Option - Primary CTA */}
                        <Button
                          className="w-full h-auto p-2.5 sm:p-3 md:p-4 flex flex-col items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all"
                          onClick={() => handleMethodSelect('pix')}
                          disabled={isProcessing}
                        >
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 flex-shrink-0" />
                            <span className="font-bold text-sm sm:text-base md:text-lg">PIX</span>
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] sm:text-xs opacity-90">Aprovação instantânea</div>
                            <div className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 font-semibold opacity-90">
                              Pagamento único
                            </div>
                          </div>
                        </Button>

                        {/* Card Option */}
                        <Button
                          variant={hasStripePriceId ? "outline" : "outline"}
                          className={`w-full h-auto p-2.5 sm:p-3 md:p-4 flex flex-col items-center gap-1.5 sm:gap-2 transition-all ${
                            hasStripePriceId
                              ? 'hover:bg-blue-50 hover:border-blue-400 border-blue-300'
                              : 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-300'
                          }`}
                          onClick={() => handleMethodSelect('card')}
                          disabled={isProcessing || !hasStripePriceId}
                        >
                          <CreditCard className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 flex-shrink-0 ${hasStripePriceId ? 'text-blue-600' : 'text-gray-400'}`} />
                          <div className="text-center min-w-0 w-full">
                            <div className={`font-semibold text-xs sm:text-sm md:text-base ${hasStripePriceId ? 'text-gray-900' : 'text-gray-400'}`}>
                              Cartão
                            </div>
                            {hasStripePriceId ? (
                              <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 break-words">Assinatura automática</div>
                            ) : (
                              <div className="text-[10px] sm:text-xs text-red-500 mt-0.5 sm:mt-1 font-medium break-words px-1 sm:px-2">
                                Disponível apenas via PIX
                              </div>
                            )}
                          </div>
                        </Button>
                      </div>

                      {/* Trust Indicators - Compact */}
                      <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 text-[10px] sm:text-xs text-gray-500">
                          <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                            <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>Seguro</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                            <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>SSL</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>Imediato</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Expanded Features - Desktop Only */}
              {!isExpired && (
                <div className="lg:col-span-2 hidden lg:block w-full">
                  <Card>
                    <CardContent className="p-6">
                      <h4 className="font-semibold mb-4">Todos os benefícios incluídos:</h4>
                      <div className="grid md:grid-cols-2 gap-3">
                        {offerData.features.map((feature, index) => (
                          <div 
                            key={index} 
                            className="flex items-start gap-2 text-sm min-w-0"
                          >
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700 dark:text-gray-300 break-words min-w-0">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Regular Plans - Mostrar se oferta expirada */}
              {isExpired && (monthly || annual) && (
                <div className="lg:col-span-3">
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold mb-4 text-center">Planos Disponíveis</h3>
                      <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                        {monthly && (
                          <Link href="/checkout?plan=monthly">
                            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-400">
                              <CardContent className="p-6 text-center">
                                <h4 className="font-semibold mb-2">Premium Mensal</h4>
                                <div className="text-3xl font-bold text-blue-600 mb-1">
                                  {formatPrice(monthly.price_in_cents)}
                                </div>
                                <div className="text-sm text-gray-500">/mês</div>
                                <Button className="mt-4 w-full">Escolher Plano</Button>
                              </CardContent>
                            </Card>
                          </Link>
                        )}
                        {annual && (
                          <Link href="/checkout?plan=annual">
                            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-400 border-blue-300">
                              <CardContent className="p-6 text-center">
                                <Badge className="mb-2 bg-blue-500">Mais Popular</Badge>
                                <h4 className="font-semibold mb-2">Premium Anual</h4>
                                <div className="text-3xl font-bold text-blue-600 mb-1">
                                  {formatPrice(annual.price_in_cents)}
                                </div>
                                <div className="text-sm text-gray-500">/ano</div>
                                <Button className="mt-4 w-full">Escolher Plano</Button>
                              </CardContent>
                            </Card>
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
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
                          planType="special"
                          price={offerData.price}
                          onSuccess={handlePaymentSuccess}
                          onError={handlePaymentError}
                        />
                      ) : (
                        <OptimizedCardPayment
                          planType="special"
                          price={offerData.price}
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
                          <span>{offerData.name}</span>
                          <span>{formatPrice(offerData.price * 100)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Oferta especial</span>
                          <span className="text-green-600 font-medium">
                            ✓ Desconto aplicado
                          </span>
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <div className="flex justify-between font-semibold text-lg mb-4">
                        <span>Total</span>
                        <span className="text-blue-600">
                          {formatPrice(offerData.price * 100)}
                        </span>
                      </div>
                      <div className="text-xs text-green-600 font-medium text-center mb-2">
                        ✓ Oferta especial com desconto já aplicado
                      </div>

                      <div className="text-xs text-gray-500 space-y-1">
                        <p>✓ Ativação imediata após pagamento</p>
                        <p>✓ Suporte incluído</p>
                        <p>✓ Garantia de 7 dias</p>
                        <p>✓ {offerData.period} de acesso Premium</p>
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

