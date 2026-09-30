import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { formatBRL } from '@/lib/format'
import TechnicalAnalysisPage from '@/components/technical-analysis-page'
import TechnicalAnalysisPageLimited from '@/components/technical-analysis-page-limited'
import { TechnicalAnalysisLayout } from '@/app/acao/[ticker]/analise-tecnica/technical-analysis-layout'
import { getPriceStats } from '@/app/acao/[ticker]/analise-tecnica/price-stats'

const MIN_MONTHLY_PRICES = 50

interface PageProps {
  params: Promise<{ ticker: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker: tickerParam } = await params
  const ticker = tickerParam.toUpperCase()

  const company = await prisma.company.findUnique({
    where: { ticker },
    select: {
      name: true,
      dailyQuotes: { orderBy: { date: 'desc' }, take: 1, select: { price: true } },
    },
  })

  if (!company) {
    return { title: `Análise técnica de ${ticker}` }
  }

  const price = company.dailyQuotes[0]?.price ? Number(company.dailyQuotes[0].price) : null
  const description = `Análise técnica do ETF ${ticker} (${company.name}).${
    price ? ` Preço atual: ${formatBRL(price)}.` : ''
  } Indicadores técnicos, suporte e resistência e faixa de preço estimada por IA para 30 dias.`

  return {
    title: `Análise técnica de ${ticker} (${company.name})`,
    description,
    alternates: { canonical: `/etf/${tickerParam.toLowerCase()}/analise-tecnica` },
    robots: { index: true, follow: true },
  }
}

export default async function EtfTechnicalAnalysisPage({ params }: PageProps) {
  const { ticker: tickerParam } = await params
  const ticker = tickerParam.toUpperCase()

  const company = await prisma.company.findUnique({
    where: { ticker },
    select: { id: true, name: true, sector: true, logoUrl: true, assetType: true, etfData: { select: { etfScore: true } } },
  })

  if (!company) notFound()

  if (company.assetType !== 'ETF') {
    redirect(`/etf/${tickerParam.toLowerCase()}`)
  }

  const session = await getServerSession(authOptions)
  const [user, stats, monthlyPricesCount] = await Promise.all([
    session ? getCurrentUser() : null,
    getPriceStats(company.id),
    prisma.historicalPrice.count({ where: { companyId: company.id, interval: '1mo' } }),
  ])
  const assetPath = `/etf/${ticker.toLowerCase()}`
  const hasEnoughData = monthlyPricesCount >= MIN_MONTHLY_PRICES
  const etfScore = company.etfData?.etfScore ?? null

  return (
    <TechnicalAnalysisLayout
      ticker={ticker}
      name={company.name}
      sector={company.sector}
      logoUrl={company.logoUrl}
      assetPath={assetPath}
      stats={stats}
    >
      {!hasEnoughData ? (
        <section aria-labelledby="historico-insuficiente" className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <h2 id="historico-insuficiente" className="text-lg font-semibold text-foreground">
            Histórico insuficiente
          </h2>
          <p className="mt-2 max-w-[68ch] text-sm leading-6 text-muted-foreground">
            O ETF {ticker} tem {monthlyPricesCount} {monthlyPricesCount === 1 ? 'mês' : 'meses'} de preços. A análise técnica
            precisa de pelo menos {MIN_MONTHLY_PRICES} meses (cerca de 4 anos) para calcular indicadores confiáveis; faltam{' '}
            {MIN_MONTHLY_PRICES - monthlyPricesCount} meses.
          </p>
        </section>
      ) : user?.isPremium ? (
        <TechnicalAnalysisPage ticker={ticker} fundamentalScore={etfScore} />
      ) : (
        <TechnicalAnalysisPageLimited ticker={ticker} analysisPath={`${assetPath}/analise-tecnica`} isLoggedIn={!!user} />
      )}
    </TechnicalAnalysisLayout>
  )
}
