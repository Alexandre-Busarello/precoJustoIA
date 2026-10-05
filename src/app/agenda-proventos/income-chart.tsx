'use client'

import { useState } from 'react'

import { cn } from '@/lib/utils'
import { formatBRL } from '@/lib/format'
import { monthLabel, monthShort } from '@/app/radar-dividendos/dividend-months'
import type { MonthlyIncome } from './agenda-model'

function parseMonth(key: string): { year: number; month: number } {
  const [year, month] = key.split('-').map(Number)
  return { year, month }
}

/** Legenda: barra sólida para proventos anunciados, contorno para estimativas. */
export function IncomeLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-3 rounded-sm bg-chart-1" />
        Anunciado
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-3 rounded-sm border-[1.5px] border-dashed border-chart-1" />
        Estimativa estatística
      </li>
    </ul>
  )
}

/**
 * Renda mensal da carteira em 12 barras: a parte anunciada é sólida e a estimada é vazada, empilhada por cima.
 * Tocar ou passar o mouse numa barra mostra os valores do mês no topo (funciona igual no mobile).
 */
export function IncomeChart({ months }: { months: MonthlyIncome[] }) {
  const [selected, setSelected] = useState(0)
  const max = Math.max(...months.map((m) => m.confirmed + m.projected), 0)
  const current = months[selected]
  if (!current) return null
  const { year, month } = parseMonth(current.month)
  const total = current.confirmed + current.projected

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="min-h-11">
        <p className="text-sm text-muted-foreground">{monthLabel(month, year)}</p>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(total)}</span>
          {total > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatBRL(current.confirmed)} anunciado · {formatBRL(current.projected)} estimado
            </span>
          )}
        </p>
      </div>

      <div className="grid h-40 grid-cols-12 items-end gap-1 sm:gap-2" role="group" aria-label="Renda mensal estimada">
        {months.map((item, index) => {
          const parts = parseMonth(item.month)
          const sum = item.confirmed + item.projected
          const confirmedPct = max > 0 ? (item.confirmed / max) * 100 : 0
          const projectedPct = max > 0 ? (item.projected / max) * 100 : 0
          const active = index === selected
          return (
            <button
              key={item.month}
              type="button"
              aria-pressed={active}
              aria-label={`${monthLabel(parts.month, parts.year)}: ${formatBRL(item.confirmed)} anunciado e ${formatBRL(item.projected)} estimado`}
              onClick={() => setSelected(index)}
              onMouseEnter={() => setSelected(index)}
              onFocus={() => setSelected(index)}
              className={cn(
                'flex h-full min-w-0 flex-col justify-end rounded-sm px-0.5 transition-colors focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none sm:px-1',
                active ? 'bg-muted' : 'hover:bg-muted'
              )}
            >
              {item.projected > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'block w-full border-[1.5px] border-dashed border-chart-1',
                    item.confirmed > 0 ? 'rounded-t-sm border-b-0' : 'rounded-sm'
                  )}
                  style={{ height: `max(${projectedPct}%, 3px)` }}
                />
              )}
              {item.confirmed > 0 && (
                <span
                  aria-hidden="true"
                  className={cn('block w-full bg-chart-1', item.projected > 0 ? 'rounded-b-sm' : 'rounded-sm')}
                  style={{ height: `max(${confirmedPct}%, 3px)` }}
                />
              )}
              {sum === 0 && <span aria-hidden="true" className="block h-px w-full bg-border" />}
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-12 gap-1 sm:gap-2" aria-hidden="true">
        {months.map((item, index) => {
          const parts = parseMonth(item.month)
          return (
            <span
              key={item.month}
              className={cn(
                'truncate text-center text-[11px] sm:text-xs',
                index === selected ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              {monthShort(parts.month)}
            </span>
          )
        })}
      </div>
    </div>
  )
}
