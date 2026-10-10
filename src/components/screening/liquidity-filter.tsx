"use client"

import { InfoHint } from "@/components/ui/info-hint"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  defaultLiquidity,
  effectiveLiquidity,
  formatLiquidityOption,
  LIQUIDITY_OPTIONS,
  type LiquidityAssetKind,
} from "./screening-metrics"

/** Linha com rótulo, ajuda opcional e switch, com área de toque de 44 px. */
export function SwitchRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1">
        <Label htmlFor={id} className={disabled ? "font-normal leading-snug text-muted-foreground" : "font-normal leading-snug"}>
          {label}
        </Label>
        {hint && <InfoHint content={hint} />}
      </div>
      <Switch
        id={id}
        // Área de toque de 44 px de altura sem mudar o tamanho visual do switch.
        className="relative before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-['']"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  )
}

interface LiquidityFilterProps {
  idPrefix: string
  kind: LiquidityAssetKind
  /** `undefined`: limite padrão do tipo; número: limite escolhido; `null`: inclui ativos com baixa liquidez. */
  value: number | null | undefined
  onChange: (value: number | null | undefined) => void
}

/**
 * Liquidez mínima (volume médio diário) com o padrão do tipo de ativo e a opção de incluir ativos com baixa liquidez,
 * que aparecem marcados nos resultados.
 */
export function LiquidityFilter({ idPrefix, kind, value, onChange }: LiquidityFilterProps) {
  const fallback = defaultLiquidity(kind)
  const includeIlliquid = value === null
  const selected = effectiveLiquidity(value, kind)
  const options = [...new Set<number>([...LIQUIDITY_OPTIONS, fallback])].sort((a, b) => a - b)

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <Label htmlFor={`${idPrefix}-liquidity`} className={includeIlliquid ? "text-muted-foreground" : undefined}>
            Volume médio diário
          </Label>
          <InfoHint content="Ativos pouco negociados podem ter preço que não reflete o valor e custo alto para comprar ou vender. Média de preço × volume dos pregões recentes." />
        </div>
        <Select
          value={String(selected)}
          disabled={includeIlliquid}
          onValueChange={(raw) => {
            const next = Number(raw)
            onChange(next === fallback ? undefined : next)
          }}
        >
          <SelectTrigger id={`${idPrefix}-liquidity`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {formatLiquidityOption(option)}
                {option === fallback ? " (padrão)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SwitchRow
        id={`${idPrefix}-include-illiquid`}
        label="Incluir ativos com baixa liquidez"
        hint={`Mostra também os ativos abaixo de ${formatLiquidityOption(fallback).replace("≥ ", "")}, marcados com "Baixa liquidez".`}
        checked={includeIlliquid}
        onCheckedChange={(checked) => onChange(checked ? null : undefined)}
      />
    </div>
  )
}
