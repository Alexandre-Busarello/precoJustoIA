import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronLeft, GitCompare, Lock, LineChart, TriangleAlert } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { CompanyLogo } from '@/components/company-logo'
import { EtfHeaderScore, etfScoreClassification } from '@/components/etf-header-score'
import { AnonLimitCTA } from '@/components/anon-limit-cta'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { SectionHeader } from '@/components/ui/section-header'
import { Stat } from '@/components/ui/stat'
import { cache } from '@/lib/cache-service'
import { getCachedEtfScore } from '@/lib/etf-score-loader'
import { ensureTodayPrice } from '@/lib/quote-service'
import { getOrCalculateDailyTechnicalAnalysis } from '@/lib/technical-analysis-service'
import { checkAndRecordUsage } from '@/lib/usage-based-pricing-service'
import { RateLimitMiddleware } from '@/lib/rate-limit-middleware'
import { formatBRL, formatBRLCompact, formatDate, formatDeltaPct, formatNumber, formatPct } from '@/lib/format'

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

/** Cor do retorno: só positivo/negativo quando o valor exibido (1 casa) não é zero. */
function returnTone(value: number | null): 'default' | 'positive' | 'negative' {
  if (value === null) return 'default'
  const shown = Math.round(value * 1000)
  return shown > 0 ? 'positive' : shown < 0 ? 'negative' : 'default'
}

const METADATA_TTL = 60 * 60

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker: tickerParam } = await params
  const ticker = tickerParam.toUpperCase()
  const cacheKey = `metadata-etf-v2-${ticker}`
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
      return { title: `${ticker} — ETF` }
    }

    const expenseRatio = toNumber(company.etfData?.netExpenseRatio ?? null)
    const taxa = expenseRatio !== null ? `${formatPct(expenseRatio, { digits: 2 })} a.a.` : null
    const bench = company.etfData?.benchmarkIndex ?? null
    const score = company.etfData?.etfScore ?? null

    const title = `${ticker} — ${company.name} | ETF`
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
      title: `${ticker} — ETF`,
      alternates: { canonical: `/etf/${tickerParam.toLowerCase()}` },
    }
  }
}

/**
 * Colunas `@db.Date` chegam como meia-noite UTC. Formatadas no fuso de Brasília, cairiam no dia anterior;
 * aqui o dia do calendário é preservado (meio-dia UTC = 9h em Brasília, mesmo dia).
 */
function formatCalendarDate(value: Date | string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return formatDate(null)
  return formatDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)))
}

interface HeaderAction {
  label: string
  href: string
  icon: LucideIcon
}

function HeaderActionButton({ action }: { action: HeaderAction }) {
  const Icon = action.icon
  return (
    // Mobile: padding menor para 2 ações por linha a 390 px (a linha quebra, nada fica cortado)
    <Button variant="outline" size="sm" asChild className="min-h-11 max-md:px-2.5 max-md:has-[>svg]:px-2 md:min-h-0">
      <Link href={action.href}>
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
        {action.label}
      </Link>
    </Button>
  )
}

function LockedNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Lock className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {children}
    </p>
  )
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
      descriptionSource: true,
      assetType: true,
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 2,
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

  const [monthlyPricesCount, peers, etfScore] = await Promise.all([
    prisma.historicalPrice.count({
      where: { companyId: companyData.id, interval: '1mo' },
    }),
    etf?.etfClass
      ? prisma.etfData.findMany({
          where: {
            etfClass: etf.etfClass,
            company: { isActive: true, ticker: { not: ticker } },
          },
          orderBy: { etfScore: 'desc' },
          take: 5,
          select: { company: { select: { ticker: true } } },
        })
      : Promise.resolve([]),
    canViewFullContent ? getCachedEtfScore(ticker) : Promise.resolve(null),
  ])
  const hasTechnicalAnalysis = monthlyPricesCount >= 50

  // Disparar cálculo de análise técnica em background apenas se houver dados suficientes
  if (hasTechnicalAnalysis) {
    getOrCalculateDailyTechnicalAnalysis(ticker).catch((err) => {
      console.error(`[${ticker}] Erro ao calcular análise técnica ETF em background:`, err)
    })
  }

  const peerTickers = peers.map((p) => p.company?.ticker).filter(Boolean) as string[]

  const currentPrice = toNumber(companyData.dailyQuotes?.[0]?.price ?? null)
  const previousPrice = toNumber(companyData.dailyQuotes?.[1]?.price ?? null)
  const priceDate = companyData.dailyQuotes?.[0]?.date ?? null
  const dayChange = currentPrice && previousPrice && previousPrice > 0 ? currentPrice / previousPrice - 1 : null

  const r6m = toNumber(etf?.return6m ?? null)
  const r1y = toNumber(etf?.return1y ?? null)
  const r3y = toNumber(etf?.return3y ?? null)
  const r5y = toNumber(etf?.return5y ?? null)
  const effReturn = r1y ?? (r6m !== null ? (1 + r6m) ** 2 - 1 : null)
  const isEstimated = r1y === null && r6m !== null
  const expenseRatio = toNumber(etf?.netExpenseRatio ?? null)
  const dividendYield = toNumber(etf?.dividendYield ?? null)
  const concentrationTop5 = toNumber(etf?.holdingsConcentrationTop5 ?? null)
  const volatility = toNumber(etf?.volatility12m ?? null)

  const returnsData = [
    { label: '6 meses', value: r6m },
    { label: isEstimated ? '12 meses (estimado)' : '12 meses', value: effReturn },
    { label: '3 anos', value: r3y },
    { label: '5 anos', value: r5y },
  ].filter((r) => r.value !== null)

  const etfFacts = [
    { label: 'Taxa de administração', value: expenseRatio !== null ? `${formatPct(expenseRatio, { digits: 2 })} a.a.` : null },
    { label: 'Patrimônio líquido', value: etf?.netAssets ? formatBRLCompact(toNumber(etf.netAssets)) : null },
    {
      label: 'Concentração top 5',
      value: concentrationTop5 !== null ? formatPct(concentrationTop5) : null,
      note: etf?.aiConcentracaoPenaltyOverride ? 'Fundo espelho' : undefined,
    },
    { label: 'Dividend yield (12m)', value: dividendYield !== null && dividendYield > 0 ? formatPct(dividendYield) : null },
    { label: 'Volatilidade (12m)', value: volatility !== null ? formatPct(volatility) : null },
    { label: 'Índice de referência', value: etf?.benchmarkIndex ?? null },
  ].filter((fact): fact is { label: string; value: string; note?: string } => fact.value !== null)

  const limitedHistory =
    r5y === null
      ? r3y !== null
        ? 'menos de 5 anos'
        : r1y !== null
          ? 'menos de 3 anos'
          : r6m !== null
            ? 'menos de 1 ano'
            : 'um histórico muito reduzido'
      : null

  const actions: HeaderAction[] = [
    ...(hasTechnicalAnalysis
      ? [{ label: 'Análise técnica', href: `/etf/${tickerParam.toLowerCase()}/analise-tecnica`, icon: LineChart }]
      : []),
    ...(peerTickers.length >= 1
      ? [
          {
            label: `Comparar com pares (${peerTickers.length + 1})`,
            href: `/compara-etfs/${[ticker, ...peerTickers].map((t) => t.toLowerCase()).join('/')}`,
            icon: GitCompare,
          },
        ]
      : []),
    { label: 'Comparar ETFs', href: '/comparador?tipo=etfs', icon: GitCompare },
  ]

  const lockedCta = isLoggedIn
    ? { label: 'Assinar o Premium', href: '/checkout' }
    : { label: 'Criar conta grátis', href: '/register' }

  const holdingRows = visibleHoldings.map((h) => {
    const holdingTicker = h.company?.ticker ?? h.ticker
    const holdingName = h.company?.name ?? h.name
    return {
      id: String(h.id),
      asset: (
        <span className="flex min-w-0 max-w-44 items-center gap-1.5 sm:max-w-none">
          {holdingTicker &&
            (h.company?.ticker ? (
              <Link
                href={`/acao/${h.company.ticker.toLowerCase()}`}
                className="inline-flex min-h-11 shrink-0 items-center font-medium text-foreground underline-offset-4 hover:text-brand hover:underline md:min-h-0"
              >
                {holdingTicker}
              </Link>
            ) : (
              <span className="shrink-0 font-medium text-foreground">{holdingTicker}</span>
            ))}
          <span className="truncate text-muted-foreground">{holdingName}</span>
        </span>
      ),
      weight: formatPct(toNumber(h.weight), { digits: 2 }),
    }
  })

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-8 px-4 pt-4 pb-12">
        <div className="space-y-2">
          <Link
            href="/ranking?assetType=etf"
            className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground md:min-h-8"
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Ranking de ETFs
          </Link>

          {/* Cabeçalho no mesmo formato do AssetHeader: Preço · Retorno 12m · Taxa · Score */}
          <section aria-label={`Resumo de ${ticker}`} className="space-y-4">
            <div className="flex items-start gap-3">
              <CompanyLogo logoUrl={companyData.logoUrl} companyName={companyData.name} ticker={ticker} size={40} />
              <div className="min-w-0 flex-1">
                <h1 className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 text-2xl font-semibold tracking-tight text-foreground">{ticker}</span>
                  <span className="truncate text-sm font-normal text-muted-foreground">{companyData.name}</span>
                </h1>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {etf?.benchmarkIndex ? `ETF · ${etf.benchmarkIndex}` : 'ETF'}
                </p>
              </div>
              <div className="hidden shrink-0 items-center gap-2 md:flex">
                {actions.map((action) => (
                  <HeaderActionButton key={action.label} action={action} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Preço" value={formatBRL(currentPrice)} delta={dayChange} deltaLabel="hoje" />
              <Stat
                label="Retorno 12m"
                value={formatDeltaPct(effReturn)}
                tone={returnTone(effReturn)}
                caption={isEstimated ? 'Estimado a partir de 6 meses' : undefined}
                locked={!canViewFullContent}
                hint="Variação da cota nos últimos 12 meses."
              />
              <Stat
                label="Taxa de administração"
                value={formatPct(expenseRatio, { digits: 2 })}
                caption={expenseRatio !== null ? 'ao ano' : undefined}
              />
              <Stat
                label="Score"
                value={etfScore ? `${formatNumber(etfScore.score, { digits: 0 })}/100` : '—'}
                caption={etfScore ? etfScoreClassification(etfScore.score) : canViewFullContent ? 'Indisponível' : undefined}
                locked={!canViewFullContent}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {priceDate && <p className="text-xs text-muted-foreground">Cotação de {formatCalendarDate(priceDate)}</p>}
              {!canViewFullContent && !shouldShowAnonLimitCTA && (
                <Button size="sm" asChild className="min-h-11 md:min-h-0">
                  <Link href={lockedCta.href}>{lockedCta.label}</Link>
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 md:hidden">
              {actions.map((action) => (
                <HeaderActionButton key={action.label} action={action} />
              ))}
            </div>
          </section>
        </div>

        {shouldShowAnonLimitCTA && <AnonLimitCTA />}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="min-w-0 space-y-8">
            {returnsData.length > 0 && (
              <section aria-labelledby="retornos" className="space-y-4">
                <SectionHeader id="retornos" title="Retornos históricos" description="Variação acumulada da cota em cada período." />
                <div className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {returnsData.map((r) => (
                      <Stat
                        key={r.label}
                        label={r.label}
                        value={formatDeltaPct(r.value)}
                        tone={returnTone(r.value)}
                        locked={!canViewFullContent}
                      />
                    ))}
                  </div>
                  {canViewFullContent && isEstimated && (
                    <p className="text-xs text-muted-foreground">Retorno de 12 meses estimado a partir do retorno de 6 meses anualizado.</p>
                  )}
                  {!canViewFullContent && <LockedNote>Retornos históricos disponíveis no Premium.</LockedNote>}
                </div>
              </section>
            )}

            {etfFacts.length > 0 && (
              <section aria-labelledby="dados-etf" className="space-y-4">
                <SectionHeader id="dados-etf" title="Dados do ETF" />
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3 sm:p-5">
                  {etfFacts.map((fact) => (
                    <div key={fact.label} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                      <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                        {fact.value}
                        {fact.note && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{fact.note}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
                {limitedHistory && (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden="true" />
                    <span>
                      Histórico limitado: este ETF tem {limitedHistory} de dados. Fundos mais novos têm menos histórico para
                      avaliar o comportamento em diferentes ciclos de mercado.
                    </span>
                  </p>
                )}
              </section>
            )}
          </div>

          <EtfHeaderScore result={etfScore} locked={!canViewFullContent} />
        </div>

        {holdings.length > 0 && (
          <section aria-labelledby="participacoes" className="space-y-4">
            <SectionHeader
              id="participacoes"
              title="Principais participações"
              description={
                canViewFullContent || holdings.length <= 5
                  ? `${holdings.length} ${holdings.length === 1 ? 'ativo' : 'ativos'} por peso na carteira.`
                  : `As 5 maiores de ${holdings.length} participações.`
              }
            />
            <DataTable
              columns={[
                { key: 'asset', header: 'Ativo', sticky: true },
                { key: 'weight', header: 'Peso', align: 'right' },
              ]}
              rows={holdingRows}
              caption={`Participações do ETF ${ticker}`}
            />
            {!canViewFullContent && holdings.length > 5 && (
              <LockedNote>Lista completa com {holdings.length} participações disponível no Premium.</LockedNote>
            )}
          </section>
        )}

        {companyData.description && companyData.descriptionSource === 'ai' && (
          <section aria-labelledby="sobre-etf" className="space-y-4">
            <SectionHeader id="sobre-etf" title={`Sobre o ${ticker}`} description="Descrição gerada por IA." />
            <div
              className={
                canViewFullContent ? 'max-w-[68ch] space-y-3' : 'pointer-events-none max-w-[68ch] select-none space-y-3 blur-sm'
              }
              aria-hidden={canViewFullContent ? undefined : true}
            >
              {companyData.description.split('\n\n').filter(Boolean).map((paragraph, i) => (
                <p key={i} className="text-sm leading-6 text-muted-foreground">
                  {paragraph.trim()}
                </p>
              ))}
            </div>
            {!canViewFullContent && <LockedNote>Descrição completa disponível no Premium.</LockedNote>}
          </section>
        )}

        {companyData.website && (
          <a
            href={companyData.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline md:min-h-0"
          >
            Site oficial do ETF
          </a>
        )}
      </div>

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
