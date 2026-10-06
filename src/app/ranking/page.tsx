import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { RANKING_MODELS } from "@/lib/ranking-models"
import { RankingClient } from "./ranking-client"

const TITLE = "Rankings de ações da B3 por estratégia"
const DESCRIPTION =
  "Rankings de ações da B3, BDRs, FIIs e ETFs por modelo de valuation: Número de Graham (grátis), Fórmula Mágica, fluxo de caixa descontado, Gordon, Barsi e outros, com preço justo e margem de segurança."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/ranking" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "/ranking",
    siteName: "Preço Justo AI",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
}

const freeModels = RANKING_MODELS.filter((m) => m.plan === "free" && m.assetType !== "etf").map((m) => m.label)
const stockModels = RANKING_MODELS.filter((m) => m.assetType === "stock").map((m) => m.label)

const FAQS = [
  {
    question: "O que são os rankings de ações?",
    answer:
      "São listas de empresas ordenadas por critérios de análise fundamentalista. Cada modelo calcula um preço justo ou uma pontuação a partir de indicadores como P/L, ROE, dividend yield e endividamento, usando médias de até 7 anos quando há histórico.",
  },
  {
    question: "Quais modelos estão disponíveis?",
    answer: `Para ações e BDRs: ${stockModels.join(", ")}. Também há rankings de FIIs (dividend yield e score PJ-FII) e de ETFs. Os modelos premium exigem assinatura.`,
  },
  {
    question: "O que é a margem de segurança?",
    answer:
      "É a distância entre o preço atual e o preço justo estimado pelo modelo: 1 − preço ÷ preço justo. Uma margem de 25% significa que o preço está 25% abaixo da estimativa; uma margem negativa indica preço acima dela.",
  },
  {
    question: "O histórico de rankings fica salvo?",
    answer:
      "Sim. Com uma conta, cada ranking que você gera fica salvo com os parâmetros e os resultados, e pode ser aberto de novo na aba Histórico.",
  },
  {
    question: "O que o plano gratuito inclui?",
    answer: `O plano gratuito inclui ${freeModels.join(" e ")}, além dos rankings de ETFs (10 primeiros). O Premium libera os demais modelos, com parâmetros editáveis.`,
  },
  {
    question: "O ranking substitui uma análise pessoal?",
    answer:
      "Não. Os rankings são estimativas de modelos quantitativos com dados públicos e não consideram o seu perfil. Não é recomendação de investimento; as fórmulas e premissas estão na página de metodologia.",
  },
]

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: "https://precojusto.ai" },
      { "@type": "ListItem", position: 2, name: "Rankings de ações", item: "https://precojusto.ai/ranking" },
    ],
  },
]

function RankingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.75} aria-label="Carregando rankings" />
    </div>
  )
}

export default function RankingPage() {
  return (
    <div className="bg-background">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6">
        <PageHeader
          title="Rankings de ações"
          description="Modelos de valuation aplicados a ações da B3, BDRs, FIIs e ETFs. Escolha o modelo e ajuste os parâmetros."
          className="mb-4"
        />

        <Suspense fallback={<RankingFallback />}>
          <RankingClient />
        </Suspense>

        <section aria-labelledby="ranking-faq-title" className="mt-12 border-t border-border pt-8">
          <SectionHeader id="ranking-faq-title" title="Perguntas frequentes" />
          <div className="mt-4 max-w-3xl divide-y divide-border border-y border-border">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </summary>
                <p className="pb-4 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Fórmulas, premissas e fontes de dados na{" "}
            <Link href="/metodologia" className="text-foreground underline underline-offset-4 hover:text-brand">
              metodologia
            </Link>
            .
          </p>
        </section>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}
