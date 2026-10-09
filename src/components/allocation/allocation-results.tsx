'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SectionHeader } from '@/components/ui/section-header'
import { formatBRL, formatDate, formatNumber, formatPct } from '@/lib/format'
import { ALLOCATION_DISCLAIMER, ALLOCATION_MODEL_LABEL, MARKET_DISCLAIMER } from '@/lib/allocation/constants'
import type { AllocationResult, AllocationRow, ExcludedRow } from '@/lib/allocation/types'

const TYPE_LABEL: Record<AllocationRow['assetType'], string> = { stock: 'Ação', fii: 'FII', etf: 'ETF', bdr: 'BDR' }

function assetHref(row: Pick<AllocationRow, 'ticker' | 'assetType'>): string {
  const base = row.assetType === 'fii' ? 'fii' : row.assetType === 'etf' ? 'etf' : row.assetType === 'bdr' ? 'bdr' : 'acao'
  return `/${base}/${row.ticker.toLowerCase()}`
}

/** "R$ 1.974,30 distribuídos em 4 ativos · sobra R$ 25,70". */
export function allocationSummary(result: AllocationResult): string {
  const count = result.allocations.length
  return `${formatBRL(result.totalAllocated)} distribuídos em ${formatNumber(count)} ${count === 1 ? 'ativo' : 'ativos'} · sobra ${formatBRL(result.leftover)}`
}

/** Lista em texto para "Copiar lista". */
export function allocationText(result: AllocationResult): string {
  const lines = result.allocations.map((row) => `${row.ticker}: ${formatNumber(row.qty)} × ${formatBRL(row.price)} = ${formatBRL(row.value)}`)
  return [`Distribuição simulada de ${formatBRL(result.amount)}`, ...lines, allocationSummary(result), ALLOCATION_DISCLAIMER].join('\n')
}

function dataDateLabel(iso: string | null): string {
  return iso ? formatDate(`${iso}T12:00:00Z`) : '—'
}

function Assumptions({ result }: { result: AllocationResult }) {
  const a = result.assumptions
  const weights = [
    a.weights.valuation > 0 ? `desconto ${formatPct(a.weights.valuation, { digits: 0 })}` : null,
    a.weights.quality > 0 ? `qualidade ${formatPct(a.weights.quality, { digits: 0 })}` : null,
    a.weights.targetGap > 0 ? `pesos-alvo ${formatPct(a.weights.targetGap, { digits: 0 })}` : null,
  ].filter(Boolean)
  const caps = [
    `até ${formatPct(a.caps.maxPerAssetPct, { digits: 0 })} do aporte por ativo`,
    a.caps.maxPortfolioPct !== null ? `até ${formatPct(a.caps.maxPortfolioPct, { digits: 0 })} da carteira por ativo` : null,
    a.caps.sectorMaxAssets ? `até ${a.caps.sectorMaxAssets} por setor e ${formatPct(a.caps.sectorMaxPct ?? 0, { digits: 0 })} do aporte` : null,
  ].filter(Boolean)
  return (
    <dl className="grid gap-x-6 gap-y-2 text-xs text-muted-foreground sm:grid-cols-2">
      <div>
        <dt className="inline font-medium text-foreground">Modelos: </dt>
        <dd className="inline">{a.models.map((m) => ALLOCATION_MODEL_LABEL[m]).join(', ')}</dd>
      </div>
      <div>
        <dt className="inline font-medium text-foreground">Pesos da prioridade: </dt>
        <dd className="inline">{weights.join(', ')}</dd>
      </div>
      <div>
        <dt className="inline font-medium text-foreground">Limites: </dt>
        <dd className="inline">
          {caps.join('; ')}
          {a.respectTargets ? '; sem passar do peso-alvo' : ''}
        </dd>
      </div>
      <div>
        <dt className="inline font-medium text-foreground">Quantidades: </dt>
        <dd className="inline">{a.allowFractional ? 'mercado fracionário (a partir de 1 ação)' : 'lotes de 100 ações'}</dd>
      </div>
      <div>
        <dt className="inline font-medium text-foreground">Dados: </dt>
        <dd className="inline tabular-nums">cotações de {dataDateLabel(a.dataDate)}; nota de qualidade mínima {a.minQualityScore}</dd>
      </div>
      <div>
        <dt className="inline font-medium text-foreground">Premissas macro: </dt>
        <dd className="inline tabular-nums">
          Selic {formatPct(a.macro.selic)}, custo de capital (Ke) {formatPct(a.macro.ke)}
        </dd>
      </div>
    </dl>
  )
}

function Reasons({ reasons }: { reasons: string[] }) {
  return (
    <ul className="space-y-0.5 text-xs leading-5 text-muted-foreground">
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  )
}

const COLUMNS: DataTableColumn<AllocationRow>[] = [
  {
    key: 'ticker',
    header: 'Ativo',
    sticky: true,
    cell: (row) => (
      <div className="min-w-0">
        <Link href={assetHref(row)} className="font-medium text-foreground underline-offset-4 hover:text-brand hover:underline">
          {row.ticker}
        </Link>
        <p className="max-w-40 truncate text-xs text-muted-foreground">{row.name}</p>
      </div>
    ),
  },
  { key: 'qty', header: 'Qtd', align: 'right', cell: (row) => formatNumber(row.qty) },
  { key: 'price', header: 'Preço', align: 'right', cell: (row) => formatBRL(row.price) },
  { key: 'value', header: 'Valor', align: 'right', cell: (row) => <span className="font-medium">{formatBRL(row.value)}</span> },
  { key: 'pctOfAmount', header: '% do aporte', align: 'right', cell: (row) => formatPct(row.pctOfAmount) },
  { key: 'reasons', header: 'Por quê', className: 'min-w-72 whitespace-normal py-2', cell: (row) => <Reasons reasons={row.reasons} /> },
]

/** No "Todo o mercado" a lista pode ter centenas de ativos: mostra os primeiros e libera o resto sob demanda. */
const EXCLUDED_SHOWN = 30

function ExcludedList({ rows }: { rows: ExcludedRow[] }) {
  const [showAll, setShowAll] = useState(false)
  if (rows.length === 0) return null
  const visible = showAll ? rows : rows.slice(0, EXCLUDED_SHOWN)
  return (
    <Collapsible className="rounded-lg border border-border bg-card">
      <CollapsibleTrigger className="min-h-11 px-4 py-3 hover:no-underline">
        <span>Ficaram de fora ({formatNumber(rows.length)})</span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform" strokeWidth={1.75} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y divide-border border-t border-border">
          {visible.map((row) => (
            <li key={row.ticker} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
              <span className="w-24 shrink-0 text-sm font-medium text-foreground">{row.ticker}</span>
              <Reasons reasons={row.reasons} />
            </li>
          ))}
        </ul>
        {visible.length < rows.length && (
          <div className="border-t border-border px-4 py-3">
            <Button variant="outline" onClick={() => setShowAll(true)}>
              Mostrar todos ({formatNumber(rows.length)})
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

interface AllocationResultsProps {
  result: AllocationResult
  mode: 'list' | 'market'
  universeLabel: string
  actions: React.ReactNode
  extra?: React.ReactNode
}

/** Resultado: resumo, tabela (empilhada no mobile), quem ficou de fora, premissas e aviso. */
export function AllocationResults({ result, mode, universeLabel, actions, extra }: AllocationResultsProps) {
  const disclaimer = mode === 'market' ? MARKET_DISCLAIMER : ALLOCATION_DISCLAIMER
  return (
    <section aria-labelledby="resultado-titulo" className="space-y-4">
      <SectionHeader
        id="resultado-titulo"
        title={mode === 'market' ? 'Ranking do mercado e distribuição simulada' : 'Distribuição simulada'}
        description={
          <span className="tabular-nums">
            {allocationSummary(result)} · {universeLabel}
          </span>
        }
      />
      <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs leading-5 text-muted-foreground">{disclaimer}</p>

      {result.allocations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Nenhum ativo passou nos critérios escolhidos</p>
          <p className="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">
            Veja abaixo o motivo de cada um. Inclua mais ativos, escolha outros modelos ou use{' '}
            {mode === 'market' ? 'filtros menos restritivos' : 'o modo “Todo o mercado”'} para ampliar o universo.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable columns={COLUMNS} rows={result.allocations} getRowId={(row) => row.ticker} caption="Distribuição simulada do aporte" />
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card md:hidden" aria-label="Distribuição simulada do aporte">
            {result.allocations.map((row) => (
              <li key={row.ticker} className="space-y-2 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={assetHref(row)} className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
                      {row.ticker}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">{TYPE_LABEL[row.assetType]}</span>
                  </div>
                  <span className="text-base font-semibold tabular-nums text-foreground">{formatBRL(row.value)}</span>
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {formatNumber(row.qty)} × {formatBRL(row.price)} · {formatPct(row.pctOfAmount)} do aporte
                </p>
                <Reasons reasons={row.reasons} />
              </li>
            ))}
          </ul>
        </>
      )}

      {result.allocations.length > 0 && result.leftover >= result.amount * 0.05 && (
        <p className="text-xs text-muted-foreground">
          A sobra de {formatBRL(result.leftover)} vem dos limites por ativo (até {formatPct(result.assumptions.caps.maxPerAssetPct, { digits: 0 })} do
          aporte{result.assumptions.respectTargets ? ' e sem passar do peso-alvo' : ''}) e do preço de cada ação. Inclua mais ativos ou ajuste os limites.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{actions}</div>

      {extra}

      <ExcludedList rows={result.excluded} />

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-xs font-medium text-foreground">Premissas desta simulação</p>
        <Assumptions result={result} />
        <p className="text-xs text-muted-foreground">
          <Link href="/metodologia#onde-aportar" className="text-brand underline-offset-4 hover:underline">
            Como a distribuição é calculada
          </Link>
        </p>
      </div>
    </section>
  )
}
