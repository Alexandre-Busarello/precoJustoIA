'use client'

import Link from 'next/link'
import { Check, Lock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBRL, formatBRLCompact, formatDeltaPct, formatPct } from '@/lib/format'
import { marginOfSafety, upside, valuationStatus } from '@/lib/valuation-metrics'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Stat } from '@/components/ui/stat'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { AskBenButton } from '@/components/ben/ask-ben-button'
import { buildAssetContext } from '@/lib/ben-context/builders'
import { askBenQuestions } from '@/lib/ben-context/questions'
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

/** Campos extras que os modelos de valuation devolvem além de `StrategyResult` (frações; ponte em R$). */
type ValuationStrategy = StrategyResult & {
  /** Desconto vs valor intrínseco (1 − preço ÷ preço justo), em fração. */
  discount?: number | null
  /** Participação do valor terminal no valor estimado (FCD), em fração. */
  terminalValueShare?: number | null
  equityBridge?: { ev: number; netDebt: number; equity: number } | null
}

interface ValuationRow {
  model: ValuationModel
  strategy: ValuationStrategy
  locked: boolean
  /** Modelo que não se aplica à empresa (ex.: FCD para bancos, modelos de preço justo para BDR sem paridade). */
  notApplicable: boolean
  fairValue: number | null
  /** Margem de segurança (desconto) em fração. */
  margin: number | null
  /** Potencial (preço justo ÷ preço − 1) em fração. */
  potential: number | null
  status: ReturnType<typeof modelStatus>
}

/** Subtítulo do modelo na tabela: o número de Graham é um teto conservador, não um valor justo. */
const MODEL_SUBTITLE: Record<string, string> = {
  graham: 'preço máximo defensivo',
}

const NOT_APPLICABLE_STATUS: ValuationRow['status'] = { tone: 'neutral', label: 'Não se aplica', shortLabel: 'Não se aplica' }

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
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

/**
 * Margem de segurança para exibição. Abaixo de −100% (preço acima do dobro do preço justo) o número deixa de informar
 * e vira ruído (ex.: −260%); mostra só o limite.
 */
function formatMargin(margin: number | null): string {
  if (margin !== null && margin < -1) return '< −100%'
  return formatDeltaPct(margin)
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

/** Detalhes próprios de cada modelo: ponte EV → patrimônio no FCD; D0, g e k no Gordon. */
function ModelDetails({ row }: { row: ValuationRow }) {
  const { model, strategy } = row
  const metrics = strategy.key_metrics ?? {}

  if (model.key === 'fcd') {
    const bridge = strategy.equityBridge
    const terminalShare = finiteOrNull(strategy.terminalValueShare)
    if (!bridge && terminalShare === null) return null
    return (
      <div className="space-y-2 rounded-md border border-border bg-surface p-3 text-sm">
        {bridge ? (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Valor da firma (EV)</dt>
              <dd className="font-medium tabular-nums text-foreground">{formatBRLCompact(bridge.ev)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{bridge.netDebt < 0 ? 'Caixa líquido' : 'Dívida líquida'}</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {bridge.netDebt < 0 ? `+ ${formatBRLCompact(-bridge.netDebt)}` : `− ${formatBRLCompact(bridge.netDebt)}`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Valor para o acionista</dt>
              <dd className="font-medium tabular-nums text-foreground">{formatBRLCompact(bridge.equity)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted-foreground">
            Fluxo de caixa ao acionista descontado pelo custo de capital próprio: o resultado já é o valor para o acionista.
          </p>
        )}
        {terminalShare !== null && (
          <p className="text-muted-foreground">
            Valor terminal: <span className="font-medium tabular-nums text-foreground">{formatPct(terminalShare, { digits: 0 })}</span> do
            total
          </p>
        )}
      </div>
    )
  }

  if (model.key === 'gordon') {
    const d0 = finiteOrNull(metrics.d0)
    const g = finiteOrNull(metrics.growthRate)
    const k = finiteOrNull(metrics.costOfEquity)
    if (d0 === null && g === null && k === null) return null
    return (
      <div className="grid grid-cols-3 gap-4 rounded-md border border-border bg-surface p-3">
        <Stat size="sm" label="D0" value={formatBRL(d0)} hint="Proventos por ação com data-com nos últimos 12 meses, sem pagamentos extraordinários." />
        <Stat size="sm" label="g" value={formatPct(g)} hint="Crescimento perpétuo dos dividendos: o menor entre o teto do modelo, ROE × (1 − payout) e 6%." />
        <Stat size="sm" label="k" value={formatPct(k)} hint="Custo de capital próprio: juro real longo + inflação + prêmio de risco, nunca abaixo da Selic." />
      </div>
    )
  }

  return null
}

function ExpandedRow({
  row,
  reinvestment,
  price,
}: {
  row: ValuationRow
  reinvestment: ValuationTableProps['reinvestment']
  price: number | null
}) {
  const { model, strategy, locked, notApplicable } = row
  const subtitle = MODEL_SUBTITLE[model.key]

  return (
    // Fica preso à esquerda e limitado à largura da tela quando a tabela rola na horizontal (mobile).
    <div className="sticky left-3 max-w-[calc(100vw-3.5rem)] space-y-4 whitespace-normal md:max-w-none">
      <p className="text-sm text-muted-foreground">
        {subtitle && (
          <span className="font-medium text-foreground">
            {model.label} ({subtitle}).{' '}
          </span>
        )}
        {model.description}
      </p>

      {locked ? (
        <p className="flex items-center gap-1.5 text-sm text-foreground">
          <Lock className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          {model.plan === 'free'
            ? 'Preço justo, margem e critérios deste modelo ficam disponíveis com uma conta grátis.'
            : 'Preço justo, margem e critérios deste modelo estão disponíveis no Premium.'}
        </p>
      ) : notApplicable ? (
        strategy.reasoning && <p className="border-l-2 border-border pl-3 text-sm text-foreground">{localizeStrategyText(strategy.reasoning)}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat size="sm" label="Preço justo" value={formatBRL(row.fairValue)} />
            <Stat
              size="sm"
              label="Margem de segurança"
              value={formatMargin(row.margin)}
              hint="Desconto do preço atual em relação ao preço justo: 1 − preço ÷ preço justo."
            />
            <Stat
              size="sm"
              label="Potencial"
              value={formatDeltaPct(row.potential)}
              tone={row.potential === null ? 'default' : row.potential > 0 ? 'positive' : row.potential < 0 ? 'negative' : 'default'}
              hint="Quanto o preço atual precisaria subir (ou cair) para chegar ao preço justo: preço justo ÷ preço − 1."
            />
            <Stat size="sm" label="Score do modelo" value={`${Math.round(strategy.score)}/100`} />
          </div>

          {row.fairValue !== null && (
            <AskBenButton
              question={askBenQuestions.valuation(model, row.fairValue)}
              context={buildAssetContext({
                price,
                valuations: [{ model: model.shortLabel, fairValue: row.fairValue, margin: row.margin, score: strategy.score }],
                focus: `Modelo ${model.label}`,
              })}
              registerContext={false}
            />
          )}

          <ModelDetails row={row} />

          <ModelNotes row={row} reinvestment={reinvestment} />

          {strategy.reasoning && (
            <MarkdownRenderer
              content={localizeStrategyText(strategy.reasoning)}
              className="prose-sm max-w-none text-foreground"
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
    const strategy = strategies![model.key] as ValuationStrategy
    const locked = isModelLocked(model, access)
    const notApplicable = !locked && strategy.key_metrics?.notApplicable === 1
    const fairValue = !locked && typeof strategy.fairValue === 'number' && strategy.fairValue > 0 ? strategy.fairValue : null
    const strategyUpside = finiteOrNull(strategy.upside)
    return {
      model,
      strategy,
      locked,
      notApplicable,
      fairValue,
      margin: fairValue === null ? null : finiteOrNull(strategy.discount) ?? marginOfSafety(price, fairValue),
      potential: fairValue === null ? null : strategyUpside !== null ? strategyUpside / 100 : upside(price, fairValue),
      status: notApplicable ? NOT_APPLICABLE_STATUS : modelStatus(strategy, price),
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
          <span className="hidden sm:inline">
            <span className="block whitespace-nowrap">{row.model.label}</span>
            {MODEL_SUBTITLE[row.model.key] && (
              <span className="block whitespace-nowrap text-xs font-normal text-muted-foreground">{MODEL_SUBTITLE[row.model.key]}</span>
            )}
          </span>
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
        if (row.notApplicable) return <span className="text-muted-foreground">—</span>
        const status = valuationStatus(row.margin)
        return <span className={cn('font-medium', status && MARGIN_TONE[status])}>{formatMargin(row.margin)}</span>
      },
    },
    {
      key: 'criteria',
      header: 'Critérios',
      align: 'right',
      cell: (row) => {
        if (row.locked) return <BlurredValue>0/0</BlurredValue>
        if (row.notApplicable) return <span className="text-muted-foreground">—</span>
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

  // Um único CTA primário por página (no cabeçalho do ativo): aqui só uma linha discreta com link
  const upsellLink = access.isLoggedIn
    ? { label: 'Ver planos', href: '/planos' }
    : { label: 'Criar conta grátis', href: '/register' }

  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        loadingRows={8}
        getRowId={(row) => row.model.key}
        renderExpanded={(row) => <ExpandedRow row={row} reinvestment={reinvestment} price={price} />}
        caption="Preço justo, margem de segurança e critérios por modelo de valuation"
        empty={{
          title: 'Sem estimativas para esta empresa',
          description: 'Os dados financeiros disponíveis não permitem calcular os modelos de valuation.',
        }}
      />

      {!loading && lockedCount > 0 && (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>
            {!access.isLoggedIn
              ? 'Crie uma conta grátis para ver o Número de Graham e usar todos os modelos por 1 dia.'
              : lockedCount === 1
                ? 'Um modelo disponível no Premium.'
                : `${lockedCount} modelos disponíveis no Premium.`}{' '}
            <Link
              href={upsellLink.href}
              className="whitespace-nowrap py-3 font-medium text-brand underline-offset-4 hover:underline"
            >
              {upsellLink.label}
            </Link>
          </span>
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Estimativas de modelos quantitativos com dados públicos. Não é recomendação de investimento.{' '}
        <Link href="/metodologia" className="font-medium text-brand underline-offset-4 hover:underline">
          Ver metodologia
        </Link>
      </p>
    </div>
  )
}
