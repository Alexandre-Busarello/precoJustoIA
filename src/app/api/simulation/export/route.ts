/**
 * API de Exportação CSV
 * 
 * POST /api/simulation/export
 * 
 * Exporta resultados da simulação em formato CSV
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { strategy, monthlyData, debtName } = body

    if (!monthlyData || !Array.isArray(monthlyData)) {
      return NextResponse.json(
        { error: 'Dados mensais são obrigatórios' },
        { status: 400 }
      )
    }

    // Criar CSV
    const headers = ['Mês', 'Saldo Devedor', 'Patrimônio Investido', 'Patrimônio Líquido', 'Break-even']
    const rows = monthlyData.map((data: any, index: number) => {
      const isBreakEven = data.netWorth >= 0 && data.debtBalance > 0 && data.investedBalance >= data.debtBalance
      return [
        data.month,
        data.debtBalance.toFixed(2),
        data.investedBalance.toFixed(2),
        data.netWorth.toFixed(2),
        isBreakEven ? 'Sim' : 'Não'
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.join(','))
    ].join('\n')

    // Adicionar BOM para Excel reconhecer UTF-8
    const csvWithBOM = '\uFEFF' + csvContent

    // Retornar como download
    return new NextResponse(csvWithBOM, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="simulacao-${strategy || 'arbitragem'}-${debtName || 'divida'}.csv"`
      }
    })
  } catch (error: any) {
    console.error('Erro ao exportar CSV:', error)
    return NextResponse.json(
      { error: `Erro ao exportar: ${error.message}` },
      { status: 500 }
    )
  }
}

