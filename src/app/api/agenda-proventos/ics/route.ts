import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { loadAgendaData } from '@/app/agenda-proventos/agenda-data'
import { buildIcsCalendar, parseScope } from '@/app/agenda-proventos/agenda-model'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agenda-proventos/ics?escopo=todos|carteira|radar — calendário .ics (RFC 5545) com os proventos de hoje em
 * diante (anunciados e estimados) e os dos últimos 90 dias, para importar no Google Agenda, Apple ou Outlook.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Faça login para baixar sua agenda de proventos' }, { status: 401 })

  try {
    const data = await loadAgendaData(user.id)
    const scope = parseScope(request.nextUrl.searchParams.get('escopo'))
    const events = data.events.filter((e) =>
      scope === 'carteira' ? e.sources.includes('portfolio') : scope === 'radar' ? e.sources.includes('radar') : true
    )
    const body = buildIcsCalendar(events)
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="agenda-proventos-${data.today}.ics"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('[AGENDA PROVENTOS] Erro ao gerar o .ics:', error)
    return NextResponse.json({ error: 'Não foi possível gerar o calendário' }, { status: 500 })
  }
}
