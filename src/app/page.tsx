"use client"

import { useSession } from "next-auth/react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { QuickRanker } from "@/components/quick-ranker"
import { TrendingUp, Shield, Zap, Target, BarChart3, Brain, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function Home() {
  const { data: session } = useSession()

  return (
    <div>
      {/* Hero Section - Full Width */}
      <section className="relative overflow-hidden w-full bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-blue-950/20 dark:via-background dark:to-violet-950/20 py-16 sm:py-24">
        <div className="text-center max-w-4xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 bg-white/60 dark:bg-background/60 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2 mb-8">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium">Análise fundamentalista inteligente</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Investir
            </span>{" "}
            <span className="text-foreground">com</span>{" "}
            <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
              inteligência
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
            Descubra as melhores oportunidades de investimento usando modelos de valuation consagrados, 
            filtros anti-armadilhas e análise automatizada com IA.
          </p>
          
          {!session && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700" asChild>
                <Link href="/register" className="flex items-center gap-2">
                  Começar gratuitamente
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/login">Fazer login</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Quick Ranker Section */}
      <section className="py-20 bg-gradient-to-b from-white to-gray-50 dark:from-background dark:to-background/80">
        <div className="container mx-auto px-4">
          <QuickRanker />
        </div>
      </section>

      {/* User Dashboard - Only if logged in */}
      {session && (
        <section className="py-12 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/10 dark:to-violet-950/10">
          <div className="container mx-auto px-4">
            <Card className="bg-white/70 dark:bg-background/70 backdrop-blur-sm border-0 shadow-xl">
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold">
                      Olá, {session.user?.name || session.user?.email?.split('@')[0]}!
                    </h3>
                    <div className="flex items-center gap-2">
                      {session.user?.subscriptionTier === 'PREMIUM' ? (
                        <>
                          <Shield className="w-5 h-5 text-violet-600" />
                          <span className="text-violet-600 font-medium">Plano Premium ativo</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5 text-blue-600" />
                          <span className="text-blue-600 font-medium">Plano gratuito</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" asChild>
                      <Link href="/ranking" className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Rankings avançados
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link href="/carteiras" className="flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Minhas carteiras
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ferramentas poderosas para{" "}
              <span className="text-blue-600">investir melhor</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Nossa plataforma combina análise fundamentalista clássica com 
              tecnologia moderna para maximizar seus retornos.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">Rankings inteligentes</h3>
                <p className="text-muted-foreground mb-4">
                  Filtre empresas usando modelos consagrados como Graham, Bazin e 
                  Fórmula Mágica com critérios anti-armadilha.
                </p>
                <div className="text-sm text-blue-600 font-medium group-hover:text-blue-700">
                  4 modelos disponíveis →
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">Análise com IA</h3>
                <p className="text-muted-foreground mb-4">
                  Explicações detalhadas dos cálculos, análise de sentimento de 
                  mercado e insights contextualizados.
                </p>
                <div className="text-sm text-violet-600 font-medium group-hover:text-violet-700">
                  Powered by Gemini →
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">Backtesting avançado</h3>
                <p className="text-muted-foreground mb-4">
                  Teste suas estratégias com dados históricos reais, 
                  simulando aportes recorrentes e comparando com benchmarks.
                </p>
                <div className="text-sm text-pink-600 font-medium group-hover:text-pink-700">
                  Dados históricos completos →
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Planos que crescem{" "}
              <span className="text-violet-600">com você</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Comece grátis e desbloqueie recursos avançados quando precisar
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="border-2 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Gratuito</h3>
                    <p className="text-sm text-muted-foreground">Para começar</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <div className="w-2 h-2 bg-green-600 rounded-full" />
                    </div>
                    <span>Modelo Graham básico</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <div className="w-2 h-2 bg-green-600 rounded-full" />
                    </div>
                    <span>Análise de até 10 empresas</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <div className="w-2 h-2 bg-green-600 rounded-full" />
                    </div>
                    <span>Dados fundamentalistas básicos</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20 hover:shadow-xl transition-all duration-300 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-violet-600 to-pink-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Mais popular
                </div>
              </div>
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Premium</h3>
                    <p className="text-sm text-muted-foreground">R$ 19,90 / mês</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-100 to-pink-100 dark:from-violet-900/30 dark:to-pink-900/30 flex items-center justify-center">
                      <div className="w-2 h-2 bg-gradient-to-br from-violet-600 to-pink-600 rounded-full" />
                    </div>
                    <span>Todos os modelos de valuation</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-100 to-pink-100 dark:from-violet-900/30 dark:to-pink-900/30 flex items-center justify-center">
                      <div className="w-2 h-2 bg-gradient-to-br from-violet-600 to-pink-600 rounded-full" />
                    </div>
                    <span>Análise completa com IA</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-100 to-pink-100 dark:from-violet-900/30 dark:to-pink-900/30 flex items-center justify-center">
                      <div className="w-2 h-2 bg-gradient-to-br from-violet-600 to-pink-600 rounded-full" />
                    </div>
                    <span>Criação e gestão de carteiras</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-100 to-pink-100 dark:from-violet-900/30 dark:to-pink-900/30 flex items-center justify-center">
                      <div className="w-2 h-2 bg-gradient-to-br from-violet-600 to-pink-600 rounded-full" />
                    </div>
                    <span>Backtesting avançado</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-100 to-pink-100 dark:from-violet-900/30 dark:to-pink-900/30 flex items-center justify-center">
                      <div className="w-2 h-2 bg-gradient-to-br from-violet-600 to-pink-600 rounded-full" />
                    </div>
                    <span>Rankings ilimitados</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}