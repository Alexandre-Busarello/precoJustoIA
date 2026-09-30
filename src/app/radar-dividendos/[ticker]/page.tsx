import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DividendRadarTickerPageContent } from '@/components/dividend-radar-ticker-page-content'

interface PageProps {
  params: Promise<{
    ticker: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker: tickerParam } = await params
  const ticker = tickerParam.toUpperCase()

  // Só leitura: os metadados não disparam a geração de projeções.
  const company = await prisma.company.findUnique({
    where: { ticker },
    select: {
      name: true,
      dividendRadarProjections: true,
    },
  })

  if (!company) {
    return {
      title: `Radar de dividendos ${ticker}: não encontrado`,
    }
  }

  const projectionCount = Array.isArray(company.dividendRadarProjections) ? company.dividendRadarProjections.length : 0
  const projectionText =
    projectionCount > 0
      ? `${projectionCount} ${projectionCount === 1 ? 'data estimada' : 'datas estimadas'} por IA para os próximos meses`
      : 'datas estimadas por IA para os próximos meses'

  return {
    title: `Radar de dividendos ${ticker} (${company.name})`,
    description: `Proventos de ${ticker} (${company.name}): histórico de dividendos e JCP com data ex e valor por ação, e ${projectionText}.`,
    keywords: [
      `radar de dividendos ${ticker}`,
      `dividendos ${ticker}`,
      `proventos ${ticker}`,
      `data ex ${ticker}`,
      `${company.name} dividendos`,
      `calendário de dividendos ${ticker}`,
    ],
    openGraph: {
      title: `Radar de dividendos ${ticker} (${company.name})`,
      description: `Histórico de proventos e ${projectionText}.`,
      type: 'website',
    },
    alternates: {
      canonical: `/radar-dividendos/${ticker.toLowerCase()}`,
    },
  }
}

export default async function RadarDividendosTickerPage({ params }: PageProps) {
  const { ticker: tickerParam } = await params
  const ticker = tickerParam.toUpperCase()

  const company = await prisma.company.findUnique({
    where: { ticker },
    select: {
      ticker: true,
      name: true,
      sector: true,
      logoUrl: true,
      assetType: true,
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 2,
        select: { price: true },
      },
    },
  })

  if (!company) {
    notFound()
  }

  const price = company.dailyQuotes[0]?.price ? Number(company.dailyQuotes[0].price) : null
  const previous = company.dailyQuotes[1]?.price ? Number(company.dailyQuotes[1].price) : null
  const dayChange = price && previous && previous > 0 ? price / previous - 1 : null

  return (
    <DividendRadarTickerPageContent
      company={{
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        logoUrl: company.logoUrl,
        assetType: company.assetType,
      }}
      price={price}
      dayChange={dayChange}
    />
  )
}
