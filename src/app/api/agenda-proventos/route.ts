import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { loadAgendaData } from '@/app/agenda-proventos/agenda-data'
import { filterAgendaEvents, parsePeriod, parseScope } from '@/app/agenda-proventos/agenda-model'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agenda-proventos — agenda de proventos do usuário (radar + carteiras).
 * Sem parâmetros, devolve todos os eventos carregados; com `escopo` (todos|carteira|radar) e/ou `periodo`
 * (proximos-30|proximos-90|ultimos-90), devolve só os eventos filtrados. `limite` corta a lista.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Faça login para ver sua agenda de proventos' }, { status: 401 })

  try {
    const data = await loadAgendaData(user.id)
    const params = request.nextUrl.searchParams
    let events = data.events
    if (params.has('escopo') || params.has('periodo')) {
      events = filterAgendaEvents(events, parseScope(params.get('escopo')), parsePeriod(params.get('periodo')), data.today)
    }
    const limit = Number(params.get('limite'))
    if (Number.isInteger(limit) && limit > 0) events = events.slice(0, limit)

    return NextResponse.json({ ...data, events }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[AGENDA PROVENTOS] Erro ao montar a agenda:', error)
    return NextResponse.json({ error: 'Não foi possível carregar a agenda de proventos' }, { status: 500 })
  }
}
