"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Calculator } from "lucide-react"
import { RecoveryCalculator } from "@/components/recovery-calculator"
import { calculateRecovery } from "@/lib/recovery-calculator-utils"

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function RecoveryCalculatorSheet({
  holding,
  open,
  onOpenChange,
}: RecoveryCalculatorSheetProps) {
  const [showFullCalculator, setShowFullCalculator] = useState(false)

  if (!holding) return null

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

  const lucro5Result = currentDrop > 0
    ? calculateRecovery({
        currentQty: holding.quantity,
        avgPrice: holding.averagePrice,
        currentPrice: holding.currentPrice,
        targetRise: currentDrop + 10,
        targetProfit: 5,
      })
    : null

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setShowFullCalculator(false)
    }
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Recuperação - {holding.ticker}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {!showFullCalculator ? (
            <>
              <p className="text-sm text-muted-foreground">
                Sugestões de aporte para este ativo em queda:
              </p>

              {breakEvenResult?.success && (
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-200 mb-1">
                    Para empatar
                  </p>
                  <p className="text-sm">
                    Compre <strong>{breakEvenResult.qtyToBuy}</strong> ações (
                    {formatCurrency(breakEvenResult.investmentRequired)})
                  </p>
                </div>
              )}

              {lucro5Result?.success && (
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <p className="font-semibold text-sm text-blue-800 dark:text-blue-200 mb-1">
                    Para lucrar 5%
                  </p>
                  <p className="text-sm">
                    Compre <strong>{lucro5Result.qtyToBuy}</strong> ações (
                    {formatCurrency(lucro5Result.investmentRequired)})
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowFullCalculator(true)}
              >
                <Calculator className="w-4 h-4 mr-2" />
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
