import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
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
import { Footer } from '@/components/footer'
import { getComprehensiveFinancialData } from '@/lib/financial-data-service'
import { cache } from '@/lib/cache-service'
import { getSectorCompetitors } from '@/lib/competitor-service'
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
  Globe
} from 'lucide-react'

interface PageProps {
  params: {
    ticker: string
  }
}


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

// Cache
const METADATA_CACHE_TTL = 60 * 60 // 60 minutos em segundos

// Gerar metadata dinâmico para SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const tickerParam = resolvedParams.ticker
  const ticker = tickerParam.toUpperCase()
  
  // Verificar cache primeiro
  const cacheKey = `metadata-bdr-${ticker}`
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
        assetType: true,
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
        title: `${ticker} - BDR Não Encontrado | Análise Fácil`,
        description: `O BDR ${ticker} não foi encontrado em nossa base de dados de análise de Brazilian Depositary Receipts.`
      }
    }

    // Verificar se é realmente um BDR, senão redirecionar
    if (company.assetType !== 'BDR') {
      return {
        title: `${ticker} - Redirecionando...`,
        description: `Redirecionando para a página correta do ativo ${ticker}.`
      }
    }

    const latestFinancials = company.financialData?.[0]
    const currentPrice = toNumber(company.dailyQuotes?.[0]?.price) ?? 0
    
    const title = `${ticker} - ${company.name} | Análise Completa de BDR - Preço Justo AI`
    
    // Construir descrição base com informações financeiras
    const priceInfo = currentPrice > 0 ? `Preço atual R$ ${currentPrice.toFixed(2)}` : ''
    const plInfo = latestFinancials?.pl ? `P/L: ${(toNumber(latestFinancials.pl) ?? 0).toFixed(1)}` : ''
    const roeInfo = latestFinancials?.roe ? `ROE: ${((toNumber(latestFinancials.roe) ?? 0) * 100).toFixed(1)}%` : ''
    const sectorInfo = company.sector ? `Setor ${company.sector}` : ''
    
    const financialMetrics = [priceInfo, plInfo, roeInfo, sectorInfo].filter(Boolean).join(', ')
    
    // Verificar se a descrição contém o texto padrão sobre BDRs
    const defaultBdrText = 'BDRs são certificados de depósito que representam ações de empresas estrangeiras negociadas na B3'
    const hasDefaultDescription = company.description?.includes(defaultBdrText) || false
    
    // Usar descrição da empresa apenas se não for o texto padrão e tiver conteúdo útil
    let companyInfo = ''
    if (company.description && !hasDefaultDescription && company.description.length > 50) {
      // Pegar apenas as primeiras palavras úteis (evitar textos muito genéricos)
      const cleanDescription = company.description.trim()
      if (cleanDescription.length > 50 && !cleanDescription.toLowerCase().startsWith('bdr')) {
        companyInfo = ` ${cleanDescription.substring(0, 120).trim()}...`
      }
    }
    
    // Construir descrição final priorizando informações específicas da empresa
    const baseDescription = `Análise completa do BDR ${company.name} (${ticker}). ${financialMetrics}.`
    const description = `${baseDescription}${companyInfo} Análise com IA, indicadores financeiros e estratégias de investimento em BDRs.`

    const metadata = {
      title,
      description,
      keywords: `${ticker}, ${company.name}, BDR, Brazilian Depositary Receipt, análise BDR, ${ticker} BDR, ações internacionais, B3, bovespa, investimentos, ${company.sector}, análise de BDRs, valuation BDR`,
      openGraph: {
        title,
        description,
        type: 'article',
        url: `/bdr/${tickerParam.toLowerCase()}`,
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
        canonical: `/bdr/${tickerParam.toLowerCase()}`,
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
        'article:section': 'Análise de BDRs',
        'article:tag': `${ticker}, ${company.name}, BDR, Brazilian Depositary Receipt, análise BDR`,
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
      title: `${ticker} - Análise de BDR | Preço Justo AI`,
      description: `Análise completa do BDR ${ticker} com indicadores financeiros, valuation e estratégias de investimento em Brazilian Depositary Receipts.`,
      alternates: {
        canonical: `/bdr/${tickerParam.toLowerCase()}`,
      }
    }
  }
}

export default async function BdrPage({ params }: PageProps) {
  const resolvedParams = await params
  const tickerParam = resolvedParams.ticker
  const ticker = tickerParam.toUpperCase()

  // Verificar sessão do usuário para recursos premium
  const session = await getServerSession(authOptions)
  let userIsPremium = false

  if (session?.user?.id) {
    const user = await getCurrentUser()
    userIsPremium = user?.isPremium || false
  }

  // Buscar dados da empresa
  const [companyData, comprehensiveData, reportsCount, youtubeAnalysis] = await Promise.all([
    prisma.company.findUnique({
      where: { ticker },
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 8
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

  // Verificar se é realmente um BDR, senão redirecionar
  if (companyData.assetType !== 'BDR') {
    const correctPath = companyData.assetType === 'STOCK' ? `/acao/${tickerParam.toLowerCase()}` :
                       companyData.assetType === 'FII' ? `/fii/${tickerParam.toLowerCase()}` :
                       companyData.assetType === 'ETF' ? `/etf/${tickerParam.toLowerCase()}` :
                       `/acao/${tickerParam.toLowerCase()}`
    redirect(correctPath)
  }

  const latestFinancials = companyData.financialData?.[0]
  const latestQuote = companyData.dailyQuotes?.[0]
  const currentPrice = toNumber(latestQuote?.price) ?? toNumber(latestFinancials?.lpa) ?? 0

  // Buscar concorrentes inteligentes para comparador premium (apenas BDRs)
  const currentMarketCap = toNumber(latestFinancials?.marketCap)
  const competitors = companyData.sector 
    ? await getSectorCompetitors({
        currentTicker: ticker,
        sector: companyData.sector,
        industry: companyData.industry,
        currentMarketCap,
        limit: 5,
        assetType: 'BDR'
      })
    : []
  
  // Criar URL do comparador inteligente
  const smartComparatorUrl = competitors.length > 0 
    ? `/compara-acoes/${ticker}/${competitors.map(c => c.ticker).join('/')}`
    : null

  // Converter dados financeiros para números
  const serializedFinancials = latestFinancials ? Object.fromEntries(
    Object.entries(latestFinancials).map(([key, value]) => [
      key,
      value && typeof value === 'object' && 'toNumber' in value 
        ? value.toNumber() 
        : value
    ])
  ) as any : null

  // Converter dados da análise do YouTube
  const serializedYoutubeAnalysis = youtubeAnalysis ? {
    score: toNumber(youtubeAnalysis.score) ?? 0,
    summary: youtubeAnalysis.summary,
    positivePoints: youtubeAnalysis.positivePoints as string[] | null,
    negativePoints: youtubeAnalysis.negativePoints as string[] | null,
    updatedAt: youtubeAnalysis.updatedAt
  } : null

  return (
    <>
      <div className="container mx-auto py-8 px-4">
        {/* Layout Responsivo: 2 Cards Separados */}
        <div className="mb-8">
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
                            <Globe className="w-3 h-3 mr-1" />
                            BDR
                          </Badge>
                          <Badge variant="outline" className="text-sm w-fit">
                            {companyData.sector || 'N/A'}
                          </Badge>
                          <CompanySizeBadge 
                            marketCap={toNumber(latestFinancials?.marketCap)} 
                            size="md"
                          />
                        </div>
                      </div>
                      
                      {/* Preço */}
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
                      Análise do BDR {companyData.name}
                    </h2>

                    {/* Informação sobre BDR */}
                    <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center space-x-2 mb-2">
                        <Globe className="w-4 h-4 text-purple-600" />
                        <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                          Brazilian Depositary Receipt (BDR)
                        </h3>
                      </div>
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        BDRs são certificados de depósito que representam ações de empresas estrangeiras 
                        negociadas na B3. Permitem investir em empresas internacionais através da bolsa brasileira.
                      </p>
                    </div>

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
                          <Link href={smartComparatorUrl}>
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
                          <Link href={`/bdr/${ticker.toLowerCase()}/relatorios`}>
                            <FileText className="w-4 h-4 mr-2" />
                            Relatórios ({reportsCount})
                          </Link>
                        </Button>
                      )}
                    </div>

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

            {/* Análise Técnica */}
            <TechnicalAnalysisLink 
              ticker={ticker} 
              userIsPremium={userIsPremium}
              currentPrice={currentPrice}
              assetType="BDR"
            />

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
              "description": companyData.description || `Análise completa do BDR ${companyData.name} (${ticker}) com indicadores financeiros, valuation e estratégias de investimento em Brazilian Depositary Receipts.`,
              "url": `https://precojusto.ai/bdr/${ticker.toLowerCase()}`,
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
              "additionalType": "BDR - Brazilian Depositary Receipt",
              "lastUpdated": latestFinancials.updatedAt?.toISOString()
            })
          }}
        />
      )}
    </>
  )
}