'use client'

import { useSearchParams } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'

export interface BuildCheckoutUrlOptions {
  /** Email do usuário logado para pré-preencher no checkout */
  email?: string | null
}

/**
 * Constrói a URL do checkout com os parâmetros UTM da query string
 * e opcionalmente o email do usuário para pré-preencher o formulário
 */
export function buildCheckoutUrl(
  baseUrl: string | null,
  searchParams: URLSearchParams | null,
  options?: BuildCheckoutUrlOptions
): string {
  if (!baseUrl) return ''

  const params = new URLSearchParams()

  if (options?.email) {
    params.set('email', options.email)
  }

  if (searchParams) {
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'source']
    for (const key of utmKeys) {
      const val = searchParams.get(key)
      if (val) params.set(key, val)
    }
  }

  if (params.toString() === '') {
    return baseUrl
  }

  return `${baseUrl}?${params.toString()}`
}

async function fetchCheckoutUrl(): Promise<string | null> {
  try {
    const res = await fetch('/api/v1/pricing/offers', { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    // Preferir oferta mensal → anual → especial com checkout_url definido
    const url =
      data.monthly?.checkout_url ??
      data.annual?.checkout_url ??
      data.special?.checkout_url ??
      null
    if (url) return url
    return process.env.NEXT_PUBLIC_CAKTO_PRODUCT_URL ?? null
  } catch {
    return process.env.NEXT_PUBLIC_CAKTO_PRODUCT_URL ?? null
  }
}

/**
 * Hook para obter a URL do checkout com parâmetros UTM.
 * Retorna string vazia enquanto carrega ou quando indisponível.
 */
export function useCheckoutUrl(options?: BuildCheckoutUrlOptions): string {
  const searchParams = useSearchParams()
  const [baseUrl, setBaseUrl] = useState<string | null>(null)

  useEffect(() => {
    fetchCheckoutUrl().then(setBaseUrl)
  }, [])

  return buildCheckoutUrl(baseUrl, searchParams, options)
}

/**
 * Componente que renderiza um link para o checkout com parâmetros UTM
 */
interface CheckoutLinkProps {
  children: ReactNode
  className?: string
  [key: string]: any
}

export function CheckoutLink({ children, className, ...props }: CheckoutLinkProps) {
  const checkoutUrl = useCheckoutUrl()

  if (!checkoutUrl) {
    return (
      <span className={className} aria-disabled="true" {...props}>
        {children}
      </span>
    )
  }

  return (
    <a
      href={checkoutUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      {...props}
    >
      {children}
    </a>
  )
}
