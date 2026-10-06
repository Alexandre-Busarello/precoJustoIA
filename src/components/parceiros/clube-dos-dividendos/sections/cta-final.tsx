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
    <section className="bg-primary py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold text-primary-foreground md:text-4xl">
          Pronto para analisar ações como Bruno Mazzoni?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
          Acesse a mesma plataforma que o Clube dos Dividendos usa — com desconto exclusivo para membros.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {checkoutUrl ? (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[52px] w-full items-center justify-center rounded-lg bg-card px-8 text-base font-semibold text-brand transition hover:bg-brand-subtle sm:w-auto"
            >
              Assinar com desconto →
            </a>
          ) : (
            <a
              href="#planos"
              className="flex min-h-[52px] w-full items-center justify-center rounded-lg bg-card px-8 text-base font-semibold text-brand transition hover:bg-brand-subtle sm:w-auto"
            >
              Ver planos →
            </a>
          )}
          <Link
            href="/register"
            className="flex min-h-[52px] w-full items-center justify-center rounded-lg border-2 border-primary-foreground/60 px-8 text-sm font-medium text-primary-foreground transition hover:border-primary-foreground hover:bg-primary-foreground/10 sm:w-auto"
          >
            Testar grátis primeiro
          </Link>
        </div>
        <p className="mt-4 text-sm text-primary-foreground/80">
          Teste grátis · Sem cartão · Desconto do clube mantido ao assinar
        </p>
      </div>
    </section>
  )
}
