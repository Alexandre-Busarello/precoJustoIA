'use client'

import Link from 'next/link'
import { Check, Lock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBRL, formatDeltaPct, formatPct } from '@/lib/format'
import { marginOfSafety, upside, valuationStatus } from '@/lib/valuation-metrics'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Stat } from '@/components/ui/stat'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import {
  adjustedScore,
  criteriaCount,
  DIVIDEND_MODEL_KEYS,
  getAvailableModels,
  isModelLocked,
  localizeStrategyText,
  modelStatus,
  type ModelStatusTone,
  type StrategiesMap,
  type StrategyResult,
  type ValuationModel,
  type ViewerAccess,
} from '@/components/asset/valuation-models'

interface ValuationRow {
  model: ValuationModel
  strategy: StrategyResult
  locked: boolean
  fairValue: number | null
  margin: number | null
  status: ReturnType<typeof modelStatus>
}

export interface ValuationTableProps {
  price: number | null
  strategies: StrategiesMap | null | undefined
  access: ViewerAccess
  isFinancial?: boolean
  /** Empresa com lucro e payout baixo: modelos de dividendos não se aplicam. */
  reinvestment?: { payout: number | null } | null
  loading?: boolean
}

const DOT_TONE: Record<ModelStatusTone, string> = {
  positive: 'bg-positive',
  warning: 'bg-warning',
  negative: 'bg-negative',
  neutral: 'bg-muted-foreground/40',
}

const MARGIN_TONE = { below: 'text-positive', within: 'text-foreground', above: 'text-negative' } as const

function BlurredValue({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="select-none text-muted-foreground blur-sm">
      {children}
    </span>
  )
}

/** Ponto de 8 px + rótulo; abaixo de sm mostra o rótulo curto ("Abaixo", "Em parte") e mantém o completo para leitores de tela. */
function StatusCell({ status }: { status: ValuationRow['status'] }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', DOT_TONE[status.tone])} />
      <span aria-hidden="true" className="text-xs text-foreground sm:hidden">
        {status.shortLabel}
      </span>
      <span className="sr-only text-foreground sm:not-sr-only sm:whitespace-nowrap">{status.label}</span>
    </span>
  )
}

/** "payout de 18%" ou, sem payout informado/zero, "sem dividendos". */
export function payoutPhrase(payout: number | null | undefined): string {
  return typeof payout === 'number' && Number.isFinite(payout) && payout > 0
    ? `payout de ${formatPct(payout, { digits: 0 })}`
    : 'sem dividendos'
}

function ModelNotes({ row, reinvestment }: { row: ValuationRow; reinvestment: ValuationTableProps['reinvestment'] }) {
  const adjusted = adjustedScore(row.strategy)
  const notes: string[] = []
  if (adjusted) {
    notes.push(
      `A empresa atendeu ${formatPct(adjusted.criteriaPct / 100, { digits: 0 })} dos critérios, mas o score do modelo foi reduzido para ${Math.round(adjusted.score)} porque a margem de segurança é insuficiente.`
    )
  }
  if (reinvestment && DIVIDEND_MODEL_KEYS.has(row.model.key)) {
    notes.push(
      `A empresa reinveste a maior parte do lucro (${payoutPhrase(reinvestment.payout)}). Modelos de dividendos têm alcance limitado aqui e não penalizam o score geral.`
    )
  }
  if (notes.length === 0) return null
  return (
    <ul className="space-y-1 text-sm text-muted-foreground">
      {notes.map((note) => (
        <li key={note} className="border-l-2 border-warning pl-3">
          {note}
        </li>
      ))}
    </ul>
  )
}

function ExpandedRow({
  row,
  price,
  reinvestment,
}: {
  row: ValuationRow
  price: number | null
  reinvestment: ValuationTableProps['reinvestment']
}) {
  const { model, strategy, locked } = row
  const potential = upside(price, row.fairValue)

  return (
    // Fica preso à esquerda e limitado à largura da tela quando a tabela rola na horizontal (mobile).
    <div className="sticky left-3 max-w-[calc(100vw-3.5rem)] space-y-4 whitespace-normal md:max-w-none">
      <p className="text-sm text-muted-foreground">{model.description}</p>

      {locked ? (
        <p className="flex items-center gap-1.5 text-sm text-foreground">
          <Lock className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          {model.plan === 'free'
            ? 'Preço justo, margem e critérios deste modelo ficam disponíveis com uma conta grátis.'
            : 'Preço justo, margem e critérios deste modelo estão disponíveis no Premium.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat size="sm" label="Preço justo" value={formatBRL(row.fairValue)} />
            <Stat
              size="sm"
              label="Potencial"
              value={formatDeltaPct(potential)}
              tone={potential === null ? 'default' : potential > 0 ? 'positive' : potential < 0 ? 'negative' : 'default'}
              hint="Quanto o preço atual precisaria subir (ou cair) para chegar ao preço justo: preço justo ÷ preço − 1."
            />
            <Stat
              size="sm"
              label="Score do modelo"
              value={`${Math.round(strategy.score)}/100`}
              className="col-span-2 sm:col-span-1"
            />
          </div>

          <ModelNotes row={row} reinvestment={reinvestment} />

          {strategy.reasoning && (
            <MarkdownRenderer
              content={localizeStrategyText(strategy.reasoning)}
              className="prose-sm max-w-none text-foreground dark:prose-invert"
            />
          )}

          {strategy.criteria.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-foreground">Critérios avaliados</h4>
              <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-card">
                {strategy.criteria.map((criterion) => (
                  <li key={criterion.label} className="flex flex-col gap-0.5 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <span className="flex items-start gap-2 text-foreground">
                      {criterion.value ? (
                        <Check className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={1.75} aria-label="Atendido" />
                      ) : (
                        <X className="mt-0.5 size-4 shrink-0 text-negative" strokeWidth={1.75} aria-label="Não atendido" />
                      )}
                      {localizeStrategyText(criterion.label)}
                    </span>
                    {criterion.description && (
                      <span className="pl-6 text-xs text-muted-foreground tabular-nums sm:pl-0 sm:text-right">
                        {localizeStrategyText(criterion.description)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Tabela de valuation: uma linha por modelo do registro presente em `strategies`.
 * Modelos bloqueados continuam visíveis com valores borrados e um único CTA no rodapé.
 */
export function ValuationTable({ price, strategies, access, isFinancial = false, reinvestment, loading = false }: ValuationTableProps) {
  const rows: ValuationRow[] = getAvailableModels(strategies, isFinancial).map((model) => {
    const strategy = strategies![model.key] as StrategyResult
    const locked = isModelLocked(model, access)
    const fairValue = !locked && typeof strategy.fairValue === 'number' && strategy.fairValue > 0 ? strategy.fairValue : null
    return {
      model,
      strategy,
      locked,
      fairValue,
      margin: marginOfSafety(price, fairValue),
      status: modelStatus(strategy, price),
    }
  })
  const lockedCount = rows.filter((row) => row.locked).length

  const columns: DataTableColumn<ValuationRow>[] = [
    {
      key: 'model',
      header: 'Modelo',
      sticky: true,
      cell: (row) => (
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <span className="whitespace-nowrap sm:hidden">{row.model.shortLabel}</span>
          <span className="hidden whitespace-nowrap sm:inline">{row.model.label}</span>
          {row.locked && (
            <>
              <Lock className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only">{row.model.plan === 'free' ? '(requer conta grátis)' : '(Premium)'}</span>
            </>
          )}
        </span>
      ),
    },
    {
      key: 'fairValue',
      header: 'Preço justo',
      align: 'right',
      cell: (row) => (row.locked ? <BlurredValue>R$ 00,00</BlurredValue> : <span className="font-medium">{formatBRL(row.fairValue)}</span>),
    },
    {
      key: 'margin',
      header: (
        <>
          <span className="sm:hidden">Margem</span>
          <span className="hidden sm:inline">Margem de segurança</span>
        </>
      ),
      align: 'right',
      hint: 'Quanto o preço atual está abaixo (positivo) ou acima (negativo) do preço justo: 1 − preço ÷ preço justo.',
      cell: (row) => {
        if (row.locked) return <BlurredValue>+00,0%</BlurredValue>
        const status = valuationStatus(row.margin)
        return <span className={cn('font-medium', status && MARGIN_TONE[status])}>{formatDeltaPct(row.margin)}</span>
      },
    },
    {
      key: 'criteria',
      header: 'Critérios',
      align: 'right',
      cell: (row) => {
        if (row.locked) return <BlurredValue>0/0</BlurredValue>
        const count = criteriaCount(row.strategy)
        return count ? `${count.passed}/${count.total}` : '—'
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) =>
        row.locked ? (
          <span className="whitespace-nowrap text-muted-foreground">
            <span className="sm:hidden">{row.model.plan === 'free' ? 'Conta grátis' : 'Premium'}</span>
            <span className="hidden sm:inline">
              {row.model.plan === 'free' ? 'Disponível com conta grátis' : 'Disponível no Premium'}
            </span>
          </span>
        ) : (
          <StatusCell status={row.status} />
        ),
    },
  ]

  const cta = access.isLoggedIn
    ? { label: 'Desbloquear modelos Premium', href: '/checkout' }
    : { label: 'Desbloquear com 1 dia grátis', href: '/register' }

  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        loadingRows={8}
        getRowId={(row) => row.model.key}
        renderExpanded={(row) => <ExpandedRow row={row} price={price} reinvestment={reinvestment} />}
        caption="Preço justo, margem de segurança e critérios por modelo de valuation"
        empty={{
          title: 'Sem estimativas para esta empresa',
          description: 'Os dados financeiros disponíveis não permitem calcular os modelos de valuation.',
        }}
      />

      {!loading && lockedCount > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {!access.isLoggedIn
              ? 'Crie uma conta grátis para ver o Número de Graham e usar todos os modelos por 1 dia.'
              : lockedCount === 1
                ? 'Um modelo está disponível só no Premium.'
                : `${lockedCount} modelos estão disponíveis só no Premium.`}
          </p>
          <Button asChild size="sm" className="shrink-0">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Estimativas de modelos quantitativos com dados públicos; não constituem recomendação de investimento.{' '}
        <Link href="/metodologia" className="font-medium text-brand underline-offset-4 hover:underline">
          Ver metodologia
        </Link>
      </p>
    </div>
  )
}
