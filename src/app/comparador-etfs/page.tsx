import { Metadata } from 'next'
import { ComparadorHub } from '../comparador/comparador-hub'

export const metadata: Metadata = {
  title: 'Comparador de ETFs B3 | Compare Fundos de Índice com Score PJ',
  description: 'Compare até 6 ETFs da B3 lado a lado: taxa de administração, retornos históricos, patrimônio, concentração e o Score Preço Justo.',
  keywords: 'comparar ETFs B3, comparador ETF bovespa, BOVA11 vs IVVB11, taxa ETF, score ETF, retorno ETF, fundos de índice Brasil',
  alternates: { canonical: '/comparador-etfs' },
  robots: { index: true, follow: true },
}

/** Mantida por enquanto: renderiza o hub do comparador com a aba ETFs aberta. */
export default function ComparadorEtfsPage() {
  return <ComparadorHub tipo="etfs" />
}
