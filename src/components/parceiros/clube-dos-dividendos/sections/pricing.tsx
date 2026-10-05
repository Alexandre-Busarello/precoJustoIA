'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useCheckoutUrl } from '@/components/kiwify-checkout-link'
import { useSession } from 'next-auth/react'
import { FREE_TRIAL_NOTE, PRICING_FEATURES_FREE, PRICING_FEATURES_PREMIUM } from '../lp-data'

interface PricingSectionProps {
  partnerCheckoutUrl: string
}

export function PricingSection({ partnerCheckoutUrl }: PricingSectionProps) {
  const { data: session } = useSession()
  // Só assinantes pagos logados veem "Você já é Premium". O preview anônimo
  // (anon-can-view-full) e o trial não bloqueiam o checkout.
  const tier = session?.user?.subscriptionTier
  const expiresAt = session?.user?.premiumExpiresAt
  const isPaidSubscriber =
    !!session?.user &&
    (tier === 'PREMIUM' || tier === 'VIP') &&
    (!expiresAt || new Date(expiresAt) > new Date())
  const checkoutUrl = useCheckoutUrl({
    email: session?.user?.email ?? undefined,
    partnerCheckoutUrl,
  })

  return (
    <section id="planos" className="bg-surface py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 border-brand/40 bg-brand-subtle text-brand">
            Oferta exclusiva · Clube dos Dividendos
          </Badge>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            Acesso completo com desconto do clube
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Todos os recursos sem restrição. Cancele quando quiser.
          </p>
        </div>

        {/* Premium card — hero do layout */}
        <div className="relative mb-6 overflow-hidden rounded-lg border-2 border-brand bg-card p-6 md:p-8">
          {/* Top badges */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge className="bg-primary text-primary-foreground">Mais popular</Badge>
            <Badge variant="neutral">Desconto do clube</Badge>
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            {/* Left — price + features */}
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-foreground">Premium — acesso completo</h3>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-semibold tabular-nums text-foreground">R$21,45</span>
                <span className="mb-1 text-muted-foreground">/mês</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="line-through text-muted-foreground">R$294,90/ano</span>
                {' '}<span className="font-semibold text-brand">R$206,90/ano</span>
                {' '}<span className="rounded-full bg-brand-subtle px-2 py-0.5 text-xs font-semibold text-brand">−30%</span>
              </p>
              <p className="mt-1 text-xs text-brand font-medium">
                12x R$21,45 · Condição exclusiva para membros do Clube dos Dividendos
              </p>

              <ul className="mt-5 grid grid-cols-1 gap-y-1.5 sm:grid-cols-2">
                {PRICING_FEATURES_PREMIUM.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="size-4 shrink-0 text-brand" strokeWidth={1.75} aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — CTA */}
            <div className="flex shrink-0 flex-col items-stretch gap-3 md:w-56">
              {isPaidSubscriber ? (
                <button
                  disabled
                  aria-disabled="true"
                  className="flex min-h-[52px] w-full cursor-not-allowed items-center justify-center rounded-lg bg-muted font-semibold text-muted-foreground"
                >
                  Você já é Premium
                </button>
              ) : checkoutUrl ? (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[52px] w-full items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Assinar com desconto
                </a>
              ) : (
                <button
                  disabled
                  aria-disabled="true"
                  className="flex min-h-[52px] w-full cursor-not-allowed items-center justify-center rounded-lg bg-muted font-semibold text-muted-foreground"
                >
                  Carregando…
                </button>
              )}
              <p className="text-center text-xs text-muted-foreground">
                Sem fidelidade · Cancele quando quiser
              </p>
            </div>
          </div>
        </div>

        {/* Grátis — trial option, visually secondary */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-muted-foreground">Teste grátis — 1 dia</h3>
                <Badge className="bg-muted text-muted-foreground text-xs">Sem cartão</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie uma conta gratuita para explorar a plataforma antes de assinar. Sua vinculação
                ao Clube dos Dividendos é mantida — se assinar depois, o desconto é aplicado normalmente.
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {PRICING_FEATURES_FREE.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/register"
              className="flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-border px-6 text-sm font-medium text-muted-foreground transition hover:border-muted-foreground hover:text-muted-foreground"
            >
              Testar grátis
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{FREE_TRIAL_NOTE}</p>
        </div>
      </div>
    </section>
  )
}
