import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { formatBRL } from '@/lib/format'
import TechnicalAnalysisPage from '@/components/technical-analysis-page'
import TechnicalAnalysisPageLimited from '@/components/technical-analysis-page-limited'
import { PredecessorTickerLink } from '@/components/predecessor-ticker-link'
import { TechnicalAnalysisLayout } from './technical-analysis-layout'
import { getPriceStats } from './price-stats'

interface PageProps {
  params: Promise<{
    ticker: string
  }>
}

const INDICATORS_TEXT =
  'IFR, MACD, estocástico, bandas de Bollinger, médias móveis, suporte e resistência, Fibonacci, Ichimoku e faixa de preço estimada por IA para 30 dias'

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const ticker = resolvedParams.ticker.toUpperCase()

  const company = await prisma.company.findUnique({
    where: { ticker },
    select: {
      name: true,
      sector: true,
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1,
        select: { price: true }
      }
    }
  })

  if (!company) {
    return {
      title: `Análise técnica de ${ticker}`,
      description: `Análise técnica de ${ticker}: ${INDICATORS_TEXT}.`,
      robots: { index: true, follow: true }
    }
  }

  const price = company.dailyQuotes[0]?.price ? Number(company.dailyQuotes[0].price) : null
  const title = `Análise técnica de ${ticker} (${company.name})`
  const description = `Análise técnica de ${ticker} (${company.name})${company.sector ? `, setor ${company.sector}` : ''}.${
    price ? ` Preço atual: ${formatBRL(price)}.` : ''
  } ${INDICATORS_TEXT.charAt(0).toUpperCase()}${INDICATORS_TEXT.slice(1)}.`

  return {
    title,
    description,
    keywords: [
      `análise técnica ${ticker}`,
      `${ticker} análise técnica`,
      `indicadores técnicos ${ticker}`,
      `IFR ${ticker}`,
      `MACD ${ticker}`,
      `Bollinger ${ticker}`,
      `Fibonacci ${ticker}`,
      `Ichimoku ${ticker}`,
      `suporte e resistência ${ticker}`,
      company.name,
      company.sector || ''
    ].filter(Boolean).join(', '),
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Preço Justo AI'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1
      }
    },
    alternates: {
      canonical: `https://precojusto.ai/acao/${ticker.toLowerCase()}/analise-tecnica`
    }
  }
}

export default async function TechnicalAnalysisPageRoute({ params }: PageProps) {
  const resolvedParams = await params
  const tickerParam = resolvedParams.ticker
  const ticker = tickerParam.toUpperCase()

  const company = await prisma.company.findUnique({
    where: { ticker },
    select: {
      id: true,
      name: true,
      sector: true,
      logoUrl: true,
      assetType: true,
      predecessor: { select: { ticker: true } }
    }
  })

  if (!company) {
    notFound()
  }

  if (company.assetType !== 'STOCK') {
    redirect(`/acao/${tickerParam.toLowerCase()}`)
  }

  const session = await getServerSession(authOptions)
  const [user, stats] = await Promise.all([session ? getCurrentUser() : null, getPriceStats(company.id)])
  const assetPath = `/acao/${ticker.toLowerCase()}`

  return (
    <TechnicalAnalysisLayout
      ticker={ticker}
      name={company.name}
      sector={company.sector}
      logoUrl={company.logoUrl}
      assetPath={assetPath}
      stats={stats}
      headerExtra={
        company.predecessor ? (
          <PredecessorTickerLink
            predecessorTicker={company.predecessor.ticker}
            currentTicker={ticker}
            pageType="analise-tecnica"
          />
        ) : null
      }
    >
      {user?.isPremium ? (
        <TechnicalAnalysisPage ticker={ticker} />
      ) : (
        <TechnicalAnalysisPageLimited ticker={ticker} analysisPath={`${assetPath}/analise-tecnica`} isLoggedIn={!!user} />
      )}
    </TechnicalAnalysisLayout>
  )
}
