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
import { IndexPerformanceHeader } from '@/components/indices/index-performance-header'
import { IndexCompositionTable } from '@/components/indices/index-composition-table'
import { IndexRebalanceTimeline } from '@/components/indices/index-rebalance-timeline'
import { IndexDisclaimer } from '@/components/indices/index-disclaimer'
import { IndexRealTimeReturn } from '@/components/indices/index-realtime-return'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SectionHeader } from '@/components/ui/section-header'
import { PageHeader } from '@/components/page-header'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { getIndexByTicker } from '@/lib/index-data'
import { formatDeltaPct, formatPct } from '@/lib/format'
import { prisma } from '@/lib/prisma'
import {
  IndexAssetPerformanceLazy,
  IndexComparisonChartLazy,
  IndexDailyViewLazy,
} from '@/components/indices/index-detail-client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { FAQSection } from '@/components/landing/faq-section'

/** Quantos itens de composição e histórico quem não é Premium vê. */
const FREE_PREVIEW = 3

interface IndexDetailPageProps {
  params: Promise<{ ticker: string }>
}

export async function generateMetadata({ params }: IndexDetailPageProps): Promise<Metadata> {
  const { ticker: tickerParam } = await params
  const ticker = tickerParam.toUpperCase()
  
  const index = await getIndexByTicker(ticker)
  
  if (!index) {
    return {
      title: 'Índice não encontrado',
    }
  }

  // accumulatedReturn e currentYield vêm em pontos percentuais.
  const returnText = formatDeltaPct(index.accumulatedReturn / 100)
  const yieldText = index.currentYield ? `, DY médio de ${formatPct(index.currentYield / 100)}` : ''
  
  const description = `${index.name} (${index.ticker}): carteira teórica fundamentalista com retorno de ${returnText} desde o início${yieldText}. ${index.description} Acompanhe a composição, histórico de rebalanceamento e performance comparada com IBOV e CDI.`

  return {
    title: `${index.name} (${index.ticker}): índice teórico da bolsa`,
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
      title: `${index.name} (${index.ticker}): índice teórico da bolsa`,
      description,
      type: 'website',
      url: `https://precojusto.ai/indices/${ticker.toLowerCase()}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${index.name} (${index.ticker}): índice teórico da bolsa`,
      description,
    },
    alternates: {
      canonical: `/indices/${ticker.toLowerCase()}`,
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
    answer: 'A performance do índice mostra a rentabilidade acumulada desde o início, comparada com benchmarks como IBOVESPA e CDI. Quando a linha do índice fica acima da do benchmark, a estratégia superou a referência no período. O gráfico comparativo permite visualizar a evolução ao longo do tempo.'
  },
  {
    question: 'Como funciona o rebalanceamento automático?',
    answer: 'O rebalanceamento automático ocorre quando ações entram ou saem da carteira seguindo os critérios da metodologia do índice. O processamento do rebalanceamento e entrada/saída de ativos acontece diariamente às 20h após o after market. Você pode acompanhar todas as mudanças na aba "Histórico", que mostra quando cada ação foi adicionada ou removida e o motivo da decisão.'
  },
  {
    question: 'O que significa "pontos" do índice?',
    answer: 'Os pontos representam o valor teórico da carteira, começando em 100 pontos na data inicial. Se o índice está em 150 pontos, significa que a carteira teórica valorizou 50% desde o início. Os pontos são recalculados diariamente com base nos preços de fechamento das ações.'
  },
  {
    question: 'Como são calculados os dividendos recebidos?',
    answer: 'Os dividendos recebidos são calculados automaticamente quando as empresas da carteira distribuem proventos. O valor total de dividendos recebidos é acumulado e exibido junto com o dividend yield atual, mostrando quanto a carteira teórica recebeu em proventos ao longo do tempo.'
  },
  {
    question: 'Posso usar este índice como referência para investir?',
    answer: 'Os índices são ferramentas educacionais e de referência, não recomendações de investimento. Eles demonstram como uma estratégia quantitativa se comportaria historicamente, mas não garantem resultados futuros. Sempre faça sua própria análise e consulte um profissional qualificado antes de investir.'
  },
  {
    question: 'Com que frequência a composição do índice muda?',
    answer: 'A frequência de rebalanceamento depende da metodologia de cada índice e das condições de mercado. Alguns índices podem ter rebalanceamentos mensais, trimestrais ou semestrais. Quando ocorrem mudanças, o processamento é feito diariamente às 20h após o after market. Você pode acompanhar todas as mudanças na aba "Histórico" da página do índice.'
  },
  {
    question: 'Como funcionam os benchmarks (IBOVESPA e CDI)?',
    answer: 'Os benchmarks são referências para comparar a performance do índice. O IBOVESPA é o principal índice da bolsa brasileira, representando o desempenho médio das ações mais negociadas. O CDI é uma taxa de juros que representa a rentabilidade de investimentos de baixo risco. Ambos são normalizados para iniciar em 100 pontos na mesma data do índice e aparecem no gráfico como linha cinza tracejada. Quando o índice está acima do benchmark, significa que superou a referência; quando está abaixo, teve desempenho inferior. Você pode alternar entre IBOVESPA e CDI usando os botões acima do gráfico.'
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
  const user = await getCurrentUser()
  const isPremium = user?.isPremium || false

  // Buscar histórico e logs
  const [history, logs] = await Promise.all([
    prisma.indexHistoryPoints.findMany({
      where: { indexId: index.id },
      orderBy: [
        { date: 'desc' },      // Mais recente primeiro
        { createdAt: 'desc' }   // Dentro do mesmo dia, mais recente primeiro
      ],
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
      orderBy: [
        { date: 'desc' },        // Mais recente primeiro entre dias diferentes
        { createdAt: 'asc' }     // Mais antigo primeiro dentro do mesmo dia (ordem cronológica)
      ],
      take: 200, // Aumentado para suportar paginação (200 registros = 20 páginas de 10 itens)
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
  // Com ordenação descendente: history[0] é o mais recente, history[history.length - 1] é o mais antigo
  const startDate = history.length > 0 
    ? history[history.length - 1].date  // Mais antigo (primeira data)
    : new Date()
  const lastHistoryDate = history.length > 0 
    ? history[0].date  // Mais recente (última data)
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

  // Converter histórico para formato necessário
  // O histórico vem ordenado por date desc e createdAt desc (mais recente primeiro)
  // Para o gráfico, precisamos ordem cronológica (mais antigo primeiro), então invertemos
  const historyData = [...history]
    .reverse() // Inverter para ordem cronológica (mais antigo primeiro) para o gráfico
    .map(h => ({
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

      return {
        ticker: comp.assetTicker,
        name: company?.name || comp.assetTicker,
        logoUrl: company?.logoUrl || null,
        sector: company?.sector || null,
        targetWeight: comp.targetWeight,
        dividendYield: company?.financialData[0]?.dy 
          ? Number(company.financialData[0].dy) * 100 
          : null,
      }
    })
  )

  const lockedComposition = isPremium ? 0 : Math.max(0, compositionWithDetails.length - FREE_PREVIEW)
  const lockedLogs = isPremium ? 0 : Math.max(0, logsData.length - FREE_PREVIEW)

  return (
    <>
      <div className="min-h-screen overflow-x-hidden bg-background">
        <div className="container mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:py-8">
          <PageHeader
            breadcrumb={[{ label: 'Índices', href: '/indices' }, { label: index.ticker }]}
            title={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {index.name}
                <Badge variant="neutral">{index.ticker}</Badge>
              </span>
            }
            description={index.description}
          />

          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <IndexPerformanceHeader
              currentPoints={index.currentPoints}
              accumulatedReturn={index.accumulatedReturn}
              currentYield={index.currentYield}
              totalDividendsReceived={index.totalDividendsReceived}
            />
            <IndexRealTimeReturn ticker={index.ticker} />
          </div>

          <Tabs defaultValue="performance" className="gap-6">
            <TabsList variant="underline" aria-label="Seções do índice">
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="composition">Composição</TabsTrigger>
              <TabsTrigger value="asset-performance">Por ativo</TabsTrigger>
              <TabsTrigger value="daily-view">Visão diária</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="performance" className="space-y-6">
              <IndexComparisonChartLazy
                indexHistory={historyData}
                ibovData={benchmarks.ibov}
                cdiData={benchmarks.cdi}
              />
              <section className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
                <SectionHeader title="Metodologia" as="h2" />
                <MarkdownRenderer content={index.methodology} className="text-sm" />
              </section>
            </TabsContent>

            <TabsContent value="composition">
              <IndexCompositionTable
                composition={isPremium ? compositionWithDetails : compositionWithDetails.slice(0, FREE_PREVIEW)}
                lockedCount={lockedComposition}
              />
            </TabsContent>

            <TabsContent value="asset-performance">
              <IndexAssetPerformanceLazy ticker={index.ticker} />
            </TabsContent>

            <TabsContent value="daily-view">
              <IndexDailyViewLazy ticker={index.ticker} />
            </TabsContent>

            <TabsContent value="history">
              <IndexRebalanceTimeline
                logs={isPremium ? logsData : logsData.slice(0, FREE_PREVIEW)}
                lockedCount={lockedLogs}
              />
            </TabsContent>
          </Tabs>

          <IndexDisclaimer />
        </div>

        {!isLoggedIn && (
          <FAQSection
            title={`Perguntas frequentes sobre ${index.name}`}
            description="Dúvidas comuns sobre este índice teórico da bolsa brasileira"
            faqs={faqs}
            className="border-t border-border"
          />
        )}
      </div>

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
