"use client"

import { useState, useEffect, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScreeningConfigurator } from "@/components/screening-configurator"
import { ScreeningAIAssistant } from "@/components/screening-ai-assistant"
import { CompanyLogo } from "@/components/company-logo"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { Footer } from "@/components/footer"
import { LandingHero } from "@/components/landing/landing-hero"
import { CTASection } from "@/components/landing/cta-section"
import { FAQSection } from "@/components/landing/faq-section"
import { FeatureCard } from "@/components/landing/feature-card"
import { Breadcrumbs } from "@/components/landing/breadcrumbs"
import { SCREENING_PRESETS, getAllPresetSlugs } from "@/lib/screening-presets"
import { 
  Search, 
  Loader2, 
  TrendingUp, 
  Building2, 
  Target,
  Crown,
  Brain,
  Zap,
  CheckCircle,
  User,
  DollarSign,
  Shield,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowRight
} from "lucide-react"
import Link from "next/link"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { signIn } from "next-auth/react"

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
  fairValueModel?: string | null;
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
    // Não definir limit aqui - o backend sempre aplica o limite correto baseado no status Premium
    companySize: 'all',
    useTechnicalAnalysis: true,
    assetTypeFilter
  })
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<RankingResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sectors, setSectors] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [anonymousScreeningsCount, setAnonymousScreeningsCount] = useState(0)

  const isLoggedIn = !!session
  const MAX_ANONYMOUS_SCREENINGS = 2

  // Carregar contador de screenings anônimos do localStorage
  useEffect(() => {
    if (!isLoggedIn && typeof window !== 'undefined') {
      const count = parseInt(localStorage.getItem('anonymousScreeningsCount') || '0', 10)
      setAnonymousScreeningsCount(count)
      
      // Se já atingiu o limite, mostrar modal após um pequeno delay para garantir renderização
      if (count >= MAX_ANONYMOUS_SCREENINGS) {
        setTimeout(() => {
          setShowRegisterModal(true)
        }, 100)
      }
    } else if (isLoggedIn) {
      // Se logou, limpar o contador
      if (typeof window !== 'undefined') {
        localStorage.removeItem('anonymousScreeningsCount')
      }
      setAnonymousScreeningsCount(0)
      setShowRegisterModal(false)
    }
  }, [isLoggedIn])

  useEffect(() => {
    // Carregar setores e indústrias
    const fetchSectors = async () => {
      try {
        const response = await fetch('/api/sectors')
        if (response.ok) {
          const data = await response.json()
          setSectors(data.sectors || [])
          setIndustries(data.industries || [])
        }
      } catch (err) {
        console.error('Erro ao carregar setores:', err)
      }
    }
    fetchSectors()
  }, [])

  const handleAIParametersGenerated = (generatedParams: ScreeningParams) => {
    setParams(generatedParams)
  }

  const handleGenerateScreening = async () => {
    // Verificar se usuário anônimo já atingiu o limite
    if (!isLoggedIn && anonymousScreeningsCount >= MAX_ANONYMOUS_SCREENINGS) {
      // Usar setTimeout para garantir que o estado seja atualizado antes de mostrar o modal
    setTimeout(() => {
        setShowRegisterModal(true)
      }, 0)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Remover limit do params - backend sempre controla o limite baseado no status Premium
      const { limit, ...paramsWithoutLimit } = params;
      
      const response = await fetch("/api/rank-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: 'screening',
          params: {
            ...paramsWithoutLimit,
            includeBDRs: assetType === 'both' || assetType === 'bdr',
            assetTypeFilter: assetType
            // limit não é enviado - backend sempre aplica o limite correto
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: RankingResponse = await response.json()
      setResults(data)
      
      // Incrementar contador de screenings anônimos após sucesso
      if (!isLoggedIn && typeof window !== 'undefined') {
        const newCount = anonymousScreeningsCount + 1
        setAnonymousScreeningsCount(newCount)
        localStorage.setItem('anonymousScreeningsCount', newCount.toString())
        
        // Se atingiu o limite, mostrar modal
        if (newCount >= MAX_ANONYMOUS_SCREENINGS) {
          setShowRegisterModal(true)
        }
      }
      
      // Scroll até a tabela de resultados após um pequeno delay para garantir que foi renderizada
      setTimeout(() => {
        const resultsSection = document.getElementById('results-section')
        if (resultsSection) {
          // Scroll suave até a seção de resultados
          resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
          // Fallback: tentar novamente após mais tempo se não encontrou
          setTimeout(() => {
            const retrySection = document.getElementById('results-section')
            if (retrySection) {
              retrySection.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }, 500)
        }
      }, 300)
      
      setCurrentPage(1) // Resetar página ao gerar novos resultados
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
    
    return translations[key] || key;
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const getSortedResults = (): RankingResult[] => {
    if (!results) return []
    
    let sortedResults = [...results.results]
    
    // Aplicar ordenação se houver
    if (sortColumn) {
      sortedResults = sortedResults.sort((a, b) => {
        let aValue: any
        let bValue: any

        switch (sortColumn) {
          case 'ticker':
            aValue = a.ticker
            bValue = b.ticker
            break
          case 'name':
            aValue = a.name
            bValue = b.name
            break
          case 'currentPrice':
            aValue = a.currentPrice ?? 0
            bValue = b.currentPrice ?? 0
            break
          case 'fairValue':
            aValue = a.fairValue ?? 0
            bValue = b.fairValue ?? 0
            break
          case 'upside':
            aValue = a.upside ?? 0
            bValue = b.upside ?? 0
            break
          default:
            // Métricas do key_metrics
            aValue = a.key_metrics?.[sortColumn] ?? 0
            bValue = b.key_metrics?.[sortColumn] ?? 0
            break
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue)
        }

        const numA = Number(aValue) || 0
        const numB = Number(bValue) || 0

        return sortDirection === 'asc' ? numA - numB : numB - numA
      })
    }
    
    return sortedResults
  }

  const getPaginatedResults = (): RankingResult[] => {
    const sortedResults = getSortedResults()
    
    // Se não for premium, não paginar (mostrar todos os 3 resultados)
    if (!isPremium) {
      return sortedResults
    }
    
    // Paginação para premium
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return sortedResults.slice(startIndex, endIndex)
  }

  const totalPages = isPremium 
    ? Math.ceil((results?.results.length || 0) / itemsPerPage)
    : 1

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 ml-1 inline" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1 inline" />
      : <ArrowDown className="w-4 h-4 ml-1 inline" />
  }

  // Se usuário está logado, mostrar Hero + ferramenta diretamente
  if (isLoggedIn) {
  return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background">
        {/* Breadcrumbs */}
        <div className="container mx-auto px-4 pt-6">
          <Breadcrumbs items={[
            { label: "Ferramentas", href: "/ranking" },
            { label: "Screening de Ações" }
          ]} />
          </div>
          
        {/* Hero Section Compacto para usuários logados */}
        <div className="relative overflow-hidden w-full bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-blue-950/20 dark:via-background dark:to-violet-950/20 pt-6 pb-8">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]"></div>
          
          <div className="relative text-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
              Screening de{" "}
              <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                Ações B3
              </span>
            </h1>
            
            {/* Subheadline */}
            <div className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 max-w-3xl mx-auto leading-relaxed">
              Use <strong>filtros customizáveis</strong> para encontrar ações que atendem seus critérios exatos.
            </div>

            {/* CTA Button - Scroll to Configurator */}
            <div className="flex justify-center">
              <Button 
                size="lg" 
                onClick={() => {
                  const configurator = document.getElementById('screening-configurator')
                  if (configurator) {
                    configurator.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }}
                className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-base px-6 py-3 shadow-xl hover:shadow-2xl transition-all"
              >
                <Search className="w-5 h-5 mr-2" />
                Configurar Filtros
                <ArrowDown className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Atalhos Rápidos para Presets - Versão Discreta para Logados */}
        <section className="py-6 bg-white dark:bg-background border-b">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Estratégias Rápidas:</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {getAllPresetSlugs().map((slug) => {
                const preset = SCREENING_PRESETS[slug]
                return (
                  <Link
                    key={slug}
                    href={`/screening-acoes/${slug}`}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {preset.title.replace(/^[^\s]+\s/, '')} {/* Remove emoji */}
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* Screening Tool */}
        <section className="py-8 bg-white dark:bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
            <Card className="border-0 shadow-xl">
              <CardContent className="p-6">
                {/* AI Assistant */}
                {isPremium && (
                  <ScreeningAIAssistant 
                    onParametersGenerated={handleAIParametersGenerated}
                    availableSectors={sectors}
                    availableIndustries={industries}
                    isLoggedIn={isLoggedIn}
                    isPremium={isPremium}
                  />
                )}

                {/* Configurator */}
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
                <div className="flex justify-center pt-6">
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
              
                {error && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-800 dark:text-red-200">{error}</p>
              </div>
                )}
              </CardContent>
            </Card>
            </div>
        </section>

        {/* Results Section */}
        {results && (
          <section id="results-section" className="py-16 bg-white dark:bg-background">
            <div className="container mx-auto px-4 max-w-7xl">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">
                  Resultados ({results.count} empresas encontradas)
                </h2>
                {results.rational && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <MarkdownRenderer content={results.rational} />
          </div>
                )}
        </div>

              {/* Results Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th 
                        className="p-3 text-left cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none"
                        onClick={() => handleSort('ticker')}
                      >
                        <div className="flex items-center">
                          Empresa
                          <SortIcon column="ticker" />
                        </div>
                      </th>
                      <th 
                        className="p-3 text-right cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none"
                        onClick={() => handleSort('currentPrice')}
                      >
                        <div className="flex items-center justify-end">
                          Preço
                          <SortIcon column="currentPrice" />
                        </div>
                      </th>
                      <th 
                        className="p-3 text-right cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none"
                        onClick={() => handleSort('fairValue')}
                      >
                        <div className="flex items-center justify-end">
                          Preço Justo
                          {results.results[0]?.fairValueModel && (
                            <span className="text-xs ml-1 text-muted-foreground">({results.results[0].fairValueModel})</span>
                          )}
                          <SortIcon column="fairValue" />
                        </div>
                      </th>
                      <th 
                        className="p-3 text-right cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none"
                        onClick={() => handleSort('upside')}
                      >
                        <div className="flex items-center justify-end">
                          Potencial
                          <SortIcon column="upside" />
                        </div>
                      </th>
                      {results.results[0]?.key_metrics && Object.keys(results.results[0].key_metrics).map(key => (
                        <th 
                          key={key} 
                          className="p-3 text-right cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none"
                          onClick={() => handleSort(key)}
                        >
                          <div className="flex items-center justify-end">
                            {translateMetricName(key)}
                            <SortIcon column={key} />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getPaginatedResults().map((result, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="p-3">
                          <Link href={`/acao/${result.ticker}`} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                            <CompanyLogo ticker={result.ticker} logoUrl={result.logoUrl} size={32} companyName={result.name} />
                            <div>
                              <div className="font-semibold">{result.ticker}</div>
                              <div className="text-sm text-muted-foreground">{result.name}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="p-3 text-right">{formatCurrency(result.currentPrice)}</td>
                        <td className="p-3 text-right">
                          <div className="flex flex-col items-end">
                            <span>{formatCurrency(result.fairValue)}</span>
                            {result.fairValueModel && (
                              <span className="text-xs text-muted-foreground">({result.fairValueModel})</span>
                            )}
                          </div>
                        </td>
                        <td className={`p-3 text-right font-semibold ${result.upside && result.upside > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {result.upside ? `${result.upside.toFixed(1)}%` : 'N/A'}
                        </td>
                        {result.key_metrics && Object.entries(result.key_metrics).map(([key, value]) => (
                          <td key={key} className="p-3 text-right">
                            {formatMetricValue(key, value as number)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {isPremium && totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="min-w-[40px]"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                  </Button>
                  
                  <span className="text-sm text-muted-foreground ml-4">
                    Página {currentPage} de {totalPages}
                  </span>
                </div>
              )}
            </div>
          </section>
                            )}
        
        {/* Modal de Registro para Usuários Anônimos */}
        <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full mx-auto mb-4">
                <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
              <DialogTitle className="text-center text-xl">
                Crie sua Conta para Continuar
              </DialogTitle>
              <DialogDescription className="text-center text-base">
                Você já realizou {MAX_ANONYMOUS_SCREENINGS} screenings gratuitos. Crie sua conta gratuita para continuar usando o screening ilimitado.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-6">
              <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-800 dark:text-green-200">
                  Screening ilimitado
            </span>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-800 dark:text-green-200">
                  Histórico de screenings salvos
                </span>
        </div>

              {!isPremium && (
                <div className="flex items-center space-x-3 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
                  <Crown className="w-5 h-5 text-violet-600" />
                  <span className="text-sm text-violet-800 dark:text-violet-200">
                    Upgrade para Premium e desbloqueie todos os filtros avançados
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col space-y-3">
                  <Button
                onClick={() => {
                  window.location.href = '/register?redirect=' + encodeURIComponent(window.location.pathname)
                }}
                className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <User className="w-4 h-4" />
                <span>Criar Conta Gratuita</span>
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={() => signIn()}
                className="w-full text-sm"
              >
                Já tenho conta - Entrar
                  </Button>
                </div>
          </DialogContent>
        </Dialog>
                          </div>
    )
  }

  // Landing Page para usuários não logados
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background">
      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 pt-6">
        <Breadcrumbs items={[
          { label: "Ferramentas", href: "/ranking" },
          { label: "Screening de Ações" }
        ]} />
                    </div>
                        
      {/* Hero Section */}
      <LandingHero
        headline={
          <>
            Encontre Ações{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Específicas na B3
            </span>{" "}
            com Filtros Avançados
          </>
        }
        subheadline={
          <>
            Use <strong>filtros customizáveis</strong> para encontrar ações que atendem seus critérios exatos. 
            Busque por <strong>P/L, ROE, Dividend Yield, crescimento</strong> e mais de <strong>15 indicadores</strong>. 
            <strong> Assistente de IA</strong> ajuda a criar filtros personalizados automaticamente.
          </>
        }
        badge={{
          text: "Ferramenta 100% Gratuita",
          iconName: "Sparkles"
        }}
        socialProof={[
          { iconName: "Filter", text: "+15 filtros disponíveis" },
          { iconName: "Brain", text: "Assistente IA Premium" },
          { iconName: "Building2", text: "B3 + BDRs" }
        ]}
        primaryCTA={{
          text: "Começar Screening Gratuito",
          href: "#screening-tool",
          iconName: "Search"
        }}
        secondaryCTA={{
          text: "Ver Demonstração",
          href: "#como-funciona"
        }}
        showQuickAccess={true}
      />

      {/* Value Proposition */}
      <section className="py-16 sm:py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Por que usar{" "}
              <span className="text-blue-600">Screening de Ações?</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Encontre ações que atendem critérios específicos em segundos, sem precisar analisar centenas de empresas manualmente.
                      </p>
                    </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon={<Target className="w-6 h-6 text-white" />}
              title="Filtros Precisos"
              description="Encontre ações com P/L < 10, ROE > 15%, Dividend Yield > 6% e muito mais. Combine múltiplos filtros para resultados exatos."
              iconBgClass="bg-blue-600"
            />
            <FeatureCard
              icon={<Brain className="w-6 h-6 text-white" />}
              title="Assistente de IA"
              description="Não sabe quais filtros usar? Nossa IA Premium sugere filtros personalizados baseados em seus objetivos de investimento."
              isPremium={true}
              badge={{ text: "Premium", className: "bg-violet-600 text-white" }}
              iconBgClass="bg-violet-600"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6 text-white" />}
              title="Resultados Instantâneos"
              description="Busque em +350 empresas da B3 e BDRs em segundos. Veja indicadores completos e compare empresas lado a lado."
              iconBgClass="bg-green-600"
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
              <span className="text-blue-600">Funciona</span>
            </h2>
                        </div>
                        
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
                          </div>
              <h3 className="text-xl font-bold mb-2">Configure Filtros</h3>
              <p className="text-muted-foreground">
                Selecione os critérios desejados: valuation, rentabilidade, crescimento, dividendos ou endividamento.
              </p>
                            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-violet-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
                        </div>
              <h3 className="text-xl font-bold mb-2">Busque Empresas</h3>
              <p className="text-muted-foreground">
                Nossa plataforma analisa +350 empresas da B3 e BDRs em segundos, retornando apenas as que atendem seus critérios.
                                </p>
                      </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
                        </div>
              <h3 className="text-xl font-bold mb-2">Analise Resultados</h3>
              <p className="text-muted-foreground">
                Veja indicadores completos, compare empresas e exporte resultados para análise detalhada.
                                </p>
                              </div>
                        </div>
        </div>
      </section>

      {/* Estratégias Pré-Configuradas - Versão Prominente para Deslogados */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-blue-50/50 to-white dark:from-blue-950/10 dark:to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Estratégias{" "}
              <span className="text-blue-600">Pré-Configuradas</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Comece rapidamente com estratégias testadas e comprovadas. Clique em qualquer estratégia para ver os resultados instantaneamente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {getAllPresetSlugs().map((slug) => {
              const preset = SCREENING_PRESETS[slug]
              return (
                <Link
                  key={slug}
                  href={`/screening-acoes/${slug}`}
                  className="group"
                >
                  <Card className="border-0 shadow-lg hover:shadow-xl transition-all h-full hover:scale-105">
                    <CardContent className="p-6">
                      <div className="text-3xl mb-3">{preset.title.split(' ')[0]}</div>
                      <h3 className="text-xl font-bold mb-2 group-hover:text-blue-600 transition-colors">
                        {preset.title.replace(/^[^\s]+\s/, '')}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {preset.description}
                      </p>
                      <div className="flex items-center text-blue-600 font-semibold text-sm group-hover:underline">
                        Ver resultados
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 sm:py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Casos de{" "}
              <span className="text-blue-600">Uso Populares</span>
            </h2>
                      </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                  <h3 className="text-xl font-bold">Ações em Crescimento</h3>
                      </div>
                <p className="text-muted-foreground mb-4">
                  Encontre empresas com crescimento sustentável:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    CAGR Lucros 5 anos &gt; 10%
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    ROE &gt; 15%
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    P/L &lt; 20
                  </li>
                </ul>
                    </CardContent>
                  </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <DollarSign className="w-8 h-8 text-green-600" />
                  <h3 className="text-xl font-bold">Renda Passiva</h3>
              </div>
                <p className="text-muted-foreground mb-4">
                  Ações pagadoras de dividendos sustentáveis:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Dividend Yield &gt; 6%
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Payout Ratio &lt; 80%
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Dívida Líquida/PL &lt; 100%
                  </li>
                </ul>
                </CardContent>
              </Card>

            <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-8 h-8 text-purple-600" />
                  <h3 className="text-xl font-bold">Value Investing</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Ações subvalorizadas com fundamentos sólidos:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    P/L &lt; 15
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    P/VP &lt; 1.5
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    ROE &gt; 12%
                  </li>
                </ul>
            </CardContent>
          </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Building2 className="w-8 h-8 text-orange-600" />
                  <h3 className="text-xl font-bold">Blue Chips</h3>
                  </div>
                <p className="text-muted-foreground mb-4">
                  Grandes empresas com estabilidade:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Market Cap &gt; R$ 10 Bi
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Liquidez Corrente &gt; 1.2
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Margem Líquida &gt; 5%
                  </li>
                </ul>
              </CardContent>
            </Card>
                  </div>
                </div>
      </section>

      {/* Screening Tool */}
      <section id="screening-tool" className="py-16 sm:py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Experimente o{" "}
              <span className="text-blue-600">Screening</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Configure seus filtros e encontre ações que atendem seus critérios
            </p>
              </div>

          <Card className="border-0 shadow-xl">
            <CardContent className="p-6">
              {/* AI Assistant */}
              {isPremium && (
              <ScreeningAIAssistant 
                onParametersGenerated={handleAIParametersGenerated}
                availableSectors={sectors}
                availableIndustries={industries}
                isLoggedIn={isLoggedIn}
                  isPremium={isPremium}
              />
              )}

              {/* Configurator */}
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
              <div className="flex justify-center pt-6">
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

              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Results Section */}
      {results && (
        <section id="results-section" className="py-16 bg-white dark:bg-background">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">
                Resultados ({results.count} empresas encontradas)
              </h2>
              {results.rational && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <MarkdownRenderer content={results.rational} />
                </div>
              )}
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th 
                      className="p-3 text-left cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none"
                      onClick={() => handleSort('ticker')}
                    >
                      Empresa <SortIcon column="ticker" />
                    </th>
                    <th 
                      className="p-3 text-right cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none"
                      onClick={() => handleSort('currentPrice')}
                    >
                      Preço <SortIcon column="currentPrice" />
                    </th>
                    <th 
                      className="p-3 text-right cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none"
                      onClick={() => handleSort('fairValue')}
                    >
                      Preço Justo <SortIcon column="fairValue" />
                    </th>
                    <th 
                      className="p-3 text-right cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none"
                      onClick={() => handleSort('upside')}
                    >
                      Potencial <SortIcon column="upside" />
                    </th>
                    {results.results[0]?.key_metrics && Object.keys(results.results[0].key_metrics).map(key => (
                      <th 
                        key={key} 
                        className="p-3 text-right cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none"
                        onClick={() => handleSort(key)}
                      >
                        {translateMetricName(key)} <SortIcon column={key} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getPaginatedResults().map((result, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3">
                        <Link href={`/acao/${result.ticker}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                          <CompanyLogo ticker={result.ticker} logoUrl={result.logoUrl} size={32} companyName={result.name} />
                  <div>
                            <div className="font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{result.ticker}</div>
                            <div className="text-sm text-muted-foreground">{result.name}</div>
                  </div>
                        </Link>
                      </td>
                      <td className="p-3 text-right">{formatCurrency(result.currentPrice)}</td>
                      <td className="p-3 text-right">
                        <div className="flex flex-col items-end">
                          <span>{formatCurrency(result.fairValue)}</span>
                          {result.fairValueModel && (
                            <span className="text-xs text-muted-foreground">({result.fairValueModel})</span>
                          )}
                </div>
                      </td>
                      <td className={`p-3 text-right font-semibold ${result.upside && result.upside > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {result.upside ? `${result.upside.toFixed(1)}%` : 'N/A'}
                      </td>
                      {result.key_metrics && Object.entries(result.key_metrics).map(([key, value]) => (
                        <td key={key} className="p-3 text-right">
                          {formatMetricValue(key, value as number)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

            {/* Pagination - Apenas para Premium */}
            {isPremium && results.results.length > itemsPerPage && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, results.results.length)} de {results.results.length} resultados
            </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="min-w-[40px]"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                </Button>
                </div>
              </div>
            )}

            {/* Mensagem para usuários gratuitos sobre limite */}
            {!isPremium && results.results.length >= 3 && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <Crown className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                      Upgrade para Premium e veja todos os resultados
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                      Você está vendo apenas 3 resultados. Com Premium, veja todos os resultados encontrados e tenha acesso ao Assistente de IA.
                    </p>
                    <Link href="/planos">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        Ver Planos Premium
                </Button>
                    </Link>
              </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <FAQSection
        title="Perguntas Frequentes sobre Screening"
        description="Tire suas dúvidas sobre nossa ferramenta de screening de ações"
        faqs={[
          {
            question: "Quantos filtros posso usar simultaneamente?",
            answer: "Você pode usar quantos filtros quiser! A ferramenta retorna apenas empresas que atendem TODOS os critérios selecionados. Recomendamos começar com poucos filtros e ir refinando conforme necessário.",
            iconName: "Filter"
          },
          {
            question: "O screening é gratuito?",
            answer: "Sim! A ferramenta básica de screening é 100% gratuita e mostra até 3 resultados. Usuários Premium têm acesso ao Assistente de IA que sugere filtros personalizados automaticamente e podem ver todos os resultados encontrados sem limite.",
            iconName: "DollarSign"
          },
          {
            question: "Posso salvar meus screenings favoritos?",
            answer: "Sim! Usuários Premium podem salvar screenings favoritos para reutilizar depois. Isso economiza tempo ao buscar ações com critérios similares.",
            iconName: "Crown"
          },
          {
            question: "Quais indicadores estão disponíveis?",
            answer: "Temos mais de 15 indicadores: P/L, P/VP, EV/EBITDA, ROE, ROIC, ROA, margem líquida, margem EBITDA, CAGR de lucros/receitas, Dividend Yield, Payout Ratio, endividamento, liquidez corrente e market cap.",
            iconName: "BarChart3"
          },
          {
            question: "Posso filtrar por setor ou indústria?",
            answer: "Sim! Você pode filtrar por tamanho de empresa (small caps, mid caps, blue chips) e também por setor e indústria específicos. Isso ajuda a encontrar oportunidades dentro de segmentos específicos.",
            iconName: "Building2"
          },
          {
            question: "Os dados são atualizados?",
            answer: "Sim! Nossos dados são atualizados regularmente com base nas informações mais recentes da B3 e dos balanços financeiros das empresas. Trabalhamos para garantir que você sempre tenha acesso aos números mais atuais.",
            iconName: "RefreshCw"
          }
        ]}
      />

      {/* Final CTA */}
      <CTASection
        title="Pronto para Encontrar Suas Ações Ideais?"
        description="Use nosso screening gratuito e descubra ações que atendem seus critérios exatos em segundos."
        primaryCTA={{
          text: "Começar Screening Gratuito",
          href: "#screening-tool",
          iconName: "Search"
        }}
        secondaryCTA={{
          text: "Ver Todos os Rankings",
          href: "/ranking"
        }}
        variant="gradient"
        benefits={[
          "100% Gratuito",
          "Sem cadastro necessário",
          "Resultados instantâneos",
          "+350 empresas B3"
        ]}
      />

      <Footer />
      
      {/* Modal de Registro para Usuários Anônimos */}
      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full mx-auto mb-4">
              <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <DialogTitle className="text-center text-xl">
              Crie sua Conta para Continuar
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              Você já realizou {MAX_ANONYMOUS_SCREENINGS} screenings gratuitos. Crie sua conta gratuita para continuar usando o screening ilimitado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-6">
            <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-800 dark:text-green-200">
                Screening ilimitado
              </span>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-800 dark:text-green-200">
                Histórico de screenings salvos
              </span>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
              <Crown className="w-5 h-5 text-violet-600" />
              <span className="text-sm text-violet-800 dark:text-violet-200">
                Upgrade para Premium e desbloqueie todos os filtros avançados
              </span>
            </div>
          </div>

          <div className="flex flex-col space-y-3">
            <Button 
              onClick={() => {
                window.location.href = '/register?redirect=' + encodeURIComponent(window.location.pathname)
              }}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <User className="w-4 h-4" />
              <span>Criar Conta Gratuita</span>
            </Button>
            
            <Button 
              variant="ghost" 
              onClick={() => signIn()}
              className="w-full text-sm"
            >
              Já tenho conta - Entrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ScreeningAcoesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <ScreeningAcoesContent />
    </Suspense>
  )
}
