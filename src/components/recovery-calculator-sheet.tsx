"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Calculator } from "lucide-react"
import { RecoveryCalculator } from "@/components/recovery-calculator"
import { calculateRecovery } from "@/lib/recovery-calculator-utils"
import { formatBRL, formatDeltaPct, formatNumber } from "@/lib/format"

interface Holding {
  ticker: string
  quantity: number
  averagePrice: number
  currentPrice: number
  returnPercentage: number
}

interface RecoveryCalculatorSheetProps {
  holding: Holding | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ScenarioRow({ label, qty, investment }: { label: string; qty: number; investment: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-3 last:border-0">
      <dt className="text-sm text-foreground">{label}</dt>
      <dd className="text-right text-sm tabular-nums">
        <span className="font-medium text-foreground">{formatNumber(qty, { digits: 0 })} ações</span>
        <span className="block text-xs text-muted-foreground">{formatBRL(investment)}</span>
      </dd>
    </div>
  )
}

/** Simulação de aporte para reduzir o preço médio de um ativo abaixo do preço pago. */
export function RecoveryCalculatorSheet({
  holding,
  open,
  onOpenChange,
}: RecoveryCalculatorSheetProps) {
  const [showFullCalculator, setShowFullCalculator] = useState(false)

  if (!holding) return null

  // Queda atual em pontos percentuais (a calculadora recebe % e não fração).
  const currentDrop = holding.averagePrice > 0
    ? ((holding.averagePrice - holding.currentPrice) / holding.averagePrice) * 100
    : 0

  const breakEvenResult = currentDrop > 0
    ? calculateRecovery({
        currentQty: holding.quantity,
        avgPrice: holding.averagePrice,
        currentPrice: holding.currentPrice,
        targetRise: currentDrop,
        targetProfit: 0,
      })
    : null

  const profit5Result = currentDrop > 0
    ? calculateRecovery({
        currentQty: holding.quantity,
        avgPrice: holding.averagePrice,
        currentPrice: holding.currentPrice,
        targetRise: currentDrop + 10,
        targetProfit: 5,
      })
    : null

  const handleOpenChange = (next: boolean) => {
    if (!next) setShowFullCalculator(false)
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="pr-14">
          <SheetTitle>Simulação de aporte · {holding.ticker}</SheetTitle>
          <SheetDescription>
            Preço médio {formatBRL(holding.averagePrice)} · preço atual {formatBRL(holding.currentPrice)} (
            {formatDeltaPct(holding.averagePrice > 0 ? holding.currentPrice / holding.averagePrice - 1 : null)})
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {!showFullCalculator ? (
            <>
              <p className="text-sm text-muted-foreground">
                Quantidade estimada para que o novo preço médio permita cada cenário, considerando o preço atual.
                É uma simulação, não é recomendação.
              </p>

              {(breakEvenResult?.success || profit5Result?.success) && (
                <dl className="rounded-lg border border-border bg-card px-4">
                  {breakEvenResult?.success && (
                    <ScenarioRow
                      label="Voltar ao preço pago"
                      qty={breakEvenResult.qtyToBuy}
                      investment={breakEvenResult.investmentRequired}
                    />
                  )}
                  {profit5Result?.success && (
                    <ScenarioRow
                      label="Resultado de +5%"
                      qty={profit5Result.qtyToBuy}
                      investment={profit5Result.investmentRequired}
                    />
                  )}
                </dl>
              )}

              <Button variant="outline" className="w-full" onClick={() => setShowFullCalculator(true)}>
                <Calculator strokeWidth={1.75} aria-hidden="true" />
                Abrir calculadora completa
              </Button>
            </>
          ) : (
            <RecoveryCalculator
              initialValues={{
                currentQty: holding.quantity,
                avgPrice: holding.averagePrice,
                currentPrice: holding.currentPrice,
                ticker: holding.ticker,
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
