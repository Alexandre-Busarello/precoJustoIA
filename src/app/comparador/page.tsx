import { Metadata } from 'next'
import { ComparadorHub, comparadorFaqs } from './comparador-hub'

export const metadata: Metadata = {
  title: 'Comparador de Ações B3 Gratuito | Compare Ações e ETFs da Bovespa',
  description: 'Compare até 6 ações ou ETFs da B3 lado a lado. Análise fundamentalista com P/L, ROE, dividend yield e mais de 25 indicadores. Versão gratuita disponível; o Premium inclui CAGR, margem líquida, ROIC e médias históricas.',
  keywords: 'comparador ações B3, comparar ações bovespa grátis, comparador ETF, análise comparativa ações, P/L ROE dividend yield, comparação fundamentalista, ferramenta comparar investimentos, comparar empresas B3, análise lado a lado ações',
  openGraph: {
    title: 'Comparador de Ações B3 | Análise Fundamentalista Gratuita',
    description: 'Compare ações e ETFs da B3 lado a lado, com o melhor valor de cada indicador destacado.',
    type: 'website',
    url: '/comparador',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Comparador de Ações B3 | Preço Justo AI',
    description: 'Compare até 6 ações ou ETFs da Bovespa com análise fundamentalista gratuita.',
  },
  alternates: {
    canonical: '/comparador',
  },
  robots: {
    index: true,
    follow: true,
  },
}

interface ComparadorPageProps {
  searchParams: Promise<{ tipo?: string | string[] }>
}

export default async function ComparadorPage({ searchParams }: ComparadorPageProps) {
  const { tipo } = await searchParams
  const activeTipo = tipo === 'etfs' ? 'etfs' : 'acoes'

  return (
    <>
      <ComparadorHub tipo={activeTipo} />

      {/* Schema FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: comparadorFaqs.map((faq) => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: { '@type': 'Answer', text: faq.answer },
            })),
          }),
        }}
      />

      {/* Schema WebApplication */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Comparador de Ações B3 - Preço Justo AI',
            description: 'Ferramenta gratuita para comparar até 6 ações ou ETFs da B3 com análise fundamentalista e mais de 25 indicadores financeiros.',
            url: 'https://precojusto.ai/comparador',
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
            featureList: [
              'Comparação de até 6 ações ou ETFs ao mesmo tempo',
              'Tabela única com o melhor valor de cada indicador destacado',
              'Mais de 25 indicadores financeiros',
              'Busca por ticker ou nome da empresa',
              'Dados atualizados da B3',
              'Versão gratuita',
              'Responsivo no celular e no computador',
            ],
            author: { '@type': 'Organization', name: 'Preço Justo AI', url: 'https://precojusto.ai' },
          }),
        }}
      />

      {/* Schema BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://precojusto.ai' },
              { '@type': 'ListItem', position: 2, name: 'Comparador de Ações', item: 'https://precojusto.ai/comparador' },
            ],
          }),
        }}
      />
    </>
  )
}
