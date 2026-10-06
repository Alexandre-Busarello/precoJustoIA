import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { AssetHeader } from '@/components/asset/asset-header'
import { FiiHeaderScore, fiiScoreLabel } from '@/components/fii-header-score'
import { FiiStrategicAnalysis } from '@/components/fii-strategic-analysis'
import { FiiPageLockedShell } from '@/components/fii-page-locked-shell'
import AIAnalysisDual from '@/components/ai-analysis-dual'
import FinancialIndicators from '@/components/financial-indicators'
import ComprehensiveFinancialView from '@/components/comprehensive-financial-view'
import TechnicalAnalysisSection from '@/components/technical-analysis-section'
import MarketSentimentSection from '@/components/market-sentiment-section'
import { TrackingAssetView } from '@/components/tracking-asset-view'
import { AnonLimitCTA } from '@/components/anon-limit-cta'
import { SectionHeader } from '@/components/ui/section-header'
import { getComprehensiveFinancialData } from '@/lib/financial-data-service'
import { getCachedFiiOverallScore } from '@/lib/fii-score-loader'
import { cache } from '@/lib/cache-service'
import { checkAndRecordUsage } from '@/lib/usage-based-pricing-service'
import { RateLimitMiddleware } from '@/lib/rate-limit-middleware'
import {
  computeFiiListingValuation,
  FII_LISTING_TARGET_DY,
  fiiListingFairValueModelLabel,
} from '@/lib/fii-listing-valuation'
import { formatBRL, formatBRLCompact, formatDate, formatMultiple, formatNumber, formatPct } from '@/lib/format'
import { marginOfSafety } from '@/lib/valuation-metrics'
import { InfoHint } from '@/components/ui/info-hint'
import { getLiquidityFlag, type LiquidityFlag } from '@/lib/rank-builder-service'

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

// Cache
const METADATA_CACHE_TTL = 60 * 60 // 60 minutos em segundos

/**
 * Colunas `@db.Date` chegam como meia-noite UTC. Formatadas no fuso de Brasília, cairiam no dia anterior;
 * aqui o dia do calendário é preservado (meio-dia UTC = 9h em Brasília, mesmo dia).
 */
function formatCalendarDate(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return undefined
  return formatDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)))
}

// Gerar metadata dinâmico para SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const tickerParam = resolvedParams.ticker
  const ticker = tickerParam.toUpperCase()

  // Verificar cache primeiro
  const cacheKey = `metadata-fii-v2-${ticker}`
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
            segment: true
          }
        }
      }
    })

    if (!company) {
      return {
        title: `${ticker} - FII não encontrado`,
        description: `O FII ${ticker} não foi encontrado em nossa base de dados de análise de fundos imobiliários.`
      }
    }

    // Verificar se é realmente um FII, senão redirecionar
    if (company.assetType !== 'FII') {
      return {
        title: `${ticker} - Redirecionando`,
        description: `Redirecionando para a página correta do ativo ${ticker}.`
      }
    }

    const currentPrice = toNumber(company.dailyQuotes?.[0]?.price)
    // dividend_yield é fração (0,086 = 8,6%)
    const dividendYield = toNumber(company.fiiData?.dividendYield ?? null)
    const segment = company.fiiData?.segment || company.sector || 'Fundos Imobiliários'

    const title = `${ticker} - ${company.name} | Análise completa de FII`

    const baseDescription = `Análise do FII ${company.name} (${ticker}). Preço atual ${formatBRL(currentPrice)}, dividend yield de ${formatPct(dividendYield)} em 12 meses. Segmento ${segment}.`

    const companyInfo = company.description
      ? ` ${company.description.substring(0, 100)}...`
      : ''

    const description = `${baseDescription}${companyInfo} Score PJ-FII, preço-teto por DY-alvo, P/VP e dados do fundo.`

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
      title: `${ticker} - Análise de FII`,
      description: `Análise do FII ${ticker} com dividend yield, P/VP, preço-teto e dados de fundos imobiliários.`,
      alternates: {
        canonical: `/fii/${tickerParam.toLowerCase()}`,
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
  let fiiScore: Awaited<ReturnType<typeof getCachedFiiOverallScore>> = null
  let youtubeAnalysis: {
    score: unknown
    summary: string | null
    positivePoints: unknown
    negativePoints: unknown
    updatedAt: Date
  } | null = null

  if (canViewFullContent) {
    const [fc, comp, yt, score] = await Promise.all([
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
          },
          fiiData: true
        }
      }),
      getComprehensiveFinancialData(ticker, 'YEARLY', 7),
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
      }),
      getCachedFiiOverallScore(ticker),
    ])
    fullCompany = fc
    comprehensiveData = comp
    youtubeAnalysis = yt
    fiiScore = score
  } else {
    // Sem acesso completo: só dados públicos (identificação, cotação e segmento), nada de métricas do fundo.
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
        assetType: true,
        isActive: true,
        dailyQuotes: {
          orderBy: { date: 'desc' },
          take: 2,
          select: { price: true, date: true },
        },
        fiiData: { select: { segment: true, lastFetchedAt: true } },
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

  const fiiData = fullCompany?.fiiData ?? null
  const liquidityFlag: LiquidityFlag | null = await getLiquidityFlag(
    companyData.id,
    companyData.assetType,
    fiiData ? toNumber(fiiData.liquidez) : null
  ).catch(() => null)
  const latestFinancials = fullCompany?.financialData?.[0]
  const latestQuote = companyData.dailyQuotes?.[0]
  const previousQuote = companyData.dailyQuotes?.[1]
  const currentPrice = toNumber(latestQuote?.price) ?? 0
  const previousPrice = toNumber(previousQuote?.price)
  const price = currentPrice > 0 ? currentPrice : null
  const dayChange = price && previousPrice && previousPrice > 0 ? price / previousPrice - 1 : null
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

  // Referência única de preço do FII: o preço-teto do cabeçalho e o do bloco "Preço-teto e P/VP" saem daqui.
  const fiiValuation =
    canViewFullContent && fiiData && currentPrice > 0
      ? computeFiiListingValuation({
          ticker,
          name: fullCompany.name,
          sector: fullCompany.sector,
          currentPrice,
          logoUrl: fullCompany.logoUrl,
          financials: {
            dy: fiiData.dividendYield,
            pvp: fiiData.pvp,
            vpa: fiiData.valorPatrimonial,
            fiiCotacao: fiiData.cotacao,
          },
          ultimoDividendo: toNumber(fiiData.lastDividendValue) ?? undefined,
          dividendHistory: [],
        }, { isPapel: fiiData.isPapel ?? null })
      : null
  const fairValue = fiiValuation?.fairValue ?? null
  const fairValueLabel =
    fiiValuation?.upsideSource === 'valor_patrimonial'
      ? fiiListingFairValueModelLabel('valor_patrimonial') ?? undefined
      : `DY-alvo ${formatPct(fiiValuation?.targetDY.value ?? FII_LISTING_TARGET_DY, { digits: 1 })}`
  const fairValueTitle = fiiValuation?.upsideSource === 'valor_patrimonial' ? undefined : 'Preço-teto'

  const segment: string | null = companyData.fiiData?.segment || companyData.sector || null
  // Só carimbos de data e hora reais: `daily_quotes.date` é só data e mostraria um horário inventado.
  const updatedAt: Date | null =
    fiiData?.lastFetchedAt ?? companyData.fiiData?.lastFetchedAt ?? latestFinancials?.updatedAt ?? null

  const fundFacts = fiiData
    ? [
        { label: 'Dividend yield (12m)', value: formatPct(toNumber(fiiData.dividendYield)) },
        { label: 'P/VP', value: formatMultiple(toNumber(fiiData.pvp), { digits: 2 }) },
        { label: 'Valor patrimonial por cota', value: formatBRL(toNumber(fiiData.valorPatrimonial)) },
        {
          label: 'Último rendimento',
          value: formatBRL(toNumber(fiiData.lastDividendValue)),
          note: formatCalendarDate(fiiData.lastDividendDate),
        },
        { label: 'Patrimônio líquido', value: formatBRLCompact(toNumber(fiiData.patrimonioLiquido)) },
        { label: 'Liquidez média diária', value: formatBRLCompact(toNumber(fiiData.liquidez)) },
        { label: 'FFO yield', value: formatPct(toNumber(fiiData.ffoYield)) },
        { label: 'Cap rate', value: formatPct(toNumber(fiiData.capRate)) },
        { label: 'Vacância média', value: formatPct(toNumber(fiiData.vacanciaMedia)) },
        {
          label: 'Imóveis',
          value: fiiData.qtdImoveis != null ? formatNumber(fiiData.qtdImoveis, { digits: 0 }) : '—',
        },
        { label: 'Preço por m²', value: formatBRL(toNumber(fiiData.precoM2)) },
        { label: 'Aluguel por m²', value: formatBRL(toNumber(fiiData.aluguelM2)) },
        { label: 'Tipo', value: fiiData.isPapel ? 'Papel / renda fixa' : 'Tijolo' },
      ]
    : []

  return (
    <>
      <TrackingAssetView ticker={ticker} assetType="FII" />
      <div className="mx-auto max-w-6xl space-y-8 px-4 pt-6 pb-12">
        <AssetHeader
          ticker={ticker}
          name={companyData.name}
          subtitle={segment ? `FII · ${segment}` : 'FII'}
          logoUrl={companyData.logoUrl}
          price={price}
          dayChange={dayChange}
          fairValue={fairValue}
          fairValueTitle={fairValueTitle}
          fairValueLabel={fairValue !== null ? fairValueLabel : undefined}
          marginOfSafety={marginOfSafety(price, fairValue)}
          score={fiiScore ? { value: fiiScore.score, label: fiiScoreLabel(fiiScore.classification) } : null}
          updatedAt={updatedAt}
          badges={liquidityFlag?.isLow ? [{ label: 'Baixa liquidez', variant: 'warning' }] : []}
          // O CTA da prévia bloqueada fica num lugar só: na prévia abaixo (ou no aviso de limite do anônimo).
          locked={{ fairValue: !canViewFullContent, score: !canViewFullContent }}
        />
        {liquidityFlag?.isLow && <LiquidityNote flag={liquidityFlag} />}

        {shouldShowAnonLimitCTA && <AnonLimitCTA />}

        {!canViewFullContent && <FiiPageLockedShell isLoggedIn={isLoggedIn} showCta={!shouldShowAnonLimitCTA} />}

        {canViewFullContent && (
          <>
            {fiiData && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                <FiiStrategicAnalysis
                  price={price}
                  valuation={fiiValuation}
                  dividendYield={toNumber(fiiData.dividendYield)}
                  pvp={toNumber(fiiData.pvp)}
                  liquidez={toNumber(fiiData.liquidez)}
                  qtdImoveis={fiiData.qtdImoveis}
                  vacanciaMedia={toNumber(fiiData.vacanciaMedia)}
                  isPapel={!!fiiData.isPapel}
                />
                <FiiHeaderScore score={fiiScore} />
              </div>
            )}

            {fundFacts.length > 0 && (
              <section aria-labelledby="dados-fundo" className="space-y-4">
                <SectionHeader id="dados-fundo" title="Dados do fundo" description="Indicadores mais recentes informados pelo fundo." />
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-4">
                  {fundFacts.map((fact) => (
                    <div key={fact.label} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                      <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                        {fact.value}
                        {fact.note && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{fact.note}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

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
                <section aria-labelledby="indicadores" className="space-y-4">
                  <SectionHeader id="indicadores" title="Indicadores" />
                  <FinancialIndicators
                    ticker={ticker}
                    latestFinancials={serializedFinancials}
                    comprehensiveData={comprehensiveData}
                  />
                </section>

                <section aria-labelledby="analise-ia" className="space-y-4">
                  <SectionHeader
                    id="analise-ia"
                    title="Análise com IA"
                    description="Relatório gerado por IA a partir dos dados públicos do fundo."
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
                </section>
              </>
            )}

            {hasStockStyleFinancials && comprehensiveData && (
              <section aria-labelledby="demonstracoes" className="space-y-4">
                <SectionHeader
                  id="demonstracoes"
                  title="Demonstrações financeiras"
                  description="Dados anuais dos últimos 7 anos completos, para acompanhar tendências de resultado do fundo."
                />
                <ComprehensiveFinancialView data={comprehensiveData} />
              </section>
            )}
          </>
        )}

        {(companyData.description || companyData.website) && (
          <section aria-labelledby="sobre-fundo" className="space-y-4">
            <SectionHeader id="sobre-fundo" title={`Sobre o ${companyData.name}`} />
            {companyData.description && (
              <p className="max-w-[68ch] text-sm leading-6 text-muted-foreground">{companyData.description}</p>
            )}
            {companyData.website && (
              <a
                href={companyData.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline md:min-h-0"
              >
                Site oficial
              </a>
            )}
          </section>
        )}
      </div>

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
      {canViewFullContent && (latestFinancials || fiiData) && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "InvestmentFund",
              "name": companyData.name,
              "alternateName": ticker,
              "description": companyData.description || `Análise do FII ${companyData.name} (${ticker}) com dividend yield, P/VP, preço-teto e dados do fundo imobiliário.`,
              "url": `https://precojusto.ai/fii/${ticker.toLowerCase()}`,
              "logo": companyData.logoUrl || undefined,
              "sameAs": companyData.website ? [companyData.website] : undefined,
              "category": "Real Estate Investment Trust",
              "fundFamily": "FII - Fundo de Investimento Imobiliário",
              "stockExchange": "B3 - Brasil Bolsa Balcão",
              "tickerSymbol": ticker,
              "priceRange": formatBRL(price),
              "dividendYield": fiiData?.dividendYield ? toNumber(fiiData.dividendYield) : undefined,
              "netAssets": fiiData?.patrimonioLiquido ? toNumber(fiiData.patrimonioLiquido) : undefined,
              "lastUpdated":
                fiiData?.lastFetchedAt?.toISOString() ||
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
