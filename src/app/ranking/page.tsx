"use client"

import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { useState, useEffect, useRef, Suspense } from "react"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { QuickRanker, QuickRankerHandle } from "@/components/quick-ranker"
import { RankingHistorySection } from "@/components/ranking-history-section"
import { AssetTypeHubWrapper } from "@/components/asset-type-hub-wrapper"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  Target, 
  TrendingUp,
  Shield,
  Sparkles,
  Brain,
  Calculator,
  DollarSign,
  PieChart,
  CheckCircle2,
  Lightbulb,
  Crown,
  AlertCircle
} from "lucide-react"
import Link from "next/link"
import Head from "next/head"

// FAQs para SEO
const faqs = [
  {
    question: 'O que são rankings de ações?',
    answer: 'Rankings de ações são listas ordenadas de empresas segundo critérios específicos de análise fundamentalista. Usamos algoritmos que avaliam indicadores como P/L, ROE, dividend yield, crescimento e qualidade da empresa para identificar as melhores oportunidades de investimento na B3.'
  },
  {
    question: 'Quais modelos de análise estão disponíveis?',
    answer: 'Oferecemos 8 modelos: Fórmula de Graham (gratuito), Value Investing, Fórmula Mágica, Dividend Yield Anti-Trap, Fórmula de Gordon, Fluxo de Caixa Descontado (FCD), Fundamentalista 3+1 e Análise Preditiva com IA. Modelos premium requerem assinatura.'
  },
  {
    question: 'Como funciona a Análise Preditiva com IA?',
    answer: 'Nossa IA analisa TODAS as estratégias disponíveis para cada empresa, processa indicadores fundamentalistas, técnicos e históricos, e cria um ranking preditivo personalizado. Usa machine learning para identificar padrões e oportunidades que análises tradicionais podem não detectar.'
  },
  {
    question: 'O histórico de rankings é salvo?',
    answer: 'Sim! Para usuários logados, todos os rankings gerados são salvos automaticamente com seus parâmetros e resultados. Você pode acessar rankings anteriores a qualquer momento e até reprocessá-los com novos dados do mercado.'
  },
  {
    question: 'Qual a diferença entre modelos gratuitos e premium?',
    answer: 'O modelo gratuito (Fórmula de Graham) oferece análise fundamentalista sólida para começar. Modelos premium incluem estratégias avançadas como FCD, análise com IA, múltiplas estratégias de dividendos, e acesso a indicadores exclusivos como médias históricas e análise técnica integrada.'
  },
  {
    question: 'Como escolher o melhor modelo para mim?',
    answer: 'Depende do seu perfil: Value Investing e Graham para conservadores, Dividend Yield para foco em renda passiva, FCD e Fundamentalista 3+1 para análise profunda, Fórmula Mágica para equilíbrio, e IA para quem quer aproveitar todas as estratégias simultaneamente com tecnologia preditiva.'
  }
]

// Modelos explicados
const modelDetails = [
  {
    id: 'graham',
    name: 'Fórmula de Graham',
    icon: Target,
    color: 'from-blue-500 to-cyan-500',
    description: 'Método clássico criado por Benjamin Graham, o pai do value investing',
    features: [
      'Identifica ações subvalorizadas',
      'Foco em empresas sólidas e lucrativas',
      'Margem de segurança incorporada',
      'Ideal para investidores conservadores'
    ],
    isFree: true
  },
  {
    id: 'ai',
    name: 'Análise Preditiva com IA',
    icon: Brain,
    color: 'from-purple-500 to-pink-500',
    description: 'Inteligência Artificial que combina TODAS as estratégias',
    features: [
      'Analisa todas as estratégias simultaneamente',
      'Machine learning para padrões complexos',
      'Ranking preditivo personalizado',
      'Considera análise técnica e fundamentalista'
    ],
    isFree: false,
    isHot: true
  },
  {
    id: 'fundamentalist',
    name: 'Fundamentalista 3+1',
    icon: BarChart3,
    color: 'from-green-500 to-emerald-500',
    description: 'Análise simplificada com 3 pilares essenciais + bônus dividendos',
    features: [
      'Qualidade: ROE, ROIC, margens',
      'Preço: P/L, P/VP com médias históricas',
      'Endividamento: contexto por setor',
      'Bônus: Dividendos sustentáveis'
    ],
    isFree: false,
    isHot: true
  },
  {
    id: 'fcd',
    name: 'Fluxo de Caixa Descontado',
    icon: Calculator,
    color: 'from-orange-500 to-red-500',
    description: 'Avaliação intrínseca por DCF com projeções sofisticadas',
    features: [
      'Valor intrínseco calculado',
      'Projeções de fluxo de caixa',
      'Taxa de desconto ajustável',
      'Margem de segurança configurável'
    ],
    isFree: false,
    isHot: true
  },
  {
    id: 'dividendYield',
    name: 'Dividend Yield Anti-Trap',
    icon: DollarSign,
    color: 'from-green-600 to-teal-600',
    description: 'Renda passiva sustentável com filtros anti-armadilha',
    features: [
      'Evita dividend traps',
      'Analisa sustentabilidade do payout',
      'Histórico de pagamentos',
      'Ideal para renda passiva'
    ],
    isFree: false
  },
  {
    id: 'gordon',
    name: 'Fórmula de Gordon',
    icon: DollarSign,
    color: 'from-violet-500 to-purple-500',
    description: 'Avaliação por dividendos para distribuições consistentes',
    features: [
      'Baseado em dividendos futuros',
      'Crescimento de dividendos',
      'Taxa de desconto ajustável',
      'Empresas com histórico consistente'
    ],
    isFree: false
  },
  {
    id: 'magicFormula',
    name: 'Fórmula Mágica',
    icon: PieChart,
    color: 'from-yellow-500 to-orange-500',
    description: 'Método de Joel Greenblatt que combina qualidade e preço',
    features: [
      'Retorno sobre capital',
      'Earnings yield',
      'Equilíbrio entre qualidade e preço',
      'Estratégia comprovada'
    ],
    isFree: false
  },
  {
    id: 'lowPE',
    name: 'Value Investing',
    icon: BarChart3,
    color: 'from-indigo-500 to-purple-500',
    description: 'P/L baixo combinado com qualidade comprovada',
    features: [
      'Foco em P/L atrativo',
      'Indicadores de qualidade',
      'Médias históricas',
      'Value investing clássico'
    ],
    isFree: false,
    isHot: true
  }
]

function RankingContent() {
  const { data: session } = useSession()
  const { isPremium } = usePremiumStatus()
  const searchParams = useSearchParams()
  const rankingId = searchParams.get('id')
  const assetTypeParam = searchParams.get('assetType') as 'b3' | 'bdr' | 'both' | null
  // Se houver rankingId mas não houver assetType, usar 'both' como padrão para não mostrar o hub
  const assetType = assetTypeParam || (rankingId ? 'both' : null)
  const isLoggedIn = !!session
  const [showHistory, setShowHistory] = useState(true)
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)
  const quickRankerRef = useRef<QuickRankerHandle>(null)
  
  // Callback para quando um novo ranking for gerado
  const handleRankingGenerated = () => {
    // Incrementar o trigger para forçar reload do histórico
    setHistoryRefreshTrigger(prev => prev + 1)
  }

  // Função para scrollar para o quick ranker e resetar estado
  const scrollToQuickRanker = () => {
    // Remover ID da URL para resetar o QuickRanker
    const currentUrl = new URL(window.location.href)
    currentUrl.searchParams.delete('id')
    window.history.pushState({}, '', currentUrl.toString())
    
    // Forçar atualização do componente removendo o rankingId
    window.dispatchEvent(new PopStateEvent('popstate'))
    
    // Chamar o método reset do QuickRanker para limpar todos os estados
    quickRankerRef.current?.reset()
    
    // Scroll para o QuickRanker
    setTimeout(() => {
      quickRankerRef.current?.scrollToTop()
    }, 100)
  }

  // Scroll para o histórico se houver ID na URL (só executar se houver assetType)
  useEffect(() => {
    if (!assetType) return // Não executar se não houver assetType
    
    if (rankingId) {
      setShowHistory(true)
    } else {
      scrollToQuickRanker()
    }
  }, [rankingId, assetType]) // Incluir assetType nas dependências
  
  // Se não houver assetType E não houver rankingId, mostrar o HUB com conteúdo SEO (DEPOIS de todos os hooks)
  if (!assetType) {
    return (
      <AssetTypeHubWrapper
        pageType="ranking"
        title="Rankings de Ações"
        description="Escolha o tipo de ativo que deseja ranquear: apenas ações B3, apenas BDRs ou ambos juntos."
      />
    )
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background">
      <Head>
        <title>Rankings de Ações B3 - 8 Modelos de Análise Fundamentalista | Preço Justo AI</title>
        <meta name="description" content="Rankings de ações B3 com 8 modelos de análise fundamentalista: Fórmula de Graham (grátis), Value Investing, Fórmula Mágica, Dividend Yield, FCD, Gordon, Fundamentalista 3+1 e Análise Preditiva com IA. Encontre as melhores ações da Bolsa brasileira e BDRs." />
        <meta name="keywords" content="rankings ações, ranking ações B3, análise fundamentalista ações, fórmula graham, value investing, fórmula mágica greenblatt, dividend yield, fluxo de caixa descontado, análise ações, ranking ações bolsa, melhores ações B3, ações subvalorizadas, análise preditiva IA, screening ações, valuation ações, ROE ações, P/L ações" />
        <meta property="og:title" content="Rankings de Ações B3 - 8 Modelos de Análise Fundamentalista | Preço Justo AI" />
        <meta property="og:description" content="Encontre as melhores ações da B3 e BDRs com 8 modelos de análise fundamentalista. De Graham a Inteligência Artificial: escolha a estratégia ideal para seu perfil." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://precojusto.ai/ranking" />
        <meta property="og:site_name" content="Preço Justo AI" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Rankings de Ações B3 - 8 Modelos de Análise Fundamentalista | Preço Justo AI" />
        <meta name="twitter:description" content="Encontre as melhores ações da B3 e BDRs com 8 modelos de análise fundamentalista. De Graham a Inteligência Artificial." />
        <link rel="canonical" href="https://precojusto.ai/ranking" />
        <meta name="robots" content="index, follow" />
      </Head>
      
      {/* Hero Section - Compacto para Premium */}
      <section className={`bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white px-4 ${
        isPremium ? 'py-6 md:py-8' : 'py-12 md:py-20'
      }`}>
        <div className="container mx-auto max-w-7xl">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link href={isLoggedIn ? "/dashboard" : "/"} className="text-blue-100 hover:text-white text-sm">
              {isLoggedIn ? "Dashboard" : "Início"}
            </Link>
            <span className="text-blue-200 mx-2">/</span>
            <span className="text-white text-sm font-medium">Rankings de Ações</span>
          </div>

          <div className="text-center">
            {!isPremium && (
              <div className="flex items-center justify-center mb-6">
                <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl">
                  <BarChart3 className="w-12 h-12 md:w-16 md:h-16" />
                </div>
              </div>
            )}
            
            <h1 className={`font-bold ${
              isPremium ? 'text-2xl md:text-3xl mb-2' : 'text-3xl md:text-5xl mb-4'
            }`}>
              Rankings de Ações B3
            </h1>
            
            {!isPremium && (
              <>
                <p className="text-lg md:text-xl text-blue-100 mb-3 max-w-3xl mx-auto">
                  Encontre as melhores oportunidades de investimento com 8 modelos de análise fundamentalista
                </p>
                
                <p className="text-base text-blue-200 max-w-2xl mx-auto mb-6">
                  De Graham a Inteligência Artificial: escolha a estratégia ideal para seu perfil de investidor
                </p>
              </>
            )}

            <div className={`flex flex-wrap justify-center gap-3 ${isPremium ? 'mt-3' : ''}`}>
              <Badge variant="secondary" className="px-4 py-2 bg-white/20 backdrop-blur-sm border-white/30 text-white">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {isLoggedIn ? 'Histórico Salvo' : 'Modelo Gratuito'}
              </Badge>
              {isPremium && (
                <Badge variant="secondary" className="px-4 py-2 bg-white/20 backdrop-blur-sm border-white/30 text-white">
                  <Crown className="w-4 h-4 mr-2" />
                  8 Modelos Premium
                </Badge>
              )}
              <Badge variant="secondary" className="px-4 py-2 bg-white/20 backdrop-blur-sm border-white/30 text-white">
                <Sparkles className="w-4 h-4 mr-2" />
                Análise com IA
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Botão Novo Ranking - Destaque */}
        {isLoggedIn && (
          <div className="mb-8">
            <Card className="border-0 bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 dark:from-green-950/20 dark:via-blue-950/20 dark:to-purple-950/20 shadow-lg">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Criar Novo Ranking
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Analise empresas com 8 modelos fundamentalistas
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={scrollToQuickRanker}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-lg w-full sm:w-auto"
                  >
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Novo Ranking
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* CTA Cards */}
        {!isLoggedIn && (
          <div className="mb-8">
            <Card className="border-2 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-violet-500 rounded-xl flex items-center justify-center shrink-0">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">Crie uma conta para aproveitar ao máximo</h3>
                      <p className="text-sm text-muted-foreground">
                        Salve seus rankings automaticamente, acesse histórico completo e desbloqueie modelos premium
                      </p>
                    </div>
                  </div>
                  <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 w-full md:w-auto">
                    <Link href="/register" className="flex items-center gap-2">
                      Criar Conta Grátis
                      <TrendingUp className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoggedIn && !isPremium && (
          <div className="mb-8">
            <Card className="border-2 bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20 border-violet-200">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-pink-500 rounded-xl flex items-center justify-center shrink-0">
                      <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">Desbloqueie 7 Modelos Premium + IA</h3>
                      <p className="text-sm text-muted-foreground">
                        Value Investing, Dividend Yield, Fórmula Mágica, FCD, Gordon, Fundamentalista 3+1 e Análise Preditiva com IA
                      </p>
                    </div>
                  </div>
                  <Button asChild size="lg" className="bg-gradient-to-r from-violet-600 to-pink-600 w-full md:w-auto">
                    <Link href="/checkout" className="flex items-center gap-2">
                      Fazer Upgrade
                      <Shield className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Histórico para Usuários Logados */}
        {isLoggedIn && showHistory && (
          <div className="mb-8">
            <RankingHistorySection refreshTrigger={historyRefreshTrigger} />
          </div>
        )}

        {/* Gerador de Ranking */}
        <div id="ranking-generator" className="mb-12">
          <QuickRanker 
            ref={quickRankerRef} 
            rankingId={rankingId} 
            assetTypeFilter={assetType}
            onRankingGenerated={handleRankingGenerated} 
          />
        </div>

        {/* Modelos Disponíveis - Oculto para Premium */}
        {!isPremium && (
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
              Modelos de Análise Disponíveis
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Escolha entre 8 estratégias comprovadas de investimento
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {modelDetails.map((model) => {
              const Icon = model.icon
              const canAccess = model.isFree || isPremium

              return (
                <Card 
                  key={model.id} 
                  className={`relative hover:shadow-xl transition-all ${
                    canAccess ? 'border-2 hover:border-blue-300 dark:hover:border-blue-700' : 'opacity-75'
                  }`}
                >
                  {model.isHot && canAccess && (
                    <div className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-pulse">
                      HOT
                    </div>
                  )}
                  
                  <CardHeader className="pb-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${model.color} rounded-xl flex items-center justify-center mb-3`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <span>{model.name}</span>
                      {!model.isFree && (
                        <Crown className={`w-4 h-4 ${canAccess ? 'text-yellow-500' : 'text-gray-400'}`} />
                      )}
                    </CardTitle>
                    <Badge variant={model.isFree ? "secondary" : "outline"} className="w-fit text-xs">
                      {model.isFree ? 'Gratuito' : 'Premium'}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {model.description}
                    </p>
                    <ul className="space-y-2">
                      {model.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs">
                          <CheckCircle2 className={`w-3 h-3 mt-0.5 flex-shrink-0 ${
                            canAccess ? 'text-green-500' : 'text-gray-400'
                          }`} />
                          <span className={canAccess ? '' : 'text-gray-500'}>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    {!canAccess && (
                      <div className="mt-4 pt-4 border-t">
                        <Button asChild size="sm" variant="outline" className="w-full">
                          <Link href="/checkout">
                            <Crown className="w-3 h-3 mr-2" />
                            Desbloquear
                          </Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
        )}

        {/* Como Funciona - Oculto para Premium */}
        {!isPremium && (
        <div className="mb-12">
          <Card className="border-2">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950/30">
              <CardTitle className="flex items-center space-x-2 text-2xl">
                <Lightbulb className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <span>Como Usar os Rankings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">1</span>
                  </div>
                  <h4 className="font-bold text-lg mb-2">Escolha o Modelo</h4>
                  <p className="text-sm text-muted-foreground">
                    Selecione a estratégia que melhor se encaixa no seu perfil: conservador, agressivo, foco em dividendos ou análise completa com IA.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">2</span>
                  </div>
                  <h4 className="font-bold text-lg mb-2">Ajuste Parâmetros</h4>
                  <p className="text-sm text-muted-foreground">
                    Configure critérios como margem de segurança, P/L máximo, ROE mínimo e outros filtros específicos de cada estratégia.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">3</span>
                  </div>
                  <h4 className="font-bold text-lg mb-2">Analise Resultados</h4>
                  <p className="text-sm text-muted-foreground">
                    Receba ranking ordenado com preços justos, upside potencial e análise detalhada de cada ação. Rankings são salvos automaticamente.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}


        {/* FAQs - Oculto para Premium */}
        {!isPremium && (
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
              Perguntas Frequentes
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Tudo que você precisa saber sobre rankings de ações
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
        )}
      </div>


      {/* Schema Markup para SEO */}
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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "Rankings de Ações B3 - Preço Justo AI",
            "description": "Ferramenta de análise fundamentalista com 8 modelos para ranking de ações da B3",
            "url": "https://precojusto.ai/ranking",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "offers": {
              "@type": "AggregateOffer",
              "lowPrice": "0",
              "highPrice": "39.90",
              "priceCurrency": "BRL"
            },
            "featureList": [
              "8 modelos de análise fundamentalista",
              "Análise Preditiva com IA",
              "Histórico de rankings salvos",
              "Fórmula de Graham gratuita",
              "Modelos premium: FCD, Gordon, Fundamentalista 3+1",
              "Dividend Yield Anti-Trap",
              "Value Investing e Fórmula Mágica"
            ]
          })
        }}
      />

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
                "name": isLoggedIn ? "Dashboard" : "Início",
                "item": isLoggedIn ? "https://precojusto.ai/dashboard" : "https://precojusto.ai"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Rankings de Ações",
                "item": "https://precojusto.ai/ranking"
              }
            ]
          })
        }}
      />
    </div>
  )
}

export default function RankingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando rankings...</p>
        </div>
      </div>
    }>
      <RankingContent />
    </Suspense>
  )
}

