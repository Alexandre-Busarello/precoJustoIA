import { Metadata } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Brain, 
  Calculator, 
  Target, 
  TrendingUp, 
  Shield, 
  Zap,
  ArrowRight,
  CheckCircle,
  DollarSign,
  BookOpen,
  Award,
  LineChart
} from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Metodologia de Análise Fundamentalista | Fórmula de Graham, Dividend Yield, Fórmula Mágica - Preço Justo AI",
  description: "📚 Metodologia completa de análise fundamentalista de ações: Fórmula de Graham, Dividend Yield, Fórmula Mágica de Greenblatt, Fundamentalista 3+1, FCD, Gordon + IA. Base científica e acadêmica para investir em ações da B3/Bovespa.",
  keywords: "metodologia análise fundamentalista, como fazer análise fundamentalista, fórmula benjamin graham, dividend yield como calcular, fórmula mágica joel greenblatt, fluxo caixa descontado FCD, modelo gordon dividendos, valuation ações metodologia, análise fundamentalista passo a passo, como analisar ações bovespa",
}

export default function MetodologiaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <BookOpen className="w-4 h-4" />
              Base Científica
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              Nossa{" "}
              <span className="text-blue-600">Metodologia</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Conheça em detalhes os modelos de valuation e metodologias de análise 
              fundamentalista que utilizamos, baseados em décadas de pesquisa acadêmica 
              e resultados comprovados no mercado.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <Badge variant="outline" className="text-green-600 border-green-600 px-4 py-2">
                <Award className="w-4 h-4 mr-2" />
                Metodologias Consagradas
              </Badge>
              <Badge variant="outline" className="text-blue-600 border-blue-600 px-4 py-2">
                <BookOpen className="w-4 h-4 mr-2" />
                Base Acadêmica
              </Badge>
              <Badge variant="outline" className="text-purple-600 border-purple-600 px-4 py-2">
                <TrendingUp className="w-4 h-4 mr-2" />
                Resultados Comprovados
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Fundamentos da Análise */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Fundamentos da{" "}
              <span className="text-blue-600">Análise Fundamentalista</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Os princípios que norteiam nossa abordagem de investimento
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-4">Valor Intrínseco</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Toda empresa possui um valor intrínseco baseado em seus fundamentos 
                  financeiros. Quando o preço de mercado está abaixo deste valor, 
                  temos uma oportunidade de investimento.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-4">Margem de Segurança</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Compramos apenas quando há uma margem significativa entre o preço 
                  de mercado e o valor intrínseco, protegendo contra erros de estimativa 
                  e volatilidade do mercado.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-4">Longo Prazo</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Focamos em empresas com fundamentos sólidos para investimento 
                  de longo prazo, ignorando flutuações de curto prazo e seguindo 
                  a filosofia do &ldquo;tempo no mercado&rdquo;.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Modelos Detalhados */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Modelos de{" "}
              <span className="text-violet-600">Valuation Detalhados</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Metodologias aplicadas automaticamente em nossa plataforma
            </p>
          </div>

          <div className="space-y-12 max-w-6xl mx-auto">
            {/* Fórmula de Graham */}
            <Card id="graham" className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Shield className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Fórmula de Benjamin Graham</h3>
                        <Badge className="bg-green-100 text-green-800 border-green-300 mt-2">Gratuito</Badge>
                      </div>
                    </div>
                    
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      Desenvolvida pelo &ldquo;pai do value investing&rdquo;, esta fórmula identifica ações 
                      subvalorizadas de empresas com fundamentos sólidos. Graham estabeleceu 
                      critérios rigorosos que resistiram ao teste do tempo.
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span>P/L entre 0 e 15</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span>P/VPA entre 0 e 1.5</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span>Dívida/Patrimônio &lt; 110%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span>Crescimento consistente dos lucros</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-8 rounded-lg">
                    <h4 className="text-lg font-bold mb-4 text-blue-900 dark:text-blue-100">Fórmula Matemática</h4>
                    <div className="bg-white dark:bg-background p-4 rounded border-2 border-blue-200 dark:border-blue-800">
                      <p className="text-center font-mono text-lg text-blue-800 dark:text-blue-200 mb-2">
                        <strong>Preço Justo = √(22.5 × LPA × VPA)</strong>
                      </p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>LPA = Lucro por Ação</p>
                        <p>VPA = Valor Patrimonial por Ação</p>
                        <p>22.5 = Constante de Graham (15 × 1.5)</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                      <strong>Interpretação:</strong> Se o preço atual estiver abaixo do preço justo calculado, 
                      a ação pode estar subvalorizada segundo os critérios de Graham.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dividend Yield */}
            <Card id="dividend-yield" className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 bg-green-600 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Estratégia Dividend Yield</h3>
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 mt-2">Premium</Badge>
                      </div>
                    </div>
                    
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      Focada em renda passiva sustentável, esta estratégia identifica empresas 
                      com alto dividend yield que conseguem manter e aumentar seus dividendos 
                      ao longo do tempo, evitando as temidas &ldquo;dividend traps&rdquo;.
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span>Dividend Yield &gt; 6%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span>Payout Ratio &lt; 80%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span>Crescimento de dividendos consistente</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span>Saúde financeira sólida</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-950/20 p-8 rounded-lg">
                    <h4 className="text-lg font-bold mb-4 text-green-900 dark:text-green-100">Cálculos Principais</h4>
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-background p-4 rounded border-2 border-green-200 dark:border-green-800">
                        <p className="font-mono text-green-800 dark:text-green-200 mb-1">
                          <strong>DY = (Dividendos/Ação ÷ Preço) × 100</strong>
                        </p>
                      </div>
                      <div className="bg-white dark:bg-background p-4 rounded border-2 border-green-200 dark:border-green-800">
                        <p className="font-mono text-green-800 dark:text-green-200 mb-1">
                          <strong>Payout = Dividendos ÷ Lucro Líquido</strong>
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                      <strong>Filtros Adicionais:</strong> Analisamos histórico de 5 anos de dividendos, 
                      endividamento, fluxo de caixa e posição competitiva da empresa.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fórmula Mágica */}
            <Card id="formula-magica" className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 bg-purple-600 rounded-lg flex items-center justify-center">
                        <Zap className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Fórmula Mágica de Greenblatt</h3>
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 mt-2">Premium</Badge>
                      </div>
                    </div>
                    
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      Desenvolvida por Joel Greenblatt, esta estratégia combina empresas baratas 
                      (alto Earnings Yield) com empresas de qualidade (alto ROIC). Estudos mostram 
                      que esta combinação historicamente supera o mercado.
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-purple-600" />
                        <span>Alto Earnings Yield (inverso do P/L)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-purple-600" />
                        <span>Alto ROIC (Return on Invested Capital)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-purple-600" />
                        <span>Ranking combinado dos dois fatores</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-purple-600" />
                        <span>Rebalanceamento anual</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-950/20 p-8 rounded-lg">
                    <h4 className="text-lg font-bold mb-4 text-purple-900 dark:text-purple-100">Metodologia de Ranking</h4>
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-background p-4 rounded border-2 border-purple-200 dark:border-purple-800">
                        <p className="font-mono text-purple-800 dark:text-purple-200 mb-1">
                          <strong>EY = EBIT ÷ Enterprise Value</strong>
                        </p>
                        <p className="text-xs text-muted-foreground">Earnings Yield</p>
                      </div>
                      <div className="bg-white dark:bg-background p-4 rounded border-2 border-purple-200 dark:border-purple-800">
                        <p className="font-mono text-purple-800 dark:text-purple-200 mb-1">
                          <strong>ROIC = EBIT ÷ Capital Investido</strong>
                        </p>
                        <p className="text-xs text-muted-foreground">Return on Invested Capital</p>
                      </div>
                      <div className="bg-white dark:bg-background p-4 rounded border-2 border-purple-200 dark:border-purple-800">
                        <p className="font-mono text-purple-800 dark:text-purple-200 mb-1">
                          <strong>Ranking Final = Rank(EY) + Rank(ROIC)</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* FCD - Fluxo de Caixa Descontado */}
            <Card id="fcd" className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 bg-orange-600 rounded-lg flex items-center justify-center">
                        <Calculator className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Fluxo de Caixa Descontado (FCD)</h3>
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 mt-2">Premium</Badge>
                      </div>
                    </div>
                    
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      Considerado o método mais preciso de valuation, o FCD calcula o valor 
                      presente de todos os fluxos de caixa futuros da empresa. Utilizamos 
                      projeções conservadoras e múltiplos cenários.
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-orange-600" />
                        <span>Projeção de fluxos de caixa (5-10 anos)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-orange-600" />
                        <span>Taxa de desconto (WACC)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-orange-600" />
                        <span>Valor terminal conservador</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-orange-600" />
                        <span>Análise de sensibilidade</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-orange-50 dark:bg-orange-950/20 p-8 rounded-lg">
                    <h4 className="text-lg font-bold mb-4 text-orange-900 dark:text-orange-100">Fórmula do FCD</h4>
                    <div className="bg-white dark:bg-background p-4 rounded border-2 border-orange-200 dark:border-orange-800 mb-4">
                      <p className="font-mono text-orange-800 dark:text-orange-200 text-sm mb-2">
                        <strong>VPL = Σ [FCF₍ₜ₎ ÷ (1 + r)ᵗ] + VT</strong>
                      </p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>FCF = Free Cash Flow</p>
                        <p>r = Taxa de desconto (WACC)</p>
                        <p>VT = Valor Terminal</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong>Premissas Conservadoras:</strong> Utilizamos crescimento perpétuo 
                      de 2-4% e múltiplas validações cruzadas com outros métodos.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Low P/E Strategy */}
            <Card id="low-pe" className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 bg-teal-600 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Estratégia Low P/E</h3>
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 mt-2">Premium</Badge>
                      </div>
                    </div>
                    
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      Identifica empresas com baixo P/L (Price-to-Earnings) que mantêm qualidade 
                      operacional. Combina preço atrativo com fundamentos sólidos para encontrar 
                      oportunidades de value investing.
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-teal-600" />
                        <span>P/L baixo (3-15)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-teal-600" />
                        <span>ROE consistente (&gt; 15%)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-teal-600" />
                        <span>Margem líquida saudável</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-teal-600" />
                        <span>Liquidez adequada</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-teal-50 dark:bg-teal-950/20 p-8 rounded-lg">
                    <h4 className="text-lg font-bold mb-4 text-teal-900 dark:text-teal-100">Critérios Principais</h4>
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-background p-4 rounded border-2 border-teal-200 dark:border-teal-800">
                        <p className="font-mono text-teal-800 dark:text-teal-200 mb-1">
                          <strong>P/L ≤ 15 e P/L ≥ 3</strong>
                        </p>
                      </div>
                      <div className="bg-white dark:bg-background p-4 rounded border-2 border-teal-200 dark:border-teal-800">
                        <p className="font-mono text-teal-800 dark:text-teal-200 mb-1">
                          <strong>ROE ≥ 15% + ROA ≥ 5%</strong>
                        </p>
                      </div>
                      <div className="bg-white dark:bg-background p-4 rounded border-2 border-teal-200 dark:border-teal-800">
                        <p className="font-mono text-teal-800 dark:text-teal-200 mb-1">
                          <strong>Liquidez Corrente ≥ 1.0</strong>
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                      <strong>Filtros Adicionais:</strong> Market cap mínimo de R$ 500M, 
                      margem líquida &gt; 3% e endividamento controlado.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gordon Growth Model */}
            <Card id="gordon" className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <LineChart className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Modelo de Gordon (DDM)</h3>
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 mt-2">Premium</Badge>
                      </div>
                    </div>
                    
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      Modelo de Desconto de Dividendos que calcula o valor intrínseco baseado 
                      nos dividendos futuros esperados. Ideal para empresas com histórico 
                      consistente de pagamento e crescimento de dividendos.
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-indigo-600" />
                        <span>Histórico consistente de dividendos</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-indigo-600" />
                        <span>Taxa de crescimento estável</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-indigo-600" />
                        <span>Payout ratio sustentável</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-indigo-600" />
                        <span>Negócio maduro e estável</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-indigo-50 dark:bg-indigo-950/20 p-8 rounded-lg">
                    <h4 className="text-lg font-bold mb-4 text-indigo-900 dark:text-indigo-100">Fórmula do Modelo</h4>
                    <div className="bg-white dark:bg-background p-4 rounded border-2 border-indigo-200 dark:border-indigo-800 mb-4">
                      <p className="font-mono text-indigo-800 dark:text-indigo-200 text-sm mb-2">
                        <strong>Valor = D₁ ÷ (r - g)</strong>
                      </p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>D₁ = Dividendo esperado próximo período</p>
                        <p>r = Taxa de desconto (retorno exigido)</p>
                        <p>g = Taxa de crescimento dos dividendos</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong>Premissa Fundamental:</strong> A taxa de desconto deve ser maior 
                      que a taxa de crescimento para o modelo ser válido.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fundamentalista 3+1 */}
            <Card id="fundamentalista" className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 bg-teal-600 rounded-lg flex items-center justify-center">
                        <Target className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Fundamentalista 3+1</h3>
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 mt-2">Premium</Badge>
                      </div>
                    </div>
                    
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      Estratégia simplificada que usa apenas 3 indicadores essenciais para análise 
                      fundamentalista, adaptando-se automaticamente ao perfil da empresa (com/sem dívida, 
                      setor especial) + análise bônus de dividendos.
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-teal-600" />
                        <span>Metodologia adaptativa por perfil</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-teal-600" />
                        <span>Análise específica para bancos/seguradoras</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-teal-600" />
                        <span>Decisões rápidas e fundamentadas</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-teal-600" />
                        <span>Bônus: análise de dividendos</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-teal-50 dark:bg-teal-950/20 p-8 rounded-lg">
                    <h4 className="text-lg font-bold mb-4 text-teal-900 dark:text-teal-100">Metodologia Adaptativa</h4>
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-background p-4 rounded border-2 border-teal-200 dark:border-teal-800">
                        <p className="font-semibold text-teal-800 dark:text-teal-200 mb-2">
                          <strong>Empresas SEM Dívida:</strong>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ROE + P/L vs Crescimento + Endividamento
                        </p>
                      </div>
                      <div className="bg-white dark:bg-background p-4 rounded border-2 border-teal-200 dark:border-teal-800">
                        <p className="font-semibold text-teal-800 dark:text-teal-200 mb-2">
                          <strong>Empresas COM Dívida:</strong>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ROIC + EV/EBITDA + Endividamento
                        </p>
                      </div>
                      <div className="bg-white dark:bg-background p-4 rounded border-2 border-teal-200 dark:border-teal-800">
                        <p className="font-semibold text-teal-800 dark:text-teal-200 mb-2">
                          <strong>Bancos/Seguradoras:</strong>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ROE + P/L (endividamento não aplicável)
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                      <strong>Passo Bônus:</strong> Análise de dividendos com Payout (40-80%) 
                      e Dividend Yield (≥4%) para identificar boas pagadoras.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Análise com IA */}
      <section id="ia" className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Análise com{" "}
                <span className="text-blue-600">Inteligência Artificial</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                Como complementamos a análise quantitativa com insights qualitativos
              </p>
            </div>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                        <Brain className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Google Gemini AI</h3>
                        <Badge className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 border-blue-300 mt-2">IA Premium</Badge>
                      </div>
                    </div>
                    
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      Nossa IA analisa demonstrações financeiras, relatórios anuais, notícias 
                      e contexto macroeconômico para gerar insights qualitativos que 
                      complementam perfeitamente nossa análise quantitativa.
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                        <span>Análise de demonstrações financeiras</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                        <span>Contexto setorial e macroeconômico</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                        <span>Análise de riscos e oportunidades</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                        <span>Insights sobre governança corporativa</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-8 rounded-lg">
                    <h4 className="text-lg font-bold mb-4">Processo de Análise</h4>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">1</div>
                        <div>
                          <p className="font-medium">Coleta de Dados</p>
                          <p className="text-sm text-muted-foreground">Demonstrações, notícias, contexto</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">2</div>
                        <div>
                          <p className="font-medium">Processamento IA</p>
                          <p className="text-sm text-muted-foreground">Análise qualitativa avançada</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold">3</div>
                        <div>
                          <p className="font-medium">Síntese Final</p>
                          <p className="text-sm text-muted-foreground">Insights acionáveis e recomendações</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Validação e Backtesting */}
      {/* <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Validação e{" "}
              <span className="text-green-600">Backtesting</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Como validamos nossas metodologias e garantimos qualidade
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold">Backtesting Histórico</h3>
                </div>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  Testamos nossas estratégias com dados históricos de 10+ anos, 
                  validando performance e ajustando parâmetros para otimizar resultados.
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Período de teste:</span>
                    <span className="text-sm font-medium">2010-2024</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Empresas analisadas:</span>
                    <span className="text-sm font-medium">500+</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Rebalanceamentos:</span>
                    <span className="text-sm font-medium">Anuais</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold">Controle de Qualidade</h3>
                </div>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  Implementamos múltiplas camadas de validação para garantir 
                  a precisão dos dados e a confiabilidade de nossas análises.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Validação cruzada de dados</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Detecção de outliers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Auditoria de resultados</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section> */}

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-violet-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Experimente Nossa Metodologia
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Veja na prática como nossas metodologias consagradas podem 
            ajudar você a encontrar ações subvalorizadas na B3.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-white hover:bg-gray-100 text-lg px-8 py-4" asChild>
              <Link href="/register" className="flex items-center gap-3">
                <Calculator className="w-5 h-5" />
                Testar Metodologia - Grátis
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="border-2 border-white text-blue-600 hover:bg-white hover:bg-gray-100 text-lg px-8 py-4" asChild>
              <Link href="/ranking">Ver Rankings</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
