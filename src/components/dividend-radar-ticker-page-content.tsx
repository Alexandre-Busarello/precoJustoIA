'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { DividendRadarGrid } from '@/components/dividend-radar-grid'
import { useDividendRadarProjections } from '@/hooks/use-dividend-radar'
import { formatBRL, formatPct } from '@/lib/format'
import { AssetPriceHeader } from '@/app/acao/[ticker]/analise-tecnica/asset-price-header'
import {
  flattenEvents,
  formatDateOnly,
  nextExDateEvent,
  perShareDigits,
  trailingTwelveMonthsTotal,
  type DividendEvent,
} from '@/app/radar-dividendos/dividend-months'

interface DividendRadarTickerCompany {
  ticker: string
  name: string
  sector: string | null
  logoUrl: string | null
  assetType: string
}

interface DividendRadarTickerPageContentProps {
  company: DividendRadarTickerCompany
  price: number | null
  /** Variação do dia como fração. */
  dayChange: number | null
}

function assetPath(company: DividendRadarTickerCompany): string {
  const ticker = company.ticker.toLowerCase()
  if (company.assetType === 'FII') return `/fii/${ticker}`
  if (company.assetType === 'ETF') return `/etf/${ticker}`
  if (company.assetType === 'BDR') return `/bdr/${ticker}`
  return `/acao/${ticker}`
}

function formatPerShare(amount: number | null): string {
  return amount === null ? '—' : formatBRL(amount, { digits: perShareDigits(amount) })
}

type EventRow = DividendEvent & { id: string }

/** Página do ativo no radar de dividendos: cabeçalho de preço/proventos, calendário e tabela de eventos. */
export function DividendRadarTickerPageContent({ company, price, dayChange }: DividendRadarTickerPageContentProps) {
  const { data, isLoading, error, refetch } = useDividendRadarProjections(company.ticker)

  const projections = useMemo(() => data?.projections ?? [], [data?.projections])
  const recentHistory = useMemo(() => data?.historicalDividends ?? [], [data?.historicalDividends])
  const allHistory = useMemo(() => data?.allHistoricalDividends ?? [], [data?.allHistoricalDividends])

  const events = useMemo<EventRow[]>(
    () => flattenEvents(allHistory, projections).map((event, index) => ({ ...event, id: `${event.kind}-${event.exDate}-${index}` })),
    [allHistory, projections]
  )
  const total12m = useMemo(() => trailingTwelveMonthsTotal(allHistory), [allHistory])
  const next = useMemo(() => nextExDateEvent(allHistory, projections), [allHistory, projections])
  const confirmedCount = events.filter((e) => e.kind === 'confirmed').length
  const projectedCount = events.length - confirmedCount
  const yield12m = total12m !== null && price ? total12m / price : null
  const hasPayment = events.some((e) => e.paymentDate)
  const hasType = events.some((e) => e.type)

  const columns: DataTableColumn<EventRow>[] = [
    {
      key: 'exDate',
      header: 'Data ex',
      sortable: true,
      cell: (row) => <span className="tabular-nums text-foreground">{formatDateOnly(row.exDate)}</span>,
    },
    {
      key: 'amount',
      header: 'Valor por ação',
      align: 'right',
      sortable: true,
      cell: (row) => formatPerShare(row.amount),
    },
    {
      key: 'kind',
      header: 'Situação',
      hint: 'Confirmado: provento anunciado pela empresa. Projetado: data e valor estimados por IA a partir do histórico.',
      cell: (row) =>
        row.kind === 'confirmed' ? (
          <Badge variant="brand">Confirmado</Badge>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Badge variant="neutral">Projetado</Badge>
            {row.confidence !== null && (
              <span className="text-xs text-muted-foreground">{formatPct(row.confidence / 100, { digits: 0 })}</span>
            )}
          </span>
        ),
    },
  ]
  if (hasPayment) {
    columns.splice(1, 0, {
      key: 'paymentDate',
      header: 'Pagamento',
      sortable: true,
      cell: (row) => <span className="tabular-nums">{row.paymentDate ? formatDateOnly(row.paymentDate) : '—'}</span>,
    })
  }
  if (hasType) {
    columns.push({ key: 'type', header: 'Tipo', cell: (row) => row.type ?? '—' })
  }

  const hasData = projections.length > 0 || allHistory.length > 0

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pt-4 pb-12">
      <AssetPriceHeader
        ticker={company.ticker}
        name={company.name}
        pageLabel="Radar de dividendos"
        subtitle={company.sector ? `${company.name} · ${company.sector}` : company.name}
        logoUrl={company.logoUrl}
        back={{ href: '/radar-dividendos', label: 'Voltar ao radar' }}
        stats={[
          { label: 'Preço', value: formatBRL(price), delta: dayChange, deltaLabel: 'hoje' },
          {
            label: 'Proventos 12 meses',
            value: formatPerShare(total12m),
            caption: 'por ação, bruto',
          },
          {
            label: 'Dividend yield 12 meses',
            value: formatPct(yield12m),
            hint: 'Soma dos proventos com data ex nos últimos 12 meses dividida pelo preço atual.',
          },
          {
            label: 'Próxima data ex',
            value: next ? formatDateOnly(next.exDate) : '—',
            caption: next ? `${next.kind === 'confirmed' ? 'anunciada' : 'estimada'} · ${formatPerShare(next.amount)}` : undefined,
          },
        ]}
      />

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar os proventos.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : !isLoading && !hasData ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {company.ticker} não tem histórico de proventos nem projeções no momento.
          </p>
        </div>
      ) : (
        <>
          <section aria-labelledby="calendario" className="space-y-3">
            <SectionHeader
              id="calendario"
              title="Calendário"
              description="Últimos 4 meses, mês atual e próximos 7 meses."
            />
            <DividendRadarGrid
              companies={[
                {
                  ticker: company.ticker,
                  name: company.name,
                  sector: company.sector,
                  logoUrl: company.logoUrl,
                  projections,
                  historicalDividends: recentHistory,
                },
              ]}
              loading={isLoading}
              showCompanyLinks={false}
            />
          </section>

          <section aria-labelledby="eventos" className="space-y-3">
            <SectionHeader
              id="eventos"
              title="Proventos"
              description={
                isLoading
                  ? 'Carregando histórico'
                  : `${confirmedCount} ${confirmedCount === 1 ? 'confirmado' : 'confirmados'} e ${projectedCount} ${
                      projectedCount === 1 ? 'projetado' : 'projetados'
                    }`
              }
            />
            <DataTable
              columns={columns}
              rows={events}
              getRowId={(row) => row.id}
              loading={isLoading}
              stickyFirstColumn
              maxHeight={480}
              defaultSort={{ key: 'exDate', direction: 'desc' }}
              caption={`Proventos de ${company.ticker}`}
              empty={{ title: 'Nenhum provento encontrado' }}
            />
          </section>
        </>
      )}

      <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>
            Projeções são estimativas geradas por IA a partir do histórico e podem mudar ou não se confirmar. Confira os
            comunicados oficiais da empresa. Não é recomendação de investimento.
          </span>
        </p>
        <Button asChild variant="outline" className="shrink-0">
          <Link href={assetPath(company)}>Ver análise de {company.ticker}</Link>
        </Button>
      </div>
    </div>
  )
}
