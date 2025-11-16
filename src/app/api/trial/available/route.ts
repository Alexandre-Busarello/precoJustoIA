import { NextResponse } from 'next/server'
import { isTrialEnabled } from '@/lib/trial-service'
import { isProdPhase } from '@/lib/alfa-service'

/**
 * GET /api/trial/available
 * Verifica se o trial está disponível para novos usuários
 * Retorna se ENABLE_TRIAL=true E fase PROD
 */
export async function GET() {
  try {
    const trialEnabled = isTrialEnabled()
    const isProd = isProdPhase()
    const isAvailable = trialEnabled && isProd

    return NextResponse.json({
      isAvailable,
      trialEnabled,
      isProd,
      message: isAvailable 
        ? 'Trial está disponível para novos usuários'
        : 'Trial não está disponível no momento'
    })
  } catch (error) {
    console.error('Erro ao verificar disponibilidade do trial:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar disponibilidade do trial', isAvailable: false },
      { status: 500 }
    )
  }
}

