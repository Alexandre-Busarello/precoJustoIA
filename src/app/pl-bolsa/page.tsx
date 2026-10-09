import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PLBolsaPageClient } from '@/components/pl-bolsa-page-client'
import { PageHeader } from '@/components/page-header'
import { getAvailableSectors } from '@/lib/pl-bolsa-service'

export const metadata: Metadata = {
  title: 'P/L histórico da Bovespa: valuation da bolsa brasileira',
  description:
    'Gráfico interativo do P/L histórico da Bovespa desde 2010. Filtre por setor, período e score. Entenda a evolução da valorização da bolsa brasileira. Dados de empresas listadas na B3.',
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
    title: 'P/L histórico da Bovespa',
    description:
      'Gráfico interativo do P/L histórico da Bovespa desde 2010. Filtre por setor, período e score. Dados de empresas listadas na B3.',
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
    title: 'P/L histórico da Bovespa',
    description:
      'Gráfico interativo do P/L histórico da Bovespa desde 2010. Filtre por setor, período e score.',
    images: ['https://precojusto.ai/og-pl-bolsa.png'],
  },
  alternates: {
    canonical: '/pl-bolsa',
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
        name: 'P/L histórico da Bovespa',
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

      <div className="container mx-auto max-w-6xl space-y-8 px-4 py-6 sm:py-8">
        <PageHeader
          title="P/L histórico da Bovespa"
          description="Evolução do P/L (preço/lucro) agregado da bolsa brasileira desde 2010, com filtros por período, setor e score."
        />

        <PLBolsaPageClient initialSectors={sectors} />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="max-w-[68ch] space-y-8 text-base leading-7 text-muted-foreground">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">O que é P/L</h2>
              <p>
                O P/L (preço/lucro) indica quantos anos de lucro, no ritmo atual, seriam necessários para pagar o preço
                de uma ação ou de um conjunto de ações. É um dos indicadores mais usados para avaliar o valuation.
              </p>
              <p>
                Um P/L baixo indica que as ações negociam a um múltiplo menor dos lucros; um P/L alto, a um múltiplo
                maior. O contexto importa: setores em crescimento tendem a ter P/L mais altos, e setores maduros, mais
                baixos.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Por que acompanhar o P/L histórico</h2>
              <ul className="list-disc space-y-2 pl-5">
                <li>Identificar ciclos de mercado, com períodos de múltiplos mais altos e mais baixos.</li>
                <li>Comparar o momento atual com a média histórica do período escolhido.</li>
                <li>Observar tendências de longo prazo no valuation da bolsa.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Como ler o gráfico</h2>
              <p>
                A linha azul é o P/L agregado, calculado como média ponderada pelo valor de mercado das empresas. A linha
                cinza tracejada é a média do período selecionado.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Abaixo da média: a bolsa negocia a múltiplos menores que o habitual no período.</li>
                <li>Perto da média: múltiplos em linha com o histórico.</li>
                <li>Acima da média: múltiplos maiores que o habitual no período.</li>
              </ul>
              <p className="text-sm">
                O P/L agregado é uma referência de contexto. Não é recomendação de investimento.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Filtros disponíveis</h2>
              <ul className="list-disc space-y-2 pl-5">
                <li>Período: o intervalo de datas a analisar.</li>
                <li>Setor: um setor específico da economia, como bancos, petróleo ou varejo.</li>
                <li>Score mínimo: só empresas com score fundamentalista a partir do valor escolhido (0 a 100).</li>
              </ul>
            </section>

            <section className="space-y-1">
              <h2 className="mb-2 text-lg font-semibold text-foreground">Perguntas frequentes sobre P/L</h2>
              <div className="divide-y divide-border border-y border-border">
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                  Qual é o P/L médio histórico da Bovespa?
                  <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-90"><ChevronRight className="size-4" strokeWidth={1.75} /></span>
                </summary>
                <p className="pb-4 text-sm leading-6 text-muted-foreground">O P/L médio histórico da Bovespa varia ao longo do tempo e costuma ficar entre 10x e 15x. Use o gráfico para ver a média exata do período que você quer analisar.</p>
              </details>
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                  Como interpretar o P/L histórico?
                  <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-90"><ChevronRight className="size-4" strokeWidth={1.75} /></span>
                </summary>
                <p className="pb-4 text-sm leading-6 text-muted-foreground">Quando o P/L agregado está abaixo da média histórica, o mercado negocia a múltiplos menores que o habitual; acima da média, a múltiplos maiores. É uma referência de contexto, não um indicador de momento para operar.</p>
              </details>
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                  O P/L histórico é atualizado com que frequência?
                  <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-90"><ChevronRight className="size-4" strokeWidth={1.75} /></span>
                </summary>
                <p className="pb-4 text-sm leading-6 text-muted-foreground">Os dados são atualizados mensalmente com base nos últimos resultados financeiros disponíveis e nos preços de fechamento do último dia útil de cada mês.</p>
              </details>
              </div>
            </section>
          </article>

          <aside className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">Recursos relacionados</h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            <li>
              <Link href="/ranking" className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-muted">
                <span>
                  <span className="block text-sm font-medium text-foreground">Rankings de ações</span>
                  <span className="block text-sm text-muted-foreground">Modelos de valuation aplicados a ações individuais.</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </li>
            <li>
              <Link href="/analise-setorial" className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-muted">
                <span>
                  <span className="block text-sm font-medium text-foreground">Análise setorial</span>
                  <span className="block text-sm text-muted-foreground">Compare setores da B3 por score e valuation.</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </li>
            <li>
              <Link href="/metodologia" className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-muted">
                <span>
                  <span className="block text-sm font-medium text-foreground">Metodologia</span>
                  <span className="block text-sm text-muted-foreground">Como os modelos de análise fundamentalista funcionam.</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </li>
            <li>
              <Link href="/comparador" className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-muted">
                <span>
                  <span className="block text-sm font-medium text-foreground">Comparador de ações</span>
                  <span className="block text-sm text-muted-foreground">Até 6 ações lado a lado com os mesmos indicadores.</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </li>
            </ul>
          </aside>
        </div>
      </div>

      {/* Schema.org Structured Data - Melhorado */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Dataset',
            name: 'P/L histórico da Bovespa',
            description:
              'Dados históricos do P/L agregado da Bovespa desde 2010, calculado como média ponderada por market cap. Inclui empresas listadas na B3.',
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
            name: 'P/L histórico da Bovespa',
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
                  name: 'P/L histórico da Bovespa',
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

