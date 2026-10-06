'use client'

import Link from 'next/link'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { CompanyLogo } from '@/components/company-logo'
import { formatDeltaPct, formatNumber, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { EtfRow } from '@/components/ranking-wizard/ranking-data'
import { useCompactTable } from '@/components/ranking-wizard/use-compact-table'

interface EtfRankerProps {
  rows: EtfRow[]
  loading: boolean
  /** Plano gratuito recebe só os 10 primeiros. */
  isLimited: boolean
  isLoggedIn: boolean
}

function returnTone(value: number | null): string {
  if (value === null) return 'text-muted-foreground'
  return value > 0 ? 'text-positive' : value < 0 ? 'text-negative' : 'text-foreground'
}

/** Limite do plano gratuito em `/api/etf-ranking`. */
const FREE_ETF_LIMIT = 10

/** Em telas estreitas (`compact`) o nome vai para baixo do ticker, e os números aparecem sem rolar a tabela. */
function etfColumns(compact: boolean): DataTableColumn<EtfRow>[] {
  const ticker: DataTableColumn<EtfRow> = {
    key: 'ticker',
    header: compact ? 'ETF' : 'Ticker',
    sticky: true,
    cell: (row) => (
      <span className="flex items-center gap-2">
        <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{row.position}</span>
        <Link
          href={row.href}
          prefetch={false}
          className="flex min-h-11 min-w-0 flex-col justify-center text-foreground underline-offset-4 hover:underline md:min-h-0"
        >
          <span className="font-medium">{row.ticker}</span>
          {compact && <span className="block max-w-24 truncate text-xs text-muted-foreground">{row.name}</span>}
        </Link>
      </span>
    ),
  }
  const name: DataTableColumn<EtfRow> = {
    key: 'name',
    header: 'Nome',
    cell: (row) => (
      <span className="flex max-w-[18rem] items-center gap-2">
        <CompanyLogo logoUrl={row.logoUrl} companyName={row.name} ticker={row.ticker} size={24} className="shrink-0" />
        <span className="min-w-0">
          <span className="block truncate text-muted-foreground">{row.name}</span>
          {row.benchmark && <span className="block truncate text-xs text-muted-foreground">{row.benchmark}</span>}
        </span>
      </span>
    ),
  }
  return compact ? [ticker, ...VALUE_COLUMNS] : [ticker, name, ...VALUE_COLUMNS]
}

const VALUE_COLUMNS: DataTableColumn<EtfRow>[] = [
  {
    key: 'score',
    header: 'Score',
    align: 'right',
    sortable: true,
    hint: 'Score PJ-ETF, de 0 a 100: custo, retorno, liquidez, solidez e qualidade da carteira.',
    cell: (row) => formatNumber(row.score, { digits: 0 }),
  },
  {
    key: 'return1y',
    header: 'Retorno 12m',
    align: 'right',
    sortable: true,
    hint: 'Quando falta histórico de 12 meses, o retorno de 6 meses é anualizado e marcado como estimativa.',
    cell: (row) => (
      <span className="inline-flex flex-col items-end leading-tight">
        <span className={cn('font-medium', returnTone(row.return1y))}>{formatDeltaPct(row.return1y)}</span>
        {row.isEstimatedReturn && row.return1y !== null && <span className="text-xs text-muted-foreground">estimativa</span>}
      </span>
    ),
  },
  {
    key: 'expenseRatio',
    header: 'Taxa de adm.',
    align: 'right',
    sortable: true,
    cell: (row) => (row.expenseRatio === null ? formatPct(null) : `${formatPct(row.expenseRatio, { digits: 2 })} a.a.`),
  },
]

/** Tabela dos rankings de ETFs (presets de `/api/etf-ranking`). */
export function EtfRanker({ rows, loading, isLimited, isLoggedIn }: EtfRankerProps) {
  const compact = useCompactTable()
  return (
    <div className="space-y-3">
      <DataTable
        caption="Ranking de ETFs"
        columns={etfColumns(compact)}
        rows={rows}
        getRowId={(row) => row.id}
        stickyFirstColumn
        loading={loading}
        loadingRows={8}
        empty={{ title: 'Nenhum ETF encontrado', description: 'Nenhum ETF atende a este critério no momento.' }}
      />
      {/* Só avisa quando a lista foi de fato cortada no limite do plano gratuito. */}
      {isLimited && !loading && rows.length >= FREE_ETF_LIMIT && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">O plano gratuito mostra os {FREE_ETF_LIMIT} primeiros ETFs. O Premium mostra a lista completa.</p>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={isLoggedIn ? '/planos' : '/register'}>{isLoggedIn ? 'Ver planos' : 'Criar conta grátis'}</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
