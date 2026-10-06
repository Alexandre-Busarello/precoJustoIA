import Link from "next/link"
import { Metadata } from "next"
import { LandingPricingSection, type CurrentPlanInfo } from "@/components/landing-pricing-section"
import { FAQSection } from "@/components/landing/faq-section"
import { getCurrentUser } from "@/lib/user-service"
import { isTrialEnabled } from "@/lib/trial-service"
import { isProdPhase } from "@/lib/alfa-service"
import { formatPct } from "@/lib/format"
import { COVERED_ASSETS_LABEL, UPDATE_FREQUENCY_LABEL, VALUATION_MODELS_SHORT_LABEL } from "@/lib/site-constants"
import {
  calculateDiscount,
  FALLBACK_ANNUAL_PRICE_DECIMAL,
  FALLBACK_ANNUAL_PRICE_FORMATTED,
  FALLBACK_ANNUAL_PRICE_IN_CENTS,
  FALLBACK_MONTHLY_PRICE_DECIMAL,
  FALLBACK_MONTHLY_PRICE_FORMATTED,
  FALLBACK_MONTHLY_PRICE_IN_CENTS,
} from "@/lib/price-utils"
import { PlanComparison } from "./plan-comparison"

/** Desconto real do anual sobre 12 mensalidades: 1 − anual / (12 × mensal). */
const ANNUAL_DISCOUNT_LABEL = formatPct(calculateDiscount(FALLBACK_MONTHLY_PRICE_IN_CENTS, FALLBACK_ANNUAL_PRICE_IN_CENTS))

export const metadata: Metadata = {
  title: "Planos e preços",
  description: `Plano gratuito com a Fórmula de Graham e Premium com os ${VALUATION_MODELS_SHORT_LABEL} e IA a partir de ${FALLBACK_MONTHLY_PRICE_FORMATTED}/mês. No anual (${FALLBACK_ANNUAL_PRICE_FORMATTED}) você paga ${ANNUAL_DISCOUNT_LABEL} menos que 12 mensalidades.`,
  keywords:
    "planos análise fundamentalista, preço análise de ações, análise fundamentalista gratuita, plano premium ações, assinatura valuation ações B3",
  openGraph: {
    title: "Planos e preços do Preço Justo AI",
    description: `Grátis com a Fórmula de Graham ou Premium com ${VALUATION_MODELS_SHORT_LABEL} e IA a partir de ${FALLBACK_MONTHLY_PRICE_FORMATTED}/mês.`,
    type: "website",
    url: "https://precojusto.ai/planos",
    siteName: "Preço Justo AI",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Planos e preços do Preço Justo AI",
    description: `Grátis com a Fórmula de Graham ou Premium com ${VALUATION_MODELS_SHORT_LABEL} e IA a partir de ${FALLBACK_MONTHLY_PRICE_FORMATTED}/mês.`,
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
    canonical: "https://precojusto.ai/planos",
  },
}

const FAQS = [
  {
    question: "Posso cancelar quando quiser?",
    answer:
      "Sim. Não há fidelidade nem taxa de cancelamento. Você continua com acesso Premium até o fim do período já pago.",
  },
  {
    question: "Quais formas de pagamento são aceitas?",
    answer:
      "O plano mensal é pago por PIX. O anual pode ser pago por PIX ou cartão de crédito. No PIX, os dois planos têm 15% de desconto e a ativação é imediata após a confirmação.",
  },
  {
    question: "Qual a diferença entre o mensal e o anual?",
    answer: `Os recursos são os mesmos. No anual você paga ${FALLBACK_ANNUAL_PRICE_FORMATTED} de uma vez, ${ANNUAL_DISCOUNT_LABEL} a menos que 12 mensalidades de ${FALLBACK_MONTHLY_PRICE_FORMATTED}, e ganha acesso antecipado a novos recursos e suporte VIP.`,
  },
  {
    question: "Existe período de teste?",
    answer:
      "Quando o teste está disponível, a conta nova recebe 1 dia de Premium, sem cartão de crédito. Depois disso a conta segue no plano gratuito até você assinar.",
  },
  {
    question: "Posso pedir reembolso?",
    answer:
      "Sim. Você pode pedir o reembolso em até 7 dias após o pagamento, pelo direito de arrependimento previsto no Código de Defesa do Consumidor. Fale com a gente pela página de contato.",
  },
  {
    question: "Quais empresas são analisadas?",
    answer: `Todos os planos cobrem ${COVERED_ASSETS_LABEL} da B3, entre ações, BDRs, FIIs e ETFs. ${UPDATE_FREQUENCY_LABEL}, e as demonstrações financeiras entram na base depois que as empresas publicam os resultados.`,
  },
]

async function getViewerPlan(): Promise<{ isLoggedIn: boolean; currentPlan: CurrentPlanInfo | null }> {
  const user = await getCurrentUser()
  if (!user) return { isLoggedIn: false, currentPlan: null }
  if (user.subscriptionTier !== "PREMIUM") return { isLoggedIn: true, currentPlan: null }
  const expiresAt = user.premiumExpiresAt ? new Date(user.premiumExpiresAt) : null
  if (expiresAt && expiresAt <= new Date()) return { isLoggedIn: true, currentPlan: null }
  return { isLoggedIn: true, currentPlan: { expiresAt: expiresAt ? expiresAt.toISOString() : null } }
}

export default async function PlanosPage() {
  const { isLoggedIn, currentPlan } = await getViewerPlan()
  // O teste de 1 dia é só para contas novas; quem já está logado não vê essa oferta.
  const trialAvailable = !isLoggedIn && isTrialEnabled() && isProdPhase()
  const subtitle = currentPlan
    ? "Você já é assinante Premium. Veja abaixo o que está incluído."
    : isLoggedIn
      ? "Você está no plano gratuito. Assine o Premium para liberar todos os modelos, a IA e o uso ilimitado."
      : trialAvailable
        ? "Comece grátis. Contas novas testam o Premium por 1 dia, sem cartão de crédito."
        : "Comece grátis e assine o Premium quando precisar de todos os modelos e da IA."

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Preço Justo AI Premium",
    description: `Valuation de ações da B3 com ${VALUATION_MODELS_SHORT_LABEL}, score de FIIs e ETFs, relatórios de IA, rankings, comparador e backtest. Plano gratuito com a Fórmula de Graham.`,
    brand: { "@type": "Brand", name: "Preço Justo AI" },
    offers: [
      { "@type": "Offer", name: "Grátis", price: "0", priceCurrency: "BRL", availability: "https://schema.org/InStock" },
      {
        "@type": "Offer",
        name: "Premium mensal",
        price: FALLBACK_MONTHLY_PRICE_DECIMAL,
        priceCurrency: "BRL",
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "Premium anual",
        price: FALLBACK_ANNUAL_PRICE_DECIMAL,
        priceCurrency: "BRL",
        availability: "https://schema.org/InStock",
      },
    ],
  }

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Planos</h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          {subtitle}
        </p>
      </div>

      <LandingPricingSection
        showHeader={false}
        currentPlan={currentPlan}
        isLoggedIn={isLoggedIn}
        className="pt-8 pb-16 sm:pt-8 sm:pb-20"
      />

      <section aria-labelledby="comparacao" className="border-t border-border bg-background py-16 sm:py-20">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 id="comparacao" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Compare os planos
          </h2>
          <p className="mt-2 mb-8 text-base text-muted-foreground">Limites do plano gratuito renovam todo mês.</p>
          <PlanComparison />
        </div>
      </section>

      <FAQSection className="border-t border-border" title="Perguntas sobre cobrança" faqs={FAQS} />

      <section className="border-t border-border bg-surface py-12">
        <p className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Outra dúvida?{" "}
          <Link href="/contato" className="font-medium text-brand underline-offset-4 hover:underline">
            Fale com a gente
          </Link>
        </p>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}
