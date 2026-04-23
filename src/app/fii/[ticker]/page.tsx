import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { CompanyLogo } from '@/components/company-logo'
import { FiiHeaderScore } from '@/components/fii-header-score'
import { FiiStrategicAnalysis } from '@/components/fii-strategic-analysis'
import { FiiPageLockedShell } from '@/components/fii-page-locked-shell'
import AIAnalysisDual from '@/components/ai-analysis-dual'
import FinancialIndicators from '@/components/financial-indicators'
import ComprehensiveFinancialView from '@/components/comprehensive-financial-view'
import TechnicalAnalysisSection from '@/components/technical-analysis-section'
import MarketSentimentSection from '@/components/market-sentiment-section'
import { AddToBacktestButton } from '@/components/add-to-backtest-button'
import { Footer } from '@/components/footer'
import { TrackingAssetView } from '@/components/tracking-asset-view'
import { getComprehensiveFinancialData } from '@/lib/financial-data-service'
import { cache } from '@/lib/cache-service'
import Link from 'next/link'
import { BenChatFAB } from '@/components/ben-chat-fab'
import { checkAndRecordUsage } from '@/lib/usage-based-pricing-service'
import { RateLimitMiddleware } from '@/lib/rate-limit-middleware'
import { AnonLimitCTA } from '@/components/anon-limit-cta'
import {
  computeFiiListingValuation,
  fiiListingFairValueModelLabel,
} from '@/lib/fii-listing-valuation'

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
  ChevronDown,
  Info,
  FileText
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
  const cacheKey = `metadata-fii-${ticker}`
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
            updatedAt: true,
            dy: true
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
        },
        fiiData: {
          select: {
            dividendYield: true,
            lastDividendValue: true,
            lastDividendDate: true,
            patrimonioLiquido: true,
            valorPatrimonial: true
          }
        }
      }
    })

    if (!company) {
      return {
        title: `${ticker} - FII Não Encontrado | Preço Justo AI`,
        description: `O FII ${ticker} não foi encontrado em nossa base de dados de análise de fundos imobiliários.`
      }
    }

    // Verificar se é realmente um FII, senão redirecionar
    if (company.assetType !== 'FII') {
      return {
        title: `${ticker} - Redirecionando...`,
        description: `Redirecionando para a página correta do ativo ${ticker}.`
      }
    }

    const latestFinancials = company.financialData?.[0]
    const currentPrice = toNumber(company.dailyQuotes?.[0]?.price) ?? 0
    const dividendYield = company.fiiData?.dividendYield ? (toNumber(company.fiiData.dividendYield) ?? 0) * 100 : null
    
    const title = `${ticker} - ${company.name} | Análise Completa de FII - Preço Justo AI`
    
    const baseDescription = `Análise completa do FII ${company.name} (${ticker}). Preço atual R$ ${currentPrice.toFixed(2)}, Dividend Yield: ${dividendYield ? dividendYield.toFixed(2) + '%' : 'N/A'}. Setor ${company.sector || 'Fundos Imobiliários'}.`
    
    const companyInfo = company.description 
      ? ` ${company.description.substring(0, 100)}...` 
      : ''
    
    const description = `${baseDescription}${companyInfo} Análise com IA, indicadores financeiros e estratégias de investimento em FIIs.`

    const canonicalPath = `/fii/${tickerParam.toLowerCase()}`
    const canonicalUrl = `https://precojusto.ai${canonicalPath}`

    const metadata = {
      title,
      description,
      keywords: `${ticker}, ${company.name}, FII, fundo imobiliário, análise FII, ${ticker} FII, fundos imobiliários, B3, bovespa, investimentos, dividend yield, análise de FIIs, valuation FII`,
      openGraph: {
        title,
        description,
        type: 'article',
        url: canonicalUrl,
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
        canonical: canonicalPath,
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
        'article:section': 'Análise de FIIs',
        'article:tag': `${ticker}, ${company.name}, FII, fundo imobiliário, análise FII`,
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
      title: `${ticker} - Análise de FII | Preço Justo AI`,
      description: `Análise completa do FII ${ticker} com indicadores financeiros, dividend yield e estratégias de investimento em fundos imobiliários.`,
      alternates: {
        canonical: `/fii/${tickerParam.toLowerCase()}`,
      }
    }
  }
}

export default async function FiiPage({ params }: PageProps) {
  const resolvedParams = await params
  const tickerParam = resolvedParams.ticker
  const ticker = tickerParam.toUpperCase()

  // Verificar se ticker foi migrado e redirecionar
  const company = await prisma.company.findUnique({
    where: { ticker },
    select: {
      isActive: true,
      successor: {
        select: {
          ticker: true,
        },
      },
    },
  });

  if (company && !company.isActive && company.successor) {
    redirect(`/fii/${company.successor.ticker.toLowerCase()}`);
  }

  const session = await getServerSession(authOptions)
  let canViewFullContent = false
  let shouldShowAnonLimitCTA = false

  if (session?.user?.id) {
    const user = await getCurrentUser()
    canViewFullContent = user?.isPremium || false
  } else {
    const headersList = await headers()
    const ip = RateLimitMiddleware.getClientIPFromHeaders(headersList)
    const usageResult = await checkAndRecordUsage({
      userId: null,
      ip,
      feature: 'anon_full_view',
      resourceId: `company:${ticker}`,
      recordUsage: true,
    })
    canViewFullContent = usageResult.allowed
    shouldShowAnonLimitCTA = !usageResult.allowed && usageResult.shouldConvertLead
  }

  let fullCompany: any = null
  let minimalCompany: any = null
  let comprehensiveData: Awaited<ReturnType<typeof getComprehensiveFinancialData>> | null = null
  let reportsCount = 0
  let youtubeAnalysis: {
    score: unknown
    summary: string | null
    positivePoints: unknown
    negativePoints: unknown
    updatedAt: Date
  } | null = null

  if (canViewFullContent) {
    const [fc, comp, reports, yt] = await Promise.all([
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
          },
          fiiData: true
        }
      }),
      getComprehensiveFinancialData(ticker, 'YEARLY', 7),
      prisma.aIReport.count({
        where: {
          company: {
            ticker: ticker
          },
          type: 'FUNDAMENTAL_CHANGE'
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
    fullCompany = fc
    comprehensiveData = comp
    reportsCount = reports
    youtubeAnalysis = yt
  } else {
    minimalCompany = await prisma.company.findUnique({
      where: { ticker },
      select: {
        id: true,
        ticker: true,
        name: true,
        logoUrl: true,
        sector: true,
        description: true,
        website: true,
        city: true,
        state: true,
        industry: true,
        fullTimeEmployees: true,
        assetType: true,
        isActive: true,
      },
    })
  }

  const companyData = fullCompany ?? minimalCompany
  if (!companyData) {
    notFound()
  }

  // Verificar se é realmente um FII, senão redirecionar
  if (companyData.assetType !== 'FII') {
    const correctPath = companyData.assetType === 'STOCK' ? `/acao/${tickerParam.toLowerCase()}` :
                       companyData.assetType === 'BDR' ? `/bdr/${tickerParam.toLowerCase()}` :
                       companyData.assetType === 'ETF' ? `/etf/${tickerParam.toLowerCase()}` :
                       `/acao/${tickerParam.toLowerCase()}`
    redirect(correctPath)
  }

  const latestFinancials = fullCompany?.financialData?.[0]
  const latestQuote = fullCompany?.dailyQuotes?.[0]
  const currentPrice = canViewFullContent
    ? (toNumber(latestQuote?.price) ?? toNumber(latestFinancials?.lpa) ?? 0)
    : 0
  const hasStockStyleFinancials = !!(
    canViewFullContent &&
    latestFinancials &&
    (toNumber(latestFinancials.lpa) || toNumber(latestFinancials.pl))
  )

  const serializedFinancials =
    canViewFullContent && latestFinancials
      ? (Object.fromEntries(
          Object.entries(latestFinancials).map(([key, value]) => [
            key,
            value && typeof value === 'object' && 'toNumber' in value
              ? (value as { toNumber: () => number }).toNumber()
              : value,
          ])
        ) as Record<string, unknown>)
      : null

  const serializedYoutubeAnalysis =
    canViewFullContent && youtubeAnalysis
      ? {
          score: toNumber(youtubeAnalysis.score as never) ?? 0,
          summary: youtubeAnalysis.summary ?? '',
          positivePoints: youtubeAnalysis.positivePoints as string[] | null,
          negativePoints: youtubeAnalysis.negativePoints as string[] | null,
          updatedAt: youtubeAnalysis.updatedAt,
        }
      : null

  const isLoggedIn = !!session?.user?.id

  const fiiHeaderValuation =
    canViewFullContent && fullCompany?.fiiData && currentPrice > 0
      ? computeFiiListingValuation({
          ticker,
          name: fullCompany.name,
          sector: fullCompany.sector,
          currentPrice,
          logoUrl: fullCompany.logoUrl,
          financials: {
            dy: fullCompany.fiiData.dividendYield,
            pvp: fullCompany.fiiData.pvp,
            vpa: fullCompany.fiiData.valorPatrimonial,
            fiiCotacao: fullCompany.fiiData.cotacao,
          },
          ultimoDividendo: toNumber(fullCompany.fiiData.lastDividendValue) ?? undefined,
          dividendHistory: [],
        })
      : null

  return (
    <>
      <TrackingAssetView ticker={ticker} assetType="FII" />
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
                            FII - Fundo Imobiliário
                          </Badge>
                          <Badge variant="outline" className="text-sm w-fit">
                            {companyData.sector || 'Fundos Imobiliários'}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Preço */}
                      <div className="lg:text-right lg:flex-shrink-0">
                        <p className="text-sm text-muted-foreground">Preço Atual</p>
                        {canViewFullContent ? (
                          <>
                            <p className="text-xl sm:text-2xl font-bold text-green-600">
                              {formatCurrency(currentPrice)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Último dado disponível
                            </p>
                            {fiiHeaderValuation?.upside != null && (
                              <div
                                className={`mt-3 rounded-lg border px-3 py-2 text-left sm:text-right ${
                                  fiiHeaderValuation.upside > 0
                                    ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/50 dark:text-green-100'
                                    : fiiHeaderValuation.upside < 0
                                      ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100'
                                      : 'border-muted bg-muted/40 text-muted-foreground'
                                }`}
                              >
                                <p className="text-[11px] font-medium uppercase tracking-wide opacity-90">
                                  Potencial (vs{' '}
                                  {fiiListingFairValueModelLabel(fiiHeaderValuation.upsideSource) ??
                                    'referência'}
                                  )
                                </p>
                                <p className="text-lg font-bold tabular-nums">
                                  {fiiHeaderValuation.upside > 0 ? '+' : ''}
                                  {fiiHeaderValuation.upside.toFixed(1)}%
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <p
                              className="text-xl sm:text-2xl font-bold text-muted-foreground tracking-[0.35em] select-none"
                              aria-hidden
                            >
                              ••••
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Disponível com cadastro ou Premium
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <h2 className="text-lg sm:text-xl text-muted-foreground mb-4 truncate">
                      Análise do FII {companyData.name}
                    </h2>

                    {/* Informações específicas do FII */}
                    {fullCompany?.fiiData && (
                      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                          Dados do Fundo Imobiliário
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          {fullCompany.fiiData.dividendYield && (
                            <div>
                              <span className="text-muted-foreground">Dividend Yield:</span>
                              <span className="ml-2 font-medium">
                                {(toNumber(fullCompany.fiiData.dividendYield)!).toFixed(2)}%
                              </span>
                            </div>
                          )}
                          {fullCompany.fiiData.valorPatrimonial && (
                            <div>
                              <span className="text-muted-foreground">Valor Patrimonial:</span>
                              <span className="ml-2 font-medium">
                                {formatCurrency(toNumber(fullCompany.fiiData.valorPatrimonial))}
                              </span>
                            </div>
                          )}
                          {fullCompany.fiiData.lastDividendValue && (
                            <div>
                              <span className="text-muted-foreground">Último Dividendo:</span>
                              <span className="ml-2 font-medium">
                                {formatCurrency(toNumber(fullCompany.fiiData.lastDividendValue))}
                              </span>
                            </div>
                          )}
                          {fullCompany.fiiData.patrimonioLiquido && (
                            <div>
                              <span className="text-muted-foreground">Patrimônio Líquido:</span>
                              <span className="ml-2 font-medium">
                                {formatCurrency(toNumber(fullCompany.fiiData.patrimonioLiquido))}
                              </span>
                            </div>
                          )}
                          {fullCompany.fiiData.cotacao != null && (
                            <div>
                              <span className="text-muted-foreground">Cotação (Fundamentus):</span>
                              <span className="ml-2 font-medium">
                                {formatCurrency(toNumber(fullCompany.fiiData.cotacao))}
                              </span>
                            </div>
                          )}
                          {fullCompany.fiiData.pvp != null && (
                            <div>
                              <span className="text-muted-foreground">P/VP:</span>
                              <span className="ml-2 font-medium">{toNumber(fullCompany.fiiData.pvp)?.toFixed(2)}</span>
                            </div>
                          )}
                          {fullCompany.fiiData.ffoYield != null && (
                            <div>
                              <span className="text-muted-foreground">FFO Yield:</span>
                              <span className="ml-2 font-medium">
                                {((toNumber(fullCompany.fiiData.ffoYield) || 0) * 100).toFixed(2)}%
                              </span>
                            </div>
                          )}
                          {fullCompany.fiiData.capRate != null && (
                            <div>
                              <span className="text-muted-foreground">Cap Rate:</span>
                              <span className="ml-2 font-medium">
                                {((toNumber(fullCompany.fiiData.capRate) || 0) * 100).toFixed(2)}%
                              </span>
                            </div>
                          )}
                          {fullCompany.fiiData.liquidez != null && (
                            <div>
                              <span className="text-muted-foreground">Liquidez média diária:</span>
                              <span className="ml-2 font-medium">
                                {toNumber(fullCompany.fiiData.liquidez)?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </div>
                          )}
                          {fullCompany.fiiData.qtdImoveis != null && (
                            <div>
                              <span className="text-muted-foreground">Qtd. imóveis:</span>
                              <span className="ml-2 font-medium">{fullCompany.fiiData.qtdImoveis}</span>
                            </div>
                          )}
                          {fullCompany.fiiData.precoM2 != null && (
                            <div>
                              <span className="text-muted-foreground">Preço/m²:</span>
                              <span className="ml-2 font-medium">
                                {formatCurrency(toNumber(fullCompany.fiiData.precoM2))}
                              </span>
                            </div>
                          )}
                          {fullCompany.fiiData.aluguelM2 != null && (
                            <div>
                              <span className="text-muted-foreground">Aluguel/m²:</span>
                              <span className="ml-2 font-medium">
                                {formatCurrency(toNumber(fullCompany.fiiData.aluguelM2))}
                              </span>
                            </div>
                          )}
                          {fullCompany.fiiData.vacanciaMedia != null && (
                            <div>
                              <span className="text-muted-foreground">Vacância média:</span>
                              <span className="ml-2 font-medium">
                                {((toNumber(fullCompany.fiiData.vacanciaMedia) || 0) * 100).toFixed(2)}%
                              </span>
                            </div>
                          )}
                          {fullCompany.fiiData.segment && (
                            <div>
                              <span className="text-muted-foreground">Segmento:</span>
                              <span className="ml-2 font-medium">{fullCompany.fiiData.segment}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Tipo:</span>
                            <span className="ml-2 font-medium">
                              {fullCompany.fiiData.isPapel ? 'Papel / RF' : 'Tijolo'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Descrição da Empresa - Collapsible para SEO */}
                    {companyData.description && (
                      <div className="mb-4">
                        <Collapsible>
                          <CollapsibleTrigger className="flex items-center space-x-2 text-left p-0 hover:no-underline">
                            <Info className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-muted-foreground">
                              Sobre o {companyData.name}
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

                    {/* Botões de Ação */}
                    <div className="mb-4 flex flex-wrap gap-2">
                      <AddToBacktestButton
                        asset={{
                          ticker: companyData.ticker,
                          companyName: companyData.name,
                          sector: companyData.sector || undefined,
                          currentPrice: fullCompany?.dailyQuotes?.[0]?.price
                            ? Number(fullCompany.dailyQuotes[0].price)
                            : undefined,
                          assetType: 'FII',
                        }}
                        variant="outline"
                        size="default"
                        showLabel={true}
                      />
{/* 
                      <AssetSubscriptionButton
                        ticker={ticker}
                        companyId={companyData.id}
                        variant="outline"
                        size="default"
                        showLabel={true}
                      /> */}

                      {canViewFullContent && reportsCount > 0 && (
                        <Button asChild variant="outline" size="default">
                          <Link href={`/fii/${ticker.toLowerCase()}/relatorios`}>
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

            <div className="lg:flex-shrink-0 w-full lg:max-w-md">
              <FiiHeaderScore
                ticker={ticker}
                canViewFullContent={canViewFullContent}
                isLoggedIn={isLoggedIn}
              />
            </div>
          </div>
        </div>

        {shouldShowAnonLimitCTA && (
          <div className="mb-8">
            <AnonLimitCTA />
          </div>
        )}

        {fullCompany?.fiiData && (
          <FiiStrategicAnalysis
            currentPrice={currentPrice}
            dividendYield={toNumber(fullCompany.fiiData.dividendYield)}
            ultimoDividendo={toNumber(fullCompany.fiiData.lastDividendValue)}
            pvp={toNumber(fullCompany.fiiData.pvp)}
            liquidez={toNumber(fullCompany.fiiData.liquidez)}
            qtdImoveis={fullCompany.fiiData.qtdImoveis}
            vacanciaMedia={toNumber(fullCompany.fiiData.vacanciaMedia)}
            isPapel={!!fullCompany.fiiData.isPapel}
          />
        )}

        {!canViewFullContent && <FiiPageLockedShell isLoggedIn={isLoggedIn} />}

        {canViewFullContent && (
          <>
            <MarketSentimentSection
              ticker={ticker}
              youtubeAnalysis={serializedYoutubeAnalysis}
              userIsPremium={canViewFullContent}
            />

            <TechnicalAnalysisSection
              ticker={ticker}
              userIsPremium={canViewFullContent}
            />

            {hasStockStyleFinancials && serializedFinancials && (
              <>
                <FinancialIndicators
                  ticker={ticker}
                  latestFinancials={serializedFinancials}
                  comprehensiveData={comprehensiveData}
                />

                <AIAnalysisDual
                  ticker={ticker}
                  name={fullCompany!.name}
                  sector={fullCompany!.sector}
                  currentPrice={currentPrice}
                  financials={serializedFinancials}
                  userIsPremium={canViewFullContent}
                  companyId={fullCompany!.id}
                />
              </>
            )}

            {hasStockStyleFinancials && comprehensiveData && (
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
                    e performance histórica do fundo.
                  </p>
                </div>
                <ComprehensiveFinancialView data={comprehensiveData} />
              </div>
            )}

            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Dados atualizados em:{' '}
                {fullCompany?.fiiData?.lastFetchedAt
                  ? new Date(fullCompany.fiiData.lastFetchedAt).toLocaleDateString('pt-BR')
                  : latestFinancials?.updatedAt
                    ? new Date(latestFinancials.updatedAt).toLocaleDateString('pt-BR')
                    : 'N/A'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer para usuários não logados - SEO */}
      {!session && (
        <Footer />
      )}

      {/* Ben Chat FAB */}
      <BenChatFAB />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Início',
                item: 'https://precojusto.ai/',
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Screening de FIIs',
                item: 'https://precojusto.ai/screening-fiis',
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: `${ticker} — ${companyData.name}`,
                item: `https://precojusto.ai/fii/${ticker.toLowerCase()}`,
              },
            ],
          }),
        }}
      />

      {/* Schema: sem métricas sensíveis quando o conteúdo está bloqueado */}
      {canViewFullContent && (latestFinancials || fullCompany?.fiiData) && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "InvestmentFund",
              "name": companyData.name,
              "alternateName": ticker,
              "description": companyData.description || `Análise completa do FII ${companyData.name} (${ticker}) com indicadores financeiros, dividend yield e estratégias de investimento em fundos imobiliários.`,
              "url": `https://precojusto.ai/fii/${ticker.toLowerCase()}`,
              "logo": companyData.logoUrl || undefined,
              "sameAs": companyData.website ? [companyData.website] : undefined,
              "category": "Real Estate Investment Trust",
              "fundFamily": "FII - Fundo de Investimento Imobiliário",
              "stockExchange": "B3 - Brasil Bolsa Balcão",
              "tickerSymbol": ticker,
              "priceRange": formatCurrency(currentPrice),
              "dividendYield": fullCompany?.fiiData?.dividendYield ? toNumber(fullCompany.fiiData.dividendYield) : undefined,
              "netAssets": fullCompany?.fiiData?.patrimonioLiquido ? toNumber(fullCompany.fiiData.patrimonioLiquido) : undefined,
              "lastUpdated":
                fullCompany?.fiiData?.lastFetchedAt?.toISOString() ||
                latestFinancials?.updatedAt?.toISOString()
            })
          }}
        />
      )}
      {!canViewFullContent && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "InvestmentFund",
              "name": companyData.name,
              "alternateName": ticker,
              "description": `Página do FII ${companyData.name} (${ticker}) na Preço Justo AI.`,
              "url": `https://precojusto.ai/fii/${ticker.toLowerCase()}`,
              "logo": companyData.logoUrl || undefined,
              "tickerSymbol": ticker,
            })
          }}
        />
      )}
    </>
  )
}