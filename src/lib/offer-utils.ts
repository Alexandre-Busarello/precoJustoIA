import { prisma } from '@/lib/prisma'

export interface SpecialOffer {
  id: string
  type: 'SPECIAL'
  price_in_cents: number
  price_formatted: string
  stripe_price_id: string | null
  currency: string
  expires_at: Date | null
  premium_duration_days: number | null
  is_active: boolean
}

/**
 * Busca oferta SPECIAL ativa e não expirada
 */
export async function getActiveSpecialOffer(): Promise<SpecialOffer | null> {
  try {
    const offer = await prisma.offer.findFirst({
      where: {
        type: 'SPECIAL',
        is_active: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    if (!offer) {
      return null
    }

    return {
      id: offer.id,
      type: 'SPECIAL',
      price_in_cents: offer.price_in_cents,
      price_formatted: '', // Será formatado no frontend
      stripe_price_id: offer.stripe_price_id,
      currency: offer.currency,
      expires_at: offer.expires_at,
      premium_duration_days: offer.premium_duration_days,
      is_active: offer.is_active,
    }
  } catch (error) {
    console.error('Erro ao buscar oferta especial:', error)
    return null
  }
}

/**
 * Verifica se uma oferta está expirada
 */
export function isOfferExpired(offer: { expires_at: Date | null }): boolean {
  if (!offer.expires_at) {
    return false // Sem data de expiração = nunca expira
  }
  return new Date() > offer.expires_at
}

/**
 * Verifica se uma oferta está ativa para compra
 * (ativa E não expirada)
 */
export function isOfferActiveForPurchase(offer: {
  is_active: boolean
  expires_at: Date | null
}): boolean {
  if (!offer.is_active) {
    return false
  }
  return !isOfferExpired(offer)
}

/**
 * Calcula tempo restante até a expiração da oferta
 * Retorna null se não há expiração ou já expirou
 */
export function getTimeUntilExpiration(offer: {
  expires_at: Date | null
}): { days: number; hours: number; minutes: number } | null {
  if (!offer.expires_at) {
    return null
  }

  const now = new Date()
  const expiresAt = new Date(offer.expires_at)

  if (expiresAt <= now) {
    return null // Já expirou
  }

  const diffMs = expiresAt.getTime() - now.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  return { days, hours, minutes }
}

/**
 * Formata tempo restante em string legível
 */
export function formatTimeUntilExpiration(
  time: { days: number; hours: number; minutes: number } | null
): string {
  if (!time) {
    return 'Expirado'
  }

  if (time.days > 0) {
    return `${time.days}d ${time.hours}h`
  }
  if (time.hours > 0) {
    return `${time.hours}h ${time.minutes}min`
  }
  return `${time.minutes}min`
}

