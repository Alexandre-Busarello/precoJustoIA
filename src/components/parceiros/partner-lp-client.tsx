'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useCheckoutUrl } from '@/components/kiwify-checkout-link'
import { useSession } from 'next-auth/react'

interface PartnerLpClientProps {
  partnerId: string
  partnerName: string
  partnerCheckoutUrl: string
}

export function PartnerLpClient({ partnerId, partnerName, partnerCheckoutUrl }: PartnerLpClientProps) {
  useEffect(() => {
    try {
      localStorage.setItem('partner_id', partnerId)
    } catch {
      // localStorage bloqueado (modo privado restrito) — ignorar silenciosamente
    }
  }, [partnerId])

  const { data: session } = useSession()
  const checkoutUrl = useCheckoutUrl({
    email: session?.user?.email ?? undefined,
    partnerCheckoutUrl,
  })

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center">
      <h1 className="text-3xl font-bold text-slate-900">
        Bem-vindo ao Preço Justo AI
      </h1>
      <p className="max-w-md text-slate-600">
        Parceria exclusiva com <strong>{partnerName}</strong>. Crie sua conta agora ou assine com desconto especial.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/register"
          className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
        >
          Criar conta grátis
        </Link>
        {checkoutUrl ? (
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-900 px-6 py-3 font-semibold text-slate-900 hover:bg-slate-100"
          >
            Assinar agora
          </a>
        ) : (
          <span className="rounded-lg border border-slate-300 px-6 py-3 font-semibold text-slate-400 cursor-not-allowed">
            Assinar agora
          </span>
        )}
      </div>
    </div>
  )
}
