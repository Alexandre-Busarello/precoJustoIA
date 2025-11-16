import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getTrialInfo } from '@/lib/trial-service'

/**
 * API para obter status do trial do usuário atual
 * GET /api/user/trial-status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const trialInfo = await getTrialInfo(session.user.id)

    return NextResponse.json(trialInfo)
  } catch (error) {
    console.error('Erro ao obter status do trial:', error)
    return NextResponse.json(
      { error: 'Erro ao obter status do trial' },
      { status: 500 }
    )
  }
}

