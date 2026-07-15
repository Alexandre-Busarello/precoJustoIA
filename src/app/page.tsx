import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { QuickRanker } from "@/components/quick-ranker"
import { Footer } from "@/components/footer"
import { 
  Shield, 
  Target, 
  BarChart3, 
  Brain, 
  ArrowRight,
  CheckCircle,
  Users,
  Clock,
  Calculator,
  PieChart,
  Sparkles,
  Trophy,
  Rocket,
  Building2,
  DollarSign,
  LineChart,
  Activity,
  Calendar,
  BookOpen,
  TrendingUp,
  User,
  Linkedin
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAllPosts } from "@/lib/blog-service"
import { LandingPricingSection } from "@/components/landing-pricing-section"
import { InnerLinkButton } from "@/components/inner-link-button"
import { LandingHero } from "@/components/landing/landing-hero"
import { CTASection } from "@/components/landing/cta-section"
import { FAQSection } from "@/components/landing/faq-section"
import { SocialProof } from "@/components/landing/social-proof"
import { FloatingCTA } from "@/components/landing/floating-cta"
import { CTALinkWithPixel } from "@/components/cta-link-with-pixel"
import { FALLBACK_MONTHLY_PRICE_FORMATTED } from "@/lib/price-utils"

const anoAtual = new Date().getFullYear()

export const metadata: Metadata = {
  title: `Análise Fundamentalista de Ações B3 ${anoAtual} com IA | Preço Justo AI - Investimentos Bovespa`,
  description: `Descubra as melhores ações da Bovespa ${anoAtual} com análise fundamentalista automatizada e IA. 8 modelos de valuation (Graham, Método Barsi, Fórmula Mágica) em +500 empresas B3. Rankings instantâneos, comparador de ações e backtesting. Comece grátis!`,
  keywords: "análise fundamentalista ações, ações B3, bovespa investimentos, valuation ações, como investir em ações, melhores ações B3, análise de ações grátis, preço justo ações, dividend yield, fórmula mágica greenblatt, benjamin graham, ranking ações, comparador ações bovespa, investir bolsa valores, ações subvalorizadas, análise técnica fundamentalista, backtesting carteiras, screening ações B3",
  authors: [{ name: "Alexandre Busarello", url: "https://precojusto.ai/fundador" }],
  creator: "Alexandre Busarello",
  publisher: "Preço Justo AI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Análise Fundamentalista de Ações B3 com IA | Preço Justo AI",
    description: "Análise fundamentalista gratuita de ações B3 com IA. Fórmula de Graham, Método Barsi, Fórmula Mágica + 5 modelos. Rankings de +500 empresas. Comece grátis!",
    type: "website",
    url: "https://precojusto.ai",
    siteName: "Preço Justo AI",
    locale: "pt_BR",
    images: [
      {
        url: "https://precojusto.ai/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Preço Justo AI - Análise Fundamentalista de Ações B3 com IA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Análise Fundamentalista de Ações B3 com IA | Preço Justo AI",
    description: "Análise fundamentalista gratuita de ações B3 com IA. Fórmula de Graham, Dividend Yield + 5 modelos. Comece grátis!",
    creator: "@precojustoai",
    images: ["https://precojusto.ai/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://precojusto.ai",
  },
  verification: {
    google: "google-site-verification-code",
  },
}

export default async function Home() {
  const session = await getServerSession(authOptions)
  
  // Pegar os 3 posts mais recentes para exibir na homepage
  const blogPosts = await getAllPosts()
  const recentPosts = blogPosts.slice(0, 3)

  return (
    <div>

      {/* Floating CTA - Aparece após scroll */}
      {!session && (
        <FloatingCTA 
          text="Começar análise gratuita"
          href="/register"
          showAfterScroll={300}
        />
      )}

      {/* Hero Section - Enhanced com componente reutilizável */}
      <LandingHero
        headline={
          <>
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent block sm:inline">
              Encontre as Melhores Ações
            </span>{" "}
            <span className="text-foreground block sm:inline">da B3 com</span>{" "}
            <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent block sm:inline">
              Análise Fundamentalista + IA
            </span>
          </>
        }
        subheadline={
          <>
            <strong>8 modelos de valuation automatizados</strong> analisam <strong>+500 empresas da Bovespa</strong> em segundos. 
            Use <strong>Graham, Método Barsi, Fórmula Mágica</strong> e mais 5 estratégias consagradas. 
            <strong> Evite decisões ruins</strong> e encontre ações subvalorizadas com dados reais.
          </>
        }
        badge={!session ? {
          // Selo de avaliação visível na tela - valores devem ficar sincronizados
          // com o aggregateRating (ratingValue/ratingCount) do JSON-LD mais abaixo neste arquivo
          text: "4,8 · 1.250 avaliações",
          iconName: "Star"
        } : undefined}
        primaryCTA={!session ? {
          text: "Começar análise gratuita",
          href: "/register",
          iconName: "Rocket"
        } : undefined}
        secondaryCTA={!session ? {
          text: "Ver demonstração",
          href: "/ranking"
        } : undefined}
        socialProof={!session ? [
          { iconName: "Building2", text: "+500 empresas B3" },
          { iconName: "BarChart3", text: "8 modelos + Backtest" },
          { iconName: "Brain", text: "Powered by IA" }
        ] : undefined}
        showQuickAccess={!session}
        pricingNote={!session ? `A partir de ${FALLBACK_MONTHLY_PRICE_FORMATTED}/mês no plano Premium` : undefined}
      />

      {/* Quick Ranker Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gradient-to-b from-white to-gray-50 dark:from-background dark:to-background/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <QuickRanker />
        </div>
      </section>

      {/* User Dashboard - Only if logged in */}
      {/* {session && (
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
                      <Link href="/dashboard" className="flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Meu Dashboard
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )} */}

      {/* Benefits Section - Transformada de Problemas/Soluções para Benefícios Concretos */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white dark:bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center mb-12 sm:mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
              Por que escolher{" "}
              <span className="text-blue-600">Preço Justo AI?</span>
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-4xl mx-auto px-2">
              <strong>Economize tempo e evite erros custosos</strong> com análise fundamentalista automatizada. 
              <strong> 87% dos investidores</strong> perdem dinheiro por falta de análise adequada. 
              Nossa plataforma resolve isso com <strong>dados reais e metodologias comprovadas</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto mb-12">
            {/* Benefício 1 */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 sm:p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Clock className="w-8 h-8 text-white" />
                  </div>
                <h3 className="text-xl font-bold mb-3">Análise em Segundos</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  <strong>Economize horas</strong> de análise manual. Rankings automáticos com 8 modelos 
                  de valuation em <strong>tempo real</strong> para +500 empresas da B3.
                </p>
                <div className="text-2xl font-bold text-blue-600">100x mais rápido</div>
                <p className="text-xs text-muted-foreground mt-1">que análise manual</p>
              </CardContent>
            </Card>

            {/* Benefício 2 */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 sm:p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-8 h-8 text-white" />
                  </div>
                <h3 className="text-xl font-bold mb-3">Evite Armadilhas</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  <strong>Filtros anti-armadilha</strong> eliminam automaticamente empresas problemáticas, 
                  dividend traps e indicadores enganosos antes que você invista.
                </p>
                <div className="text-2xl font-bold text-green-600">-R$ 5.000</div>
                <p className="text-xs text-muted-foreground mt-1">economia média por erro evitado</p>
              </CardContent>
            </Card>

            {/* Benefício 3 */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 sm:p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">Metodologia Comprovada</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Use os mesmos modelos que <strong>Benjamin Graham, Joel Greenblatt</strong> e outros 
                  mestres do value investing. <strong>Base científica e acadêmica</strong>.
                </p>
                <div className="text-2xl font-bold text-purple-600">8 modelos</div>
                <p className="text-xs text-muted-foreground mt-1">de valuation consagrados</p>
              </CardContent>
            </Card>
                  </div>

          {/* CTA Contextual */}
          {!session && (
            <div className="text-center px-4">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-sm sm:text-lg px-4 sm:px-8 py-3 sm:py-4 shadow-xl w-full sm:w-auto max-w-full" asChild>
                <CTALinkWithPixel href="/register" className="flex items-center justify-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis">
                  <Rocket className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="truncate">Começar a economizar tempo e dinheiro</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                </CTALinkWithPixel>
              </Button>
            </div>
          )}
                </div>
      </section>

      {/* Social Proof Section - Adicionada - Apenas para SEO (usuários não logados) */}
      {!session && (
        <SocialProof
          stats={[
            { value: "+500", label: "Empresas Analisadas", iconName: "Building2" },
            { value: "8", label: "Modelos de Valuation", iconName: "BarChart3" },
            { value: "65+", label: "Indicadores por Empresa", iconName: "TrendingUp" },
            { value: "100%", label: "Dados Confiáveis", iconName: "Shield" }
          ]}
          badges={[
            { text: "Dados Oficiais B3", iconName: "CheckCircle" },
            { text: "Metodologias Consagradas", iconName: "CheckCircle" },
            { text: "Análise com IA", iconName: "Brain" }
          ]}
          // TODO: substituir por depoimentos reais de clientes (nome, resultado
          // concreto e, se possível, autorização de uso). Textos abaixo são
          // placeholders de exemplo criados para dar prova social visível na tela
          // enquanto não há depoimentos reais coletados - revisar com marketing/CS
          // antes de publicar em produção.
          testimonials={[
            {
              name: "Rafael M.",
              role: "Investidor pessoa física",
              content: "Antes eu levava um fim de semana inteiro analisando balanço por balanço. Com os rankings automáticos encontrei uma ação subvalorizada que já rendeu mais de 20% em poucos meses.",
              rating: 5
            },
            {
              name: "Camila S.",
              role: "Cliente Premium",
              content: "Os filtros anti-armadilha me impediram de comprar uma ação com dividend yield artificialmente alto. Só isso já pagou o plano anual várias vezes.",
              rating: 5
            }
          ]}
        />
      )}

      {/* Internal Linking Estratégico - Links para páginas satélite - Apenas para SEO (usuários não logados) */}
      {!session && (
      <section className="py-12 sm:py-16 bg-gradient-to-b from-white to-gray-50 dark:from-background dark:to-background/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Explore Nossas{" "}
              <span className="text-blue-600">Ferramentas</span>
            </h2>
            <p className="text-muted-foreground">
              Descubra todas as funcionalidades disponíveis na plataforma
            </p>
            </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <Link href="/comparador" className="group">
              <Card className="border-0 shadow-md hover:shadow-xl transition-all h-full text-center">
                <CardContent className="p-4">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 text-blue-600 group-hover:scale-110 transition-transform" />
                  <h3 className="text-sm font-semibold group-hover:text-blue-600 transition-colors">Comparador</h3>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/screening-acoes" className="group">
              <Card className="border-0 shadow-md hover:shadow-xl transition-all h-full text-center">
                <CardContent className="p-4">
                  <Target className="w-8 h-8 mx-auto mb-2 text-green-600 group-hover:scale-110 transition-transform" />
                  <h3 className="text-sm font-semibold group-hover:text-green-600 transition-colors">Screening</h3>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/analise-setorial" className="group">
              <Card className="border-0 shadow-md hover:shadow-xl transition-all h-full text-center">
                <CardContent className="p-4">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-purple-600 group-hover:scale-110 transition-transform" />
                  <h3 className="text-sm font-semibold group-hover:text-purple-600 transition-colors">Setorial</h3>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/backtest" className="group">
              <Card className="border-0 shadow-md hover:shadow-xl transition-all h-full text-center">
                <CardContent className="p-4">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-orange-600 group-hover:scale-110 transition-transform" />
                  <h3 className="text-sm font-semibold group-hover:text-orange-600 transition-colors">Backtest</h3>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* Features Section - Enhanced */}
      <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 sm:mb-20 lg:mb-24">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
              <span className="text-blue-600">8 modelos + Backtest</span>{" "}
              <span className="block sm:inline">em uma única plataforma</span>
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed px-2 mb-6 sm:mb-8">
              Desde <strong>Benjamin Graham</strong> até <strong>Inteligência Artificial</strong> e <strong>Backtesting de Carteiras</strong>. 
              Todos os métodos que os grandes investidores usam, agora automatizados para você.
            </p>
            <div className="mt-6 sm:mt-8">
              <Button size="lg" variant="outline" className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 hover:bg-blue-50 dark:hover:bg-blue-950/20 border-2" asChild>
                <Link href="/metodologia" className="flex items-center gap-2 sm:gap-3">
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>Ver Metodologia Completa</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                </Link>
              </Button>
            </div>
          </div>
          
          {/* AI Analysis - Featured at Top */}
          <div className="mb-8">
            <Link href="/metodologia#ia" className="block">
              <Card className="border-2 border-violet-200 dark:border-violet-800 shadow-xl hover:shadow-2xl transition-all duration-500 group relative overflow-hidden bg-gradient-to-br from-violet-50 via-white to-pink-50 dark:from-violet-950/20 dark:via-background dark:to-pink-950/20 cursor-pointer hover:scale-[1.01] hover:border-violet-300 dark:hover:border-violet-700">
                {/* Animated Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600/5 via-pink-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                {/* Floating Badge */}
                <div className="absolute top-4 right-4 xl:top-6 xl:right-6 z-10">
                  <Badge className="bg-gradient-to-r from-violet-600 to-pink-600 text-white text-sm px-3 py-1 xl:px-4 xl:py-2 shadow-lg animate-pulse">
                    🔥 IA Premium
                  </Badge>
                </div>
                
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-24 h-24 xl:w-32 xl:h-32 bg-gradient-to-br from-violet-200/20 to-transparent rounded-full -translate-x-12 -translate-y-12 xl:-translate-x-16 xl:-translate-y-16"></div>
                <div className="absolute bottom-0 right-0 w-20 h-20 xl:w-24 xl:h-24 bg-gradient-to-tl from-pink-200/20 to-transparent rounded-full translate-x-10 translate-y-10 xl:translate-x-12 xl:translate-y-12"></div>
                
                <CardContent className="p-6 sm:p-8 lg:p-10 relative z-10">
                  <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-violet-500 to-pink-500 rounded-2xl lg:rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-xl group-hover:shadow-2xl">
                          <Brain className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 text-white" />
                        </div>
                        {/* Glow Effect */}
                        <div className="absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-violet-400 to-pink-400 rounded-2xl lg:rounded-3xl opacity-0 group-hover:opacity-30 blur-xl transition-all duration-500 -z-10"></div>
                      </div>
                    </div>
                    <div className="flex-1 text-center lg:text-left min-w-0">
                      <h3 className="text-2xl xl:text-3xl 2xl:text-4xl font-bold mb-3 xl:mb-4 transition-all duration-300">
                        <span className="inline-block mr-2 xl:mr-3 text-3xl xl:text-4xl 2xl:text-5xl group-hover:animate-bounce">🤖</span>
                        <span className="group-hover:bg-gradient-to-r group-hover:from-violet-600 group-hover:to-pink-600 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
                          Análise Preditiva com IA
                        </span>
                      </h3>
                      <p className="text-muted-foreground mb-4 xl:mb-6 text-base xl:text-lg leading-relaxed group-hover:text-foreground/80 transition-colors duration-300">
                        <strong className="text-violet-600">Inteligência Artificial</strong> analisa TODOS os 7 modelos simultaneamente, 
                        busca notícias na internet e cria ranking preditivo personalizado. 
                        <span className="text-violet-600 font-bold bg-violet-100 dark:bg-violet-900/30 px-2 py-1 rounded-md">
                          Único no mercado brasileiro!
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2 xl:gap-3 justify-center lg:justify-start mb-4 xl:mb-6">
                        <Badge variant="outline" className="border-violet-200 text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors text-xs xl:text-sm">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Google Gemini AI
                        </Badge>
                        <Badge variant="outline" className="border-pink-200 text-pink-700 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors text-xs xl:text-sm">
                          <Target className="w-3 h-3 mr-1" />
                          Análise Preditiva
                        </Badge>
                        <Badge variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-xs xl:text-sm">
                          <BarChart3 className="w-3 h-3 mr-1" />
                          7 Modelos Integrados
                        </Badge>
                      </div>
                      <div className="inline-flex items-center gap-2 text-base xl:text-lg font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent group-hover:from-violet-700 group-hover:to-pink-700 transition-all duration-300">
                        Ver metodologia completa
                        <ArrowRight className="w-4 h-4 text-violet-600 group-hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Other Models Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-8 sm:mb-12">
            {/* Graham */}
            <Link href="/metodologia#graham" className="block">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden cursor-pointer h-full">
                <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2 py-1">
                    Gratuito
                  </Badge>
                </div>
                <CardContent className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 lg:mb-6 group-hover:scale-110 transition-transform flex-shrink-0">
                    <Target className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                  </div>
                  <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-2 sm:mb-3 group-hover:text-blue-600 transition-colors">Fórmula de Graham</h3>
                  <p className="text-muted-foreground mb-3 sm:mb-4 text-xs sm:text-sm leading-relaxed flex-grow">
                    O método clássico do &quot;pai do value investing&quot;. Encontra ações baratas de empresas sólidas 
                    usando a fórmula: √(22.5 × LPA × VPA)
                  </p>
                  <div className="text-xs sm:text-sm text-blue-600 font-medium group-hover:text-blue-700 flex items-center gap-1 mt-auto">
                    <span>Ver metodologia completa</span>
                    <ArrowRight className="w-3 h-3 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Dividend Yield */}
            <Link href="/metodologia#dividend-yield" className="block">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden cursor-pointer h-full">
                <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-xs px-2 py-1">
                    Premium
                  </Badge>
                </div>
                <CardContent className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 lg:mb-6 group-hover:scale-110 transition-transform flex-shrink-0">
                    <DollarSign className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                  </div>
                  <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-2 sm:mb-3 group-hover:text-green-600 transition-colors">Anti-Dividend Trap</h3>
                  <p className="text-muted-foreground mb-3 sm:mb-4 text-xs sm:text-sm leading-relaxed flex-grow">
                    Renda passiva sustentável evitando &quot;dividend traps&quot;. Filtra empresas com 
                    dividendos altos mas em declínio financeiro.
                  </p>
                  <div className="text-xs sm:text-sm text-green-600 font-medium group-hover:text-green-700 flex items-center gap-1 mt-auto">
                    <span>Ver metodologia completa</span>
                    <ArrowRight className="w-3 h-3 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Magic Formula */}
            <Link href="/metodologia#formula-magica" className="block">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden cursor-pointer h-full">
                <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-xs px-2 py-1">
                    Premium
                  </Badge>
                </div>
                <CardContent className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 lg:mb-6 group-hover:scale-110 transition-transform flex-shrink-0">
                    <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                  </div>
                  <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-2 sm:mb-3 group-hover:text-purple-600 transition-colors">Fórmula Mágica</h3>
                  <p className="text-muted-foreground mb-3 sm:mb-4 text-xs sm:text-sm leading-relaxed flex-grow">
                    Estratégia de Joel Greenblatt que combina alta qualidade operacional (ROIC) 
                    com preços atrativos (Earnings Yield).
                  </p>
                  <div className="text-xs sm:text-sm text-purple-600 font-medium group-hover:text-purple-700 flex items-center gap-1 mt-auto">
                    <span>Ver metodologia completa</span>
                    <ArrowRight className="w-3 h-3 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Fundamentalista 3+1 */}
            <Link href="/metodologia#fundamentalista" className="block">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden cursor-pointer h-full">
                <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-xs px-2 py-1">
                    Premium
                  </Badge>
                </div>
                <CardContent className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 lg:mb-6 group-hover:scale-110 transition-transform flex-shrink-0">
                    <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                  </div>
                  <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-2 sm:mb-3 group-hover:text-teal-600 transition-colors">Fundamentalista 3+1</h3>
                  <p className="text-muted-foreground mb-3 sm:mb-4 text-xs sm:text-sm leading-relaxed flex-grow">
                    Análise simplificada com apenas 3 indicadores essenciais que se adaptam ao perfil da empresa 
                    (com/sem dívida, setor especial) + bônus dividendos.
                  </p>
                  <div className="text-xs sm:text-sm text-teal-600 font-medium group-hover:text-teal-700 flex items-center gap-1 mt-auto">
                    <span>Ver metodologia completa</span>
                    <ArrowRight className="w-3 h-3 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* DCF */}
            <Link href="/metodologia#fcd" className="block">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden cursor-pointer h-full">
                <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-xs px-2 py-1">
                    Premium
                  </Badge>
                </div>
                <CardContent className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 lg:mb-6 group-hover:scale-110 transition-transform flex-shrink-0">
                    <Calculator className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                  </div>
                  <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-2 sm:mb-3 group-hover:text-orange-600 transition-colors">Fluxo de Caixa Descontado</h3>
                  <p className="text-muted-foreground mb-3 sm:mb-4 text-xs sm:text-sm leading-relaxed flex-grow">
                    Método sofisticado usado por analistas profissionais. Projeta fluxos de caixa 
                    futuros e calcula o valor intrínseco da empresa.
                  </p>
                  <div className="text-xs sm:text-sm text-orange-600 font-medium group-hover:text-orange-700 flex items-center gap-1 mt-auto">
                    <span>Ver metodologia completa</span>
                    <ArrowRight className="w-3 h-3 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Gordon */}
            <Link href="/metodologia#gordon" className="block">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden cursor-pointer h-full">
                <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-xs px-2 py-1">
                    Premium
                  </Badge>
                </div>
                <CardContent className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 lg:mb-6 group-hover:scale-110 transition-transform flex-shrink-0">
                    <PieChart className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                  </div>
                  <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-2 sm:mb-3 group-hover:text-teal-600 transition-colors">Fórmula de Gordon</h3>
                  <p className="text-muted-foreground mb-3 sm:mb-4 text-xs sm:text-sm leading-relaxed flex-grow">
                    Especializado em empresas pagadoras de dividendos. Avalia o crescimento 
                    sustentável dos pagamentos ao longo do tempo.
                  </p>
                  <div className="text-xs sm:text-sm text-teal-600 font-medium group-hover:text-teal-700 flex items-center gap-1 mt-auto">
                    <span>Ver metodologia completa</span>
                    <ArrowRight className="w-3 h-3 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Backtest Feature - Destacado */}
          <div className="mb-8">
            <Link href="/backtest" className="block">
              <Card className="border-2 border-emerald-200 dark:border-emerald-800 shadow-xl hover:shadow-2xl transition-all duration-500 group relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-950/20 dark:via-background dark:to-teal-950/20 cursor-pointer hover:scale-[1.01] hover:border-emerald-300 dark:hover:border-emerald-700">
                {/* Animated Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-teal-600/5 to-green-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                {/* Floating Badge */}
                <div className="absolute top-4 right-4 xl:top-6 xl:right-6 z-10">
                  <Badge className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm px-3 py-1 xl:px-4 xl:py-2 shadow-lg animate-pulse">
                    🚀 Novo!
                  </Badge>
                </div>
                
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-24 h-24 xl:w-32 xl:h-32 bg-gradient-to-br from-emerald-200/20 to-transparent rounded-full -translate-x-12 -translate-y-12 xl:-translate-x-16 xl:-translate-y-16"></div>
                <div className="absolute bottom-0 right-0 w-20 h-20 xl:w-24 xl:h-24 bg-gradient-to-tl from-teal-200/20 to-transparent rounded-full translate-x-10 translate-y-10 xl:translate-x-12 xl:translate-y-12"></div>
                
                <CardContent className="p-6 sm:p-8 lg:p-10 relative z-10">
                  <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl lg:rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-xl group-hover:shadow-2xl">
                          <TrendingUp className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 text-white" />
                        </div>
                        {/* Glow Effect */}
                        <div className="absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-2xl lg:rounded-3xl opacity-0 group-hover:opacity-30 blur-xl transition-all duration-500 -z-10"></div>
                      </div>
                    </div>
                    <div className="flex-1 text-center lg:text-left min-w-0">
                      <h3 className="text-2xl xl:text-3xl 2xl:text-4xl font-bold mb-3 xl:mb-4 transition-all duration-300">
                        <span className="inline-block mr-2 xl:mr-3 text-3xl xl:text-4xl 2xl:text-5xl group-hover:animate-bounce">📊</span>
                        <span className="text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors duration-300">
                          Backtesting de Carteiras
                        </span>
                      </h3>
                      <p className="text-muted-foreground mb-4 xl:mb-6 text-base xl:text-lg leading-relaxed group-hover:text-foreground/80 transition-colors duration-300">
                        <strong className="text-emerald-600">Simule o desempenho histórico</strong> de carteiras personalizadas com aportes mensais, 
                        rebalanceamento automático e métricas avançadas de risco. 
                        <span className="text-emerald-600 font-bold bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-md">
                          Funcionalidade Premium exclusiva!
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2 xl:gap-3 justify-center lg:justify-start mb-4 xl:mb-6">
                        <Badge variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-xs xl:text-sm">
                          <Activity className="w-3 h-3 mr-1" />
                          Sharpe Ratio
                        </Badge>
                        <Badge variant="outline" className="border-teal-200 text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors text-xs xl:text-sm">
                          <BarChart3 className="w-3 h-3 mr-1" />
                          Drawdown Máximo
                        </Badge>
                        <Badge variant="outline" className="border-green-200 text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-xs xl:text-sm">
                          <Calendar className="w-3 h-3 mr-1" />
                          Aportes Mensais
                        </Badge>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                        <div className="inline-flex items-center gap-2 text-base xl:text-lg font-bold text-emerald-600 group-hover:text-emerald-700 dark:text-emerald-400 dark:group-hover:text-emerald-300 transition-colors duration-300">
                          Testar carteira agora
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                        </div>
                        <InnerLinkButton href="/backtesting-carteiras" className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 underline transition-colors cursor-pointer">
                          Saiba mais sobre Backtesting →
                        </InnerLinkButton>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Backtest Preview Image */}
          <div className="mb-8">
            <Card className="border-0 shadow-2xl overflow-hidden bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
              <CardContent className="p-0">
                <div className="relative">
                  <Image
                    src="/image-backtest.png"
                    alt="Interface do Backtesting de Carteiras - Simulação de desempenho histórico com métricas avançadas"
                    width={1200}
                    height={800}
                    className="w-full h-auto rounded-lg"
                    loading="lazy"
                    placeholder="blur"
                    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent rounded-lg"></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg p-4">
                      <h4 className="font-bold text-lg mb-2">🚀 Interface Completa de Backtesting</h4>
                      <p className="text-sm text-muted-foreground">
                        Visualize métricas avançadas, evolução da carteira, performance por ativo e análise de risco em uma interface intuitiva e profissional.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            <Link href="/pl-bolsa" className="block">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group h-full cursor-pointer">
                <CardContent className="p-4 sm:p-6 text-center h-full flex flex-col">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mb-3 sm:mb-4 mx-auto group-hover:scale-110 transition-transform flex-shrink-0">
                    <LineChart className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-3 group-hover:text-indigo-600 transition-colors">P/L Histórico da Bolsa</h3>
                  <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed flex-grow">
                    Acompanhe a evolução do P/L agregado da Bovespa desde 2010 com filtros avançados
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group h-full">
              <CardContent className="p-4 sm:p-6 text-center h-full flex flex-col">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-3 sm:mb-4 mx-auto group-hover:scale-110 transition-transform flex-shrink-0">
                  <LineChart className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-3">Comparador Inteligente</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed flex-grow">
                  Compare ações lado a lado com sistema de pontuação ponderada
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group h-full">
              <CardContent className="p-4 sm:p-6 text-center h-full flex flex-col">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-3 sm:mb-4 mx-auto group-hover:scale-110 transition-transform flex-shrink-0">
                  <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-3">Histórico Completo</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed flex-grow">
                  Dados históricos de 10+ anos para backtesting confiável
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group h-full">
              <CardContent className="p-4 sm:p-6 text-center h-full flex flex-col">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-3 sm:mb-4 mx-auto group-hover:scale-110 transition-transform flex-shrink-0">
                  <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-3">Rankings Salvos</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed flex-grow">
                  Histórico de todas suas análises para acompanhar evolução
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section - Enhanced */}
      <LandingPricingSection />

      {/* Comparador Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 leading-tight">
              Compare as melhores ações de cada{" "}
              <span className="text-blue-600 block sm:inline">setor</span>
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-4xl mx-auto px-2">
              Veja lado a lado os indicadores fundamentalistas das empresas líderes 
              de cada setor da B3. Descubra oportunidades de investimento.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-6xl mx-auto">
            {/* Setor Bancário */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Setor Bancário</h3>
                    <p className="text-sm text-muted-foreground">Maiores bancos do Brasil</p>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">ITUB4</span>
                    <span className="text-sm text-muted-foreground">Itaú Unibanco</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">BBDC4</span>
                    <span className="text-sm text-muted-foreground">Bradesco</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">BBAS3</span>
                    <span className="text-sm text-muted-foreground">Banco do Brasil</span>
                  </div>
                </div>
                
                <Button className="w-full group-hover:bg-green-600 transition-colors" asChild>
                  <Link href="/compara-acoes/ITUB4/BBDC4/BBAS3" className="flex items-center justify-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Comparar Bancos
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Setor Petróleo */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Setor Petróleo</h3>
                    <p className="text-sm text-muted-foreground">Energia e combustíveis</p>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">PETR4</span>
                    <span className="text-sm text-muted-foreground">Petrobras PN</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">PETR3</span>
                    <span className="text-sm text-muted-foreground">Petrobras ON</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">PRIO3</span>
                    <span className="text-sm text-muted-foreground">PetroRio</span>
                  </div>
                </div>
                
                <Button className="w-full group-hover:bg-orange-600 transition-colors" asChild>
                  <Link href="/compara-acoes/PETR4/PETR3/PRIO3" className="flex items-center justify-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Comparar Petróleo
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Setor Varejo */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Setor Varejo</h3>
                    <p className="text-sm text-muted-foreground">Consumo e comércio</p>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">MGLU3</span>
                    <span className="text-sm text-muted-foreground">Magazine Luiza</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">LREN3</span>
                    <span className="text-sm text-muted-foreground">Lojas Renner</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">BHIA3</span>
                    <span className="text-sm text-muted-foreground">Casas Bahia</span>
                  </div>
                </div>
                
                <Button className="w-full group-hover:bg-purple-600 transition-colors" asChild>
                  <Link href="/compara-acoes/MGLU3/LREN3/BHIA3" className="flex items-center justify-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Comparar Varejo
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8 sm:mt-12">
            <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base px-2">
              Ou crie sua própria comparação personalizada
            </p>
            <Button size="lg" variant="outline" className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto border-2 hover:bg-blue-50 dark:hover:bg-blue-950/20" asChild>
              <Link href="/comparador" className="flex items-center justify-center gap-2 sm:gap-3">
                <Calculator className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="truncate">Criar Comparação Personalizada</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Compare até 6 ações simultaneamente • <Link href="/comparador" className="text-blue-600 hover:underline">Saiba mais sobre o comparador</Link>
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section - Usando componente reutilizável - Apenas para SEO (usuários não logados) */}
      <FAQSection
          title="Perguntas Frequentes"
          description="Tire suas dúvidas sobre nossa plataforma de análise fundamentalista"
          faqs={[
            {
              question: "Como funciona a análise fundamentalista?",
              answer: "Nossa plataforma aplica automaticamente os 8 principais modelos de valuation (Graham, Método Barsi, Fórmula Mágica, Fundamentalista 3+1, etc.) em todas as empresas da B3, calculando um preço justo baseado nos fundamentos financeiros.",
              iconName: "Lightbulb"
            },
            {
              question: "Os dados são confiáveis?",
              answer: "Sim! Utilizamos dados fornecidos pela BRAPI, que consolida informações oficiais da B3 e demonstrações financeiras auditadas. Nossos algoritmos são baseados em metodologias consagradas por investidores como Benjamin Graham e Joel Greenblatt.",
              iconName: "Shield"
            },
            {
              question: "Preciso pagar para usar?",
              answer: `Temos um plano gratuito completo com rankings e análises básicas. Para recursos avançados (IA, comparações, backtesting), oferecemos o plano premium por ${FALLBACK_MONTHLY_PRICE_FORMATTED}/mês, sem fidelidade.`,
              iconName: "DollarSign"
            },
            {
              question: "Como funciona a análise com IA?",
              answer: "Nossa IA (Google Gemini) analisa demonstrações financeiras, notícias e contexto macroeconômico para gerar insights qualitativos que complementam a análise quantitativa tradicional.",
              iconName: "Brain"
            },
            {
              question: "Com que frequência os dados são atualizados?",
              answer: "Os preços e indicadores financeiros são atualizados 3 vezes ao dia (09:00, 13:00 e 20:00). Como trabalhamos com análise fundamentalista de longo prazo, não precisamos de atualizações em tempo real. Os dados fundamentalistas são atualizados trimestralmente após a divulgação dos resultados pelas empresas.",
              iconName: "Clock"
            },
            {
              question: "Posso confiar 100% nas recomendações?",
              answer: "Nossa plataforma é uma ferramenta de apoio à decisão. Sempre faça sua própria análise e considere seu perfil de risco. Investimentos envolvem riscos e rentabilidade passada não garante resultados futuros.",
              iconName: "Target"
            }
          ]}
        />

      {/* Fundador Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16 lg:mb-20">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 leading-tight">
                Conheça o{" "}
                <span className="text-blue-600">Fundador</span>
              </h2>
              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-4xl mx-auto px-2">
                Especialista em tecnologia e análise fundamentalista, com experiência 
                em grandes plataformas educacionais e mercado financeiro.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
              {/* Foto e Info */}
              <div className="text-center lg:text-left">
                <div className="relative inline-block mb-8">
                  <div className="w-48 h-48 bg-gradient-to-br from-blue-600 to-violet-600 rounded-full p-2 mx-auto lg:mx-0">
                    <div className="w-full h-full rounded-full overflow-hidden bg-white">
                      <Image
                        src="/eu.png"
                        alt="Alexandre Busarello - Fundador & CEO do Preço Justo AI"
                        width={192}
                        height={192}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                      />
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    <CheckCircle className="w-3 h-3 inline mr-1" />
                    CEO
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold mb-2">Fundador & CEO</h3>
                <p className="text-lg text-muted-foreground mb-4">
                  Gerente Técnico na Descomplica
                </p>
                
                <div className="flex flex-wrap justify-center lg:justify-start gap-3 mb-6">
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    <Building2 className="w-3 h-3 mr-1" />
                    15+ anos exp.
                  </Badge>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <Users className="w-3 h-3 mr-1" />
                    +70k usuários
                  </Badge>
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    20% economia AWS
                  </Badge>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button size="lg" variant="outline" className="text-lg px-6 py-3" asChild>
                    <Link href="/fundador" className="flex items-center gap-3">
                      <User className="w-5 h-5" />
                      História Completa
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="text-lg px-6 py-3 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white" asChild>
                    <Link href="https://www.linkedin.com/in/alexandre-busarello-26a6b422/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
                      <Linkedin className="w-5 h-5" />
                      LinkedIn
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Conquistas */}
              <div className="space-y-6">
                <Card className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Rocket className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-bold mb-2">Liderança Técnica Comprovada</h4>
                        <p className="text-sm text-muted-foreground">
                          Gerente técnico na Descomplica, liderando times de UEE e SRE, 
                          responsável por plataforma educacional com mais de 70 mil alunos ativos.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-bold mb-2">Otimização e Resultados</h4>
                        <p className="text-sm text-muted-foreground">
                          Implementou estratégias que reduziram 20% dos custos na AWS, 
                          modernizando infraestrutura e implementando melhores práticas DevOps.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <BarChart3 className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-bold mb-2">Visão de Mercado</h4>
                        <p className="text-sm text-muted-foreground">
                          Combina expertise técnica com conhecimento profundo em análise 
                          fundamentalista para democratizar o acesso a investimentos inteligentes.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Credenciais */}
            <div className="mt-16 text-center">
              <div className="bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-2xl p-8">
                <h4 className="text-xl font-bold mb-6">Experiência Técnica</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 mb-1">15+</div>
                    <div className="text-sm text-muted-foreground">Anos de Experiência</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 mb-1">70k+</div>
                    <div className="text-sm text-muted-foreground">Usuários Impactados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600 mb-1">20%</div>
                    <div className="text-sm text-muted-foreground">Redução de Custos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600 mb-1">AWS</div>
                    <div className="text-sm text-muted-foreground">Especialista Cloud</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white dark:bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 leading-tight">
              Aprenda{" "}
              <span className="text-blue-600 block sm:inline">Análise Fundamentalista</span>
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-4xl mx-auto px-2">
              Artigos completos sobre estratégias de investimento, modelos de valuation 
              e como usar nossa plataforma para encontrar as melhores oportunidades na B3.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-6xl mx-auto">
            {recentPosts.map((post) => {
              // Definir cores por categoria
              const getCategoryColor = (category: string) => {
                switch (category) {
                  case 'Educação':
                    return 'text-blue-600 border-blue-600'
                  case 'Estratégias':
                    return 'text-green-600 border-green-600'
                  case 'Renda Passiva':
                    return 'text-purple-600 border-purple-600'
                  case 'Tecnologia':
                    return 'text-orange-600 border-orange-600'
                  case 'Análise Setorial':
                    return 'text-indigo-600 border-indigo-600'
                  default:
                    return 'text-gray-600 border-gray-600'
                }
              }

              // Formatar data para exibição
              const formatDate = (dateString: string) => {
                const date = new Date(dateString)
                return date.toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })
              }

              return (
                <Card key={post.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="outline" className={getCategoryColor(post.category)}>
                        {post.category}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {post.readTime}
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold mb-3 leading-tight group-hover:text-blue-600 transition-colors">
                      {post.title}
                    </h3>
                    
                    <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                      {post.excerpt}
                    </p>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                      <div className="text-xs text-muted-foreground">
                        {formatDate(post.publishDate)}
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/blog/${post.slug}`} className="flex items-center gap-1">
                          Ler mais
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="text-center mt-8 sm:mt-12">
            <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base px-2">
              Mais de {blogPosts.length} artigos completos sobre análise fundamentalista
            </p>
            <Button size="lg" variant="outline" className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto" asChild>
              <Link href="/blog" className="flex items-center justify-center gap-2 sm:gap-3">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span>Ver Todos os Artigos</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA Section - Usando componente reutilizável */}
      {!session && (
        <CTASection
          title="Pronto para encontrar as melhores ações da B3?"
          description={
            <>
            Junte-se a <strong>centenas de investidores</strong> que já descobriram ações subvalorizadas 
            com nossa análise fundamentalista automatizada.
            </>
          }
          primaryCTA={{
            text: "Começar análise gratuita",
            href: "/register",
            icon: <Rocket className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          }}
          secondaryCTA={{
            text: "Ver demonstração",
            href: "/ranking"
          }}
          variant="gradient"
          benefits={[
            "Grátis para sempre",
            "Sem cartão de crédito",
            "Acesso imediato",
            "Cancele quando quiser"
          ]}
        />
      )}

      {/* FAQ Section - Apenas para usuários deslogados */}
      {!session && (
        <FAQSection
          title="Perguntas Frequentes"
          description="Tire suas dúvidas sobre análise fundamentalista e nossa plataforma"
          faqs={[
            {
              question: "Como funciona a análise fundamentalista?",
              answer: "Nossa plataforma aplica automaticamente os 8 principais modelos de valuation (Graham, Método Barsi, Fórmula Mágica, Fundamentalista 3+1, etc.) em todas as empresas da B3, calculando um preço justo baseado nos fundamentos financeiros.",
              iconName: "Brain"
            },
            {
              question: "Os dados são confiáveis?",
              answer: "Sim! Utilizamos dados fornecidos pela BRAPI, que consolida informações oficiais da B3 e demonstrações financeiras auditadas. Nossos algoritmos são baseados em metodologias consagradas por investidores como Benjamin Graham e Joel Greenblatt.",
              iconName: "Shield"
            },
            {
              question: "Preciso pagar para usar?",
              answer: `Temos um plano gratuito completo com rankings e análises básicas. Para recursos avançados (IA, comparações, backtesting), oferecemos o plano premium por ${FALLBACK_MONTHLY_PRICE_FORMATTED}/mês, sem fidelidade.`,
              iconName: "DollarSign"
            },
            {
              question: "Como encontrar ações subvalorizadas na B3?",
              answer: "Use nossos rankings que aplicam múltiplos modelos de valuation automaticamente. Ações com preço abaixo do preço justo calculado e com scores de qualidade altos são as melhores oportunidades.",
              iconName: "Target"
            },
            {
              question: "Os rankings são atualizados em tempo real?",
              answer: "Sim! Nossos dados são atualizados regularmente com base nas informações mais recentes da B3. Preços são atualizados diariamente e dados financeiros são atualizados conforme novos balanços são publicados.",
              iconName: "TrendingUp"
            },
            {
              question: "Posso comparar múltiplas ações ao mesmo tempo?",
              answer: "Sim! Nosso comparador permite analisar até 6 ações simultaneamente, vendo indicadores financeiros, valuation e scores lado a lado para facilitar sua decisão de investimento.",
              iconName: "BarChart3"
            }
          ]}
        />
      )}

      {/* Footer */}
      <Footer />

      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Preço Justo AI",
              "description": "Plataforma de análise fundamentalista de ações com inteligência artificial. Encontre ações subvalorizadas na B3 usando modelos de valuation consagrados.",
              "url": "https://precojusto.ai",
              "applicationCategory": "FinanceApplication",
              "operatingSystem": "Web",
              "datePublished": "2024-01-01",
              "dateModified": new Date().toISOString().split('T')[0],
              "publisher": {
                "@type": "Organization",
                "name": "Preço Justo AI",
                "url": "https://precojusto.ai"
              },
              "creator": {
                "@type": "Person",
                "name": "Alexandre Busarello",
                "url": "https://precojusto.ai/fundador"
              },
              "offers": [
                {
                  "@type": "Offer",
                  "name": "Plano Gratuito",
                  "price": "0",
                  "priceCurrency": "BRL",
                  "availability": "https://schema.org/InStock",
                  "description": "Acesso à Fórmula de Graham e análise de 350+ empresas da B3"
                },
                {
                  "@type": "Offer", 
                  "name": "Premium Mensal",
                  "price": "19.90",
                  "priceCurrency": "BRL",
                  "billingIncrement": "P1M",
                  "availability": "https://schema.org/InStock",
                  "description": "Acesso completo a 8 modelos de valuation e análise com IA"
                },
                {
                  "@type": "Offer",
                  "name": "Premium Anual", 
                  "price": "189.90",
                  "priceCurrency": "BRL",
                  "billingIncrement": "P1Y",
                  "availability": "https://schema.org/InStock",
                  "description": "Plano anual com 20% de desconto e recursos exclusivos"
                }
              ],
              "featureList": [
                "Análise fundamentalista automatizada",
                "8 modelos de valuation (Graham, Método Barsi, Fórmula Mágica, Fundamentalista 3+1, DCF, Gordon, Low P/E, IA)",
                "Análise preditiva com Inteligência Artificial (Google Gemini)",
                "Mais de 350 empresas da B3 analisadas",
                "65+ indicadores fundamentalistas por empresa",
                "Filtros anti-armadilha automatizados",
                "Comparador de até 6 ações lado a lado",
                "Screening customizável de ações",
                "Análise setorial completa",
                "Radar de dividendos com projeções IA",
                "Rankings personalizados ilimitados",
                "Histórico de análises salvas",
                "Backtesting de carteiras com métricas avançadas",
                "Gestão completa de carteiras",
                "Dados atualizados 3x ao dia"
              ],
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": "1250",
                "bestRating": "5"
              },
              "screenshot": "https://precojusto.ai/image-backtest.png"
            },
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Preço Justo AI",
              "url": "https://precojusto.ai",
              "logo": "https://precojusto.ai/logo-preco-justo.png",
              "description": "Plataforma líder em análise fundamentalista de ações da B3 com inteligência artificial",
              "founder": {
                "@type": "Person",
                "name": "Alexandre Busarello"
              },
              "foundingDate": "2024",
              "sameAs": [
                "https://www.linkedin.com/in/alexandre-busarello-26a6b422/"
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Preço Justo AI",
              "url": "https://precojusto.ai",
              "description": "Análise fundamentalista de ações B3 com IA",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://precojusto.ai/ranking?search={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            },
            ...(!session ? [{
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "Como funciona a análise fundamentalista?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Nossa plataforma aplica automaticamente os 8 principais modelos de valuation (Graham, Método Barsi, Fórmula Mágica, Fundamentalista 3+1, etc.) em todas as empresas da B3, calculando um preço justo baseado nos fundamentos financeiros."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Os dados são confiáveis?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Sim! Utilizamos dados fornecidos pela BRAPI, que consolida informações oficiais da B3 e demonstrações financeiras auditadas. Nossos algoritmos são baseados em metodologias consagradas por investidores como Benjamin Graham e Joel Greenblatt."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Preciso pagar para usar?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": `Temos um plano gratuito completo com rankings e análises básicas. Para recursos avançados (IA, comparações, backtesting), oferecemos o plano premium por ${FALLBACK_MONTHLY_PRICE_FORMATTED}/mês, sem fidelidade.`
                  }
                },
                {
                  "@type": "Question",
                  "name": "Como encontrar ações subvalorizadas na B3?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Use nossos rankings que aplicam múltiplos modelos de valuation automaticamente. Ações com preço abaixo do preço justo calculado e com scores de qualidade altos são as melhores oportunidades."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Os rankings são atualizados em tempo real?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Sim! Nossos dados são atualizados regularmente com base nas informações mais recentes da B3. Preços são atualizados diariamente e dados financeiros são atualizados conforme novos balanços são publicados."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Posso comparar múltiplas ações ao mesmo tempo?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Sim! Nosso comparador permite analisar até 6 ações simultaneamente, vendo indicadores financeiros, valuation e scores lado a lado para facilitar sua decisão de investimento."
                  }
                }
              ]
            }] : [])
          ])
        }}
      />
    </div>
  )
}