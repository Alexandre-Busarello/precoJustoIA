/**
 * Cron: aquecimento das faixas estatísticas do Ibovespa.
 *
 * As faixas são calculadas sob demanda (com cache por pregão) em /api/ibov-projections, então a página se atualiza
 * mesmo sem este cron. Ele só antecipa o cálculo do dia, grava o registro diário em `IbovProjection` e, uma vez por
 * dia, pede à IA o comentário de contexto (que nunca altera os números).
 *
 * GET /api/cron/calculate-ibov-projections            → aquece e gera o comentário do dia, se ainda não existir
 * GET /api/cron/calculate-ibov-projections?commentary=0 → só aquece (sem chamada de IA)
 * Requer `Authorization: Bearer <CRON_SECRET>`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { warmIbovProjections } from '@/lib/ibov-projections/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const startedAt = Date.now()
  try {
    const withCommentary = request.nextUrl.searchParams.get('commentary') !== '0'
    const result = await warmIbovProjections({ withCommentary })
    return NextResponse.json({ success: true, ...result, durationMs: Date.now() - startedAt, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Erro no aquecimento das faixas do Ibovespa:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido', timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
