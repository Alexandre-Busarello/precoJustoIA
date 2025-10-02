import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { QuickRanker } from "@/components/quick-ranker"
import { Footer } from "@/components/footer"
import { 
  Shield, 
  Zap, 
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
import { blogPosts } from "@/lib/blog-data"
import { AlfaBanner } from "@/components/alfa-banner"
import { AlfaEarlyAdopterCTA } from "@/components/alfa-early-adopter-cta"
import { LandingPricingSection } from "@/components/landing-pricing-section"
import { AlfaVitalicioConditions } from "@/components/alfa-vitalicio-conditions"

export const metadata: Metadata = {
  title: "Análise Fundamentalista de Ações B3 com IA | Preço Justo AI - Investimentos Bovespa",
  description: "🚀 Análise fundamentalista automatizada de ações da B3/Bovespa com IA. Fórmula de Graham, Dividend Yield, Fórmula Mágica + 8 modelos de valuation. Rankings gratuitos, comparador de ações e preço justo. +350 empresas analisadas. Comece grátis!",
  keywords: "análise fundamentalista ações, ações B3, bovespa investimentos, valuation ações, como investir em ações, melhores ações B3, análise de ações grátis, preço justo ações, dividend yield, fórmula mágica greenblatt, benjamin graham, ranking ações, comparador ações bovespa, investir bolsa valores, ações subvalorizadas, análise técnica fundamentalista",
  openGraph: {
    title: "Análise Fundamentalista de Ações B3 com IA | Preço Justo AI",
    description: "🚀 Análise fundamentalista automatizada de ações da B3/Bovespa com IA. Fórmula de Graham, Dividend Yield, Fórmula Mágica + 8 modelos de valuation. +350 empresas analisadas. Comece grátis!",
    type: "website",
    url: "https://precojusto.ai",
    siteName: "Preço Justo AI",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Análise Fundamentalista de Ações B3 com IA | Preço Justo AI",
    description: "🚀 Análise fundamentalista automatizada de ações da B3/Bovespa com IA. Fórmula de Graham, Dividend Yield + 8 modelos. Comece grátis!",
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
}

export default async function Home() {
  const session = await getServerSession(authOptions)
  
  // Pegar os 3 posts mais recentes para exibir na homepage
  const recentPosts = blogPosts
    .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
    .slice(0, 3)

  return (
    <div>
      <AlfaBanner variant="landing" />
      {/* Hero Section - Enhanced */}
      <section className="relative overflow-hidden w-full bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-blue-950/20 dark:via-background dark:to-violet-950/20 pt-32 sm:pt-40 pb-20 sm:pb-32">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]"></div>
        
        <div className="relative text-center max-w-6xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 bg-white/80 dark:bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-6 py-3 mb-8 shadow-lg">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-semibold">🚀 Centenas de análises já realizadas</span>
            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Novo
            </Badge>
          </div>
          
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tight mb-8">
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Análise Fundamentalista
            </span>{" "}
            <span className="text-foreground">de</span>{" "}
            <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
              Ações B3 com IA
            </span>
          </h1>
          
          <p className="text-2xl text-muted-foreground mb-12 max-w-4xl mx-auto leading-relaxed">
            <strong>Descubra as melhores ações da Bovespa</strong> com análise fundamentalista automatizada e IA. 
            Use modelos consagrados como <strong>Graham, Dividend Yield, Fórmula Mágica</strong> e mais 5 estratégias em <strong>+350 empresas da B3</strong>. Investir em ações nunca foi tão fácil!
          </p>

          {/* Social Proof */}
          <div className="flex flex-wrap justify-center items-center gap-8 mb-12 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>+350 empresas B3</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span>8 modelos + Backtest</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              <span>Powered by IA</span>
            </div>
          </div>
          
          {!session && (
            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-8">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-lg px-8 py-4 shadow-xl hover:shadow-2xl transition-all" asChild>
                <Link href="/register" className="flex items-center gap-3">
                  <Rocket className="w-5 h-5" />
                  Começar análise gratuita
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-4 border-2 from-blue-600" asChild>
                <Link href="/ranking">Ver demonstração</Link>
              </Button>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            ✅ Grátis para sempre • ✅ Sem cartão de crédito • ✅ Acesso imediato
          </p>
        </div>
      </section>

      {/* Alfa Vitalicio Conditions - Logo após Hero */}
      <AlfaVitalicioConditions />

      {/* Quick Ranker Section */}
      <section className="py-20 bg-gradient-to-b from-white to-gray-50 dark:from-background dark:to-background/80">
        <div className="container mx-auto px-4">
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
      <section className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Pare de perder dinheiro com{" "}
              <span className="text-red-600">decisões emocionais</span>
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              <strong>87% dos investidores pessoa física</strong> perdem dinheiro na bolsa por falta de análise fundamentalista. 
              Nossa plataforma resolve isso com <strong>análise automatizada e IA</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Problems */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-red-600 mb-6">❌ Problemas comuns:</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="w-6 h-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-red-600 text-sm">✗</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-900 dark:text-red-100">Análise manual demorada</h4>
                    <p className="text-sm text-red-700 dark:text-red-200">Horas analisando planilhas e relatórios sem garantia de precisão</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="w-6 h-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-red-600 text-sm">✗</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-900 dark:text-red-100">Armadilhas de valor</h4>
                    <p className="text-sm text-red-700 dark:text-red-200">Cair em &quot;dividend traps&quot; e empresas com indicadores enganosos</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="w-6 h-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-red-600 text-sm">✗</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-900 dark:text-red-100">Falta de metodologia</h4>
                    <p className="text-sm text-red-700 dark:text-red-200">Investir sem critérios claros e modelos comprovados</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Solutions */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-green-600 mb-6">✅ Nossa solução:</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-900 dark:text-green-100">Análise em segundos</h4>
                    <p className="text-sm text-green-700 dark:text-green-200">Rankings automáticos com 8 modelos de valuation em tempo real</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-900 dark:text-green-100">Filtros anti-armadilha</h4>
                    <p className="text-sm text-green-700 dark:text-green-200">Algoritmos que eliminam empresas problemáticas automaticamente</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-900 dark:text-green-100">Metodologia comprovada</h4>
                    <p className="text-sm text-green-700 dark:text-green-200">Graham, Greenblatt, Gordon e outros mestres do value investing</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Enhanced */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-blue-600">8 modelos + Backtest</span>{" "}
              em uma única plataforma
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Desde <strong>Benjamin Graham</strong> até <strong>Inteligência Artificial</strong> e <strong>Backtesting de Carteiras</strong>. 
              Todos os métodos que os grandes investidores usam, agora automatizados para você.
            </p>
            <div className="mt-8">
              <Button size="lg" variant="outline" className="text-lg px-8 py-4" asChild>
                <Link href="/metodologia" className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5" />
                  Ver Metodologia Completa
                  <ArrowRight className="w-5 h-5" />
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
                
                <CardContent className="p-6 xl:p-8 2xl:p-10 relative z-10">
                  <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-6 xl:gap-8 items-center">
                    <div className="lg:col-span-1 flex justify-center lg:justify-start">
                      <div className="relative">
                        <div className="w-20 h-20 xl:w-24 xl:h-24 2xl:w-28 2xl:h-28 bg-gradient-to-br from-violet-500 to-pink-500 rounded-2xl xl:rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-xl group-hover:shadow-2xl">
                          <Brain className="w-10 h-10 xl:w-12 xl:h-12 2xl:w-14 2xl:h-14 text-white" />
                        </div>
                        {/* Glow Effect */}
                        <div className="absolute inset-0 w-20 h-20 xl:w-24 xl:h-24 2xl:w-28 2xl:h-28 bg-gradient-to-br from-violet-400 to-pink-400 rounded-2xl xl:rounded-3xl opacity-0 group-hover:opacity-30 blur-xl transition-all duration-500 -z-10"></div>
                      </div>
                    </div>
                    <div className="lg:col-span-3 xl:col-span-4 text-center lg:text-left">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8 mb-12">
            {/* Graham */}
            <Link href="/metodologia#graham" className="block">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden cursor-pointer">
                <div className="absolute top-4 right-4">
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Gratuito
                  </Badge>
                </div>
                <CardContent className="p-6 xl:p-8">
                  <div className="w-14 h-14 xl:w-16 xl:h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 xl:mb-6 group-hover:scale-110 transition-transform">
                    <Target className="w-7 h-7 xl:w-8 xl:h-8 text-white" />
                  </div>
                  <h3 className="text-lg xl:text-xl font-bold mb-2 xl:mb-3 group-hover:text-blue-600 transition-colors">Fórmula de Graham</h3>
                  <p className="text-muted-foreground mb-3 xl:mb-4 text-xs xl:text-sm leading-relaxed">
                    O método clássico do &quot;pai do value investing&quot;. Encontra ações baratas de empresas sólidas 
                    usando a fórmula: √(22.5 × LPA × VPA)
                  </p>
                  <div className="text-xs xl:text-sm text-blue-600 font-medium group-hover:text-blue-700 flex items-center gap-1">
                    Ver metodologia completa
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Dividend Yield */}
            <Link href="/metodologia#dividend-yield" className="block">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden cursor-pointer">
                <div className="absolute top-4 right-4">
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                    Premium
                  </Badge>
                </div>
                <CardContent className="p-6 xl:p-8">
                  <div className="w-14 h-14 xl:w-16 xl:h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-4 xl:mb-6 group-hover:scale-110 transition-transform">
                    <DollarSign className="w-7 h-7 xl:w-8 xl:h-8 text-white" />
                  </div>
                  <h3 className="text-lg xl:text-xl font-bold mb-2 xl:mb-3 group-hover:text-green-600 transition-colors">Anti-Dividend Trap</h3>
                  <p className="text-muted-foreground mb-3 xl:mb-4 text-xs xl:text-sm leading-relaxed">
                    Renda passiva sustentável evitando &quot;dividend traps&quot;. Filtra empresas com 
                    dividendos altos mas em declínio financeiro.
                  </p>
                  <div className="text-xs xl:text-sm text-green-600 font-medium group-hover:text-green-700 flex items-center gap-1">
                    Ver metodologia completa
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Magic Formula */}
            <Link href="/metodologia#formula-magica" className="block">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden cursor-pointer">
                <div className="absolute top-4 right-4">
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                    Premium
                  </Badge>
                </div>
                <CardContent className="p-6 xl:p-8">
                  <div className="w-14 h-14 xl:w-16 xl:h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 xl:mb-6 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-7 h-7 xl:w-8 xl:h-8 text-white" />
                  </div>
                  <h3 className="text-lg xl:text-xl font-bold mb-2 xl:mb-3 group-hover:text-purple-600 transition-colors">Fórmula Mágica</h3>
                  <p className="text-muted-foreground mb-3 xl:mb-4 text-xs xl:text-sm leading-relaxed">
                    Estratégia de Joel Greenblatt que combina alta qualidade operacional (ROIC) 
                    com preços atrativos (Earnings Yield).
                  </p>
                  <div className="text-xs xl:text-sm text-purple-600 font-medium group-hover:text-purple-700 flex items-center gap-1">
                    Ver metodologia completa
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Fundamentalista 3+1 */}
            <Link href="/metodologia#fundamentalista" className="block">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden cursor-pointer">
                <div className="absolute top-4 right-4">
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                    Premium
                  </Badge>
                </div>
                <CardContent className="p-6 xl:p-8">
                  <div className="w-14 h-14 xl:w-16 xl:h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center mb-4 xl:mb-6 group-hover:scale-110 transition-transform">
                    <BarChart3 className="w-7 h-7 xl:w-8 xl:h-8 text-white" />
                  </div>
                  <h3 className="text-lg xl:text-xl font-bold mb-2 xl:mb-3 group-hover:text-teal-600 transition-colors">Fundamentalista 3+1</h3>
                  <p className="text-muted-foreground mb-3 xl:mb-4 text-xs xl:text-sm leading-relaxed">
                    Análise simplificada com apenas 3 indicadores essenciais que se adaptam ao perfil da empresa 
                    (com/sem dívida, setor especial) + bônus dividendos.
                  </p>
                  <div className="text-xs xl:text-sm text-teal-600 font-medium group-hover:text-teal-700 flex items-center gap-1">
                    Ver metodologia completa
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* DCF */}
            <Link href="/metodologia#fcd" className="block">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden cursor-pointer">
                <div className="absolute top-4 right-4">
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                    Premium
                  </Badge>
                </div>
                <CardContent className="p-6 xl:p-8">
                  <div className="w-14 h-14 xl:w-16 xl:h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 xl:mb-6 group-hover:scale-110 transition-transform">
                    <Calculator className="w-7 h-7 xl:w-8 xl:h-8 text-white" />
                  </div>
                  <h3 className="text-lg xl:text-xl font-bold mb-2 xl:mb-3 group-hover:text-orange-600 transition-colors">Fluxo de Caixa Descontado</h3>
                  <p className="text-muted-foreground mb-3 xl:mb-4 text-xs xl:text-sm leading-relaxed">
                    Método sofisticado usado por analistas profissionais. Projeta fluxos de caixa 
                    futuros e calcula o valor intrínseco da empresa.
                  </p>
                  <div className="text-xs xl:text-sm text-orange-600 font-medium group-hover:text-orange-700 flex items-center gap-1">
                    Ver metodologia completa
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Gordon */}
            <Link href="/metodologia#gordon" className="block">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden cursor-pointer">
                <div className="absolute top-4 right-4">
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                    Premium
                  </Badge>
                </div>
                <CardContent className="p-6 xl:p-8">
                  <div className="w-14 h-14 xl:w-16 xl:h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center mb-4 xl:mb-6 group-hover:scale-110 transition-transform">
                    <PieChart className="w-7 h-7 xl:w-8 xl:h-8 text-white" />
                  </div>
                  <h3 className="text-lg xl:text-xl font-bold mb-2 xl:mb-3 group-hover:text-teal-600 transition-colors">Fórmula de Gordon</h3>
                  <p className="text-muted-foreground mb-3 xl:mb-4 text-xs xl:text-sm leading-relaxed">
                    Especializado em empresas pagadoras de dividendos. Avalia o crescimento 
                    sustentável dos pagamentos ao longo do tempo.
                  </p>
                  <div className="text-xs xl:text-sm text-teal-600 font-medium group-hover:text-teal-700 flex items-center gap-1">
                    Ver metodologia completa
                    <ArrowRight className="w-3 h-3" />
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
                
                <CardContent className="p-6 xl:p-8 2xl:p-10 relative z-10">
                  <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-6 xl:gap-8 items-center">
                    <div className="lg:col-span-1 flex justify-center lg:justify-start">
                      <div className="relative">
                        <div className="w-20 h-20 xl:w-24 xl:h-24 2xl:w-28 2xl:h-28 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl xl:rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-xl group-hover:shadow-2xl">
                          <TrendingUp className="w-10 h-10 xl:w-12 xl:h-12 2xl:w-14 2xl:h-14 text-white" />
                        </div>
                        {/* Glow Effect */}
                        <div className="absolute inset-0 w-20 h-20 xl:w-24 xl:h-24 2xl:w-28 2xl:h-28 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-2xl xl:rounded-3xl opacity-0 group-hover:opacity-30 blur-xl transition-all duration-500 -z-10"></div>
                      </div>
                    </div>
                    <div className="lg:col-span-3 xl:col-span-4 text-center lg:text-left">
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
                    priority
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <LineChart className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">Comparador Inteligente</h3>
                <p className="text-muted-foreground text-sm">
                  Compare ações lado a lado com sistema de pontuação ponderada
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">Histórico Completo</h3>
                <p className="text-muted-foreground text-sm">
                  Dados históricos de 5+ anos para backtesting confiável
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">Rankings Salvos</h3>
                <p className="text-muted-foreground text-sm">
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
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Roadmap de{" "}
              <span className="text-blue-600">evolução contínua</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Nossa plataforma está em <strong>constante evolução</strong>. 
              Veja o que está por vir nos próximos trimestres.
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
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
                      <span>Carteiras Recomendadas IA</span>
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
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Compare as melhores ações de cada{" "}
              <span className="text-blue-600">setor</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Veja lado a lado os indicadores fundamentalistas das empresas líderes 
              de cada setor da B3. Descubra oportunidades de investimento.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
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

          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-6">
              Ou crie sua própria comparação personalizada
            </p>
            <Button size="lg" variant="outline" className="text-lg px-8 py-4 text-sm" asChild>
              <Link href="/comparador" className="flex items-center gap-3">
                <Calculator className="w-5 h-5" />
                Criar Comparação Personalizada
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Perguntas{" "}
              <span className="text-violet-600">Frequentes</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Tire suas dúvidas sobre nossa plataforma de análise fundamentalista
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
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
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Conheça o{" "}
                <span className="text-blue-600">Fundador</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Especialista em tecnologia e análise fundamentalista, com experiência 
                em grandes plataformas educacionais e mercado financeiro.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
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
      <section className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Aprenda{" "}
              <span className="text-blue-600">Análise Fundamentalista</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Artigos completos sobre estratégias de investimento, modelos de valuation 
              e como usar nossa plataforma para encontrar as melhores oportunidades na B3.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
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

          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-6">
              Mais de {blogPosts.length} artigos completos sobre análise fundamentalista
            </p>
            <Button size="lg" variant="outline" className="text-lg px-8 py-4" asChild>
              <Link href="/blog" className="flex items-center gap-3">
                <BookOpen className="w-5 h-5" />
                Ver Todos os Artigos
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-violet-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Pronto para encontrar as melhores ações da B3?
          </h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto opacity-90">
            Junte-se a <strong>centenas de investidores</strong> que já descobriram ações subvalorizadas 
            com nossa análise fundamentalista automatizada.
          </p>
          
          {!session && (
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4 font-bold shadow-xl" asChild>
                <Link href="/register" className="flex items-center gap-3">
                  <Rocket className="w-5 h-5" />
                  Começar análise gratuita
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="border-2 border-white hover:bg-white hover:text-blue-600 text-lg px-8 py-4" asChild>
                <Link href="/ranking">Ver demonstração</Link>
              </Button>
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-center items-center gap-8 text-sm opacity-80">
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
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Preço Justo AI",
            "description": "Plataforma de análise fundamentalista de ações com inteligência artificial. Encontre ações subvalorizadas na B3 usando modelos de valuation consagrados.",
            "url": "https://precojusto.ai",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "offers": [
              {
                "@type": "Offer",
                "name": "Plano Gratuito",
                "price": "0",
                "priceCurrency": "BRL",
                "description": "Acesso à Fórmula de Graham e análise de 350+ empresas da B3"
              },
              {
                "@type": "Offer", 
                "name": "Premium Mensal",
                "price": "47.00",
                "priceCurrency": "BRL",
                "billingIncrement": "P1M",
                "description": "Acesso completo a 8 modelos de valuation e análise com IA"
              },
              {
                "@type": "Offer",
                "name": "Premium Anual", 
                "price": "497.00",
                "priceCurrency": "BRL",
                "billingIncrement": "P1Y",
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
              "Histórico de análises"
            ],
            "author": {
              "@type": "Organization",
              "name": "Preço Justo AI"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "ratingCount": "1250",
              "bestRating": "5"
            }
          })
        }}
      />
    </div>
  )
}