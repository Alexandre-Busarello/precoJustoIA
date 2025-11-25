import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DividendRadarTickerPageContent } from '@/components/dividend-radar-ticker-page-content'
import { DividendRadarService } from '@/lib/dividend-radar-service'

interface PageProps {
  params: {
    ticker: string
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const ticker = params.ticker.toUpperCase()

  const company = await prisma.company.findUnique({
    where: { ticker },
    select: {
      name: true,
      sector: true,
    },
  })

  if (!company) {
    return {
      title: `Radar de Dividendos - ${ticker} | Não Encontrado`,
    }
  }

  const projections = await DividendRadarService.getOrGenerateProjections(ticker)
  const projectionCount = projections.length

  return {
    title: `Radar de Dividendos ${ticker} (${company.name}) | Projeções de Dividendos`,
    description: `Projeções de dividendos para ${ticker} (${company.name}) usando inteligência artificial. ${projectionCount} projeções para os próximos 12 meses com datas e valores estimados.`,
    keywords: [
      `radar de dividendos ${ticker}`,
      `dividendos ${ticker}`,
      `projeções ${ticker}`,
      `proventos ${ticker}`,
      `${company.name} dividendos`,
      `calendário de dividendos ${ticker}`,
    ],
    openGraph: {
      title: `Radar de Dividendos ${ticker} - ${company.name}`,
      description: `${projectionCount} projeções de dividendos para os próximos 12 meses`,
      type: 'website',
    },
  }
}

export default async function RadarDividendosTickerPage({ params }: PageProps) {
  const ticker = params.ticker.toUpperCase()

  const company = await prisma.company.findUnique({
    where: { ticker },
    select: {
      id: true,
      ticker: true,
      name: true,
      sector: true,
      logoUrl: true,
      dividendRadarProjections: true,
    },
  })

  if (!company) {
    notFound()
  }

  return <DividendRadarTickerPageContent company={company} />
}

