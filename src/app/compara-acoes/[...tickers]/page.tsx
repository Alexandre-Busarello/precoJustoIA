import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CompanyLogo } from '@/components/company-logo'
import Link from 'next/link'

// Shadcn UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ComparisonTable } from '@/components/comparison-table'

// Lucide Icons
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Percent,
  DollarSign,
  Target,
  BarChart3,
  Activity,
  PieChart,
  Eye,
  User,
  LineChart,
  ArrowRight,
  Lock,
  Crown
} from 'lucide-react'

interface PageProps {
  params: {
    tickers: string[]
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

// Função helper para determinar tipo de indicador
function getIndicatorType(value: number | null, positiveThreshold?: number, negativeThreshold?: number): 'positive' | 'negative' | 'neutral' | 'default' {
  if (value === null) return 'default'
  
  if (positiveThreshold !== undefined && value >= positiveThreshold) return 'positive'
  if (negativeThreshold !== undefined && value <= negativeThreshold) return 'positive'
  if (positiveThreshold !== undefined && value < positiveThreshold) return 'negative'
  if (negativeThreshold !== undefined && value > negativeThreshold) return 'negative'
  
  return 'neutral'
}

// Componente para indicador com blur premium
function ComparisonIndicatorCard({ 
  title, 
  values, 
  tickers,
  icon: Icon, 
  description,
  isPremium = false,
  userIsPremium = false
}: {
  title: string
  values: (string | number)[]
  tickers: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any
  description?: string
  isPremium?: boolean
  userIsPremium?: boolean
}) {
  const shouldBlur = isPremium && !userIsPremium

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <Icon className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {isPremium && (
            <Crown className="w-4 h-4 text-yellow-500" />
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className={`space-y-3 ${shouldBlur ? 'blur-sm' : ''}`}>
        {tickers.map((ticker, index) => (
          <div key={ticker} className="flex justify-between items-center">
            <span className="text-sm font-medium">{ticker}</span>
            <span className="text-sm">{values[index] || 'N/A'}</span>
          </div>
        ))}
      </CardContent>
      {shouldBlur && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="text-center p-4">
            <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium mb-2">Recurso Premium</p>
            <Button size="sm" asChild>
              <Link href="/dashboard">
                <Crown className="w-4 h-4 mr-2" />
                Fazer Upgrade
              </Link>
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// Gerar metadata dinâmico para SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const tickers = resolvedParams.tickers.map(t => t.toUpperCase())
  
  if (tickers.length < 2) {
    return {
      title: 'Comparação de Ações - Preço Justo AI',
      description: 'Compare ações da B3 com análise fundamentalista completa.'
    }
  }

  try {
    const companies = await prisma.company.findMany({
      where: { 
        ticker: { in: tickers }
      },
      select: {
        ticker: true,
        name: true,
        sector: true
      }
    })

    const foundTickers = companies.map(c => c.ticker).join(' vs ')
    const companyNames = companies.map(c => c.name).join(', ')
    
    const title = `Comparação ${foundTickers} | Análise Comparativa de Ações - Preço Justo AI`
    const description = `Compare as ações ${foundTickers} (${companyNames}) com análise fundamentalista completa. Indicadores financeiros, valuation, estratégias de investimento e scores lado a lado.`

    return {
      title,
      description,
      keywords: `${foundTickers}, comparação de ações, análise comparativa, ${companyNames}, B3, bovespa, investimentos, análise fundamentalista, valuation`,
      openGraph: {
        title,
        description,
        type: 'article',
        url: `/compara-acoes/${tickers.join('/')}`,
        siteName: 'Preço Justo AI',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        creator: '@PrecoJustoAI',
        site: '@PrecoJustoAI'
      },
      alternates: {
        canonical: `/compara-acoes/${tickers.join('/')}`,
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
    }
  } catch {
    return {
      title: `Comparação ${tickers.join(' vs ')} | Análise Comparativa de Ações - Preço Justo AI`,
      description: `Compare as ações ${tickers.join(', ')} com análise fundamentalista completa, indicadores financeiros e estratégias de investimento.`,
      alternates: {
        canonical: `/compara-acoes/${tickers.join('/')}`,
      }
    }
  }
}

export default async function CompareStocksPage({ params }: PageProps) {
  const resolvedParams = await params
  const tickers = resolvedParams.tickers.map(t => t.toUpperCase())

  // Validar se há pelo menos 2 tickers
  if (tickers.length < 2) {
    notFound()
  }

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

  // Buscar dados das empresas
  const companiesData = await prisma.company.findMany({
    where: { 
      ticker: { in: tickers }
    },
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

  // Verificar se todas as empresas foram encontradas
  const foundTickers = companiesData.map(c => c.ticker)
  const missingTickers = tickers.filter(t => !foundTickers.includes(t))
  
  if (missingTickers.length > 0) {
    notFound()
  }

  // Organizar dados na ordem dos tickers solicitados
  const orderedCompanies = tickers.map(ticker => 
    companiesData.find(c => c.ticker === ticker)!
  )

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header da Comparação */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-4">
          <BarChart3 className="w-6 h-6" />
          <h1 className="text-3xl font-bold">Comparação de Ações</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {tickers.map((ticker, index) => (
            <div key={ticker} className="flex items-center">
              <Badge variant="outline" className="text-lg px-3 py-1">
                {ticker}
              </Badge>
              {index < tickers.length - 1 && (
                <ArrowRight className="w-4 h-4 mx-2 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        <p className="text-muted-foreground">
          Análise comparativa detalhada entre {tickers.length} ações da B3
        </p>
      </div>

      {/* Cards das Empresas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {orderedCompanies.map((company) => {
          const latestFinancials = company.financialData[0]
          const latestQuote = company.dailyQuotes[0]
          const currentPrice = toNumber(latestQuote?.price) || toNumber(latestFinancials?.lpa) || 0

          return (
            <Card key={company.ticker}>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4 mb-4">
                  <CompanyLogo
                    logoUrl={company.logoUrl}
                    companyName={company.name}
                    ticker={company.ticker}
                    size={60}
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-xl font-bold">{company.ticker}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {company.sector || 'N/A'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {company.name}
                    </p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(currentPrice)}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  {company.industry && (
                    <div className="flex items-center space-x-2">
                      <PieChart className="w-4 h-4 text-muted-foreground" />
                      <span>{company.industry}</span>
                    </div>
                  )}
                  
                  {(company.city || company.state) && (
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {[company.city, company.state].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}

                  {company.fullTimeEmployees && (
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{company.fullTimeEmployees.toLocaleString()} funcionários</span>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/acao/${company.ticker}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      Ver Análise Completa
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Indicadores Comparativos */}
      <div className="space-y-8">
        {/* Indicadores Básicos */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <Target className="w-6 h-6 mr-2" />
            Indicadores Fundamentalistas
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ComparisonIndicatorCard
              title="P/L (Preço/Lucro)"
              values={orderedCompanies.map(c => {
                const pl = toNumber(c.financialData[0]?.pl)
                return pl ? pl.toFixed(2) : 'N/A'
              })}
              tickers={tickers}
              icon={DollarSign}
              description="Quanto o mercado paga por cada R$ 1 de lucro"
            />

            <ComparisonIndicatorCard
              title="P/VP (Preço/Valor Patrimonial)"
              values={orderedCompanies.map(c => {
                const pvp = toNumber(c.financialData[0]?.pvp)
                return pvp ? pvp.toFixed(2) : 'N/A'
              })}
              tickers={tickers}
              icon={Building2}
              description="Relação entre preço da ação e valor patrimonial"
            />

            <ComparisonIndicatorCard
              title="ROE (Retorno sobre Patrimônio)"
              values={orderedCompanies.map(c => {
                const roe = toNumber(c.financialData[0]?.roe)
                return roe ? formatPercent(roe) : 'N/A'
              })}
              tickers={tickers}
              icon={TrendingUp}
              description="Capacidade de gerar lucro com o patrimônio"
            />

            <ComparisonIndicatorCard
              title="Dividend Yield"
              values={orderedCompanies.map(c => {
                const dy = toNumber(c.financialData[0]?.dy)
                return dy ? formatPercent(dy) : 'N/A'
              })}
              tickers={tickers}
              icon={Percent}
              description="Rendimento anual em dividendos"
            />

            <ComparisonIndicatorCard
              title="Margem Líquida"
              values={orderedCompanies.map(c => {
                const ml = toNumber(c.financialData[0]?.margemLiquida)
                return ml ? formatPercent(ml) : 'N/A'
              })}
              tickers={tickers}
              icon={Activity}
              description="Percentual de lucro sobre a receita"
              isPremium={true}
              userIsPremium={userIsPremium}
            />

            <ComparisonIndicatorCard
              title="ROIC (Retorno sobre Capital Investido)"
              values={orderedCompanies.map(c => {
                const roic = toNumber(c.financialData[0]?.roic)
                return roic ? formatPercent(roic) : 'N/A'
              })}
              tickers={tickers}
              icon={Target}
              description="Eficiência no uso do capital investido"
              isPremium={true}
              userIsPremium={userIsPremium}
            />
          </div>
        </div>

        {/* Indicadores de Tamanho */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <BarChart3 className="w-6 h-6 mr-2" />
            Tamanho e Escala
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ComparisonIndicatorCard
              title="Valor de Mercado"
              values={orderedCompanies.map(c => {
                const marketCap = toNumber(c.financialData[0]?.marketCap)
                return marketCap ? formatLargeNumber(marketCap) : 'N/A'
              })}
              tickers={tickers}
              icon={DollarSign}
              description="Valor total da empresa no mercado"
            />

            <ComparisonIndicatorCard
              title="Receita Total"
              values={orderedCompanies.map(c => {
                const receita = toNumber(c.financialData[0]?.receitaTotal)
                return receita ? formatLargeNumber(receita) : 'N/A'
              })}
              tickers={tickers}
              icon={TrendingUp}
              description="Faturamento anual da empresa"
            />

            <ComparisonIndicatorCard
              title="Lucro Líquido"
              values={orderedCompanies.map(c => {
                const lucro = toNumber(c.financialData[0]?.lucroLiquido)
                return lucro ? formatLargeNumber(lucro) : 'N/A'
              })}
              tickers={tickers}
              icon={Activity}
              description="Lucro após todos os custos e impostos"
              isPremium={true}
              userIsPremium={userIsPremium}
            />
          </div>
        </div>

        {/* Indicadores de Endividamento - Premium */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <TrendingDown className="w-6 h-6 mr-2" />
            Endividamento e Solidez
            <Crown className="w-5 h-5 ml-2 text-yellow-500" />
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ComparisonIndicatorCard
              title="Dívida Líquida/EBITDA"
              values={orderedCompanies.map(c => {
                const divEbitda = toNumber(c.financialData[0]?.dividaLiquidaEbitda)
                return divEbitda ? divEbitda.toFixed(2) : 'N/A'
              })}
              tickers={tickers}
              icon={TrendingDown}
              description="Capacidade de pagamento da dívida"
              isPremium={true}
              userIsPremium={userIsPremium}
            />

            <ComparisonIndicatorCard
              title="Dívida Líquida/Patrimônio"
              values={orderedCompanies.map(c => {
                const divPat = toNumber(c.financialData[0]?.dividaLiquidaPatrimonio)
                return divPat ? divPat.toFixed(2) : 'N/A'
              })}
              tickers={tickers}
              icon={Building2}
              description="Endividamento em relação ao patrimônio"
              isPremium={true}
              userIsPremium={userIsPremium}
            />

            <ComparisonIndicatorCard
              title="Liquidez Corrente"
              values={orderedCompanies.map(c => {
                const lc = toNumber(c.financialData[0]?.liquidezCorrente)
                return lc ? lc.toFixed(2) : 'N/A'
              })}
              tickers={tickers}
              icon={Activity}
              description="Capacidade de honrar compromissos de curto prazo"
              isPremium={true}
              userIsPremium={userIsPremium}
            />
          </div>
        </div>
      </div>

      {/* Tabela de Comparação Detalhada */}
      <div className="mb-8">
        <ComparisonTable 
          companies={orderedCompanies.map(company => ({
            ticker: company.ticker,
            name: company.name,
            sector: company.sector,
            currentPrice: toNumber(company.dailyQuotes[0]?.price) || toNumber(company.financialData[0]?.lpa) || 0,
            financialData: company.financialData[0] ? {
              pl: toNumber(company.financialData[0].pl),
              pvp: toNumber(company.financialData[0].pvp),
              roe: toNumber(company.financialData[0].roe),
              dy: toNumber(company.financialData[0].dy),
              margemLiquida: toNumber(company.financialData[0].margemLiquida),
              roic: toNumber(company.financialData[0].roic),
              marketCap: toNumber(company.financialData[0].marketCap),
              receitaTotal: toNumber(company.financialData[0].receitaTotal),
              lucroLiquido: toNumber(company.financialData[0].lucroLiquido),
              dividaLiquidaEbitda: toNumber(company.financialData[0].dividaLiquidaEbitda),
              dividaLiquidaPatrimonio: toNumber(company.financialData[0].dividaLiquidaPatrimonio),
              liquidezCorrente: toNumber(company.financialData[0].liquidezCorrente),
            } : null
          }))}
          userIsPremium={userIsPremium}
        />
      </div>

      {/* Links para análises individuais */}
      <div className="mt-12">
        <Separator className="mb-6" />
        <h3 className="text-lg font-semibold mb-4">Análises Individuais Detalhadas</h3>
        <div className="flex flex-wrap gap-3">
          {orderedCompanies.map((company) => (
            <Button key={company.ticker} asChild variant="outline">
              <Link href={`/acao/${company.ticker}`}>
                <LineChart className="w-4 h-4 mr-2" />
                Análise Completa {company.ticker}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Schema Structured Data para SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": `Comparação ${tickers.join(' vs ')} - Análise Comparativa de Ações`,
            "description": `Análise comparativa detalhada entre as ações ${tickers.join(', ')} com indicadores financeiros, valuation e métricas fundamentalistas.`,
            "url": `https://preço-justo.ai/compara-acoes/${tickers.join('/')}`,
            "author": {
              "@type": "Organization",
              "name": "Preço Justo AI"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Preço Justo AI"
            },
            "datePublished": new Date().toISOString(),
            "dateModified": new Date().toISOString(),
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": `https://preço-justo.ai/compara-acoes/${tickers.join('/')}`
            },
            "about": tickers.map(ticker => ({
              "@type": "Corporation",
              "tickerSymbol": ticker,
              "exchange": "B3"
            }))
          })
        }}
      />
    </div>
  )
}
