'use client'

/**
 * Campo de valor em reais: prefixo "R$", teclado numérico (inputMode="decimal") e máscara pt-BR ao digitar.
 * O valor é controlado como texto mascarado; use `parseBRL` para obter o número.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { maskBRL, parseBRL, toMaskedBRL } from './money-mask'

type MoneyInputProps = Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'onChange' | 'inputMode'> & {
  value: string
  onValueChange: (masked: string) => void
}

export function MoneyInput({ value, onValueChange, className, enterKeyHint = 'go', ...props }: MoneyInputProps) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground md:text-sm"
      >
        R$
      </span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint={enterKeyHint}
        value={value}
        onChange={(event) => onValueChange(maskBRL(event.target.value, value))}
        className={cn('pl-10 tabular-nums', className)}
      />
    </div>
  )
}

type NumericMoneyInputProps = Omit<MoneyInputProps, 'value' | 'onValueChange'> & {
  /** Valor em reais; 0 ou null deixa o campo vazio. */
  value: number | null | undefined
  onValueChange: (value: number) => void
}

/**
 * Variante numérica do MoneyInput: guarda o texto digitado e só o substitui quando o valor externo muda
 * (ex.: ao carregar uma dívida salva), para não atrapalhar a digitação.
 */
export function NumericMoneyInput({ value, onValueChange, ...props }: NumericMoneyInputProps) {
  // A API pode devolver decimais como string: normaliza para número.
  const numeric = Number(value) || 0
  const [text, setText] = React.useState(() => (numeric ? toMaskedBRL(numeric) : ''))

  React.useEffect(() => {
    const current = parseBRL(text) ?? 0
    if (Math.abs(numeric - current) > 1e-9) setText(numeric ? toMaskedBRL(numeric) : '')
    // Só reage a mudanças externas do valor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeric])

  return (
    <MoneyInput
      {...props}
      value={text}
      onValueChange={(masked) => {
        setText(masked)
        onValueChange(parseBRL(masked) ?? 0)
      }}
    />
  )
}

type DecimalInputProps = Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'onChange' | 'inputMode'> & {
  value: number | null | undefined
  onValueChange: (value: number) => void
  /** Texto à direita do campo (ex.: "%", "meses"). */
  suffix?: string
  /** Só inteiros (teclado numérico sem vírgula). */
  integer?: boolean
}

function keepFirstComma(text: string): string {
  const [integer, ...rest] = text.split(',')
  return rest.length === 0 ? integer : `${integer},${rest.join('')}`
}

/** Número em pt-BR (vírgula decimal) com teclado numérico; mantém o texto digitado como em NumericMoneyInput. */
export function DecimalInput({ value, onValueChange, suffix, integer = false, className, ...props }: DecimalInputProps) {
  const numeric = Number(value) || 0
  const toText = (n: number) => (n ? String(Math.round(n * 1e4) / 1e4).replace('.', ',') : '')
  const [text, setText] = React.useState(() => toText(numeric))

  React.useEffect(() => {
    if (Math.abs(numeric - (parseBRL(text) ?? 0)) > 1e-9) setText(toText(numeric))
    // Só reage a mudanças externas do valor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeric])

  return (
    <div className="relative">
      <Input
        {...props}
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        autoComplete="off"
        value={text}
        onChange={(event) => {
          // Ponto vale como vírgula decimal (campos sem agrupamento de milhar); só a primeira vírgula conta.
          const cleaned = integer
            ? event.target.value.replace(/\D/g, '')
            : keepFirstComma(event.target.value.replace(/\./g, ',').replace(/[^\d,]/g, ''))
          setText(cleaned)
          onValueChange(parseBRL(cleaned) ?? 0)
        }}
        className={cn('tabular-nums', suffix && 'pr-14', className)}
      />
      {suffix && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground md:text-sm"
        >
          {suffix}
        </span>
      )}
    </div>
  )
}
