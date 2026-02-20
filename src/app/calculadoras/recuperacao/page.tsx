import { Metadata } from "next"
import { Suspense } from "react"
import { RecoveryCalculatorClient } from "../../../components/recovery-calculator-client"
import { Card, CardContent } from "@/components/ui/card"
import { Calculator, TrendingDown, Target, DollarSign } from "lucide-react"

const BASE_URL = "https://precojusto.ai"
const PAGE_URL = `${BASE_URL}/calculadoras/recuperacao`

export const metadata: Metadata = {
  title: "Calculadora de Recuperação Grátis | Aporte Ideal para Recuperar Prejuízo em Ações | Preço Justo AI",
  description:
    "Calculadora de recuperação gratuita e sem cadastro. Descubra quantas ações comprar para recuperar prejuízo ou sair com lucro. Calcule o aporte ideal para preço médio em ações da B3.",
  keywords: [
    "calculadora recuperação",
    "calculadora recuperação ações",
    "aporte para recuperar prejuízo",
    "preço médio ações",
    "recuperar prejuízo ações",
    "quanto aportar para recuperar",
    "break even ações",
    "calculadora preço médio",
    "aporte ideal ações",
    "recuperar prejuízo bolsa",
    "calculadora investimentos grátis",
  ],
  openGraph: {
    title: "Calculadora de Recuperação Grátis | Aporte Ideal para Recuperar Prejuízo | Preço Justo AI",
    description:
      "Calcule o aporte ideal para recuperar prejuízo ou lucrar em ações. Ferramenta gratuita e sem cadastro.",
    type: "website",
    url: PAGE_URL,
    siteName: "Preço Justo AI",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Calculadora de Recuperação Grátis | Preço Justo AI",
    description: "Calcule o aporte ideal para recuperar prejuízo ou sair com lucro em ações.",
  },
  alternates: {
    canonical: PAGE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
}

export default function RecoveryCalculatorPage() {
  return (
    <div className="container mx-auto px-4 py-8 lg:py-12">
      <div className="text-center mb-8 lg:mb-12">
        <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full px-4 py-2 mb-4">
          <Calculator className="w-4 h-4" />
          <span className="text-sm font-semibold">Ferramenta Gratuita</span>
        </div>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
          Calculadora de{" "}
          <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Recuperação
          </span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-6">
          Descubra quanto aportar para recuperar seu prejuízo ou sair com lucro.
          Desmistifique a matemática da perda e planeje sua estratégia.
        </p>
      </div>

      <div className="max-w-2xl mx-auto mb-12">
        <Suspense
          fallback={
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  Carregando calculadora...
                </div>
              </CardContent>
            </Card>
          }
        >
          <RecoveryCalculatorClient />
        </Suspense>
      </div>

      <div className="max-w-4xl mx-auto mt-16">
        <h2 className="text-2xl font-bold text-center mb-8">
          Como funciona a Calculadora de Recuperação?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                  <TrendingDown className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold mb-2">1. Informe seus dados</h3>
                <p className="text-sm text-muted-foreground">
                  Preço médio, quantidade e preço atual da ação em queda
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                  <Target className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">2. Defina a estratégia</h3>
                <p className="text-sm text-muted-foreground">
                  Quanto o ativo pode subir e com quanto de lucro quer sair
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">3. Veja o plano</h3>
                <p className="text-sm text-muted-foreground">
                  Quantas ações comprar e quanto investir para atingir sua meta
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* FAQ Section - SEO e Rich Snippets */}
      <div className="max-w-4xl mx-auto mt-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
          Perguntas Frequentes
        </h2>
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">O que é a Calculadora de Recuperação?</h3>
              <p className="text-sm text-muted-foreground">
                É uma ferramenta que calcula quantas ações você precisa comprar para recuperar seu prejuízo
                ou sair com lucro, considerando uma alta esperada do ativo. Desmistifica a matemática da
                perda (ex: caiu 50%, precisa subir 100% para empatar).
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Como funciona o cálculo do aporte ideal?</h3>
              <p className="text-sm text-muted-foreground">
                Você informa preço médio, quantidade atual e preço de mercado. Define quanto o ativo pode
                subir e com quanto de lucro quer sair. A calculadora mostra quantas ações comprar e quanto
                investir para atingir sua meta.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">A calculadora é gratuita?</h3>
              <p className="text-sm text-muted-foreground">
                Sim! A calculadora é gratuita e não requer cadastro para os primeiros usos. Você pode
                usar de forma anônima ou criar uma conta para mais usos mensais.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Structured Data - WebApplication */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Calculadora de Recuperação",
            description:
              "Calcule o aporte ideal para recuperar prejuízo ou lucrar em ações. Descubra quantas ações comprar para empatar ou sair com lucro.",
            url: PAGE_URL,
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "BRL",
            },
            featureList: [
              "Cálculo de aporte para recuperar prejuízo",
              "Simulação de lucro alvo (0%, 5%, 10%)",
              "Preço médio projetado",
              "Investimento necessário em reais",
              "Ferramenta gratuita e sem cadastro",
            ],
          }),
        }}
      />

      {/* Structured Data - HowTo para Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "Como usar a Calculadora de Recuperação",
            description: "Aprenda a calcular o aporte ideal para recuperar prejuízo em ações",
            step: [
              {
                "@type": "HowToStep",
                name: "Informe seus dados",
                text: "Preço médio, quantidade e preço atual da ação em queda",
              },
              {
                "@type": "HowToStep",
                name: "Defina a estratégia",
                text: "Quanto o ativo pode subir e com quanto de lucro quer sair",
              },
              {
                "@type": "HowToStep",
                name: "Veja o plano",
                text: "Quantas ações comprar e quanto investir para atingir sua meta",
              },
            ],
          }),
        }}
      />

      {/* Structured Data - FAQPage para Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "O que é a Calculadora de Recuperação?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "É uma ferramenta que calcula quantas ações você precisa comprar para recuperar seu prejuízo ou sair com lucro, considerando uma alta esperada do ativo. Desmistifica a matemática da perda (ex: caiu 50%, precisa subir 100% para empatar).",
                },
              },
              {
                "@type": "Question",
                name: "Como funciona o cálculo do aporte ideal?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Você informa preço médio, quantidade atual e preço de mercado. Define quanto o ativo pode subir e com quanto de lucro quer sair. A calculadora mostra quantas ações comprar e quanto investir para atingir sua meta.",
                },
              },
              {
                "@type": "Question",
                name: "A calculadora é gratuita?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Sim! A calculadora é gratuita e não requer cadastro para os primeiros usos. Você pode usar de forma anônima ou criar uma conta para mais usos mensais.",
                },
              },
            ],
          }),
        }}
      />
    </div>
  )
}
