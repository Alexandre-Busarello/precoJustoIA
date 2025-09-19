import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CompanyLogo } from '@/components/company-logo'
import StrategicAnalysisClient from '@/components/strategic-analysis-client'
import HeaderScoreWrapper from '@/components/header-score-wrapper'
import AIAnalysis from '@/components/ai-analysis'
import FinancialIndicators from '@/components/financial-indicators'
import CompanySearch from '@/components/company-search'
import ComprehensiveFinancialView from '@/components/comprehensive-financial-view'
import { getComprehensiveFinancialData } from '@/lib/financial-data-service'
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
  LineChart,
  GitCompare,
  ChevronDown,
  Info
} from 'lucide-react'

interface PageProps {
  params: {
    ticker: string
  }
}


// Funções de formatação definidas mais abaixo

// Função helper para determinar tipo de indicador
function getIndicatorType(value: number | null, positiveThreshold?: number, negativeThreshold?: number): 'positive' | 'negative' | 'neutral' | 'default' {
  if (value === null) return 'default'
  
  if (positiveThreshold !== undefined && value >= positiveThreshold) return 'positive'
  if (negativeThreshold !== undefined && value <= negativeThreshold) return 'positive'
  if (positiveThreshold !== undefined && value < positiveThreshold) return 'negative'
  if (negativeThreshold !== undefined && value > negativeThreshold) return 'negative'
  
  return 'neutral'
}

// Função para extrair prefixo do ticker (remove números finais)
function getTickerPrefix(ticker: string): string {
  return ticker.replace(/\d+$/, '') // Remove números no final
}

// Cache para concorrentes (válido por 30 minutos)
const competitorsCache = new Map<string, { competitors: { ticker: string; name: string; sector: string | null }[]; timestamp: number }>()
const COMPETITORS_CACHE_DURATION = 30 * 60 * 1000 // 30 minutos

// Função para buscar concorrentes do mesmo setor com priorização de subsetor (otimizada)
async function getSectorCompetitors(currentTicker: string, sector: string | null, industry: string | null, limit: number = 5) {
  if (!sector) return []
  
  try {
    // Verificar cache primeiro
    const cacheKey = `${currentTicker}-${sector}-${industry}-${limit}`
    const cached = competitorsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < COMPETITORS_CACHE_DURATION) {
      console.log('📋 Usando concorrentes do cache para', currentTicker)
      return cached.competitors
    }

    const currentPrefix = getTickerPrefix(currentTicker)
    const currentYear = new Date().getFullYear()
    
    // Query otimizada: buscar todas as empresas do setor/industry de uma vez
    const allCompetitors = await prisma.company.findMany({
      where: {
        OR: [
          { industry: industry || undefined },
          { sector: sector }
        ],
        ticker: { not: currentTicker },
        // Otimização: usar índice composto para filtrar empresas com dados recentes
        financialData: {
          some: {
            year: { gte: currentYear - 1 }
          }
        }
      },
      select: {
        ticker: true,
        name: true,
        sector: true,
        industry: true
      },
      orderBy: [
        { industry: industry ? 'asc' : 'desc' }, // Priorizar industry se especificado
        { ticker: 'asc' }
      ],
      take: limit * 3 // Buscar mais para ter opções após filtrar prefixos
    })

    // Filtrar empresas com mesmo prefixo e priorizar por industry
    const seenPrefixes = new Set([currentPrefix])
    const competitors: { ticker: string; name: string; sector: string | null }[] = []
    
    // Primeiro: empresas do mesmo industry
    if (industry) {
      for (const company of allCompetitors) {
        if (company.industry === industry && competitors.length < limit) {
          const companyPrefix = getTickerPrefix(company.ticker)
          if (!seenPrefixes.has(companyPrefix)) {
            seenPrefixes.add(companyPrefix)
            competitors.push({
              ticker: company.ticker,
              name: company.name,
              sector: company.sector
            })
          }
        }
      }
    }
    
    // Depois: empresas do mesmo setor (se ainda precisar)
    if (competitors.length < limit) {
      for (const company of allCompetitors) {
        if (company.sector === sector && competitors.length < limit) {
          const companyPrefix = getTickerPrefix(company.ticker)
          if (!seenPrefixes.has(companyPrefix)) {
            seenPrefixes.add(companyPrefix)
            competitors.push({
              ticker: company.ticker,
              name: company.name,
              sector: company.sector
            })
          }
        }
      }
    }

    // Armazenar no cache
    competitorsCache.set(cacheKey, {
      competitors,
      timestamp: Date.now()
    })
    
    return competitors
  } catch (error) {
    console.error('Erro ao buscar concorrentes:', error)
    return []
  }
}

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

function formatPercent(value: PrismaDecimal | Date | string | null): string {
  const numValue = toNumber(value)
  if (numValue === null || numValue === undefined) return 'N/A'
  return `${(numValue * 100).toFixed(2)}%`
}

function formatLargeNumber(value: number | null): string {
  if (value === null || value === undefined) return 'N/A'
  
  if (value >= 1_000_000_000) {
    return `R$ ${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(2)}K`
  }
  return formatCurrency(value)
}



// Componente para indicador com ícone - copiado exatamente do ticker-page-client
function IndicatorCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  type = 'default',
  onChartClick,
  ticker
}: {
  title: string
  value: string | number
   
  icon: any
  description?: string
  type?: 'positive' | 'negative' | 'neutral' | 'default'
  onChartClick?: (indicator: string) => void
  ticker?: string
}) {
  const getColorClass = () => {
    switch (type) {
      case 'positive': return 'text-green-600 dark:text-green-400'
      case 'negative': return 'text-red-600 dark:text-red-400'
      case 'neutral': return 'text-blue-600 dark:text-blue-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-800 ${getColorClass()}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground truncate">
                {title}
              </p>
              <p className="text-xl font-bold">
                {value}
              </p>
              {description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
          </div>
          {onChartClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChartClick(title)}
              className="ml-2 p-2 h-8 w-8"
              title={`Ver gráfico de evolução do ${title}`}
            >
              <LineChart className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}


// Gerar metadata dinâmico para SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const ticker = resolvedParams.ticker.toUpperCase()
  
  try {
    const company = await prisma.company.findUnique({
      where: { ticker },
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 1
        },
        dailyQuotes: {
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
    
    const title = `${ticker} - ${company.name} | Análise de Ação Completa - Preço Justo AI`
    
    // Incluir descrição da empresa no SEO quando disponível
    const baseDescription = `Análise fundamentalista completa da ação ${company.name} (${ticker}). Preço atual R$ ${currentPrice.toFixed(2)}, P/L: ${latestFinancials?.pl ? toNumber(latestFinancials.pl)?.toFixed(1) : 'N/A'}, ROE: ${latestFinancials?.roe ? (toNumber(latestFinancials.roe)! * 100).toFixed(1) + '%' : 'N/A'}. Setor ${company.sector || 'N/A'}.`
    
    const companyInfo = company.description 
      ? ` ${company.description.substring(0, 100)}...` 
      : ''
    
    const description = `${baseDescription}${companyInfo} Análise com IA, indicadores financeiros e estratégias de investimento.`

    return {
      title,
      description,
      keywords: `${ticker}, ${company.name}, análise fundamentalista, ação ${ticker}, ações, B3, bovespa, investimentos, ${company.sector}, análise de ações, valuation, indicadores financeiros`,
      openGraph: {
        title,
        description,
        type: 'article',
        url: `/acao/${ticker}`,
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
        canonical: `/acao/${ticker}`,
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
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
  } catch {
    return {
      title: `${ticker} - Análise de Ação | Preço Justo AI`,
      description: `Análise fundamentalista completa da ação ${ticker} com indicadores financeiros, valuation e estratégias de investimento. Descubra se ${ticker} está subvalorizada ou sobrevalorizada.`,
      alternates: {
        canonical: `/acao/${ticker}`,
      }
    }
  }
}

export default async function TickerPage({ params }: PageProps) {
  const resolvedParams = await params
  const ticker = resolvedParams.ticker.toUpperCase()

  // Verificar sessão do usuário para recursos premium
  const session = await getServerSession(authOptions)
  let userIsPremium = false

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        subscriptionTier: true, 
        premiumExpiresAt: true 
      }
    })

    userIsPremium = user?.subscriptionTier === 'PREMIUM' && 
                   (!user.premiumExpiresAt || user.premiumExpiresAt > new Date())
  }

  // Buscar dados da empresa
  const companyData = await prisma.company.findUnique({
    where: { ticker },
    include: {
      financialData: {
        orderBy: { year: 'desc' },
        take: 1
      },
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1
      }
    }
  })

  if (!companyData) {
    notFound()
  }

  // Buscar dados financeiros completos (trimestrais)
  const comprehensiveData = await getComprehensiveFinancialData(ticker)

  const latestFinancials = companyData.financialData[0]
  const latestQuote = companyData.dailyQuotes[0]
  const currentPrice = toNumber(latestQuote?.price) || toNumber(latestFinancials?.lpa) || 0

  // Buscar concorrentes do mesmo setor/subsetor (5 concorrentes + empresa atual = 6 total)
  const competitors = await getSectorCompetitors(ticker, companyData.sector, companyData.industry, 5)
  
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

  return (
    <>
      {/* Barra de Busca no Topo */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto py-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-semibold">Análise de Ações</h1>
              <div className="hidden sm:block text-sm text-muted-foreground">
                {companyData.name} ({ticker})
              </div>
            </div>
            <div className="w-full max-w-md">
              <CompanySearch 
                placeholder="Buscar outras empresas..."
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto py-8 px-4">
        {/* Layout Responsivo: 2 Cards Separados */}
        <div className="mb-8">
          {/* Desktop: Cards lado a lado */}
          <div className="lg:flex lg:space-x-6 space-y-6 lg:space-y-0">
            
            {/* Card do Header da Empresa */}
            <Card className="flex-1">
              <CardContent className="p-6">
                <div className="flex items-start space-x-6">
                  {/* Logo da empresa com fallback */}
                  <div className="flex-shrink-0">
                    <CompanyLogo
                      logoUrl={companyData.logoUrl}
                      companyName={companyData.name}
                      ticker={ticker}
                      size={80}
                    />
                  </div>

                  {/* Informações básicas */}
                  <div className="flex-1">
                    {/* Header: Ticker + Preço (Responsivo) */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-3">
                      {/* Ticker e Setor */}
                      <div className="flex items-center space-x-3 mb-3 md:mb-0">
                        <h1 className="text-3xl font-bold">{ticker}</h1>
                        <Badge variant="secondary" className="text-sm">
                          {companyData.sector || 'N/A'}
                        </Badge>
                      </div>
                      
                      {/* Preço - Mobile: abaixo do ticker, Desktop: ao lado direito */}
                      <div className="md:text-right md:flex-shrink-0">
                        <p className="text-sm text-muted-foreground">Preço Atual</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(currentPrice)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Último dado disponível
                        </p>
                      </div>
                    </div>
                    
                    <h2 className="text-xl text-muted-foreground mb-4">
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

                    {/* Botão de Ação */}
                    {smartComparatorUrl && (
                      <div className="mb-4">
                        <Button asChild>
                          <Link href={smartComparatorUrl}>
                            <GitCompare className="w-4 h-4 mr-2" />
                            Comparador Inteligente
                          </Link>
                        </Button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                      {companyData.industry && (
                        <div className="flex items-center space-x-2">
                          <PieChart className="w-4 h-4 text-muted-foreground" />
                          <span>{companyData.industry}</span>
                        </div>
                      )}
                      
                      {companyData.website && (
                        <div className="flex items-center space-x-2">
                          <Eye className="w-4 h-4 text-muted-foreground" />
                          <Link 
                            href={companyData.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Site oficial
                          </Link>
                        </div>
                      )}
                      
                      {(companyData.city || companyData.state) && (
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {[companyData.city, companyData.state].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}

                      {companyData.fullTimeEmployees && (
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>{companyData.fullTimeEmployees.toLocaleString()} funcionários</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card do Score - Separado */}
            <div className="lg:flex-shrink-0">
              <HeaderScoreWrapper ticker={ticker} />
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
              />
            )}

            {/* Indicadores Financeiros com Gráficos */}
            <FinancialIndicators 
              ticker={ticker}
              latestFinancials={serializedFinancials}
              comprehensiveData={comprehensiveData}
            />

            {/* Análise com IA */}
            <AIAnalysis
              ticker={ticker}
              name={companyData.name}
              sector={companyData.sector}
              currentPrice={currentPrice}
              financials={serializedFinancials}
              userIsPremium={userIsPremium}
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
                    Esta seção apresenta <strong>dados trimestrais</strong> mais recentes e detalhados, 
                    complementando os indicadores anuais mostrados acima. Ideal para análise de tendências 
                    e performance recente da empresa.
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
              "url": `https://preço-justo.ai/acao/${ticker}`,
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
    </>
  )
}
