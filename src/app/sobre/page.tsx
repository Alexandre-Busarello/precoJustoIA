import { Metadata } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
// Badge import removido pois não é usado
import { 
  Brain, 
  Target, 
  Users, 
  TrendingUp, 
  Shield, 
  Lightbulb,
  ArrowRight,
  CheckCircle,
  Building2
} from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Sobre Nós - Preço Justo AI | Nossa Missão na Análise Fundamentalista",
  description: "Conheça a história do Preço Justo AI, nossa missão de democratizar a análise fundamentalista de ações e como ajudamos investidores a tomar decisões mais inteligentes na B3.",
  keywords: "sobre preço justo ai, análise fundamentalista, história empresa, missão visão valores, democratização investimentos, B3, bolsa valores",
}

export default function SobrePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Building2 className="w-4 h-4" />
              Nossa História
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              Democratizando a{" "}
              <span className="text-blue-600">Análise Fundamentalista</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              O Preço Justo AI nasceu da necessidade de tornar a análise fundamentalista 
              acessível a todos os investidores, combinando metodologias consagradas com 
              tecnologia moderna e inteligência artificial.
            </p>
          </div>
        </div>
      </section>

      {/* Nossa Missão */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-blue-900 dark:text-blue-100">Missão</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Democratizar o acesso à análise fundamentalista de qualidade, 
                  permitindo que qualquer investidor tome decisões baseadas em 
                  dados sólidos e metodologias comprovadas.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lightbulb className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-green-900 dark:text-green-100">Visão</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Ser a principal plataforma de análise fundamentalista do Brasil, 
                  reconhecida pela precisão, transparência e facilidade de uso 
                  de nossas ferramentas de investimento.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-purple-900 dark:text-purple-100">Valores</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Transparência, educação financeira, inovação tecnológica e 
                  compromisso com o sucesso de longo prazo de nossos usuários 
                  no mercado de ações.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Nossa História */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Como Tudo{" "}
                <span className="text-blue-600">Começou</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                A jornada para criar a ferramenta de análise fundamentalista que sempre quisemos usar
              </p>
            </div>

            <div className="space-y-12">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-8">
                  <div className="flex items-start gap-6">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Lightbulb className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">O Problema</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Como investidores pessoa física, enfrentávamos a dificuldade de aplicar 
                        metodologias de análise fundamentalista de forma consistente e eficiente. 
                        As ferramentas disponíveis eram caras, complexas ou não ofereciam a 
                        profundidade necessária para decisões de investimento sólidas.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-8">
                  <div className="flex items-start gap-6">
                    <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Brain className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">A Solução</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Decidimos criar uma plataforma que combinasse os melhores modelos de 
                        valuation (Graham, Método Barsi, Fórmula Mágica) com tecnologia 
                        moderna e inteligência artificial. O objetivo era tornar a análise 
                        fundamentalista acessível, precisa e fácil de usar.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-8">
                  <div className="flex items-start gap-6">
                    <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">O Futuro</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Continuamos evoluindo nossa plataforma com novos recursos como análise 
                        de FIIs, carteiras criadas com IA, backtesting e muito mais. 
                        Nosso compromisso é sempre oferecer as melhores ferramentas para 
                        investidores de longo prazo.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Nossos Princípios */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Nossos{" "}
              <span className="text-violet-600">Princípios</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Os valores que guiam cada decisão em nossa plataforma
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-2">Transparência Total</h3>
                <p className="text-muted-foreground">
                  Explicamos claramente nossas metodologias, fontes de dados e limitações. 
                  Sem caixas pretas ou promessas irreais.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-2">Educação Financeira</h3>
                <p className="text-muted-foreground">
                  Não apenas fornecemos dados, mas educamos nossos usuários sobre 
                  análise fundamentalista e investimentos de longo prazo.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-2">Acessibilidade</h3>
                <p className="text-muted-foreground">
                  Mantemos recursos essenciais gratuitos e preços justos para recursos 
                  premium, democratizando o acesso à análise de qualidade.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-2">Inovação Responsável</h3>
                <p className="text-muted-foreground">
                  Utilizamos tecnologia de ponta (IA, automação) sempre priorizando 
                  a precisão e confiabilidade dos resultados.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-violet-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Faça Parte da Nossa Jornada
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Junte-se a centenas de investidores que já descobriram o poder da 
            análise fundamentalista automatizada.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4" asChild>
              <Link href="/register" className="flex items-center gap-3">
                <Users className="w-5 h-5" />
                Começar Agora - Grátis
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
