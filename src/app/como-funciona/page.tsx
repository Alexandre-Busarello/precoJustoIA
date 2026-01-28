import { Metadata } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Footer } from "@/components/footer"
import { 
  Brain, 
  Calculator, 
  BarChart3, 
  Shield, 
  Zap,
  ArrowRight,
  CheckCircle,
  DollarSign,
  Activity,
  Building2,
  Users,
  Clock
} from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Como Funciona - Preço Justo AI | Guia Completo da Análise Fundamentalista Automatizada",
  description: "Entenda passo a passo como nossa plataforma aplica modelos de valuation (Graham, Método Barsi, Fórmula Mágica) para encontrar ações subvalorizadas na B3. Tutorial completo.",
  keywords: "como funciona análise fundamentalista, tutorial preço justo ai, modelos valuation, graham dividend yield fórmula mágica, passo a passo análise ações",
}

export default function ComoFuncionaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Calculator className="w-4 h-4" />
              Tutorial Completo
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              Como Funciona a{" "}
              <span className="text-blue-600">Análise Fundamentalista</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Descubra passo a passo como nossa plataforma aplica os principais modelos 
              de valuation para encontrar ações subvalorizadas na B3, de forma 
              automatizada e precisa.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <Badge variant="outline" className="text-green-600 border-green-600 px-4 py-2">
                <CheckCircle className="w-4 h-4 mr-2" />
                7 Modelos de Valuation
              </Badge>
              <Badge variant="outline" className="text-blue-600 border-blue-600 px-4 py-2">
                <Brain className="w-4 h-4 mr-2" />
                IA Integrada
              </Badge>
              <Badge variant="outline" className="text-purple-600 border-purple-600 px-4 py-2">
                <Building2 className="w-4 h-4 mr-2" />
                +500 Empresas
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Processo em 4 Etapas */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Processo em{" "}
              <span className="text-blue-600">4 Etapas</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Como transformamos dados financeiros em insights acionáveis
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {/* Etapa 1 */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 relative">
              <CardContent className="p-8 text-center">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    1
                  </div>
                </div>
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 mt-4">
                  <Activity className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-blue-900 dark:text-blue-100">Coleta de Dados</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Coletamos dados financeiros atualizados de todas as empresas da B3 
                  através da BRAPI, incluindo demonstrações financeiras e preços.
                </p>
              </CardContent>
            </Card>

            {/* Etapa 2 */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 relative">
              <CardContent className="p-8 text-center">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                    2
                  </div>
                </div>
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6 mt-4">
                  <Calculator className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-green-900 dark:text-green-100">Aplicação dos Modelos</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Aplicamos automaticamente 7 modelos de valuation consagrados 
                  (Graham, Método Barsi, Fórmula Mágica, etc.) em cada empresa.
                </p>
              </CardContent>
            </Card>

            {/* Etapa 3 */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 relative">
              <CardContent className="p-8 text-center">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    3
                  </div>
                </div>
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 mt-4">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-purple-900 dark:text-purple-100">Análise com IA</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Nossa IA (Google Gemini) analisa contexto qualitativo, notícias 
                  e tendências para complementar a análise quantitativa.
                </p>
              </CardContent>
            </Card>

            {/* Etapa 4 */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 relative">
              <CardContent className="p-8 text-center">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                    4
                  </div>
                </div>
                <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-6 mt-4">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-orange-900 dark:text-orange-100">Rankings e Insights</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Geramos rankings personalizados e insights acionáveis para 
                  ajudar você a tomar decisões de investimento informadas.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Modelos de Valuation Detalhados */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Modelos de{" "}
              <span className="text-violet-600">Valuation</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Metodologias consagradas aplicadas automaticamente
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Fórmula de Graham */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold">Fórmula de Graham</h3>
                      <Badge className="bg-green-100 text-green-800 border-green-300">Gratuito</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">O método clássico do &quot;pai do value investing&quot;</p>
                  </div>
                </div>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  Identifica ações baratas de empresas sólidas usando os critérios rigorosos 
                  de Benjamin Graham: P/L baixo, P/VPA baixo, baixo endividamento e crescimento consistente.
                </p>
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                  <p className="text-sm font-mono text-blue-800 dark:text-blue-200">
                    Preço Justo = √(22.5 × LPA × VPA)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Dividend Yield */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold">Dividend Yield</h3>
                      <Badge className="bg-blue-100 text-blue-800 border-blue-300">Premium</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Foco em renda passiva sustentável</p>
                  </div>
                </div>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  Encontra empresas com alto dividend yield sustentável, evitando &quot;dividend traps&quot; 
                  através da análise de payout ratio, crescimento de dividendos e saúde financeira.
                </p>
                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                  <p className="text-sm font-mono text-green-800 dark:text-green-200">
                    DY = (Dividendos por Ação / Preço) × 100
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Fórmula Mágica */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold">Fórmula Mágica</h3>
                      <Badge className="bg-blue-100 text-blue-800 border-blue-300">Premium</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Metodologia de Joel Greenblatt</p>
                  </div>
                </div>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  Combina empresas baratas (alto Earnings Yield) com empresas de qualidade 
                  (alto ROIC), criando um ranking que historicamente supera o mercado.
                </p>
                <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg">
                  <p className="text-sm font-mono text-purple-800 dark:text-purple-200">
                    Ranking = Rank(EY) + Rank(ROIC)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Análise com IA */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold">Análise com IA</h3>
                      <Badge className="bg-orange-100 text-orange-800 border-orange-300">IA Premium</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Powered by Google Gemini</p>
                  </div>
                </div>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  Nossa IA analisa demonstrações financeiras, notícias, contexto setorial e 
                  macroeconômico para gerar insights qualitativos que complementam a análise quantitativa.
                </p>
                <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg">
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    Análise qualitativa + contexto + tendências
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Frequência de Atualização */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Dados Sempre{" "}
                <span className="text-blue-600">Atualizados</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                Frequência de atualização otimizada para análise fundamentalista
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="border-0 shadow-lg text-center">
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Clock className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-4">3x por Dia</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Preços e indicadores financeiros atualizados às 09:00, 13:00 e 20:00. 
                    Perfeito para análise fundamentalista de longo prazo.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg text-center">
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <BarChart3 className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-4">Trimestral</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Dados fundamentalistas atualizados após cada divulgação de resultados 
                    trimestrais das empresas.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg text-center">
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Brain className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-4">Sob Demanda</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Análises com IA geradas em tempo real quando solicitadas, 
                    sempre com as informações mais recentes disponíveis.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-12 bg-blue-50 dark:bg-blue-950/20 p-8 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-2 text-blue-900 dark:text-blue-100">
                    Por que não tempo real?
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Como trabalhamos com análise fundamentalista de longo prazo, não precisamos 
                    de atualizações em tempo real. Os fundamentos de uma empresa não mudam 
                    minuto a minuto, e nossa frequência de atualização é mais que suficiente 
                    para identificar oportunidades de investimento sólidas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-violet-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Pronto para Começar?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Experimente nossa análise fundamentalista automatizada e descubra 
            ações subvalorizadas na B3 hoje mesmo.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4" asChild>
              <Link href="/register" className="flex items-center gap-3">
                <Users className="w-5 h-5" />
                Começar Análise Gratuita
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-blue-600 text-lg px-8 py-4" asChild>
              <Link href="/ranking">Ver Demonstração</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
