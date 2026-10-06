"use client"

/**
 * Calculadora de recuperação: quantas ações adicionar para empatar ou sair com lucro se o ativo subir X%.
 * Formulário à esquerda e resultado à direita no desktop (empilhado em `compact`, usado na gaveta da carteira).
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { formatBRL, formatDeltaPct, formatNumber, formatPct } from "@/lib/format"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Stat } from "@/components/ui/stat"
import { MoneyInput } from "@/app/calculadoras/_components/money-input"
import { parseBRL, toMaskedBRL } from "@/app/calculadoras/_components/money-mask"
import {
  calculateCurrentDrop,
  calculateLossInReais,
  calculateRecovery,
  type RecoveryCalculation,
} from "@/lib/recovery-calculator-utils"

export interface RecoveryInitialValues {
  currentQty: number
  avgPrice: number
  currentPrice: number
  ticker?: string
}

interface RecoveryCalculatorProps {
  initialValues?: RecoveryInitialValues
  onUsageRecord?: () => Promise<void>
  compact?: boolean
}

const PROFIT_PRESETS = [
  { value: 0, label: "Empatar" },
  { value: 5, label: "Lucro de 5%" },
  { value: 10, label: "Lucro de 10%" },
]

/** Número digitado em pt-BR ("15,5" → 15.5). */
function parsePlain(value: string): number {
  const parsed = Number(value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

/** Mantém dígitos e uma vírgula decimal; "." digitado vale como vírgula ("15.5" → "15,5"). */
function keepDecimal(value: string): string {
  const [integer, ...rest] = value.replace(/\./g, ",").replace(/[^\d,]/g, "").split(",")
  return rest.length === 0 ? integer : `${integer},${rest.join("")}`
}

export function RecoveryCalculator({ initialValues, onUsageRecord, compact = false }: RecoveryCalculatorProps) {
  const [avgPrice, setAvgPrice] = useState(toMaskedBRL(initialValues?.avgPrice))
  const [currentQty, setCurrentQty] = useState(initialValues?.currentQty ? String(initialValues.currentQty) : "")
  const [currentPrice, setCurrentPrice] = useState(toMaskedBRL(initialValues?.currentPrice))
  const [targetRise, setTargetRise] = useState("")
  const [targetProfit, setTargetProfit] = useState(0)
  const [customProfit, setCustomProfit] = useState("")
  const lastRegisteredResultKeyRef = useRef<string | null>(null)

  const avgPriceNum = parseBRL(avgPrice) ?? 0
  const currentQtyNum = Math.floor(parsePlain(currentQty))
  const currentPriceNum = parseBRL(currentPrice) ?? 0
  const targetRiseNum = parsePlain(targetRise)

  const currentDrop = avgPriceNum > 0 && currentPriceNum > 0 ? calculateCurrentDrop(avgPriceNum, currentPriceNum) : 0
  const lossInReais = calculateLossInReais(currentQtyNum, avgPriceNum, currentPriceNum)
  const suggestedTargetRise = currentDrop > 0 ? currentDrop : 0
  const isValidInput = currentQtyNum > 0 && avgPriceNum > 0 && currentPriceNum > 0
  const inLoss = isValidInput && currentPriceNum < avgPriceNum
  // Alta necessária para a posição atual voltar ao preço médio sem comprar mais (ex.: queda de 40% → 66,7%).
  const breakEvenRise = inLoss ? (avgPriceNum / currentPriceNum - 1) * 100 : 0

  const handleDiagnosisBlur = () => {
    if (inLoss && !targetRise && suggestedTargetRise > 0) {
      setTargetRise(formatNumber(suggestedTargetRise, { digits: 1 }))
    }
  }

  const result = useMemo((): RecoveryCalculation | null => {
    if (!isValidInput || targetRiseNum <= 0) return null
    return calculateRecovery({
      currentQty: currentQtyNum,
      avgPrice: avgPriceNum,
      currentPrice: currentPriceNum,
      targetRise: targetRiseNum,
      targetProfit,
    })
  }, [isValidInput, currentQtyNum, avgPriceNum, currentPriceNum, targetRiseNum, targetProfit])

  const targetPrice = currentPriceNum > 0 && targetRiseNum > 0 ? currentPriceNum * (1 + targetRiseNum / 100) : 0

  useEffect(() => {
    if (!result?.success || !onUsageRecord) return
    const resultKey = `${result.qtyToBuy}-${result.investmentRequired}-${result.newAvgPrice}`
    if (lastRegisteredResultKeyRef.current === resultKey) return
    lastRegisteredResultKeyRef.current = resultKey
    onUsageRecord()
  }, [result, onUsageRecord])

  return (
    <div className={cn("grid items-start gap-6", !compact && "lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]")}>
      <form className="space-y-5 rounded-lg border border-border bg-card p-4 sm:p-5" onSubmit={(e) => e.preventDefault()} noValidate>
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-foreground">Sua posição hoje</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="avgPrice">Preço médio</Label>
              <MoneyInput
                id="avgPrice"
                placeholder="10,00"
                value={avgPrice}
                onValueChange={setAvgPrice}
                onBlur={handleDiagnosisBlur}
                enterKeyHint="next"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentQty">Quantidade</Label>
              <Input
                id="currentQty"
                type="text"
                inputMode="numeric"
                enterKeyHint="next"
                autoComplete="off"
                placeholder="100"
                value={currentQty}
                onChange={(e) => setCurrentQty(e.target.value.replace(/\D/g, ""))}
                onBlur={handleDiagnosisBlur}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentPrice">Cotação atual</Label>
              <MoneyInput
                id="currentPrice"
                placeholder="5,00"
                value={currentPrice}
                onValueChange={setCurrentPrice}
                onBlur={handleDiagnosisBlur}
                enterKeyHint="next"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-border pt-5">
          <legend className="sr-only">Estratégia</legend>
          <div className="space-y-2">
            <Label htmlFor="targetRise">Se o ativo subir (%)</Label>
            <Input
              id="targetRise"
              type="text"
              inputMode="decimal"
              enterKeyHint="go"
              autoComplete="off"
              placeholder={inLoss && suggestedTargetRise > 0 ? `Sugestão: ${formatNumber(suggestedTargetRise, { digits: 0 })}` : "15"}
              value={targetRise}
              onChange={(e) => setTargetRise(keepDecimal(e.target.value))}
              className="tabular-nums"
            />
            {targetPrice > 0 && (
              <p className="text-xs text-muted-foreground">
                A cotação iria para <span className="tabular-nums">{formatBRL(targetPrice)}</span>
              </p>
            )}
            {breakEvenRise > 0 && (
              <p className="text-xs text-muted-foreground">
                Sem comprar mais, a cotação precisaria subir{" "}
                <span className="tabular-nums">{formatPct(breakEvenRise / 100)}</span> para voltar ao preço médio.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <span id="target-profit-label" className="text-sm font-medium leading-none text-foreground">
              Objetivo
            </span>
            <div role="group" aria-labelledby="target-profit-label" className="flex flex-wrap items-center gap-2">
              {PROFIT_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  aria-pressed={customProfit === "" && targetProfit === preset.value}
                  onClick={() => {
                    setCustomProfit("")
                    setTargetProfit(preset.value)
                  }}
                  className="min-h-11 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-muted aria-pressed:border-brand aria-pressed:bg-brand-subtle aria-pressed:text-brand focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-9"
                >
                  {preset.label}
                </button>
              ))}
              <div className="flex items-center gap-1.5">
                <Input
                  id="targetProfit"
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="go"
                  autoComplete="off"
                  aria-label="Outro lucro desejado, em %"
                  placeholder="Outro"
                  value={customProfit}
                  onChange={(e) => {
                    const value = keepDecimal(e.target.value)
                    setCustomProfit(value)
                    setTargetProfit(value ? parsePlain(value) : 0)
                  }}
                  className="w-24 tabular-nums"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        </fieldset>
      </form>

      <div className="min-w-0 space-y-4" aria-live="polite">
        {isValidInput && (
          <section aria-label="Situação atual" className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
            <Stat
              label="Variação desde o preço médio"
              value={formatDeltaPct(-currentDrop / 100)}
              tone={currentDrop > 0 ? "negative" : currentDrop < 0 ? "positive" : "default"}
            />
            <Stat
              label={lossInReais >= 0 ? "Prejuízo atual" : "Lucro atual"}
              value={formatBRL(Math.abs(lossInReais))}
              tone={lossInReais > 0 ? "negative" : lossInReais < 0 ? "positive" : "default"}
            />
          </section>
        )}

        {result ? (
          <section aria-label="Resultado" className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-medium text-foreground">Resultado da simulação</h2>
            {result.success ? (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Stat
                    label="Ações a adicionar"
                    value={formatNumber(result.qtyToBuy, { digits: 0 })}
                    className="col-span-2 sm:col-span-1"
                  />
                  <Stat label="Aporte necessário" value={formatBRL(result.investmentRequired)} />
                  <Stat label="Novo preço médio" value={formatBRL(result.newAvgPrice)} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {targetProfit === 0
                    ? `Com esse aporte, uma alta de ${formatNumber(targetRiseNum, { digits: 1 })}% zera o prejuízo da posição.`
                    : `Com esse aporte, uma alta de ${formatNumber(targetRiseNum, { digits: 1 })}% recupera o prejuízo e deixa ${formatNumber(targetProfit, { digits: 1 })}% de lucro (${formatBRL(result.profitInReais)}).`}
                </p>
              </>
            ) : (
              <p className="rounded-lg bg-warning-subtle p-3 text-sm text-foreground">{result.message}</p>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              Simulação matemática. Não é recomendação de investimento: aumentar a posição em um ativo em queda também
              aumenta o risco.
            </p>
          </section>
        ) : (
          !compact && (
            <div className="flex min-h-48 flex-col justify-center rounded-lg border border-dashed border-border p-6 text-center lg:min-h-64">
              <p className="text-sm font-medium text-foreground">O resultado aparece aqui</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Preencha preço médio, quantidade, cotação atual e a alta esperada.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
