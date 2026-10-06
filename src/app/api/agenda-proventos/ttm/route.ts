import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { DividendService } from '@/lib/dividend-service'
import { sumTTM, toDividendEvents } from '@/lib/finance/dividends'
import { subtractMonthsUTC } from '@/lib/finance/utils'
import { todayInBrazil } from '@/app/agenda-proventos/agenda-model'

export const dynamic = 'force-dynamic'

const MAX_TICKERS = 60

/**
 * GET /api/agenda-proventos/ttm?tickers=PETR4,ITUB4 — proventos brutos por ação com data ex nos últimos 12 meses.
 * Base do yield on cost da carteira (TTM ÷ preço médio).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const tickers = (request.nextUrl.searchParams.get('tickers') ?? '')
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter((t) => /^[A-Z0-9]{4,12}$/.test(t))
    .slice(0, MAX_TICKERS)
  if (tickers.length === 0) return NextResponse.json({ ttm: {} })

  try {
    const today = todayInBrazil()
    const companies = await DividendService.getDividendHistoryByTickers(tickers, subtractMonthsUTC(today, 13))
    const ttm: Record<string, number> = {}
    for (const company of companies) ttm[company.ticker] = sumTTM(toDividendEvents(company.dividends), today)
    return NextResponse.json({ ttm }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
  } catch (error) {
    console.error('[AGENDA PROVENTOS] Erro ao calcular proventos TTM:', error)
    return NextResponse.json({ error: 'Não foi possível calcular os proventos' }, { status: 500 })
  }
}
