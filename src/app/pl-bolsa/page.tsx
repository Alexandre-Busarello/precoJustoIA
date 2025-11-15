import { Metadata } from 'next'
import Link from 'next/link'
import { PLBolsaPageClient } from '@/components/pl-bolsa-page-client'
import { getAvailableSectors } from '@/lib/pl-bolsa-service'
import { Home, ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'P/L Histórico da Bovespa | Análise de Valuation da Bolsa Brasileira | Preço Justo AI',
  description:
    'Gráfico interativo do P/L histórico da Bovespa desde 2010. Filtre por setor, período e score. Entenda a evolução da valorização da bolsa brasileira. Dados de mais de 300 empresas da B3.',
  keywords: [
    'P/L bovespa',
    'P/L histórico',
    'valuation bolsa brasileira',
    'preço lucro bovespa',
    'P/L médio bovespa',
    'análise fundamentalista bovespa',
    'indicadores bolsa de valores',
    'P/L agregado B3',
    'P/L histórico Bovespa',
    'P/L médio histórico',
    'bolsa brasileira valuation',
    'índice P/L B3',
    'análise P/L histórico',
    'P/L mercado brasileiro',
    'valorização bolsa valores',
  ],
  openGraph: {
    title: 'P/L Histórico da Bovespa | Preço Justo AI',
    description:
      'Gráfico interativo do P/L histórico da Bovespa desde 2010. Filtre por setor, período e score. Dados de mais de 300 empresas.',
    type: 'website',
    url: 'https://precojusto.ai/pl-bolsa',
    siteName: 'Preço Justo AI',
    images: [
      {
        url: 'https://precojusto.ai/og-pl-bolsa.png',
        width: 1200,
        height: 630,
        alt: 'P/L Histórico da Bovespa',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'P/L Histórico da Bovespa | Preço Justo AI',
    description:
      'Gráfico interativo do P/L histórico da Bovespa desde 2010. Filtre por setor, período e score.',
    images: ['https://precojusto.ai/og-pl-bolsa.png'],
  },
  alternates: {
    canonical: 'https://precojusto.ai/pl-bolsa',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default async function PLBolsaPage() {
  const sectors = await getAvailableSectors()

  const baseUrl = 'https://precojusto.ai'

  // Breadcrumb Schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Início',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'P/L Histórico da Bovespa',
        item: `${baseUrl}/pl-bolsa`,
      },
    ],
  }

  return (
    <>
      {/* Breadcrumb Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-blue-600 transition-colors flex items-center gap-1">
            <Home className="w-4 h-4" />
            Início
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">P/L Histórico da Bovespa</span>
        </nav>

        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">
            P/L Histórico da Bovespa
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Acompanhe a evolução do P/L (Preço/Lucro) agregado da bolsa brasileira
            desde 2010. Use os filtros para analisar setores específicos, períodos
            de tempo e empresas com score mínimo.
          </p>
        </div>

      {/* Client Component com gráfico e filtros */}
      <PLBolsaPageClient initialSectors={sectors} />

      {/* Conteúdo SEO */}
      <div className="mt-12 prose prose-slate dark:prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">O que é P/L?</h2>
          <p className="text-muted-foreground mb-4">
            O P/L (Preço/Lucro) é um dos indicadores mais importantes para avaliar
            a valorização de uma ação ou de um índice. Ele representa quantos anos
            de lucro seriam necessários para pagar o preço atual da ação.
          </p>
          <p className="text-muted-foreground mb-4">
            Um P/L baixo pode indicar que as ações estão baratas em relação aos
            lucros, enquanto um P/L alto pode sugerir que estão caras. No entanto,
            é importante considerar o contexto: setores em crescimento tendem a ter
            P/L mais altos, enquanto setores maduros podem ter P/L mais baixos.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            Por que acompanhar o P/L histórico?
          </h2>
          <p className="text-muted-foreground mb-4">
            Acompanhar o P/L histórico da bolsa permite identificar:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
            <li>
              <strong>Ciclos de mercado:</strong> Períodos de alta e baixa
              valorização
            </li>
            <li>
              <strong>Oportunidades de compra:</strong> Quando o P/L está abaixo
              da média histórica
            </li>
            <li>
              <strong>Momentos de cautela:</strong> Quando o P/L está muito acima
              da média histórica
            </li>
            <li>
              <strong>Tendências de longo prazo:</strong> Evolução da valorização
              da bolsa ao longo dos anos
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Como interpretar os dados</h2>
          <p className="text-muted-foreground mb-4">
            O gráfico mostra o P/L agregado da Bovespa calculado como média
            ponderada por market cap. A linha tracejada representa a média histórica
            até cada ponto no tempo.
          </p>
          <div className="bg-muted p-4 rounded-lg mb-4">
            <p className="text-sm font-semibold mb-2">Interpretação:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>
                <strong>P/L abaixo da média:</strong> Mercado pode estar
                subvalorizado, potencial oportunidade de compra
              </li>
              <li>
                <strong>P/L próximo à média:</strong> Mercado em valorização
                normal
              </li>
              <li>
                <strong>P/L acima da média:</strong> Mercado pode estar
                supervalorizado, momento de cautela
              </li>
            </ul>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Filtros disponíveis</h2>
          <p className="text-muted-foreground mb-4">
            Use os filtros acima do gráfico para personalizar sua análise:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>
              <strong>Período:</strong> Selecione o intervalo de datas que deseja
              analisar
            </li>
            <li>
              <strong>Setor:</strong> Filtre por setor específico da economia
              (ex: Bancário, Petróleo, Varejo)
            </li>
            <li>
              <strong>Score Mínimo:</strong> Mostre apenas empresas com score
              mínimo (0-100) baseado em análise fundamentalista
            </li>
            <li>
              <strong>Excluir não lucrativas:</strong> Remova empresas que não
              tiveram lucro no período analisado
            </li>
          </ul>
        </section>
      </div>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Perguntas Frequentes sobre P/L</h2>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Qual é o P/L médio histórico da Bovespa?</h3>
              <p className="text-sm text-muted-foreground">
                O P/L médio histórico da Bovespa varia ao longo do tempo, mas geralmente fica entre 10x e 15x. 
                Use nosso gráfico interativo para ver a média exata do período que você deseja analisar.
              </p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Como interpretar o P/L histórico?</h3>
              <p className="text-sm text-muted-foreground">
                Quando o P/L está abaixo da média histórica, o mercado pode estar subvalorizado, 
                indicando potencial oportunidade de compra. Quando está acima, pode indicar supervalorização.
              </p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">O P/L histórico é atualizado com que frequência?</h3>
              <p className="text-sm text-muted-foreground">
                Os dados são atualizados mensalmente com base nos últimos resultados financeiros disponíveis 
                e nos preços de fechamento do último dia útil de cada mês.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Recursos Relacionados</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/ranking" className="block">
              <div className="bg-muted p-4 rounded-lg hover:bg-muted/80 transition-colors">
                <h3 className="font-semibold mb-2">Rankings de Ações</h3>
                <p className="text-sm text-muted-foreground">
                  Analise ações individuais usando modelos de valuation consagrados
                </p>
              </div>
            </Link>
            <Link href="/analise-setorial" className="block">
              <div className="bg-muted p-4 rounded-lg hover:bg-muted/80 transition-colors">
                <h3 className="font-semibold mb-2">Análise Setorial</h3>
                <p className="text-sm text-muted-foreground">
                  Compare o desempenho de diferentes setores da B3
                </p>
              </div>
            </Link>
            <Link href="/metodologia" className="block">
              <div className="bg-muted p-4 rounded-lg hover:bg-muted/80 transition-colors">
                <h3 className="font-semibold mb-2">Metodologia de Valuation</h3>
                <p className="text-sm text-muted-foreground">
                  Entenda os modelos de análise fundamentalista utilizados
                </p>
              </div>
            </Link>
            <Link href="/comparador" className="block">
              <div className="bg-muted p-4 rounded-lg hover:bg-muted/80 transition-colors">
                <h3 className="font-semibold mb-2">Comparador de Ações</h3>
                <p className="text-sm text-muted-foreground">
                  Compare até 6 ações lado a lado com métricas detalhadas
                </p>
              </div>
            </Link>
          </div>
        </section>
      </div>

      {/* Schema.org Structured Data - Melhorado */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Dataset',
            name: 'P/L Histórico da Bovespa',
            description:
              'Dados históricos do P/L agregado da Bovespa desde 2010, calculado como média ponderada por market cap. Inclui mais de 300 empresas listadas na B3.',
            url: 'https://precojusto.ai/pl-bolsa',
            creator: {
              '@type': 'Organization',
              name: 'Preço Justo AI',
              url: 'https://precojusto.ai',
              logo: 'https://precojusto.ai/logo-preco-justo.png',
            },
            datePublished: '2010-01-01',
            dateModified: new Date().toISOString().split('T')[0],
            temporalCoverage: '2010-01-01/..',
            spatialCoverage: {
              '@type': 'Place',
              name: 'Brasil',
              addressCountry: 'BR',
            },
            distribution: {
              '@type': 'DataDownload',
              encodingFormat: 'application/json',
              contentUrl: 'https://precojusto.ai/api/pl-bolsa',
            },
            keywords: 'P/L bovespa, P/L histórico, valuation bolsa brasileira, preço lucro bovespa',
            license: 'https://precojusto.ai/termos-de-uso',
            inLanguage: 'pt-BR',
          }),
        }}
      />

      {/* WebPage Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'P/L Histórico da Bovespa',
            description:
              'Gráfico interativo do P/L histórico da Bovespa desde 2010. Filtre por setor, período e score.',
            url: 'https://precojusto.ai/pl-bolsa',
            inLanguage: 'pt-BR',
            isPartOf: {
              '@type': 'WebSite',
              name: 'Preço Justo AI',
              url: 'https://precojusto.ai',
            },
            breadcrumb: {
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Início',
                  item: 'https://precojusto.ai',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'P/L Histórico da Bovespa',
                  item: 'https://precojusto.ai/pl-bolsa',
                },
              ],
            },
          }),
        }}
      />
    </>
  )
}

