import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { getCompanySizeInfo } from '@/components/company-size-badge'
import StrategicAnalysisClient, { StatementsAnalysisSection, StockSummaryHeader } from '@/components/strategic-analysis-client'
import { PageCacheIndicator } from '@/components/page-cache-indicator'
import AIAnalysisDual from '@/components/ai-analysis-dual'
import FinancialIndicators from '@/components/financial-indicators'
import ComprehensiveFinancialView from '@/components/comprehensive-financial-view'
import TechnicalAnalysisLink from '@/components/technical-analysis-link'
import MarketSentimentSection from '@/components/market-sentiment-section'
import { AutoSubscribeHandler } from '@/components/auto-subscribe-handler'
import { RelatedCompanies } from '@/components/related-companies'
import { TrackingAssetView } from '@/components/tracking-asset-view'
import { getComprehensiveFinancialData } from '@/lib/financial-data-service'
import { cache } from '@/lib/cache-service'
import { getSectorCompetitors, getMixedRelatedCompanies } from '@/lib/competitor-service'
import { DividendRadarCompact } from '@/components/dividend-radar-compact'
import { DividendService } from '@/lib/dividend-service'
import { DividendRadarService } from '@/lib/dividend-radar-service'
import { ensureTodayPrice } from '@/lib/quote-service'
import { StrategyFactory } from '@/lib/strategies/strategy-factory'
import { STRATEGY_CONFIG } from '@/lib/strategies/strategy-config'
import type { CompanyData } from '@/lib/strategies/types'
import Link from 'next/link'
import { CompanyFlagBanner } from '@/components/company-flag-banner'
import { checkAndRecordUsage } from '@/lib/usage-based-pricing-service'
import { RateLimitMiddleware } from '@/lib/rate-limit-middleware'
import { AnonLimitCTA } from '@/components/anon-limit-cta'
import { FollowAssetCard } from '@/components/asset/follow-asset-card'
import { AssetSectionNav, type AssetSection } from '@/components/asset/asset-section-nav'
import { SectionHeader } from '@/components/ui/section-header'
import { Button } from '@/components/ui/button'
import { formatBRL, formatBRLCompact, formatDeltaPct, formatMultiple, formatNumber, formatPct } from '@/lib/format'
import { marginOfSafety, valuationStatusLabel } from '@/lib/valuation-metrics'
import { InfoHint } from '@/components/ui/info-hint'
import { getLiquidityFlag, type LiquidityFlag } from '@/lib/rank-builder-service'

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

const SECTIONS: AssetSection[] = [
  { id: 'valuation', label: 'Valuation' },
  { id: 'indicadores', label: 'Indicadores' },
  { id: 'dividendos', label: 'Dividendos' },
  { id: 'demonstracoes', label: 'Demonstrações' },
  { id: 'analise-ia', label: 'Análise IA' },
  { id: 'tecnica', label: 'Técnica' },
]

/** Preço justo pelo Número de Graham (√(22,5 × LPA × VPA)); `null` sem LPA e VPA positivos. */
function grahamFairValue(lpa: number | null, vpa: number | null): number | null {
  if (!lpa || !vpa || lpa <= 0 || vpa <= 0) return null
  return Math.sqrt(22.5 * lpa * vpa)
}

// Gerar metadata dinâmico para SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const tickerParam = resolvedParams.ticker // Manter ticker original da URL
  const ticker = tickerParam.toUpperCase() // Converter para maiúsculo apenas para consulta no BD
  
  // Verificar cache primeiro
  const cacheKey = `metadata-v2-${ticker}`
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
            updatedAt: true,
            lpa: true,
            vpa: true
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
        title: `${ticker}: ticker não encontrado`,
        description: `O ticker ${ticker} não foi encontrado em nossa base de dados de análise de ações.`
      }
    }

    const latestFinancials = company.financialData[0]
    const currentPrice = toNumber(company.dailyQuotes[0]?.price) || 0
    const anoAtual = new Date().getFullYear()
    
    // Tentar calcular preço justo via Graham (leve, não bloqueia)
    let fairPrice: number | null = null
    let upside: number | null = null
    try {
      const companyAnalysisData: CompanyData = {
        ticker,
        name: company.name,
        sector: company.sector,
        currentPrice,
        financials: {
          lpa: toNumber(latestFinancials?.lpa) || null,
          vpa: toNumber(latestFinancials?.vpa) || null,
          pl: toNumber(latestFinancials?.pl) || null,
          roe: toNumber(latestFinancials?.roe) || null,
          roa: null,
          dy: null,
          pvp: null,
          evEbitda: null,
          margemBruta: null,
          margemEbitda: null,
          margemLiquida: null,
          payout: null,
          crescimentoReceitas: null,
          crescimentoLucros: null,
          dividaLiquidaEbitda: null,
          dividaLiquidaPatrimonio: null,
          patrimonioLiquido: null,
          ativoTotal: null,
          disponibilidades: null,
          ativoCirculante: null,
          passivoCirculante: null,
          ebitda: null,
          receitaLiquida: null,
          lucroLiquido: null,
          fluxoCaixaOperacional: null,
          fluxoCaixaLivre: null,
          capex: null,
          sharesOutstanding: null,
          marketCap: toNumber(latestFinancials?.marketCap) || null,
        },
        historicalFinancials: []
      }
      const grahamAnalysis = StrategyFactory.runGrahamAnalysis(companyAnalysisData, STRATEGY_CONFIG.graham)
      fairPrice = grahamAnalysis.fairValue
      upside = grahamAnalysis.upside
    } catch {
      // Ignorar erro silenciosamente - não bloquear metadata
    }
    
    const title = `${ticker} (${company.name}): Preço Justo e Potencial ${anoAtual}`
    
    // Descrição para SEO com números em pt-BR; campos ausentes são omitidos
    const pl = toNumber(latestFinancials?.pl ?? null)
    const roe = toNumber(latestFinancials?.roe ?? null)
    let baseDescription = `Análise fundamentalista da ação ${company.name} (${ticker}). Preço atual ${formatBRL(currentPrice)}`
    if (fairPrice && fairPrice > 0) {
      baseDescription += `, preço justo estimado em ${formatBRL(fairPrice)} pelo Número de Graham`
      if (upside !== null) {
        baseDescription += ` (potencial de ${formatDeltaPct(upside / 100)})`
      }
    }
    const extras = [
      pl !== null ? `P/L ${formatMultiple(pl)}` : null,
      roe !== null ? `ROE ${formatPct(roe)}` : null,
      company.sector ? `setor ${company.sector}` : null,
    ].filter(Boolean)
    baseDescription += extras.length > 0 ? `. ${extras.join(', ')}.` : '.'

    const companyInfo = company.description 
      ? ` ${company.description.substring(0, 80)}...` 
      : ''
    
    const description = `${baseDescription}${companyInfo} Veja o score atualizado e a análise com IA.`

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
      title: `${ticker}: análise da ação`,
      description: `Análise fundamentalista completa da ação ${ticker} com indicadores financeiros, valuation e estratégias de investimento. Descubra se ${ticker} está subvalorizada ou sobrevalorizada.`,
      alternates: {
        canonical: `/acao/${tickerParam.toLowerCase()}`,
      }
    }
  }
}

/** Volume médio diário com a ajuda do badge "Baixa liquidez" do cabeçalho. */
function LiquidityNote({ flag }: { flag: LiquidityFlag }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className="tabular-nums">Volume médio: {flag.value === null ? 'sem dado' : `${formatBRLCompact(flag.value)}/dia`}</span>
      <InfoHint label="Sobre a baixa liquidez" content={flag.hint} />
    </span>
  )
}

export default async function TickerPage({ params }: PageProps) {
  const resolvedParams = await params
  const tickerParam = resolvedParams.ticker // Manter ticker original da URL
  const ticker = tickerParam.toUpperCase() // Converter para maiúsculo apenas para consulta no BD

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

  // Ticker inexistente: 404 antes de contar visualização, atualizar preço ou gerar projeções de proventos
  if (!company) {
    notFound()
  }

  if (!company.isActive && company.successor) {
    redirect(`/acao/${company.successor.ticker.toLowerCase()}`);
  }

  // Verificar sessão do usuário para recursos premium
  const session = await getServerSession(authOptions)
  let userIsPremium = false
  let canViewFullContent = false
  let shouldShowAnonLimitCTA = false

  // Verificar se é Premium - ÚNICA FONTE DA VERDADE
  if (session?.user?.id) {
    const user = await getCurrentUser()
    userIsPremium = user?.isPremium || false
    canViewFullContent = userIsPremium // Logado: full view = premium
  } else {
    // Anônimo: verificar limite de 2 visualizações completas por IP
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

  // Atualizar preço do dia atual ANTES de buscar dados (com timeout para não bloquear muito)
  // Isso garante que a página já carregue com o preço correto
  try {
    const priceUpdatePromise = ensureTodayPrice(ticker);
    const timeoutPromise = new Promise<boolean>((resolve) => 
      setTimeout(() => {
        console.log(`[${ticker}] Timeout ao atualizar preço, continuando...`);
        resolve(false);
      }, 5000) // Timeout de 5 segundos
    );
    
    // Aguardar atualização ou timeout, o que acontecer primeiro
    // Se a atualização completar em até 3 segundos, aguardamos
    // Se passar de 3 segundos, continuamos mesmo assim para não bloquear
    await Promise.race([priceUpdatePromise, timeoutPromise]);
  } catch (error) {
    console.error(`[${ticker}] Erro ao atualizar preço do dia:`, error);
    // Continuar mesmo se falhar - não bloquear carregamento da página
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
          take: 2 // Último pregão e o anterior (variação do dia)
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
  const previousQuote = companyData.dailyQuotes[1]
  const currentPrice = toNumber(latestQuote?.price) || 0
  const previousPrice = toNumber(previousQuote?.price)
  const dayChange = currentPrice > 0 && previousPrice && previousPrice > 0 ? currentPrice / previousPrice - 1 : null

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

  // Dados das empresas relacionadas para a tabela (preço, Graham e score só para quem pode ver)
  const isLoggedIn = !!session?.user?.id
  const canSeeGraham = isLoggedIn || canViewFullContent
  const relatedSlice = relatedCompanies.slice(0, 5)
  const relatedDetails = relatedSlice.length > 0
    ? await prisma.company.findMany({
        where: { ticker: { in: relatedSlice.map((c) => c.ticker) } },
        select: {
          ticker: true,
          dailyQuotes: { orderBy: { date: 'desc' }, take: 1, select: { price: true } },
          financialData: { orderBy: { year: 'desc' }, take: 1, select: { lpa: true, vpa: true } },
          snapshots: { where: { isLatest: true }, orderBy: { createdAt: 'desc' }, take: 1, select: { overallScore: true } },
        },
      })
    : []
  const relatedByTicker = new Map(relatedDetails.map((detail) => [detail.ticker, detail]))
  const relatedRows = relatedSlice.map((comp) => {
    const detail = relatedByTicker.get(comp.ticker)
    const financials = detail?.financialData[0]
    return {
      ticker: comp.ticker,
      name: comp.name,
      sector: comp.sector,
      logoUrl: comp.logoUrl || null,
      marketCap: toNumber(comp.marketCap ?? null),
      assetType: 'STOCK', // Empresas relacionadas são sempre ações na página de ações
      price: toNumber(detail?.dailyQuotes[0]?.price ?? null),
      fairValue: canSeeGraham ? grahamFairValue(toNumber(financials?.lpa ?? null), toNumber(financials?.vpa ?? null)) : null,
      score: canViewFullContent ? toNumber(detail?.snapshots[0]?.overallScore ?? null) : null,
    }
  })


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

  // Função para gerar FAQ Schema (apenas para usuários deslogados)
  const generateFAQSchema = () => {
    if (session) return null // Não gerar para usuários logados
    
    try {
      // Preparar dados da empresa para análise Graham
      const companyAnalysisData: CompanyData = {
        ticker,
        name: companyData.name,
        sector: companyData.sector,
        currentPrice,
        financials: {
          lpa: toNumber(latestFinancials?.lpa) || null,
          vpa: toNumber(latestFinancials?.vpa) || null,
          pl: toNumber(latestFinancials?.pl) || null,
          roe: toNumber(latestFinancials?.roe) || null,
          roa: toNumber(latestFinancials?.roa) || null,
          dy: toNumber(latestFinancials?.dy) || null,
          pvp: toNumber(latestFinancials?.pvp) || null,
          evEbitda: toNumber(latestFinancials?.evEbitda) || null,
          margemBruta: toNumber(latestFinancials?.margemBruta) || null,
          margemEbitda: toNumber(latestFinancials?.margemEbitda) || null,
          margemLiquida: toNumber(latestFinancials?.margemLiquida) || null,
          payout: toNumber(latestFinancials?.payout) || null,
          crescimentoReceitas: toNumber(latestFinancials?.crescimentoReceitas) || null,
          crescimentoLucros: toNumber(latestFinancials?.crescimentoLucros) || null,
          dividaLiquidaEbitda: toNumber(latestFinancials?.dividaLiquidaEbitda) || null,
          dividaLiquidaPatrimonio: toNumber((latestFinancials as any)?.dividaLiquidaPatrimonio) || null,
          patrimonioLiquido: toNumber((latestFinancials as any)?.patrimonioLiquido) || null,
          ativoTotal: toNumber((latestFinancials as any)?.ativoTotal) || null,
          disponibilidades: toNumber((latestFinancials as any)?.disponibilidades) || null,
          ativoCirculante: toNumber((latestFinancials as any)?.ativoCirculante) || null,
          passivoCirculante: toNumber((latestFinancials as any)?.passivoCirculante) || null,
          ebitda: toNumber((latestFinancials as any)?.ebitda) || null,
          receitaLiquida: toNumber((latestFinancials as any)?.receitaLiquida) || null,
          lucroLiquido: toNumber((latestFinancials as any)?.lucroLiquido) || null,
          fluxoCaixaOperacional: toNumber((latestFinancials as any)?.fluxoCaixaOperacional) || null,
          fluxoCaixaLivre: toNumber((latestFinancials as any)?.fluxoCaixaLivre) || null,
          capex: toNumber((latestFinancials as any)?.capex) || null,
          sharesOutstanding: toNumber(latestFinancials?.sharesOutstanding) || null,
          marketCap: toNumber(latestFinancials?.marketCap) || null,
        },
        historicalFinancials: []
      }

      // Executar análise Graham para obter preço justo
      const grahamAnalysis = StrategyFactory.runGrahamAnalysis(companyAnalysisData, STRATEGY_CONFIG.graham)
      const fairPrice = grahamAnalysis.fairValue
      const anoAtual = new Date().getFullYear()

      if (!fairPrice || fairPrice <= 0 || currentPrice <= 0) return null

      const margin = marginOfSafety(currentPrice, fairPrice)
      const statusLabel = valuationStatusLabel(margin)?.toLowerCase()

      const faqs = [
        {
          "@type": "Question",
          "name": `Qual é o preço justo de ${ticker} (${companyData.name})?`,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `Entre os modelos de valuation do Preço Justo AI, como Graham e Barsi, o Número de Graham estima o preço justo de ${ticker} em ${formatBRL(fairPrice)}, uma margem de segurança de ${formatDeltaPct(margin)} em relação ao preço atual de ${formatBRL(currentPrice)}.`
          }
        },
        {
          "@type": "Question",
          "name": `Vale a pena investir em ${ticker} em ${anoAtual}?`,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `Este conteúdo não é recomendação de investimento. Pelo Número de Graham, o preço atual de ${formatBRL(currentPrice)} está ${statusLabel ?? 'sem comparação com o preço justo'} (estimativa de ${formatBRL(fairPrice)}). Compare os demais modelos, o score e os indicadores na análise completa.`
          }
        }
      ]

      return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs
      }
    } catch (error) {
      console.error(`Erro ao gerar FAQ Schema para ${ticker}:`, error)
      return null
    }
  }

  const faqSchema = generateFAQSchema()

  // Buscar flags ativos para a empresa
  // Nota: companyFlag pode não estar tipado ainda até regenerar Prisma Client após migration
  const activeFlags = await prisma.companyFlag.findMany({
    where: {
      companyId: companyData.id,
      isActive: true,
    },
    include: {
      report: {
        select: { 
          id: true,
          content: true,
          type: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 1
  });

  const activeFlag = activeFlags.length > 0 ? activeFlags[0] : null;

  // Se o reason for um código (como "PERDA_DE_FUNDAMENTO"), tentar extrair trecho do relatório
  let flagReason = activeFlag?.reason || '';
  if (activeFlag && activeFlag.report && activeFlag.report.content) {
    // Verificar se o reason é um código (contém apenas letras maiúsculas, números e underscore)
    const isCodePattern = /^[A-Z0-9_]+$/.test(flagReason);
    
    if (isCodePattern) {
      // Tentar extrair o raciocínio da análise do relatório
      const reportContent = activeFlag.report.content;
      
      // Para PRICE_VARIATION, buscar a seção "Raciocínio:" após "### Sobre a Queda de Preço"
      if (activeFlag.report.type === 'PRICE_VARIATION') {
        const reasoningMatch = reportContent.match(/## Análise de Impacto Fundamental[\s\S]*?### Sobre a Queda de Preço[\s\S]*?\*\*Raciocínio\*\*:\s*([\s\S]*?)(?=\n##|\n###|$)/i);
        if (reasoningMatch && reasoningMatch[1]) {
          let reasoning = reasoningMatch[1].trim();
          // Limitar tamanho e remover markdown excessivo
          if (reasoning.length > 300) {
            reasoning = reasoning.substring(0, 297) + '...';
          }
          // Remover múltiplas quebras de linha
          reasoning = reasoning.replace(/\n{3,}/g, '\n\n');
          flagReason = reasoning;
        } else {
          // Fallback: buscar qualquer texto após a conclusão
          const conclusionMatch = reportContent.match(/## Análise de Impacto Fundamental[\s\S]*?\*\*Conclusão\*\*:[^\n]*\n([\s\S]{100,500})/i);
          if (conclusionMatch && conclusionMatch[1]) {
            let fallbackText = conclusionMatch[1].trim();
            if (fallbackText.length > 300) {
              fallbackText = fallbackText.substring(0, 297) + '...';
            }
            flagReason = fallbackText.replace(/\n{3,}/g, '\n\n');
          }
        }
      } else {
        // Para outros tipos de relatório, buscar primeiro parágrafo significativo
        const firstParagraphMatch = reportContent.match(/\n\n([^\n]{50,300})/);
        if (firstParagraphMatch && firstParagraphMatch[1]) {
          flagReason = firstParagraphMatch[1].trim();
        }
      }
    }
  }

  const marketCap = toNumber(latestFinancials?.marketCap ?? null)
  const sizeInfo = getCompanySizeInfo(marketCap)
  const liquidityFlag: LiquidityFlag | null = await getLiquidityFlag(companyData.id, companyData.assetType).catch(() => null)
  const dividendYield = toNumber(latestFinancials?.dy ?? null)
  const location = [companyData.city, companyData.state].filter(Boolean).join(', ')
  const aboutItems = [
    companyData.sector ? { label: 'Setor', value: companyData.sector } : null,
    companyData.industry ? { label: 'Subsetor', value: companyData.industry } : null,
    location ? { label: 'Sede', value: location } : null,
    companyData.fullTimeEmployees
      ? { label: 'Funcionários', value: formatNumber(companyData.fullTimeEmployees, { digits: 0 }) }
      : null,
  ].filter((item): item is { label: string; value: string } => item !== null)

  return (
    <>
      <TrackingAssetView ticker={ticker} assetType={companyData.assetType} />

      <div className="mx-auto max-w-6xl space-y-8 px-4 pt-6 pb-12">
        <div className="space-y-3">
          <StockSummaryHeader
            ticker={ticker}
            name={companyData.name}
            subtitle={companyData.sector ? `Ação · ${companyData.sector}` : 'Ação'}
            logoUrl={companyData.logoUrl}
            price={currentPrice > 0 ? currentPrice : null}
            dayChange={dayChange}
            updatedAt={latestFinancials?.updatedAt ?? null}
            badges={[
              ...(sizeInfo ? [{ label: sizeInfo.label, variant: 'neutral' as const }] : []),
              ...(liquidityFlag?.isLow ? [{ label: 'Baixa liquidez', variant: 'warning' as const }] : []),
            ]}
            sector={companyData.sector}
            industry={companyData.industry}
            canViewFullContent={canViewFullContent}
            isLoggedIn={isLoggedIn}
            compareHref={smartComparatorUrl ?? `/comparador?tickers=${ticker}`}
          />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <Link
              href={`/acao/${ticker.toLowerCase()}/entendendo-score`}
              prefetch={false}
              className="inline-flex min-h-11 items-center text-xs font-medium text-brand underline-offset-4 hover:underline md:min-h-0"
            >
              Como o score é calculado
            </Link>
            {liquidityFlag?.isLow && <LiquidityNote flag={liquidityFlag} />}
            <PageCacheIndicator ticker={ticker} isPremium={canViewFullContent} className="text-xs text-muted-foreground" />
          </div>
        </div>

        {activeFlag && (
          <CompanyFlagBanner
            flag={{
              id: activeFlag.id,
              reason: flagReason,
              reportId: activeFlag.reportId,
            }}
            ticker={ticker}
            isPremium={canViewFullContent}
          />
        )}

        {shouldShowAnonLimitCTA && <AnonLimitCTA />}

        {latestFinancials ? (
          <>
            <AssetSectionNav sections={SECTIONS} />

            <section id="valuation" className="scroll-mt-28">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                <StrategicAnalysisClient
                  ticker={ticker}
                  currentPrice={currentPrice}
                  latestFinancials={serializedFinancials}
                  userIsPremium={canViewFullContent}
                  sector={companyData.sector}
                  industry={companyData.industry}
                />
                <FollowAssetCard
                  ticker={ticker}
                  companyId={companyData.id}
                  isLoggedIn={isLoggedIn}
                  className="lg:sticky lg:top-32"
                />
              </div>
            </section>

            <section id="indicadores" className="scroll-mt-28 space-y-4">
              <SectionHeader title="Indicadores" description="Valores atuais e médias históricas dos principais indicadores." />
              <FinancialIndicators
                ticker={ticker}
                latestFinancials={serializedFinancials}
                comprehensiveData={comprehensiveData}
              />
            </section>

            <section id="dividendos" className="scroll-mt-28">
              <DividendRadarCompact ticker={ticker} companyName={companyData.name} dividendYield={dividendYield} />
            </section>

            <section id="demonstracoes" className="scroll-mt-28 space-y-4">
              <SectionHeader
                title="Demonstrações financeiras"
                description="Dados anuais dos últimos 7 anos completos, para acompanhar tendências de resultado."
              />
              {comprehensiveData ? (
                <ComprehensiveFinancialView data={comprehensiveData} />
              ) : (
                <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                  Demonstrações anuais indisponíveis para {ticker}.
                </p>
              )}
              <StatementsAnalysisSection ticker={ticker} userIsPremium={canViewFullContent} />
            </section>

            <section id="analise-ia" className="scroll-mt-28 space-y-8">
              <div className="space-y-4">
                <SectionHeader
                  title="Análise com IA"
                  description="Relatório gerado por IA a partir dos dados públicos da empresa."
                  actions={
                    reportsCount > 0 ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/acao/${ticker.toLowerCase()}/relatorios`} prefetch={false}>
                          Relatórios ({reportsCount})
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
                <AIAnalysisDual
                  ticker={ticker}
                  name={companyData.name}
                  sector={companyData.sector}
                  currentPrice={currentPrice}
                  financials={serializedFinancials}
                  userIsPremium={canViewFullContent}
                  companyId={companyData.id}
                />
              </div>
              <MarketSentimentSection
                ticker={ticker}
                youtubeAnalysis={serializedYoutubeAnalysis}
                userIsPremium={canViewFullContent}
              />
            </section>

            <section id="tecnica" className="scroll-mt-28">
              <TechnicalAnalysisLink ticker={ticker} userIsPremium={canViewFullContent} currentPrice={currentPrice} />
            </section>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              Ainda não há dados financeiros processados para {ticker}. Os modelos de valuation aparecem assim que os
              demonstrativos forem importados.
            </p>
            <FollowAssetCard ticker={ticker} companyId={companyData.id} isLoggedIn={isLoggedIn} />
          </div>
        )}

        {(companyData.description || aboutItems.length > 0 || companyData.website) && (
          <section aria-labelledby="sobre-empresa" className="space-y-4">
            <SectionHeader id="sobre-empresa" title={`Sobre a ${companyData.name}`} />
            {companyData.description && (
              <p className="max-w-[68ch] text-sm leading-6 text-muted-foreground">{companyData.description}</p>
            )}
            {(aboutItems.length > 0 || companyData.website) && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
                {aboutItems.map((item) => (
                  <div key={item.label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{item.label}</dt>
                    <dd className="mt-0.5 text-foreground">{item.value}</dd>
                  </div>
                ))}
                {companyData.website && (
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Site</dt>
                    <dd className="mt-0.5">
                      <a
                        href={companyData.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline md:min-h-0"
                      >
                        Site oficial
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </section>
        )}

        {relatedRows.length > 0 && (
          <section aria-label="Empresas relacionadas">
            <RelatedCompanies
              companies={relatedRows}
              currentTicker={ticker}
              currentSector={companyData.sector}
              currentIndustry={companyData.industry}
              currentAssetType="STOCK"
              showMargin={canSeeGraham}
              showScore={canViewFullContent}
            />
          </section>
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
              "priceRange": formatBRL(currentPrice),
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

      {/* Schema FAQPage para SEO - Apenas para usuários deslogados */}
      {!session && faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqSchema)
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
