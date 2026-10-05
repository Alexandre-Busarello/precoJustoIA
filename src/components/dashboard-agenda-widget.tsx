'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { RotateCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBRL } from '@/lib/format'
import { formatDateOnly, perShareDigits } from '@/app/radar-dividendos/dividend-months'
import type { AgendaData, AgendaEvent } from '@/app/agenda-proventos/agenda-model'

const ROWS = 5

/** Data que traz o evento para a lista: a data ex, se ainda não passou; senão o pagamento. */
function nextDate(event: AgendaEvent, today: string): { label: string; date: string } {
  if (event.exDate >= today) return { label: 'Data ex', date: event.exDate }
  return { label: event.paymentDateEstimated ? 'Pagamento estimado' : 'Pagamento', date: event.paymentDate ?? event.exDate }
}

function EventRow({ event, today }: { event: AgendaEvent; today: string }) {
  const when = nextDate(event, today)
  return (
    <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm">
          <span className="font-medium text-foreground">{event.ticker}</span>
          <span className="text-muted-foreground">{event.type}</span>
          {event.kind === 'projected' && <Badge variant="neutral">Estimativa</Badge>}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {when.label} {formatDateOnly(when.date)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium tabular-nums text-foreground">
          {event.positionNet ? formatBRL(event.positionNet) : formatBRL(event.amount, { digits: perShareDigits(event.amount) })}
        </p>
        <p className="text-xs text-muted-foreground">{event.positionNet ? 'sua posição' : 'por ação'}</p>
      </div>
    </li>
  )
}

/** "Próximos proventos" do dashboard: os 5 próximos eventos da carteira e do radar, com link para a agenda completa. */
export function DashboardAgendaWidget() {
  const { data, isLoading, isError, refetch } = useQuery<AgendaData>({
    queryKey: ['agenda-proventos', 'proximos', ROWS],
    queryFn: async () => {
      const response = await fetch(`/api/agenda-proventos?escopo=todos&periodo=proximos-90&limite=${ROWS}`)
      if (!response.ok) throw new Error('Erro ao carregar a agenda de proventos')
      return response.json()
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const events = data?.events ?? []

  return (
    <section aria-labelledby="proximos-proventos" className="space-y-4">
      <SectionHeader
        id="proximos-proventos"
        title="Próximos proventos"
        description="Carteira e radar, próximos 90 dias"
        actions={
          <Button asChild variant="link" size="sm" className="min-h-11 px-0 md:min-h-8">
            <Link href="/agenda-proventos">Ver agenda</Link>
          </Button>
        }
      />
      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <span className="sr-only">Carregando proventos</span>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">Não foi possível carregar os próximos proventos.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="shrink-0">
            <RotateCw className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Tentar novamente
          </Button>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Nenhum provento nos próximos 90 dias</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Adicione ativos ao radar ou à carteira para acompanhar datas ex e pagamentos.
          </p>
          <div className="mt-4 flex justify-center">
            <Button asChild variant="outline" size="sm">
              <Link href="/radar">Ir para o radar</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {events.map((event) => (
            <EventRow key={event.id} event={event} today={data?.today ?? ''} />
          ))}
        </ul>
      )}
    </section>
  )
}
