import { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Screening de Ações B3 Gratuito | Filtros Customizáveis com IA - Preço Justo AI",
  description: "Encontre ações específicas na B3 com filtros avançados. Screening gratuito com P/L, ROE, Dividend Yield, crescimento e mais. Assistente de IA para gerar filtros personalizados. Busque ações B3 e BDRs.",
  keywords: "screening ações B3, filtro ações bovespa, buscar ações por critérios, filtros customizáveis ações, screening fundamentalista, encontrar ações específicas, filtro P/L ROE, ações com dividend yield alto, screening gratuito ações",
  openGraph: {
    title: "Screening de Ações B3 Gratuito | Preço Justo AI",
    description: "Encontre ações específicas na B3 com filtros avançados. Screening gratuito com P/L, ROE, Dividend Yield e mais.",
    type: "website",
    url: "/screening-acoes",
  },
  alternates: {
    canonical: "/screening-acoes",
  },
  robots: {
    index: true,
    follow: true,
  }
}

export default function ScreeningLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

