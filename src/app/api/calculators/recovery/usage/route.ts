/**
 * API de uso da Calculadora de Recuperação
 * GET - Verificar se pode usar (sem registrar)
 * POST - Registrar uso (ao exibir resultado do cálculo)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkUsage, checkAndRecordUsage } from '@/lib/usage-based-pricing-service'
import { RateLimitMiddleware } from '@/lib/rate-limit-middleware'

const FEATURE = 'recovery_calculator'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const ip = RateLimitMiddleware.getClientIP(request)

    const result = await checkUsage({
      userId: session?.user?.id ?? null,
      ip,
      feature: FEATURE,
      resourceId: null,
    })

    return NextResponse.json({
      allowed: result.allowed,
      remaining: result.remaining,
      limit: result.limit,
      tier: result.tier,
    })
  } catch (error) {
    console.error('[recovery-usage] GET error:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar uso' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const ip = RateLimitMiddleware.getClientIP(request)

    const result = await checkAndRecordUsage({
      userId: session?.user?.id ?? null,
      ip,
      feature: FEATURE,
      resourceId: null,
      recordUsage: true,
    })

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Limite de uso atingido',
          remaining: 0,
          limit: result.limit,
          tier: result.tier,
          shouldConvertLead: result.shouldConvertLead,
          shouldConvertPremium: result.shouldConvertPremium,
        },
        { status: 403 }
      )
    }

    return NextResponse.json({
      allowed: true,
      remaining: result.remaining,
      limit: result.limit,
    })
  } catch (error) {
    console.error('[recovery-usage] POST error:', error)
    return NextResponse.json(
      { error: 'Erro ao registrar uso' },
      { status: 500 }
    )
  }
}
