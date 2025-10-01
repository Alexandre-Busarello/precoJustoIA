'use client'

import { useAlfa } from '@/contexts/alfa-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Zap, Shield, Trophy } from 'lucide-react'
import Link from 'next/link'
import { AlfaPremiumNotice } from '@/components/alfa-premium-notice'
import { AlfaEarlyAdopterCard } from '@/components/alfa-early-adopter-card'

export function LandingPricingSection() {
  const { stats, isLoading } = useAlfa()

  const isAlfaPhase = !isLoading && stats?.phase === 'ALFA'

  return (
    <section className="py-20 bg-white dark:bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-20">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Invista em você por{" "}
            <span className="text-violet-600">menos de R$ 1,60 por dia</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            <strong>Economize milhares</strong> em decisões ruins de investimento. 
            Nossos planos custam menos que <strong>uma taxa de corretagem</strong>.
          </p>
          <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-full px-4 py-2 mt-4">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              💳 PIX ou Cartão • Ativação instantânea
            </span>
          </div>
        </div>

        {/* Aviso Premium Gratuito na Fase Alfa */}
        {isAlfaPhase && (
          <div className="mb-12">
            <AlfaPremiumNotice />
          </div>
        )}
        
        <div className={`grid gap-8 max-w-6xl mx-auto ${
          isAlfaPhase 
            ? 'grid-cols-1 max-w-xl' 
            : 'grid-cols-1 lg:grid-cols-3'
        }`}>
          
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
              </CardContent>
            </Card>
          )}

          {/* Premium Monthly - Só mostra quando não é Alfa */}
          {!isAlfaPhase && (
            <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20 hover:shadow-xl transition-all duration-300 relative scale-105">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-violet-600 to-pink-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                  🔥 MAIS POPULAR
                </div>
              </div>
              
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Premium Mensal</h3>
                  <div className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent mb-2">
                    R$ 47,00
                  </div>
                  <p className="text-sm text-muted-foreground">por mês • PIX ou Cartão</p>
                  <p className="text-xs text-green-600 font-medium mt-1">Apenas R$ 1,57 por dia</p>
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
                    <span>Suporte prioritário</span>
                  </div>
                </div>

                <Button className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-3" asChild>
                  <Link href="/checkout?plan=monthly">
                    Começar Premium
                  </Link>
                </Button>
                
                <p className="text-xs text-center text-muted-foreground mt-3">
                  ✅ Ativação instantânea • ✅ Cancele quando quiser
                </p>
              </CardContent>
            </Card>
          )}

          {/* Early Adopter - Só mostra na Fase Alfa (Centralizado) */}
          {isAlfaPhase && (
            <AlfaEarlyAdopterCard />
          )}

          {/* Premium Annual - Disponível apenas fora da fase Alfa */}
          {!isAlfaPhase && (
            <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 hover:shadow-xl transition-all duration-300 relative h-full flex flex-col">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                  💰 ECONOMIZE 12%
                </div>
              </div>
              
              <CardContent className="p-8 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Premium Anual</h3>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-lg text-muted-foreground line-through">R$ 564,00</span>
                    <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      R$ 497,00
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">por ano • PIX ou Cartão</p>
                  <p className="text-xs text-green-600 font-medium mt-1">R$ 41,42 por mês</p>
                </div>
                
                <div className="space-y-4 mb-8 flex-1">
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span><strong>Tudo do Premium Mensal</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span><strong>12% de desconto</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span><strong>Acesso antecipado</strong> a novos recursos</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Relatórios mensais personalizados por IA</span>
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
                    <Link href="/checkout?plan=annual">
                      Economizar 12%
                    </Link>
                  </Button>
                  
                  <p className="text-xs text-center text-muted-foreground mt-3">
                    💰 Economia de R$ 67,00 por ano
                  </p>
                </div>
              </CardContent>
            </Card>
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
                <div className="text-2xl font-bold text-green-600 mb-2">+R$ 497</div>
                <p className="text-muted-foreground">Custo do Premium Anual</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
