import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { CompanyLogo } from '@/components/company-logo'
import { CompanySizeBadge } from '@/components/company-size-badge'
import StrategicAnalysisClient from '@/components/strategic-analysis-client'
import HeaderScoreWrapper from '@/components/header-score-wrapper'
import AIAnalysis from '@/components/ai-analysis'
import FinancialIndicators from '@/components/financial-indicators'
import ComprehensiveFinancialView from '@/components/comprehensive-financial-view'
import TechnicalAnalysisSection from '@/components/technical-analysis-section'
import { AddToBacktestButton } from '@/components/add-to-backtest-button'
import { RelatedCompanies } from '@/components/related-companies'
import { Footer } from '@/components/footer'
import { getComprehensiveFinancialData } from '@/lib/financial-data-service'
import { cache } from '@/lib/cache-service'
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
  Info
} from 'lucide-react'

interface PageProps {
  params: {
    ticker: string
  }
}

interface CompetitorData {
  ticker: string;
  name: string;
  sector: string | null;
  logoUrl?: string | null;
  marketCap?: any;
}


// Funções de formatação definidas mais abaixo


// Função para extrair prefixo do ticker (remove números finais)
function getTickerPrefix(ticker: string): string {
  return ticker.replace(/\d+$/, '') // Remove números no final
}

// Função para determinar o tamanho da empresa (reutiliza lógica do filterCompaniesBySize)
function getCompanySize(marketCap: number | null): 'small_caps' | 'mid_caps' | 'blue_chips' | null {
  if (!marketCap) return null;
  
  // Valores em bilhões de reais
  const marketCapBillions = marketCap / 1_000_000_000;
  
  if (marketCapBillions < 2) {
    return 'small_caps'; // Menos de R$ 2 bilhões
  } else if (marketCapBillions >= 2 && marketCapBillions < 10) {
    return 'mid_caps'; // R$ 2-10 bilhões
  } else {
    return 'blue_chips'; // Mais de R$ 10 bilhões
  }
}

// Cache agora usa Redis com fallback para memória
const COMPETITORS_CACHE_TTL = 1440 * 60 // 1 dia em segundos
const METADATA_CACHE_TTL = 60 * 60 // 60 minutos em segundos

// Função mista: combina empresas inteligentes (premium) + básicas para SEO
async function getMixedRelatedCompanies(
  currentTicker: string, 
  sector: string | null, 
  intelligentCompetitors: CompetitorData[], 
  limit: number = 6
): Promise<CompetitorData[]> {
  if (!sector) return []
  
  try {
    // Pegar 2-3 empresas do comparador inteligente (as melhores)
    const intelligentPick = intelligentCompetitors.slice(0, 3)
    const intelligentTickers = intelligentPick.map(c => c.ticker)
    
    // Completar com empresas básicas do setor (excluindo as já selecionadas)
    const remainingSlots = limit - intelligentPick.length
    const basicCompanies = await getBasicRelatedCompanies(
      currentTicker, 
      sector, 
      remainingSlots + 3, // Buscar mais para ter opções
      [...intelligentTickers, currentTicker] // Excluir empresas já selecionadas
    )
    
    // Combinar e limitar ao total desejado
    const mixed = [...intelligentPick, ...basicCompanies.slice(0, remainingSlots)]
    return mixed.slice(0, limit)
    
  } catch (error) {
    console.error('❌ Erro ao buscar empresas relacionadas mistas:', error)
    return []
  }
}

// Função básica para empresas relacionadas (SEO) - sem inteligência premium
async function getBasicRelatedCompanies(
  currentTicker: string, 
  sector: string | null, 
  limit: number = 6, 
  excludeTickers: string[] = []
): Promise<CompetitorData[]> {
  if (!sector) return []
  
  try {
    // Busca simples por setor, ordenada por market cap (sem inteligência premium)
    const companies = await prisma.company.findMany({
      where: {
        sector: sector,
        ticker: { 
          notIn: excludeTickers.length > 0 ? excludeTickers : [currentTicker]
        },
        // Apenas empresas com dados financeiros básicos
        financialData: {
          some: {
            marketCap: { not: null }
          }
        }
      },
      select: {
        ticker: true,
        name: true,
        sector: true,
        logoUrl: true,
        financialData: {
          select: {
            marketCap: true,
          },
          orderBy: { year: 'desc' },
          take: 1
        }
      },
      orderBy: {
        financialData: {
          _count: 'desc' // Priorizar empresas com mais dados
        }
      },
      take: limit
    })

    return companies.map(company => ({
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      logoUrl: company.logoUrl,
      marketCap: company.financialData[0]?.marketCap || null
    } as CompetitorData))

  } catch (error) {
    console.error('❌ Erro ao buscar empresas relacionadas:', error)
    return []
  }
}

// Função para buscar concorrentes do mesmo setor com priorização de subsetor (otimizada)
async function getSectorCompetitors(currentTicker: string, sector: string | null, industry: string | null, currentMarketCap: number | null = null, limit: number = 5): Promise<CompetitorData[]> {
  if (!sector) return []
  
  try {
    // Determinar o tamanho da empresa atual
    const currentCompanySize = getCompanySize(currentMarketCap)
    
    // Verificar cache primeiro (incluir tamanho na chave do cache)
    const cacheKey = `competitors-${currentTicker}-${sector}-${industry}-${currentCompanySize}-${limit}-v2`
    const cached = await cache.get<{ ticker: string; name: string; sector: string | null }[]>(cacheKey, {
      prefix: 'companies',
      ttl: COMPETITORS_CACHE_TTL
    })
    
    if (cached) {
      console.log('📋 Usando concorrentes do cache para', currentTicker)
      return cached
    }

    const currentPrefix = getTickerPrefix(currentTicker)
    const currentYear = new Date().getFullYear()
    
    // Sempre incluir dados financeiros para filtrar por tamanho e lucro
    // Para blue chips, incluir dados financiais para filtrar por market cap
    
    const allCompetitors = await prisma.company.findMany({
      where: {
        OR: [
          { industry: industry || undefined },
          { sector: sector }
        ],
        ticker: { not: currentTicker },
        // Filtrar empresas com dados financeiros recentes e com lucro positivo
        financialData: {
          some: {
            year: { gte: currentYear - 1 },
            // Excluir empresas com prejuízo (lucro líquido negativo ou nulo)
            lucroLiquido: {
              gt: 0
            }
          }
        }
      },
      select: {
        ticker: true,
        name: true,
        sector: true,
        industry: true,
        logoUrl: true,
        // Incluir dados financiais apenas se for blue chip
        financialData: {
          select: {
            marketCap: true,
            lucroLiquido: true,
            year: true
          },
          where: {
            year: { gte: currentYear - 1 },
            lucroLiquido: {
              gt: 0
            }
          },
          orderBy: { year: 'desc' },
          take: 1
        }
      },
      orderBy: [
        { industry: industry ? 'asc' : 'desc' }, // Priorizar industry se especificado
        { ticker: 'asc' }
      ],
      take: limit * 10 // Buscar mais para ter opções após filtrar prefixos, tamanho e lucro
    })

    // Filtrar empresas com mesmo prefixo e priorizar por industry
    const seenPrefixes = new Set([currentPrefix])
    const competitors: { ticker: string; name: string; sector: string | null }[] = []
    
    // Função auxiliar para verificar se a empresa atende aos critérios
    const isValidCompetitor = (company: any, allowDifferentSizes: boolean = false): boolean => {
      const companyPrefix = getTickerPrefix(company.ticker)
      if (seenPrefixes.has(companyPrefix)) return false
      
      // Verificar se tem dados financeiros válidos
      const financialData = company.financialData?.[0]
      if (!financialData) return false
      
      // Verificar se tem lucro positivo (já filtrado na query, mas double check)
      const lucroLiquido = toNumber(financialData.lucroLiquido)
      if (!lucroLiquido || lucroLiquido <= 0) return false
      
      // Filtrar por tamanho de empresa (comparar com empresa atual)
      if (currentCompanySize && !allowDifferentSizes) {
        const competitorMarketCap = toNumber(financialData.marketCap)
        if (competitorMarketCap) {
          const competitorSize = getCompanySize(competitorMarketCap)
          // Só incluir empresas do mesmo tamanho
          if (competitorSize !== currentCompanySize) return false
        } else {
          return false // Se não tem market cap, não incluir
        }
      } else if (currentCompanySize && allowDifferentSizes) {
        // No modo fallback, ainda precisamos de market cap válido
        const competitorMarketCap = toNumber(financialData.marketCap)
        if (!competitorMarketCap) return false
      }
      
      return true
    }
    
    // Função auxiliar para processar empresas com critério específico
    const processCompanies = (companies: any[], filterFn: (company: any) => boolean, allowDifferentSizes: boolean = false) => {
      for (const company of companies) {
        if (competitors.length >= limit) break
        if (filterFn(company) && isValidCompetitor(company, allowDifferentSizes)) {
          const companyPrefix = getTickerPrefix(company.ticker)
          seenPrefixes.add(companyPrefix)
          competitors.push({
            ticker: company.ticker,
            name: company.name,
            sector: company.sector,
            logoUrl: company.logoUrl,
            marketCap: company.financialData[0]?.marketCap || null
          } as CompetitorData)
        }
      }
    }

    // PASSADA 1: Empresas do mesmo tamanho
    // Primeiro: empresas do mesmo industry e mesmo tamanho
    if (industry) {
      processCompanies(
        allCompetitors,
        (company) => company.industry === industry,
        false // Só mesmo tamanho
      )
    }
    
    // Depois: empresas do mesmo setor e mesmo tamanho (se ainda precisar)
    if (competitors.length < limit) {
      processCompanies(
        allCompetitors,
        (company) => company.sector === sector,
        false // Só mesmo tamanho
      )
    }

    // PASSADA 2: Fallback para outros tamanhos (se ainda não temos 6 empresas)
    if (competitors.length < limit) {
      console.log(`🔄 Fallback: apenas ${competitors.length} empresas do mesmo tamanho encontradas, buscando outros tamanhos...`)
      
      // Primeiro: empresas do mesmo industry (qualquer tamanho)
      if (industry) {
        processCompanies(
          allCompetitors,
          (company) => company.industry === industry,
          true // Permitir tamanhos diferentes
        )
      }
      
      // Depois: empresas do mesmo setor (qualquer tamanho)
      if (competitors.length < limit) {
        processCompanies(
          allCompetitors,
          (company) => company.sector === sector,
          true // Permitir tamanhos diferentes
        )
      }
    }

    // Log para debug
    const sameSize = competitors.filter(comp => {
      const financialData = allCompetitors.find(c => c.ticker === comp.ticker)?.financialData?.[0]
      if (!financialData) return false
      const competitorMarketCap = toNumber(financialData.marketCap)
      const competitorSize = getCompanySize(competitorMarketCap)
      return competitorSize === currentCompanySize
    }).length
    
    console.log(`🔍 Empresa ${currentTicker} (${currentCompanySize}): encontrados ${competitors.length} concorrentes válidos (${sameSize} do mesmo tamanho, ${competitors.length - sameSize} de outros tamanhos)`)

    // Armazenar no cache
    await cache.set(cacheKey, competitors, {
      prefix: 'companies',
      ttl: COMPETITORS_CACHE_TTL
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

  // Buscar dados da empresa e dados financeiros completos em paralelo (incluindo dados históricos)
  const [companyData, comprehensiveData] = await Promise.all([
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
    getComprehensiveFinancialData(ticker, 'YEARLY', 7)
  ])


  if (!companyData) {
    notFound()
  }

  const latestFinancials = companyData.financialData[0]
  const latestQuote = companyData.dailyQuotes[0]
  const currentPrice = toNumber(latestQuote?.price) || toNumber(latestFinancials?.lpa) || 0

  // Buscar concorrentes inteligentes para comparador premium
  const currentMarketCap = toNumber(latestFinancials?.marketCap)
  const competitors = companyData.sector 
    ? await getSectorCompetitors(ticker, companyData.sector, companyData.industry, currentMarketCap, 5)
    : []
  
  // Buscar empresas relacionadas mesclando inteligentes + básicas para SEO
  const relatedCompanies = companyData.sector 
    ? await getMixedRelatedCompanies(ticker, companyData.sector, competitors, 6)
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

  return (
    <>
      {/* Barra de Busca no Topo */}
      {/* <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto py-4 px-4">
          <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold truncate">Análise de Ações</h2>
              <div className="hidden md:block text-sm text-muted-foreground truncate">
                {companyData.name} ({ticker})
              </div>
            </div>
            <div className="w-full sm:w-auto sm:max-w-md">
              <CompanySearch 
                placeholder="Buscar outras empresas..."
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div> */}

      <div className="container mx-auto py-8 px-4">
        {/* Layout Responsivo: 2 Cards Separados */}
        <div className="mb-8">
          {/* Desktop: Cards lado a lado */}
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
                userIsPremium={userIsPremium}
              />
            )}

            {/* Análise Técnica - Logo após as análises fundamentalistas */}
            <TechnicalAnalysisSection 
              ticker={ticker} 
              userIsPremium={userIsPremium}
            />

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
              marketCap: comp.marketCap || null
            }))}
            currentTicker={ticker}
            currentSector={companyData.sector}
            currentIndustry={companyData.industry}
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
    </>
  )
}
