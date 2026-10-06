'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronDown, Lock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { InfoHint } from '@/components/ui/info-hint'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

/**
 * Tabela única de comparação: linhas = indicadores (agrupados), colunas = ativos (até 6).
 * A 1ª coluna fica fixa no mobile. O melhor valor de cada linha aparece em `font-semibold`
 * com um ponto da cor da marca e o rótulo "melhor" para leitores de tela.
 *
 * Os valores chegam já formatados (texto) junto do número bruto usado para achar o melhor valor,
 * porque a página é renderizada no servidor e não pode passar funções de formatação.
 */

export interface ComparisonAsset {
  ticker: string
  name: string
  href: string
  /** Linha curta abaixo do nome (ex.: preço formatado). */
  meta?: string | null
}

export interface ComparisonCell {
  /** Número usado para achar o melhor valor; `null` quando não há dado ou a linha não é numérica. */
  value: number | null
  /** Texto exibido (já formatado com @/lib/format). */
  text: string
  /** Linha secundária opcional (ex.: média de 7 anos), exibida com o seletor ligado. */
  secondary?: string | null
}

/**
 * - `higher`: maior é melhor.
 * - `lower`: menor é melhor.
 * - `lower-positive`: menor é melhor, ignorando valores ≤ 0 (P/L e P/VP negativos indicam prejuízo ou patrimônio negativo).
 * - `none`: linha informativa, sem destaque.
 */
export type ComparisonBetter = 'higher' | 'lower' | 'lower-positive' | 'none'

export interface ComparisonRow {
  key: string
  label: string
  description?: string
  hint?: string
  better: ComparisonBetter
  cells: ComparisonCell[]
  /** Linha exclusiva do Premium: os valores não são enviados e aparece um cadeado. */
  locked?: boolean
  /** Linha de texto (ex.: benchmark): o conteúdo quebra linha em vez de alargar a coluna. */
  text?: boolean
}

export interface ComparisonGroup {
  key: string
  label: string
  rows: ComparisonRow[]
  /** Mostra só as primeiras N linhas até o usuário expandir o grupo. */
  collapseAfter?: number
}

interface ComparisonTableProps {
  assets: ComparisonAsset[]
  groups: ComparisonGroup[]
  /** Rótulo do seletor que mostra a linha secundária das células (ex.: "Média de 7 anos"). */
  secondaryLabel?: string
  /** Conteúdo exibido abaixo da tabela quando há linhas bloqueadas (ex.: chamada para o Premium). */
  lockedNotice?: React.ReactNode
  /** Linha extra no fim da tabela, uma célula por ativo (ex.: botão de backtest). */
  footerRow?: { label: string; cells: React.ReactNode[] }
  /** Legenda acessível da tabela. */
  caption: string
  className?: string
}

const EPSILON = 1e-9

function isComparable(value: number | null, better: ComparisonBetter): value is number {
  if (value === null || !Number.isFinite(value)) return false
  if (better === 'lower-positive') return value > 0
  return true
}

/**
 * Índices das colunas com o melhor valor da linha. Empates marcam todos os empatados.
 * Sem destaque quando há menos de 2 valores comparáveis ou quando todos são iguais.
 */
export function getBestIndices(cells: ComparisonCell[], better: ComparisonBetter): number[] {
  if (better === 'none') return []
  const valid = cells
    .map((cell, index) => ({ value: cell.value, index }))
    .filter((entry): entry is { value: number; index: number } => isComparable(entry.value, better))
  if (valid.length < 2) return []
  const values = valid.map((entry) => entry.value)
  const best = better === 'higher' ? Math.max(...values) : Math.min(...values)
  const tolerance = EPSILON * Math.max(1, Math.abs(best))
  const tied = valid.filter((entry) => Math.abs(entry.value - best) <= tolerance).map((entry) => entry.index)
  return tied.length === valid.length ? [] : tied
}

interface LeaderSummary {
  leaders: string[]
  wins: number
  total: number
}

/** Quem lidera em mais indicadores (entre as linhas liberadas que têm um melhor valor). */
export function summarizeLeaders(assets: ComparisonAsset[], groups: ComparisonGroup[]): LeaderSummary | null {
  const wins = new Array(assets.length).fill(0) as number[]
  let total = 0
  for (const group of groups) {
    for (const row of group.rows) {
      if (row.locked) continue
      const best = getBestIndices(row.cells, row.better)
      if (best.length === 0) continue
      total += 1
      best.forEach((index) => {
        wins[index] += 1
      })
    }
  }
  if (total === 0) return null
  const max = Math.max(...wins)
  if (max === 0) return null
  const leaders = assets.filter((_, index) => wins[index] === max).map((asset) => asset.ticker)
  return { leaders, wins: max, total }
}

function joinTickers(tickers: string[]): string {
  if (tickers.length <= 1) return tickers[0] ?? ''
  return `${tickers.slice(0, -1).join(', ')} e ${tickers[tickers.length - 1]}`
}

function summaryText({ leaders, wins, total }: LeaderSummary): React.ReactNode {
  const names = <span className="font-semibold text-foreground">{joinTickers(leaders)}</span>
  const count = `${wins} de ${total} ${total === 1 ? 'indicador' : 'indicadores'}`
  if (leaders.length === 1) return <>{names} lidera em {count}</>
  return <>{names} lideram em {count} cada</>
}

const STICKY_CELL =
  'sticky left-0 z-10 w-[112px] min-w-[112px] max-w-[112px] whitespace-normal border-r border-border sm:w-56 sm:min-w-56 sm:max-w-56 lg:w-80 lg:min-w-80 lg:max-w-80 group-data-[scrolled=true]/cmp:shadow-[6px_0_8px_-6px_rgb(0_0_0/0.18)]'

export function ComparisonTable({
  assets,
  groups,
  secondaryLabel,
  lockedNotice,
  footerRow,
  caption,
  className,
}: ComparisonTableProps) {
  const [showSecondary, setShowSecondary] = React.useState(false)
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())
  const [scrolled, setScrolled] = React.useState(false)
  const switchId = React.useId()

  const summary = React.useMemo(() => summarizeLeaders(assets, groups), [assets, groups])
  const hasSecondary = groups.some((group) => group.rows.some((row) => row.cells.some((cell) => cell.secondary)))
  const hasLocked = groups.some((group) => group.rows.some((row) => row.locked))
  const colCount = assets.length + 1

  const toggleGroup = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <section className={cn('min-w-0 space-y-3', className)} aria-label={caption}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {summary ? (
          <p className="text-sm text-muted-foreground" data-testid="comparison-summary">
            {summaryText(summary)}
          </p>
        ) : (
          <span />
        )}
        {secondaryLabel && hasSecondary && (
          <div className="flex min-h-11 items-center gap-2 md:min-h-0">
            <Switch
              id={switchId}
              checked={showSecondary}
              onCheckedChange={setShowSecondary}
              className="relative before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-['']"
            />
            <Label htmlFor={switchId} className="cursor-pointer text-sm font-normal text-muted-foreground">
              {secondaryLabel}
            </Label>
          </div>
        )}
      </div>

      <div
        data-scrolled={scrolled}
        className="group/cmp relative w-full max-w-full overflow-x-auto rounded-lg border border-border bg-card"
        onScroll={(event) => setScrolled(event.currentTarget.scrollLeft > 0)}
      >
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface">
            <tr className="border-b border-border">
              <th scope="col" className={cn(STICKY_CELL, 'bg-surface px-3 py-2 text-left align-bottom text-xs font-medium text-muted-foreground')}>
                Indicador
              </th>
              {assets.map((asset) => (
                <th key={asset.ticker} scope="col" className="min-w-24 px-3 py-2 text-right align-bottom font-normal">
                  <span className="flex flex-col items-end sm:flex-row sm:items-baseline sm:justify-end sm:gap-2">
                    <Link
                      href={asset.href}
                      prefetch={false}
                      className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-semibold sm:min-h-8 text-foreground underline-offset-4 hover:text-brand hover:underline"
                    >
                      {asset.ticker}
                    </Link>
                    {asset.meta && <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">{asset.meta}</span>}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:line-clamp-1" title={asset.name}>
                    {asset.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => {
            const isOpen = expanded.has(group.key)
            const limit = group.collapseAfter
            const hiddenCount = limit !== undefined ? Math.max(0, group.rows.length - limit) : 0
            const visibleRows = hiddenCount > 0 && !isOpen ? group.rows.slice(0, limit) : group.rows
            return (
              <tbody key={group.key}>
                <tr className="border-b border-border bg-surface">
                  <th scope="colgroup" colSpan={colCount} className="h-7 px-3 text-left text-xs font-medium text-muted-foreground">
                    <span className="sticky left-3">{group.label}</span>
                  </th>
                </tr>
                {visibleRows.map((row) => {
                  const best = row.locked ? [] : getBestIndices(row.cells, row.better)
                  return (
                    <tr key={row.key} className="group/row border-b border-border hover:bg-muted" data-row={row.key}>
                      <th scope="row" className={cn(STICKY_CELL, 'bg-card px-3 py-1.5 text-left align-middle font-normal group-hover/row:bg-muted lg:py-1')}>
                        <span className="block min-w-0 lg:flex lg:items-center lg:gap-2">
                          <span className="flex shrink-0 items-center gap-1">
                            <span className="text-sm font-medium leading-5 text-foreground">{row.label}</span>
                            {row.hint && <InfoHint content={row.hint} label={`Sobre ${row.label}`} side="right" />}
                          </span>
                          {row.description && (
                            <span className="hidden min-w-0 text-xs leading-4 text-muted-foreground sm:block lg:truncate" title={row.description}>
                              {row.description}
                            </span>
                          )}
                        </span>
                      </th>
                      {row.cells.map((cell, index) => {
                        const isBest = best.includes(index)
                        return (
                          <td
                            key={assets[index]?.ticker ?? index}
                            className={cn(
                              'h-10 px-3 py-1.5 text-right align-middle lg:h-9 lg:py-1',
                              row.text ? 'whitespace-normal break-words' : 'tabular-nums whitespace-nowrap'
                            )}
                            data-best={isBest || undefined}
                          >
                            {row.locked ? (
                              <span className="inline-flex items-center text-muted-foreground">
                                <Lock className="size-4" strokeWidth={1.75} aria-hidden="true" />
                                <span className="sr-only">Disponível no Premium</span>
                              </span>
                            ) : (
                              <>
                                <span className={cn('inline-flex items-center gap-1.5', isBest ? 'font-semibold text-foreground' : 'text-foreground')}>
                                  {isBest && <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />}
                                  {cell.text}
                                  {isBest && <span className="sr-only"> (melhor)</span>}
                                </span>
                                {showSecondary && cell.secondary && (
                                  <span className="block text-xs text-muted-foreground">{cell.secondary}</span>
                                )}
                              </>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                {hiddenCount > 0 && (
                  <tr className="border-b border-border">
                    <td colSpan={colCount} className="px-3 py-0">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggleGroup(group.key)}
                        className="sticky left-3 inline-flex min-h-11 items-center lg:min-h-9 gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {isOpen ? 'Mostrar menos' : `Mostrar mais ${hiddenCount}`}
                        <ChevronDown className={cn('size-4 transition-transform', isOpen && 'rotate-180')} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            )
          })}
          {footerRow && (
            <tbody>
              <tr>
                <th scope="row" className={cn(STICKY_CELL, 'bg-card px-3 py-1 text-left align-middle text-sm font-medium text-foreground')}>
                  {footerRow.label}
                </th>
                {footerRow.cells.map((cell, index) => (
                  <td key={assets[index]?.ticker ?? index} className="px-3 py-1 text-right align-middle">
                    <div className="flex justify-end">{cell}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          )}
        </table>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
        Melhor valor da linha, considerando o dado mais recente.
      </p>

      {/* Fragmento criado aqui: o elemento vindo do servidor não entra direto na lista de filhos (aviso de key do React 19). */}
      {hasLocked && lockedNotice ? <>{lockedNotice}</> : null}
    </section>
  )
}

/**
 * Aviso das linhas bloqueadas. Fica neste módulo (cliente) para a página do servidor passar só
 * `<ComparisonLockedNotice />`, sem montar filhos no servidor (evita o aviso de `key` do React na hidratação).
 */
export function ComparisonLockedNotice({ message, href, cta }: { message: string; href: string; cta: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild size="sm" className="shrink-0">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  )
}
