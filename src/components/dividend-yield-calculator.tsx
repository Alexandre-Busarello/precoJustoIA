"use client"

/**
 * Calculadora de dividend yield: formulário à esquerda e resultado à direita (desktop).
 * Logado, o cálculo leva direto ao relatório completo; sem login, o cadastro só abre quando o usuário pede o relatório.
 */

import { Suspense, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { AssetSearchInput, type CompanySearchResult } from "@/components/asset-search-input"
import { DividendYieldRegisterModal } from "@/components/dividend-yield-register-modal"
import type { DividendYieldResult } from "@/components/dividend-yield-results"
import { MoneyInput } from "@/app/calculadoras/_components/money-input"
import { parseBRL } from "@/app/calculadoras/_components/money-mask"

const DividendYieldResults = dynamic(
  () => import("@/components/dividend-yield-results").then((m) => m.DividendYieldResults),
  { ssr: false, loading: () => <ResultsSkeleton /> }
)

function ResultsSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5" aria-busy="true">
      <Skeleton className="h-5 w-56" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

function reportUrl(ticker: string, amount: number) {
  return `/calculadoras/dividend-yield/${ticker}/report?investmentAmount=${amount}`
}

function DividendYieldCalculatorContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [ticker, setTicker] = useState("")
  const [amountText, setAmountText] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DividendYieldResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRegisterModal, setShowRegisterModal] = useState(false)

  useEffect(() => {
    const tickerParam = searchParams?.get("ticker")
    if (tickerParam) setTicker(tickerParam.toUpperCase())
  }, [searchParams])

  const amount = parseBRL(amountText)

  const handleCalculate = async () => {
    const symbol = ticker.trim().toUpperCase()
    if (!symbol) return setError("Informe o ticker da ação.")
    if (!amount || amount <= 0) return setError("Informe o valor investido.")

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/calculators/dividend-yield", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol, investmentAmount: amount }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Não foi possível calcular o dividend yield.")

      if (session?.user) {
        window.location.href = reportUrl(symbol, amount)
        return
      }
      setResult(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível calcular o dividend yield.")
    } finally {
      setLoading(false)
    }
  }

  const handleViewFullReport = () => {
    if (!result || !amount) return
    if (session) window.location.href = reportUrl(result.ticker, amount)
    else setShowRegisterModal(true)
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <form
        className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5 lg:sticky lg:top-20"
        onSubmit={(event) => {
          event.preventDefault()
          handleCalculate()
        }}
        noValidate
      >
        <h2 className="text-sm font-medium text-foreground">Dados do cálculo</h2>
        <AssetSearchInput
          id="dy-ticker"
          label="Ação"
          placeholder="Ticker ou nome, ex.: TAEE11"
          value={ticker}
          initialValue={ticker}
          onCompanySelect={(company: CompanySearchResult) => {
            setTicker(company.ticker.toUpperCase())
            setError(null)
          }}
          onQueryChange={(query: string) => setTicker(query.trim().toUpperCase())}
          onSubmit={() => document.getElementById("dy-amount")?.focus()}
          disabled={loading}
        />
        <div className="space-y-2">
          <Label htmlFor="dy-amount">Valor investido</Label>
          <MoneyInput
            id="dy-amount"
            placeholder="10.000,00"
            value={amountText}
            onValueChange={setAmountText}
            disabled={loading}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading || !ticker.trim() || !amount}>
          {loading && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
          {loading ? "Calculando" : "Calcular renda"}
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          Usa os proventos pagos nos últimos 12 meses e a cotação atual. Proventos passados não garantem pagamentos
          futuros.
        </p>
      </form>

      <div className="min-w-0" aria-live="polite">
        {loading ? (
          <ResultsSkeleton />
        ) : result && amount ? (
          <DividendYieldResults
            result={result}
            investmentAmount={amount}
            onViewFullReport={handleViewFullReport}
            isAuthenticated={!!session}
          />
        ) : (
          <div className="flex min-h-48 flex-col justify-center rounded-lg border border-dashed border-border p-6 text-center lg:min-h-80">
            <p className="text-sm font-medium text-foreground">O resultado aparece aqui</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha uma ação e informe o valor para ver o dividend yield e a renda mensal estimada.
            </p>
          </div>
        )}
      </div>

      {result && (
        <DividendYieldRegisterModal
          isOpen={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          ticker={result.ticker}
          investmentAmount={amount ? String(amount) : ""}
        />
      )}
    </div>
  )
}

export function DividendYieldCalculator() {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full" />}>
      <DividendYieldCalculatorContent />
    </Suspense>
  )
}
