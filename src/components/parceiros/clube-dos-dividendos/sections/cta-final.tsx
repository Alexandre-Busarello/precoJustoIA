'use client'

import Link from 'next/link'
import { useCheckoutUrl } from '@/components/kiwify-checkout-link'
import { useSession } from 'next-auth/react'

interface CtaFinalSectionProps {
  partnerCheckoutUrl: string
}

export function CtaFinalSection({ partnerCheckoutUrl }: CtaFinalSectionProps) {
  const { data: session } = useSession()
  const checkoutUrl = useCheckoutUrl({
    email: session?.user?.email ?? undefined,
    partnerCheckoutUrl,
  })

  return (
    <section className="bg-emerald-600 py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold text-white md:text-4xl">
          Pronto para analisar ações como Bruno Mazzoni?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-emerald-100">
          Acesse a mesma plataforma que o Clube dos Dividendos usa — com desconto exclusivo para membros.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {checkoutUrl ? (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-white px-8 text-base font-bold text-emerald-700 transition hover:bg-emerald-50 sm:w-auto"
            >
              Assinar com desconto →
            </a>
          ) : (
            <a
              href="#planos"
              className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-white px-8 text-base font-bold text-emerald-700 transition hover:bg-emerald-50 sm:w-auto"
            >
              Ver planos →
            </a>
          )}
          <Link
            href="/register"
            className="flex min-h-[52px] w-full items-center justify-center rounded-xl border-2 border-white/60 px-8 text-sm font-medium text-emerald-100 transition hover:border-white hover:text-white sm:w-auto"
          >
            Testar grátis primeiro
          </Link>
        </div>
        <p className="mt-4 text-sm text-emerald-200">
          Teste grátis · Sem cartão · Desconto do clube mantido ao assinar
        </p>
      </div>
    </section>
  )
}
