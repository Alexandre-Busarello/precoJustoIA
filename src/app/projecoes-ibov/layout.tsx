import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Projeções do Ibovespa',
  description:
    'Estimativas semanal, mensal e anual para o Ibovespa geradas por IA a partir de indicadores macroeconômicos e de mercado. Estimativas, não recomendação de investimento.',
  alternates: {
    canonical: '/projecoes-ibov',
  },
  openGraph: {
    title: 'Projeções do Ibovespa',
    description: 'Estimativas semanal, mensal e anual para o Ibovespa geradas por IA.',
    type: 'website',
    url: '/projecoes-ibov',
  },
}

export default function ProjecoesIbovLayout({ children }: { children: React.ReactNode }) {
  return children
}
