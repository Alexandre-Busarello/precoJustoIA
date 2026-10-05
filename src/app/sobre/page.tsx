import { Metadata } from "next"
import Link from "next/link"
import { Breadcrumbs } from "@/components/landing/breadcrumbs"
import { COVERED_COMPANIES_LABEL, DATA_SOURCES_LABEL, LEGAL_NOTICE, UPDATE_FREQUENCY_LABEL } from "@/lib/site-constants"

export const metadata: Metadata = {
  title: "Sobre",
  description:
    "Quem faz o Preço Justo AI, por que ele existe, de onde vêm os dados e como falar com a gente. Ferramenta de análise fundamentalista de ações da B3.",
  keywords: "sobre preço justo ai, análise fundamentalista, fontes de dados, B3, CVM",
  alternates: {
    canonical: "/sobre",
  },
}

export default function SobrePage() {
  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-6 sm:py-10">
        <article className="mx-auto max-w-[68ch]">
          <Breadcrumbs items={[{ label: "Sobre" }]} />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Sobre o Preço Justo AI</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Uma ferramenta para estudar ações da B3 com modelos de valuation conhecidos, mostrando cada fórmula e cada premissa.
          </p>

          <div className="mt-8 space-y-8 text-base leading-7 text-foreground">
            <section aria-labelledby="quem" className="space-y-3">
              <h2 id="quem" className="text-lg font-semibold tracking-tight">
                Quem faz
              </h2>
              <p>
                O Preço Justo AI é um projeto independente, feito em Blumenau (SC) por quem investe como pessoa física e queria
                uma forma consistente de aplicar análise fundamentalista sem planilhas espalhadas.
              </p>
            </section>

            <section aria-labelledby="por-que" className="space-y-3">
              <h2 id="por-que" className="text-lg font-semibold tracking-tight">
                Por que existe
              </h2>
              <p>
                Aplicar Graham, Bazin, Gordon ou um fluxo de caixa descontado à mão em centenas de empresas é lento e sujeito a
                erro. Aqui os modelos rodam sobre os mesmos dados para {COVERED_COMPANIES_LABEL}, lado a lado, com as limitações
                de cada um à vista. A ideia é ajudar você a decidir onde estudar o próximo aporte, não decidir por você.
              </p>
              <p>
                Os números vêm de regras determinísticas. A inteligência artificial só resume os resultados dos modelos e nunca
                calcula preço justo por conta própria.
              </p>
            </section>

            <section aria-labelledby="dados" className="space-y-3">
              <h2 id="dados" className="text-lg font-semibold tracking-tight">
                De onde vêm os dados
              </h2>
              <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
                <li>{DATA_SOURCES_LABEL}: cotações, demonstrações financeiras e proventos.</li>
                <li>Banco Central (SGS): Selic, CDI e IPCA usados nas taxas de desconto.</li>
                <li>{UPDATE_FREQUENCY_LABEL}.</li>
              </ul>
              <p>
                As fórmulas, os critérios e as premissas em uso estão na{" "}
                <Link href="/metodologia" className="text-brand underline-offset-4 hover:underline">
                  metodologia
                </Link>
                .
              </p>
            </section>

            <section aria-labelledby="contato" className="space-y-3">
              <h2 id="contato" className="text-lg font-semibold tracking-tight">
                Contato
              </h2>
              <p>
                Escreva para{" "}
                <a href="mailto:contato@precojusto.ai" className="text-brand underline-offset-4 hover:underline">
                  contato@precojusto.ai
                </a>{" "}
                ou use a página de{" "}
                <Link href="/contato" className="text-brand underline-offset-4 hover:underline">
                  contato
                </Link>
                . Encontrou um número estranho? Conte qual ativo e qual modelo, e a gente verifica.
              </p>
            </section>

            <p className="rounded-lg border border-border bg-surface p-4 text-sm leading-6 text-muted-foreground">{LEGAL_NOTICE}</p>
          </div>
        </article>
      </div>
    </div>
  )
}
