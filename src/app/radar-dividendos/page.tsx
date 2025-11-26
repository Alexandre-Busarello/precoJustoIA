import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DividendRadarPageContent } from '@/components/dividend-radar-page-content'
import { Footer } from '@/components/footer'
import { LandingHero } from '@/components/landing/landing-hero'
import { CTASection } from '@/components/landing/cta-section'
import { FAQSection } from '@/components/landing/faq-section'
import { FeatureCard } from '@/components/landing/feature-card'
import { Breadcrumbs } from '@/components/landing/breadcrumbs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  DollarSign, 
  TrendingUp, 
  CheckCircle,
  Shield
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Radar de Dividendos Gratuito | Ganhar Dinheiro com Dividendos | Empresas Pagando Altos Dividendos',
  description: 'Descubra como ganhar dinheiro com dividendos! Encontre empresas pagando altos dividendos na B3. Radar gratuito com projeções de dividendos dos próximos 12 meses usando inteligência artificial. Calendário completo de proventos e ações pagadoras.',
  keywords: [
    'ganhar dinheiro dividendos',
    'empresas pagando altos dividendos',
    'radar de dividendos',
    'projeção de dividendos',
    'dividendos ações',
    'calendário de dividendos',
    'proventos ações',
    'dividend yield',
    'investimentos',
    'ações pagadoras',
    'como ganhar dinheiro com dividendos',
    'melhores ações para dividendos',
    'ações com maior dividend yield',
    'renda passiva dividendos',
    'investir em dividendos',
  ],
  openGraph: {
    title: 'Radar de Dividendos Gratuito | Ganhar Dinheiro com Dividendos',
    description: 'Encontre empresas pagando altos dividendos na B3. Projeções inteligentes dos próximos 12 meses usando IA. Ferramenta 100% gratuita.',
    type: 'website',
    url: '/radar-dividendos',
  },
  alternates: {
    canonical: '/radar-dividendos',
  },
  robots: {
    index: true,
    follow: true,
  }
}

export default async function RadarDividendosPage() {
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50 dark:from-background dark:via-background dark:to-background">
      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 pt-6">
        <Breadcrumbs items={[
          { label: "Ferramentas", href: "/ranking" },
          { label: "Radar de Dividendos" }
        ]} />
      </div>

      {/* Landing Page para usuários não logados */}
      {!isLoggedIn && (
        <>
          {/* Hero Section */}
          <LandingHero
            headline={
              <>
                Ganhe Dinheiro com{" "}
                <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Dividendos
                </span>{" "}
                na B3
              </>
            }
            subheadline={
              <>
                Encontre empresas pagando <strong>altos dividendos</strong> na B3 com nosso radar inteligente. 
                <strong> Projeções com IA</strong> dos próximos 12 meses e <strong>calendário completo</strong> de proventos. 
                Descubra como construir <strong>renda passiva</strong> com ações pagadoras.
              </>
            }
            badge={{
              text: "Ferramenta 100% Gratuita",
              iconName: "Sparkles"
            }}
            socialProof={[
              { iconName: "DollarSign", text: "Projeções IA dos próximos 12 meses" },
              { iconName: "Calendar", text: "Calendário completo de proventos" },
              { iconName: "TrendingUp", text: "Renda passiva sustentável" }
            ]}
            primaryCTA={{
              text: "Ver Radar de Dividendos",
              href: "#radar-tool",
              iconName: "Rocket"
            }}
            secondaryCTA={{
              text: "Como Funciona",
              href: "#como-funciona"
            }}
            showQuickAccess={true}
          />

          {/* Value Proposition */}
          <section className="py-16 sm:py-20 bg-white dark:bg-background">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Por que usar o{" "}
                  <span className="text-green-600">Radar de Dividendos?</span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                  Construa renda passiva sustentável identificando empresas que pagam dividendos consistentes e evitando dividend traps.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                <FeatureCard
                  iconName="Brain"
                  title="Projeções com IA"
                  description="Nossa inteligência artificial analisa histórico de proventos e projeta dividendos dos próximos 12 meses com precisão."
                  iconBgClass="bg-gradient-to-br from-green-500 to-green-600"
                />
                <FeatureCard
                  iconName="Calendar"
                  title="Calendário Completo"
                  description="Veja todas as datas de ex-dividendos e pagamentos em um calendário visual. Planeje seus investimentos com antecedência."
                  iconBgClass="bg-gradient-to-br from-blue-500 to-blue-600"
                />
                <FeatureCard
                  iconName="Shield"
                  title="Evite Dividend Traps"
                  description="Identifique empresas com dividendos sustentáveis, evitando aquelas que podem cortar pagamentos no futuro."
                  iconBgClass="bg-gradient-to-br from-purple-500 to-purple-600"
                />
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section id="como-funciona" className="py-16 sm:py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Como{" "}
                  <span className="text-green-600">Funciona</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-white">1</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">IA Analisa Histórico</h3>
                  <p className="text-muted-foreground">
                    Nossa IA analisa o histórico completo de proventos de cada empresa listada na B3.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-white">2</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Projeções Inteligentes</h3>
                  <p className="text-muted-foreground">
                    Baseado em padrões históricos, a IA projeta dividendos dos próximos 12 meses.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-white">3</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Planeje Investimentos</h3>
                  <p className="text-muted-foreground">
                    Use o calendário visual para planejar quando comprar ações e receber proventos.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Benefits */}
          <section className="py-16 sm:py-20 bg-white dark:bg-background">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Benefícios da{" "}
                  <span className="text-green-600">Renda Passiva</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <Card className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <DollarSign className="w-8 h-8 text-green-600" />
                      <h3 className="text-xl font-bold">Renda Recorrente</h3>
                    </div>
                    <p className="text-muted-foreground">
                      Receba dividendos mensais ou trimestrais de empresas sólidas, criando uma fonte de renda passiva.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <TrendingUp className="w-8 h-8 text-blue-600" />
                      <h3 className="text-xl font-bold">Crescimento Sustentável</h3>
                    </div>
                    <p className="text-muted-foreground">
                      Empresas que pagam dividendos consistentes geralmente têm fundamentos sólidos e crescimento sustentável.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Shield className="w-8 h-8 text-purple-600" />
                      <h3 className="text-xl font-bold">Proteção Contra Inflação</h3>
                    </div>
                    <p className="text-muted-foreground">
                      Dividendos tendem a crescer com o tempo, oferecendo proteção natural contra a inflação.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <CheckCircle className="w-8 h-8 text-orange-600" />
                      <h3 className="text-xl font-bold">Diversificação</h3>
                    </div>
                    <p className="text-muted-foreground">
                      Construa uma carteira diversificada de ações pagadoras de dividendos de diferentes setores.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Radar Tool */}
      <div id="radar-tool">
        <DividendRadarPageContent isLoggedIn={isLoggedIn} />
      </div>

      {/* FAQ Section - Apenas para SEO (usuários não logados) */}
      {!isLoggedIn && (
        <FAQSection
          title="Perguntas Frequentes sobre Dividendos"
          description="Tire suas dúvidas sobre como ganhar dinheiro com dividendos"
          faqs={[
            {
              question: "Como funciona a projeção de dividendos com IA?",
              answer: "Nossa IA analisa o histórico completo de proventos de cada empresa, identificando padrões e tendências. Baseado nessa análise, projetamos os dividendos dos próximos 12 meses com maior precisão do que métodos tradicionais.",
              iconName: "Brain"
            },
            {
              question: "O radar de dividendos é gratuito?",
              answer: "Sim! O radar básico é 100% gratuito. Você pode ver projeções de dividendos, calendário de proventos e informações básicas sem precisar criar conta. Usuários Premium têm acesso a recursos avançados.",
              iconName: "DollarSign"
            },
            {
              question: "Como evitar dividend traps?",
              answer: "Dividend traps são empresas com dividend yield alto mas insustentável. Nosso radar identifica empresas com payout ratio alto, dívida excessiva ou margens em queda, ajudando você a evitar essas armadilhas.",
              iconName: "Shield"
            },
            {
              question: "Com que frequência os dados são atualizados?",
              answer: "Nossos dados são atualizados regularmente com base nos anúncios de proventos das empresas. Trabalhamos para garantir que você sempre tenha acesso às informações mais recentes sobre dividendos.",
              iconName: "Calendar"
            },
            {
              question: "Posso usar o calendário para planejar investimentos?",
              answer: "Sim! O calendário mostra todas as datas de ex-dividendos e pagamentos. Você pode planejar quando comprar ações para receber o próximo dividendo e organizar sua estratégia de renda passiva.",
              iconName: "TrendingUp"
            },
            {
              question: "Quais empresas pagam mais dividendos?",
              answer: "Empresas de setores como financeiro, energia e utilities tradicionalmente pagam dividendos mais altos. Use nosso radar para encontrar as empresas com maior dividend yield e histórico consistente.",
              iconName: "CheckCircle"
            }
          ]}
        />
      )}

      {/* Final CTA */}
      {!isLoggedIn && (
        <CTASection
          title="Pronto para Construir Renda Passiva com Dividendos?"
          description="Use nosso radar gratuito e descubra empresas pagando altos dividendos na B3 com projeções inteligentes."
          primaryCTA={{
            text: "Ver Radar de Dividendos",
            href: "#radar-tool",
            iconName: "Rocket"
          }}
          secondaryCTA={{
            text: "Ver Rankings de Ações",
            href: "/ranking"
          }}
          variant="gradient"
          benefits={[
            "100% Gratuito",
            "Projeções com IA",
            "Calendário completo",
            "Sem cadastro necessário"
          ]}
        />
      )}

      {!isLoggedIn && <Footer />}
    </div>
  )
}

