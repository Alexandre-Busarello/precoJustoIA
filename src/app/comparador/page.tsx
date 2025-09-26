import { Metadata } from 'next'
import { StockComparisonSelector } from '@/components/stock-comparison-selector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  PieChart,
  ArrowRight,
  Lightbulb,
  Zap,
  Users
} from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Comparador de Ações B3 | Compare Ações da Bovespa Lado a Lado - Preço Justo AI',
  description: '📊 Comparador gratuito de ações da B3/Bovespa! Compare até 6 ações lado a lado com análise fundamentalista completa: P/L, ROE, Dividend Yield, margem líquida e +20 indicadores. Descubra qual ação investir na Bovespa!',
  keywords: 'comparador ações B3, comparar ações bovespa, qual ação investir, comparação ações lado a lado, indicadores financeiros ações, P/L ROE dividend yield, análise comparativa ações, melhores ações bovespa, comparar investimentos B3, ferramenta comparar ações',
  openGraph: {
    title: 'Comparador de Ações | Preço Justo AI',
    description: 'Compare múltiplas ações da B3 com análise fundamentalista completa e indicadores financeiros lado a lado.',
    type: 'website',
    url: '/comparador',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Comparador de Ações | Preço Justo AI',
    description: 'Compare múltiplas ações da B3 com análise fundamentalista completa.',
  },
  alternates: {
    canonical: '/comparador',
  },
  robots: {
    index: true,
    follow: true,
  }
}

export default function ComparadorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-background dark:via-background dark:to-background">
      <div className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full mr-4">
              <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Comparador de Ações
            </h1>
          </div>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Compare múltiplas ações da B3 lado a lado com análise fundamentalista completa. 
            Descubra qual investimento oferece o melhor potencial para seu portfólio.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <Badge variant="secondary" className="px-3 py-1">
              <Target className="w-4 h-4 mr-1" />
              Análise Fundamentalista
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              <TrendingUp className="w-4 h-4 mr-1" />
              Indicadores Financeiros
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              <PieChart className="w-4 h-4 mr-1" />
              Comparação Lado a Lado
            </Badge>
          </div>
        </div>

        {/* Main Comparator */}
        <div className="max-w-4xl mx-auto mb-12">
          <StockComparisonSelector />
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/10 dark:to-blue-800/10">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-lg">Comparação Instantânea</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Compare até 6 ações simultaneamente com indicadores financeiros atualizados e análise fundamentalista completa.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/10 dark:to-green-800/10">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-lg">Indicadores Precisos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                P/L, ROE, Dividend Yield, margem líquida e dezenas de outros indicadores para análise completa.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/10 dark:to-purple-800/10">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-lg">Decisões Inteligentes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Identifique rapidamente qual ação oferece melhor valor, rentabilidade e potencial de crescimento.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Popular Comparisons */}
        <div className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>Comparações Populares</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <h4 className="font-semibold mb-2 flex items-center">
                    <PieChart className="w-4 h-4 mr-2 text-blue-600" />
                    Mineração vs Petróleo
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Compare os gigantes dos commodities
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/compara-acoes/VALE3/PETR4">
                      VALE3 vs PETR4
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>

                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <h4 className="font-semibold mb-2 flex items-center">
                    <Target className="w-4 h-4 mr-2 text-green-600" />
                    Big Banks
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Os maiores bancos do país
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/compara-acoes/ITUB4/BBDC4/SANB11">
                      Bancos Top 3
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>

                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <h4 className="font-semibold mb-2 flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2 text-purple-600" />
                    Varejo Digital
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    E-commerce e varejo moderno
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/compara-acoes/MGLU3/AMER3/LREN3">
                      Varejo Digital
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>

                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <h4 className="font-semibold mb-2 flex items-center">
                    <Zap className="w-4 h-4 mr-2 text-yellow-600" />
                    Energia Elétrica
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Setor elétrico brasileiro
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/compara-acoes/ELET3/ELET6/CMIG4">
                      Energia Elétrica
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>

                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <h4 className="font-semibold mb-2 flex items-center">
                    <Users className="w-4 h-4 mr-2 text-red-600" />
                    Telecomunicações
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Conectividade e tecnologia
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/compara-acoes/VIVT3/TIMS3/OIBR3">
                      Telecom
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>

                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <h4 className="font-semibold mb-2 flex items-center">
                    <Target className="w-4 h-4 mr-2 text-indigo-600" />
                    Siderurgia
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Aço e metalurgia
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/compara-acoes/USIM5/CSNA3/GGBR4">
                      Siderúrgicas
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How it Works */}
        <div className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lightbulb className="w-5 h-5" />
                <span>Como Funciona</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">1</span>
                  </div>
                  <h4 className="font-semibold mb-2">Selecione as Ações</h4>
                  <p className="text-sm text-muted-foreground">
                    Digite os tickers das ações que deseja comparar (mínimo 2, máximo 6)
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">2</span>
                  </div>
                  <h4 className="font-semibold mb-2">Análise Automática</h4>
                  <p className="text-sm text-muted-foreground">
                    Nossa IA analisa todos os indicadores financeiros e fundamentalistas
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold text-purple-600 dark:text-purple-400">3</span>
                  </div>
                  <h4 className="font-semibold mb-2">Compare e Decida</h4>
                  <p className="text-sm text-muted-foreground">
                    Veja os resultados lado a lado e tome decisões de investimento informadas
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-4">
                Pronto para Comparar Suas Ações?
              </h3>
              <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
                Use nossa ferramenta avançada de comparação e descubra quais ações oferecem 
                o melhor potencial de retorno para seu portfólio.
              </p>
              <Button asChild size="lg" variant="secondary">
                <Link href="#comparador" className="scroll-smooth">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Começar Comparação
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Schema Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "Comparador de Ações - Preço Justo AI",
            "description": "Ferramenta avançada para comparar múltiplas ações da B3 com análise fundamentalista completa e indicadores financeiros.",
            "url": "https://preço-justo.ai/comparador",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "BRL"
            },
            "featureList": [
              "Comparação de até 6 ações simultaneamente",
              "Análise fundamentalista completa",
              "Indicadores financeiros atualizados",
              "Interface intuitiva e responsiva",
              "Dados da B3 em tempo real"
            ],
            "author": {
              "@type": "Organization",
              "name": "Preço Justo AI"
            }
          })
        }}
      />
    </div>
  )
}
