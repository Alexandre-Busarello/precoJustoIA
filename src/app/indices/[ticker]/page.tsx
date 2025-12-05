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
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Footer } from '@/components/footer'
import { FAQSection } from '@/components/landing/faq-section'
import { MarketTickerBar } from '@/components/indices/market-ticker-bar'

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

const faqs = [
  {
    question: 'Como interpretar a performance deste índice?',
    answer: 'A performance do índice mostra a rentabilidade acumulada desde o início, comparada com benchmarks como IBOVESPA e CDI. Valores positivos indicam que a estratégia superou o benchmark, enquanto valores negativos indicam desempenho inferior. O gráfico comparativo permite visualizar a evolução ao longo do tempo.',
    iconName: 'Target'
  },
  {
    question: 'Como funciona o rebalanceamento automático?',
    answer: 'O rebalanceamento automático ocorre quando ações entram ou saem da carteira seguindo os critérios da metodologia do índice. O processamento do rebalanceamento e entrada/saída de ativos acontece diariamente às 10h da manhã quando o pregão abre, garantindo que as mudanças sejam aplicadas no início do dia de negociação. Você pode acompanhar todas as mudanças na aba "Histórico", que mostra quando cada ação foi adicionada ou removida e o motivo da decisão.',
    iconName: 'Clock'
  },
  {
    question: 'O que significa "pontos" do índice?',
    answer: 'Os pontos representam o valor teórico da carteira, começando em 100 pontos na data inicial. Se o índice está em 150 pontos, significa que a carteira teórica valorizou 50% desde o início. Os pontos são recalculados diariamente com base nos preços de fechamento das ações.',
    iconName: 'DollarSign'
  },
  {
    question: 'Como são calculados os dividendos recebidos?',
    answer: 'Os dividendos recebidos são calculados automaticamente quando as empresas da carteira distribuem proventos. O valor total de dividendos recebidos é acumulado e exibido junto com o dividend yield atual, mostrando quanto a carteira teórica recebeu em proventos ao longo do tempo.',
    iconName: 'DollarSign'
  },
  {
    question: 'Posso usar este índice como referência para investir?',
    answer: 'Os índices são ferramentas educacionais e de referência, não recomendações de investimento. Eles demonstram como uma estratégia quantitativa se comportaria historicamente, mas não garantem resultados futuros. Sempre faça sua própria análise e consulte um profissional qualificado antes de investir.',
    iconName: 'Shield'
  },
  {
    question: 'Com que frequência a composição do índice muda?',
    answer: 'A frequência de rebalanceamento depende da metodologia de cada índice e das condições de mercado. Alguns índices podem ter rebalanceamentos mensais, trimestrais ou semestrais. Quando ocorrem mudanças, o processamento é feito diariamente às 10h da manhã quando o pregão abre. Você pode acompanhar todas as mudanças na aba "Histórico" da página do índice.',
    iconName: 'Clock'
  },
  {
    question: 'Como funcionam os benchmarks (IBOVESPA e CDI)?',
    answer: 'Os benchmarks são referências para comparar a performance do índice. O IBOVESPA (em azul) é o principal índice da bolsa brasileira, representando o desempenho médio das ações mais negociadas. O CDI (em verde) é uma taxa de juros que representa a rentabilidade de investimentos de baixo risco. Ambos são normalizados para iniciar em 100 pontos na mesma data do índice, permitindo comparação visual direta. Quando o índice está acima do benchmark, significa que superou a referência; quando está abaixo, teve desempenho inferior. Você pode alternar entre IBOVESPA e CDI usando os botões acima do gráfico.',
    iconName: 'Target'
  }
]

export default async function IndexDetailPage({ params }: IndexDetailPageProps) {
  const { ticker: tickerParam } = await params
  const ticker = tickerParam.toUpperCase()

  const index = await getIndexByTicker(ticker)

  if (!index) {
    notFound()
  }

  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session?.user

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
  const lastHistoryDate = history.length > 0 
    ? history[history.length - 1].date
    : new Date()
  
  // Expandir endDate para incluir alguns dias a mais (até hoje)
  // Isso garante que pegamos todos os dados disponíveis do IBOV, mesmo que o índice não tenha pontos até essa data
  const today = new Date()
  today.setHours(23, 59, 59, 999) // Fim do dia de hoje
  
  // Usar a data mais recente entre último ponto do histórico e hoje
  const endDate = lastHistoryDate.getTime() > today.getTime() ? lastHistoryDate : today

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

  // Função auxiliar para formatar data usando UTC (garantir data exata do banco)
  // Como o campo é @db.Date (sem hora), usar UTC evita problemas de timezone
  const formatDateLocal = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const historyData = history.map(h => ({
    date: formatDateLocal(h.date),
    points: h.points,
    dailyChange: h.dailyChange,
    currentYield: h.currentYield,
    dividendsReceived: h.dividendsReceived ? Number(h.dividendsReceived) : null,
    dividendsByTicker: h.dividendsByTicker as Record<string, number> | null,
  }))

  const logsData = logs.map(log => ({
    id: log.id,
    date: formatDateLocal(log.date),
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

        {/* FAQ Section - Apenas para usuários deslogados */}
        {!isLoggedIn && (
          <FAQSection
            title={`Perguntas Frequentes sobre ${index.name}`}
            description="Tire suas dúvidas sobre este índice teórico da bolsa brasileira"
            faqs={faqs}
          />
        )}
      </div>

      {/* Footer - Apenas para usuários deslogados */}
      {!isLoggedIn && <Footer />}

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

      {/* Schema Markup para FAQ SEO */}
      {!isLoggedIn && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": faqs.map(faq => ({
                "@type": "Question",
                "name": faq.question,
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": faq.answer
                }
              }))
            })
          }}
        />
      )}
    </>
  )
}
