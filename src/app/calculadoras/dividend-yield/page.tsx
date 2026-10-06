import { Metadata } from "next"
import { DividendYieldCalculator } from "@/components/dividend-yield-calculator"
import { PageHeader } from "@/components/page-header"

export const metadata: Metadata = {
  title: "Calculadora de dividend yield e renda com dividendos",
  description:
    "Calcule o dividend yield e a renda mensal estimada com dividendos de ações da B3 a partir do valor investido. Gratuita e sem cadastro.",
  keywords: [
    "calculadora dividend yield",
    "renda passiva ações",
    "projeção dividendos",
    "calculadora dividendos B3",
    "quanto ganho com dividendos",
    "renda mensal ações",
    "ações pagadoras de dividendos",
    "dividend yield calculadora",
  ],
  openGraph: {
    title: "Calculadora de dividend yield",
    description: "Calcule a renda mensal estimada com dividendos de ações da B3. Gratuita e sem cadastro.",
    type: "website",
    url: "https://precojusto.ai/calculadoras/dividend-yield",
  },
  twitter: {
    card: "summary_large_image",
    title: "Calculadora de dividend yield",
    description: "Calcule a renda estimada com dividendos de ações da B3.",
  },
  alternates: {
    canonical: "/calculadoras/dividend-yield",
  },
}

const steps = [
  { title: "Escolha a ação", text: "Digite o ticker ou o nome da empresa (ex.: PETR4, TAEE11, ITUB4)." },
  { title: "Informe o valor", text: "Quanto você pretende investir ou já tem investido na ação." },
  { title: "Veja a renda estimada", text: "Dividend yield, renda mensal média e renda em 12 meses, com base nos últimos proventos." },
]

const faqs = [
  {
    q: "O que é dividend yield?",
    a: "É o percentual dos proventos pagos nos últimos 12 meses em relação à cotação atual da ação. Um DY de 8% significa que, no último ano, a empresa pagou o equivalente a 8% do preço atual em dividendos e JCP.",
  },
  {
    q: "A renda calculada é garantia de pagamento futuro?",
    a: "Não. O cálculo usa os proventos já pagos. Empresas podem aumentar, reduzir ou suspender pagamentos, então trate o resultado como estimativa.",
  },
  {
    q: "Preciso pagar para usar?",
    a: "Não. A calculadora é gratuita e não exige cadastro. O relatório completo, com sustentabilidade dos proventos e comparação setorial, pede apenas uma conta gratuita.",
  },
]

export default function DividendYieldCalculatorPage() {
  return (
    <div className="container mx-auto max-w-6xl space-y-10 px-4 py-6 sm:py-8">
      <PageHeader
        breadcrumb={[{ label: "Calculadoras", href: "/calculadoras" }, { label: "Dividend yield" }]}
        title="Calculadora de dividend yield"
        description="Quanto uma ação da B3 rendeu em dividendos nos últimos 12 meses e quanto isso representa no seu valor investido."
      />

      <DividendYieldCalculator />

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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Calculadora de dividend yield",
            description: "Calcule o dividend yield e a renda estimada com dividendos de ações da B3",
            url: "https://precojusto.ai/calculadoras/dividend-yield",
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
          }),
        }}
      />
    </div>
  )
}
