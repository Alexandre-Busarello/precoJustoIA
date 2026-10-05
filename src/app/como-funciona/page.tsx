import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Breadcrumbs } from "@/components/landing/breadcrumbs"
import { Button } from "@/components/ui/button"
import { LEGAL_NOTICE } from "@/lib/site-constants"

export const metadata: Metadata = {
  title: "Como funciona",
  description:
    "Como usar o Preço Justo AI em 3 passos: encontre empresas por modelo de valuation, veja o preço justo estimado por cada modelo e acompanhe as empresas no radar para decidir o próximo aporte.",
  keywords: "como funciona preço justo ai, modelos de valuation, preço justo, ranking de ações, carteira de ações",
  alternates: {
    canonical: "/como-funciona",
  },
}

const STEPS = [
  {
    title: "Encontre empresas por modelo",
    text: "Escolha um modelo, como Graham, Bazin ou fluxo de caixa descontado, e veja as empresas que passam nos critérios dele, ordenadas. Filtros de liquidez e setor tiram da lista o que o modelo não consegue avaliar bem.",
    image: "/images/how-it-works/1-ranking.webp",
    alt: "Tela de rankings com a lista de empresas ordenadas por um modelo de valuation",
    link: { href: "/ranking", label: "Abrir rankings" },
  },
  {
    title: "Veja o preço justo de cada modelo",
    text: "Na página da empresa, preço atual, preço justo estimado, margem de segurança e score aparecem no topo. Abaixo, cada modelo mostra o próprio resultado, os critérios atendidos e quando não se aplica.",
    image: "/images/how-it-works/2-empresa.webp",
    alt: "Página de uma empresa com preço atual, preço justo estimado, margem de segurança e score",
    link: { href: "/acao/petr4", label: "Ver um exemplo" },
  },
  {
    title: "Acompanhe e escolha onde estudar o próximo aporte",
    text: "Salve no radar as empresas que você acompanha e veja, lado a lado, score, potencial, posição técnica e sentimento. Junto com a carteira, fica mais fácil escolher onde estudar o próximo aporte.",
    image: "/images/how-it-works/3-radar.webp",
    alt: "Radar com tickers salvos e colunas de score, estratégias, potencial, técnica e sentimento",
    link: { href: "/radar", label: "Abrir radar" },
  },
] as const

export default function ComoFuncionaPage() {
  return (
    <div className="bg-background">
      <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <Breadcrumbs items={[{ label: "Como funciona" }]} />
        <header className="max-w-[68ch] space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Como funciona</h1>
          <p className="text-base text-muted-foreground">
            Três passos para sair de uma lista de centenas de empresas para as poucas que valem o seu estudo.
          </p>
        </header>

        <ol className="mt-10 space-y-14">
          {STEPS.map((step, index) => (
            <li key={step.title} className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-center lg:gap-10">
              <div className="space-y-3">
                <p className="text-sm font-medium tabular-nums text-brand">Passo {index + 1}</p>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">{step.title}</h2>
                <p className="text-base leading-7 text-muted-foreground">{step.text}</p>
                <Link href={step.link.href} className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline md:min-h-0">
                  {step.link.label}
                </Link>
              </div>
              <figure className="overflow-hidden rounded-lg border border-border bg-surface">
                <Image
                  src={step.image}
                  alt={step.alt}
                  width={1200}
                  height={750}
                  sizes="(min-width: 1024px) 600px, 100vw"
                  className="h-auto w-full"
                  priority={index === 0}
                />
              </figure>
            </li>
          ))}
        </ol>

        <section className="mt-16 max-w-[68ch] space-y-4 border-t border-border pt-8">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Os cálculos por trás</h2>
          <p className="text-base leading-7 text-muted-foreground">
            Cada número vem de um modelo determinístico sobre dados públicos. Fórmulas, premissas e limitações estão na
            metodologia.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/register">Criar conta grátis</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/metodologia">Ver metodologia</Link>
            </Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{LEGAL_NOTICE}</p>
        </section>
      </div>
    </div>
  )
}
