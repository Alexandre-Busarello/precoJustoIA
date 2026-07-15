import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { CompanyLogo } from '@/components/company-logo'
import { EtfHeaderScore } from '@/components/etf-header-score'
import { InfoTooltip } from '@/components/info-tooltip'
import { Footer } from '@/components/footer'
import { BenChatFAB } from '@/components/ben-chat-fab'
import { cache } from '@/lib/cache-service'
import { ensureTodayPrice } from '@/lib/quote-service'
import { getOrCalculateDailyTechnicalAnalysis } from '@/lib/technical-analysis-service'
import { checkAndRecordUsage } from '@/lib/usage-based-pricing-service'
import { RateLimitMiddleware } from '@/lib/rate-limit-middleware'
import { AnonLimitCTA } from '@/components/anon-limit-cta'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Crown, Eye, TrendingUp, Info, AlertTriangle, Sparkles, BarChart3 } from 'lucide-react'

function PremiumLockOverlay({ isLoggedIn }: { isLoggedIn: boolean }) {
  const ctaHref = isLoggedIn ? '/checkout' : '/register'
  const ctaLabel = isLoggedIn ? 'Upgrade Premium' : 'Cadastre-se Grátis'
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-background/85 backdrop-blur-[2px] border border-dashed border-teal-300/80 px-3 text-center">
      <Crown className="h-6 w-6 text-teal-600 mb-1" />
      <p className="text-xs text-muted-foreground mb-2 max-w-xs">
        {isLoggedIn
          ? 'Assine o Premium para ver este conteúdo completo.'
          : 'Crie sua conta gratuita ou faça login para desbloquear.'}
      </p>
      <Button asChild size="sm" variant="outline" className="text-xs">
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
    </div>
  )
}

interface PageProps {
  params: { ticker: string }
}

type PrismaDecimal = { toNumber: () => number } | number | string | null | undefined

function toNumber(value: PrismaDecimal | Date | null): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value)
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'object' && 'toNumber' in value) return value.toNumber()
  return parseFloat(String(value))
}

function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(decimals)}%`
}

function fmtBrl(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(0)}M`
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

function fmtPrice(v: number | null): string {
  if (v === null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

const METADATA_TTL = 60 * 60

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker: tickerParam } = await params
  const ticker = tickerParam.toUpperCase()
  const cacheKey = `metadata-etf-${ticker}`
  const cached = await cache.get<Metadata>(cacheKey, { prefix: 'companies', ttl: METADATA_TTL })
  if (cached) return cached

  try {
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        name: true,
        assetType: true,
        logoUrl: true,
        etfData: {
          select: {
            netExpenseRatio: true,
            benchmarkIndex: true,
            return1y: true,
            etfScore: true,
          },
        },
      },
    })

    if (!company || company.assetType !== 'ETF') {
      return { title: `${ticker} — ETF | Preço Justo AI` }
    }

    const taxa = company.etfData?.netExpenseRatio
      ? `${(toNumber(company.etfData.netExpenseRatio)! * 100).toFixed(2)}% a.a.`
      : null
    const bench = company.etfData?.benchmarkIndex ?? null
    const score = company.etfData?.etfScore ?? null

    const title = `${ticker} — ${company.name} | ETF | Preço Justo AI`
    const description = [
      `Análise completa do ETF ${company.name} (${ticker}).`,
      taxa ? `Taxa ${taxa}.` : null,
      bench ? `Benchmark: ${bench}.` : null,
      score ? `Score Preço Justo: ${score}/100.` : null,
      'Retornos históricos, holdings e análise quantitativa na plataforma.',
    ]
      .filter(Boolean)
      .join(' ')

    const metadata: Metadata = {
      title,
      description,
      keywords: `${ticker}, ${company.name}, ETF, fundo de índice, B3, ${bench ?? ''}, análise ETF`,
      openGraph: {
        title,
        description,
        type: 'article',
        url: `/etf/${tickerParam.toLowerCase()}`,
        siteName: 'Preço Justo AI',
        images: company.logoUrl ? [{ url: company.logoUrl, alt: `Logo ${company.name}` }] : undefined,
      },
      alternates: { canonical: `/etf/${tickerParam.toLowerCase()}` },
      robots: { index: true, follow: true },
    }

    await cache.set(cacheKey, metadata, { prefix: 'companies', ttl: METADATA_TTL })
    return metadata
  } catch {
    return {
      title: `${ticker} — ETF | Preço Justo AI`,
      alternates: { canonical: `/etf/${tickerParam.toLowerCase()}` },
    }
  }
}

export default async function EtfPage({ params }: PageProps) {
  const { ticker: tickerParam } = await params
  const ticker = tickerParam.toUpperCase()

  // Redirect if migrated ticker
  const successor = await prisma.company.findUnique({
    where: { ticker },
    select: { isActive: true, assetType: true, successor: { select: { ticker: true } } },
  })
  if (successor && !successor.isActive && successor.successor) {
    redirect(`/etf/${successor.successor.ticker.toLowerCase()}`)
  }

  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session?.user
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

  // Atualiza preço do dia via Yahoo Finance antes de carregar os dados da página
  try {
    const priceUpdatePromise = ensureTodayPrice(ticker)
    const timeoutPromise = new Promise<boolean>((resolve) =>
      setTimeout(() => {
        console.log(`[${ticker}] Timeout ao atualizar preço ETF, continuando...`)
        resolve(false)
      }, 5000)
    )
    await Promise.race([priceUpdatePromise, timeoutPromise])
  } catch (error) {
    console.error(`[${ticker}] Erro ao atualizar preço ETF:`, error)
  }

  const companyData = await prisma.company.findUnique({
    where: { ticker },
    select: {
      id: true,
      ticker: true,
      name: true,
      logoUrl: true,
      website: true,
      description: true,
      assetType: true,
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1,
        select: { price: true, date: true },
      },
      etfData: {
        include: {
          holdings: {
            include: { company: { select: { ticker: true, name: true } } },
            orderBy: { weight: 'desc' },
            take: 50,
          },
        },
      },
    },
  })

  if (!companyData) notFound()

  if (companyData.assetType !== 'ETF') {
    const map: Record<string, string> = { STOCK: 'acao', FII: 'fii', BDR: 'bdr' }
    const path = map[companyData.assetType ?? ''] ?? 'acao'
    redirect(`/${path}/${tickerParam.toLowerCase()}`)
  }

  const etf = companyData.etfData
  const holdings = etf?.holdings ?? []
  const visibleHoldings = canViewFullContent ? holdings : holdings.slice(0, 5)

  const monthlyPricesCount = await prisma.historicalPrice.count({
    where: { companyId: companyData.id, interval: '1mo' },
  })
  const hasTechnicalAnalysis = monthlyPricesCount >= 50

  // Disparar cálculo de análise técnica em background apenas se houver dados suficientes
  if (hasTechnicalAnalysis) {
    getOrCalculateDailyTechnicalAnalysis(ticker).catch((err) => {
      console.error(`[${ticker}] Erro ao calcular análise técnica ETF em background:`, err)
    })
  }

  const peers = etf?.etfClass ? await prisma.etfData.findMany({
    where: {
      etfClass: etf.etfClass,
      company: { isActive: true, ticker: { not: ticker } },
    },
    orderBy: { etfScore: 'desc' },
    take: 5,
    select: { company: { select: { ticker: true } } },
  }) : []
  const peerTickers = peers.map(p => p.company?.ticker).filter(Boolean) as string[]

  const currentPrice = toNumber(companyData.dailyQuotes?.[0]?.price)
  const priceDate = companyData.dailyQuotes?.[0]?.date

  const r6m = toNumber(etf?.return6m)
  const r1y = toNumber(etf?.return1y)
  const r3y = toNumber(etf?.return3y)
  const r5y = toNumber(etf?.return5y)
  const effReturn = r1y ?? (r6m !== null ? (1 + r6m) ** 2 - 1 : null)
  const isEstimated = r1y === null && r6m !== null

  const returnsData = [
    { label: '6 meses', value: r6m },
    { label: isEstimated ? '1 ano (est.)' : '1 ano', value: effReturn },
    { label: '3 anos', value: r3y },
    { label: '5 anos', value: r5y },
  ].filter((r) => r.value !== null)

  return (
    <>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <Link
            href="/ranking?assetType=etf"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            ← Ranking de ETFs
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            {hasTechnicalAnalysis && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/etf/${tickerParam.toLowerCase()}/analise-tecnica`}>
                  <TrendingUp className="w-4 h-4 mr-1.5 text-blue-600" />
                  Análise Técnica
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/comparador-etfs`}>
                <BarChart3 className="w-4 h-4 mr-1.5 text-teal-600" />
                Comparar ETFs
              </Link>
            </Button>
          </div>
        </div>

        {/* Header 2-column layout */}
        <div className="mb-6">
          <div className="lg:flex lg:space-x-6 space-y-6 lg:space-y-0">

            {/* Left: company info card */}
            <Card className="flex-1">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                  <div className="flex-shrink-0 self-center sm:self-start">
                    <CompanyLogo
                      logoUrl={companyData.logoUrl}
                      companyName={companyData.name}
                      ticker={ticker}
                      size={80}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-3 gap-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl sm:text-3xl font-bold">{ticker}</h1>
                        <Badge variant="secondary" className="text-sm">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          ETF
                        </Badge>
                        {etf?.benchmarkIndex && (
                          <Badge variant="outline" className="text-xs max-w-[200px] truncate">
                            {etf.benchmarkIndex}
                          </Badge>
                        )}
                      </div>
                      <div className="lg:text-right shrink-0">
                        <p className="text-xs text-muted-foreground">Preço atual</p>
                        <p className="text-xl sm:text-2xl font-bold">
                          {fmtPrice(currentPrice)}
                        </p>
                        {priceDate && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(priceDate).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>

                    <h2 className="text-lg text-muted-foreground mb-4 truncate">
                      {companyData.name}
                    </h2>

                    {/* Key ETF metrics row */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-4">
                      {etf?.netExpenseRatio && (
                        <div className="bg-muted/40 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">Taxa de Administração</p>
                          <p className="font-bold">
                            {(toNumber(etf.netExpenseRatio)! * 100).toFixed(2)}% a.a.
                          </p>
                        </div>
                      )}
                      {etf?.netAssets && (
                        <div className="bg-muted/40 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">Patrimônio Líquido</p>
                          <p className="font-bold">{fmtBrl(toNumber(etf.netAssets))}</p>
                        </div>
                      )}
                      {etf?.holdingsConcentrationTop5 && (
                        <div className="bg-muted/40 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                            Concentração Top 5
                            <InfoTooltip content="Soma do peso percentual das 5 maiores posições da carteira. Valores acima de 65% indicam alta concentração — ETFs muito concentrados recebem penalidade no PJ-ETF Score." />
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold">
                              {(toNumber(etf.holdingsConcentrationTop5)! * 100).toFixed(1)}%
                            </p>
                            {etf.aiConcentracaoPenaltyOverride && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded px-1.5 py-0.5">
                                Fundo espelho
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Comparador Inteligente */}
                    {etf?.etfClass && peerTickers.length >= 1 && (
                      <div className="mb-4">
                        <Button asChild className="w-full bg-black hover:bg-zinc-900 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-100 h-auto min-h-10 py-2 text-sm font-semibold">
                          <Link href={`/compara-etfs/${[ticker, ...peerTickers].map(t => t.toLowerCase()).join('/')}`}>
                            <BarChart3 className="w-4 h-4 mr-2 shrink-0" />
                            Comparador Inteligente
                            <span className="ml-2 opacity-60 font-normal text-xs hidden sm:inline">{etf.etfClass}</span>
                            <span className="ml-1.5 opacity-40 text-xs">({peerTickers.length + 1})</span>
                          </Link>
                        </Button>
                      </div>
                    )}

                    {/* Website */}
                    {companyData.website && (
                      <div className="flex items-center gap-2 text-sm">
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

                    {/* Disclaimer: histórico limitado */}
                    {r5y === null && (
                      <div className="mt-3 flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-0.5">
                            Histórico limitado
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">
                            Este ETF possui{' '}
                            {r3y !== null
                              ? 'menos de 5 anos'
                              : r1y !== null
                              ? 'menos de 3 anos'
                              : r6m !== null
                              ? 'menos de 1 ano'
                              : 'histórico muito reduzido'}{' '}
                            de dados disponíveis. ETFs mais recentes têm menor previsibilidade de comportamento — recomendamos priorizar fundos com pelo menos 5 anos de track record consolidado.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right: score panel */}
            <div className="lg:flex-shrink-0 w-full lg:w-auto">
              <EtfHeaderScore
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

        {/* Retornos Históricos */}
        {returnsData.length > 0 && (
          <Card className="mb-6 relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Retornos Históricos</CardTitle>
            </CardHeader>
            <CardContent className={!canViewFullContent ? 'relative min-h-[120px]' : undefined}>
              <div className={`flex flex-wrap gap-6 ${!canViewFullContent ? 'filter blur-sm pointer-events-none select-none' : ''}`}>
                {returnsData.map((r) => (
                  <div key={r.label} className="text-center min-w-[70px]">
                    <p className="text-xs text-muted-foreground mb-1">{r.label}</p>
                    <p
                      className={`text-lg font-bold ${
                        r.value! >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {fmtPct(r.value)}
                    </p>
                  </div>
                ))}
              </div>
              {canViewFullContent && isEstimated && (
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Retorno de 1 ano estimado com base no retorno de 6 meses anualizado
                </p>
              )}
              {!canViewFullContent && <PremiumLockOverlay isLoggedIn={isLoggedIn} />}
            </CardContent>
          </Card>
        )}

        {/* Holdings */}
        {holdings.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Principais Participações
                  {!canViewFullContent && holdings.length > 5 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (top 5 de {holdings.length})
                    </span>
                  )}
                </CardTitle>
                {!canViewFullContent && holdings.length > 5 && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Crown className="w-3 h-3 text-yellow-500" />
                    Premium vê todas
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {visibleHoldings.map((h, idx) => {
                  const holdingTicker = h.company?.ticker ?? h.ticker
                  const holdingName = h.company?.name ?? h.name
                  const weightPct = (toNumber(h.weight)! * 100).toFixed(2)
                  const hasLink = !!h.company?.ticker

                  const inner = (
                    <div className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5 min-w-0">
                            {holdingTicker && (
                              <span className="font-mono text-sm font-bold shrink-0">{holdingTicker}</span>
                            )}
                            <span className="text-sm text-muted-foreground truncate min-w-0 flex-1">{holdingName}</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-bold text-sm shrink-0 ml-2">{weightPct}%</span>
                    </div>
                  )

                  return hasLink ? (
                    <Link key={h.id} href={`/acao/${h.company!.ticker.toLowerCase()}`}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={h.id}>{inner}</div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Description */}
        {companyData.description && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Sobre o {ticker}</CardTitle>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground border rounded px-1.5 py-0.5">
                  <Sparkles className="w-2.5 h-2.5" />
                  Gerado por IA
                </span>
              </div>
            </CardHeader>
            <CardContent className={!canViewFullContent ? 'relative min-h-[140px]' : undefined}>
              <div className={`space-y-3 ${!canViewFullContent ? 'filter blur-sm pointer-events-none select-none' : ''}`}>
                {companyData.description.split('\n\n').filter(Boolean).map((paragraph, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                    {paragraph.trim()}
                  </p>
                ))}
              </div>
              {!canViewFullContent && <PremiumLockOverlay isLoggedIn={isLoggedIn} />}
            </CardContent>
          </Card>
        )}
      </div>

      {!isLoggedIn && <Footer />}
      <BenChatFAB />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'InvestmentFund',
            name: companyData.name,
            alternateName: ticker,
            description: companyData.description || `ETF ${ticker} — ${companyData.name}`,
            url: `https://precojusto.ai/etf/${ticker.toLowerCase()}`,
            logo: companyData.logoUrl || undefined,
            tickerSymbol: ticker,
            stockExchange: 'B3',
          }),
        }}
      />
    </>
  )
}
