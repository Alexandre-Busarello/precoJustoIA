'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { useCheckoutUrl } from '@/components/kiwify-checkout-link'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { useSession } from 'next-auth/react'
import { FREE_TRIAL_NOTE, PRICING_FEATURES_FREE, PRICING_FEATURES_PREMIUM } from '../lp-data'

interface PricingSectionProps {
  partnerCheckoutUrl: string
}

export function PricingSection({ partnerCheckoutUrl }: PricingSectionProps) {
  const { data: session } = useSession()
  const { isPremium } = usePremiumStatus()
  const checkoutUrl = useCheckoutUrl({
    email: session?.user?.email ?? undefined,
    partnerCheckoutUrl,
  })

  return (
    <section id="planos" className="bg-slate-950 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            Oferta exclusiva · Clube dos Dividendos
          </Badge>
          <h2 className="text-3xl font-extrabold text-white md:text-4xl">
            Acesso completo com desconto do clube
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-slate-400">
            Todos os recursos sem restrição. Cancele quando quiser.
          </p>
        </div>

        {/* PREMIUM card — hero do layout */}
        <div className="relative mb-6 overflow-hidden rounded-2xl border-2 border-emerald-500 bg-slate-900 p-6 shadow-[0_0_60px_rgba(16,185,129,0.2)] md:p-8">
          {/* Top badges */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-500 text-white">Mais popular</Badge>
            <Badge className="border border-amber-500/50 bg-amber-500/20 font-bold text-amber-400">
              CLUBE
            </Badge>
            <Badge className="bg-slate-800 text-slate-300">Desconto exclusivo</Badge>
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            {/* Left — price + features */}
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white">Premium — Acesso Completo</h3>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-5xl font-extrabold text-emerald-400">R$21,45</span>
                <span className="mb-1 text-slate-400">/mês</span>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                <span className="line-through text-slate-600">R$294,90/ano</span>
                {' '}<span className="font-bold text-emerald-400">R$206,90/ano</span>
                {' '}<span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400">−30%</span>
              </p>
              <p className="mt-1 text-xs text-emerald-500 font-medium">
                12x R$21,45 · Condição exclusiva para membros do Clube dos Dividendos 🎯
              </p>

              <ul className="mt-5 grid grid-cols-1 gap-y-1.5 sm:grid-cols-2">
                {PRICING_FEATURES_PREMIUM.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-200">
                    <span className="shrink-0 text-emerald-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — CTA */}
            <div className="flex shrink-0 flex-col items-stretch gap-3 md:w-56">
              {isPremium ? (
                <button
                  disabled
                  aria-disabled="true"
                  className="flex min-h-[52px] w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-700 font-semibold text-slate-400"
                >
                  Você já é Premium ✓
                </button>
              ) : checkoutUrl ? (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-emerald-500 text-base font-bold text-white transition hover:bg-emerald-400"
                >
                  Assinar com desconto
                </a>
              ) : (
                <button
                  disabled
                  aria-disabled="true"
                  className="flex min-h-[52px] w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-700 font-semibold text-slate-500"
                >
                  Carregando...
                </button>
              )}
              <p className="text-center text-xs text-slate-500">
                Sem fidelidade · Cancele quando quiser
              </p>
            </div>
          </div>
        </div>

        {/* FREE — trial option, visually secondary */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-300">Teste Grátis — 1 dia</h3>
                <Badge className="bg-slate-800 text-slate-400 text-xs">Sem cartão</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Crie uma conta gratuita para explorar a plataforma antes de assinar. Sua vinculação
                ao Clube dos Dividendos é mantida — se assinar depois, o desconto é aplicado normalmente.
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {PRICING_FEATURES_FREE.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="text-slate-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/register"
              className="flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-700 px-6 text-sm font-medium text-slate-400 transition hover:border-slate-500 hover:text-slate-300"
            >
              Testar grátis
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-600">{FREE_TRIAL_NOTE}</p>
        </div>
      </div>
    </section>
  )
}
