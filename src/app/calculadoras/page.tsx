import { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { PageHeader } from "@/components/page-header"

export const metadata: Metadata = {
  title: "Calculadoras para investidores",
  description:
    "Calculadoras gratuitas para investidores da B3: dividend yield e renda com dividendos, recuperação de prejuízo em ações e arbitragem entre quitar dívidas e investir.",
  alternates: {
    canonical: "/calculadoras",
  },
  openGraph: {
    title: "Calculadoras para investidores",
    description: "Dividend yield, recuperação de prejuízo e arbitragem de dívida. Gratuitas.",
    type: "website",
    url: "/calculadoras",
  },
}

const calculators = [
  {
    href: "/calculadoras/dividend-yield",
    title: "Dividend yield",
    description: "Quanto uma ação rendeu em dividendos nos últimos 12 meses e a renda mensal estimada no seu valor investido.",
  },
  {
    href: "/calculadoras/recuperacao",
    title: "Recuperação",
    description: "Quantas ações adicionar, e com qual aporte, para empatar ou sair com lucro se o ativo subir.",
  },
  {
    href: "/arbitragem-divida",
    title: "Arbitragem de dívida",
    description: "Compare quitar uma dívida antes do prazo com manter o dinheiro investido, mês a mês.",
  },
]

export default function CalculadorasPage() {
  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-6 sm:py-8">
      <PageHeader
        title="Calculadoras"
        description="Ferramentas gratuitas para simular renda com dividendos, recuperação de prejuízo e dívidas."
      />
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {calculators.map((calculator) => (
          <li key={calculator.href}>
            <Link
              href={calculator.href}
              className="group flex min-h-16 items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
            >
              <span className="min-w-0 space-y-1">
                <span className="block text-sm font-medium text-foreground">{calculator.title}</span>
                <span className="block text-sm leading-6 text-muted-foreground">{calculator.description}</span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-5 text-muted-foreground">
        As calculadoras fazem simulações matemáticas com os dados informados. Não é recomendação de investimento.
      </p>
    </div>
  )
}
