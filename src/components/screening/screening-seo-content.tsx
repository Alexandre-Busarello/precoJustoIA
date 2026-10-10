import Link from "next/link"
import Script from "next/script"
import { ArrowRight } from "lucide-react"
import { SectionHeader } from "@/components/ui/section-header"
import { FAQSection } from "@/components/landing/faq-section"
import { CTASection } from "@/components/landing/cta-section"
import { SCREENING_PRESETS, getAllPresetSlugs } from "@/lib/screening-presets"

interface Faq {
  question: string
  answer: string
}

const STOCK_FAQS: Faq[] = [
  {
    question: "Como funciona o screening de ações?",
    answer:
      "Você define critérios como P/L máximo, ROE mínimo ou dividend yield e a ferramenta mostra apenas as empresas da B3 e BDRs que atendem a todos os filtros ativos. Os resultados são atualizados automaticamente a cada ajuste.",
  },
  {
    question: "Quantos filtros posso usar ao mesmo tempo?",
    answer:
      "Quantos quiser. Só aparecem empresas que atendem a todos os critérios. Comece com poucos filtros e refine aos poucos para não zerar a lista.",
  },
  {
    question: "O screening é gratuito?",
    answer:
      "Sim. Os filtros de valuation (P/L, P/VP, EV/EBITDA, PSR e potencial de Graham) são gratuitos e mostram até 3 resultados. No Premium você libera todos os filtros, a configuração com IA e a lista completa.",
  },
  {
    question: "Quais indicadores estão disponíveis?",
    answer:
      "P/L, P/VP, EV/EBITDA, PSR, ROE, ROIC, ROA, margem líquida, margem EBITDA, CAGR de lucros e receitas, dividend yield, payout, dívida líquida/PL, dívida líquida/EBITDA, liquidez corrente, valor de mercado, score geral, setor e indústria.",
  },
  {
    question: "Posso filtrar por setor ou indústria?",
    answer:
      "Sim. No Premium você combina setores e indústrias com os demais filtros, além de escolher o tamanho da empresa (small, mid ou large caps).",
  },
  {
    question: "Os dados são atualizados?",
    answer:
      "Sim. Preços e indicadores são atualizados regularmente a partir das cotações da B3 e dos demonstrativos financeiros publicados pelas empresas.",
  },
]

const FII_FAQS: Faq[] = [
  {
    question: "Como funciona o screening de FIIs?",
    answer:
      "Você define dividend yield mínimo, P/VP máximo, liquidez mínima, vacância, quantidade de imóveis, segmento e tipo (tijolo ou papel). Aparecem apenas os fundos que passam em todos os critérios ativos.",
  },
  {
    question: "O screening de FIIs é gratuito?",
    answer:
      "Sim. A busca é gratuita com limite de resultados; no Premium você vê a lista completa, com as métricas do score PJ-FII.",
  },
  {
    question: "Quais métricas de FII posso filtrar?",
    answer:
      "Dividend yield, P/VP, liquidez média diária, quantidade de imóveis, vacância média, segmento (ex.: logística, shoppings, papel) e classificação tijolo ou papel.",
  },
]

const USE_CASES: { title: string; description: string; criteria: string[] }[] = [
  {
    title: "Crescimento",
    description: "Empresas com crescimento consistente de resultados.",
    criteria: ["CAGR de lucros 5 anos acima de 10%", "ROE acima de 15%", "P/L abaixo de 20"],
  },
  {
    title: "Renda com dividendos",
    description: "Pagadoras de dividendos com distribuição compatível com o lucro.",
    criteria: ["Dividend yield acima de 6%", "Payout abaixo de 80%", "Dívida líquida/PL abaixo de 100%"],
  },
  {
    title: "Value investing",
    description: "Empresas negociadas a múltiplos baixos com rentabilidade.",
    criteria: ["P/L abaixo de 15", "P/VP abaixo de 1,5", "ROE acima de 12%"],
  },
  {
    title: "Large caps",
    description: "Empresas grandes, com balanço mais estável.",
    criteria: ["Valor de mercado acima de R$ 10 bi", "Liquidez corrente acima de 1,2", "Margem líquida acima de 5%"],
  },
]

function faqSchema(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  }
}

/** Conteúdo institucional e de SEO exibido para visitantes, sempre depois da ferramenta. */
export function ScreeningSeoContent({ isFiisHub }: { isFiisHub: boolean }) {
  const faqs = isFiisHub ? FII_FAQS : STOCK_FAQS

  return (
    <div className="mt-12 border-t border-border">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader
          title={isFiisHub ? "Como usar o screening de FIIs" : "Como usar o screening de ações"}
          description={
            isFiisHub
              ? "Compare fundos imobiliários com filtros objetivos de renda, valuation e qualidade do portfólio."
              : "Encontre empresas que atendem aos seus critérios sem analisar centenas de balanços manualmente."
          }
        />
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Defina os filtros",
              text: isFiisHub
                ? "Escolha tipo, segmento, dividend yield, P/VP, liquidez e vacância."
                : "Combine critérios de valuation, rentabilidade, crescimento, dividendos e endividamento.",
            },
            {
              title: "Veja os resultados ao vivo",
              text: "A lista é atualizada a cada ajuste, com preço, preço justo estimado e os principais indicadores.",
            },
            {
              title: "Aprofunde a análise",
              text: "Abra a página de cada ativo para ver valuation por modelo, histórico e demonstrativos.",
            },
          ].map((step, index) => (
            <li key={step.title} className="space-y-1">
              <p className="text-sm tabular-nums text-muted-foreground">{index + 1}.</p>
              <h3 className="font-medium text-foreground">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {!isFiisHub && (
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <SectionHeader
              title="Estratégias prontas"
              description="Filtros pré-configurados com critérios conhecidos. Clique para ver os resultados de hoje."
            />
            <ul className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {getAllPresetSlugs().map((slug) => {
                const preset = SCREENING_PRESETS[slug]
                return (
                  <li key={slug}>
                    <Link
                      href={`/screening-acoes/${slug}`}
                      className="group flex h-full flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                    >
                      <span className="font-medium text-foreground group-hover:text-brand">{preset.title}</span>
                      <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{preset.hook}</span>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand">
                        Ver resultados
                        <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}

      {!isFiisHub && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <SectionHeader title="Combinações de filtros comuns" />
            <ul className="mt-6 grid gap-3 md:grid-cols-2">
              {USE_CASES.map((useCase) => (
                <li key={useCase.title} className="rounded-lg border border-border bg-card p-4">
                  <h3 className="font-medium text-foreground">{useCase.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{useCase.description}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground marker:text-muted-foreground">
                    {useCase.criteria.map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <FAQSection
        title={isFiisHub ? "Perguntas frequentes sobre screening de FIIs" : "Perguntas frequentes sobre screening"}
        faqs={faqs}
        className="border-t border-border"
      />

      <CTASection
        title={isFiisHub ? "Compare FIIs com critérios objetivos" : "Monte seu próprio filtro de ações"}
        description="Crie uma conta grátis para salvar seu histórico de buscas e testar o Premium por 1 dia."
        primaryCTA={{ text: "Criar conta grátis", href: "/register" }}
        secondaryCTA={{ text: "Ver rankings", href: "/ranking" }}
      />

      <Script
        id={isFiisHub ? "screening-fiis-faq-schema" : "screening-faq-schema"}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(faqs)) }}
      />
    </div>
  )
}
