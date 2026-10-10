'use client'

import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
  /** Opção visível, mas restrita ao Premium (mostra cadeado; continua selecionável para exibir a prévia). */
  locked?: boolean
}

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  ariaLabel: string
  className?: string
}

/** Controle segmentado (grupo de rádio): fundo `muted`, opção ativa em `background`. Alvos de 44 px no mobile. */
export function Segmented<T extends string>({ value, onChange, options, ariaLabel, className }: SegmentedProps<T>) {
  const move = (from: number, step: number) => {
    const enabled = options.filter((o) => !o.disabled)
    const index = enabled.findIndex((o) => o.value === options[from].value)
    const next = enabled[(index + step + enabled.length) % enabled.length]
    if (next) onChange(next.value)
  }
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('grid gap-1 rounded-md bg-muted p-1', className)}>
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                move(index, 1)
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                move(index, -1)
              }
            }}
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-center text-sm leading-tight font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:min-h-9',
              selected ? 'border border-border bg-background text-foreground' : 'border border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
            {option.locked && <Lock className="size-3.5 shrink-0" strokeWidth={1.75} aria-label="Premium" />}
          </button>
        )
      })}
    </div>
  )
}
