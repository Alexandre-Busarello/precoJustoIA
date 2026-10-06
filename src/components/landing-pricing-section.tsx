'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTrialAvailable } from '@/hooks/use-trial-available'
import { usePricing } from '@/hooks/use-pricing'
import { getPlanPricing } from '@/components/landing/pricing-math'
import { formatBRL, formatDate, formatPct } from '@/lib/format'
import { FALLBACK_ANNUAL_PRICE_IN_CENTS, FALLBACK_MONTHLY_PRICE_IN_CENTS } from '@/lib/price-utils'
import { cn } from '@/lib/utils'
import { STOCK_VALUATION_MODELS_COUNT } from '@/lib/site-constants'

export interface CurrentPlanInfo {
  /** Data de fim do acesso Premium (ISO) ou null quando não expira. */
  expiresAt: string | null
}

interface LandingPricingSectionProps {
  /** Título e descrição da seção (a /planos usa o próprio H1 e omite). */
  showHeader?: boolean
  /** Assinante Premium logado: troca os botões por "Seu plano atual". */
  currentPlan?: CurrentPlanInfo | null
  /**
   * Há sessão (usuário logado, ainda não Premium). Os botões levam direto ao checkout
   * e o teste de 1 dia, que é só para contas novas, deixa de ser oferecido.
   */
  isLoggedIn?: boolean
  className?: string
}

const FREE_FEATURES = [
  'Fórmula de Graham em todas as ações',
  '3 análises completas de empresas por mês',
  '3 rankings por mês (Graham, top 10)',
  '3 comparações e 3 screenings por mês',
  '1 backtest por mês',
  '1 carteira com acompanhamento',
]

export const PREMIUM_FEATURES = [
  `Todos os ${STOCK_VALUATION_MODELS_COUNT} modelos de valuation de ações`,
  'Análises, rankings e comparações ilimitados',
  'Screening e backtest ilimitados',
  'Síntese dos modelos com IA e relatórios',
  'Análise técnica',
  'Radar de oportunidades e de dividendos',
  'Carteiras com acompanhamento',
  'Suporte prioritário',
]

interface PlanCardProps {
  name: string
  price: React.ReactNode
  period?: string
  aux: React.ReactNode
  features: string[]
  cta: React.ReactNode
  note?: string
  recommended?: boolean
  className?: string
}

function PlanCard({ name, price, period, aux, features, cta, note, recommended, className }: PlanCardProps) {
  return (
    <div
      data-plan-card
      className={cn(
        'relative flex h-full flex-col rounded-lg bg-card p-5 sm:p-6',
        recommended ? 'border-2 border-brand lg:scale-105 lg:z-10' : 'border border-border',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{name}</h3>
        {recommended && <Badge variant="brand">Recomendado</Badge>}
      </div>
      <p className="mt-4 flex items-baseline gap-1">
        <span data-plan-price className="text-4xl font-semibold tracking-tight tabular-nums text-foreground">
          {price}
        </span>
        {period && <span className="text-sm text-muted-foreground">{period}</span>}
      </p>
      <p className="mt-1 min-h-5 text-sm text-muted-foreground tabular-nums">{aux}</p>

      <div className="mt-5">{cta}</div>
      {note && <p className="mt-2 text-center text-xs text-muted-foreground">{note}</p>}

      <ul className="mt-6 space-y-2.5 border-t border-border pt-5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CurrentPlanLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex h-11 items-center justify-center rounded-md border border-border bg-muted text-sm font-medium text-muted-foreground md:h-9">
      {children}
    </p>
  )
}

/**
 * Três planos lado a lado (Grátis, Anual recomendado, Mensal). No mobile o anual vem primeiro.
 * Preços vêm das ofertas do banco (`usePricing`), com fallback enquanto carregam.
 */
export function LandingPricingSection({
  showHeader = true,
  currentPlan = null,
  isLoggedIn = false,
  className,
}: LandingPricingSectionProps) {
  const { isAvailable: isTrialAvailable } = useTrialAvailable()
  const { monthly, annual, isLoading } = usePricing()

  const pricing = getPlanPricing(
    monthly?.price_in_cents ?? FALLBACK_MONTHLY_PRICE_IN_CENTS,
    annual?.price_in_cents ?? FALLBACK_ANNUAL_PRICE_IN_CENTS
  )
  const isSubscriber = Boolean(currentPlan)
  // O teste de 1 dia vale só para contas novas: quem já está logado vai direto ao checkout.
  const offerTrial = isTrialAvailable && !isLoggedIn && !isSubscriber
  const premiumCtaLabel = offerTrial ? 'Começar 1 dia grátis' : null

  const priceOrSkeleton = (value: number) =>
    isLoading ? (
      <span aria-label="Carregando preço" className="inline-block h-9 w-36 animate-pulse rounded-md bg-muted align-middle" />
    ) : (
      formatBRL(value)
    )

  return (
    <section id="pricing" className={cn('scroll-mt-20 bg-background py-16 sm:py-20', className)}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {showHeader && (
          <div className="mb-10 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Planos</h2>
            <p className="mt-2 text-base text-muted-foreground">
              Comece grátis. O Premium libera todos os modelos, a IA e o uso ilimitado.
            </p>
          </div>
        )}

        {currentPlan && (
          <p className="mb-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground">
            Seu plano atual: <span className="font-medium">Premium</span>
            {currentPlan.expiresAt ? ` · válido até ${formatDate(currentPlan.expiresAt)}` : null}
            {' · '}
            <Link href="/perfil" className="font-medium text-brand underline-offset-4 hover:underline">
              Gerenciar assinatura
            </Link>
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch lg:gap-6">
          <PlanCard
            className="order-2 lg:order-1"
            name="Grátis"
            price={formatBRL(0, { digits: 0 })}
            aux="Para sempre, sem cartão de crédito"
            features={FREE_FEATURES}
            cta={
              isSubscriber ? (
                <CurrentPlanLabel>Incluído no seu plano</CurrentPlanLabel>
              ) : (
                isLoggedIn ? (
                  <CurrentPlanLabel>Seu plano atual</CurrentPlanLabel>
                ) : (
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/register">Criar conta grátis</Link>
                  </Button>
                )
              )
            }
          />

          <PlanCard
            className="order-1 lg:order-2"
            recommended
            name="Premium anual"
            price={priceOrSkeleton(pricing.annual)}
            period="/ano"
            aux={`equivale a ${formatBRL(pricing.annualMonthlyEquivalent)}/mês · 15% off no PIX`}
            features={[
              `Tudo do mensal, ${formatPct(pricing.annualDiscount)} mais barato`,
              ...PREMIUM_FEATURES.slice(0, 6),
              'Acesso antecipado e suporte VIP',
            ]}
            cta={
              isSubscriber ? (
                <CurrentPlanLabel>Você já é Premium</CurrentPlanLabel>
              ) : (
                <Button className="w-full" asChild>
                  <Link href={offerTrial ? '/register' : '/checkout?plan=annual'}>
                    {premiumCtaLabel ?? 'Assinar plano anual'}
                  </Link>
                </Button>
              )
            }
            note={isSubscriber ? undefined : 'PIX ou cartão · pagamento único anual'}
          />

          <PlanCard
            className="order-3"
            name="Premium mensal"
            price={priceOrSkeleton(pricing.monthly)}
            period="/mês"
            aux={`15% off no PIX: ${formatBRL(pricing.monthlyPix)}/mês`}
            features={PREMIUM_FEATURES}
            cta={
              isSubscriber ? (
                <CurrentPlanLabel>Você já é Premium</CurrentPlanLabel>
              ) : (
                <Button variant="outline" className="w-full" asChild>
                  <Link href={offerTrial ? '/register' : '/checkout?plan=monthly'}>
                    {premiumCtaLabel ?? 'Assinar plano mensal'}
                  </Link>
                </Button>
              )
            }
            note={isSubscriber ? undefined : 'Somente PIX · cancele quando quiser'}
          />
        </div>
      </div>
    </section>
  )
}
