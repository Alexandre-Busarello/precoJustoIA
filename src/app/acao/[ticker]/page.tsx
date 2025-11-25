import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { CompanyLogo } from '@/components/company-logo'
import { CompanySizeBadge } from '@/components/company-size-badge'
import StrategicAnalysisClient from '@/components/strategic-analysis-client'
import HeaderScoreWrapper from '@/components/header-score-wrapper'
import { PageCacheIndicator } from '@/components/page-cache-indicator'
import AIAnalysisDual from '@/components/ai-analysis-dual'
import FinancialIndicators from '@/components/financial-indicators'
import ComprehensiveFinancialView from '@/components/comprehensive-financial-view'
import TechnicalAnalysisLink from '@/components/technical-analysis-link'
import MarketSentimentSection from '@/components/market-sentiment-section'
import { AddToBacktestButton } from '@/components/add-to-backtest-button'
import AssetSubscriptionButton from '@/components/asset-subscription-button'
import { AutoSubscribeHandler } from '@/components/auto-subscribe-handler'
import { RelatedCompanies } from '@/components/related-companies'
import { Footer } from '@/components/footer'
import { TrackingAssetView } from '@/components/tracking-asset-view'
import { getComprehensiveFinancialData } from '@/lib/financial-data-service'
import { cache } from '@/lib/cache-service'
import { getSectorCompetitors, getMixedRelatedCompanies } from '@/lib/competitor-service'
import { DividendRadarCompact } from '@/components/dividend-radar-compact'
import { DividendService } from '@/lib/dividend-service'
import { DividendRadarService } from '@/lib/dividend-radar-service'
import Link from 'next/link'

// Shadcn UI Components
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

// Lucide Icons
import {
  Building2,
  PieChart,
  Eye,
  User,
  GitCompare,
  ChevronDown,
  Info,
  FileText,
  Calculator,
  TrendingUp,
  ArrowRight
} from 'lucide-react'

interface PageProps {
  params: {
    ticker: string
  }
}

// Cache para metadata
const METADATA_CACHE_TTL = 60 * 60 // 60 minutos em segundos

// Componente IndicatorCard definido abaixo (após os componentes inline)

// Tipo para valores do Prisma que podem ser Decimal
type PrismaDecimal = { toNumber: () => number } | number | string | null | undefined

// Função para converter Decimal para number
function toNumber(value: PrismaDecimal | Date | string | null): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value)
  if (value instanceof Date) return value.getTime()
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber()
  }
  return parseFloat(String(value))
}

// Funções de formatação
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'N/A'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}






// Gerar metadata dinâmico para SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const tickerParam = resolvedParams.ticker // Manter ticker original da URL
  const ticker = tickerParam.toUpperCase() // Converter para maiúsculo apenas para consulta no BD
  
  // Verificar cache primeiro
  const cacheKey = `metadata-${ticker}`
  const cached = await cache.get<any>(cacheKey, {
    prefix: 'companies',
    ttl: METADATA_CACHE_TTL
  })
  
  if (cached) {
    return cached
  }
  
  try {
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        name: true,
        sector: true,
        description: true,
        logoUrl: true,
        website: true,
        city: true,
        state: true,
        fullTimeEmployees: true,
        industry: true,
        address: true,
        financialData: {
          select: {
            pl: true,
            roe: true,
            marketCap: true,
            receitaTotal: true,
            updatedAt: true
          },
          orderBy: { year: 'desc' },
          take: 1
        },
        dailyQuotes: {
          select: {
            price: true
          },
          orderBy: { date: 'desc' },
          take: 1
        }
      }
    })

    if (!company) {
      return {
        title: `${ticker} - Ticker Não Encontrado | Análise Fácil`,
        description: `O ticker ${ticker} não foi encontrado em nossa base de dados de análise de ações.`
      }
    }

    const latestFinancials = company.financialData[0]
    const currentPrice = toNumber(company.dailyQuotes[0]?.price) || 0
    
    const title = `${ticker} - ${company.name} | Análise Completa - Preço Justo AI`
    
    // Incluir descrição da empresa no SEO quando disponível
    const baseDescription = `Análise fundamentalista completa da ação ${company.name} (${ticker}). Preço atual R$ ${currentPrice.toFixed(2)}, P/L: ${latestFinancials?.pl ? toNumber(latestFinancials.pl)?.toFixed(1) : 'N/A'}, ROE: ${latestFinancials?.roe ? (toNumber(latestFinancials.roe)! * 100).toFixed(1) + '%' : 'N/A'}. Setor ${company.sector || 'N/A'}.`
    
    const companyInfo = company.description 
      ? ` ${company.description.substring(0, 100)}...` 
      : ''
    
    const description = `${baseDescription}${companyInfo} Análise com IA, indicadores financeiros e estratégias de investimento.`

    const metadata = {
      title,
      description,
      keywords: `${ticker}, ${company.name}, análise fundamentalista, ação ${ticker}, ações, B3, bovespa, investimentos, ${company.sector}, análise de ações, valuation, indicadores financeiros`,
      openGraph: {
        title,
        description,
        type: 'article',
        url: `/acao/${tickerParam.toLowerCase()}`,
        siteName: 'Preço Justo AI',
        images: company.logoUrl ? [{ 
          url: company.logoUrl, 
          alt: `Logo ${company.name}`,
          width: 400,
          height: 400
        }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: company.logoUrl ? [company.logoUrl] : undefined,
        creator: '@PrecoJustoAI',
        site: '@PrecoJustoAI'
      },
      alternates: {
        canonical: `/acao/${tickerParam.toLowerCase()}`,
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large' as const,
          'max-snippet': -1,
        },
      },
      other: {
        'article:section': 'Análise de Ações',
        'article:tag': `${ticker}, ${company.name}, ${company.sector}, análise fundamentalista`,
        'article:author': 'Preço Justo AI',
        'article:publisher': 'Preço Justo AI',
      }
    }

    // Armazenar no cache
    await cache.set(cacheKey, metadata, {
      prefix: 'companies',
      ttl: METADATA_CACHE_TTL
    })

    return metadata
  } catch {
    return {
      title: `${ticker} - Análise de Ação | Preço Justo AI`,
      description: `Análise fundamentalista completa da ação ${ticker} com indicadores financeiros, valuation e estratégias de investimento. Descubra se ${ticker} está subvalorizada ou sobrevalorizada.`,
      alternates: {
        canonical: `/acao/${tickerParam.toLowerCase()}`,
      }
    }
  }
}

export default async function TickerPage({ params }: PageProps) {
  const resolvedParams = await params
  const tickerParam = resolvedParams.ticker // Manter ticker original da URL
  const ticker = tickerParam.toUpperCase() // Converter para maiúsculo apenas para consulta no BD

  // Verificar sessão do usuário para recursos premium
  const session = await getServerSession(authOptions)
  let userIsPremium = false

  // Verificar se é Premium - ÚNICA FONTE DA VERDADE
  if (session?.user?.id) {
    const user = await getCurrentUser()
    userIsPremium = user?.isPremium || false
  }

  // Processar dividendos e projeções sob demanda (em background, não bloqueia página)
  // IMPORTANTE: Carregar dividendos PRIMEIRO, depois gerar projeções
  // Isso garante que novos dividendos sejam detectados antes de gerar/reprocessar projeções
  (async () => {
    try {
      // 1. Carregar dividendos atualizados primeiro
      await DividendService.fetchAndSaveDividends(ticker);
      
      // 2. Depois gerar/reprocessar projeções (detecta novos dividendos automaticamente)
      await DividendRadarService.getOrGenerateProjections(ticker);
    } catch (error) {
      console.error(`[${ticker}] Erro ao processar dividendos/projeções sob demanda:`, error);
      // Ignorar erros silenciosamente - não bloquear carregamento da página
    }
  })();

  // Buscar dados da empresa e dados financeiros completos em paralelo (incluindo dados históricos)
  const [companyData, comprehensiveData, reportsCount, youtubeAnalysis] = await Promise.all([
    prisma.company.findUnique({
      where: { ticker },
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 8 // Dados atuais + até 7 anos históricos para médias
        },
        dailyQuotes: {
          orderBy: { date: 'desc' },
          take: 1
        }
      }
    }),
    getComprehensiveFinancialData(ticker, 'YEARLY', 7),
    // Contar todos os relatórios (mensais e mudanças fundamentais)
    prisma.aIReport.count({
      where: {
        company: {
          ticker: ticker
        },
        status: 'COMPLETED'
      }
    }),
    // Buscar análise do YouTube
    prisma.youTubeAnalysis.findFirst({
      where: {
        company: {
          ticker: ticker
        },
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        score: true,
        summary: true,
        positivePoints: true,
        negativePoints: true,
        updatedAt: true
      }
    })
  ])


  if (!companyData) {
    notFound()
  }

  // Verificar se é realmente uma ação (STOCK), senão fazer redirect 301 para a URL correta
  if (companyData.assetType !== 'STOCK') {
    const correctPath = companyData.assetType === 'FII' ? `/fii/${tickerParam.toLowerCase()}` :
                       companyData.assetType === 'BDR' ? `/bdr/${tickerParam.toLowerCase()}` :
                       companyData.assetType === 'ETF' ? `/etf/${tickerParam.toLowerCase()}` :
                       `/acao/${tickerParam.toLowerCase()}` // fallback para STOCK
    redirect(correctPath)
  }

  const latestFinancials = companyData.financialData[0]
  const latestQuote = companyData.dailyQuotes[0]
  const currentPrice = toNumber(latestQuote?.price) || toNumber(latestFinancials?.lpa) || 0

  // Buscar concorrentes inteligentes para comparador premium
  const currentMarketCap = toNumber(latestFinancials?.marketCap)
  const competitors = companyData.sector 
    ? await getSectorCompetitors({
        currentTicker: ticker,
        sector: companyData.sector,
        industry: companyData.industry,
        currentMarketCap,
        limit: 5,
        assetType: 'STOCK'
      })
    : []
  
  // Buscar empresas relacionadas mesclando inteligentes + básicas para SEO
  const relatedCompanies = companyData.sector 
    ? await getMixedRelatedCompanies(ticker, companyData.sector, competitors, 6, 'STOCK')
    : []
  
  
  // Criar URL do comparador inteligente
  const smartComparatorUrl = competitors.length > 0 
    ? `/compara-acoes/${ticker}/${competitors.map(c => c.ticker).join('/')}`
    : null

  // As análises estratégicas agora são feitas no componente cliente

  // Converter dados financeiros para números (evitar erro Decimal do Prisma)
  const serializedFinancials = latestFinancials ? Object.fromEntries(
    Object.entries(latestFinancials).map(([key, value]) => [
      key,
      // Converter Decimals para números, manter Dates e outros tipos
      value && typeof value === 'object' && 'toNumber' in value 
        ? value.toNumber() 
        : value
    ])
   
  ) as any : null

  // Converter dados da análise do YouTube
  const serializedYoutubeAnalysis = youtubeAnalysis ? {
    score: toNumber(youtubeAnalysis.score) || 0,
    summary: youtubeAnalysis.summary,
    positivePoints: youtubeAnalysis.positivePoints as string[] | null,
    negativePoints: youtubeAnalysis.negativePoints as string[] | null,
    updatedAt: youtubeAnalysis.updatedAt
  } : null

  return (
    <>
      <TrackingAssetView ticker={ticker} assetType={companyData.assetType} />

      <div className="container mx-auto py-8 px-4">
        {/* Layout Responsivo: 2 Cards Separados */}
        <div className="mb-8">
          {/* Desktop: Cards lado a lado (a partir de 1024px) */}
          <div className="lg:flex lg:space-x-6 space-y-6 lg:space-y-0">
            
            {/* Card do Header da Empresa */}
            <Card className="flex-1">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start space-y-4 sm:space-y-0 sm:space-x-4 lg:space-x-6">
                  {/* Logo da empresa com fallback */}
                  <div className="flex-shrink-0 self-center sm:self-start">
                    <CompanyLogo
                      logoUrl={companyData.logoUrl}
                      companyName={companyData.name}
                      ticker={ticker}
                      size={80}
                    />
                  </div>

                  {/* Informações básicas */}
                  <div className="flex-1 min-w-0">
                    {/* Header: Ticker + Preço (Responsivo) */}
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-3">
                      {/* Ticker e Setor */}
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-3 lg:mb-0">
                        <h1 className="text-2xl sm:text-3xl font-bold truncate">{ticker}</h1>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-sm w-fit">
                            {companyData.sector || 'N/A'}
                          </Badge>
                          <CompanySizeBadge 
                            marketCap={toNumber(latestFinancials?.marketCap)} 
                            size="md"
                          />
                        </div>
                      </div>
                      
                      {/* Preço - Mobile: abaixo do ticker, Desktop: ao lado direito */}
                      <div className="lg:text-right lg:flex-shrink-0">
                        <p className="text-sm text-muted-foreground">Preço Atual</p>
                        <p className="text-xl sm:text-2xl font-bold text-green-600">
                          {formatCurrency(currentPrice)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Último dado disponível
                        </p>
                      </div>
                    </div>
                    
                    <h2 className="text-lg sm:text-xl text-muted-foreground mb-4 truncate">
                      Análise da Ação {companyData.name}
                    </h2>

                    {/* Descrição da Empresa - Collapsible para SEO */}
                    {companyData.description && (
                      <div className="mb-4">
                        <Collapsible>
                          <CollapsibleTrigger className="flex items-center space-x-2 text-left p-0 hover:no-underline">
                            <Info className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-muted-foreground">
                              Sobre a {companyData.name}
                            </span>
                            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-3">
                            <div className="p-4 bg-muted/50 rounded-lg border">
                              <p className="text-sm leading-relaxed text-muted-foreground">
                                {companyData.description}
                              </p>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    )}

                    {/* Card de Notificações - Destacado (apenas quando cards estão empilhados, até 1024px) */}
                    <div className="mb-6 lg:hidden">
                      <AssetSubscriptionButton
                        ticker={ticker}
                        companyId={companyData.id}
                        variant="card"
                        size="default"
                        showLabel={true}
                      />
                    </div>

                    {/* Botões de Ação */}
                    <div className="mb-4 flex flex-wrap gap-2">
                      {smartComparatorUrl && (
                        <Button asChild>
                          <Link href={smartComparatorUrl} prefetch={false}>
                            <GitCompare className="w-4 h-4 mr-2" />
                            Comparador Inteligente
                          </Link>
                        </Button>
                      )}
                      
                      <AddToBacktestButton
                        asset={{
                          ticker: companyData.ticker,
                          companyName: companyData.name,
                          sector: companyData.sector || undefined,
                          currentPrice: companyData.dailyQuotes?.[0]?.price ? Number(companyData.dailyQuotes[0].price) : undefined
                        }}
                        variant="outline"
                        size="default"
                        showLabel={true}
                      />

                      {reportsCount > 0 && (
                        <Button asChild variant="outline" size="default">
                          <Link href={`/acao/${ticker.toLowerCase()}/relatorios`} prefetch={false}>
                            <FileText className="w-4 h-4 mr-2" />
                            Relatórios ({reportsCount})
                          </Link>
                        </Button>
                      )}
                    </div>

                    {/* Banner Calculadora de Dividend Yield - Desktop (dentro do card principal) */}
                    {latestFinancials?.dy && Number(latestFinancials.dy) > 0 && (
                      <div className="hidden lg:block mb-4">
                        <Card className="border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 via-white to-emerald-50/50 dark:from-green-950/20 dark:via-background dark:to-emerald-950/20">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 flex-shrink-0">
                                  <Calculator className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-base mb-1">Calcule sua Renda Passiva</h3>
                                  <p className="text-xs text-muted-foreground">
                                    Dividend Yield: <span className="font-semibold text-green-600">
                                      {(Number(latestFinancials.dy) * 100).toFixed(2)}%
                                    </span>
                                  </p>
                                </div>
                              </div>
                              <Button 
                                asChild 
                                size="sm"
                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white flex-shrink-0"
                              >
                                <Link href={`/calculadoras/dividend-yield?ticker=${ticker}`} prefetch={false}>
                                  Calcular
                                  <ArrowRight className="w-4 h-4 ml-1.5" />
                                </Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm mb-4">
                      {companyData.industry && (
                        <div className="flex items-center space-x-2 min-w-0">
                          <PieChart className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{companyData.industry}</span>
                        </div>
                      )}
                      
                      {companyData.website && (
                        <div className="flex items-center space-x-2 min-w-0">
                          <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <Link 
                            href={companyData.website} 
                            prefetch={false}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline truncate"
                          >
                            Site oficial
                          </Link>
                        </div>
                      )}
                      
                      {(companyData.city || companyData.state) && (
                        <div className="flex items-center space-x-2 min-w-0">
                          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">
                            {[companyData.city, companyData.state].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}

                      {companyData.fullTimeEmployees && (
                        <div className="flex items-center space-x-2 min-w-0">
                          <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{companyData.fullTimeEmployees.toLocaleString()} funcionários</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card do Score - Separado */}
            <div className="lg:flex-shrink-0">
              <PageCacheIndicator ticker={ticker} />
              <HeaderScoreWrapper ticker={ticker} />
              
              {/* Card de Notificações - Destacado (apenas quando cards estão lado a lado, >= 1024px) */}
              <div className="hidden lg:block mt-4 lg:w-80">
                <AssetSubscriptionButton
                  ticker={ticker}
                  companyId={companyData.id}
                  variant="card"
                  size="default"
                  showLabel={true}
                  compact={true}
                />
              </div>
            </div>
          </div>
        </div>


        {latestFinancials && (
          <>
            {/* Análises Estratégicas - Usando componente cliente */}
            {latestFinancials && (
              <StrategicAnalysisClient 
                ticker={ticker}
                currentPrice={currentPrice}
                latestFinancials={serializedFinancials}
                userIsPremium={userIsPremium}
              />
            )}

            {/* Análise de Sentimento de Mercado - YouTube */}
            <MarketSentimentSection
              ticker={ticker}
              youtubeAnalysis={serializedYoutubeAnalysis}
              userIsPremium={userIsPremium}
            />

            {/* Link para Análise Técnica - Logo após as análises fundamentalistas */}
            <TechnicalAnalysisLink 
              ticker={ticker} 
              userIsPremium={userIsPremium}
              currentPrice={currentPrice}
            />

            {/* Radar de Dividendos */}
            <div className="mb-6">
              <DividendRadarCompact 
                ticker={ticker}
                companyName={companyData.name}
              />
            </div>

            {/* Card de Calculadora de Dividend Yield - Mobile/Tablet (versão completa) */}
            {latestFinancials?.dy && Number(latestFinancials.dy) > 0 && (
              <Card className="mb-6 lg:hidden border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 via-white to-emerald-50/50 dark:from-green-950/20 dark:via-background dark:to-emerald-950/20">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                          <Calculator className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">Calcule sua Renda Passiva</h3>
                          <p className="text-sm text-muted-foreground">
                            Descubra quanto você pode ganhar mensalmente com dividendos de {ticker}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-muted-foreground">
                          Dividend Yield atual: <span className="font-semibold text-green-600">
                            {(Number(latestFinancials.dy) * 100).toFixed(2)}%
                          </span>
                        </span>
                      </div>
                    </div>
                    <Button 
                      asChild 
                      size="lg"
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg"
                    >
                      <Link href={`/calculadoras/dividend-yield?ticker=${ticker}`} prefetch={false}>
                        Calcular Agora
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Indicadores Financeiros com Gráficos */}
            <FinancialIndicators 
              ticker={ticker}
              latestFinancials={serializedFinancials}
              comprehensiveData={comprehensiveData}
            />

            {/* Análise com IA */}
            <AIAnalysisDual
              ticker={ticker}
              name={companyData.name}
              sector={companyData.sector}
              currentPrice={currentPrice}
              financials={serializedFinancials}
              userIsPremium={userIsPremium}
              companyId={companyData.id}
            />

            {/* Dados Financeiros Completos */}
            {comprehensiveData && (
              <div className="mt-8">
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                      Dados Financeiros Detalhados
                    </h3>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Esta seção apresenta <strong>dados anuais</strong> detalhados dos últimos 7 anos completos, 
                    complementando os indicadores mostrados acima. Ideal para análise de tendências 
                    e performance histórica da empresa.
                  </p>
                </div>
                <ComprehensiveFinancialView data={comprehensiveData} />
              </div>
            )}

            {/* Footer com data da atualização */}
            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Dados financeiros atualizados em: {' '}
                {latestFinancials.updatedAt 
                  ? new Date(latestFinancials.updatedAt).toLocaleDateString('pt-BR')
                  : 'N/A'
                }
              </p>
            </div>
          </>
        )}
      </div>

      {/* Seção de Empresas Relacionadas - SEO Links Internos */}
      {relatedCompanies.length > 0 && (
        <div className="container mx-auto px-4 pb-8">
          <RelatedCompanies
            companies={relatedCompanies.map(comp => ({
              ticker: comp.ticker,
              name: comp.name,
              sector: comp.sector,
              logoUrl: comp.logoUrl || null,
              marketCap: comp.marketCap || null,
              assetType: 'STOCK' // Empresas relacionadas são sempre ações na página de ações
            }))}
            currentTicker={ticker}
            currentSector={companyData.sector}
            currentIndustry={companyData.industry}
            currentAssetType="STOCK"
          />
        </div>
      )}

      {/* Footer para usuários não logados - SEO */}
      {!session && (
        <Footer />
      )}

      {/* Schema Structured Data para SEO */}
      {latestFinancials && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Corporation",
              "name": companyData.name,
              "alternateName": ticker,
              "description": companyData.description || `Análise fundamentalista completa de ${companyData.name} (${ticker}) com indicadores financeiros, valuation e estratégias de investimento. Descubra se a ação está subvalorizada.`,
              "url": `https://precojusto.ai/acao/${ticker.toLowerCase()}`,
              "logo": companyData.logoUrl || undefined,
              "sameAs": companyData.website ? [companyData.website] : undefined,
              "address": companyData.address ? {
                "@type": "PostalAddress",
                "addressLocality": companyData.city,
                "addressRegion": companyData.state,
                "addressCountry": "BR"
              } : undefined,
              "numberOfEmployees": companyData.fullTimeEmployees,
              "industry": companyData.industry,
              "sector": companyData.sector,
              "marketCapitalization": {
                "@type": "MonetaryAmount",
                "currency": "BRL",
                "value": toNumber(latestFinancials.marketCap)
              },
              "revenue": {
                "@type": "MonetaryAmount", 
                "currency": "BRL",
                "value": toNumber(latestFinancials.receitaTotal)
              },
              "stockExchange": "B3 - Brasil Bolsa Balcão",
              "tickerSymbol": ticker,
              "priceRange": formatCurrency(currentPrice),
              "dividendYield": toNumber(latestFinancials.dy),
              "peRatio": toNumber(latestFinancials.pl),
              "pbRatio": toNumber(latestFinancials.pvp),
              "roe": toNumber(latestFinancials.roe),
              "roa": toNumber(latestFinancials.roa),
              "lastUpdated": latestFinancials.updatedAt?.toISOString()
            })
          }}
        />
      )}

      {/* Handler para inscrição automática após login/registro */}
      <Suspense fallback={null}>
        <AutoSubscribeHandler ticker={ticker} />
      </Suspense>
    </>
  )
}
