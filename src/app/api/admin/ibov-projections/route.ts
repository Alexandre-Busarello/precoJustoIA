/**
 * API: Listar Projeções IBOV
 * GET /api/admin/ibov-projections
 * 
 * Lista todas as projeções IBOV (válidas e expiradas)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Verificar se usuário é admin
    const user = await requireAdminUser()
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const now = new Date()

    // Definir todos os períodos possíveis
    const allPeriods: Array<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'> = ['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL']

    // Buscar todas as projeções, ordenadas por período e data de criação
    const allProjections = await prisma.ibovProjection.findMany({
      orderBy: [
        { period: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // Agrupar por período e pegar a mais recente de cada
    const projectionsByPeriod = new Map<string, typeof allProjections[0]>()
    
    allProjections.forEach(projection => {
      const key = projection.period
      if (!projectionsByPeriod.has(key)) {
        projectionsByPeriod.set(key, projection)
      }
    })

    // Garantir que todos os períodos apareçam, mesmo sem dados
    const projections = allPeriods.map(period => {
      const projection = projectionsByPeriod.get(period)
      
      if (!projection) {
        // Período sem dados - retornar objeto com flag indicando ausência
        return {
          id: null,
          period,
          projectedValue: null,
          confidence: null,
          reasoning: null,
          keyIndicators: null,
          validUntil: null,
          createdAt: null,
          isValid: false,
          hasData: false
        }
      }
      
      return {
        id: projection.id,
        period: projection.period,
        projectedValue: Number(projection.projectedValue),
        confidence: projection.confidence,
        reasoning: projection.reasoning,
        keyIndicators: projection.keyIndicators,
        validUntil: projection.validUntil.toISOString(),
        createdAt: projection.createdAt.toISOString(),
        isValid: projection.validUntil > now,
        hasData: true
      }
    })

    return NextResponse.json({
      success: true,
      projections
    })
  } catch (error) {
    console.error('❌ [ADMIN IBOV PROJECTIONS] Erro ao listar projeções:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    )
  }
}

