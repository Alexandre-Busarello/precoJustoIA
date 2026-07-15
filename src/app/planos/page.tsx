import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { 
  Shield, 
  Zap, 
  Trophy,
  CheckCircle,
  Brain,
  ArrowRight,
  BarChart3,
  DollarSign,
  Sparkles,
  Target,
  Clock,
  Star,
  Rocket,
  HelpCircle,
  Mail,
  Headphones
} from "lucide-react"
import Link from "next/link"
import { Metadata } from "next"
import { LandingPricingSection } from "@/components/landing-pricing-section"
import { LandingHero } from "@/components/landing/landing-hero"
import { CTASection } from "@/components/landing/cta-section"
import { FAQSection } from "@/components/landing/faq-section"
import {
  FALLBACK_MONTHLY_PRICE_FORMATTED,
  FALLBACK_ANNUAL_PRICE_FORMATTED,
  FALLBACK_MONTHLY_PRICE_DECIMAL,
  FALLBACK_ANNUAL_PRICE_DECIMAL,
} from "@/lib/price-utils"

export const metadata: Metadata = {
  title: `Planos e Preços | Análise Fundamentalista Gratuita + Premium ${FALLBACK_MONTHLY_PRICE_FORMATTED}/mês - Preço Justo AI`,
  description: `💰 Planos de análise fundamentalista: GRATUITO com Fórmula de Graham + PREMIUM ${FALLBACK_MONTHLY_PRICE_FORMATTED}/mês com 8 modelos (Dividend Yield, Fórmula Mágica, IA). Compare funcionalidades, economize 12% no plano anual. Investir em ações da B3 nunca foi tão acessível!`,
  keywords: "planos análise fundamentalista, preço análise ações, análise fundamentalista gratuita, plano premium investimentos, quanto custa análise ações, assinatura análise fundamentalista, preço justo ações custo, análise bovespa preço, investir ações barato, planos investimentos B3",
  openGraph: {
    title: "Planos e Preços - Preço Justo AI",
    description: `Plano gratuito com Graham + Premium com 8 modelos e IA por ${FALLBACK_MONTHLY_PRICE_FORMATTED}/mês. Análise fundamentalista completa para ações da B3.`,
    type: "website",
    url: "https://precojusto.ai/planos",
    siteName: "Preço Justo AI",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Planos e Preços - Preço Justo AI",
    description: `Plano gratuito com Graham + Premium com 8 modelos e IA por ${FALLBACK_MONTHLY_PRICE_FORMATTED}/mês.`,
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
    canonical: "https://precojusto.ai/planos",
  },
}

export default function PlanosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background/80">
      {/* Hero Section - Usando componente reutilizável */}
      <LandingHero
        headline={
          <>
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Escolha seu plano ideal
            </span>
          </>
        }
        subheadline={
          <>
            Do <strong>gratuito para sempre</strong> ao <strong>premium com IA</strong>. 
            Encontre o plano perfeito para sua jornada de investimentos na B3.
          </>
        }
        badge={{
          text: "💰 Planos flexíveis para todos os perfis",
          iconName: "Sparkles"
        }}
        socialProof={[
          { iconName: "CheckCircle", text: "PIX ou Cartão" },
          { iconName: "Zap", text: "Ativação instantânea" },
          { iconName: "Shield", text: "Cancele quando quiser" }
        ]}
        primaryCTA={{
          text: "Ver Planos",
          href: "#planos",
          iconName: "Rocket"
        }}
        showQuickAccess={false}
      />

      {/* Pricing Cards */}
      <section id="planos" className="py-20">
        <div className="container mx-auto px-4">
          <LandingPricingSection />
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Compare todos os{" "}
              <span className="text-blue-600">recursos</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Veja em detalhes o que cada plano oferece para sua análise fundamentalista
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-white dark:bg-background rounded-2xl shadow-xl overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900">
                    <th className="text-left p-6 font-bold">Recursos</th>
                    <th className="text-center p-6 font-bold text-blue-600">Gratuito</th>
                    <th className="text-center p-6 font-bold text-violet-600">Premium Mensal</th>
                    <th className="text-center p-6 font-bold text-green-600">Premium Anual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  <tr>
                    <td className="p-6 font-medium">Fórmula de Graham</td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                  </tr>
                  <tr className="bg-gray-25 dark:bg-gray-950/50">
                    <td className="p-6 font-medium">Empresas analisadas</td>
                    <td className="p-6 text-center text-sm">350+</td>
                    <td className="p-6 text-center text-sm">350+</td>
                    <td className="p-6 text-center text-sm">350+</td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium">Rankings básicos</td>
                    <td className="p-6 text-center text-sm">Até 10 empresas</td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                  </tr>
                  <tr className="bg-gray-25 dark:bg-gray-950/50">
                    <td className="p-6 font-medium">Anti-Dividend Trap</td>
                    <td className="p-6 text-center">❌</td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium">Fórmula Mágica (Greenblatt)</td>
                    <td className="p-6 text-center">❌</td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                  </tr>
                  <tr className="bg-gray-25 dark:bg-gray-950/50">
                    <td className="p-6 font-medium">Fundamentalista 3+1</td>
                    <td className="p-6 text-center">❌</td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium">Fluxo de Caixa Descontado</td>
                    <td className="p-6 text-center">❌</td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                  </tr>
                  <tr className="bg-gray-25 dark:bg-gray-950/50">
                    <td className="p-6 font-medium">Fórmula de Gordon</td>
                    <td className="p-6 text-center">❌</td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium">🤖 Análise Preditiva com IA</td>
                    <td className="p-6 text-center">❌</td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                  </tr>
                  <tr className="bg-gray-25 dark:bg-gray-950/50">
                    <td className="p-6 font-medium">Comparador de ações</td>
                    <td className="p-6 text-center text-sm">Básico</td>
                    <td className="p-6 text-center text-sm">Ilimitado (até 6)</td>
                    <td className="p-6 text-center text-sm">Ilimitado (até 6)</td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium">Rankings personalizáveis</td>
                    <td className="p-6 text-center">❌</td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                  </tr>
                  <tr className="bg-gray-25 dark:bg-gray-950/50">
                    <td className="p-6 font-medium">Dados históricos</td>
                    <td className="p-6 text-center text-sm">Limitado</td>
                    <td className="p-6 text-center text-sm">5+ anos</td>
                    <td className="p-6 text-center text-sm">5+ anos</td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium">Central de Suporte</td>
                    <td className="p-6 text-center text-sm">Padrão</td>
                    <td className="p-6 text-center text-sm">
                      <div className="flex items-center justify-center gap-1">
                        <Headphones className="w-4 h-4 text-blue-600" />
                        <span>Premium</span>
                      </div>
                    </td>
                    <td className="p-6 text-center text-sm">
                      <div className="flex items-center justify-center gap-1">
                        <Headphones className="w-4 h-4 text-green-600" />
                        <span>Premium</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="bg-gray-25 dark:bg-gray-950/50">
                    <td className="p-6 font-medium">Acesso antecipado</td>
                    <td className="p-6 text-center">❌</td>
                    <td className="p-6 text-center">❌</td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium">Relatórios personalizados</td>
                    <td className="p-6 text-center">❌</td>
                    <td className="p-6 text-center">❌</td>
                    <td className="p-6 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Por que escolher o{" "}
              <span className="text-violet-600">Premium?</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Uma única decisão ruim pode custar mais que anos de Premium
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-6 text-center">
                💡 <strong>Comparação de Custos vs Benefícios</strong>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600 mb-2">-R$ 5.000</div>
                  <p className="text-muted-foreground">Perda média em uma &ldquo;dividend trap&rdquo;</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600 mb-2">-R$ 10.000</div>
                  <p className="text-muted-foreground">Perda média em empresa problemática</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">+R$ 497</div>
                  <p className="text-muted-foreground">Custo do Premium Anual</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Brain className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">IA Única no Mercado</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Somos os únicos no Brasil com análise preditiva real usando Google Gemini. 
                        A IA analisa TODOS os 7 modelos simultaneamente e busca notícias na internet.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Shield className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">Filtros Anti-Armadilha</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Nossos algoritmos eliminam automaticamente &ldquo;dividend traps&rdquo; e empresas 
                        problemáticas, protegendo você de perdas desnecessárias.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">8 Modelos Integrados</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Graham, Método Barsi, Fórmula Mágica, Fundamentalista 3+1, FCD, Gordon, 
                        Low P/E e IA. Todos em uma única plataforma.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Target className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">Comparador Inteligente</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        4.814 comparações pré-calculadas por setor e indústria. 
                        Compare até 6 empresas simultaneamente com análise setorial.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section - Usando componente reutilizável */}
      <FAQSection
        title="Perguntas Frequentes sobre Planos"
        description="Tire suas dúvidas sobre nossos planos e funcionalidades"
        faqs={[
          {
            question: "Posso cancelar a qualquer momento?",
            answer: "Sim! Não há fidelidade. Você pode cancelar sua assinatura a qualquer momento e continuar usando até o final do período pago. Sem taxas de cancelamento.",
            iconName: "HelpCircle"
          },
          {
            question: "Quais formas de pagamento aceitam?",
            answer: "Aceitamos PIX (instantâneo e sem taxas) e cartão de crédito/débito. O PIX é nossa forma recomendada por ser 100% brasileiro e ativar na hora.",
            iconName: "DollarSign"
          },
          {
            question: "Como funciona a análise com IA?",
            answer: "Nossa IA (Google Gemini) analisa demonstrações financeiras, busca notícias na internet e contexto macroeconômico para gerar insights qualitativos que complementam a análise quantitativa tradicional.",
            iconName: "Brain"
          },
          {
            question: "Os dados são confiáveis?",
            answer: "Sim! Utilizamos dados da BRAPI, que consolida informações oficiais da B3 e demonstrações financeiras auditadas. Nossos algoritmos são baseados em metodologias consagradas por grandes investidores.",
            iconName: "Shield"
          },
          {
            question: "Com que frequência os dados são atualizados?",
            answer: "Preços e indicadores são atualizados 3x ao dia. Dados fundamentalistas são atualizados trimestralmente após divulgação dos resultados. Perfeito para análise de longo prazo.",
            iconName: "Clock"
          },
          {
            question: "Qual a diferença entre os planos Premium?",
            answer: "O Premium Anual oferece 20% de desconto, acesso antecipado a novos recursos, Relatórios mensais personalizados por IA e suporte VIP. Ideal para investidores sérios.",
            iconName: "Star"
          }
        ]}
      />

      {/* Contact CTA */}
      <div className="text-center py-12 bg-white dark:bg-background">
        <p className="text-muted-foreground mb-6">
          Não encontrou a resposta que procurava?
        </p>
        <Button size="lg" variant="outline" asChild>
          <Link href="/contato" className="flex items-center gap-3">
            <Mail className="w-5 h-5" />
            Entre em Contato Conosco
            <ArrowRight className="w-5 h-5" />
          </Link>
        </Button>
      </div>

      {/* Final CTA - Usando componente reutilizável */}
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
          iconName: "Rocket"
        }}
        secondaryCTA={{
          text: "Ver demonstração",
          href: "/ranking"
        }}
        variant="gradient"
        benefits={[
          "Grátis para sempre",
          "Sem cartão de crédito",
          "Ativação instantânea",
          "Cancele quando quiser"
        ]}
      />

      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Preço Justo AI - Análise Fundamentalista Premium",
            "description": `Plataforma completa de análise fundamentalista com IA para ações da B3. Plano gratuito com Graham + Premium com 8 modelos por ${FALLBACK_MONTHLY_PRICE_FORMATTED}/mês.`,
            "brand": {
              "@type": "Brand",
              "name": "Preço Justo AI"
            },
            "offers": [
              {
                "@type": "Offer",
                "name": "Plano Gratuito",
                "price": "0",
                "priceCurrency": "BRL",
                "description": "Fórmula de Graham + análise de 350+ empresas da B3",
                "availability": "https://schema.org/InStock"
              },
              {
                "@type": "Offer",
                "name": "Premium Mensal",
                "price": FALLBACK_MONTHLY_PRICE_DECIMAL,
                "priceCurrency": "BRL",
                "billingIncrement": "P1M",
                "description": "8 modelos de valuation + análise com IA",
                "availability": "https://schema.org/InStock"
              },
              {
                "@type": "Offer",
                "name": "Premium Anual",
                "price": FALLBACK_ANNUAL_PRICE_DECIMAL,
                "priceCurrency": "BRL",
                "billingIncrement": "P1Y",
                "description": "Plano anual com 20% de desconto + recursos exclusivos",
                "availability": "https://schema.org/InStock"
              }
            ],
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "ratingCount": "1250",
              "bestRating": "5"
            }
          })
        }}
      />

      <Footer />
    </div>
  )
}
