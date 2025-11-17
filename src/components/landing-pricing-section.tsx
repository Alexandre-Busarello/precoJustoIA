'use client'

import { useAlfa } from '@/contexts/alfa-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Zap, Shield, Trophy, Gift, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { AlfaPremiumNotice } from '@/components/alfa-premium-notice'
import { AlfaEarlyAdopterCard } from '@/components/alfa-early-adopter-card'
import { useTrialAvailable } from '@/hooks/use-trial-available'
import { usePricing } from '@/hooks/use-pricing'
import { formatPrice, getPixDiscountAmount } from '@/lib/price-utils'

export function LandingPricingSection() {
  const { stats, isLoading } = useAlfa()
  const { isAvailable: isTrialAvailable } = useTrialAvailable()
  const { monthly, annual, isLoading: isLoadingPricing, monthlyEquivalent, annualDiscountFormatted } = usePricing()

  const isAlfaPhase = !isLoading && stats?.phase === 'ALFA'
  
  // Calcular valores derivados
  const monthlyPricePerDay = monthly ? (monthly.price_in_cents / 100 / 30).toFixed(2) : '0,66'
  const annualMonthlyEquivalentFormatted = monthlyEquivalent ? formatPrice(monthlyEquivalent) : 'R$ 15,82'
  const annualOriginalPrice = monthly && annual ? formatPrice(monthly.price_in_cents * 12) : 'R$ 238,80'
  const annualSavings = monthly && annual ? formatPrice((monthly.price_in_cents * 12) - annual.price_in_cents) : 'R$ 67,00'
  
  // Calcular descontos PIX
  const monthlyPixDiscount = monthly ? formatPrice(getPixDiscountAmount(monthly.price_in_cents)) : 'R$ 0,00'
  const annualPixDiscount = annual ? formatPrice(getPixDiscountAmount(annual.price_in_cents)) : 'R$ 0,00'

  return (
    <section id="pricing" className="py-20 bg-white dark:bg-background scroll-mt-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-20">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Apoie o projeto e nos ajude a crescer!
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            <strong>Economize milhares</strong> em decisões ruins de investimento. 
          </p>
          {/* <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-full px-4 py-2 mt-4">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              💳 PIX ou Cartão • Ativação instantânea
            </span>
          </div> */}
        </div>

        {/* Aviso Premium Gratuito na Fase Alfa */}
        {isAlfaPhase && (
          <div className="mb-12">
            <AlfaPremiumNotice />
          </div>
        )}

        {/* Trial Premium Banner - Só mostra quando não é Alfa E trial está disponível */}
        {!isAlfaPhase && isTrialAvailable && (
          <div className="mb-8 max-w-3xl mx-auto pb-6">
            <Card className="border-2 border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0">
                    <Gift className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                        Trial Premium de 7 Dias Grátis
                      </h3>
                      <Badge variant="secondary" className="bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Automático
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                      Ao criar sua conta, você recebe <strong>automaticamente 7 dias de acesso Premium completo</strong> para experimentar todas as funcionalidades avançadas da plataforma sem compromisso.
                    </p>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-violet-600" />
                        <span>Sem cartão de crédito necessário</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-violet-600" />
                        <span>Ativação instantânea</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-violet-600" />
                        <span>Cancele quando quiser</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        <div className={`grid gap-8 max-w-6xl mx-auto ${
          isAlfaPhase 
            ? 'grid-cols-1 max-w-xl' 
            : 'grid-cols-1 lg:grid-cols-3'
        }`}>
          {/* Ordem: Gratuito, Anual (destacado), Mensal */}
          
          {/* Free Plan - Só mostra quando não é Alfa */}
          {!isAlfaPhase && (
            <Card className="border-2 hover:shadow-xl transition-all duration-300 relative">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Gratuito</h3>
                  <div className="text-3xl font-bold text-blue-600 mb-2">R$ 0</div>
                  <p className="text-sm text-muted-foreground">Para sempre</p>
                </div>
                
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Fórmula de Graham completa</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Análise de 350+ empresas B3</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Filtros anti-armadilha</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Rankings salvos</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Comparador básico</span>
                  </div>
                </div>

                <Button className="w-full bg-blue-600 hover:bg-blue-700" asChild>
                  <Link href="/register">
                    Começar grátis
                  </Link>
                </Button>
                {isTrialAvailable && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    ✨ + 7 dias Premium grátis ao criar conta
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Premium Annual - Disponível apenas fora da fase Alfa - MOSTRAR PRIMEIRO PARA DESTAQUE */}
          {!isAlfaPhase && (
            <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 hover:shadow-xl transition-all duration-300 relative h-full flex flex-col scale-105 z-10 order-2 lg:order-2">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse">
                  🔥 MELHOR VALOR
                </div>
              </div>
              
              <CardContent className="p-8 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Premium Anual</h3>
                  {isLoadingPricing ? (
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="text-lg text-muted-foreground line-through">{annualOriginalPrice}</span>
                        <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                          {annual?.price_formatted || 'R$ 189,90'}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">por ano • PIX ou Cartão</p>
                      <p className="text-xs text-green-600 font-medium mt-1">
                        {annualMonthlyEquivalentFormatted} por mês <span className="text-muted-foreground">(equivalente)</span>
                      </p>
                      <div className="mt-2 inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                        <span className="text-xs font-bold text-green-700 dark:text-green-300">
                          💰 PIX: 5% OFF • Economize {annualPixDiscount}
                        </span>
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 bg-green-50 dark:bg-green-950/30 px-3 py-1 rounded-full">
                        <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                          + Economia de {annualSavings} no plano anual
                        </span>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="space-y-4 mb-8 flex-1">
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span><strong>Tudo do Premium Mensal</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span><strong>{annualDiscountFormatted || '37%'} de desconto</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span><strong>Acesso antecipado</strong> a novos recursos</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Suporte VIP</span>
                  </div>
                </div>

                <div className="mt-auto">
                  <Button 
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3"
                    asChild
                  >
                    <Link href={isTrialAvailable ? "/register" : "/checkout?plan=annual"}>
                      {isTrialAvailable ? "Começar com Trial Grátis" : "Economizar 37%"}
                    </Link>
                  </Button>
                  
                  <p className="text-xs text-center text-muted-foreground mt-3">
                    {isTrialAvailable 
                      ? `🎁 7 dias Premium grátis • 💰 Economia de ${annualSavings} por ano`
                      : `💰 Economia de ${annualSavings} por ano`}
                  </p>
                  <p className="text-xs text-center text-muted-foreground/70 mt-1">
                    Pagamento único anual • Não parcelado
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Premium Monthly - Só mostra quando não é Alfa */}
          {!isAlfaPhase && (
            <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20 hover:shadow-xl transition-all duration-300 relative order-3 lg:order-3">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-violet-600 to-pink-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                  Mensal
                </div>
              </div>
              
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Premium Mensal</h3>
                  {isLoadingPricing ? (
                    <div className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent mb-2 h-12 animate-pulse bg-gray-200 rounded"></div>
                  ) : (
                    <>
                      <div className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent mb-2">
                        {monthly?.price_formatted || 'R$ 19,90'}
                      </div>
                      <p className="text-sm text-muted-foreground">por mês • PIX ou Cartão</p>
                      <div className="mt-2 inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                        <span className="text-xs font-bold text-green-700 dark:text-green-300">
                          💰 PIX: 5% OFF • Economize {monthlyPixDiscount}
                        </span>
                      </div>
                      <p className="text-xs text-green-600 font-medium mt-1">Apenas R$ {monthlyPricePerDay} por dia</p>
                    </>
                  )}
                </div>
                
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span><strong>Tudo do plano gratuito</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span><strong>8 modelos de valuation</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span><strong>Análise com IA (Gemini)</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span><strong>🚀 Backtesting de Carteiras</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Comparador completo</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Rankings ilimitados</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Análise individual completa</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Relatórios mensais personalizados por IA</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Suporte prioritário</span>
                  </div>
                </div>

                <Button className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-3" asChild>
                  <Link href={isTrialAvailable ? "/register" : "/checkout?plan=monthly"}>
                    {isTrialAvailable ? "Começar com Trial Grátis" : "Começar Premium"}
                  </Link>
                </Button>
                
                <p className="text-xs text-center text-muted-foreground mt-3">
                  {isTrialAvailable 
                    ? "🎁 7 dias Premium grátis • ✅ Ativação instantânea • ✅ Cancele quando quiser"
                    : "✅ Ativação instantânea • ✅ Cancele quando quiser"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Early Adopter - Só mostra na Fase Alfa (Centralizado) */}
          {isAlfaPhase && (
            <AlfaEarlyAdopterCard />
          )}
        </div>

        {/* Value Proposition */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-2xl p-8 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">
              💡 <strong>Uma única decisão ruim</strong> pode custar mais que 1 ano de Premium
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 mb-2">-R$ 5.000</div>
                  <p className="text-muted-foreground">Perda média em uma &quot;dividend trap&quot;</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 mb-2">-R$ 10.000</div>
                <p className="text-muted-foreground">Perda média em empresa problemática</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-2">
                  {isLoadingPricing ? (
                    <span className="inline-block h-8 w-32 bg-gray-200 rounded animate-pulse"></span>
                  ) : (
                    `+${annual?.price_formatted || 'R$ 189,90'}`
                  )}
                </div>
                <p className="text-muted-foreground">Custo do Premium Anual</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
