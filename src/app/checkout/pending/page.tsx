import Link from "next/link"
import { Metadata } from "next"
import { Check, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"

export const metadata: Metadata = {
  title: "Pagamento pendente",
  description: "Seu pagamento PIX está sendo confirmado. A conta Premium é ativada automaticamente após a confirmação.",
  robots: {
    index: false,
    follow: false,
  },
}

const STEPS = [
  { label: "PIX enviado pelo seu banco", done: true },
  { label: "Confirmação do pagamento, em geral em até 5 minutos", done: false },
  { label: "Ativação automática da conta Premium", done: false },
]

export default function PendingPage() {
  return (
    <div className="bg-background">
      <div className="container mx-auto max-w-3xl space-y-8 px-4 py-8 sm:py-12">
        <PageHeader
          title="Pagamento pendente"
          description="Estamos aguardando a confirmação do PIX. Assim que ela chegar, a conta Premium é ativada automaticamente."
        />

        <ol className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
          {STEPS.map((step) => (
            <li key={step.label} className="flex items-start gap-3 text-sm">
              {step.done ? (
                <Check className="mt-0.5 size-4 shrink-0 text-foreground" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              )}
              <span className={step.done ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
            </li>
          ))}
        </ol>

        <p className="text-sm text-muted-foreground">
          Você pode continuar navegando enquanto isso. Em horários de pico, a confirmação pode levar alguns minutos a mais.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/dashboard">Verificar minha conta</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/ranking">Ver rankings</Link>
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          O pagamento não foi confirmado depois de 10 minutos?{" "}
          <Link href="/contato" className="font-medium text-brand underline-offset-4 hover:underline">
            Fale com a gente
          </Link>
        </p>
      </div>
    </div>
  )
}
