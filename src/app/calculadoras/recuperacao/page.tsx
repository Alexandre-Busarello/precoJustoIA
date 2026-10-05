import { Metadata } from "next"
import { Suspense } from "react"
import { RecoveryCalculatorClient } from "@/components/recovery-calculator-client"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"

const BASE_URL = "https://precojusto.ai"
const PAGE_URL = `${BASE_URL}/calculadoras/recuperacao`

export const metadata: Metadata = {
  title: "Calculadora de recuperação: aporte para recuperar prejuízo em ações",
  description:
    "Calculadora de recuperação gratuita e sem cadastro. Simule quantas ações adicionar e qual aporte seria necessário para empatar ou sair com lucro em uma ação da B3.",
  keywords: [
    "calculadora recuperação",
    "calculadora recuperação ações",
    "aporte para recuperar prejuízo",
    "preço médio ações",
    "recuperar prejuízo ações",
    "quanto aportar para recuperar",
    "break even ações",
    "calculadora preço médio",
    "aporte ideal ações",
    "recuperar prejuízo bolsa",
    "calculadora investimentos grátis",
  ],
  openGraph: {
    title: "Calculadora de recuperação de prejuízo em ações",
    description:
      "Simule o aporte necessário para recuperar prejuízo em ações. Gratuita e sem cadastro.",
    type: "website",
    url: PAGE_URL,
    siteName: "Preço Justo AI",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Calculadora de recuperação",
    description: "Simule o aporte necessário para empatar ou sair com lucro em ações.",
  },
  alternates: {
    canonical: "/calculadoras/recuperacao",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
}

const steps = [
  { title: "Informe sua posição", text: "Preço médio, quantidade e cotação atual da ação." },
  { title: "Defina o cenário", text: "Quanto o ativo pode subir e com quanto de lucro você quer sair." },
  { title: "Veja a simulação", text: "Quantas ações adicionar, o aporte e o novo preço médio." },
]

const faqs = [
  {
    q: "O que é a calculadora de recuperação?",
    a: "Uma simulação de quantas ações você precisaria adicionar à posição para empatar ou sair com lucro, considerando uma alta do ativo. Ela também mostra a matemática da perda: uma queda de 50% exige alta de 100% para empatar.",
  },
  {
    q: "Como o aporte é calculado?",
    a: "Você informa preço médio, quantidade e cotação atual, e define a alta considerada e o lucro desejado. A calculadora mostra quantas ações adicionar, o aporte e o novo preço médio.",
  },
  {
    q: "A calculadora é gratuita?",
    a: "Sim. Sem cadastro, você faz 2 cálculos; com conta gratuita, 3 por mês; no Premium, o uso é ilimitado.",
  },
]

export default function RecoveryCalculatorPage() {
  return (
    <div className="container mx-auto max-w-6xl space-y-10 px-4 py-6 sm:py-8">
      <PageHeader
        breadcrumb={[{ label: "Calculadoras", href: "/calculadoras" }, { label: "Recuperação" }]}
        title="Calculadora de recuperação"
        description="Quantas ações adicionar, e com qual aporte, para empatar ou sair com lucro se o ativo subir."
      />

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <RecoveryCalculatorClient />
      </Suspense>

      <div className="grid gap-10 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Como funciona</h2>
          <ol className="space-y-4">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-medium text-foreground">{step.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Perguntas frequentes</h2>
          <div className="divide-y divide-border border-y border-border">
            {faqs.map((faq) => (
              <details key={faq.q} className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span aria-hidden="true" className="text-muted-foreground">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">−</span>
                  </span>
                </summary>
                <p className="pb-4 text-sm leading-6 text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      {/* Structured Data - WebApplication */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Calculadora de recuperação",
            description:
              "Simule o aporte necessário para empatar ou sair com lucro em uma ação.",
            url: PAGE_URL,
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "BRL",
            },
            featureList: [
              "Cálculo de aporte para recuperar prejuízo",
              "Simulação de lucro alvo (0%, 5%, 10%)",
              "Preço médio projetado",
              "Investimento necessário em reais",
              "Ferramenta gratuita e sem cadastro",
            ],
          }),
        }}
      />

      {/* Structured Data - HowTo para Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "Como usar a calculadora de recuperação",
            description: "Como simular o aporte necessário para recuperar prejuízo em ações",
            step: steps.map((step) => ({ "@type": "HowToStep", name: step.title, text: step.text })),
          }),
        }}
      />

      {/* Structured Data - FAQPage para Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          }),
        }}
      />
    </div>
  )
}
