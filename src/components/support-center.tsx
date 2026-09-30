"use client"

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CreateTicketDialog from '@/components/create-ticket-dialog'
import TicketDetailsDialog, {
  OPEN_TICKET_STATUSES,
  TICKET_CATEGORY,
  TICKET_PRIORITY,
  TicketStatusBadge,
  ticketNumber,
  type SupportTicket,
} from '@/components/ticket-details-dialog'
import { formatDate } from '@/lib/format'

type Filter = 'all' | 'open' | 'waiting' | 'closed'

const FILTERS: Array<{ value: Filter; label: string; match: (t: SupportTicket) => boolean }> = [
  { value: 'all', label: 'Todos', match: () => true },
  { value: 'open', label: 'Abertos', match: (t) => OPEN_TICKET_STATUSES.includes(t.status) },
  { value: 'waiting', label: 'Aguardando', match: (t) => t.status === 'WAITING_USER' },
  { value: 'closed', label: 'Fechados', match: (t) => t.status === 'RESOLVED' || t.status === 'CLOSED' },
]

const COLUMNS: DataTableColumn<SupportTicket>[] = [
  {
    key: 'title',
    header: 'Chamado',
    sortable: true,
    className: 'max-w-[10rem] py-2.5 min-[400px]:max-w-[13rem] sm:max-w-md',
    cell: (t) => (
      <div className="min-w-0 space-y-0.5">
        <p className="truncate font-medium text-foreground">{t.title}</p>
        <p className="text-xs text-pretty text-muted-foreground tabular-nums">
          {ticketNumber(t.id)} · {TICKET_CATEGORY[t.category]}
        </p>
        {/* No mobile a data ganha linha própria (a coluna some abaixo de md) e não é cortada pela categoria */}
        <p className="whitespace-nowrap text-xs text-muted-foreground tabular-nums md:hidden">
          <span className="sr-only">Atualizado em </span>
          {formatDate(t.updatedAt)}
        </p>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    sortValue: (t) => t.status,
    cell: (t) => <TicketStatusBadge status={t.status} />,
  },
  {
    key: 'priority',
    header: 'Prioridade',
    className: 'hidden md:table-cell',
    headerClassName: 'hidden md:table-cell',
    cell: (t) => <span className="text-muted-foreground">{TICKET_PRIORITY[t.priority]}</span>,
  },
  {
    key: 'updatedAt',
    header: 'Atualizado',
    align: 'right',
    sortable: true,
    sortValue: (t) => new Date(t.updatedAt).getTime(),
    className: 'hidden whitespace-nowrap md:table-cell',
    headerClassName: 'hidden md:table-cell',
    cell: (t) => formatDate(t.updatedAt),
  },
]

/** Chamados de suporte do usuário: filtros, tabela e diálogos de abertura e detalhes. */
export default function SupportCenter() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true)
      setError(false)
      const response = await fetch('/api/tickets')
      if (!response.ok) throw new Error('Erro ao carregar chamados')
      const data = await response.json()
      setTickets(data.tickets ?? [])
    } catch (err) {
      console.error('Erro ao carregar chamados:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  const handleTicketCreated = () => {
    setCreateDialogOpen(false)
    fetchTickets()
  }

  const openTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket)
    setDetailsDialogOpen(true)
  }

  const activeFilter = FILTERS.find((f) => f.value === filter) ?? FILTERS[0]
  const rows = tickets.filter(activeFilter.match)

  return (
    <section aria-labelledby="chamados-title" className="space-y-4">
      <SectionHeader
        id="chamados-title"
        title="Meus chamados"
        actions={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-4" strokeWidth={1.75} />
            Novo chamado
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        {/* No mobile os 4 filtros ficam em grade 2x2 (alvos de 44 px), sem rolagem escondida */}
        <TabsList aria-label="Filtrar chamados" className="max-sm:grid max-sm:w-full max-sm:grid-cols-2 max-sm:gap-[3px]">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="gap-1 max-sm:min-h-11">
              {f.label}
              <span className="text-xs text-muted-foreground tabular-nums">{tickets.filter(f.match).length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error ? (
        <div role="alert" className="space-y-3 rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar seus chamados.</p>
          <Button variant="outline" onClick={fetchTickets}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <DataTable
          caption="Chamados de suporte"
          columns={COLUMNS}
          rows={rows}
          getRowId={(t) => t.id}
          loading={loading}
          stickyFirstColumn
          defaultSort={{ key: 'updatedAt', direction: 'desc' }}
          onRowClick={openTicket}
          empty={
            filter === 'all'
              ? {
                  title: 'Nenhum chamado ainda',
                  description: 'Abra um chamado para falar com a equipe.',
                  action: (
                    <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                      Abrir chamado
                    </Button>
                  ),
                }
              : { title: 'Nenhum chamado neste filtro' }
          }
        />
      )}

      <CreateTicketDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onTicketCreated={handleTicketCreated} />

      {selectedTicket && (
        <TicketDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          ticket={selectedTicket}
          onTicketUpdated={fetchTickets}
        />
      )}
    </section>
  )
}
