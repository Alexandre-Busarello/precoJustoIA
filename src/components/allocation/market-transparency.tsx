'use client'

import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SectionHeader } from '@/components/ui/section-header'
import { formatBRLCompact, formatNumber, formatPct } from '@/lib/format'
import type { CandidateRow, CandidateStatus, FunnelStep } from '@/lib/allocation/types'

const STATUS: Record<CandidateStatus, { label: string; variant: 'brand' | 'neutral' | 'warning' }> = {
  selected: { label: 'Na distribuição', variant: 'brand' },
  'sector-limit': { label: 'Limite do setor', variant: 'neutral' },
  'lower-priority': { label: 'Prioridade menor', variant: 'neutral' },
  'no-shares': { label: 'Sem unidade', variant: 'warning' },
}

/** "412 ativos avaliados → 188 com liquidez → … → 41 abaixo do valor estimado". */
export function FunnelLine({ steps }: { steps: FunnelStep[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground" aria-label="Ativos em cada etapa dos filtros">
      {steps.map((step, index) => (
        <li key={step.label} className="inline-flex items-center gap-1.5">
          {index > 0 && <span aria-hidden="true">→</span>}
          <span>
            <span className="font-medium tabular-nums text-foreground">{formatNumber(step.count)}</span> {step.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

const COLUMNS: DataTableColumn<CandidateRow>[] = [
  {
    key: 'ticker',
    header: 'Ativo',
    sticky: true,
    cell: (row) => (
      <span className="flex items-baseline gap-2">
        <span className="w-5 text-right text-xs tabular-nums text-muted-foreground">{row.rank}</span>
        <span className="font-medium text-foreground">{row.ticker}</span>
      </span>
    ),
  },
  { key: 'sector', header: 'Setor', cell: (row) => <span className="text-muted-foreground">{row.sector ?? '—'}</span> },
  { key: 'discount', header: 'Margem mediana', align: 'right', cell: (row) => formatPct(row.components.discount) },
  {
    key: 'quality',
    header: 'Qualidade',
    align: 'right',
    cell: (row) => formatNumber(row.components.qualityScore, { digits: 0 }),
  },
  { key: 'liquidity', header: 'Liquidez/dia', align: 'right', cell: (row) => formatBRLCompact(row.components.liquidity) },
  {
    key: 'priority',
    header: 'Prioridade',
    align: 'right',
    cell: (row) => <span className="font-medium">{formatNumber(row.components.priority * 100, { digits: 0 })}</span>,
  },
  {
    key: 'status',
    header: 'Situação',
    className: 'min-w-64 whitespace-normal py-2',
    cell: (row) => (
      <div className="space-y-1">
        <Badge variant={STATUS[row.status].variant}>{STATUS[row.status].label}</Badge>
        {row.status !== 'selected' && <p className="text-xs leading-5 text-muted-foreground">{row.note}</p>}
      </div>
    ),
  },
]

/** Transparência do modo "Todo o mercado": contagem por etapa e os 20 primeiros candidatos com os componentes. */
export function MarketTransparency({ funnel, candidates }: { funnel: FunnelStep[]; candidates: CandidateRow[] }) {
  return (
    <section aria-labelledby="candidatos-titulo" className="space-y-3">
      <SectionHeader
        id="candidatos-titulo"
        as="h3"
        title="Candidatos avaliados"
        description="Os 20 primeiros do ranking pelos seus critérios, com os componentes da prioridade e o motivo de quem não entrou."
      />
      <FunnelLine steps={funnel} />
      <DataTable
        columns={COLUMNS}
        rows={candidates}
        getRowId={(row) => row.ticker}
        stickyFirstColumn
        dense
        caption="Candidatos avaliados no modo Todo o mercado"
        empty={{ title: 'Nenhum candidato passou nos filtros', description: 'Inclua mais tipos de ativo ou reduza as exclusões.' }}
      />
    </section>
  )
}
