import { NextRequest, NextResponse } from 'next/server'
import { canUserRegister, isUserLimitReached, getAlfaStats } from '@/lib/alfa-service'

/**
 * API para verificar se um usuário pode se cadastrar na fase Alfa
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isEarlyAdopter = searchParams.get('earlyAdopter') === 'true'
    
    const canRegister = await canUserRegister(isEarlyAdopter)
    const limitReached = await isUserLimitReached()
    const stats = await getAlfaStats()
    
    return NextResponse.json({
      canRegister,
      limitReached,
      stats
    })
  } catch (error) {
    console.error('Erro ao verificar registro:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
