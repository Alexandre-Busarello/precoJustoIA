import { Metadata } from 'next';
import AnalisarAcoesClient from './client';

export const metadata: Metadata = {
  title: 'Análise de Ações B3 | Calcular Valuation | Site para Analisar Ações com IA',
  description: 'Análise de ações B3 com IA. Calcule valuation, fluxo de caixa descontado e encontre o preço justo. Site completo para analisar ações da Bovespa com 8 modelos de valuation automatizados.',
  keywords: 'análise ação, análise de ações, site para analisar ações, calcular ações, valuation de ações, analise de ações com IA, valuation fluxo de caixa descontado, análise fundamentalista ações, ações B3, bovespa investimentos, como investir em ações, melhores ações B3, preço justo ações',
  alternates: {
    canonical: '/analisar-acoes',
  },
  openGraph: {
    title: 'Análise de Ações B3 | Calcular Valuation | Site para Analisar Ações com IA',
    description: 'Análise de ações B3 com IA. Calcule valuation, fluxo de caixa descontado e encontre o preço justo.',
    type: 'website',
    url: 'https://precojusto.ai/analisar-acoes',
    siteName: 'Preço Justo AI',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Análise de Ações B3 | Calcular Valuation',
    description: 'Análise de ações B3 com IA. Calcule valuation e encontre o preço justo.',
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
};

export default function AnalisarAcoesPage() {
  return <AnalisarAcoesClient />;
}
