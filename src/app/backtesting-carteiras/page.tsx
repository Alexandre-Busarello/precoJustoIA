import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FAQSection } from '@/components/landing/faq-section';
import { 
  TrendingUp, 
  BarChart3, 
  Activity, 
  Target, 
  Calendar,
  DollarSign,
  PieChart,
  Calculator,
  ArrowRight,
  CheckCircle,
  Shield,
  Zap,
  Brain,
  LineChart
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { CTALinkWithPixel } from '@/components/cta-link-with-pixel';

export const metadata: Metadata = {
  title: 'Backtesting de Carteiras de Investimento | Simulação Histórica de Performance | Preço Justo',
  description: 'Faça backtesting profissional de carteiras de investimento com dados históricos reais da B3. Simule aportes mensais, rebalanceamento automático e analise métricas como Sharpe Ratio, drawdown máximo e volatilidade. Teste suas estratégias antes de investir.',
  keywords: 'backtesting carteira investimento, simulação histórica ações, teste performance carteira, sharpe ratio calculadora, drawdown máximo análise, rebalanceamento automático, aportes mensais simulação, análise risco retorno, backtest B3, teste estratégia investimento, simulador carteira ações, performance histórica investimentos',
  openGraph: {
    title: 'Backtesting Profissional de Carteiras | Simule Performance Histórica',
    description: 'Teste o desempenho histórico de carteiras de investimento com dados reais da B3. Aportes mensais, rebalanceamento automático e métricas avançadas de risco.',
    type: 'website',
    url: 'https://precojusto.ai/backtesting-carteiras',
    images: [
      {
        url: '/image-backtest.png',
        width: 1200,
        height: 630,
        alt: 'Interface de Backtesting de Carteiras - Simulação de Performance Histórica'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Backtesting de Carteiras | Simule Performance Histórica',
    description: 'Teste estratégias de investimento com dados históricos reais. Métricas profissionais incluindo Sharpe Ratio e drawdown máximo.',
    images: ['/image-backtest.png']
  },
  alternates: {
    canonical: 'https://precojusto.ai/backtesting-carteiras'
  }
};

export default async function BacktestingCarteirasPage() {
  const session = await getServerSession(authOptions)
  
  const faqs = [
    {
      question: "O que é backtesting de carteiras?",
      answer: "Backtesting é a simulação de uma estratégia de investimento usando dados históricos reais. Você pode testar como sua carteira teria performado no passado, incluindo aportes mensais, rebalanceamento automático e reinvestimento de dividendos.",
      iconName: "LineChart"
    },
    {
      question: "Quais métricas são calculadas no backtesting?",
      answer: "Calculamos métricas profissionais como retorno total, retorno anualizado, Sharpe Ratio, drawdown máximo, volatilidade, beta e análise detalhada por ativo. Todas as métricas são baseadas em dados históricos reais da B3.",
      iconName: "BarChart3"
    },
    {
      question: "Posso simular aportes mensais?",
      answer: "Sim! Você pode configurar aportes mensais fixos ou variáveis, definir frequência de rebalanceamento e simular reinvestimento automático de dividendos. Isso permite testar estratégias realistas de investimento.",
      iconName: "Calendar"
    },
    {
      question: "O backtesting é preciso?",
      answer: "Utilizamos dados históricos reais de preços e dividend yield médio histórico pagos pelas empresas da B3. As simulações não consideram custos de transação e spread e não incluem impostos. Os resultados são uma aproximação precisa do desempenho histórico real.",
      iconName: "Shield"
    },
    {
      question: "Preciso ser Premium para usar?",
      answer: "Sim, o backtesting de carteiras é uma funcionalidade Premium. Isso permite acesso a simulações ilimitadas, métricas avançadas e análise detalhada de performance histórica.",
      iconName: "Crown"
    }
  ]
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-950/10 dark:via-background dark:to-teal-950/10">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25"></div>
        
        <div className="relative container mx-auto px-4">
          <div className="text-center max-w-5xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-full px-6 py-3 mb-8">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">🚀 Funcionalidade Premium Exclusiva</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-8">
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Backtesting
              </span>{" "}
              <span className="text-foreground">de Carteiras</span>{" "}
              <span className="bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent">
                Profissional
              </span>
            </h1>
            
            <p className="text-2xl text-muted-foreground mb-12 max-w-4xl mx-auto leading-relaxed">
              <strong>Simule o desempenho histórico</strong> de carteiras de investimento com dados reais da B3. 
              Teste estratégias com <strong>aportes mensais, rebalanceamento automático</strong> e métricas avançadas de risco.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
              <Button size="lg" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-lg px-8 py-4 shadow-xl hover:shadow-2xl transition-all" asChild>
                <CTALinkWithPixel 
                  href="/register?returnUrl=/backtest"
                  className="flex items-center gap-3"
                >
                  <TrendingUp className="w-5 h-5" />
                  Começar Backtesting Grátis
                  <ArrowRight className="w-5 h-5" />
                </CTALinkWithPixel>
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-4 border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white" asChild>
                <Link href="#como-funciona">Ver Como Funciona</Link>
              </Button>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Dados históricos reais B3</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Métricas profissionais</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Interface intuitiva</span>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="max-w-6xl mx-auto">
            <Card className="border-0 shadow-2xl overflow-hidden bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
              <CardContent className="p-0">
                <div className="relative">
                  <Image
                    src="/image-backtest.png"
                    alt="Interface completa de backtesting de carteiras mostrando métricas de performance, gráfico de evolução e análise por ativo"
                    width={1200}
                    height={800}
                    className="w-full h-auto"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Métricas Destacadas */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Métricas <span className="text-emerald-600">Profissionais</span> de Performance
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Analise o desempenho de suas carteiras com as mesmas métricas usadas por gestores profissionais
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/20 dark:to-emerald-900/20 text-center">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-emerald-800 dark:text-emerald-200">Sharpe Ratio</h3>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  Mede o retorno ajustado ao risco da carteira
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/20 text-center">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-white rotate-180" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-red-800 dark:text-red-200">Drawdown Máximo</h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Maior perda do pico ao vale durante o período
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 text-center">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-blue-800 dark:text-blue-200">Volatilidade</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Desvio padrão dos retornos anualizados
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 text-center">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-purple-800 dark:text-purple-200">Consistência</h3>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  Percentual de meses com retorno positivo
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Results Image */}
          <div className="max-w-5xl mx-auto">
            <Card className="border-0 shadow-xl overflow-hidden">
              <CardContent className="p-0">
                <Image
                  src="/image-backtest-2.png"
                  alt="Análise detalhada de performance por ativo mostrando alocação, valor final, aportes diretos e rebalanceamento"
                  width={1200}
                  height={600}
                  className="w-full h-auto"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section id="como-funciona" className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Como Funciona o <span className="text-emerald-600">Backtesting</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Processo simples e profissional para testar suas estratégias de investimento
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">1</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Configure sua Carteira</h3>
                  <p className="text-muted-foreground">
                    Selecione os ativos, defina as alocações percentuais e configure aportes mensais. 
                    Escolha a frequência de rebalanceamento (mensal, trimestral ou anual).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">2</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Defina o Período</h3>
                  <p className="text-muted-foreground">
                    Escolha as datas de início e fim da simulação. Nosso sistema usa dados históricos 
                    reais da B3 para garantir precisão na análise.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">3</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Execute a Simulação</h3>
                  <p className="text-muted-foreground">
                    Nossa IA processa milhares de pontos de dados históricos, simula aportes mensais, 
                    rebalanceamentos automáticos e calcula métricas profissionais.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">4</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Analise os Resultados</h3>
                  <p className="text-muted-foreground">
                    Visualize gráficos interativos, métricas detalhadas por ativo, histórico de transações 
                    e análise completa de risco vs. retorno.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Card className="border-0 shadow-xl overflow-hidden">
                <CardContent className="p-0">
                  <Image
                    src="/image-backtest-3.png"
                    alt="Performance detalhada por ativo mostrando LUXM4, BRAV3, PRIO3 e CAMB3 com métricas individuais"
                    width={800}
                    height={600}
                    className="w-full h-auto"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Funcionalidades Avançadas */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Funcionalidades <span className="text-emerald-600">Avançadas</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Recursos profissionais para análise completa de performance
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">Aportes Mensais Automáticos</h3>
                <p className="text-muted-foreground text-sm">
                  Simule estratégia de Dollar Cost Averaging (DCA) com aportes regulares mensais 
                  para suavizar volatilidade e otimizar entrada.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <PieChart className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">Rebalanceamento Inteligente</h3>
                <p className="text-muted-foreground text-sm">
                  Mantenha as alocações-alvo automaticamente com rebalanceamento mensal, 
                  trimestral ou anual conforme sua estratégia.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">Simulação de Dividendos</h3>
                <p className="text-muted-foreground text-sm">
                  Inclui simulação realista de dividendos com reinvestimento automático 
                  baseado no yield histórico médio de cada ativo.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <LineChart className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">Gráficos Interativos</h3>
                <p className="text-muted-foreground text-sm">
                  Visualize a evolução da carteira ao longo do tempo com gráficos 
                  profissionais e análise mês a mês detalhada.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Calculator className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">Análise de Risco Completa</h3>
                <p className="text-muted-foreground text-sm">
                  Métricas avançadas incluindo Sharpe Ratio, drawdown máximo, 
                  volatilidade e análise de consistência mensal.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">Performance por Ativo</h3>
                <p className="text-muted-foreground text-sm">
                  Análise individual de cada ativo com breakdown de aportes diretos, 
                  dividendos, rebalanceamento e performance final.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Pronto para Testar suas Estratégias?
          </h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto opacity-90">
            Junte-se a <strong>centenas de investidores</strong> que já descobriram o poder do backtesting 
            profissional para otimizar suas carteiras de investimento.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-8">
            <Button size="lg" className="bg-white text-emerald-600 hover:bg-gray-100 text-lg px-8 py-4 font-bold shadow-xl" asChild>
              <CTALinkWithPixel 
                href="/register?returnUrl=/backtest"
                className="flex items-center gap-3"
              >
                <TrendingUp className="w-5 h-5" />
                Começar Backtesting Agora
                <ArrowRight className="w-5 h-5" />
              </CTALinkWithPixel>
            </Button>
            <Button variant="outline" size="lg" className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-emerald-600 text-lg px-8 py-4" asChild>
              <CTALinkWithPixel href="/planos">Ver Planos Premium</CTALinkWithPixel>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-8 text-sm opacity-80">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Funcionalidade Premium</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Resultados em segundos</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              <span>Powered by IA</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section - Apenas para usuários deslogados */}
      {!session && (
        <FAQSection
          title="Perguntas Frequentes sobre Backtesting"
          description="Tire suas dúvidas sobre simulação histórica de carteiras"
          faqs={faqs}
        />
      )}

      {/* Schema FAQPage para SEO - Apenas para usuários deslogados */}
      {!session && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": faqs.map(faq => ({
                "@type": "Question",
                "name": faq.question,
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": faq.answer
                }
              }))
            })
          }}
        />
      )}

      {/* Schema Markup for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Backtesting de Carteiras de Investimento",
            "description": "Ferramenta profissional de backtesting para simular performance histórica de carteiras de investimento com dados reais da B3. Inclui aportes mensais, rebalanceamento automático e métricas avançadas.",
            "url": "https://precojusto.ai/backtesting-carteiras",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "featureList": [
              "Simulação histórica com dados reais B3",
              "Aportes mensais automáticos (DCA)",
              "Rebalanceamento automático de carteira",
              "Métricas profissionais (Sharpe Ratio, Drawdown)",
              "Análise de risco e volatilidade",
              "Simulação de dividendos com reinvestimento",
              "Gráficos interativos de performance",
              "Análise detalhada por ativo",
              "Histórico completo de transações"
            ],
            "offers": {
              "@type": "Offer",
              "price": "19.90",
              "priceCurrency": "BRL",
              "billingIncrement": "P1M",
              "description": "Acesso completo ao backtesting profissional de carteiras"
            },
            "author": {
              "@type": "Organization",
              "name": "Preço Justo AI"
            },
            "keywords": "backtesting, carteira investimento, simulação histórica, sharpe ratio, drawdown máximo, rebalanceamento automático, aportes mensais, análise risco retorno"
          })
        }}
      />
    </div>
  );
}
