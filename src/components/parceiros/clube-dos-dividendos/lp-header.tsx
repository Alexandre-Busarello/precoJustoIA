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
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Image
          src="/logo-preco-justo.png"
          alt="Preço Justo AI"
          width={160}
          height={40}
          className="h-8 w-auto sm:h-10"
          priority
        />

        {/* Single CTA — no navigation links to keep user on page */}
        {checkoutUrl ? (
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[40px] items-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-white transition hover:bg-emerald-400"
          >
            Assinar com desconto
          </a>
        ) : (
          <a
            href="#planos"
            className="flex min-h-[40px] items-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-white transition hover:bg-emerald-400"
          >
            Ver planos
          </a>
        )}
      </div>
    </header>
  )
}
