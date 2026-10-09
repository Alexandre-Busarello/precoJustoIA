/**
 * Faixas estatísticas do Ibovespa para o Ben e integrações.
 *
 * GET  /api/ben/project-ibov                 → os três horizontes
 * POST /api/ben/project-ibov { period }      → um horizonte (WEEKLY, MONTHLY ou ANNUAL)
 *
 * Os números vêm do cálculo determinístico (percentis históricos aplicados ao último fechamento). Nada aqui chama IA.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getIbovProjectionReport } from '@/lib/ibov-projections/service'
import type { HorizonId } from '@/lib/ibov-projections/types'

export const dynamic = 'force-dynamic'

const PERIODS: HorizonId[] = ['WEEKLY', 'MONTHLY', 'ANNUAL']
const DISCLAIMER =
  'Faixa estatística com base no comportamento histórico do índice, não é previsão nem recomendação de investimento.'

async function respond(period: HorizonId | null) {
  try {
    const report = await getIbovProjectionReport()
    const horizons = period ? report.horizons.filter((h) => h.id === period) : report.horizons
    return NextResponse.json({
      success: true,
      method: report.method,
      lastClose: report.lastClose,
      lastCloseDate: report.lastCloseDate,
      stale: report.stale,
      volatilityAdjusted: report.volatilityAdjusted,
      horizons,
      context: report.context,
      commentary: report.commentary,
      generatedAt: report.generatedAt,
      disclaimer: DISCLAIMER,
    })
  } catch (error) {
    console.error('Erro ao obter faixas do Ibovespa para o Ben:', error)
    return NextResponse.json({ success: false, error: 'Não foi possível calcular as faixas do Ibovespa agora.' }, { status: 503 })
  }
}

export async function GET() {
  return respond(null)
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { period?: string }
  const period = PERIODS.find((p) => p === body.period) ?? null
  if (body.period !== undefined && !period) {
    return NextResponse.json({ success: false, error: 'Período inválido. Use WEEKLY, MONTHLY ou ANNUAL.' }, { status: 400 })
  }
  return respond(period)
}
