/**
 * Índices Preço Justo (IPJ): lista das carteiras teóricas.
 * Palavras-chave de SEO: carteira teórica fundamentalista, índice teórico da bolsa.
 */

import { Metadata } from 'next'
import { IndexDisclaimer } from '@/components/indices/index-disclaimer'
import { getIndicesList } from '@/lib/index-data'
import { IndicesClient } from '@/components/indices/indices-client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FAQSection } from '@/components/landing/faq-section'
import { PageHeader } from '@/components/page-header'
import { MarketTickerBar } from '@/components/indices/market-ticker-bar'

// Revalida a cada 60 s: novos índices aparecem em até 1 minuto.
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Índices teóricos da bolsa e carteiras fundamentalistas',
  description: 'Acompanhe carteiras teóricas automatizadas baseadas em análise fundamentalista quantitativa. Índices teóricos da bolsa brasileira com rebalanceamento automático e performance histórica. Compare com IBOV e CDI.',
  keywords: [
    'índice teórico da bolsa',
    'carteira teórica fundamentalista',
    'carteiras automatizadas',
    'análise fundamentalista quantitativa',
    'rebalanceamento automático',
    'índices B3',
    'carteira de ações',
    'investimento quantitativo',
    'screening fundamentalista',
    'portfólio teórico'
  ],
  openGraph: {
    title: 'Índices teóricos da bolsa e carteiras fundamentalistas',
    description: 'Acompanhe carteiras teóricas automatizadas baseadas em análise fundamentalista quantitativa. Índices teóricos da bolsa brasileira com rebalanceamento automático.',
    type: 'website',
    url: 'https://precojusto.ai/indices',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Índices teóricos da bolsa e carteiras fundamentalistas',
    description: 'Acompanhe carteiras teóricas automatizadas baseadas em análise fundamentalista quantitativa.',
  },
  alternates: {
    canonical: '/indices',
  },
}

const faqs = [
  {
    question: 'O que são índices teóricos da bolsa?',
    answer: 'Índices teóricos são carteiras de ações criadas com base em algoritmos quantitativos de análise fundamentalista. Eles simulam como uma carteira de investimentos se comportaria seguindo critérios objetivos e metodologias específicas, permitindo comparar a performance com benchmarks como IBOVESPA e CDI.'
  },
  {
    question: 'Como funcionam os índices Preço Justo?',
    answer: 'Nossos índices são rebalanceados automaticamente seguindo critérios fundamentais como valuation, qualidade financeira, dividendos e crescimento. Cada índice tem uma metodologia específica que determina quais ações entram ou saem da carteira. O rebalanceamento e a entrada/saída de ativos são processados diariamente às 10h da manhã quando o pregão abre, garantindo que as mudanças sejam aplicadas no início do dia de negociação.'
  },
  {
    question: 'Os índices são atualizados em tempo real?',
    answer: 'Sim, os índices são atualizados diariamente com os preços de fechamento das ações. O cálculo de performance, dividendos recebidos e rentabilidade acumulada é feito automaticamente, permitindo acompanhar a evolução da carteira teórica em tempo real.'
  },
  {
    question: 'Posso investir diretamente nos índices?',
    answer: 'Não, os índices são apenas teóricos e servem como referência para análise. Eles demonstram como uma estratégia de investimento se comportaria historicamente, mas não são produtos de investimento reais. Sempre consulte um profissional qualificado antes de tomar decisões de investimento.'
  },
  {
    question: 'Como comparar a performance dos índices?',
    answer: 'Cada índice mostra sua performance comparada com benchmarks como IBOVESPA e CDI. Você pode visualizar gráficos comparativos, rentabilidade acumulada, dividendos recebidos e outros indicadores que ajudam a entender o desempenho relativo da estratégia.'
  },
  {
    question: 'Qual a diferença entre os índices disponíveis?',
    answer: 'Cada índice segue uma metodologia diferente. Alguns focam em dividendos, outros em crescimento, valuation ou qualidade financeira. A descrição de cada índice explica sua metodologia específica e critérios de seleção de ações.'
  },
  {
    question: 'Como funcionam os benchmarks (IBOVESPA e CDI)?',
    answer: 'Os benchmarks são referências para comparar a performance dos índices. O IBOVESPA é o principal índice da bolsa brasileira e representa o desempenho médio das ações mais negociadas. O CDI (Certificado de Depósito Interbancário) é uma taxa de juros que representa a rentabilidade de investimentos de baixo risco. Ambos são normalizados para iniciar em 100 pontos na mesma data do índice, permitindo comparação visual direta no gráfico. Quando o índice está acima do benchmark, significa que superou a referência; quando está abaixo, teve desempenho inferior.'
  }
]

export default async function IndicesPage() {
  const indices = await getIndicesList()
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session?.user

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
          <MarketTickerBar />

          <PageHeader
            title="Índices Preço Justo"
            description="Carteiras teóricas montadas por critérios quantitativos de análise fundamentalista, com rebalanceamento automático e comparação com IBOV e CDI."
          />

          {indices && indices.length > 0 ? (
            <>
              <IndicesClient
                initialIndices={indices.map((idx) => ({
                  ...idx,
                  lastUpdate: idx.lastUpdate ? idx.lastUpdate.toISOString() : null,
                  sparklineData: idx.sparklineData ?? undefined,
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Linha azul: evolução recente do índice. Linha tracejada cinza: nível de partida do período.
              </p>
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'CollectionPage',
                    name: 'Índices teóricos da bolsa',
                    description: 'Carteiras teóricas automatizadas baseadas em análise fundamentalista quantitativa',
                    url: 'https://precojusto.ai/indices',
                    mainEntity: {
                      '@type': 'ItemList',
                      numberOfItems: indices.length,
                      itemListElement: indices.map((index, indexNum) => ({
                        '@type': 'ListItem',
                        position: indexNum + 1,
                        item: {
                          '@type': 'FinancialProduct',
                          name: index.name,
                          tickerSymbol: index.ticker,
                          description: index.description,
                          url: `https://precojusto.ai/indices/${index.ticker.toLowerCase()}`,
                        },
                      })),
                    },
                  }),
                }}
              />
            </>
          ) : (
            <div className="rounded-lg border border-border bg-card p-6 text-center">
              <p className="text-sm text-foreground">Nenhum índice disponível no momento.</p>
              <p className="mt-1 text-sm text-muted-foreground">Os índices são recalculados após o fechamento do pregão.</p>
            </div>
          )}

          <IndexDisclaimer />
        </div>

        {!isLoggedIn && (
          <FAQSection
            title="Perguntas frequentes sobre índices teóricos"
            description="Dúvidas comuns sobre os índices teóricos da bolsa brasileira"
            faqs={faqs}
            className="border-t border-border"
          />
        )}
      </div>

      {!isLoggedIn && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqs.map((faq) => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: faq.answer,
                },
              })),
            }),
          }}
        />
      )}
    </>
  )
}
