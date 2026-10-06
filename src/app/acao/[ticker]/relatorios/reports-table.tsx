'use client'

import Link from 'next/link'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'

export interface ReportsTableRow {
  id: string
  href: string
  /** Data de criação em ISO (ordenável). */
  createdAt: string
  title: string
  typeLabel: string
  /** Variante do selo do tipo: mudanças positivas/negativas usam a cor semântica. */
  tone: 'neutral' | 'positive' | 'negative'
  /** Selo complementar (ex.: janela da variação, perda de fundamentos). */
  extra?: { label: string; variant: 'neutral' | 'warning' | 'negative' }
}

const columns: DataTableColumn<ReportsTableRow>[] = [
  {
    key: 'createdAt',
    header: 'Data',
    sortable: true,
    width: 104,
    className: 'w-[104px] whitespace-nowrap text-muted-foreground tabular-nums',
    cell: (row) => formatDate(row.createdAt),
  },
  {
    key: 'title',
    header: 'Título',
    className: 'min-w-[200px] whitespace-normal py-0 leading-5',
    cell: (row) => (
      <Link
        href={row.href}
        className="block py-3 font-medium text-foreground underline-offset-4 hover:text-brand hover:underline focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
      >
        {row.title}
      </Link>
    ),
  },
  {
    key: 'typeLabel',
    header: 'Tipo',
    sortable: true,
    className: 'whitespace-nowrap',
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1">
        <Badge variant={row.tone}>{row.typeLabel}</Badge>
        {row.extra && <Badge variant={row.extra.variant}>{row.extra.label}</Badge>}
      </span>
    ),
  },
]

/** Lista de relatórios de IA do ativo (data · título · tipo), com a data fixa ao rolar no mobile. */
export function ReportsTable({ rows, emptyDescription }: { rows: ReportsTableRow[]; emptyDescription: string }) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      stickyFirstColumn
      defaultSort={{ key: 'createdAt', direction: 'desc' }}
      caption="Relatórios de IA do ativo"
      empty={{ title: 'Nenhum relatório disponível', description: emptyDescription }}
    />
  )
}
