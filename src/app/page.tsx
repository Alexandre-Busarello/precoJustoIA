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
  Lightbulb,
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
import { AlfaBanner } from "@/components/alfa-banner"
import { AlfaEarlyAdopterCTA } from "@/components/alfa-early-adopter-cta"
import { LandingPricingSection } from "@/components/landing-pricing-section"
import { AlfaVitalicioConditions } from "@/components/alfa-vitalicio-conditions"

export const metadata: Metadata = {
  title: "Análise Fundamentalista de Ações B3 com IA | Preço Justo AI - Investimentos Bovespa",
  description: "🚀 Análise fundamentalista automatizada de ações da B3/Bovespa com IA. Fórmula de Graham, Dividend Yield, Fórmula Mágica + 8 modelos de valuation. Rankings gratuitos, comparador de ações e preço justo. +350 empresas analisadas. Comece grátis!",
  keywords: "análise fundamentalista ações, ações B3, bovespa investimentos, valuation ações, como investir em ações, melhores ações B3, análise de ações grátis, preço justo ações, dividend yield, fórmula mágica greenblatt, benjamin graham, ranking ações, comparador ações bovespa, investir bolsa valores, ações subvalorizadas, análise técnica fundamentalista",
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
    description: "🚀 Análise fundamentalista automatizada de ações da B3/Bovespa com IA. Fórmula de Graham, Dividend Yield, Fórmula Mágica + 8 modelos de valuation. +350 empresas analisadas. Comece grátis!",
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
    description: "🚀 Análise fundamentalista automatizada de ações da B3/Bovespa com IA. Fórmula de Graham, Dividend Yield + 8 modelos. Comece grátis!",
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
  const blogPosts = getAllPosts()
  const recentPosts = blogPosts.slice(0, 3)

  return (
    <div>
      <AlfaBanner variant="landing" />
      {/* Hero Section - Enhanced */}
      <section className="relative overflow-hidden w-full bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-blue-950/20 dark:via-background dark:to-violet-950/20 pt-24 sm:pt-32 lg:pt-40 pb-16 sm:pb-24 lg:pb-32">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]"></div>
        
        <div className="relative text-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 bg-white/80 dark:bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-4 sm:px-6 py-2 sm:py-3 mb-6 sm:mb-8 shadow-lg">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-semibold">🚀 Centenas de análises já realizadas</span>
            <Badge variant="secondary" className="ml-1 sm:ml-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2 py-0.5">
              Novo
            </Badge>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-bold tracking-tight mb-6 sm:mb-8 leading-tight">
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent block sm:inline">
              Análise Fundamentalista
            </span>{" "}
            <span className="text-foreground block sm:inline">de</span>{" "}
            <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent block sm:inline">
              Ações B3 com IA
            </span>
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground mb-8 sm:mb-12 max-w-5xl mx-auto leading-relaxed px-2">
            <strong>Descubra as melhores ações da Bovespa</strong> com análise fundamentalista automatizada e IA. 
            Use modelos consagrados como <strong>Graham, Dividend Yield, Fórmula Mágica</strong> e mais 5 estratégias em <strong>+350 empresas da B3</strong>. Investir em ações nunca foi tão fácil!
          </p>

          {/* Social Proof */}
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 lg:gap-8 mb-8 sm:mb-12 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span>+350 empresas B3</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 flex-shrink-0" />
              <span>8 modelos + Backtest</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 flex-shrink-0" />
              <span>Powered by IA</span>
            </div>
          </div>
          
          {!session && (
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center mb-6 sm:mb-8 px-4">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 shadow-xl hover:shadow-2xl transition-all w-full sm:w-auto" asChild>
                <Link href="/register" className="flex items-center justify-center gap-2 sm:gap-3">
                  <Rocket className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="truncate">Começar análise gratuita</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 border-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 w-full sm:w-auto" asChild>
                <Link href="/ranking">Ver demonstração</Link>
              </Button>
            </div>
          )}

          <p className="text-xs sm:text-sm text-muted-foreground px-4">
            ✅ Grátis para sempre • ✅ Sem cartão de crédito • ✅ Acesso imediato
          </p>
        </div>
      </section>

      {/* Alfa Vitalicio Conditions - Logo após Hero */}
      <AlfaVitalicioConditions />

      {/* Quick Ranker Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gradient-to-b from-white to-gray-50 dark:from-background dark:to-background/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <QuickRanker />
        </div>
      </section>

      {/* Early Adopter CTA - Só aparece quando vagas esgotadas */}
      <AlfaEarlyAdopterCTA />

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

      {/* Problem/Solution Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white dark:bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center mb-12 sm:mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
              Pare de perder dinheiro com{" "}
              <span className="text-red-600">decisões emocionais</span>
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-4xl mx-auto px-2">
              <strong>87% dos investidores pessoa física</strong> perdem dinheiro na bolsa por falta de análise fundamentalista. 
              Nossa plataforma resolve isso com <strong>análise automatizada e IA</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 max-w-6xl mx-auto">
            {/* Problems */}
            <div className="space-y-6 sm:space-y-8">
              <h3 className="text-xl sm:text-2xl font-bold text-red-600 mb-4 sm:mb-6 text-center lg:text-left">❌ Problemas comuns:</h3>
              <div className="space-y-4 sm:space-y-6">
                <div className="group flex items-start gap-3 sm:gap-4 p-4 sm:p-6 bg-red-50 dark:bg-red-950/20 rounded-xl sm:rounded-2xl border border-red-200 dark:border-red-800 hover:shadow-lg hover:border-red-300 dark:hover:border-red-700 transition-all duration-300">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                    <span className="text-red-600 text-lg sm:text-xl font-bold">✗</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-red-900 dark:text-red-100 mb-2 text-base sm:text-lg">Análise manual demorada</h4>
                    <p className="text-sm sm:text-base text-red-700 dark:text-red-200 leading-relaxed">Horas analisando planilhas e relatórios sem garantia de precisão</p>
                  </div>
                </div>
                <div className="group flex items-start gap-3 sm:gap-4 p-4 sm:p-6 bg-red-50 dark:bg-red-950/20 rounded-xl sm:rounded-2xl border border-red-200 dark:border-red-800 hover:shadow-lg hover:border-red-300 dark:hover:border-red-700 transition-all duration-300">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                    <span className="text-red-600 text-lg sm:text-xl font-bold">✗</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-red-900 dark:text-red-100 mb-2 text-base sm:text-lg">Armadilhas de valor</h4>
                    <p className="text-sm sm:text-base text-red-700 dark:text-red-200 leading-relaxed">Cair em &quot;dividend traps&quot; e empresas com indicadores enganosos</p>
                  </div>
                </div>
                <div className="group flex items-start gap-3 sm:gap-4 p-4 sm:p-6 bg-red-50 dark:bg-red-950/20 rounded-xl sm:rounded-2xl border border-red-200 dark:border-red-800 hover:shadow-lg hover:border-red-300 dark:hover:border-red-700 transition-all duration-300">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                    <span className="text-red-600 text-lg sm:text-xl font-bold">✗</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-red-900 dark:text-red-100 mb-2 text-base sm:text-lg">Falta de metodologia</h4>
                    <p className="text-sm sm:text-base text-red-700 dark:text-red-200 leading-relaxed">Investir sem critérios claros e modelos comprovados</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Solutions */}
            <div className="space-y-6 sm:space-y-8">
              <h3 className="text-xl sm:text-2xl font-bold text-green-600 mb-4 sm:mb-6 text-center lg:text-left">✅ Nossa solução:</h3>
              <div className="space-y-4 sm:space-y-6">
                <div className="group flex items-start gap-3 sm:gap-4 p-4 sm:p-6 bg-green-50 dark:bg-green-950/20 rounded-xl sm:rounded-2xl border border-green-200 dark:border-green-800 hover:shadow-lg hover:border-green-300 dark:hover:border-green-700 transition-all duration-300">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-green-900 dark:text-green-100 mb-2 text-base sm:text-lg">Análise em segundos</h4>
                    <p className="text-sm sm:text-base text-green-700 dark:text-green-200 leading-relaxed">Rankings automáticos com 8 modelos de valuation em tempo real</p>
                  </div>
                </div>
                <div className="group flex items-start gap-3 sm:gap-4 p-4 sm:p-6 bg-green-50 dark:bg-green-950/20 rounded-xl sm:rounded-2xl border border-green-200 dark:border-green-800 hover:shadow-lg hover:border-green-300 dark:hover:border-green-700 transition-all duration-300">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-green-900 dark:text-green-100 mb-2 text-base sm:text-lg">Filtros anti-armadilha</h4>
                    <p className="text-sm sm:text-base text-green-700 dark:text-green-200 leading-relaxed">Algoritmos que eliminam empresas problemáticas automaticamente</p>
                  </div>
                </div>
                <div className="group flex items-start gap-3 sm:gap-4 p-4 sm:p-6 bg-green-50 dark:bg-green-950/20 rounded-xl sm:rounded-2xl border border-green-200 dark:border-green-800 hover:shadow-lg hover:border-green-300 dark:hover:border-green-700 transition-all duration-300">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-green-900 dark:text-green-100 mb-2 text-base sm:text-lg">Metodologia comprovada</h4>
                    <p className="text-sm sm:text-base text-green-700 dark:text-green-200 leading-relaxed">Graham, Greenblatt, Gordon e outros mestres do value investing</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
                        <Link href="/backtesting-carteiras" className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 underline transition-colors">
                          Saiba mais sobre Backtesting →
                        </Link>
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
                  Dados históricos de 5+ anos para backtesting confiável
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
    
      {/* Roadmap Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
              Roadmap de{" "}
              <span className="text-blue-600 block sm:inline">evolução contínua</span>
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-4xl mx-auto px-2">
              Nossa plataforma está em <strong>constante evolução</strong>. 
              Veja o que está por vir nos próximos trimestres.
            </p>
          </div>

          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              {/* Concluído */}
              {/* <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/20 dark:to-emerald-900/20 hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-emerald-900 dark:text-emerald-100">✅ Concluído</h3>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">Dez 2025</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span><strong>Backtest de Carteiras</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>Aportes Mensais</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>Métricas Avançadas</span>
                    </div>
                  </div>
                </CardContent>
              </Card> */}

              {/* Q1 2026 */}
              <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-blue-900 dark:text-blue-100">Q1 2026</h3>
                      <p className="text-xs text-blue-700 dark:text-blue-300">Jan - Mar</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span>Inclusão de FIIs</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span>Sistema de Favoritos</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span>Alertas por email/telegram</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Q2 2025 */}
              <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-green-900 dark:text-green-100">Q2 2026</h3>
                      <p className="text-xs text-green-700 dark:text-green-300">Abr - Jun</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-green-600" />
                      <span>Cadastro de Carteiras</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-green-600" />
                      <span>Carteiras com IA</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-green-600" />
                      <span>Marketplace de Carteiras</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Q3 2026 */}
              <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-purple-900 dark:text-purple-100">Q3 2026</h3>
                      <p className="text-xs text-purple-700 dark:text-purple-300">Jul - Set</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-purple-600" />
                      <span>Inclusão de ETFs</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-purple-600" />
                      <span>App Mobile</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-purple-600" />
                      <span>Análise Setorial IA</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Q4 2026+ */}
              <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-orange-900 dark:text-orange-100">Q4 2026+</h3>
                      <p className="text-xs text-orange-700 dark:text-orange-300">Out - Dez</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span>Inclusão de BDRs</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span>API para Desenvolvedores</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span>Expansão Internacional</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="text-center mt-12">
              <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-full px-6 py-3">
                <Lightbulb className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  💡 Tem uma sugestão? Entre em contato conosco!
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

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
            <Button size="lg" variant="outline" className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto" asChild>
              <Link href="/comparador" className="flex items-center justify-center gap-2 sm:gap-3">
                <Calculator className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="truncate">Criar Comparação Personalizada</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white dark:bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 leading-tight">
              Perguntas{" "}
              <span className="text-violet-600">Frequentes</span>
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground px-2">
              Tire suas dúvidas sobre nossa plataforma de análise fundamentalista
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 max-w-6xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                  <Lightbulb className="w-6 h-6 text-yellow-600" />
                  Como funciona a análise fundamentalista?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Nossa plataforma aplica automaticamente os 8 principais modelos de valuation 
                  (Graham, Dividend Yield, Fórmula Mágica, Fundamentalista 3+1, etc.) em todas as empresas da B3, 
                  calculando um preço justo baseado nos fundamentos financeiros.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                  <Shield className="w-6 h-6 text-green-600" />
                  Os dados são confiáveis?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Sim! Utilizamos dados fornecidos pela BRAPI, que consolida informações oficiais 
                  da B3 e demonstrações financeiras auditadas. Nossos algoritmos são baseados em 
                  metodologias consagradas por investidores como Benjamin Graham e Joel Greenblatt.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                  Preciso pagar para usar?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Não! Oferecemos acesso gratuito aos rankings e análises básicas. 
                  Os recursos premium (análise com IA, comparações avançadas) custam 
                  apenas R$ 47,00/mês, sem fidelidade.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                  <Brain className="w-6 h-6 text-purple-600" />
                  Como funciona a análise com IA?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Nossa IA (Google Gemini) analisa demonstrações financeiras, notícias e 
                  contexto macroeconômico para gerar insights qualitativos que complementam 
                  a análise quantitativa tradicional.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                  <Clock className="w-6 h-6 text-orange-600" />
                  Com que frequência os dados são atualizados?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Os preços e indicadores financeiros são atualizados 3 vezes ao dia 
                  (09:00, 13:00 e 20:00). Como trabalhamos com análise fundamentalista 
                  de longo prazo, não precisamos de atualizações em tempo real. Os dados 
                  fundamentalistas são atualizados trimestralmente após a divulgação 
                  dos resultados pelas empresas.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                  <Target className="w-6 h-6 text-red-600" />
                  Posso confiar 100% nas recomendações?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Nossa plataforma é uma ferramenta de apoio à decisão. Sempre faça sua 
                  própria análise e considere seu perfil de risco. Investimentos envolvem 
                  riscos e rentabilidade passada não garante resultados futuros.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

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

      {/* Pricing Section - Só aparece na fase Alfa */}
      <AlfaEarlyAdopterCTA />

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

      {/* Final CTA Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-r from-blue-600 to-violet-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
            Pronto para encontrar as melhores ações da B3?
          </h2>
          <p className="text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 max-w-4xl mx-auto opacity-90 px-2">
            Junte-se a <strong>centenas de investidores</strong> que já descobriram ações subvalorizadas 
            com nossa análise fundamentalista automatizada.
          </p>
          
          {!session && (
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center px-4">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 font-bold shadow-xl w-full sm:w-auto" asChild>
                <Link href="/register" className="flex items-center justify-center gap-2 sm:gap-3">
                  <Rocket className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="truncate">Começar análise gratuita</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="border-2 border-white hover:bg-white hover:text-blue-600 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto" asChild>
                <Link href="/ranking">Ver demonstração</Link>
              </Button>
            </div>
          )}

          <div className="mt-6 sm:mt-8 flex flex-wrap justify-center items-center gap-4 sm:gap-6 lg:gap-8 text-xs sm:text-sm opacity-80 px-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Grátis para sempre</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Sem cartão de crédito</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Acesso imediato</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Cancele quando quiser</span>
            </div>
          </div>
        </div>
      </section>

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
                  "price": "47.00",
                  "priceCurrency": "BRL",
                  "billingIncrement": "P1M",
                  "availability": "https://schema.org/InStock",
                  "description": "Acesso completo a 8 modelos de valuation e análise com IA"
                },
                {
                  "@type": "Offer",
                  "name": "Premium Anual", 
                  "price": "497.00",
                  "priceCurrency": "BRL",
                  "billingIncrement": "P1Y",
                  "availability": "https://schema.org/InStock",
                  "description": "Plano anual com 12% de desconto e recursos exclusivos"
                }
              ],
              "featureList": [
                "Análise fundamentalista automatizada",
                "8 modelos de valuation (Graham, Dividend Yield, Fórmula Mágica, Fundamentalista 3+1, DCF, Gordon, etc.)",
                "Análise preditiva com Inteligência Artificial",
                "Mais de 350 empresas da B3 analisadas",
                "Filtros anti-armadilha",
                "Comparador de ações",
                "Rankings personalizados",
                "Histórico de análises",
                "Backtesting de carteiras"
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
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "Como funciona a análise fundamentalista?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Nossa plataforma aplica automaticamente os 8 principais modelos de valuation (Graham, Dividend Yield, Fórmula Mágica, Fundamentalista 3+1, etc.) em todas as empresas da B3, calculando um preço justo baseado nos fundamentos financeiros."
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
                    "text": "Não! Oferecemos acesso gratuito aos rankings e análises básicas. Os recursos premium (análise com IA, comparações avançadas) custam apenas R$ 47,00/mês, sem fidelidade."
                  }
                }
              ]
            }
          ])
        }}
      />
    </div>
  )
}