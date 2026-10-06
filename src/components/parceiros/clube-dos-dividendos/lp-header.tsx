'use client'

import Image from 'next/image'
import { useCheckoutUrl } from '@/components/kiwify-checkout-link'
import { useSession } from 'next-auth/react'

interface LpHeaderProps {
  partnerCheckoutUrl: string
}

export function LpHeader({ partnerCheckoutUrl }: LpHeaderProps) {
  const { data: session } = useSession()
  const checkoutUrl = useCheckoutUrl({
    email: session?.user?.email ?? undefined,
    partnerCheckoutUrl,
  })

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Image
          src="/logo-preco-justo.png"
          alt="Preço Justo AI"
          width={553}
          height={135}
          className="h-7 w-auto dark:hidden sm:h-8"
          priority
        />
        <Image
          src="/logo-preco-justo-dark.png"
          alt="Preço Justo AI"
          width={553}
          height={135}
          className="hidden h-7 w-auto dark:block sm:h-8"
          priority
        />

        {/* Single CTA — no navigation links to keep user on page */}
        {checkoutUrl ? (
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Assinar com desconto
          </a>
        ) : (
          <a
            href="#planos"
            className="flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Ver planos
          </a>
        )}
      </div>
    </header>
  )
}
