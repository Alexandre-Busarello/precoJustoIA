import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/price-utils'
import { isOfferExpired } from '@/lib/offer-utils'

/**
 * GET /api/v1/pricing/offers
 * Retorna todas as ofertas ativas formatadas para consumo do frontend
 * Endpoint público (não requer autenticação)
 */
export async function GET() {
  try {
    // Buscar apenas ofertas ativas
    const offers = await prisma.offer.findMany({
      where: {
        is_active: true,
      },
      orderBy: {
        type: 'asc',
      },
    })

    if (offers.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma oferta ativa encontrada' },
        { status: 404 }
      )
    }

    // Separar ofertas por tipo
    const monthlyOffer = offers.find((offer) => offer.type === 'MONTHLY')
    const annualOffer = offers.find((offer) => offer.type === 'ANNUAL')
    const specialOffer = offers.find((offer) => offer.type === 'SPECIAL')

    // Formatar resposta
    const response: {
      monthly?: {
        id: string
        type: string
        price_in_cents: number
        price_formatted: string
        stripe_price_id: string | null
        currency: string
      }
      annual?: {
        id: string
        type: string
        price_in_cents: number
        price_formatted: string
        stripe_price_id: string | null
        currency: string
      }
      special?: {
        id: string
        type: string
        price_in_cents: number
        price_formatted: string
        stripe_price_id: string | null
        currency: string
        expires_at: string | null
        premium_duration_days: number | null
        is_expired: boolean
      }
    } = {}

    if (monthlyOffer) {
      response.monthly = {
        id: monthlyOffer.id,
        type: monthlyOffer.type,
        price_in_cents: monthlyOffer.price_in_cents,
        price_formatted: formatPrice(monthlyOffer.price_in_cents),
        stripe_price_id: monthlyOffer.stripe_price_id,
        currency: monthlyOffer.currency,
      }
    }

    if (annualOffer) {
      response.annual = {
        id: annualOffer.id,
        type: annualOffer.type,
        price_in_cents: annualOffer.price_in_cents,
        price_formatted: formatPrice(annualOffer.price_in_cents),
        stripe_price_id: annualOffer.stripe_price_id,
        currency: annualOffer.currency,
      }
    }

    if (specialOffer) {
      const expired = isOfferExpired(specialOffer)
      response.special = {
        id: specialOffer.id,
        type: specialOffer.type,
        price_in_cents: specialOffer.price_in_cents,
        price_formatted: formatPrice(specialOffer.price_in_cents),
        stripe_price_id: specialOffer.stripe_price_id,
        currency: specialOffer.currency,
        expires_at: specialOffer.expires_at?.toISOString() || null,
        premium_duration_days: specialOffer.premium_duration_days,
        is_expired: expired,
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Erro ao buscar ofertas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

