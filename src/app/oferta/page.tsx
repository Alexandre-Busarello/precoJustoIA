import { Metadata } from "next"
import { Suspense } from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { SlimFooter } from "@/components/slim-footer"
import { DynamicCTASection } from "@/components/dynamic-cta-section"
import {
  HeroPriceLink,
  HeroCTAButton,
  IntermediateCTAButton,
  OfertaCTAButton,
  OfertaPriceLink,
} from "@/components/oferta-checkout-buttons"
import { OFERTA_FALLBACK_CHECKOUT_URL, OFERTA_MONTHLY_PRICE_LABEL } from "@/components/landing/oferta-config"

export const metadata: Metadata = {
  title: `Radar de ações com IA por ${OFERTA_MONTHLY_PRICE_LABEL}/mês`,
  description: `Radar que acompanha suas ações: score de fundamentos, análise técnica e sentimento de mercado em uma tela. Acesso anual promocional por ${OFERTA_MONTHLY_PRICE_LABEL}/mês.`,
  keywords: "radar de ações, monitoramento de ações com IA, score de fundamentos, análise técnica, sentimento de mercado, radar ações B3",
  openGraph: {
    title: `Radar de ações com IA por ${OFERTA_MONTHLY_PRICE_LABEL}/mês`,
    description: `Escolha os ativos, salve o radar e acompanhe fundamentos, técnica e sentimento em uma tela. Acesso anual promocional por ${OFERTA_MONTHLY_PRICE_LABEL}/mês.`,
    type: "website",
    url: "https://precojusto.ai/oferta",
  },
  robots: {
    index: true,
    follow: true,
  },
}

const BENEFITS = [
  {
    feature: "radar-inteligente",
    title: "Radar de ações",
    description: "Escolha os ativos que quer acompanhar e salve o radar. Veja de relance se cada empresa segue saudável ou pede atenção.",
  },
  {
    feature: "tres-dados-vitais",
    title: "Três leituras em uma tela",
    description: "Score de fundamentos, análise técnica e sentimento de mercado (o que está sendo dito sobre a empresa na internet), lado a lado.",
  },
  {
    feature: "5-minutos",
    title: "Poucos minutos por mês",
    description: "Em vez de horas lendo balanços, confira o radar e aprofunde só onde algo mudou.",
  },
  {
    feature: "analise-tecnica",
    title: "Análise técnica com IA",
    description: "A IA descreve tendências, suportes e resistências do gráfico. É uma estimativa gerada por IA e não é recomendação de investimento.",
  },
  {
    feature: "relatorios-ia",
    title: "Relatórios da IA no seu e-mail",
    description: "Receba um aviso quando algo mudar nos fundamentos de uma empresa que você acompanha.",
  },
  {
    feature: "rankings",
    title: "Rankings por modelo",
    description: "Ranqueie ações por modelos de valuation consagrados ou pela síntese com IA.",
  },
  {
    feature: "screening",
    title: "Screening de ações",
    description: "Filtre empresas pelos indicadores da plataforma ou descreva o que procura e deixe a IA montar os filtros.",
  },
  {
    feature: "analise-b3",
    title: "Ações e BDRs da B3",
    description: "Mais de 65 indicadores fundamentalistas por empresa, com histórico.",
  },
  {
    feature: "comparador",
    title: "Comparador de empresas",
    description: "Compare empresas lado a lado, indicador por indicador.",
  },
  {
    feature: "dividendos",
    title: "Radar de dividendos",
    description: "Calendário de proventos e projeções estatísticas para os próximos meses.",
  },
  {
    feature: "analise-setorial",
    title: "Análise setorial",
    description: "Compare setores da B3 e veja como cada empresa se posiciona no seu setor.",
  },
  {
    feature: "calculadora-renda",
    title: "Calculadora de renda passiva",
    description: "Simule quanto investir para chegar à renda mensal em dividendos que você quer.",
  },
]

export default function OfertaPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <Badge variant="warning">Condição por tempo limitado</Badge>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground text-balance sm:text-5xl">
              Um radar que acompanha as ações da sua carteira
            </h1>

            <p className="mt-4 max-w-[60ch] text-base leading-7 text-muted-foreground sm:text-lg">
              Escolha os ativos, salve o radar e veja em uma tela o score de fundamentos, a análise técnica e o sentimento de
              mercado. Poucos minutos por mês em vez de horas lendo balanços.
            </p>

            <div className="mt-8">
              <Suspense fallback={<OfertaPriceLink href={OFERTA_FALLBACK_CHECKOUT_URL} />}>
                <HeroPriceLink />
              </Suspense>
            </div>

            <div className="mt-6">
              <Suspense fallback={<OfertaCTAButton href={OFERTA_FALLBACK_CHECKOUT_URL} label="Garantir o acesso anual" />}>
                <HeroCTAButton />
              </Suspense>
              <p className="mt-3 text-sm text-muted-foreground">
                Pagamento seguro · Acesso imediato · Reembolso em até 7 dias · Funciona no celular
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">O que está incluído</h2>
          <p className="mt-2 max-w-[60ch] text-base text-muted-foreground">
            O radar é o centro do plano. Junto com ele, você tem acesso a todas as ferramentas da plataforma.
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <li key={benefit.feature}>
                <a
                  href={`/oferta?feature=${benefit.feature}#checkout`}
                  className="block h-full rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                  <h3 className="text-base font-semibold text-foreground">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{benefit.description}</p>
                </a>
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <Suspense
              fallback={
                <OfertaCTAButton
                  href={OFERTA_FALLBACK_CHECKOUT_URL}
                  label={`Garantir o acesso anual por ${OFERTA_MONTHLY_PRICE_LABEL}/mês`}
                />
              }
            >
              <IntermediateCTAButton />
            </Suspense>
            <p className="mt-3 text-sm text-muted-foreground">Desconto maior à vista · Sem fidelidade</p>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 [&>*]:max-w-3xl">
          <figure>
            <blockquote className="text-lg leading-8 text-foreground sm:text-xl">
              &ldquo;A plataforma é excelente. Sempre que tenho dúvida ou quando minha carteira sofre grandes quedas, uso o site
              para não entrar em pânico. Ele me dá segurança para não vender o ativo caso a empresa não tenha perdido seus
              fundamentos e continue com um bom score.&rdquo;
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <Avatar className="size-12 border border-border">
                <AvatarImage src="/deni-ferreira.png" alt="Deni Ferreira" className="object-cover" />
                <AvatarFallback className="bg-muted text-sm font-medium text-muted-foreground">DF</AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <p className="font-medium text-foreground">Deni Ferreira</p>
                <p className="text-muted-foreground">Assinante Premium</p>
              </div>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="border-t border-border bg-background py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 [&>*]:max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Reembolso em até 7 dias</h2>
          <p className="mt-3 max-w-[60ch] text-base leading-7 text-muted-foreground">
            Se a plataforma não for para você, peça o reembolso integral em até 7 dias após o pagamento. O processo é simples e não
            pedimos justificativa.
          </p>
        </div>
      </section>

      <Suspense
        fallback={
          <section id="checkout" className="scroll-mt-20 border-t border-border bg-surface py-16 sm:py-20">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 [&>*]:max-w-3xl">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Garanta a condição enquanto ela está ativa
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Acesso anual promocional por {OFERTA_MONTHLY_PRICE_LABEL} por mês no cartão, ou com desconto maior à vista.
              </p>
            </div>
          </section>
        }
      >
        <DynamicCTASection />
      </Suspense>

      <SlimFooter />
    </div>
  )
}
