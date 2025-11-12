import { Metadata } from "next"
import { Suspense } from "react"
import { DividendYieldCalculator } from "@/components/dividend-yield-calculator"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Calculator,
  TrendingUp,
  DollarSign,
  BarChart3,
  CheckCircle,
  Shield,
  Lock,
  Sparkles,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Calculadora de Dividend Yield Grátis | Projeção de Renda Passiva B3 | Preço Justo AI",
  description:
    "Calcule dividend yield e projeção de renda passiva de ações da B3. Descubra quanto você pode ganhar mensalmente com dividendos. Ferramenta gratuita e sem cadastro.",
  keywords: [
    "calculadora dividend yield",
    "dividend yield grátis",
    "renda passiva ações",
    "projeção dividendos",
    "calculadora dividendos B3",
    "quanto ganho com dividendos",
    "renda mensal ações",
    "ações pagadoras de dividendos",
    "calculadora investimentos",
    "dividend yield calculadora",
  ],
  openGraph: {
    title: "Calculadora de Dividend Yield Grátis | Projeção de Renda Passiva",
    description:
      "Calcule quanto você pode ganhar mensalmente com dividendos de ações da B3. Ferramenta gratuita e sem cadastro.",
    type: "website",
    url: "https://precojusto.ai/calculadoras/dividend-yield",
  },
  twitter: {
    card: "summary_large_image",
    title: "Calculadora de Dividend Yield Grátis",
    description: "Calcule sua renda passiva com dividendos de ações da B3",
  },
  alternates: {
    canonical: "https://precojusto.ai/calculadoras/dividend-yield",
  },
}

export default function DividendYieldCalculatorPage() {
  return (
    <div className="container mx-auto px-4 py-8 lg:py-12">
      {/* Hero Section */}
      <div className="text-center mb-8 lg:mb-12">
        <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full px-4 py-2 mb-4">
          <Calculator className="w-4 h-4" />
          <span className="text-sm font-semibold">Ferramenta Gratuita</span>
        </div>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
          Calculadora de{" "}
          <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            Dividend Yield
          </span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-6">
          Calcule quanto você pode ganhar mensalmente com dividendos de ações da B3. Descubra sua
          projeção de renda passiva de forma rápida e gratuita.
        </p>
      </div>

      {/* Main Calculator */}
      <div className="max-w-4xl mx-auto mb-12">
        <Suspense fallback={<div className="text-center py-8">Carregando calculadora...</div>}>
          <DividendYieldCalculator />
        </Suspense>
      </div>

      {/* Preview do Relatório Completo - DEPOIS da Calculadora */}
      <div className="max-w-6xl mx-auto mb-12">
        <Card className="border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 via-white to-emerald-50/50 dark:from-green-950/20 dark:via-background dark:to-emerald-950/20">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-green-600 text-white rounded-full px-4 py-2 mb-4">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-semibold">Relatório Completo Disponível</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                Veja o que você ganha no{" "}
                <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Relatório Completo
                </span>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Cadastre-se grátis e tenha acesso a análises profissionais que vão além do cálculo básico
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Preview 1: Análise de Sustentabilidade */}
              <Card className="border border-green-200 dark:border-green-800">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-2">Análise de Sustentabilidade</h3>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>Score de sustentabilidade (0-100)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>Análise de ROE, Payout e Margens</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>Alertas de Dividend Trap</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Preview 2: Gráficos Históricos */}
              <Card className="border border-blue-200 dark:border-blue-800">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-2">Gráficos Históricos Completos</h3>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-blue-600" />
                          <span>Evolução dos últimos 5 anos</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-blue-600" />
                          <span>Análise de tendência (crescimento/declínio)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-blue-600" />
                          <span>Consistência dos pagamentos</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Preview 3: Comparação Setorial */}
              <Card className="border border-purple-200 dark:border-purple-800">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-2">Comparação Setorial</h3>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-purple-600" />
                          <span>Dividend Yield vs média do setor</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-purple-600" />
                          <span>Posicionamento competitivo</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-purple-600" />
                          <span>Benchmark de performance</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Exemplo Visual do Relatório */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Preview do Relatório Completo</h3>
                <Badge className="bg-green-600 text-white">
                  <Lock className="w-3 h-3 mr-1" />
                  Requer Cadastro Grátis
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Exemplo de Score de Sustentabilidade */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Score de Sustentabilidade</span>
                    <Badge className="bg-green-600 text-white">85/100</Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ROE:</span>
                      <span className="font-medium text-green-600">15.3%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payout Ratio:</span>
                      <span className="font-medium">45.2%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Margem Líquida:</span>
                      <span className="font-medium text-green-600">12.8%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Liquidez Corrente:</span>
                      <span className="font-medium">1.45</span>
                    </div>
                  </div>
                </div>

                {/* Exemplo de Comparação Setorial */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Comparação Setorial</span>
                    <Badge className="bg-blue-600 text-white">Acima da Média</Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dividend Yield:</span>
                      <span className="font-medium text-green-600">8.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Média do Setor:</span>
                      <span className="font-medium">6.2%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: "75%" }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      +37% acima da média do setor
                    </p>
                  </div>
                </div>
              </div>

              {/* Exemplo de Projeções */}
              <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium mb-3">Projeções Futuras</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Cenário Conservador</p>
                    <p className="text-lg font-bold text-orange-600">R$ 680/mês</p>
                    <p className="text-xs text-muted-foreground">R$ 8.160/ano</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Cenário Otimista</p>
                    <p className="text-lg font-bold text-green-600">R$ 1.020/mês</p>
                    <p className="text-xs text-muted-foreground">R$ 12.240/ano</p>
                  </div>
                </div>
              </div>

              {/* CTA Principal */}
              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  <strong className="text-foreground">Cadastre-se grátis</strong> para acessar o relatório completo
                  com todos esses dados e muito mais!
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Sem cartão de crédito</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Acesso imediato</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Grátis para sempre</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Benefits Section */}
      <div className="max-w-6xl mx-auto mt-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
          Por que usar nossa Calculadora de Dividend Yield?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Calculator className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold mb-2">Cálculo Instantâneo</h3>
                <p className="text-sm text-muted-foreground">
                  Resultados em segundos usando dados atualizados da B3
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">Histórico Completo</h3>
                <p className="text-sm text-muted-foreground">
                  Visualize evolução dos dividendos dos últimos 5 anos
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
                <h3 className="font-semibold mb-2">Projeção Precisa</h3>
                <p className="text-sm text-muted-foreground">
                  Calcule renda mensal e anual baseada em dados reais
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="font-semibold mb-2">Análise Completa</h3>
                <p className="text-sm text-muted-foreground">
                  Relatório detalhado com sustentabilidade e comparação setorial
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* How it Works */}
      <div className="max-w-4xl mx-auto mt-16">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold mb-6 text-center">Como Funciona</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Informe o Ticker</h3>
                  <p className="text-sm text-muted-foreground">
                    Digite o código da ação na B3 (ex: PETR4, VALE3, ITUB4)
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Informe o Valor Investido</h3>
                  <p className="text-sm text-muted-foreground">
                    Digite quanto você pretende investir ou já investiu na ação
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Veja o Resultado</h3>
                  <p className="text-sm text-muted-foreground">
                    Receba instantaneamente o dividend yield, renda mensal e anual projetada
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Acesse Relatório Completo</h3>
                  <p className="text-sm text-muted-foreground">
                    Cadastre-se grátis para ver análise de sustentabilidade, gráficos históricos
                    completos e comparação setorial
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto mt-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
          Perguntas Frequentes
        </h2>
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">O que é Dividend Yield?</h3>
              <p className="text-sm text-muted-foreground">
                Dividend Yield é o percentual que representa o retorno anual em dividendos sobre o
                preço atual da ação. É calculado dividindo o total de dividendos pagos nos últimos
                12 meses pelo preço atual da ação.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Os cálculos são precisos?</h3>
              <p className="text-sm text-muted-foreground">
                Sim! Utilizamos dados oficiais da B3 e histórico completo de dividendos pagos. Os
                cálculos são baseados em dados reais dos últimos 12 meses.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Preciso pagar para usar?</h3>
              <p className="text-sm text-muted-foreground">
                Não! A calculadora básica é totalmente gratuita e não requer cadastro. O relatório
                completo com análise detalhada está disponível após cadastro gratuito.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Calculadora de Dividend Yield",
            description:
              "Calcule dividend yield e projeção de renda passiva de ações da B3 de forma gratuita",
            url: "https://precojusto.ai/calculadoras/dividend-yield",
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "BRL",
            },
            featureList: [
              "Cálculo instantâneo de dividend yield",
              "Projeção de renda mensal e anual",
              "Histórico completo de dividendos",
              "Análise de sustentabilidade",
              "Comparação setorial",
            ],
          }),
        }}
      />
    </div>
  )
}

