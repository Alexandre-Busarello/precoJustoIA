import { Metadata } from "next"
import Link from "next/link"
import { Breadcrumbs } from "@/components/landing/breadcrumbs"
import { UPDATE_FREQUENCY_LABEL } from "@/lib/site-constants"
import { ContactForm } from "./contact-form"

export const metadata: Metadata = {
  title: "Contato e suporte",
  description:
    "Fale com o Preço Justo AI: dúvidas, suporte técnico, dúvidas sobre cálculos, pagamento ou parcerias. Respondemos por e-mail em dias úteis.",
  keywords: "contato preço justo ai, suporte, atendimento, dúvidas análise fundamentalista",
  alternates: {
    canonical: "/contato",
  },
}

const FAQ = [
  {
    question: "Como cancelo minha assinatura?",
    answer:
      "Pelo seu perfil, a qualquer momento. O cancelamento vale na hora e o acesso continua até o fim do período pago.",
  },
  {
    question: "Com que frequência os dados são atualizados?",
    answer: `${UPDATE_FREQUENCY_LABEL}. Demonstrações financeiras entram assim que são publicadas na CVM.`,
  },
  {
    question: "Funciona no celular?",
    answer: "Sim. O site funciona no navegador do celular e do tablet, sem aplicativo.",
  },
  {
    question: "Vocês oferecem consultoria financeira?",
    answer:
      "Não. O Preço Justo AI é uma ferramenta de análise com modelos quantitativos sobre dados públicos. Não é recomendação de investimento.",
  },
  {
    question: "Como funciona o período de teste?",
    answer: "Toda conta nova inclui 1 dia de Premium grátis, sem cartão. Depois, os recursos gratuitos continuam disponíveis.",
  },
]

export default function ContatoPage() {
  return (
    <div className="bg-background">
      <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <Breadcrumbs items={[{ label: "Contato" }]} />
        <header className="mb-8 max-w-[68ch] space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Contato</h1>
          <p className="text-base text-muted-foreground">
            Dúvidas, problemas técnicos, perguntas sobre um cálculo ou sugestões. Respondemos por e-mail em dias úteis.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-12">
          <section aria-labelledby="canais" className="space-y-6">
            <h2 id="canais" className="text-lg font-semibold tracking-tight text-foreground">
              Canais
            </h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Geral</dt>
                <dd>
                  <a href="mailto:contato@precojusto.ai" className="inline-flex min-h-11 items-center text-base text-brand underline-offset-4 hover:underline md:min-h-0">
                    contato@precojusto.ai
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Suporte técnico</dt>
                <dd>
                  <a href="mailto:suporte@precojusto.ai" className="inline-flex min-h-11 items-center text-base text-brand underline-offset-4 hover:underline md:min-h-0">
                    suporte@precojusto.ai
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Assinantes Premium</dt>
                <dd className="text-base text-foreground">
                  Abra um chamado em{" "}
                  <Link href="/suporte" className="text-brand underline-offset-4 hover:underline">
                    Suporte
                  </Link>{" "}
                  e acompanhe a resposta pelo site.
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Horário</dt>
                <dd className="text-base text-foreground">Segunda a sexta, das 9h às 18h (horário de Brasília)</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Localização</dt>
                <dd className="text-base text-foreground">Blumenau, SC</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="mensagem" className="rounded-lg border border-border bg-card p-4 sm:p-5">
            <h2 id="mensagem" className="mb-4 text-lg font-semibold tracking-tight text-foreground">
              Escreva sua mensagem
            </h2>
            <ContactForm />
          </section>
        </div>

        <section aria-labelledby="perguntas" className="mt-12 max-w-[68ch]">
          <h2 id="perguntas" className="text-lg font-semibold tracking-tight text-foreground">
            Perguntas frequentes
          </h2>
          <dl className="mt-3 divide-y divide-border border-y border-border">
            {FAQ.map((item) => (
              <div key={item.question} className="py-4">
                <dt className="text-base font-medium text-foreground">{item.question}</dt>
                <dd className="mt-1 text-sm leading-6 text-muted-foreground">{item.answer}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            Dúvidas sobre planos e cobrança estão em{" "}
            <Link href="/planos" className="text-brand underline-offset-4 hover:underline">
              Planos
            </Link>
            ; sobre os cálculos, na{" "}
            <Link href="/metodologia" className="text-brand underline-offset-4 hover:underline">
              Metodologia
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
