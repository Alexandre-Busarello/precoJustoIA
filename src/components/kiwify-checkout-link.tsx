'use client'

import { useSearchParams } from 'next/navigation'
import { ReactNode } from 'react'

const KIWIFY_CHECKOUT_URL = "https://pay.kiwify.com.br/kV1DuGv"

/**
 * Constrói a URL do checkout da Kiwify com os parâmetros UTM da query string
 */
export function buildCheckoutUrl(searchParams: URLSearchParams | null): string {
  if (!searchParams) {
    return KIWIFY_CHECKOUT_URL
  }

  const utmParams = new URLSearchParams()
  
  // Parâmetros UTM padrão
  const utmSource = searchParams.get('utm_source')
  const utmMedium = searchParams.get('utm_medium')
  const utmCampaign = searchParams.get('utm_campaign')
  const utmContent = searchParams.get('utm_content')
  const utmTerm = searchParams.get('utm_term')
  
  // Adicionar apenas os parâmetros UTM que existem
  if (utmSource) utmParams.set('utm_source', utmSource)
  if (utmMedium) utmParams.set('utm_medium', utmMedium)
  if (utmCampaign) utmParams.set('utm_campaign', utmCampaign)
  if (utmContent) utmParams.set('utm_content', utmContent)
  if (utmTerm) utmParams.set('utm_term', utmTerm)
  
  // Outros parâmetros que podem ser úteis para tracking
  const ref = searchParams.get('ref')
  const source = searchParams.get('source')
  
  if (ref) utmParams.set('ref', ref)
  if (source) utmParams.set('source', source)
  
  // Se não houver parâmetros, retornar URL base
  if (utmParams.toString() === '') {
    return KIWIFY_CHECKOUT_URL
  }
  
  return `${KIWIFY_CHECKOUT_URL}?${utmParams.toString()}`
}

/**
 * Hook para obter a URL do checkout com parâmetros UTM
 */
export function useCheckoutUrl(): string {
  const searchParams = useSearchParams()
  return buildCheckoutUrl(searchParams)
}

/**
 * Componente que renderiza um link para o checkout com parâmetros UTM
 */
interface CheckoutLinkProps {
  children: ReactNode
  className?: string
  [key: string]: any // Permite passar outras props do elemento <a>
}

export function CheckoutLink({ children, className, ...props }: CheckoutLinkProps) {
  const checkoutUrl = useCheckoutUrl()
  
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




