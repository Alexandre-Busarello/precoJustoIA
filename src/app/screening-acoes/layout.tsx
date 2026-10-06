import { Metadata } from 'next'

export const metadata: Metadata = {
  // Objeto (e não string) para não zerar o template do layout raiz nas páginas de estratégia (/screening-acoes/[slug]).
  title: {
    default: "Screening de ações B3 gratuito: filtros customizáveis com IA",
    template: "%s | Preço Justo AI",
  },
  description: "Encontre ações específicas na B3 com filtros avançados. Screening gratuito com P/L, ROE, Dividend Yield, crescimento e mais. Assistente de IA para gerar filtros personalizados. Busque ações B3 e BDRs.",
  keywords: "screening ações B3, filtro ações bovespa, buscar ações por critérios, filtros customizáveis ações, screening fundamentalista, encontrar ações específicas, filtro P/L ROE, ações com dividend yield alto, screening gratuito ações",
  openGraph: {
    title: "Screening de ações B3 gratuito",
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

