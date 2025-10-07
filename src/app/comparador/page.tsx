import { Metadata } from 'next'
import { EnhancedStockComparisonSelector } from '@/components/enhanced-stock-comparison-selector'
import { SEOSectionWrapper } from '@/components/seo-section-wrapper'
import { ComparadorHero } from '@/components/comparador-hero'
import { Footer } from '@/components/footer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  ArrowRight,
  Lightbulb,
  Zap,
  Users,
  Shield,
  LineChart,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Percent,
  Activity,
  Building2,
  Landmark,
  ShoppingCart,
  Cpu,
  Sparkles,
  Crown
} from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Comparador de Ações B3 Gratuito | Compare Ações da Bovespa com IA - Preço Justo',
  description: '🎯 Compare até 6 ações da B3 lado a lado! Análise fundamentalista com P/L, ROE, Dividend Yield e +25 indicadores. Versão gratuita disponível. Premium com CAGR, margem líquida, ROIC e médias históricas.',
  keywords: 'comparador ações B3, comparar ações bovespa grátis, análise comparativa ações, qual ação investir, P/L ROE dividend yield, comparação fundamentalista, melhores ações bovespa, ferramenta comparar investimentos, comparar empresas B3, análise lado a lado ações',
  openGraph: {
    title: 'Comparador de Ações B3 | Análise Fundamentalista Gratuita',
    description: 'Compare múltiplas ações da B3 com análise fundamentalista completa por IA. Descubra qual ação oferece melhor potencial de retorno.',
    type: 'website',
    url: '/comparador',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Comparador de Ações B3 | Preço Justo AI',
    description: 'Compare até 6 ações da Bovespa com análise fundamentalista completa e gratuita.',
  },
  alternates: {
    canonical: '/comparador',
  },
  robots: {
    index: true,
    follow: true,
  }
}

// Comparações populares com mais detalhes
const popularComparisons = [
  {
    id: 'commodities',
    title: 'Gigantes das Commodities',
    description: 'Vale (mineração) vs Petrobras (petróleo) - duas das maiores empresas brasileiras',
    tickers: ['VALE3', 'PETR4'],
    sector: 'Commodities',
    icon: Activity,
    color: 'orange'
  },
  {
    id: 'banks',
    title: 'Big Banks Brasil',
    description: 'Os três maiores bancos privados do país em lucratividade e tamanho',
    tickers: ['ITUB4', 'BBDC4', 'SANB11'],
    sector: 'Financeiro',
    icon: Landmark,
    color: 'blue'
  },
  {
    id: 'retail',
    title: 'Varejo e E-commerce',
    description: 'Magazine Luiza, Americanas e Lojas Renner - diferentes estratégias de varejo',
    tickers: ['MGLU3', 'AMER3', 'LREN3'],
    sector: 'Consumo Cíclico',
    icon: ShoppingCart,
    color: 'purple'
  },
  {
    id: 'energy',
    title: 'Setor Elétrico',
    description: 'Eletrobras, Cemig e outras gigantes da energia limpa no Brasil',
    tickers: ['ELET3', 'ELET6', 'CMIG4'],
    sector: 'Energia',
    icon: Zap,
    color: 'yellow'
  },
  {
    id: 'telecom',
    title: 'Telecomunicações',
    description: 'Vivo, Tim e Oi - conectividade e 5G no Brasil',
    tickers: ['VIVT3', 'TIMS3', 'OIBR3'],
    sector: 'Comunicações',
    icon: Users,
    color: 'red'
  },
  {
    id: 'steel',
    title: 'Siderurgia Nacional',
    description: 'Usiminas, CSN e Gerdau - aço e metal para construção',
    tickers: ['USIM5', 'CSNA3', 'GGBR4'],
    sector: 'Materiais Básicos',
    icon: Building2,
    color: 'indigo'
  },
  {
    id: 'tech',
    title: 'Tecnologia Brasil',
    description: 'Locaweb, Totvs e outras empresas de tecnologia e software',
    tickers: ['LWSA3', 'TOTS3', 'POSI3'],
    sector: 'Tecnologia',
    icon: Cpu,
    color: 'green'
  }
]

// Indicadores explicados
const indicators = [
  {
    name: 'P/L (Preço sobre Lucro)',
    icon: DollarSign,
    description: 'Indica quantos anos levaria para recuperar o investimento baseado no lucro atual',
    interpretation: 'Valores baixos podem indicar subvalorização',
    isPremium: false
  },
  {
    name: 'ROE (Return on Equity)',
    icon: Percent,
    description: 'Rentabilidade do patrimônio líquido - quanto a empresa gera de lucro com o capital próprio',
    interpretation: 'Acima de 15% é considerado bom',
    isPremium: false
  },
  {
    name: 'Dividend Yield',
    icon: TrendingUp,
    description: 'Percentual de dividendos pagos em relação ao preço da ação',
    interpretation: 'Importante para investidores de renda passiva',
    isPremium: false
  },
  {
    name: 'Margem Líquida',
    icon: Target,
    description: 'Percentual de lucro em relação à receita total da empresa',
    interpretation: 'Maiores margens indicam mais eficiência',
    isPremium: true
  },
  {
    name: 'ROIC (Retorno sobre Capital)',
    icon: Shield,
    description: 'Eficiência no uso do capital investido pela empresa',
    interpretation: 'Acima de 10% indica boa alocação de capital',
    isPremium: true
  },
  {
    name: 'CAGR Lucros/Receitas',
    icon: LineChart,
    description: 'Taxa composta de crescimento de lucros e receitas ao longo de 5 anos',
    interpretation: 'Crescimento consistente acima de 10% é excelente',
    isPremium: true
  }
]

// FAQs com schema markup
const faqs = [
  {
    question: 'Como funciona o comparador de ações?',
    answer: 'Nosso comparador permite que você selecione de 2 a 6 ações da B3 e visualize todos os indicadores fundamentalistas lado a lado. A ferramenta analisa automaticamente mais de 25 métricas financeiras, incluindo P/L, ROE, Dividend Yield, margem líquida, endividamento e crescimento. Assim você pode tomar decisões de investimento mais informadas comparando empresas diretamente.'
  },
  {
    question: 'Quais indicadores são comparados?',
    answer: 'Comparamos indicadores de valuation (P/L, P/VP, EV/EBITDA), rentabilidade (ROE, ROA, margem líquida, margem bruta), endividamento (dívida líquida, dívida/EBITDA), crescimento (receita, lucro), dividendos (dividend yield, payout) e liquidez (liquidez corrente). São mais de 25 métricas para análise completa.'
  },
  {
    question: 'Posso comparar ações de setores diferentes?',
    answer: 'Sim, você pode comparar ações de qualquer setor. No entanto, a comparação é mais relevante entre empresas do mesmo setor, pois compartilham características operacionais e financeiras similares. Por exemplo, comparar bancos com bancos ou varejistas com varejistas fornece insights mais acionáveis.'
  },
  {
    question: 'Os dados são atualizados?',
    answer: 'Sim! Nossos dados são atualizados regularmente com base nas informações mais recentes da B3 e dos balanços financeiros das empresas. Trabalhamos para garantir que você sempre tenha acesso aos números mais atuais para sua análise.'
  },
  {
    question: 'O comparador é gratuito?',
    answer: 'Sim! Você pode usar o comparador gratuitamente para comparar até 6 ações com indicadores fundamentais como P/L, P/VP, ROE, Dividend Yield, valor de mercado e receita. Usuários Premium têm acesso a indicadores avançados como margem líquida, ROIC, CAGR de lucros/receitas, rankings com medalhas e médias históricas de 7 anos para análise mais profunda.'
  },
  {
    question: 'Como escolher quais ações comparar?',
    answer: 'Recomendamos começar comparando empresas do mesmo setor que você está considerando investir. Por exemplo, se você quer investir em bancos, compare ITUB4, BBDC4 e SANB11. Se está interessado em energia, compare ELET3, CMIG4 e outras do setor. Isso ajuda a identificar qual empresa está com melhor relação risco-retorno dentro do segmento.'
  }
]

export default function ComparadorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background">
      {/* Hero Section - Compacto para Premium */}
      <ComparadorHero />

      {/* Main Content */}
      <div className="container mx-auto max-w-7xl px-4 py-12">
        {/* Comparator Tool */}
        <div className="mb-16">
          <EnhancedStockComparisonSelector />
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <Card className="border-2 hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:shadow-xl">
            <CardHeader>
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-xl">Comparação Instantânea</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Compare até 6 ações simultaneamente com indicadores financeiros atualizados e análise fundamentalista completa em segundos.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-green-300 dark:hover:border-green-700 transition-all hover:shadow-xl">
            <CardHeader>
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4">
                <Target className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-xl">+25 Indicadores</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-3">
                Análise profunda com P/L, ROE, Dividend Yield e outros indicadores. Plano Premium inclui CAGR, margem líquida, ROIC e médias históricas.
              </p>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">Básico Grátis</Badge>
                <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">Premium</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-purple-300 dark:hover:border-purple-700 transition-all hover:shadow-xl">
            <CardHeader>
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-xl">Decisões Inteligentes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Identifique rapidamente qual ação oferece melhor valor, rentabilidade e potencial de crescimento para seu portfólio.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Popular Comparisons */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
              Comparações Populares
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Explore comparações prontas entre as principais empresas da B3 por setor
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {popularComparisons.map((comparison) => {
              const Icon = comparison.icon
              const colorClasses = {
                orange: 'from-orange-500 to-red-500',
                blue: 'from-blue-500 to-indigo-500',
                purple: 'from-purple-500 to-pink-500',
                yellow: 'from-yellow-500 to-orange-500',
                red: 'from-red-500 to-pink-500',
                indigo: 'from-indigo-500 to-purple-500',
                green: 'from-green-500 to-emerald-500'
              }[comparison.color]

              return (
                <Card key={comparison.id} className="group hover:shadow-xl transition-all border-2 hover:border-blue-300 dark:hover:border-blue-700">
                  <CardHeader className="pb-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses} rounded-lg flex items-center justify-center mb-3`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-base">{comparison.title}</CardTitle>
                    <Badge variant="outline" className="w-fit text-xs">
                      {comparison.sector}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {comparison.description}
                    </p>
                    <Button 
                      asChild 
                      variant="outline" 
                      size="sm" 
                      className="w-full group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all"
                    >
                      <Link href={`/compara-acoes/${comparison.tickers.join('/')}`}>
                        Comparar
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Indicators Explanation - Oculto para Premium */}
        <SEOSectionWrapper>
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
              Principais Indicadores Analisados
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Entenda os indicadores financeiros que usamos para comparar as ações
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {indicators.map((indicator) => {
              const Icon = indicator.icon
              return (
                <Card key={indicator.name} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2.5 ${indicator.isPremium ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-blue-100 dark:bg-blue-900/30'} rounded-lg flex-shrink-0`}>
                          <Icon className={`w-5 h-5 ${indicator.isPremium ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base mb-1">{indicator.name}</CardTitle>
                        </div>
                      </div>
                      {indicator.isPremium && (
                        <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {indicator.description}
                    </p>
                    <div className={`flex items-start gap-2 p-2 rounded-md ${indicator.isPremium ? 'bg-yellow-50 dark:bg-yellow-950/20' : 'bg-green-50 dark:bg-green-950/20'}`}>
                      {indicator.isPremium ? (
                        <>
                          <Crown className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-yellow-800 dark:text-yellow-200">
                            <strong>Premium:</strong> {indicator.interpretation}
                          </p>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-green-800 dark:text-green-200">
                            {indicator.interpretation}
                          </p>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
        </SEOSectionWrapper>

        {/* How it Works - Oculto para Premium */}
        <SEOSectionWrapper>
        <div className="mb-16">
          <Card className="border-2">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950/30">
              <CardTitle className="flex items-center space-x-2 text-2xl">
                <Lightbulb className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <span>Como Usar o Comparador</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">1</span>
                  </div>
                  <h4 className="font-bold text-lg mb-2">Busque as Empresas</h4>
                  <p className="text-sm text-muted-foreground">
                    Use nossa busca inteligente para encontrar ações por ticker (ex: VALE3) ou nome da empresa. Selecione de 2 a 6 ações.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">2</span>
                  </div>
                  <h4 className="font-bold text-lg mb-2">Análise Automática</h4>
                  <p className="text-sm text-muted-foreground">
                    Nossa IA analisa automaticamente todos os indicadores financeiros, fundamentalistas e dados de mercado de cada empresa.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">3</span>
                  </div>
                  <h4 className="font-bold text-lg mb-2">Compare e Decida</h4>
                  <p className="text-sm text-muted-foreground">
                    Veja todos os indicadores lado a lado em uma tabela clara. Tome decisões informadas baseadas em dados reais.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </SEOSectionWrapper>

        {/* FAQs - Oculto para Premium */}
        <SEOSectionWrapper>
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
              Perguntas Frequentes
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Tudo que você precisa saber sobre nosso comparador de ações
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg flex items-start gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                      <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span>{faq.question}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed pl-14">
                    {faq.answer}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        </SEOSectionWrapper>

        {/* CTA Final */}
        <div className="text-center">
          <Card className="border-0 shadow-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white overflow-hidden relative">
            <div className="absolute inset-0 bg-black/10"></div>
            <CardContent className="p-12 relative z-10">
              <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-90" />
              <h3 className="text-3xl md:text-4xl font-bold mb-4">
                Pronto para Comparar Suas Ações?
              </h3>
              <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
                Use nossa ferramenta gratuita e descubra quais ações oferecem o melhor potencial de retorno para seu portfólio
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="secondary" className="font-semibold text-base">
                  <Link href="#comparador">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Começar Comparação
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="bg-white/10 hover:bg-white/20 border-white/30 text-white font-semibold text-base">
                  <Link href="/ranking">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Ver Rankings
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Schema Structured Data for FAQs */}
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

      {/* Schema for WebApplication */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "Comparador de Ações B3 - Preço Justo AI",
            "description": "Ferramenta gratuita para comparar até 6 ações da B3 com análise fundamentalista completa e mais de 25 indicadores financeiros.",
            "url": "https://precojusto.ai/comparador",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "BRL"
            },
            "featureList": [
              "Comparação de até 6 ações simultaneamente",
              "Análise fundamentalista completa com IA",
              "+25 indicadores financeiros",
              "Interface intuitiva com busca inteligente",
              "Dados atualizados da B3",
              "100% gratuito",
              "Responsivo mobile e desktop"
            ],
            "author": {
              "@type": "Organization",
              "name": "Preço Justo AI",
              "url": "https://precojusto.ai"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "ratingCount": "127",
              "bestRating": "5",
              "worstRating": "1"
            }
          })
        }}
      />

      {/* Schema for BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Início",
                "item": "https://precojusto.ai"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Comparador de Ações",
                "item": "https://precojusto.ai/comparador"
              }
            ]
          })
        }}
      />

      <Footer />
    </div>
  )
}

