"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatDecimalInput, parseDecimal } from "./screening-metrics"

interface NumberFieldProps {
  /** Valor já na unidade exibida (ex.: 15 para 15%). */
  value: number | undefined
  onChange: (value: number | undefined) => void
  placeholder?: string
  /** Rótulo acessível (o rótulo visual fica fora do campo). */
  ariaLabel: string
  suffix?: string
  disabled?: boolean
  className?: string
}

/** Compara ignorando ruído de ponto flutuante das conversões de escala (0,15 × 100). */
function sameNumber(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b))
}

/**
 * Campo numérico em pt-BR: aceita vírgula decimal, abre o teclado numérico no celular
 * e mantém o texto digitado ("1," não vira "1" no meio da digitação).
 */
export function NumberField({ value, onChange, placeholder, ariaLabel, suffix, disabled, className }: NumberFieldProps) {
  const [draft, setDraft] = useState(() => formatDecimalInput(value))
  const [prevValue, setPrevValue] = useState(value)
  const [focused, setFocused] = useState(false)

  // Sincroniza quando o valor muda por fora (Limpar, IA, sugestões do estado vazio).
  if (value !== prevValue) {
    setPrevValue(value)
    if (!sameNumber(parseDecimal(draft), value)) setDraft(formatDecimalInput(value))
  }

  // Só sinaliza erro fora do foco: no meio da digitação ("1.000.0") o texto ainda não é um número.
  const invalid = !focused && draft.trim() !== "" && parseDecimal(draft) === undefined

  return (
    <div className={cn("relative min-w-0", className)}>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={draft}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        title={invalid ? "Número inválido. Use vírgula para decimais (ex.: 1,5) e ponto para milhar (ex.: 1.000.000)." : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          const parsed = parseDecimal(next)
          if (parsed !== undefined || next.trim() === "") onChange(parsed)
        }}
        className={cn("tabular-nums", suffix && "pr-9")}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  )
}
