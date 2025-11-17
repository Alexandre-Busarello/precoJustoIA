import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_REASONS = ['price_too_high', 'missing_features', 'just_browsing'] as const
type ReasonType = typeof VALID_REASONS[number]

const MIN_PRICE_CENTS = 0
const MAX_PRICE_CENTS = 1000000 // R$ 10.000,00

/**
 * POST /api/v1/feedback/exit-intent
 * Captura feedback de usuários quando tentam sair das páginas de planos/checkout
 * Endpoint público (não requer autenticação)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reason, suggested_price_in_cents, page } = body

    // Validação do campo reason
    if (!reason || !VALID_REASONS.includes(reason as ReasonType)) {
      return NextResponse.json(
        {
          error: 'Campo reason é obrigatório',
          validReasons: VALID_REASONS,
        },
        { status: 400 }
      )
    }

    // Validação do campo page
    if (!page || typeof page !== 'string') {
      return NextResponse.json(
        { error: 'Campo page é obrigatório' },
        { status: 400 }
      )
    }

    // Validação específica para price_too_high
    if (reason === 'price_too_high') {
      if (suggested_price_in_cents === undefined || suggested_price_in_cents === null) {
        return NextResponse.json(
          { error: 'Campo suggested_price_in_cents é obrigatório quando reason é "price_too_high"' },
          { status: 400 }
        )
      }

      const price = Number(suggested_price_in_cents)
      if (isNaN(price) || price < MIN_PRICE_CENTS || price > MAX_PRICE_CENTS) {
        return NextResponse.json(
          {
            error: `Campo suggested_price_in_cents deve ser um número entre ${MIN_PRICE_CENTS} e ${MAX_PRICE_CENTS} centavos`,
          },
          { status: 400 }
        )
      }
    }

    // Salvar feedback no banco
    const feedback = await prisma.exitIntentFeedback.create({
      data: {
        reason,
        suggested_price_in_cents:
          reason === 'price_too_high' ? Number(suggested_price_in_cents) : null,
        page,
      },
    })

    return NextResponse.json(
      {
        success: true,
        id: feedback.id,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro ao salvar feedback de exit intent:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

