import { Metadata } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Footer } from "@/components/footer"
import { 
  CheckCircle, 
  Shield, 
  Brain,
  BarChart3,
  TrendingUp,
  Target,
  Search,
  Building2,
  DollarSign,
  LineChart,
  Activity,
  Calendar,
  ArrowRight,
  Zap,
  Users,
  Star,
  AlertCircle
} from "lucide-react"

export const metadata: Metadata = {
  title: "Oferta Especial: Acesso Anual Completo ao Preço Justo AI com 45% OFF",
  description: "Aproveite esta oferta por tempo limitado! Acesso completo a todas as funcionalidades Premium: Análise com IA, Radar de Oportunidades, Relatórios automáticos, Rankings personalizados e muito mais. Garantia de 7 dias.",
  keywords: "oferta preço justo ai, desconto análise ações, plano premium anual, análise fundamentalista com desconto",
  openGraph: {
    title: "Oferta Especial: Acesso Anual Completo ao Preço Justo AI com 45% OFF",
    description: "Aproveite esta oferta por tempo limitado! Acesso completo a todas as funcionalidades Premium.",
    type: "website",
    url: "https://precojusto.ai/oferta",
  },
  robots: {
    index: true,
    follow: true,
  },
}

const KIWIFY_CHECKOUT_URL = "https://pay.kiwify.com.br/kV1DuGv"

export default function OfertaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-violet-50 dark:from-blue-950/20 dark:via-background dark:to-violet-950/20">
      {/* Hero Section - Oferta em Destaque */}
      <section className="relative overflow-hidden pt-8 sm:pt-12 lg:pt-16 pb-12 sm:pb-16 lg:pb-20">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]"></div>
        
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge de Urgência */}
            <div className="inline-flex items-center gap-2 bg-red-500 text-white rounded-full px-4 sm:px-6 py-2 sm:py-3 mb-6 shadow-lg animate-pulse">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base font-bold">OFERTA POR TEMPO LIMITADO</span>
            </div>

            {/* Headline Principal */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              <span className="block mb-2">Acesso Anual Completo ao</span>
              <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                Preço Justo AI
              </span>
              <span className="block mt-2 text-red-600 text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
                45% OFF
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed">
              <strong>Todas as funcionalidades Premium</strong> em um único plano anual. 
              Análise com IA, Radar de Oportunidades, Relatórios automáticos e muito mais.
            </p>

            {/* CTA Principal */}
            <div className="mb-8 sm:mb-10">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white text-lg sm:text-xl px-8 sm:px-12 py-6 sm:py-7 shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 w-full sm:w-auto"
                asChild
              >
                <a 
                  href={KIWIFY_CHECKOUT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3"
                >
                  <span>Garantir Minha Oferta Agora</span>
                  <ArrowRight className="w-5 h-5" />
                </a>
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                ✅ Pagamento seguro • ✅ Acesso imediato • ✅ Garantia de 7 dias
              </p>
            </div>

            {/* Social Proof */}
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 text-sm sm:text-base text-muted-foreground">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <span>+500 empresas B3</span>
              </div>
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-violet-600" />
                <span>Análise com IA</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                <span>Garantia de 7 dias</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefícios Principais */}
      <section className="py-12 sm:py-16 lg:py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-8 sm:mb-12">
              O que você vai receber:
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12">
              {/* Benefício 1 */}
              <Card className="border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Target className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold mb-2">Radar de Oportunidades</h3>
                      <p className="text-muted-foreground text-sm sm:text-base">
                        Receba alertas automáticos quando ações subvalorizadas aparecem no mercado, 
                        baseado em análise fundamentalista avançada.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Benefício 2 */}
              <Card className="border-2 border-violet-200 dark:border-violet-800 hover:border-violet-400 dark:hover:border-violet-600 transition-all">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Brain className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold mb-2">Análise de Sentimento de Mercado</h3>
                      <p className="text-muted-foreground text-sm sm:text-base">
                        Descubra o que está se falando na mídia e internet sobre a empresa e se 
                        a perspectiva é positiva ou negativa.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Benefício 3 */}
              <Card className="border-2 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 transition-all">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <LineChart className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold mb-2">Análise Técnica com IA</h3>
                      <p className="text-muted-foreground text-sm sm:text-base">
                        Inteligência Artificial analisa gráficos e padrões técnicos para identificar 
                        pontos de entrada e saída ideais.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Benefício 4 */}
              <Card className="border-2 border-orange-200 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600 transition-all">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold mb-2">Relatórios Automáticos</h3>
                      <p className="text-muted-foreground text-sm sm:text-base">
                        Relatórios mensais, de variação de preço em grandes quedas e de perda de 
                        fundamento diretamente no seu email.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Benefício 5 */}
              <Card className="border-2 border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600 transition-all">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold mb-2">Rankings Personalizados</h3>
                      <p className="text-muted-foreground text-sm sm:text-base">
                        Crie rankings de empresas usando estratégias da plataforma ou Inteligência 
                        Artificial para encontrar as melhores oportunidades.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Benefício 6 */}
              <Card className="border-2 border-teal-200 dark:border-teal-800 hover:border-teal-400 dark:hover:border-teal-600 transition-all">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Search className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold mb-2">Screening de Ações</h3>
                      <p className="text-muted-foreground text-sm sm:text-base">
                        Crie configurações personalizadas utilizando os indicadores do site para 
                        achar as melhores empresas, ou use a IA para criar a configuração.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Benefício 7 */}
              <Card className="border-2 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold mb-2">Análise Completa da B3</h3>
                      <p className="text-muted-foreground text-sm sm:text-base">
                        Análise de todas as empresas da B3 (Ações e BDRs) com mais de 65 indicadores 
                        fundamentalistas por empresa.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Benefício 8 */}
              <Card className="border-2 border-pink-200 dark:border-pink-800 hover:border-pink-400 dark:hover:border-pink-600 transition-all">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold mb-2">Comparador de Empresas</h3>
                      <p className="text-muted-foreground text-sm sm:text-base">
                        Compare empresas lado a lado e veja qual é a melhor opção de investimento 
                        com análise detalhada de indicadores.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Benefício 9 */}
              <Card className="border-2 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <DollarSign className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold mb-2">Radar de Dividendos</h3>
                      <p className="text-muted-foreground text-sm sm:text-base">
                        Projeções de dividendos feitas por IA para identificar as melhores 
                        oportunidades de renda passiva.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Benefício 10 */}
              <Card className="border-2 border-cyan-200 dark:border-cyan-800 hover:border-cyan-400 dark:hover:border-cyan-600 transition-all">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold mb-2">Análise Setorial da B3</h3>
                      <p className="text-muted-foreground text-sm sm:text-base">
                        Análise completa por setores da B3 para identificar tendências e 
                        oportunidades de investimento.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Benefício 11 */}
              <Card className="border-2 border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600 transition-all">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold mb-2">Calculadora de Renda Passiva</h3>
                      <p className="text-muted-foreground text-sm sm:text-base">
                        Calcule quanto você precisa investir para alcançar seus objetivos de 
                        renda passiva com dividendos.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* CTA Intermediário */}
            <div className="text-center">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white text-lg sm:text-xl px-8 sm:px-12 py-6 sm:py-7 shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 w-full sm:w-auto"
                asChild
              >
                <a 
                  href={KIWIFY_CHECKOUT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3"
                >
                  <span>Quero Aproveitar Esta Oferta</span>
                  <ArrowRight className="w-5 h-5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Depoimento */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-xl">
              <CardContent className="p-6 sm:p-8 lg:p-10">
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex -space-x-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-6 h-6 sm:w-7 sm:h-7 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <blockquote className="text-lg sm:text-xl lg:text-2xl font-medium mb-6 leading-relaxed">
                  &ldquo;A plataforma é excelente! Sempre que tenho dúvida ou quando minha carteira sofre 
                  grandes quedas, uso o site para não entrar em pânico. Ele me dá segurança para não 
                  vender o ativo caso a empresa não tenha perdido seus fundamentos e continue com um bom Score.&rdquo;
                </blockquote>
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-blue-200 dark:border-blue-800">
                    <AvatarImage 
                      src="/deni-ferreira.png" 
                      alt="Deni Ferreira - Usuário Premium"
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-500">
                      <Users className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-bold text-lg">Deni Ferreira</div>
                    <div className="text-sm text-muted-foreground">Usuário Premium</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Garantia */}
      <section className="py-12 sm:py-16 lg:py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-full mb-6 shadow-lg">
              <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">
              Garantia de 7 Dias
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
              Experimente sem risco. Se você não ficar satisfeito com a plataforma, devolvemos 
              100% do seu dinheiro em até 7 dias após a compra. Sem perguntas, sem complicações.
            </p>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-8 sm:mb-10">
              <div className="flex items-center gap-2 text-sm sm:text-base">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>Reembolso total</span>
              </div>
              <div className="flex items-center gap-2 text-sm sm:text-base">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>Sem perguntas</span>
              </div>
              <div className="flex items-center gap-2 text-sm sm:text-base">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>Processo simples</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gradient-to-br from-blue-600 to-violet-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
              Não perca esta oportunidade única!
            </h2>
            <p className="text-lg sm:text-xl mb-8 sm:mb-10 opacity-90 max-w-2xl mx-auto">
              Esta oferta é por tempo limitado. Garanta seu acesso anual completo com 45% de desconto 
              e comece a investir de forma mais inteligente hoje mesmo.
            </p>
            <Button 
              size="lg" 
              className="bg-white text-blue-600 hover:bg-gray-100 text-lg sm:text-xl px-8 sm:px-12 py-6 sm:py-7 shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 w-full sm:w-auto font-bold"
              asChild
            >
              <a 
                href={KIWIFY_CHECKOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3"
              >
                <span>Garantir Minha Oferta Agora</span>
                <ArrowRight className="w-5 h-5" />
              </a>
            </Button>
            <p className="text-sm sm:text-base mt-6 opacity-80">
              ✅ Pagamento 100% seguro • ✅ Acesso imediato após pagamento • ✅ Garantia de 7 dias
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  )
}

