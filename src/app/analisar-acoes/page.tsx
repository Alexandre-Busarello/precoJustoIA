import { Metadata } from 'next';
import AnalisarAcoesClient from './client';

export const metadata: Metadata = {
  title: 'Análise de ações da B3: preço justo por modelo de valuation',
  description: 'Analise ações da B3: preço justo estimado por Graham, fluxo de caixa descontado, Gordon e outros modelos, com margem de segurança e síntese gerada por IA.',
  keywords: 'análise ação, análise de ações, site para analisar ações, calcular ações, valuation de ações, analise de ações com IA, valuation fluxo de caixa descontado, análise fundamentalista ações, ações B3, bovespa investimentos, como investir em ações, preço justo ações',
  alternates: {
    canonical: '/analisar-acoes',
  },
  openGraph: {
    title: 'Análise de ações da B3: preço justo por modelo de valuation',
    description: 'Preço justo estimado por modelo de valuation, margem de segurança e síntese gerada por IA.',
    type: 'website',
    url: 'https://precojusto.ai/analisar-acoes',
    siteName: 'Preço Justo AI',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Análise de ações da B3',
    description: 'Preço justo estimado por modelo de valuation e margem de segurança.',
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
