'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  CheckCircle,
  Brain,
  ArrowRight,
  Clock,
  Star,
  Crown,
  MessageCircle,
  Lock,
  Infinity,
  Calendar,
  Users,
  Gift,
  AlertCircle
} from "lucide-react"
import Link from "next/link"

export function EarlyAdopterContent() {
  // Mostra que a promoção terminou
  return (
    <div className="min-h-screen flex items-center justify-center py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20">
            <CardContent className="p-12">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-white" />
              </div>
              
              <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
                Promoção Early Adopter Encerrada
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                A oferta especial Early Adopter já foi encerrada. 
                Mas não se preocupe! Ainda temos ótimos planos disponíveis para você.
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-center gap-3 text-sm">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span>Análise fundamentalista completa</span>
                </div>
                <div className="flex items-center justify-center gap-3 text-sm">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span>8 modelos de valuation premium</span>
                </div>
                <div className="flex items-center justify-center gap-3 text-sm">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span>Análise com IA (Google Gemini)</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-bold px-8 py-4" asChild>
                  <Link href="/planos">
                    <Crown className="mr-2 h-5 w-5" />
                    Ver Planos Disponíveis
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                
                <Button size="lg" variant="outline" className="border-2 border-gray-300 hover:bg-gray-50 font-bold px-8 py-4" asChild>
                  <Link href="/">
                    Voltar ao Início
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Conteúdo antigo removido - a promoção Early Adopter foi encerrada
/*
  return (
    <>
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-purple-50 via-white to-purple-50 dark:from-purple-950/20 dark:via-background dark:to-purple-950/20">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/90 dark:bg-background/90 backdrop-blur-sm border border-purple-200 dark:border-purple-700 rounded-full px-6 py-3 mb-8 shadow-lg">
            <Crown className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">👑 Oferta Exclusiva Early Adopter</span>
            <span className="ml-2 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs px-2 py-1 rounded-full">
              Limitada
            </span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-8">
            <span className="bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
              Preço Congelado
            </span>
            <br />
            <span className="text-gray-900 dark:text-white">Para Sempre</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed">
            Seja um dos primeiros apoiadores e garanta o preço atual em <strong>todas as renovações futuras</strong>. 
            Mais acesso exclusivo ao CEO e recursos VIP.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold px-8 py-4" asChild>
              <Link href="/checkout?plan=early">
                <Gift className="mr-2 h-5 w-5" />
                Garantir Oferta Agora
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Sem limite de vagas</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Ativação instantânea</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Preço garantido para sempre</span>
            </div>
          </div>
        </div>
      </section>

      {/* Oferta Principal */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 hover:shadow-2xl transition-all duration-300 relative">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-8 py-3 rounded-full text-lg font-bold shadow-lg">
                  🔥 OFERTA EARLY ADOPTER
                </div>
              </div>
              
              <div className="text-center pt-12 pb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Crown className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-4">Premium Early Adopter</h2>
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl text-gray-400 line-through">R$ 189,90</span>
                    </div>
                    <div className="text-5xl font-bold text-purple-600">
                      R$ 249,00
                    </div>
                    <p className="text-sm text-muted-foreground">por ano • PIX ou Cartão</p>
                    <p className="text-lg font-bold text-green-600 mt-1">Economia de R$ 248/ano!</p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 text-lg font-semibold text-purple-600">
                  <Infinity className="w-6 h-6" />
                  <span>Preço congelado PARA SEMPRE</span>
                </div>
              </div>
              
              <div className="px-8 pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Star className="w-5 h-5 text-gold-600" />
                      Benefícios Exclusivos
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span><strong>Preço congelado para sempre</strong> em todas as renovações</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span><strong>Canal exclusivo WhatsApp</strong> com o CEO</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span><strong>Acesso antecipado</strong> a todos os novos recursos</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span><strong>Suporte VIP prioritário</strong></span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span><strong>Badge especial</strong> de Early Adopter</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-600" />
                      Recursos Premium
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span><strong>8 modelos de valuation</strong> (Graham, Dividend Yield, Fórmula Mágica, etc.)</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span><strong>Análise preditiva com IA</strong> (Google Gemini)</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span><strong>Rankings ilimitados</strong> e personalizados</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span><strong>Comparador avançado</strong> de ações</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span><strong>Relatórios mensais</strong> personalizados por IA</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-6 mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <MessageCircle className="w-6 h-6 text-purple-600" />
                    <h3 className="text-lg font-bold">Canal Exclusivo WhatsApp</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Acesso direto ao CEO para feedback sobre o produto, sugestões de melhorias e conversas sobre investimentos. 
                    Um canal exclusivo para moldar o futuro da plataforma.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-medium text-purple-600">
                    <Users className="w-4 h-4" />
                    <span>Grupo limitado e exclusivo</span>
                  </div>
                </div>

                <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-4 text-lg" asChild>
                  <Link href="/checkout?plan=early">
                    <Crown className="mr-2 h-5 w-5" />
                    Garantir Preço Congelado Para Sempre
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                
                <div className="text-center mt-6">
                  <p className="text-xs text-muted-foreground">
                    ✅ Sem limite de vagas para Early Adopters • ✅ Preço garantido para sempre • ✅ Ativação instantânea
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Comparação de Valor */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Por que ser um{" "}
              <span className="text-purple-600">Early Adopter?</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Garante o preço atual para sempre e ajuda a moldar o futuro da plataforma
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-background rounded-2xl p-8 shadow-xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-2xl font-bold text-purple-600 mb-2">Early Adopter</div>
                  <div className="text-4xl font-bold mb-2">R$ 249</div>
                  <p className="text-muted-foreground text-sm">Preço congelado</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600 mb-2">Preço Normal</div>
                  <div className="text-4xl font-bold mb-2">R$ 497</div>
                  <p className="text-muted-foreground text-sm">Preço atual</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600 mb-2">Economia</div>
                  <div className="text-4xl font-bold mb-2">R$ 248</div>
                  <p className="text-muted-foreground text-sm">Por ano, para sempre</p>
                </div>
              </div>
              
              <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl">
                <div className="flex items-center justify-center gap-2 text-lg font-semibold text-purple-600 mb-2">
                  <Lock className="w-5 h-5" />
                  <span>Preço Congelado Para Sempre</span>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Enquanto outros pagarão preços crescentes, você mantém o valor atual em todas as renovações futuras.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Específico */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Perguntas Frequentes
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-3">
                  <Infinity className="w-5 h-5 text-purple-600" />
                  O preço realmente fica congelado para sempre?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Sim! Como Early Adopter, você paga R$ 249/ano hoje e continuará pagando esse mesmo valor 
                  em todas as renovações futuras, independentemente dos aumentos de preço para novos usuários.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-purple-600" />
                  Como funciona o canal exclusivo WhatsApp?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  É um grupo seleto onde você tem acesso direto ao CEO para dar feedback, sugerir melhorias 
                  e participar das decisões sobre novos recursos. Sua opinião ajuda a moldar o futuro da plataforma.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  Por quanto tempo essa oferta estará disponível?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Esta oferta já foi encerrada e não está mais disponível para novos usuários.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-br from-purple-600 to-purple-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Não perca esta oportunidade única
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Seja um dos fundadores da nossa comunidade e garante benefícios exclusivos para sempre.
          </p>
          
          <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 font-bold px-8 py-4 text-lg" asChild>
            <Link href="/checkout?plan=early">
              <Crown className="mr-2 h-6 w-6" />
              Garantir Oferta Early Adopter
              <ArrowRight className="ml-2 h-6 w-6" />
            </Link>
          </Button>
          
          <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm opacity-80">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Preço congelado para sempre</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Canal exclusivo WhatsApp</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Acesso antecipado</span>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
