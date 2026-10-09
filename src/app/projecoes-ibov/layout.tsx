import type { Metadata } from 'next'

const DESCRIPTION =
  'Faixas estatísticas para o Ibovespa em 1 semana, 1 mês e 12 meses, calculadas a partir do histórico do índice, com calibração. Não é previsão nem recomendação.'

export const metadata: Metadata = {
  title: 'Projeções do Ibovespa',
  description: DESCRIPTION,
  alternates: {
    canonical: '/projecoes-ibov',
  },
  openGraph: {
    title: 'Projeções do Ibovespa',
    description: DESCRIPTION,
    type: 'website',
    url: '/projecoes-ibov',
  },
}

export default function ProjecoesIbovLayout({ children }: { children: React.ReactNode }) {
  return children
}
