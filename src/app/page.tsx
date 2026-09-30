import Image from "next/image"
import Link from "next/link"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import CompanySearch from "@/components/company-search"
import { LandingHero } from "@/components/landing/landing-hero"
import { CTASection } from "@/components/landing/cta-section"
import { FAQSection } from "@/components/landing/faq-section"
import { FloatingCTA } from "@/components/landing/floating-cta"
import { LandingPricingSection } from "@/components/landing-pricing-section"
import { COVERED_COMPANIES_LABEL, DATA_SOURCES_LABEL } from "@/lib/site-constants"
import { FALLBACK_MONTHLY_PRICE_FORMATTED } from "@/lib/price-utils"

const HERO_ID = "home-hero"
const FINAL_CTA_ID = "home-final-cta"

export const metadata: Metadata = {
  title: "Preço justo e valuation de ações da B3",
  description: `Preço justo de ${COVERED_COMPANIES_LABEL} da B3 calculado por 8 modelos de valuation (Graham, Barsi, Fórmula Mágica, FCD, Gordon e outros), com rankings, comparador e backtest. Comece grátis.`,
  keywords:
    "preço justo ações, valuation ações B3, análise fundamentalista, fórmula de Graham, método Barsi, fórmula mágica Greenblatt, fluxo de caixa descontado, ranking de ações, comparador de ações, backtest de carteira",
  publisher: "Preço Justo AI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Preço Justo AI: preço justo e valuation de ações da B3",
    description: "O preço justo de cada ação da B3, calculado por 8 modelos de valuation. Metodologia pública e plano gratuito.",
    type: "website",
    url: "https://precojusto.ai",
    siteName: "Preço Justo AI",
    locale: "pt_BR",
    images: [
      {
        url: "https://precojusto.ai/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Preço Justo AI: valuation de ações da B3",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Preço Justo AI: preço justo e valuation de ações da B3",
    description: "O preço justo de cada ação da B3, calculado por 8 modelos de valuation.",
    creator: "@precojustoai",
    images: ["https://precojusto.ai/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://precojusto.ai",
  },
}

const EXAMPLE_TICKERS = ["PETR4", "VALE3", "ITUB4", "WEGE3"]

const PRODUCT_BLOCKS = [
  {
    eyebrow: "Página de ativo",
    title: "O preço justo de cada modelo, lado a lado",
    description:
      "Cada ação mostra o preço justo estimado por modelo, a margem de segurança e um score de qualidade, com 7 anos de demonstrações financeiras para conferir as premissas.",
    link: { href: "/acao/petr4", label: "Ver a análise da PETR4" },
    image: { src: "/images/product/acao-petr4-valuation.webp", width: 855, height: 490, alt: "Tabela de valuation da PETR4 com o preço justo e a margem de segurança de cada modelo" },
  },
  {
    eyebrow: "Rankings",
    title: "Ranqueie ações pelos modelos que você conhece",
    description:
      "Escolha um modelo, ajuste os filtros e veja quais empresas estão abaixo do preço justo estimado, com os indicadores de cada uma lado a lado.",
    link: { href: "/ranking", label: "Abrir rankings" },
    image: { src: "/images/product/ranking.webp", width: 1040, height: 570, alt: "Resultado de um ranking pela Fórmula de Graham com preço, margem e indicadores" },
  },
  {
    eyebrow: "Backtest",
    title: "Teste uma carteira com dados históricos",
    description:
      "Monte uma carteira, defina aportes e rebalanceamento e compare o resultado com o Ibovespa e o CDI. Rentabilidade passada não garante resultados futuros.",
    link: { href: "/backtest", label: "Criar um backtest" },
    image: { src: "/images/product/backtest.webp", width: 1280, height: 800, alt: "Resultado de backtest de carteira comparado ao CDI e ao Ibovespa" },
  },
]

const MODELS = [
  { name: "Fórmula de Graham", measures: "Valor justo pelo lucro e pelo patrimônio por ação", plan: "Grátis" },
  { name: "Fluxo de caixa descontado", measures: "Valor presente do caixa que a empresa deve gerar", plan: "Premium" },
  { name: "Gordon", measures: "Valor pelos dividendos esperados e seu crescimento", plan: "Premium" },
  { name: "Método Barsi", measures: "Preço-teto pelo dividendo mínimo desejado", plan: "Premium" },
  { name: "Fórmula Mágica", measures: "Combina retorno sobre o capital e rendimento do lucro", plan: "Premium" },
  { name: "P/L baixo com qualidade", measures: "Múltiplo baixo com rentabilidade e margens sólidas", plan: "Premium" },
  { name: "Anti-armadilha de dividendos", measures: "Dividend yield alto com filtros de sustentabilidade", plan: "Premium" },
  { name: "Fundamentalista 3+1", measures: "Três indicadores essenciais adaptados ao perfil da empresa", plan: "Premium" },
]

const FAQS = [
  {
    question: "Como o preço justo é calculado?",
    answer:
      "Aplicamos 8 modelos de valuation (Graham, fluxo de caixa descontado, Gordon, Barsi, Fórmula Mágica e outros) aos dados financeiros de cada empresa. Cada modelo gera uma estimativa própria, e a metodologia com fórmulas e premissas é pública.",
  },
  {
    question: "De onde vêm os dados?",
    answer:
      "Cotações e demonstrações financeiras vêm da B3 e da CVM, consolidadas pela BRAPI. As demonstrações são atualizadas após cada divulgação trimestral.",
  },
  {
    question: "Com que frequência os dados são atualizados?",
    answer:
      "As cotações são atualizadas 3 vezes ao dia (9h, 13h e 20h). Os dados fundamentalistas são atualizados depois que as empresas divulgam seus resultados.",
  },
  {
    question: "Preciso pagar para usar?",
    answer: `Não. O plano gratuito inclui a Fórmula de Graham em todas as ações e usos mensais das ferramentas. O Premium custa a partir de ${FALLBACK_MONTHLY_PRICE_FORMATTED}/mês, sem fidelidade.`,
  },
  {
    question: "O que a IA faz na plataforma?",
    answer:
      "A IA (Google Gemini) resume o que os modelos indicam e o contexto da empresa em texto. É uma estimativa gerada por IA, que complementa os números e não substitui a sua análise.",
  },
  {
    question: "Posso usar o preço justo como indicação de investimento?",
    answer:
      "O preço justo é uma estimativa de modelos quantitativos com dados públicos e não é recomendação de investimento. Faça sua própria análise; rentabilidade passada não garante resultados futuros.",
  },
]

function HeroSearch() {
  return (
    <div className="max-w-lg space-y-3">
      <CompanySearch
        placeholder="Digite um ticker, ex.: PETR4"
        className="max-w-lg [&_input]:h-12 [&_input]:text-base md:[&_input]:h-12 md:[&_input]:text-base"
      />
      <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
        <span>Exemplos:</span>
        {EXAMPLE_TICKERS.map((ticker) => (
          <Link
            key={ticker}
            href={`/acao/${ticker.toLowerCase()}`}
            className="inline-flex min-h-11 items-center px-1.5 font-medium text-foreground underline-offset-4 hover:text-brand hover:underline md:min-h-8"
          >
            {ticker}
          </Link>
        ))}
      </p>
      <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
        <Link href="/register" className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline md:min-h-8">
          Criar conta grátis
        </Link>
        <span aria-hidden="true">·</span>
        <span>sem cartão de crédito</span>
      </p>
    </div>
  )
}

interface ProductShotProps {
  src: string
  alt: string
  width: number
  height: number
  priority?: boolean
}

/** Screenshot real do produto (capturado do ambiente local, tema claro), com borda fina. */
function ProductShot({ src, alt, width, height, priority = false }: ProductShotProps) {
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-card">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="h-auto w-full"
      />
    </figure>
  )
}

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session) {
    redirect("/dashboard")
  }

  // O SoftwareApplication (com as ofertas) já vem do layout via <StructuredData type="product" />.
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ]

  return (
    <div>
      <FloatingCTA text="Criar conta grátis" href="/register" heroId={HERO_ID} hideWhenVisibleId={FINAL_CTA_ID} />

      <LandingHero
        id={HERO_ID}
        headline="O preço justo de cada ação da B3, calculado por 8 modelos de valuation."
        subheadline={`Preço, preço justo, margem de segurança e score de ${COVERED_COMPANIES_LABEL}, com a metodologia aberta.`}
        actions={<HeroSearch />}
        showQuickAccess={false}
        media={
          <ProductShot
            priority
            src="/images/product/acao-petr4.webp"
            width={1280}
            height={800}
            alt="Página de ação da PETR4 no Preço Justo AI com preço, preço justo e score"
          />
        }
      />

      <section aria-label="Sobre os dados" className="border-b border-border bg-surface">
        <p className="container mx-auto flex flex-wrap items-center gap-x-2 px-4 py-2 text-sm text-muted-foreground sm:px-6 md:py-4 lg:px-8">
          <Link href="/como-funciona" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-foreground md:min-h-0 md:no-underline md:hover:underline">
            {DATA_SOURCES_LABEL}
          </Link>
          <span aria-hidden="true">·</span>
          <span>Cotações atualizadas 3 vezes ao dia</span>
          <span aria-hidden="true">·</span>
          <Link href="/metodologia" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-foreground md:min-h-0 md:no-underline md:hover:underline">
            Metodologia pública
          </Link>
        </p>
      </section>

      <section aria-label="O produto" className="bg-background py-16 sm:py-20">
        <div className="container mx-auto space-y-16 px-4 sm:px-6 lg:space-y-20 lg:px-8">
          {PRODUCT_BLOCKS.map((block, index) => (
            <div key={block.eyebrow} className="grid items-center gap-6 lg:grid-cols-2 lg:gap-12">
              <div className={index % 2 === 1 ? "lg:order-2" : undefined}>
                <p className="text-sm font-medium text-brand">{block.eyebrow}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground text-balance">{block.title}</h2>
                <p className="mt-3 max-w-[60ch] text-base leading-7 text-muted-foreground">{block.description}</p>
                <Link
                  href={block.link.href}
                  className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline md:min-h-8"
                >
                  {block.link.label}
                </Link>
              </div>
              <ProductShot {...block.image} />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="modelos" className="border-t border-border bg-background py-16 sm:py-20">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div>
              <h2 id="modelos" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Os 8 modelos de valuation
              </h2>
              <p className="mt-2 text-base text-muted-foreground">Cada um responde a uma pergunta diferente sobre o valor da empresa.</p>
            </div>
            <Link href="/metodologia" className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline md:min-h-8">
              Ver metodologia
            </Link>
          </div>

          <div className="mt-8 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs font-medium text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium sm:px-4">Modelo</th>
                  <th scope="col" className="hidden px-3 py-2.5 text-left font-medium sm:table-cell sm:px-4">O que mede</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium sm:px-4">Plano</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MODELS.map((model) => (
                  <tr key={model.name}>
                    <th scope="row" className="px-3 py-3 text-left font-medium text-foreground sm:px-4">
                      {model.name}
                      <span className="mt-0.5 block font-normal text-muted-foreground sm:hidden">{model.measures}</span>
                    </th>
                    <td className="hidden px-3 py-3 text-muted-foreground sm:table-cell sm:px-4">{model.measures}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground sm:px-4">{model.plan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            O Premium inclui também uma síntese dos modelos gerada por IA. Os valores são estimativas de modelo; não é recomendação de investimento.
          </p>
        </div>
      </section>

      <LandingPricingSection className="border-t border-border" />

      <FAQSection className="border-t border-border" faqs={FAQS} />

      <CTASection
        id={FINAL_CTA_ID}
        title="Veja o preço justo da sua próxima ação"
        description="Crie uma conta grátis e acompanhe as empresas que você analisa."
        primaryCTA={{ text: "Criar conta grátis", href: "/register" }}
        secondaryCTA={{ text: "Ver planos", href: "/planos" }}
      />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}
