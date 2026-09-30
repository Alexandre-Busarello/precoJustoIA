'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import {
  EMPTY_VALUE,
  formatBRL,
  formatBRLCompact,
  formatDeltaPct,
  formatMultiple,
  formatNumber,
  formatPct,
} from '@/lib/format'
import { InfoHint } from '@/components/ui/info-hint'
import { IndicatorHistoryDrawer } from '@/components/asset/indicator-history-drawer'

/** Como o valor do indicador é exibido. Percentuais chegam sempre como fração (0,126 = 12,6%). */
export type IndicatorFormat = 'multiple' | 'percent' | 'brl' | 'brlCompact'

/** Sentido em que o indicador melhora; `null` quando depende do contexto (a variação fica neutra). */
export type IndicatorBetter = 'higher' | 'lower' | null

export interface IndicatorYearValue {
  year: number
  value: number
}

export interface IndicatorItem {
  key: string
  label: string
  format: IndicatorFormat
  /** Casas decimais do valor (padrão da função de formatação quando omitido). */
  digits?: number
  better: IndicatorBetter
  /** O que o indicador mede (1–2 frases). */
  description: string
  /** Faixa de referência usual, sem juízo de compra/venda. */
  reference?: string
  value: number | null
  /** Média dos últimos 7 anos completos (sem o ano corrente). */
  average: number | null
  /** Série anual em ordem crescente de ano. */
  history: IndicatorYearValue[]
}

export interface IndicatorGroup {
  title: string
  items: IndicatorItem[]
}

export type IndicatorDeltaKind = 'pp' | 'relative'

export interface IndicatorDelta {
  /** Diferença em fração: pontos percentuais para percentuais (0,012 = +1,2 p.p.) ou variação relativa para os demais. */
  value: number
  kind: IndicatorDeltaKind
}

const MINUS = '−'

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Formata o valor do indicador conforme a unidade. Nulo vira `—`. */
export function formatIndicatorValue(value: number | null | undefined, format: IndicatorFormat, digits?: number): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE
  const options = digits === undefined ? {} : { digits }
  switch (format) {
    case 'percent':
      return formatPct(value, options)
    case 'multiple':
      return formatMultiple(value, options)
    case 'brl':
      return formatBRL(value, options)
    case 'brlCompact':
      return formatBRLCompact(value, options)
  }
}

/** Rótulo curto para eixo de gráfico (sem casas desnecessárias). */
export function formatIndicatorTick(value: number, format: IndicatorFormat): string {
  switch (format) {
    case 'percent':
      return formatPct(value, { digits: 0 })
    case 'multiple':
      return formatNumber(value, { digits: 1 })
    case 'brl':
      return formatBRL(value, { digits: Math.abs(value) >= 100 ? 0 : 2 })
    case 'brlCompact':
      return formatBRLCompact(value, { digits: 0 })
  }
}

/**
 * Média dos últimos 7 anos completos: ignora o ano corrente (ainda em andamento) e anos sem valor.
 * Devolve `null` quando não há nenhum ano completo com dado.
 */
export function sevenYearAverage(history: IndicatorYearValue[], currentYear: number): number | null {
  const values = history
    .filter((point) => point.year < currentYear && isFiniteNumber(point.value))
    .sort((a, b) => b.year - a.year)
    .slice(0, 7)
    .map((point) => point.value)
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Diferença entre o valor atual e a média.
 * - Percentuais: diferença absoluta em pontos percentuais (ROE 15% vs. média 19% = −4 p.p.).
 * - Demais: variação relativa (P/L 6 vs. média 5 = +20%); sem média positiva a comparação não faz sentido e volta `null`.
 */
export function indicatorDelta(
  value: number | null | undefined,
  average: number | null | undefined,
  format: IndicatorFormat
): IndicatorDelta | null {
  if (!isFiniteNumber(value) || !isFiniteNumber(average)) return null
  if (format === 'percent') return { value: value - average, kind: 'pp' }
  if (average <= 0) return null
  return { value: value / average - 1, kind: 'relative' }
}

/** `+1,2 p.p.` / `−3,4 p.p.` / `+20,0%`. Sempre com sinal (U+2212), exceto zero. */
export function formatIndicatorDelta(delta: IndicatorDelta): string {
  if (delta.kind === 'relative') return formatDeltaPct(delta.value)
  const rounded = Math.round(Math.abs(delta.value) * 1000)
  const body = `${formatNumber(rounded / 10, { digits: 1 })} p.p.`
  if (rounded === 0) return body
  return `${delta.value > 0 ? '+' : MINUS}${body}`
}

/**
 * Cor da variação: positiva/negativa só quando se sabe em que sentido o indicador melhora.
 * Múltiplos "quanto menor, melhor" com valor ≤ 0 (prejuízo, caixa líquido) ficam neutros para não sugerir melhora falsa.
 */
export function deltaTone(
  delta: IndicatorDelta | null,
  better: IndicatorBetter,
  value: number | null | undefined
): 'positive' | 'negative' | 'neutral' {
  if (!delta || !better) return 'neutral'
  // Mesma precisão do texto exibido (1 casa): o que aparece como 0,0 fica neutro.
  if (Math.round(Math.abs(delta.value) * 1000) === 0) return 'neutral'
  if (better === 'lower' && (!isFiniteNumber(value) || value <= 0)) return 'neutral'
  const improved = better === 'higher' ? delta.value > 0 : delta.value < 0
  return improved ? 'positive' : 'negative'
}

const TONE_CLASS: Record<ReturnType<typeof deltaTone>, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-muted-foreground',
}

function IndicatorHint({ item }: { item: IndicatorItem }) {
  return (
    <div className="space-y-2">
      <p>{item.description}</p>
      {item.reference && (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Referência usual:</span> {item.reference}
        </p>
      )}
    </div>
  )
}

function IndicatorCell({ item, onOpen }: { item: IndicatorItem; onOpen: (item: IndicatorItem) => void }) {
  const delta = indicatorDelta(item.value, item.average, item.format)
  const tone = deltaTone(delta, item.better, item.value)

  return (
    <div className="group relative min-w-0 bg-card px-3 py-2 transition-colors hover:bg-muted sm:px-4 sm:py-3">
      {/* Toda a célula abre o histórico; o InfoHint fica acima do botão para receber o próprio toque. */}
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-label={`Ver histórico de ${item.label}`}
        className="absolute inset-0 cursor-pointer focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
      />
      <div className="pointer-events-none relative flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        <span className="truncate">{item.label}</span>
        <span className="pointer-events-auto relative z-10 inline-flex">
          <InfoHint content={<IndicatorHint item={item} />} label={`Sobre ${item.label}`} />
        </span>
      </div>
      <div className="pointer-events-none relative mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 tabular-nums">
        <span data-num className="truncate text-lg font-semibold tracking-tight text-foreground">
          {formatIndicatorValue(item.value, item.format, item.digits)}
        </span>
        {delta && (
          <span className={cn('text-xs font-medium whitespace-nowrap', TONE_CLASS[tone])}>{formatIndicatorDelta(delta)}</span>
        )}
      </div>
      <div className="pointer-events-none relative truncate text-xs text-muted-foreground tabular-nums">
        média 7a {formatIndicatorValue(item.average, item.format, item.digits)}
      </div>
    </div>
  )
}

export interface IndicatorGridProps {
  groups: IndicatorGroup[]
  ticker: string
  className?: string
}

/**
 * Grade única de indicadores: grupos com subtítulo, células separadas por linha fina (sem card por indicador),
 * 2 colunas no mobile e 4 no desktop. Cada célula mostra valor atual, média de 7 anos e a diferença;
 * tocar na célula abre o histórico anual.
 */
export function IndicatorGrid({ groups, ticker, className }: IndicatorGridProps) {
  const [selected, setSelected] = React.useState<IndicatorItem | null>(null)
  const [open, setOpen] = React.useState(false)
  const visibleGroups = groups.filter((group) => group.items.length > 0)
  const selectedDelta = selected ? indicatorDelta(selected.value, selected.average, selected.format) : null

  const openHistory = React.useCallback((item: IndicatorItem) => {
    setSelected(item)
    setOpen(true)
  }, [])

  return (
    <div className={cn('space-y-4', className)} data-indicator-grid>
      {visibleGroups.map((group) => {
        const headingId = `indicadores-${group.title.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}`
        return (
          <section key={group.title} aria-labelledby={headingId} className="space-y-2">
            <h3 id={headingId} className="text-sm font-medium text-foreground">
              {group.title}
            </h3>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
              {group.items.map((item) => (
                <IndicatorCell key={item.key} item={item} onOpen={openHistory} />
              ))}
              {/* Completa a última linha para a grade de linhas finas não mostrar um buraco. */}
              {Array.from({ length: (2 - (group.items.length % 2)) % 2 }, (_, i) => (
                <div key={`fill-sm-${i}`} aria-hidden="true" className="bg-card md:hidden" />
              ))}
              {Array.from({ length: (4 - (group.items.length % 4)) % 4 }, (_, i) => (
                <div key={`fill-md-${i}`} aria-hidden="true" className="hidden bg-card md:block" />
              ))}
            </div>
          </section>
        )
      })}
      <p className="text-xs text-muted-foreground">
        Média 7a: últimos 7 anos completos, sem o ano corrente. Toque em um indicador para ver o histórico.
      </p>
      <IndicatorHistoryDrawer
        item={selected}
        ticker={ticker}
        open={open}
        onOpenChange={setOpen}
        formatValue={(value) => formatIndicatorValue(value, selected?.format ?? 'multiple', selected?.digits)}
        formatTick={(value) => formatIndicatorTick(value, selected?.format ?? 'multiple')}
        delta={selectedDelta ? { text: formatIndicatorDelta(selectedDelta), tone: deltaTone(selectedDelta, selected?.better ?? null, selected?.value) } : null}
      />
    </div>
  )
}
