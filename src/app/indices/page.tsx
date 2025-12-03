/**
 * Dashboard de Índices IPJ
 * Lista todos os índices disponíveis
 * Otimizado para SEO com palavras-chave: carteira teórica fundamentalista, índice teórico da bolsa
 */

import { Metadata } from 'next'
import { Card, CardContent } from '@/components/ui/card'
import { IndexCard } from '@/components/indices/index-card'
import { IndexDisclaimer } from '@/components/indices/index-disclaimer'
import { TrendingUp } from 'lucide-react'
import { getIndicesList } from '@/lib/index-data'
import { IndicesClient } from '@/components/indices/indices-client'

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

export default async function IndicesPage() {
  const indices = await getIndicesList()

  return (
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
    </div>
  )
}
