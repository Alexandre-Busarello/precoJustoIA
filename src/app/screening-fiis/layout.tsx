import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Screening de FIIs B3 | DY, P/VP, liquidez e segmento - Preço Justo AI",
  description:
    "Encontre fundos imobiliários na B3 com filtros por Dividend Yield, P/VP, liquidez, vacância, quantidade de imóveis, segmento e tipo (tijolo ou papel). Screening gratuito alinhado ao score PJ-FII.",
  keywords:
    "screening FII, filtrar FIIs B3, fundos imobiliários dividend yield, FII P VP baixo, screening fundos imobiliários, FIIs tijolo papel, liquidez FII, B3 FII",
  openGraph: {
    title: "Screening de FIIs B3 | Preço Justo AI",
    description:
      "Filtre FIIs por DY, P/VP, liquidez, segmento e mais. Ferramenta gratuita para investidores em fundos imobiliários.",
    type: "website",
    url: "/screening-fiis",
  },
  alternates: {
    canonical: "/screening-fiis",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function ScreeningFiisLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
