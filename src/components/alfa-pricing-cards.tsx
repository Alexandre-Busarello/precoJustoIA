'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Shield, 
  Zap, 
  Trophy,
  CheckCircle,
  Headphones
} from 'lucide-react'
import Link from 'next/link'
import { AlfaEarlyAdopterCard } from '@/components/alfa-early-adopter-card'
import { AlfaPremiumNotice } from '@/components/alfa-premium-notice'

interface AlfaStats {
  phase: string
}

export function AlfaPricingCards() {
  const [stats, setStats] = useState<AlfaStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
    // Durante a fase Alfa: apenas Early Adopter e Premium Anual
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Early Adopter */}
        <AlfaEarlyAdopterCard />
        
        {/* Premium Annual */}
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
              <h2 className="text-2xl font-bold mb-2">Premium Anual</h2>
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-lg text-muted-foreground line-through">R$ 564,00</span>
                <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  R$ 497,00
                </div>
              </div>
              <p className="text-sm text-muted-foreground">por ano • PIX ou Cartão</p>
              <p className="text-xs text-green-600 font-medium mt-1">R$ 41,42 por mês</p>
            </div>
            
            <AlfaPremiumNotice />
            
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
                    <Link href="/checkout?plan=annual">
                      Economizar 12%
                    </Link>
                  )}
            </Button>
            
            <p className="text-xs text-center text-muted-foreground mt-3">
              💰 Economia de R$ 67,00 por ano
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fora da fase Alfa: todos os planos
  return (
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
          
          <p className="text-xs text-center text-muted-foreground mt-3">
            ✅ Sem cartão de crédito • ✅ Acesso imediato
          </p>
        </CardContent>
      </Card>

      {/* Premium Monthly */}
      <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20 hover:shadow-xl transition-all duration-300 relative scale-105 h-full flex flex-col">
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-gradient-to-r from-violet-600 to-pink-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
            🔥 MAIS POPULAR
          </div>
        </div>
        
        <CardContent className="p-8 flex-1 flex flex-col">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Premium Mensal</h2>
            <div className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent mb-2">
              R$ 47,00
            </div>
            <p className="text-sm text-muted-foreground">por mês • PIX ou Cartão</p>
            <p className="text-xs text-green-600 font-medium mt-1">Apenas R$ 1,57 por dia</p>
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
              <span>Suporte prioritário</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span>Central de Suporte Premium</span>
            </div>
          </div>

          <Button className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-3 mt-auto" asChild>
            <Link href="/checkout?plan=monthly">
              Começar Premium
            </Link>
          </Button>
          
          <p className="text-xs text-center text-muted-foreground mt-3">
            ✅ Ativação instantânea • ✅ Cancele quando quiser
          </p>
        </CardContent>
      </Card>

      {/* Premium Annual */}
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
            <h2 className="text-2xl font-bold mb-2">Premium Anual</h2>
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
              <Link href="/checkout?plan=annual">
                Economizar 12%
              </Link>
            )}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground mt-3">
            💰 Economia de R$ 67,00 por ano
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
