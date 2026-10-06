import Link from "next/link"
import { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { COVERED_ASSETS_LABEL } from "@/lib/site-constants"

export const metadata: Metadata = {
  title: "Pagamento cancelado",
  description: "Seu pagamento foi cancelado e nenhuma cobrança foi feita. Você pode tentar novamente quando quiser.",
  robots: {
    index: false,
    follow: false,
  },
}

const HELP_LINKS = [
  { title: "Dúvidas sobre o pagamento", description: "Problemas com PIX ou cartão de crédito.", href: "/contato", label: "Falar com o suporte" },
  { title: "Dúvidas sobre os planos", description: "O que muda entre o gratuito, o mensal e o anual.", href: "/planos", label: "Ver planos" },
]

export default function CancelPage() {
  return (
    <div className="bg-background">
      <div className="container mx-auto max-w-3xl space-y-8 px-4 py-8 sm:py-12">
        <PageHeader
          title="Pagamento cancelado"
          description="Nenhuma cobrança foi feita. Sua conta continua no plano atual."
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/checkout">Tentar novamente</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/ranking">Continuar no plano gratuito</Link>
          </Button>
        </div>

        <section aria-labelledby="ajuda">
          <h2 id="ajuda" className="text-lg font-semibold text-foreground">
            Precisa de ajuda?
          </h2>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {HELP_LINKS.map((item) => (
              <li key={item.href} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-sm text-muted-foreground">
          No plano gratuito você continua com a Fórmula de Graham e os indicadores de {COVERED_ASSETS_LABEL} da B3.
        </p>
      </div>
    </div>
  )
}
