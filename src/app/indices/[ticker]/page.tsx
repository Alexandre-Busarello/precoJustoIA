/**
 * Página de Detalhes do Índice
 * Exibe performance, gráfico comparativo, composição e timeline
 * Otimizado para SEO com metadata dinâmica
 */

import { Metadata } from 'next'

// Revalidar a página a cada 60 segundos (1 minuto)
// Isso permite cache para performance, mas garante que novos índices apareçam em até 1 minuto
export const revalidate = 60
import { notFound } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { IndexPerformanceHeader } from '@/components/indices/index-performance-header'
import { IndexComparisonChart } from '@/components/indices/index-comparison-chart'
import { IndexCompositionTable } from '@/components/indices/index-composition-table'
import { IndexRebalanceTimeline } from '@/components/indices/index-rebalance-timeline'
import { IndexDisclaimer } from '@/components/indices/index-disclaimer'
import { IndexRealTimeReturn } from '@/components/indices/index-realtime-return'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { getIndexByTicker } from '@/lib/index-data'
import { prisma } from '@/lib/prisma'
import { IndexDetailClient } from '@/components/indices/index-detail-client'

interface IndexDetailPageProps {
  params: Promise<{ ticker: string }>
}

export async function generateMetadata({ params }: IndexDetailPageProps): Promise<Metadata> {
  const { ticker: tickerParam } = await params
  const ticker = tickerParam.toUpperCase()
  
  const index = await getIndexByTicker(ticker)
  
  if (!index) {
    return {
      title: 'Índice não encontrado | Preço Justo',
    }
  }

  const returnText = index.accumulatedReturn >= 0 
    ? `+${index.accumulatedReturn.toFixed(1)}%` 
    : `${index.accumulatedReturn.toFixed(1)}%`
  
  const yieldText = index.currentYield 
    ? ` | Yield: ${(index.currentYield * 100).toFixed(2)}%` 
    : ''
  
  const description = `${index.name} (${index.ticker}) - Carteira teórica fundamentalista com performance de ${returnText}${yieldText}. ${index.description} Acompanhe a composição, histórico de rebalanceamento e performance comparada com IBOV e CDI.`

  return {
    title: `${index.name} (${index.ticker}) | Índice Teórico da Bolsa | Preço Justo`,
    description,
    keywords: [
      `${index.ticker} índice`,
      `${index.name} carteira teórica`,
      'índice teórico da bolsa',
      'carteira teórica fundamentalista',
      'rebalanceamento automático',
      'performance índice',
      'composição carteira',
      'análise quantitativa',
      'investimento fundamentalista',
    ],
    openGraph: {
      title: `${index.name} (${index.ticker}) | Índice Teórico da Bolsa`,
      description,
      type: 'website',
      url: `https://precojusto.ai/indices/${ticker.toLowerCase()}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${index.name} (${index.ticker}) | Índice Teórico da Bolsa`,
      description,
    },
    alternates: {
      canonical: `https://precojusto.ai/indices/${ticker.toLowerCase()}`,
    },
  }
}

export async function generateStaticParams() {
  const indices = await prisma.indexDefinition.findMany({
    select: {
      ticker: true,
    },
  })

  return indices.map((index) => ({
    ticker: index.ticker.toLowerCase(),
  }))
}

export default async function IndexDetailPage({ params }: IndexDetailPageProps) {
  const { ticker: tickerParam } = await params
  const ticker = tickerParam.toUpperCase()

  const index = await getIndexByTicker(ticker)

  if (!index) {
    notFound()
  }

  // Buscar histórico e logs
  const [history, logs] = await Promise.all([
    prisma.indexHistoryPoints.findMany({
      where: { indexId: index.id },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        points: true,
        dailyChange: true,
        currentYield: true,
        dividendsReceived: true,
        dividendsByTicker: true,
      },
    }),
    prisma.indexRebalanceLog.findMany({
      where: { indexId: index.id },
      orderBy: { date: 'desc' },
      take: 50,
      select: {
        id: true,
        date: true,
        action: true,
        ticker: true,
        reason: true,
      },
    }),
  ])

  // Buscar benchmarks usando o serviço diretamente
  const startDate = history.length > 0 ? history[0].date : new Date()
  const endDate = history.length > 0 
    ? history[history.length - 1].date
    : new Date()

  let benchmarks: { ibov: Array<{ date: string; value: number }>; cdi: Array<{ date: string; value: number }> } = { ibov: [], cdi: [] }
  try {
    const { fetchBenchmarkData } = await import('@/lib/benchmark-service')
    const benchmarkData = await fetchBenchmarkData(startDate, endDate)
    // Converter para o formato esperado pelo componente
    benchmarks = {
      ibov: benchmarkData.ibov.map(b => ({ date: b.date, value: b.value })),
      cdi: benchmarkData.cdi.map(b => ({ date: b.date, value: b.value })),
    }
  } catch (error) {
    console.error('Erro ao buscar benchmarks:', error)
  }

  const historyData = history.map(h => ({
    date: h.date.toISOString().split('T')[0],
    points: h.points,
    dailyChange: h.dailyChange,
    currentYield: h.currentYield,
    dividendsReceived: h.dividendsReceived ? Number(h.dividendsReceived) : null,
    dividendsByTicker: h.dividendsByTicker as Record<string, number> | null,
  }))

  const logsData = logs.map(log => ({
    id: log.id,
    date: log.date.toISOString().split('T')[0],
    action: log.action as 'ENTRY' | 'EXIT' | 'REBALANCE',
    ticker: log.ticker,
    reason: log.reason,
  }))

  // Buscar dados detalhados da composição
  const compositionWithDetails = await Promise.all(
    index.composition.map(async (comp) => {
      const company = await prisma.company.findUnique({
        where: { ticker: comp.assetTicker },
        select: {
          name: true,
          logoUrl: true,
          sector: true,
          financialData: {
            orderBy: { year: 'desc' },
            take: 1,
            select: {
              dy: true,
            },
          },
        },
      })

      const { getTickerPrice } = await import('@/lib/quote-service')
      const priceData = await getTickerPrice(comp.assetTicker)
      const currentPrice = priceData?.price || comp.entryPrice
      const entryReturn = ((currentPrice - comp.entryPrice) / comp.entryPrice) * 100

      return {
        ticker: comp.assetTicker,
        name: company?.name || comp.assetTicker,
        logoUrl: company?.logoUrl || null,
        sector: company?.sector || null,
        targetWeight: comp.targetWeight,
        entryPrice: comp.entryPrice,
        entryDate: comp.entryDate.toISOString().split('T')[0],
        currentPrice,
        entryReturn,
        dividendYield: company?.financialData[0]?.dy 
          ? Number(company.financialData[0].dy) * 100 
          : null,
      }
    })
  )

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background/80 overflow-x-hidden">
        <div className="container mx-auto px-4 py-8 max-w-7xl w-full">
          {/* Header */}
          <div className="mb-6">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/indices">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Link>
            </Button>
            
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{index.name}</h1>
                  <Badge 
                    variant="outline"
                    style={{ borderColor: index.color, color: index.color }}
                  >
                    {index.ticker}
                  </Badge>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {index.description}
                </p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mb-6">
            <IndexDisclaimer />
          </div>

          {/* Performance Header */}
          <div className="mb-6">
            <IndexPerformanceHeader
              currentPoints={index.currentPoints}
              accumulatedReturn={index.accumulatedReturn}
              currentYield={index.currentYield}
              totalDividendsReceived={index.totalDividendsReceived}
              color={index.color}
            />
          </div>

          {/* Rentabilidade em Tempo Real */}
          <div className="mb-6">
            <IndexRealTimeReturn ticker={index.ticker} color={index.color} />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="performance" className="space-y-6">
            <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 md:overflow-visible md:mx-0 md:px-0">
              <TabsList className="inline-flex md:inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-max min-w-full md:min-w-0">
                <TabsTrigger value="performance" className="whitespace-nowrap flex-shrink-0">Performance</TabsTrigger>
                <TabsTrigger value="composition" className="whitespace-nowrap flex-shrink-0">Composição</TabsTrigger>
                <TabsTrigger value="asset-performance" className="whitespace-nowrap flex-shrink-0">
                  <span className="hidden sm:inline">Performance Individual</span>
                  <span className="sm:hidden">Individual</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="whitespace-nowrap flex-shrink-0">Histórico</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="performance" className="space-y-6">
              <IndexComparisonChart
                indexHistory={historyData}
                ibovData={benchmarks.ibov}
                cdiData={benchmarks.cdi}
                indexColor={index.color}
              />

              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-4">Metodologia</h3>
                  <MarkdownRenderer content={index.methodology} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="composition">
              <IndexCompositionTable composition={compositionWithDetails} />
            </TabsContent>

            <TabsContent value="asset-performance">
              <IndexDetailClient ticker={index.ticker} />
            </TabsContent>

            <TabsContent value="history">
              <IndexRebalanceTimeline logs={logsData} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Structured Data para SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FinancialProduct',
            name: index.name,
            tickerSymbol: index.ticker,
            description: index.description,
            url: `https://precojusto.ai/indices/${ticker.toLowerCase()}`,
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: index.accumulatedReturn > 0 ? '4' : '3',
              reviewCount: '1',
            },
            offers: {
              '@type': 'Offer',
              priceCurrency: 'BRL',
              availability: 'https://schema.org/InStock',
            },
          }),
        }}
      />
    </>
  )
}
