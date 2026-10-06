import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  // Objeto com template: um título em string aqui zeraria o template da raiz para as páginas /fii/[ticker].
  title: {
    default: 'FIIs — Fundos Imobiliários B3',
    template: '%s | Preço Justo AI',
  },
  description:
    'Análise de fundos imobiliários (FIIs) na B3: PJ-FII score, dividend yield, P/VP, segmento e dados para decisão informada.',
  keywords:
    'FII, fundos imobiliários, B3, dividend yield FII, P/VP, análise FII, screening FIIs, PJ-FII, investimentos imobiliários',
  openGraph: {
    title: 'FIIs — Fundos Imobiliários B3',
    description:
      'Páginas dedicadas a cada FII com score proprietário, métricas e contexto de valuation para a bolsa brasileira.',
    siteName: 'Preço Justo AI',
    type: 'website',
  },
}

export default function FiiSegmentLayout({ children }: { children: ReactNode }) {
  return children
}
