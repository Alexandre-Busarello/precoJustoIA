import Script from 'next/script'

interface SEOStructuredDataProps {
  type?: 'homepage' | 'article' | 'product' | 'organization'
  title?: string
  description?: string
  url?: string
  image?: string
  datePublished?: string
  dateModified?: string
  author?: string
  price?: string
  currency?: string
}

export function SEOStructuredData({
  type = 'homepage',
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
  author,
  price,
  currency = 'BRL'
}: SEOStructuredDataProps) {
  const baseUrl = 'https://precojusto.ai'
  const defaultImage = `${baseUrl}/logo-preco-justo.png`

  const getStructuredData = () => {
    const baseData: any = {
      "@context": "https://schema.org",
      "@graph": [
        // Organization
        {
          "@type": "Organization",
          "@id": `${baseUrl}/#organization`,
          "name": "Preço Justo AI",
          "url": baseUrl,
          "logo": {
            "@type": "ImageObject",
            "url": defaultImage,
            "width": 1200,
            "height": 630
          },
          "description": "Plataforma de análise fundamentalista de ações da B3 com inteligência artificial",
          "foundingDate": "2024",
          "founder": {
            "@type": "Person",
            "name": "Alexandre Busarello"
          },
          "sameAs": [
            "https://www.linkedin.com/company/preco-justo-ai"
          ],
          "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "customer service",
            "email": "busamar@gmail.com"
          }
        },
        // Website
        {
          "@type": "WebSite",
          "@id": `${baseUrl}/#website`,
          "url": baseUrl,
          "name": "Preço Justo AI",
          "description": "Análise fundamentalista de ações da B3 com IA",
          "publisher": {
            "@id": `${baseUrl}/#organization`
          },
          "potentialAction": [
            {
              "@type": "SearchAction",
              "target": {
                "@type": "EntryPoint",
                "urlTemplate": `${baseUrl}/acao/{search_term_string}`
              },
              "query-input": "required name=search_term_string"
            }
          ]
        }
      ]
    }

    // Add specific structured data based on type
    switch (type) {
      case 'homepage':
        baseData["@graph"].push({
          "@type": "SoftwareApplication",
          "@id": `${baseUrl}/#software`,
          "name": "Preço Justo AI",
          "description": "Análise fundamentalista automatizada de ações da B3 com inteligência artificial",
          "url": baseUrl,
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web",
          "offers": [
            {
              "@type": "Offer",
              "name": "Plano Gratuito",
              "price": "0",
              "priceCurrency": "BRL",
              "description": "Fórmula de Graham e análise de 350+ empresas da B3"
            },
            {
              "@type": "Offer",
              "name": "Premium Mensal",
              "price": "19.90",
              "priceCurrency": "BRL",
              "billingIncrement": "P1M",
              "description": "8 modelos de valuation + análise com IA"
            }
          ],
          "featureList": [
            "Análise fundamentalista automatizada",
            "8 modelos de valuation",
            "Análise com inteligência artificial",
            "Mais de 350 empresas da B3",
            "Comparador de ações",
            "Rankings personalizados"
          ],
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "ratingCount": "1250",
            "bestRating": "5"
          }
        })
        break

      case 'article':
        if (title && description && url) {
          baseData["@graph"].push({
            "@type": "Article",
            "headline": title,
            "description": description,
            "url": url,
            "image": image || defaultImage,
            "datePublished": datePublished,
            "dateModified": dateModified || datePublished,
            "author": {
              "@type": "Person",
              "name": author || "Preço Justo AI"
            },
            "publisher": {
              "@id": `${baseUrl}/#organization`
            },
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": url
            }
          })
        }
        break

      case 'product':
        if (title && description && price) {
          baseData["@graph"].push({
            "@type": "Product",
            "name": title,
            "description": description,
            "image": image || defaultImage,
            "brand": {
              "@type": "Brand",
              "name": "Preço Justo AI"
            },
            "offers": {
              "@type": "Offer",
              "price": price,
              "priceCurrency": currency,
              "availability": "https://schema.org/InStock",
              "seller": {
                "@id": `${baseUrl}/#organization`
              }
            }
          })
        }
        break
    }

    return baseData
  }

  return (
    <Script
      id="structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(getStructuredData())
      }}
    />
  )
}

// Breadcrumb component for better navigation SEO
interface BreadcrumbItem {
  name: string
  url: string
}

interface SEOBreadcrumbProps {
  items: BreadcrumbItem[]
}

export function SEOBreadcrumb({ items }: SEOBreadcrumbProps) {
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  }

  return (
    <Script
      id="breadcrumb-structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(breadcrumbData)
      }}
    />
  )
}

// FAQ structured data component
interface FAQItem {
  question: string
  answer: string
}

interface SEOFAQProps {
  faqs: FAQItem[]
}

export function SEOFAQ({ faqs }: SEOFAQProps) {
  const faqData = {
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
  }

  return (
    <Script
      id="faq-structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(faqData)
      }}
    />
  )
}
