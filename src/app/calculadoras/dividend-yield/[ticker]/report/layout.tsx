import type { Metadata } from 'next'

type Props = { params: Promise<{ ticker: string }>; children: React.ReactNode }

/** Metadados do relatório de dividend yield (página cliente que exige login: fora do índice). */
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { ticker } = await params
  const symbol = ticker.toUpperCase()
  return {
    title: `Relatório de dividend yield de ${symbol}`,
    description: `Simulação de renda com dividendos de ${symbol}: histórico de proventos e dividend yield estimado.`,
    alternates: { canonical: `/calculadoras/dividend-yield/${ticker.toLowerCase()}/report` },
    robots: { index: false, follow: true },
  }
}

export default function DividendYieldReportLayout({ children }: Props) {
  return children
}
