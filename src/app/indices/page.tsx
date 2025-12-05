/**
 * Dashboard de Índices IPJ
 * Lista todos os índices disponíveis
 * Otimizado para SEO com palavras-chave: carteira teórica fundamentalista, índice teórico da bolsa
 */

import { Metadata } from 'next'

// Revalidar a página a cada 60 segundos (1 minuto)
// Isso permite cache para performance, mas garante que novos índices apareçam em até 1 minuto
export const revalidate = 60
import { Card, CardContent } from '@/components/ui/card'
import { IndexDisclaimer } from '@/components/indices/index-disclaimer'
import { TrendingUp } from 'lucide-react'
import { getIndicesList } from '@/lib/index-data'
import { IndicesClient } from '@/components/indices/indices-client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Footer } from '@/components/footer'
import { FAQSection } from '@/components/landing/faq-section'

export const metadata: Metadata = {
  title: 'Índices Teóricos da Bolsa | Carteiras Teóricas Fundamentalistas | Preço Justo',
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
    title: 'Índices Teóricos da Bolsa | Carteiras Teóricas Fundamentalistas',
    description: 'Acompanhe carteiras teóricas automatizadas baseadas em análise fundamentalista quantitativa. Índices teóricos da bolsa brasileira com rebalanceamento automático.',
    type: 'website',
    url: 'https://precojusto.ai/indices',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Índices Teóricos da Bolsa | Carteiras Teóricas Fundamentalistas',
    description: 'Acompanhe carteiras teóricas automatizadas baseadas em análise fundamentalista quantitativa.',
  },
  alternates: {
    canonical: 'https://precojusto.ai/indices',
  },
}

const faqs = [
  {
    question: 'O que são índices teóricos da bolsa?',
    answer: 'Índices teóricos são carteiras de ações criadas com base em algoritmos quantitativos de análise fundamentalista. Eles simulam como uma carteira de investimentos se comportaria seguindo critérios objetivos e metodologias específicas, permitindo comparar a performance com benchmarks como IBOVESPA e CDI.',
    iconName: 'Lightbulb'
  },
  {
    question: 'Como funcionam os índices Preço Justo?',
    answer: 'Nossos índices são rebalanceados automaticamente seguindo critérios fundamentais como valuation, qualidade financeira, dividendos e crescimento. Cada índice tem uma metodologia específica que determina quais ações entram ou saem da carteira. O rebalanceamento e a entrada/saída de ativos são processados diariamente às 10h da manhã quando o pregão abre, garantindo que as mudanças sejam aplicadas no início do dia de negociação.',
    iconName: 'Brain'
  },
  {
    question: 'Os índices são atualizados em tempo real?',
    answer: 'Sim, os índices são atualizados diariamente com os preços de fechamento das ações. O cálculo de performance, dividendos recebidos e rentabilidade acumulada é feito automaticamente, permitindo acompanhar a evolução da carteira teórica em tempo real.',
    iconName: 'Clock'
  },
  {
    question: 'Posso investir diretamente nos índices?',
    answer: 'Não, os índices são apenas teóricos e servem como referência para análise. Eles demonstram como uma estratégia de investimento se comportaria historicamente, mas não são produtos de investimento reais. Sempre consulte um profissional qualificado antes de tomar decisões de investimento.',
    iconName: 'Shield'
  },
  {
    question: 'Como comparar a performance dos índices?',
    answer: 'Cada índice mostra sua performance comparada com benchmarks como IBOVESPA e CDI. Você pode visualizar gráficos comparativos, rentabilidade acumulada, dividendos recebidos e outros indicadores que ajudam a entender o desempenho relativo da estratégia.',
    iconName: 'Target'
  },
  {
    question: 'Qual a diferença entre os índices disponíveis?',
    answer: 'Cada índice segue uma metodologia diferente. Alguns focam em dividendos, outros em crescimento, valuation ou qualidade financeira. A descrição de cada índice explica sua metodologia específica e critérios de seleção de ações.',
    iconName: 'Search'
  },
  {
    question: 'Como funcionam os benchmarks (IBOVESPA e CDI)?',
    answer: 'Os benchmarks são referências para comparar a performance dos índices. O IBOVESPA é o principal índice da bolsa brasileira e representa o desempenho médio das ações mais negociadas. O CDI (Certificado de Depósito Interbancário) é uma taxa de juros que representa a rentabilidade de investimentos de baixo risco. Ambos são normalizados para iniciar em 100 pontos na mesma data do índice, permitindo comparação visual direta no gráfico. Quando o índice está acima do benchmark, significa que superou a referência; quando está abaixo, teve desempenho inferior.',
    iconName: 'Target'
  }
]

export default async function IndicesPage() {
  const indices = await getIndicesList()
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session?.user

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background/80">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-3xl font-bold">Índices Preço Justo</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Carteiras teóricas automatizadas baseadas em algoritmos quantitativos de análise fundamentalista
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
              Acompanhe índices teóricos da bolsa brasileira com rebalanceamento automático e compare a performance com IBOV e CDI
            </p>
          </div>

          {/* Disclaimer */}
          <div className="mb-6">
            <IndexDisclaimer />
          </div>

          {/* Lista de Índices */}
          {indices && indices.length > 0 ? (
            <>
              <IndicesClient initialIndices={indices.map(idx => ({
                ...idx,
                lastUpdate: idx.lastUpdate ? idx.lastUpdate.toISOString() : null,
                sparklineData: idx.sparklineData ?? undefined,
              }))} />
              {/* Structured Data para SEO */}
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'CollectionPage',
                    name: 'Índices Teóricos da Bolsa',
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
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-600 dark:text-gray-400">
                  Nenhum índice disponível no momento.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* FAQ Section - Apenas para usuários deslogados */}
        {!isLoggedIn && (
          <FAQSection
            title="Perguntas Frequentes sobre Índices Teóricos"
            description="Tire suas dúvidas sobre nossos índices teóricos da bolsa brasileira"
            faqs={faqs}
          />
        )}
      </div>

      {/* Footer - Apenas para usuários deslogados */}
      {!isLoggedIn && <Footer />}

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
