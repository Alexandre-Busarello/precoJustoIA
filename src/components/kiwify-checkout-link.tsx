'use client'

import { useSearchParams } from 'next/navigation'
import { ReactNode } from 'react'

const KIWIFY_CHECKOUT_URL = "https://pay.kiwify.com.br/kV1DuGv"

export interface BuildCheckoutUrlOptions {
  /** Email do usuário logado para pré-preencher no checkout Kiwify */
  email?: string | null
}

/**
 * Constrói a URL do checkout da Kiwify com os parâmetros UTM da query string
 * e opcionalmente o email do usuário para pré-preencher o formulário
 */
export function buildCheckoutUrl(
  searchParams: URLSearchParams | null,
  options?: BuildCheckoutUrlOptions
): string {
  const params = new URLSearchParams()
  
  // Email do usuário logado (pré-preenche o checkout Kiwify)
  if (options?.email) {
    params.set('email', options.email)
  }
  
  if (searchParams) {
    // Parâmetros UTM padrão
    const utmSource = searchParams.get('utm_source')
    const utmMedium = searchParams.get('utm_medium')
    const utmCampaign = searchParams.get('utm_campaign')
    const utmContent = searchParams.get('utm_content')
    const utmTerm = searchParams.get('utm_term')
    
    if (utmSource) params.set('utm_source', utmSource)
    if (utmMedium) params.set('utm_medium', utmMedium)
    if (utmCampaign) params.set('utm_campaign', utmCampaign)
    if (utmContent) params.set('utm_content', utmContent)
    if (utmTerm) params.set('utm_term', utmTerm)
    
    const ref = searchParams.get('ref')
    const source = searchParams.get('source')
    if (ref) params.set('ref', ref)
    if (source) params.set('source', source)
  }
  
  if (params.toString() === '') {
    return KIWIFY_CHECKOUT_URL
  }
  
  return `${KIWIFY_CHECKOUT_URL}?${params.toString()}`
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





