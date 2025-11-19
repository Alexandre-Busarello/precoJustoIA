"use client"

import { useState, useEffect, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScreeningConfigurator } from "@/components/screening-configurator"
import { ScreeningAIAssistant } from "@/components/screening-ai-assistant"
import { CompanyLogo } from "@/components/company-logo"
import { AddToBacktestButton } from "@/components/add-to-backtest-button"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { AssetTypeHubWrapper } from "@/components/asset-type-hub-wrapper"
import { 
  Search, 
  Loader2, 
  TrendingUp, 
  Building2, 
  Target,
  Sparkles,
  Filter,
  ArrowRight,
  Crown,
  RefreshCw
} from "lucide-react"
import Link from "next/link"
import Head from "next/head"

interface ScreeningFilter {
  enabled: boolean;
  min?: number;
  max?: number;
}

interface ScreeningParams {
  limit?: number;
  companySize?: 'all' | 'small_caps' | 'mid_caps' | 'blue_chips';
  useTechnicalAnalysis?: boolean;
  assetTypeFilter?: 'b3' | 'bdr' | 'both';
  plFilter?: ScreeningFilter;
  pvpFilter?: ScreeningFilter;
  evEbitdaFilter?: ScreeningFilter;
  psrFilter?: ScreeningFilter;
  roeFilter?: ScreeningFilter;
  roicFilter?: ScreeningFilter;
  roaFilter?: ScreeningFilter;
  margemLiquidaFilter?: ScreeningFilter;
  margemEbitdaFilter?: ScreeningFilter;
  cagrLucros5aFilter?: ScreeningFilter;
  cagrReceitas5aFilter?: ScreeningFilter;
  dyFilter?: ScreeningFilter;
  payoutFilter?: ScreeningFilter;
  dividaLiquidaPlFilter?: ScreeningFilter;
  liquidezCorrenteFilter?: ScreeningFilter;
  dividaLiquidaEbitdaFilter?: ScreeningFilter;
  marketCapFilter?: ScreeningFilter;
}

interface RankingResult {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  logoUrl?: string | null;
  fairValue: number | null;
  upside: number | null;
  marginOfSafety: number | null;
  rational: string;
  key_metrics?: Record<string, number | null>;
}

interface RankingResponse {
  model: string;
  params: ScreeningParams;
  rational: string;
  results: RankingResult[];
  count: number;
}

function ScreeningAcoesContent() {
  const { data: session } = useSession()
  const { isPremium } = usePremiumStatus()
  const searchParams = useSearchParams()
  const assetType = searchParams.get('assetType') as 'b3' | 'bdr' | 'both' | null
  
  const assetTypeFilter = assetType || 'both'

  const [params, setParams] = useState<ScreeningParams>({
    limit: 20,
    companySize: 'all',
    useTechnicalAnalysis: true,
    assetTypeFilter
  })
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<RankingResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sectors, setSectors] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])

  const isLoggedIn = !!session

  // Atualizar assetTypeFilter quando assetType mudar
  useEffect(() => {
    if (assetType) {
      setParams(prev => ({
        ...prev,
        assetTypeFilter: assetType
      }))
    }
  }, [assetType])

  // Buscar setores e indústrias
  useEffect(() => {
    const fetchSectorsIndustries = async () => {
      try {
        const response = await fetch('/api/sectors-industries')
        if (response.ok) {
          const data = await response.json()
          setSectors(data.sectors || [])
          // Pegar todas as indústrias únicas de todos os setores
          const allIndustries = Object.values(data.industriesBySector || {}).flat() as string[]
          setIndustries([...new Set(allIndustries)])
        }
      } catch (error) {
        console.error('Erro ao buscar setores/indústrias:', error)
      }
    }
    fetchSectorsIndustries()
  }, [])

  // Carregar parâmetros salvos do sessionStorage (do histórico)
  useEffect(() => {
    const savedParams = sessionStorage.getItem('screeningParams');
    if (savedParams) {
      try {
        const parsed = JSON.parse(savedParams);
        setParams(prev => ({
          ...prev,
          ...parsed,
          assetTypeFilter: assetType || 'both' // Manter assetTypeFilter atual
        }));
        // Limpar sessionStorage após usar
        sessionStorage.removeItem('screeningParams');
      } catch (error) {
        console.error('Erro ao carregar parâmetros salvos:', error);
        sessionStorage.removeItem('screeningParams');
      }
    }
  }, [assetType])
  
  // Se não houver assetType, mostrar o HUB com conteúdo SEO
  if (!assetType) {
    return (
      <AssetTypeHubWrapper
        pageType="screening"
        title="Screening de Ações"
        description="Escolha o tipo de ativo que deseja analisar: apenas ações B3, apenas BDRs ou ambos juntos."
      />
    )
  }

  const handleAIParametersGenerated = (aiParams: any) => {
    // Mesclar parâmetros gerados pela IA com os parâmetros atuais
    setParams((prevParams) => ({
      ...prevParams,
      ...aiParams
    }))
    
    // Scroll suave para o configurador
    setTimeout(() => {
      const configuratorElement = document.getElementById('screening-configurator')
      if (configuratorElement) {
        configuratorElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  const handleNewConfiguration = () => {
    // Limpar resultados
    setResults(null)
    setError(null)
    
    // Resetar parâmetros mantendo assetTypeFilter
    setParams({
      limit: 20,
      companySize: 'all',
      useTechnicalAnalysis: true,
      assetTypeFilter: assetType || 'both'
    })
    
    // Scroll para área de parâmetros
    setTimeout(() => {
      const aiElement = document.getElementById('ai-assistant')
      if (aiElement) {
        aiElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  const handleGenerateScreening = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/rank-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: 'screening',
          params: {
            ...params,
            includeBDRs: assetType === 'both' || assetType === 'bdr',
            assetTypeFilter: assetType
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: RankingResponse = await response.json()
      setResults(data)
      
      // Scroll para o topo da página para visualizar os resultados
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error("Erro ao gerar screening:", err)
      setError("Erro ao gerar screening. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return "N/A"
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatPercentage = (value: number | null) => {
    if (value === null) return "N/A"
    return `${(value).toFixed(1)}%`
  }

  const formatMetricValue = (key: string, value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    
    const percentualMetrics = [
      'roe', 'roa', 'roic', 'margemLiquida', 'margemEbitda', 
      'crescimentoReceitas', 'crescimentoLucros', 'dy'
    ];
    
    const monetaryMetrics = [
      'lpa', 'vpa', 'fairValue', 'currentPrice', 'precoJusto', 'marketCapBi'
    ];
    
    if (percentualMetrics.includes(key)) {
      if (value >= 0 && value <= 1) {
        return `${(value * 100).toFixed(1)}%`;
      }
      return `${value.toFixed(1)}%`;
    }
    
    if (monetaryMetrics.includes(key)) {
      return formatCurrency(value);
    }
    
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
  }

  const translateMetricName = (key: string) => {
    const translations: Record<string, string> = {
      'fairValue': 'Preço Justo',
      'roe': 'ROE',
      'roa': 'ROA', 
      'roic': 'ROIC',
      'pl': 'P/L',
      'pvp': 'P/VP',
      'dy': 'Dividend Yield',
      'lpa': 'LPA',
      'vpa': 'VPA',
      'margemLiquida': 'Margem Líquida',
      'margemEbitda': 'Margem EBITDA',
      'crescimentoReceitas': 'Crescimento Receitas',
      'crescimentoLucros': 'Crescimento Lucros',
      'liquidezCorrente': 'Liquidez Corrente',
      'dividaLiquidaPl': 'Dívida Líquida/PL',
      'marketCapBi': 'Market Cap (R$ Bi)'
    };
    
    return translations[key] || key.replace(/([A-Z])/g, ' $1').trim();
  }

  // Contar filtros ativos
  const countActiveFilters = () => {
    let count = 0;
    Object.keys(params).forEach(key => {
      if (key.endsWith('Filter')) {
        const filter = params[key as keyof ScreeningParams] as ScreeningFilter | undefined;
        if (filter?.enabled) count++;
      }
    });
    return count;
  };

  const activeFiltersCount = countActiveFilters();

  return (
    <>
      <Head>
        <title>Screening de Ações B3 - Filtro Customizável de Ações | Preço Justo AI</title>
        <meta name="description" content="Screening de ações B3 com filtros customizáveis. Encontre ações por valuation (P/L, P/VP), rentabilidade (ROE, ROIC), crescimento, dividendos e endividamento. Filtre +350 empresas da Bolsa brasileira e BDRs com critérios personalizados. Análise fundamentalista gratuita." />
        <meta name="keywords" content="screening ações, filtro ações B3, análise fundamentalista, buscar ações, screening ações B3, filtro ações bolsa, valuation ações, dividendos ações, ROE ações, P/L ações, P/VP ações, screening fundamentalista, encontrar ações, ações subvalorizadas, filtro ações customizado, análise ações B3, screening BDR, filtro BDR" />
        <meta property="og:title" content="Screening de Ações B3 - Filtro Customizável | Preço Justo AI" />
        <meta property="og:description" content="Configure filtros personalizados e encontre as melhores ações da B3 e BDRs baseado em seus critérios de investimento. Valuation, rentabilidade, crescimento e dividendos." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://precojusto.ai/screening-acoes" />
        <meta property="og:site_name" content="Preço Justo AI" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Screening de Ações B3 - Filtro Customizável | Preço Justo AI" />
        <meta name="twitter:description" content="Configure filtros personalizados e encontre as melhores ações da B3 e BDRs baseado em seus critérios de investimento." />
        <link rel="canonical" href="https://precojusto.ai/screening-acoes" />
        <meta name="robots" content="index, follow" />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-background dark:via-background dark:to-background">
        {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="text-center space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <Search className="absolute inset-0 m-auto w-8 h-8 text-blue-600" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Processando filtros...
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Analisando empresas da B3 com seus critérios
                </p>
              </div>
              
              <div className="flex items-center justify-center gap-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center space-y-4 mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-full px-4 py-2">
            <Search className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium">Screening Customizável</span>
            <Badge variant="secondary" className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs">
              🚀 Novo
            </Badge>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-bold">
            Screening de{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Ações
            </span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Configure filtros personalizados por categoria e encontre exatamente as empresas que você procura. 
            Total controle sobre <strong>valuation, rentabilidade, crescimento, dividendos e endividamento</strong>.
          </p>
        </div>

        {/* Results Section */}
        {results && (
          <div className="mb-8 space-y-6">
            {/* Results Header */}
            <Card className="border-0 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 shadow-lg">
              <CardContent className="p-6">
                {/* Botão Nova Configuração */}
                <div className="mb-6 flex justify-end">
                  <Button
                    onClick={handleNewConfiguration}
                    variant="outline"
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Nova Configuração
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Resultados do Screening</h3>
                      <p className="text-sm text-muted-foreground">
                        {results.count} empresas encontradas • {activeFiltersCount} filtros ativos
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" className="text-lg px-4 py-2">
                    {results.results.length} resultados
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Results List */}
            {results.results.length > 0 ? (
              <div className="grid gap-4">
                {results.results.map((result, index) => (
                  <Card 
                    key={result.ticker} 
                    className="border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-white to-gray-50 dark:from-background dark:to-background/80"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="relative">
                            <CompanyLogo 
                              logoUrl={result.logoUrl}
                              companyName={result.name}
                              ticker={result.ticker}
                              size={48}
                            />
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-xs border-2 border-white dark:border-background">
                              {index + 1}
                            </div>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold mb-1">{result.ticker}</h3>
                            <p className="text-muted-foreground font-medium text-sm mb-2">
                              {result.name}
                            </p>
                            {result.sector && (
                              <Badge variant="outline" className="text-xs">
                                {result.sector}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-2 mb-2">
                            <span className="text-2xl font-bold">
                              {formatCurrency(result.currentPrice)}
                            </span>
                          </div>
                          {result.upside !== null && (
                            <div className="flex items-center justify-end gap-1">
                              <TrendingUp className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-600">
                                +{formatPercentage(result.upside)} potencial
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Key Metrics */}
                      {result.key_metrics && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/10 dark:to-indigo-950/10 rounded-lg">
                          {Object.entries(result.key_metrics)
                            .filter(([, value]) => value !== null && value !== undefined)
                            .slice(0, 4)
                            .map(([key, value]) => (
                              <div key={key} className="text-center">
                                <p className="text-xs text-muted-foreground mb-1 truncate">
                                  {translateMetricName(key)}
                                </p>
                                <p className="font-semibold text-sm">
                                  {formatMetricValue(key, value as number)}
                                </p>
                              </div>
                            ))}
                        </div>
                      )}
                      
                      {/* Rational */}
                      <div className="border-t pt-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-blue-600" />
                          <h5 className="font-semibold text-sm text-blue-600">Por que esta empresa?</h5>
                        </div>
                        <MarkdownRenderer content={result.rational} className="text-sm leading-relaxed" />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-4 border-t">
                        <Button asChild variant="default" size="sm" className="flex-1">
                          <Link href={`/acao/${result.ticker}`} prefetch={false}>
                            <Building2 className="w-4 h-4 mr-2" />
                            Ver Análise Completa
                          </Link>
                        </Button>
                        
                        <AddToBacktestButton
                          asset={{
                            ticker: result.ticker,
                            companyName: result.name,
                            sector: result.sector || undefined,
                            currentPrice: result.currentPrice
                          }}
                          variant="outline"
                          size="sm"
                          showLabel={false}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Filter className="w-8 h-8 text-yellow-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Nenhuma empresa encontrada</h3>
                  <p className="text-sm text-muted-foreground">
                    Tente ajustar os filtros para encontrar mais oportunidades. Reduzir filtros ativos ou ampliar ranges pode ajudar.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 mb-8">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold">Erro na análise</h4>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Configuration Card */}
        <Card className="border-0 shadow-2xl bg-gradient-to-br from-white to-gray-50 dark:from-background dark:to-background/80">
          <CardContent className="p-8">
            <div className="space-y-8">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                    <Filter className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Configure seus Filtros</h2>
                    <p className="text-sm text-muted-foreground">
                      {activeFiltersCount > 0 
                        ? `${activeFiltersCount} filtro${activeFiltersCount > 1 ? 's' : ''} ativo${activeFiltersCount > 1 ? 's' : ''}`
                        : 'Nenhum filtro ativo - todas as empresas serão exibidas'
                      }
                    </p>
                  </div>
                </div>

                {!isLoggedIn && (
                  <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Crown className="w-5 h-5 text-violet-600" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm">Faça login para salvar</h4>
                          <p className="text-xs text-muted-foreground">
                            Salve seus screenings favoritos
                          </p>
                        </div>
                        <Button size="sm" className="bg-gradient-to-r from-violet-600 to-pink-600" asChild>
                          <Link href="/register">
                            Criar Conta
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* AI Assistant */}
              <ScreeningAIAssistant 
                onParametersGenerated={handleAIParametersGenerated}
                availableSectors={sectors}
                availableIndustries={industries}
                isLoggedIn={isLoggedIn}
                isPremium={isPremium ?? false}
              />

              {/* Configurator Component */}
              <div id="screening-configurator">
                <ScreeningConfigurator 
                  params={params} 
                  onParamsChange={setParams}
                  showTechnicalAnalysis={true}
                  isPremium={isPremium ?? false}
                  isLoggedIn={isLoggedIn}
                />
              </div>

              {/* Generate Button */}
              <div className="flex justify-center pt-4">
                <Button 
                  onClick={handleGenerateScreening} 
                  disabled={loading}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8 py-6 text-lg font-semibold shadow-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                      Processando filtros...
                    </>
                  ) : (
                    <>
                      <Search className="w-6 h-6 mr-2" />
                      Buscar Empresas
                    </>
                  )}
                </Button>
              </div>

              {/* Info Footer */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1 text-sm">
                      💡 Dica: Combine filtros para resultados precisos
                    </h4>
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      Você pode ativar múltiplos filtros simultaneamente. Apenas empresas que atendem <strong>TODOS</strong> os 
                      critérios selecionados serão exibidas. Comece com poucos filtros e vá refinando conforme necessário.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom CTA */}
        {!isLoggedIn && (
          <Card className="mt-8 border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4 w-full">
                <div className="flex items-center gap-3 min-w-0 flex-shrink w-full sm:w-auto">
                  <Crown className="w-8 h-8 text-violet-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm sm:text-base">Crie uma conta gratuita</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Salve seus screenings, crie rankings personalizados e muito mais
                    </p>
                  </div>
                </div>
                <Button size="lg" className="bg-gradient-to-r from-violet-600 to-pink-600 w-full sm:w-auto whitespace-nowrap flex-shrink-0" asChild>
                  <Link href="/register" className="flex items-center justify-center gap-2">
                    Começar Grátis
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Schema Markup para SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Screening de Ações B3 - Preço Justo AI",
              "description": "Ferramenta de screening fundamentalista com filtros customizáveis para encontrar ações na B3 e BDRs baseado em critérios de valuation, rentabilidade, crescimento e dividendos",
              "url": "https://precojusto.ai/screening-acoes",
              "applicationCategory": "FinanceApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "AggregateOffer",
                "lowPrice": "0",
                "highPrice": "39.90",
                "priceCurrency": "BRL"
              },
              "featureList": [
                "Filtros customizáveis de valuation (P/L, P/VP, EV/EBITDA)",
                "Filtros de rentabilidade (ROE, ROIC, ROA)",
                "Filtros de crescimento (CAGR)",
                "Filtros de dividendos (Dividend Yield, Payout)",
                "Filtros de endividamento",
                "Screening de ações B3 e BDRs",
                "Assistente com IA para gerar filtros",
                "Análise fundamentalista profissional"
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
                  "name": "Início",
                  "item": "https://precojusto.ai"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Screening de Ações",
                  "item": "https://precojusto.ai/screening-acoes"
                }
              ]
            })
          }}
        />
      </div>
    </div>
    </>
  )
}

export default function ScreeningAcoesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando screening...</p>
        </div>
      </div>
    }>
      <ScreeningAcoesContent />
    </Suspense>
  )
}

