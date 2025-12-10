'use client'

import { useQuery } from '@tanstack/react-query'
import {
  calculateMonthlyEquivalent,
  calculateDiscount,
  formatPrice,
} from '@/lib/price-utils'

export interface Offer {
  id: string
  type: 'MONTHLY' | 'ANNUAL' | 'SPECIAL'
  price_in_cents: number
  price_formatted: string
  stripe_price_id: string | null
  currency: string
  expires_at?: string | null
  premium_duration_days?: number | null
  is_expired?: boolean
}

export interface PricingResponse {
  monthly?: Offer
  annual?: Offer
  special?: Offer
}

export interface UsePricingReturn {
  monthly: Offer | null
  annual: Offer | null
  special: Offer | null
  isLoading: boolean
  error: Error | null
  monthlyEquivalent: number | null // Equivalente mensal do plano anual
  annualDiscount: number | null // Desconto percentual do plano anual (0-1)
  annualDiscountFormatted: string | null // Desconto formatado (ex: "37%")
}

/**
 * Hook para buscar ofertas de preços do backend
 * Usa React Query com cache de 5 minutos
 */
export function usePricing(): UsePricingReturn {
  const { data, isLoading, error } = useQuery<PricingResponse>({
    queryKey: ['pricing', 'offers'],
    queryFn: async () => {
      const response = await fetch('/api/v1/pricing/offers')
      if (!response.ok) {
        throw new Error('Erro ao buscar ofertas')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    retry: 3,
    refetchOnWindowFocus: false,
  })

  // Calcular valores derivados
  const monthly = data?.monthly || null
  const annual = data?.annual || null
  const special = data?.special || null

  let monthlyEquivalent: number | null = null
  let annualDiscount: number | null = null
  let annualDiscountFormatted: string | null = null

  if (monthly && annual) {
    monthlyEquivalent = calculateMonthlyEquivalent(annual.price_in_cents)
    annualDiscount = calculateDiscount(
      monthly.price_in_cents,
      annual.price_in_cents
    )
    annualDiscountFormatted = `${Math.round(annualDiscount * 100)}%`
  }

  return {
    monthly,
    annual,
    special,
    isLoading,
    error: error as Error | null,
    monthlyEquivalent,
    annualDiscount,
    annualDiscountFormatted,
  }
}

