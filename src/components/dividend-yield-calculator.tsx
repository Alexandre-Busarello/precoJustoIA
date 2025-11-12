"use client"

import { useState, useEffect, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Calculator } from "lucide-react"
import { DividendYieldResults } from "@/components/dividend-yield-results"
import { DividendYieldRegisterModal } from "@/components/dividend-yield-register-modal"
import { AssetSearchInput, CompanySearchResult } from "@/components/asset-search-input"

interface CalculationResult {
  ticker: string
  companyName: string
  currentPrice: number
  dividendYield: number
  monthlyIncome: number
  annualIncome: number
  lastDividend: {
    amount: number
    date: Date
  }
  dividendHistory: Array<{
    date: Date
    amount: number
  }>
  averageMonthlyDividend: number
  averageQuarterlyDividend: number
  totalDividendsLast12Months: number
}

function DividendYieldCalculatorContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [ticker, setTicker] = useState("")
  const [investmentAmount, setInvestmentAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRegisterModal, setShowRegisterModal] = useState(false)

  // Ler ticker da query param ao montar o componente
  useEffect(() => {
    const tickerParam = searchParams?.get("ticker")
    if (tickerParam && tickerParam.toUpperCase() !== ticker) {
      setTicker(tickerParam.toUpperCase())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleCalculate = async () => {
    if (!ticker.trim()) {
      setError("Por favor, informe o ticker da ação")
      return
    }

    const amount = parseFloat(investmentAmount.replace(/[^\d,.-]/g, "").replace(",", "."))
    if (!amount || amount <= 0) {
      setError("Por favor, informe um valor investido válido")
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/calculators/dividend-yield", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticker: ticker.toUpperCase().trim(),
          investmentAmount: amount,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao calcular dividend yield")
      }

      setResult(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar cálculo")
    } finally {
      setLoading(false)
    }
  }

  const handleViewFullReport = () => {
    if (!session) {
      setShowRegisterModal(true)
    } else {
      // Redirecionar para página de relatório completo
      window.location.href = `/calculadoras/dividend-yield/${result?.ticker}/report?investmentAmount=${investmentAmount}`
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Calculadora de Dividend Yield
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <AssetSearchInput
                label="Ticker da Ação"
                placeholder="Digite o ticker ou nome da empresa..."
                value={ticker}
                initialValue={ticker}
                onCompanySelect={(company: CompanySearchResult) => {
                  // Quando seleciona da lista, atualizar ticker imediatamente
                  const tickerUpper = company.ticker.toUpperCase()
                  setTicker(tickerUpper)
                  // Limpar erro se houver
                  if (error) {
                    setError(null)
                  }
                }}
                onQueryChange={(query: string) => {
                  // Quando usuário digita diretamente, atualizar ticker em tempo real
                  if (query.trim().length > 0) {
                    setTicker(query.toUpperCase().trim())
                  } else {
                    setTicker("")
                  }
                }}
                disabled={loading}
                error={error && !ticker.trim() ? "Por favor, informe o ticker da ação" : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="investmentAmount">Valor Investido (R$)</Label>
              <Input
                id="investmentAmount"
                type="text"
                placeholder="Ex: 10.000,00"
                value={investmentAmount}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d,.-]/g, "")
                  setInvestmentAmount(value)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCalculate()
                  }
                }}
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <Button
            onClick={handleCalculate}
            disabled={loading || !ticker?.trim() || !investmentAmount?.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4 mr-2" />
                Calcular Dividend Yield
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <DividendYieldResults
          result={result}
          investmentAmount={parseFloat(investmentAmount.replace(/[^\d,.-]/g, "").replace(",", "."))}
          onViewFullReport={handleViewFullReport}
          isAuthenticated={!!session}
        />
      )}

      {showRegisterModal && (
        <DividendYieldRegisterModal
          isOpen={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          ticker={result?.ticker || ""}
          investmentAmount={investmentAmount}
        />
      )}
    </div>
  )
}

export function DividendYieldCalculator() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Carregando calculadora...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <DividendYieldCalculatorContent />
    </Suspense>
  )
}

