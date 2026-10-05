"use client"

/**
 * Resultado da calculadora de dividend yield: Stats principais, proventos dos últimos 12 meses e convite ao relatório.
 */

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Stat } from "@/components/ui/stat"
import { formatBRL, formatDate, formatNumber, formatPct } from "@/lib/format"

export interface DividendYieldResult {
  ticker: string
  companyName: string
  currentPrice: number
  /** Fração (0,085 = 8,5%). */
  dividendYield: number
  monthlyIncome: number
  annualIncome: number
  lastDividend: { amount: number; date: Date | string }
  dividendHistory: Array<{ date: Date | string; amount: number }>
  averageMonthlyDividend: number
  averageQuarterlyDividend: number
  totalDividendsLast12Months: number
}

interface DividendYieldResultsProps {
  result: DividendYieldResult
  investmentAmount: number
  onViewFullReport: () => void
  isAuthenticated: boolean
}

const AXIS_TICK = { fontSize: 12, fill: "var(--muted-foreground)" } as const

export function DividendYieldResults({ result, investmentAmount, onViewFullReport, isAuthenticated }: DividendYieldResultsProps) {
  const shares = result.currentPrice > 0 ? investmentAmount / result.currentPrice : 0
  const chartData = result.dividendHistory
    .slice(0, 12)
    .reverse()
    .map((div) => ({ label: formatDate(div.date), amount: div.amount }))

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {result.ticker} <span className="text-sm font-normal text-muted-foreground">{result.companyName}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Cotação <span className="font-medium tabular-nums text-foreground">{formatBRL(result.currentPrice)}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Renda mensal média" value={formatBRL(result.monthlyIncome)} caption="estimativa" />
          <Stat label="Renda em 12 meses" value={formatBRL(result.annualIncome)} caption="estimativa" />
          <Stat
            label="Dividend yield"
            value={formatPct(result.dividendYield)}
            caption="últimos 12 meses"
            hint="Proventos pagos nos últimos 12 meses divididos pela cotação atual."
          />
          <Stat
            label="Último provento"
            value={formatBRL(result.lastDividend.amount)}
            caption={formatDate(result.lastDividend.date)}
          />
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-border pt-4 text-sm sm:grid-cols-3">
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-muted-foreground">Proventos por ação em 12 meses</dt>
            <dd className="font-medium tabular-nums">{formatBRL(result.totalDividendsLast12Months)}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-muted-foreground">Média mensal por ação</dt>
            <dd className="font-medium tabular-nums">{formatBRL(result.averageMonthlyDividend)}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-muted-foreground">Ações compradas com o valor</dt>
            <dd className="font-medium tabular-nums">{formatNumber(Math.floor(shares), { digits: 0 })}</dd>
          </div>
        </dl>
      </section>

      {chartData.length > 0 && (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
          <h3 className="text-sm font-medium text-foreground">Proventos por ação, últimos pagamentos</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(value: number) => formatBRL(value)}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as { label: string; amount: number } | undefined
                    if (!active || !point) return null
                    return (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                        <p className="text-muted-foreground">{point.label}</p>
                        <p className="font-medium tabular-nums">{formatBRL(point.amount)} por ação</p>
                        {shares > 0 && (
                          <p className="text-muted-foreground tabular-nums">{formatBRL(point.amount * shares)} no seu valor</p>
                        )}
                      </div>
                    )
                  }}
                />
                <Bar dataKey="amount" fill="var(--chart-1)" radius={[2, 2, 0, 0]} maxBarSize={32} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-foreground">Relatório completo de {result.ticker}</h3>
          <p className="text-sm text-muted-foreground">
            Sustentabilidade dos proventos, histórico de 5 anos, comparação com o setor e cenários de renda.
            {!isAuthenticated && " Requer conta gratuita."}
          </p>
        </div>
        <Button onClick={onViewFullReport} className="shrink-0">
          {isAuthenticated ? "Ver relatório" : "Criar conta e ver relatório"}
        </Button>
      </section>
    </div>
  )
}
