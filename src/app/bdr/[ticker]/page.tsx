import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
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
import { FollowAssetCard } from '@/components/asset/follow-asset-card'
import { AssetSectionNav, type AssetSection } from '@/components/asset/asset-section-nav'
import { SectionHeader } from '@/components/ui/section-header'
import { Button } from '@/components/ui/button'
import { getComprehensiveFinancialData } from '@/lib/financial-data-service'
import { cache } from '@/lib/cache-service'
import { getSectorCompetitors } from '@/lib/competitor-service'
import { DividendRadarCompact } from '@/components/dividend-radar-compact'
import { DividendService } from '@/lib/dividend-service'
import { DividendRadarService } from '@/lib/dividend-radar-service'
import { ensureTodayPrice } from '@/lib/quote-service'
import { StrategyFactory } from '@/lib/strategies/strategy-factory'
import { STRATEGY_CONFIG } from '@/lib/strategies/strategy-config'
import type { CompanyData } from '@/lib/strategies/types'
import Link from 'next/link'
import { checkAndRecordUsage } from '@/lib/usage-based-pricing-service'
import { RateLimitMiddleware } from '@/lib/rate-limit-middleware'
import { AnonLimitCTA } from '@/components/anon-limit-cta'
import { formatBRL, formatDeltaPct, formatMultiple, formatNumber, formatPct } from '@/lib/format'
import { marginOfSafety, valuationStatusLabel } from '@/lib/valuation-metrics'

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

/** Mesmas âncoras da página de ação. */
const SECTIONS: AssetSection[] = [
  { id: 'valuation', label: 'Valuation' },
  { id: 'indicadores', label: 'Indicadores' },
  { id: 'dividendos', label: 'Dividendos' },
  { id: 'demonstracoes', label: 'Demonstrações' },
  { id: 'analise-ia', label: 'Análise IA' },
  { id: 'tecnica', label: 'Técnica' },
]

// Cache
const METADATA_CACHE_TTL = 60 * 60 // 60 minutos em segundos

// Gerar metadata dinâmico para SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const tickerParam = resolvedParams.ticker
  const ticker = tickerParam.toUpperCase()
  
  // Verificar cache primeiro
  const cacheKey = `metadata-bdr-v2-${ticker}`
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
        title: `${ticker} - BDR não encontrado`,
        description: `O BDR ${ticker} não foi encontrado em nossa base de dados de análise de Brazilian Depositary Receipts.`
      }
    }

    // Verificar se é realmente um BDR, senão redirecionar
    if (company.assetType !== 'BDR') {
      return {
        title: `${ticker} - Redirecionando`,
        description: `Redirecionando para a página correta do ativo ${ticker}.`
      }
    }

    const latestFinancials = company.financialData?.[0]
    const currentPrice = toNumber(company.dailyQuotes?.[0]?.price) ?? 0
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
    let baseDescription = `Análise completa do BDR ${company.name} (${ticker}). Preço atual ${formatBRL(currentPrice)}`
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
    
    // Verificar se a descrição contém o texto padrão sobre BDRs
    const defaultBdrText = 'BDRs são certificados de depósito que representam ações de empresas estrangeiras negociadas na B3'
    const hasDefaultDescription = company.description?.includes(defaultBdrText) || false
    
    // Usar descrição da empresa apenas se não for o texto padrão e tiver conteúdo útil
    let companyInfo = ''
    if (company.description && !hasDefaultDescription && company.description.length > 50) {
      // Pegar apenas as primeiras palavras úteis (evitar textos muito genéricos)
      const cleanDescription = company.description.trim()
      if (cleanDescription.length > 50 && !cleanDescription.toLowerCase().startsWith('bdr')) {
        companyInfo = ` ${cleanDescription.substring(0, 80).trim()}...`
      }
    }
    
    // Construir descrição final priorizando informações específicas da empresa
    const description = `${baseDescription}${companyInfo} Veja o Score de Qualidade atualizado e análise com IA.`

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
      title: `${ticker} - Análise de BDR`,
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
    redirect(`/bdr/${company.successor.ticker.toLowerCase()}`);
  }

  // Verificar sessão do usuário para recursos premium
  const session = await getServerSession(authOptions)
  let userIsPremium = false
  let canViewFullContent = false
  let shouldShowAnonLimitCTA = false

  if (session?.user?.id) {
    const user = await getCurrentUser()
    userIsPremium = user?.isPremium || false
    canViewFullContent = userIsPremium
  } else {
    // Anônimo: verificar limite de 2 visualizações completas por IP
    const headersList = await headers()
    const ip = RateLimitMiddleware.getClientIPFromHeaders(headersList)
    const usageResult = await checkAndRecordUsage({
      userId: null,
      ip,
      feature: 'anon_full_view',
      resourceId: `bdr:${ticker}`,
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
      }, 5000) // Timeout de 3 segundos
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
          take: 2
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
  const previousQuote = companyData.dailyQuotes?.[1]
  const currentPrice = toNumber(latestQuote?.price) ?? toNumber(latestFinancials?.lpa) ?? 0
  const previousPrice = toNumber(previousQuote?.price)
  const dayChange = currentPrice > 0 && previousPrice && previousPrice > 0 ? currentPrice / previousPrice - 1 : null

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
          "name": `Qual é o preço justo do BDR ${ticker} (${companyData.name})?`,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `Pelo Número de Graham, o preço justo estimado para o BDR ${ticker} é de ${formatBRL(fairPrice)}, uma margem de segurança de ${formatDeltaPct(margin)} em relação ao preço atual de ${formatBRL(currentPrice)}.`
          }
        },
        {
          "@type": "Question",
          "name": `Vale a pena investir no BDR ${ticker} em ${anoAtual}?`,
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
      console.error(`Erro ao gerar FAQ Schema para BDR ${ticker}:`, error)
      return null
    }
  }

  const faqSchema = generateFAQSchema()

  const isLoggedIn = !!session?.user?.id
  const sizeInfo = getCompanySizeInfo(currentMarketCap)
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
      <div className="mx-auto max-w-6xl space-y-8 px-4 pt-6 pb-12">
        <div className="space-y-3">
          <StockSummaryHeader
            ticker={ticker}
            name={companyData.name}
            subtitle={companyData.sector ? `BDR · ${companyData.sector}` : 'BDR'}
            logoUrl={companyData.logoUrl}
            price={currentPrice > 0 ? currentPrice : null}
            dayChange={dayChange}
            updatedAt={latestFinancials?.updatedAt ?? null}
            badges={sizeInfo ? [{ label: sizeInfo.label, variant: 'neutral' }] : []}
            sector={companyData.sector}
            industry={companyData.industry}
            canViewFullContent={canViewFullContent}
            isLoggedIn={isLoggedIn}
            compareHref={smartComparatorUrl ?? `/comparador?tickers=${ticker}`}
          />
          <div className="flex justify-end">
            <PageCacheIndicator ticker={ticker} isPremium={canViewFullContent} className="text-xs text-muted-foreground" />
          </div>
        </div>

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
                        <Link href={`/bdr/${ticker.toLowerCase()}/relatorios`} prefetch={false}>
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
              <TechnicalAnalysisLink
                ticker={ticker}
                userIsPremium={canViewFullContent}
                currentPrice={currentPrice}
                assetType="BDR"
              />
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

        <section aria-labelledby="sobre-empresa" className="space-y-4">
          <SectionHeader id="sobre-empresa" title={`Sobre a ${companyData.name}`} />
          {companyData.description && (
            <p className="max-w-[68ch] text-sm leading-6 text-muted-foreground">{companyData.description}</p>
          )}
          <p className="max-w-[68ch] text-sm leading-6 text-muted-foreground">
            BDRs (Brazilian Depositary Receipts) são certificados negociados na B3 que representam ações de empresas
            estrangeiras. Permitem investir em empresas internacionais pela bolsa brasileira, em reais.
          </p>
          {(aboutItems.length > 0 || companyData.website) && (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
                      className="font-medium text-brand underline-offset-4 hover:underline"
                    >
                      Site oficial
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </section>
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
              "priceRange": formatBRL(currentPrice),
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

      {/* Schema FAQPage para SEO - Apenas para usuários deslogados */}
      {!session && faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqSchema)
          }}
        />
      )}

    </>
  )
}