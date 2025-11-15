import { Metadata } from 'next'
import { PLBolsaPageClient } from '@/components/pl-bolsa-page-client'
import { getAvailableSectors } from '@/lib/pl-bolsa-service'

export const metadata: Metadata = {
  title: 'P/L Histórico da Bovespa | Análise de Valuation da Bolsa Brasileira',
  description:
    'Gráfico interativo do P/L histórico da Bovespa desde 2001. Filtre por setor, período e score. Entenda a evolução da valorização da bolsa brasileira.',
  keywords: [
    'P/L bovespa',
    'P/L histórico',
    'valuation bolsa brasileira',
    'preço lucro bovespa',
    'P/L médio bovespa',
    'análise fundamentalista bovespa',
    'indicadores bolsa de valores',
    'P/L agregado B3',
  ],
  openGraph: {
    title: 'P/L Histórico da Bovespa | Preço Justo AI',
    description:
      'Gráfico interativo do P/L histórico da Bovespa desde 2001. Filtre por setor, período e score.',
    type: 'website',
    url: 'https://precojusto.ai/pl-bolsa',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'P/L Histórico da Bovespa',
    description:
      'Gráfico interativo do P/L histórico da Bovespa desde 2001. Filtre por setor, período e score.',
  },
  alternates: {
    canonical: 'https://precojusto.ai/pl-bolsa',
  },
}

export default async function PLBolsaPage() {
  const sectors = await getAvailableSectors()

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">
          P/L Histórico da Bovespa
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          Acompanhe a evolução do P/L (Preço/Lucro) agregado da bolsa brasileira
          desde 2001. Use os filtros para analisar setores específicos, períodos
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

      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Dataset',
            name: 'P/L Histórico da Bovespa',
            description:
              'Dados históricos do P/L agregado da Bovespa desde 2001, calculado como média ponderada por market cap',
            url: 'https://precojusto.ai/pl-bolsa',
            creator: {
              '@type': 'Organization',
              name: 'Preço Justo AI',
              url: 'https://precojusto.ai',
            },
            datePublished: '2001-01-01',
            temporalCoverage: '2001-01-01/..',
            spatialCoverage: {
              '@type': 'Place',
              name: 'Brasil',
            },
            distribution: {
              '@type': 'DataDownload',
              encodingFormat: 'application/json',
              contentUrl: 'https://precojusto.ai/api/pl-bolsa',
            },
          }),
        }}
      />
    </div>
  )
}

