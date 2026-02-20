"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  TrendingDown,
  Target,
  AlertTriangle,
  Calculator,
} from "lucide-react"
import {
  calculateRecovery,
  calculateCurrentDrop,
  calculateLossInReais,
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

function parseNum(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".")
  return parseFloat(cleaned) || 0
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function RecoveryCalculator({
  initialValues,
  onUsageRecord,
  compact = false,
}: RecoveryCalculatorProps) {
  const [avgPrice, setAvgPrice] = useState(
    initialValues?.avgPrice ? String(initialValues.avgPrice) : ""
  )
  const [currentQty, setCurrentQty] = useState(
    initialValues?.currentQty ? String(initialValues.currentQty) : ""
  )
  const [currentPrice, setCurrentPrice] = useState(
    initialValues?.currentPrice ? String(initialValues.currentPrice) : ""
  )
  const [targetRise, setTargetRise] = useState("")
  const [targetProfit, setTargetProfit] = useState("0")
  const lastRegisteredResultKeyRef = useRef<string | null>(null)

  const avgPriceNum = parseNum(avgPrice)
  const currentQtyNum = Math.floor(parseNum(currentQty)) || 0
  const currentPriceNum = parseNum(currentPrice)
  const targetRiseNum = parseNum(targetRise)
  const targetProfitNum = parseNum(targetProfit)

  const currentDrop = useMemo(() => {
    if (avgPriceNum <= 0 || currentPriceNum <= 0) return 0
    return calculateCurrentDrop(avgPriceNum, currentPriceNum)
  }, [avgPriceNum, currentPriceNum])

  const lossInReais = useMemo(() => {
    return calculateLossInReais(currentQtyNum, avgPriceNum, currentPriceNum)
  }, [currentQtyNum, avgPriceNum, currentPriceNum])

  const suggestedTargetRise = currentDrop > 0 ? Math.abs(currentDrop) : 0

  const allDiagnosisFieldsComplete =
    avgPriceNum > 0 && currentQtyNum > 0 && currentPriceNum > 0 && currentPriceNum < avgPriceNum

  const handleDiagnosisBlur = () => {
    if (allDiagnosisFieldsComplete && !targetRise && suggestedTargetRise > 0) {
      setTargetRise(suggestedTargetRise.toFixed(1))
    }
  }

  const result = useMemo((): RecoveryCalculation | null => {
    if (
      currentQtyNum <= 0 ||
      avgPriceNum <= 0 ||
      currentPriceNum <= 0 ||
      targetRiseNum <= 0
    ) {
      return null
    }
    return calculateRecovery({
      currentQty: currentQtyNum,
      avgPrice: avgPriceNum,
      currentPrice: currentPriceNum,
      targetRise: targetRiseNum,
      targetProfit: targetProfitNum,
    })
  }, [
    currentQtyNum,
    avgPriceNum,
    currentPriceNum,
    targetRiseNum,
    targetProfitNum,
  ])

  const targetPrice = useMemo(() => {
    if (currentPriceNum <= 0 || targetRiseNum <= 0) return 0
    return currentPriceNum * (1 + targetRiseNum / 100)
  }, [currentPriceNum, targetRiseNum])

  useEffect(() => {
    if (!result?.success || !onUsageRecord) return
    const resultKey = `${result.qtyToBuy}-${result.investmentRequired}-${result.newAvgPrice}`
    if (lastRegisteredResultKeyRef.current === resultKey) return
    lastRegisteredResultKeyRef.current = resultKey
    onUsageRecord()
  }, [result, onUsageRecord])

  const isValidInput =
    currentQtyNum > 0 && avgPriceNum > 0 && currentPriceNum > 0

  return (
    <div className="space-y-6">
      {/* Seção A: Diagnóstico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingDown className="w-5 h-5" />
            Diagnóstico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="avgPrice">Preço Médio (R$)</Label>
              <Input
                id="avgPrice"
                type="text"
                placeholder="Ex: 10,00"
                value={avgPrice}
                onChange={(e) => setAvgPrice(e.target.value)}
                onBlur={handleDiagnosisBlur}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentQty">Quantidade</Label>
              <Input
                id="currentQty"
                type="text"
                placeholder="Ex: 100"
                value={currentQty}
                onChange={(e) => setCurrentQty(e.target.value)}
                onBlur={handleDiagnosisBlur}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentPrice">Preço Atual (R$)</Label>
              <Input
                id="currentPrice"
                type="text"
                placeholder="Ex: 5,00"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                onBlur={handleDiagnosisBlur}
              />
            </div>
          </div>
          {isValidInput && currentPriceNum < avgPriceNum && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-sm font-medium text-red-700 dark:text-red-300">
                Queda: {currentDrop.toFixed(1)}% | {formatCurrency(lossInReais)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção B: Estratégia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="w-5 h-5" />
            Estratégia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="targetRise">
              Se o ativo subir... (%)
            </Label>
            <Input
              id="targetRise"
              type="text"
              placeholder={
                allDiagnosisFieldsComplete && suggestedTargetRise > 0
                  ? `Sugestão: ${suggestedTargetRise.toFixed(0)}%`
                  : "Ex: 15"
              }
              value={targetRise}
              onChange={(e) => setTargetRise(e.target.value)}
            />
            {targetRiseNum > 0 && (
              <p className="text-xs text-muted-foreground">
                Vai para {formatCurrency(targetPrice)}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetProfit">E eu quiser sair com... (%)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={targetProfitNum === 0 ? "default" : "outline"}
                size="sm"
                onClick={() => setTargetProfit("0")}
              >
                Empatar (0%)
              </Button>
              <Button
                type="button"
                variant={targetProfitNum === 5 ? "default" : "outline"}
                size="sm"
                onClick={() => setTargetProfit("5")}
              >
                Lucrar 5%
              </Button>
              <Button
                type="button"
                variant={targetProfitNum === 10 ? "default" : "outline"}
                size="sm"
                onClick={() => setTargetProfit("10")}
              >
                Lucrar 10%
              </Button>
              <Input
                id="targetProfit"
                type="text"
                placeholder="Outro"
                value={[0, 5, 10].includes(targetProfitNum) ? "" : targetProfit}
                onChange={(e) => setTargetProfit(e.target.value || "0")}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção C: Plano de Ação */}
      {result && (
        <Card
          className={
            result.success
              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
              : "bg-slate-50 dark:bg-slate-900/50"
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="w-5 h-5" />
              Plano de Ação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.success ? (
              <>
                <div className="text-2xl font-bold">
                  Compre <span className="text-emerald-600 dark:text-emerald-400">{result.qtyToBuy}</span> ações agora.
                </div>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Investimento Necessário:</span>{" "}
                    <strong>{formatCurrency(result.investmentRequired)}</strong>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Novo Preço Médio:</span>{" "}
                    <strong>{formatCurrency(result.newAvgPrice)}</strong>
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {targetProfitNum === 0 ? (
                    <>
                      Fazendo isso, você elimina seu prejuízo totalmente se o ativo subir{" "}
                      <strong>{targetRiseNum.toFixed(0)}%</strong>.
                    </>
                  ) : (
                    <>
                      Fazendo isso, se o ativo subir <strong>{targetRiseNum.toFixed(0)}%</strong>,
                      você recupera tudo e ainda sai com <strong>{targetProfitNum}%</strong> de
                      lucro no bolso ({formatCurrency(result.profitInReais)}).
                    </>
                  )}
                </p>
              </>
            ) : (
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{result.message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
