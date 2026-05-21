import { FAQ_ITEMS, LP_META } from './lp-data'

const BASE_URL = 'https://precojusto.ai'

export function JsonLd() {
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Preço Justo AI — Plataforma de Análise Fundamentalista',
    description: LP_META.description,
    url: `${BASE_URL}${LP_META.canonical}`,
    brand: {
      '@type': 'Organization',
      name: 'Preço Justo AI',
      url: BASE_URL,
    },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'BRL',
      lowPrice: '0',
      offerCount: 2,
      offers: [
        {
          '@type': 'Offer',
          name: 'Plano Gratuito',
          price: '0',
          priceCurrency: 'BRL',
          availability: 'https://schema.org/InStock',
          url: `${BASE_URL}/register`,
        },
        {
          '@type': 'Offer',
          name: 'Plano Premium — Clube dos Dividendos',
          price: '29.90',
          priceCurrency: 'BRL',
          availability: 'https://schema.org/InStock',
          url: `${BASE_URL}${LP_META.canonical}#planos`,
        },
      ],
    },
  }

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(product) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
      />
    </>
  )
}
