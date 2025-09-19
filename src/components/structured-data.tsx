'use client'

interface StructuredDataProps {
  type: 'website' | 'organization' | 'article' | 'product'
  data?: Record<string, any>
}

export function StructuredData({ type, data = {} }: StructuredDataProps) {
  const getStructuredData = () => {
    const baseData = {
      '@context': 'https://schema.org',
    }

    switch (type) {
      case 'website':
        return {
          ...baseData,
          '@type': 'WebSite',
          name: 'Preço Justo AI',
          description: 'Plataforma completa de análise fundamentalista com IA para ações da B3',
          url: 'https://precojusto.ai',
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: 'https://precojusto.ai/acao/{search_term_string}'
            },
            'query-input': 'required name=search_term_string'
          },
          publisher: {
            '@type': 'Organization',
            name: 'Preço Justo AI',
            url: 'https://precojusto.ai',
            logo: {
              '@type': 'ImageObject',
              url: 'https://precojusto.ai/logo-preco-justo.png'
            }
          }
        }

      case 'organization':
        return {
          ...baseData,
          '@type': 'Organization',
          name: 'Preço Justo AI',
          description: 'Plataforma de análise fundamentalista com inteligência artificial para investimentos na B3',
          url: 'https://precojusto.ai',
          logo: {
            '@type': 'ImageObject',
            url: 'https://precojusto.ai/logo-preco-justo.png',
            width: 400,
            height: 400
          },
          sameAs: [
            'https://twitter.com/PrecoJustoAI',
            'https://linkedin.com/company/precojusto-ai'
          ],
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            url: 'https://precojusto.ai/contato'
          },
          foundingDate: '2024',
          numberOfEmployees: '1-10',
          industry: 'Financial Technology',
          areaServed: 'BR',
          serviceType: 'Financial Analysis Software'
        }

      case 'article':
        return {
          ...baseData,
          '@type': 'Article',
          headline: data.title || 'Análise de Ação',
          description: data.description || 'Análise fundamentalista completa com IA',
          author: {
            '@type': 'Organization',
            name: 'Preço Justo AI'
          },
          publisher: {
            '@type': 'Organization',
            name: 'Preço Justo AI',
            logo: {
              '@type': 'ImageObject',
              url: 'https://precojusto.ai/logo-preco-justo.png'
            }
          },
          datePublished: data.datePublished || new Date().toISOString(),
          dateModified: data.dateModified || new Date().toISOString(),
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': data.url || 'https://precojusto.ai'
          },
          ...data
        }

      case 'product':
        return {
          ...baseData,
          '@type': 'SoftwareApplication',
          name: 'Preço Justo AI',
          description: 'Plataforma de análise fundamentalista com IA para ações da B3',
          url: 'https://precojusto.ai',
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Web Browser',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'BRL',
            availability: 'https://schema.org/InStock',
            priceValidUntil: '2025-12-31'
          },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.8',
            reviewCount: '150',
            bestRating: '5',
            worstRating: '1'
          },
          author: {
            '@type': 'Organization',
            name: 'Preço Justo AI'
          },
          screenshot: 'https://precojusto.ai/logo-preco-justo.png',
          ...data
        }

      default:
        return baseData
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(getStructuredData())
      }}
    />
  )
}
