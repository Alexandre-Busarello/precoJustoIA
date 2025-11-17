'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  Zap, 
  Trophy,
  CheckCircle,
  Gift,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'
import { AlfaEarlyAdopterCard } from '@/components/alfa-early-adopter-card'
import { useTrialAvailable } from '@/hooks/use-trial-available'
import { usePricing } from '@/hooks/use-pricing'
import { formatPrice } from '@/lib/price-utils'

interface AlfaStats {
  phase: string
}

export function AlfaPricingCards() {
  const [stats, setStats] = useState<AlfaStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { isAvailable: isTrialAvailable } = useTrialAvailable()
  const { monthly, annual, isLoading: isLoadingPricing, monthlyEquivalent, annualDiscountFormatted } = usePricing()
  
  // Calcular valores derivados
  const annualMonthlyEquivalentFormatted = monthlyEquivalent ? formatPrice(monthlyEquivalent) : 'R$ 15,82'
  const annualOriginalPrice = monthly && annual ? formatPrice(monthly.price_in_cents * 12) : 'R$ 238,80'
  const annualSavings = monthly && annual ? formatPrice((monthly.price_in_cents * 12) - annual.price_in_cents) : 'R$ 67,00'

  useEffect(() => {
    fetchAlfaStats()
  }, [])

  const fetchAlfaStats = async () => {
    try {
      const response = await fetch('/api/alfa/register-check')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas da fase Alfa:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
        <div className="animate-pulse bg-gray-200 rounded-lg h-96"></div>
        <div className="animate-pulse bg-gray-200 rounded-lg h-96"></div>
        <div className="animate-pulse bg-gray-200 rounded-lg h-96"></div>
        <div className="animate-pulse bg-gray-200 rounded-lg h-96"></div>
      </div>
    )
  }

  const isAlfaPhase = stats?.phase === 'ALFA'

  if (isAlfaPhase) {
    // Durante a fase Alfa: apenas Early Adopter centralizado
    return (
      <div className="grid grid-cols-1 gap-8 max-w-xl mx-auto">
        {/* Early Adopter */}
        <AlfaEarlyAdopterCard />
      </div>
    )
  }

  // Fora da fase Alfa: todos os planos
  return (
    <div className="space-y-8">
      {/* Trial Premium Banner - Só mostra se trial estiver disponível */}
      {isTrialAvailable && (
      <div className="max-w-3xl mx-auto pb-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">
      {/* Free Plan */}
      <Card className="border-2 hover:shadow-xl transition-all duration-300 relative h-full flex flex-col">
        <CardContent className="p-8 flex-1 flex flex-col">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Gratuito</h2>
            <div className="text-4xl font-bold text-blue-600 mb-2">R$ 0</div>
            <p className="text-sm text-muted-foreground">Para sempre</p>
          </div>
          
          <div className="space-y-4 mb-8 flex-1">
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
              <span>Rankings básicos (até 10 empresas)</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span>Filtros anti-armadilha</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span>Comparador básico</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span>Histórico de rankings</span>
            </div>
          </div>

          <Button className="w-full bg-blue-600 hover:bg-blue-700 mt-auto" asChild>
            <Link href="/register">
              Começar grátis
            </Link>
          </Button>
          
          {isTrialAvailable && (
            <p className="text-xs text-center text-muted-foreground mt-3">
              ✨ + 7 dias Premium grátis ao criar conta
            </p>
          )}
        </CardContent>
      </Card>

      {/* Premium Monthly */}
      <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20 hover:shadow-xl transition-all duration-300 relative h-full flex flex-col">
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-gradient-to-r from-violet-600 to-pink-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
            Mensal
          </div>
        </div>
        
        <CardContent className="p-8 flex-1 flex flex-col">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Premium Mensal</h2>
            {isLoadingPricing ? (
              <div className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent mb-2 h-12 animate-pulse bg-gray-200 rounded"></div>
            ) : (
              <>
                <div className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent mb-2">
                  {monthly?.price_formatted || 'R$ 19,90'}
                </div>
                <p className="text-sm text-muted-foreground">por mês • PIX ou Cartão</p>
                <p className="text-xs text-green-600 font-medium mt-1">
                  Apenas R$ {monthly ? (monthly.price_in_cents / 100 / 30).toFixed(2) : '0,66'} por dia
                </p>
              </>
            )}
          </div>
          
          <div className="space-y-4 mb-8 flex-1">
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
              <span>🤖 <strong>Análise com IA</strong> (Gemini)</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span>🚀 <strong>Backtesting de Carteiras</strong></span>
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
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span>Central de Suporte Premium</span>
            </div>
          </div>

          <Button className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-3 mt-auto" asChild>
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

      {/* Premium Annual */}
      <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 hover:shadow-xl transition-all duration-300 relative h-full flex flex-col scale-105 z-10">
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
            <h2 className="text-2xl font-bold mb-2">Premium Anual</h2>
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
                    💰 Economize {annualSavings} por ano
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
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span>Central de Suporte Premium</span>
            </div>
          </div>

          <Button 
            disabled={isAlfaPhase} 
            className={`w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 mt-auto ${
              isAlfaPhase 
                ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed text-gray-600' 
                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
            }`} asChild>
            {isAlfaPhase ? (
              <span>Liberado no ALFA</span>
            ) : (
              <Link href={isTrialAvailable ? "/register" : "/checkout?plan=annual"}>
                {isTrialAvailable ? "Começar com Trial Grátis" : "Economizar 37%"}
              </Link>
            )}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground mt-3">
            {isTrialAvailable 
              ? `🎁 7 dias Premium grátis • 💰 Economia de ${annualSavings} por ano`
              : `💰 Economia de ${annualSavings} por ano`}
          </p>
          <p className="text-xs text-center text-muted-foreground/70 mt-1">
            Pagamento único anual • Não parcelado
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
