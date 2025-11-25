import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { checkFeatureUsage, getMonthlyUsage } from '@/lib/feature-usage-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    // Verificar se usuário está logado
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Você precisa estar logado para verificar uso.' },
        { status: 401 }
      )
    }

    const resolvedParams = await params
    const ticker = resolvedParams.ticker.toUpperCase()

    // Se for premium, retornar ilimitado
    if (user.isPremium) {
      return NextResponse.json({
        ticker,
        isPremium: true,
        allowed: true,
        remaining: -1,
        limit: -1,
        currentUsage: 0
      })
    }

    // Verificar uso para usuários gratuitos
    const usageCheck = await checkFeatureUsage(user.id, 'technical_analysis', ticker)
    const monthlyUsage = await getMonthlyUsage(user.id, 'technical_analysis')

    return NextResponse.json({
      ticker,
      isPremium: false,
      ...usageCheck,
      monthlyUsage
    })
  } catch (error: any) {
    console.error('Erro ao verificar uso de análise técnica:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar verificação de uso' },
      { status: 500 }
    )
  }
}

