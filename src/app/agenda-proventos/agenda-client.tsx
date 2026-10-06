'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarPlus, Download } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { AssetCell, assetHref } from '@/components/asset/asset-cell'
import { SectionHeader } from '@/components/ui/section-header'
import { Stat } from '@/components/ui/stat'
import { cn } from '@/lib/utils'
import { formatBRL, formatNumber } from '@/lib/format'
import { formatDateOnly, perShareDigits } from '@/app/radar-dividendos/dividend-months'
import {
  AGENDA_PERIODS,
  AGENDA_SCOPES,
  addDaysKey,
  filterAgendaEvents,
  nextPortfolioPayment,
  portfolioIncomeBetween,
  type AgendaData,
  type AgendaEvent,
  type AgendaPeriod,
  type AgendaScope,
} from './agenda-model'
import { IncomeChart, IncomeLegend } from './income-chart'

const GOOGLE_CALENDAR_IMPORT_URL = 'https://calendar.google.com/calendar/u/0/r/settings/export'

function perShare(amount: number): string {
  return formatBRL(amount, { digits: perShareDigits(amount) })
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex w-full rounded-md border border-border bg-surface p-0.5 sm:w-auto">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-11 flex-1 rounded-[5px] px-2 py-1 text-sm leading-tight transition-colors sm:px-3 sm:whitespace-nowrap focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none sm:flex-none md:min-h-8',
            value === option.value ? 'bg-card font-medium text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function sourceLabel(event: AgendaEvent): string {
  return event.sources.map((s) => (s === 'portfolio' ? 'Carteira' : 'Radar')).join(' · ')
}

const columns: DataTableColumn<AgendaEvent>[] = [
  {
    key: 'ticker',
    header: 'Ativo',
    sortable: true,
    cell: (e) => (
      <AssetCell
        href={assetHref(e.ticker, e.assetType)}
        ticker={e.ticker}
        name={sourceLabel(e)}
        logoUrl={e.logoUrl}
        className="max-w-40"
      />
    ),
  },
  {
    key: 'type',
    header: 'Tipo',
    sortable: true,
    cell: (e) => (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 whitespace-nowrap">
        {e.type}
        {e.kind === 'projected' && <Badge variant="neutral">Estimativa</Badge>}
      </span>
    ),
  },
  {
    key: 'exDate',
    header: 'Data ex',
    sortable: true,
    hint: 'Primeiro pregão sem direito ao provento. Recebe quem tem a ação até o pregão anterior (data-com).',
    cell: (e) => <span className="whitespace-nowrap tabular-nums">{formatDateOnly(e.exDate)}</span>,
  },
  {
    key: 'paymentDate',
    header: 'Pagamento',
    sortable: true,
    sortValue: (e) => e.paymentDate,
    cell: (e) =>
      e.paymentDate ? (
        <span className="whitespace-nowrap tabular-nums">
          {formatDateOnly(e.paymentDate)}
          {e.paymentDateEstimated && <span className="block text-xs text-muted-foreground">estimado</span>}
        </span>
      ) : (
        <span className="text-muted-foreground">Não informado</span>
      ),
  },
  {
    key: 'amount',
    header: 'Bruto por ação',
    align: 'right',
    sortable: true,
    cell: (e) => perShare(e.amount),
  },
  {
    key: 'netAmount',
    header: 'Líquido por ação',
    align: 'right',
    sortable: true,
    hint: 'JCP com IRRF de 17,5% desde 2026 (15% até 2025). Dividendos e rendimentos de FII são isentos.',
    cell: (e) => perShare(e.netAmount),
  },
  {
    key: 'quantity',
    header: 'Qtd. na data ex',
    align: 'right',
    sortable: true,
    cell: (e) => (e.quantity === null ? '—' : formatNumber(e.quantity, { digits: 0 })),
  },
  {
    key: 'positionNet',
    header: 'Valor estimado',
    align: 'right',
    sortable: true,
    hint: 'Quantidade em carteira na data ex × valor líquido por ação.',
    cell: (e) => (e.positionNet === null ? '—' : <span className="font-medium">{formatBRL(e.positionNet)}</span>),
  },
]

export function AgendaProventosClient({ data }: { data: AgendaData }) {
  const [scope, setScope] = useState<AgendaScope>('todos')
  const [period, setPeriod] = useState<AgendaPeriod>('proximos-90')

  const rows = useMemo(() => filterAgendaEvents(data.events, scope, period, data.today), [data, scope, period])
  const hasAssets = data.portfolioTickers.length > 0 || data.radarTickers.length > 0
  const hasPortfolio = data.portfolioTickers.length > 0

  const income12m = data.monthlyIncome.reduce((sum, m) => sum + m.confirmed + m.projected, 0)
  const nextPayment = nextPortfolioPayment(data.events, data.today)
  const upcoming30 = portfolioIncomeBetween(data.events, data.today, addDaysKey(data.today, 30))

  const icsHref = `/api/agenda-proventos/ics?escopo=${scope}`

  const addToGoogle = () => {
    const link = document.createElement('a')
    link.href = icsHref
    link.download = ''
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.open(GOOGLE_CALENDAR_IMPORT_URL, '_blank', 'noopener,noreferrer')
    toast.info('Arquivo .ics baixado', {
      description: 'No Google Agenda, em Importar, selecione o arquivo e escolha a agenda de destino.',
    })
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6">
      <PageHeader
        title="Agenda de proventos"
        description="Datas ex, pagamentos e valores dos ativos da sua carteira e do seu radar."
        actions={
          hasAssets ? (
            <>
              <Button asChild variant="outline" size="sm">
                <a href={icsHref} download>
                  <Download strokeWidth={1.75} aria-hidden="true" />
                  Baixar .ics
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={addToGoogle}>
                <CalendarPlus strokeWidth={1.75} aria-hidden="true" />
                Adicionar ao Google Agenda
              </Button>
            </>
          ) : undefined
        }
      />

      {hasPortfolio && (
        <section aria-labelledby="renda-mensal" className="space-y-4">
          <SectionHeader
            id="renda-mensal"
            title="Renda mensal da carteira"
            description="Próximos 12 meses, valores líquidos pela data de pagamento."
            actions={<IncomeLegend />}
          />
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            <Stat
              className="bg-card p-4"
              label="Renda estimada em 12 meses"
              value={formatBRL(income12m)}
              caption={`média de ${formatBRL(income12m / 12)} por mês`}
            />
            <Stat
              className="bg-card p-4"
              label="A receber em 30 dias"
              value={formatBRL(upcoming30)}
              caption="pagamentos anunciados e estimados"
            />
            <Stat
              className="bg-card p-4"
              label="Próximo pagamento"
              value={nextPayment ? formatBRL(nextPayment.positionNet) : '—'}
              caption={
                nextPayment
                  ? `${nextPayment.ticker} · ${formatDateOnly(nextPayment.paymentDate)}${nextPayment.kind === 'projected' ? ' (estimativa)' : ''}`
                  : 'Nenhum pagamento previsto'
              }
            />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <IncomeChart months={data.monthlyIncome} />
          </div>
        </section>
      )}

      <section aria-labelledby="eventos" className="space-y-4">
        <SectionHeader id="eventos" title="Proventos" description={`${rows.length} ${rows.length === 1 ? 'evento' : 'eventos'} com data ex ou pagamento no período, em ordem de data ex`} />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <SegmentedControl label="Origem dos ativos" options={AGENDA_SCOPES} value={scope} onChange={setScope} />
          <SegmentedControl label="Período" options={AGENDA_PERIODS} value={period} onChange={setPeriod} />
        </div>
        <DataTable
          caption="Proventos da carteira e do radar"
          columns={columns}
          rows={rows}
          getRowId={(e) => e.id}
          stickyFirstColumn
          empty={
            hasAssets
              ? { title: 'Nenhum provento no período', description: 'Mude o período ou a origem para ver outros eventos.' }
              : {
                  title: 'Sua agenda está vazia',
                  description: 'Adicione ativos ao radar ou registre transações em uma carteira para ver os proventos aqui.',
                  action: (
                    <Button asChild size="sm">
                      <Link href="/radar">Ir para o radar</Link>
                    </Button>
                  ),
                }
          }
        />
      </section>

      <p className="text-xs text-muted-foreground">
        Valores marcados como estimativa são uma estimativa estatística: repetem os meses em que o ativo teve data ex em pelo
        menos 2 dos últimos 3 anos, com o valor mediano do mês. Não são anúncio da empresa nem recomendação de investimento. A
        quantidade considera as transações confirmadas das suas carteiras.
      </p>
    </div>
  )
}
