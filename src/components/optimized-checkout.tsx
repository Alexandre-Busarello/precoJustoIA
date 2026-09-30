'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, ChevronDown, CreditCard, Loader2, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { OptimizedPixPayment } from './optimized-pix-payment'
import { useCheckoutUrl } from './kiwify-checkout-link'
import { PREMIUM_FEATURES } from './landing-pricing-section'
import { usePricing } from '@/hooks/use-pricing'
import { formatBRL, formatPct } from '@/lib/format'
import {
  calculateDiscount,
  calculatePixDiscount,
  FALLBACK_ANNUAL_PRICE_IN_CENTS,
  FALLBACK_MONTHLY_PRICE_IN_CENTS,
  getPixDiscountAmount,
} from '@/lib/price-utils'
import { isOfferActiveForPurchase } from '@/lib/offer-utils'
import { cn } from '@/lib/utils'

type PlanType = 'monthly' | 'annual'
type PaymentMethod = 'pix' | 'card'

interface OptimizedCheckoutProps {
  /** Plano vindo da URL (`?plan=`): pula a escolha de plano e abre a etapa de pagamento. */
  initialPlan?: PlanType
}

interface PlanData {
  key: PlanType
  name: string
  /** Preço cheio em centavos. */
  priceCents: number
  /** Preço com desconto PIX em centavos. */
  pixPriceCents: number
  period: string
}

const STEP_LABELS = ['Plano', 'Pagamento', 'Confirmação']

export function OptimizedCheckout({ initialPlan }: OptimizedCheckoutProps) {
  const { status, data: session } = useSession()
  const router = useRouter()
  const checkoutUrl = useCheckoutUrl({ email: session?.user?.email })
  const { monthly, annual, special, isLoading: isLoadingPricing } = usePricing()

  const [step, setStep] = useState<'plan' | 'payment'>(initialPlan === 'annual' ? 'payment' : 'plan')
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(initialPlan ?? null)
  const [showPayment, setShowPayment] = useState(initialPlan === 'monthly')

  const monthlyCents = monthly?.price_in_cents ?? FALLBACK_MONTHLY_PRICE_IN_CENTS
  const annualCents = annual?.price_in_cents ?? FALLBACK_ANNUAL_PRICE_IN_CENTS
  const annualDiscount = calculateDiscount(monthlyCents, annualCents)

  const getPlanData = (planType: PlanType): PlanData => {
    const priceCents = planType === 'monthly' ? monthlyCents : annualCents
    return {
      key: planType,
      name: planType === 'monthly' ? 'Premium mensal' : 'Premium anual',
      priceCents,
      pixPriceCents: calculatePixDiscount(priceCents),
      period: planType === 'monthly' ? '/mês' : '/ano',
    }
  }

  const currentPlan = selectedPlan ? getPlanData(selectedPlan) : null

  useEffect(() => {
    if (status === 'unauthenticated') {
      // Preserva o plano escolhido (?plan=) para voltar ao mesmo ponto após o login.
      const returnTo = `${window.location.pathname}${window.location.search}`
      router.push(`/login?callbackUrl=${encodeURIComponent(returnTo)}`)
    }
  }, [status, router])

  const handlePlanSelect = (plan: PlanType) => {
    setSelectedPlan(plan)
    if (plan === 'monthly') {
      // Mensal: somente PIX, vai direto para a geração do código
      setShowPayment(true)
    } else {
      setStep('payment')
    }
  }

  const handleBackToPlans = () => {
    setStep('plan')
    setSelectedPlan(null)
    setShowPayment(false)
  }

  const handleMethodSelect = (method: PaymentMethod) => {
    // Cartão: checkout externo (Cakto)
    if (method === 'card') {
      if (checkoutUrl) window.location.href = checkoutUrl
      return
    }
    setShowPayment(true)
  }

  const handleBackFromPix = () => {
    if (selectedPlan === 'monthly') handleBackToPlans()
    else setShowPayment(false)
  }

  const handlePaymentSuccess = () => {
    router.push('/checkout/success')
  }

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error)
    toast.error('Não foi possível gerar o pagamento', {
      description: error || 'Tente novamente em alguns instantes.',
    })
  }

  if (status === 'loading' || isLoadingPricing || status === 'unauthenticated') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background">
        <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          {status === 'unauthenticated' ? 'Redirecionando para o login' : 'Carregando planos'}
        </p>
      </div>
    )
  }

  const hasActiveSpecialOffer =
    !!special &&
    isOfferActiveForPurchase({
      is_active: true,
      expires_at: special.expires_at ? new Date(special.expires_at) : null,
    })
  const specialSavingsCents = special && annual ? annual.price_in_cents - special.price_in_cents : 0

  const currentStepIndex = showPayment ? 2 : step === 'payment' ? 1 : 0
  const plansToShow: PlanData[] = [
    ...(annual ? [getPlanData('annual')] : []),
    ...(monthly ? [getPlanData('monthly')] : []),
  ]

  const title = showPayment ? 'Pagamento via PIX' : step === 'plan' ? 'Escolha seu plano Premium' : 'Forma de pagamento'
  const description = showPayment && currentPlan
    ? `${currentPlan.name} · ${formatBRL(currentPlan.pixPriceCents / 100)} com 15% de desconto no PIX`
    : step === 'payment' && currentPlan
      ? `${currentPlan.name} · ${formatBRL(currentPlan.priceCents / 100)}${currentPlan.period}`
      : 'Os 8 modelos de valuation, a síntese com IA e uso ilimitado das ferramentas.'

  return (
    <div className="bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <ol aria-label="Etapas do pagamento" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:mb-6 sm:text-sm">
          {STEP_LABELS.map((label, idx) => (
            <li key={label} aria-current={idx === currentStepIndex ? 'step' : undefined} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[11px] font-medium tabular-nums',
                  idx <= currentStepIndex ? 'bg-brand text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                {idx + 1}
              </span>
              <span className={idx <= currentStepIndex ? 'font-medium text-foreground' : 'text-muted-foreground'}>{label}</span>
            </li>
          ))}
        </ol>

        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">{description}</p>
        </header>

        {showPayment && currentPlan ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4 sm:p-6 lg:col-span-2">
              <div className="mb-4 hidden items-center justify-between sm:flex">
                <h2 className="text-base font-semibold text-foreground">Pague com PIX</h2>
                <Button variant="ghost" size="sm" onClick={handleBackFromPix}>
                  <ArrowLeft className="size-4" strokeWidth={1.75} />
                  Voltar
                </Button>
              </div>

              <OptimizedPixPayment
                planType={currentPlan.key}
                price={currentPlan.pixPriceCents / 100}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />

              <Button variant="ghost" className="mt-4 w-full sm:hidden" onClick={handleBackFromPix}>
                <ArrowLeft className="size-4" strokeWidth={1.75} />
                Voltar
              </Button>
            </div>

            <aside className="h-fit rounded-lg border border-border bg-card p-4 sm:p-6 lg:sticky lg:top-4">
              <h2 className="text-base font-semibold text-foreground">Resumo do pedido</h2>
              <dl className="mt-4 space-y-2 text-sm tabular-nums">
                <div className="flex justify-between gap-4">
                  <dt className="text-foreground">{currentPlan.name}</dt>
                  <dd className="text-foreground">{formatBRL(currentPlan.priceCents / 100)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Desconto PIX (15%)</dt>
                  <dd className="text-muted-foreground">{formatBRL(-getPixDiscountAmount(currentPlan.priceCents) / 100)}</dd>
                </div>
              </dl>
              <Separator className="my-4" />
              <div className="flex justify-between text-base font-semibold tabular-nums text-foreground">
                <span>Total</span>
                <span>{formatBRL(currentPlan.pixPriceCents / 100)}</span>
              </div>
              <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                {['Ativação imediata após a confirmação', 'Reembolso em até 7 dias', 'Suporte incluído'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        ) : step === 'payment' && currentPlan ? (
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleMethodSelect('pix')}
                className="flex min-h-24 flex-col items-start gap-1 rounded-lg border-2 border-brand bg-card p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
              >
                <span className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
                  <Smartphone className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                  PIX
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {formatBRL(currentPlan.pixPriceCents / 100)} · 15% de desconto, aprovação imediata
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleMethodSelect('card')}
                disabled={!checkoutUrl}
                className="flex min-h-24 flex-col items-start gap-1 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
                  <CreditCard className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                  Cartão de crédito
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {checkoutUrl
                    ? `${formatBRL(currentPlan.priceCents / 100)} · pagamento em página segura do parceiro Cakto`
                    : 'Indisponível no momento. Use o PIX, que tem 15% de desconto.'}
                </span>
              </button>
            </div>
            <Button variant="ghost" className="mt-4" onClick={handleBackToPlans}>
              <ArrowLeft className="size-4" strokeWidth={1.75} />
              Voltar aos planos
            </Button>
          </div>
        ) : (
          <>
            {hasActiveSpecialOffer && (
              <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    Oferta especial disponível
                    <Badge variant="brand">Por tempo limitado</Badge>
                  </p>
                  {specialSavingsCents > 0 && annual && (
                    <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                      {formatBRL(specialSavingsCents / 100)} a menos que o plano anual (
                      {formatPct(specialSavingsCents / annual.price_in_cents, { digits: 0 })}).
                    </p>
                  )}
                </div>
                <Button variant="outline" asChild>
                  <Link href="/checkout/oferta-especial">Ver oferta especial</Link>
                </Button>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {plansToShow.map((plan) => {
                const isAnnual = plan.key === 'annual'
                return (
                  <div
                    key={plan.key}
                    className={cn(
                      'flex flex-col rounded-lg bg-card p-4 sm:p-6',
                      isAnnual ? 'border-2 border-brand' : 'border border-border'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-base font-semibold text-foreground">{plan.name}</h2>
                      <Badge variant={isAnnual ? 'brand' : 'neutral'}>{isAnnual ? 'Recomendado' : 'Somente PIX'}</Badge>
                    </div>
                    <p className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                        {formatBRL(plan.priceCents / 100)}
                      </span>
                      <span className="text-sm text-muted-foreground">{plan.period}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                      {isAnnual
                        ? `${formatBRL(plan.pixPriceCents / 100)} no PIX · ${formatPct(annualDiscount)} menos que 12 mensalidades`
                        : `15% off no PIX: ${formatBRL(plan.pixPriceCents / 100)}/mês`}
                    </p>

                    <Button
                      className="mt-5 w-full"
                      variant={isAnnual ? 'default' : 'outline'}
                      onClick={() => handlePlanSelect(plan.key)}
                    >
                      {isAnnual ? 'Escolher o anual' : 'Pagar o mensal com PIX'}
                    </Button>

                    <details className="group mt-4">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground md:min-h-8 [&::-webkit-details-marker]:hidden">
                        O que está incluído
                        <ChevronDown className="size-4 transition-transform group-open:rotate-180" strokeWidth={1.75} aria-hidden="true" />
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {(isAnnual ? ['Tudo do plano mensal', ...PREMIUM_FEATURES.slice(0, 6), 'PIX ou cartão de crédito'] : PREMIUM_FEATURES).map(
                          (feature) => (
                            <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                              <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                              {feature}
                            </li>
                          )
                        )}
                      </ul>
                    </details>
                  </div>
                )
              })}
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Pagamento seguro · Ativação imediata · Reembolso em até 7 dias
            </p>
          </>
        )}
      </div>
    </div>
  )
}
