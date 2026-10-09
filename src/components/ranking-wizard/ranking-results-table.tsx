'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { CompanyLogo } from '@/components/company-logo'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { QuickBacktestButton } from '@/components/backtest/quick-backtest-button'
import { formatBRL, formatNumber, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { RankingModel } from '@/lib/ranking-models'
import type { RankingRow } from './ranking-data'
import { useCompactTable } from './use-compact-table'

interface RankingResultsTableProps {
  model: RankingModel | undefined
  rows: RankingRow[]
  loading: boolean
  empty: { title: string; description: string; action?: React.ReactNode }
}

function marginTone(value: number | null): string {
  if (value === null) return 'text-muted-foreground'
  return value > 0 ? 'text-positive' : value < 0 ? 'text-negative' : 'text-foreground'
}

export function RankingResultsTable({ model, rows, loading, empty }: RankingResultsTableProps) {
  const compact = useCompactTable()
  const fairValueLabel = model?.fairValueLabel ?? 'Preço justo'
  const score = model?.score

  const columns: DataTableColumn<RankingRow>[] = [
    {
      key: 'ticker',
      header: compact ? 'Ativo' : 'Ticker',
      sticky: true,
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{row.position}</span>
          <Link
            href={row.href}
            prefetch={false}
            onClick={(event) => event.stopPropagation()}
            className="flex min-h-11 min-w-0 flex-col justify-center text-foreground underline-offset-4 hover:underline md:min-h-0"
          >
            <span className="font-medium">{row.ticker}</span>
            {compact && <span className="block max-w-24 truncate text-xs text-muted-foreground">{row.name}</span>}
          </Link>
        </span>
      ),
    },
    ...(compact
      ? []
      : [
          {
            key: 'name',
            header: 'Empresa',
            cell: (row: RankingRow) => (
              <span className="flex max-w-[16rem] items-center gap-2">
                <CompanyLogo logoUrl={row.logoUrl} companyName={row.name} ticker={row.ticker} size={24} className="shrink-0" />
                <span className="truncate text-muted-foreground">{row.name}</span>
              </span>
            ),
          },
        ]),
    {
      key: 'price',
      header: 'Preço',
      align: 'right',
      sortable: true,
      cell: (row) => formatBRL(row.price),
    },
    {
      key: 'fairValue',
      header: fairValueLabel,
      align: 'right',
      sortable: true,
      hint: model?.fairValueKey
        ? 'Preço máximo pelo dividend yield alvo do modelo.'
        : 'Estimativa do modelo. Quando o modelo não calcula preço justo, usamos o de outro modelo (indicado abaixo do valor).',
      cell: (row) => (
        <span className="inline-flex flex-col items-end leading-tight">
          <span>{formatBRL(row.fairValue)}</span>
          {row.fairValueSource && row.fairValue !== null && (
            <span className="text-xs text-muted-foreground">{row.fairValueSource}</span>
          )}
        </span>
      ),
    },
    {
      key: 'margin',
      header: 'Margem de segurança',
      align: 'right',
      sortable: true,
      hint: 'Margem de segurança = 1 − preço ÷ preço justo. Positiva quando o preço está abaixo do preço justo.',
      cell: (row) => <span className={cn('font-medium', marginTone(row.margin))}>{formatPct(row.margin)}</span>,
    },
  ]

  if (score) {
    columns.push({
      key: 'score',
      header: score.label,
      align: 'right',
      sortable: true,
      hint: score.format === 'score' ? 'Pontuação do modelo, de 0 a 100.' : undefined,
      cell: (row) => (score.format === 'pct' ? formatPct(row.score) : formatNumber(row.score, { digits: 0 })),
    })
  }

  return (
    // Contêiner de consulta: os detalhes da linha expandida usam a largura visível da tabela (100cqw), não a da tabela rolável.
    <div className="@container">
      <DataTable
        caption={model ? `Resultado do ranking ${model.label}` : 'Resultado do ranking'}
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        stickyFirstColumn
        loading={loading}
        loadingRows={8}
        empty={empty}
        renderExpanded={(row) => <RankingRowDetails row={row} isStock={model?.assetType !== 'fii'} />}
      />
    </div>
  )
}

function RankingRowDetails({ row, isStock }: { row: RankingRow; isStock: boolean }) {
  return (
    // Fica presa à borda esquerda da área visível e com a largura dela (menos a borda e o padding da célula),
    // para o texto e as ações não sumirem à direita quando a tabela rola na horizontal no mobile.
    <div className="sticky left-3 w-[calc(100cqw-1.625rem)]">
      <div className="max-w-3xl space-y-4">
        {row.sector && <p className="text-xs text-muted-foreground">{row.sector}</p>}
        {row.metrics.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
            {row.metrics.map((metric) => (
              <div key={metric.key} className="min-w-0">
                <dt className="truncate text-xs text-muted-foreground">{metric.label}</dt>
                <dd className="text-sm font-medium tabular-nums text-foreground">{metric.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {row.rationale && <MarkdownRenderer content={row.rationale} className="text-sm text-muted-foreground" />}
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href={row.href} prefetch={false}>
              Ver análise de {row.ticker}
            </Link>
          </Button>
          {isStock && (
            <QuickBacktestButton
              request={{ tickers: [row.ticker], source: 'ranking', sourceLabel: row.ticker }}
              label={`Backtest de ${row.ticker}`}
            />
          )}
        </div>
      </div>
    </div>
  )
}
