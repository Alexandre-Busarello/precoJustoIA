import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIbovData } from '@/lib/ben-tools'
import { isCurrentUserPremium } from '@/lib/user-service'

/**
 * GET /api/ibov-projections
 * Retorna todas as projeções IBOV válidas, ofuscadas para usuários gratuitos
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar se usuário é premium
    const isPremium = await isCurrentUserPremium()

    // Buscar todas as projeções válidas, ordenadas por período e data de criação
    const projections = await prisma.ibovProjection.findMany({
      orderBy: [
        { period: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // Buscar valor atual do IBOV
    const ibovData = await getIbovData()
    const currentValue = ibovData.success && ibovData.data ? ibovData.data.currentValue : 0

    // Ofuscar dados para usuários gratuitos
    const processedProjections = isPremium
      ? projections
      : projections.map(proj => ({
          ...proj,
          projectedValue: 0, // Ofuscado
          confidence: 0, // Ofuscado
          reasoning: 'Esta análise detalhada está disponível apenas para usuários Premium. Faça upgrade para desbloquear projeções completas do IBOVESPA com análises detalhadas do Ben.',
          keyIndicators: null // Ofuscado
        }))

    return NextResponse.json({
      success: true,
      projections: processedProjections,
      currentValue,
      isPremium
    })
  } catch (error) {
    console.error('Erro ao buscar projeções IBOV:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}



