import { NextResponse } from 'next/server'
import { getIbovProjectionReport } from '@/lib/ibov-projections/service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ibov-projections
 * Faixas estatísticas do Ibovespa (1 semana, 1 mês e 12 meses) calculadas a partir do último fechamento,
 * com calibração e contexto. Cálculo determinístico, com cache por pregão; nenhuma chamada de IA aqui.
 */
export async function GET() {
  try {
    const report = await getIbovProjectionReport()
    return NextResponse.json(report, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    })
  } catch (error) {
    console.error('Erro ao calcular faixas do Ibovespa:', error)
    return NextResponse.json({ error: 'Não foi possível calcular as faixas do Ibovespa agora.' }, { status: 503 })
  }
}
