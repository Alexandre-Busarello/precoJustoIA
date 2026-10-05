"use client"

/**
 * Relatório completo da calculadora de dividend yield (exige login).
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AlertTriangle } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/ui/section-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Stat } from "@/components/ui/stat"
import { formatBRL, formatDeltaPct, formatNumber, formatPct } from "@/lib/format"

interface BreakdownItem {
  points: number
  maxPoints: number
  value: number | null
  description: string
}

interface ReportData {
  ticker: string
  companyName: string
  currentPrice: number
  /** Frações (0,085 = 8,5%) em dividendYield, roe, payout, margemLiquida e sectorAverage. */
  dividendYield: number
  monthlyIncome: number
  annualIncome: number
  lastDividend: { amount: number; date: Date | string }
  dividendHistory: Array<{ date: Date | string; amount: number }>
  sustainability: {
    roe: number | null
    payout: number | null
    margemLiquida: number | null
    liquidezCorrente: number | null
    dividendTrapAlerts: string[]
    score: number
    breakdown: {
      roe: BreakdownItem
      payout: BreakdownItem
      margemLiquida: BreakdownItem
      liquidezCorrente: BreakdownItem
    }
  }
  sectorComparison: {
    sectorAverage: number | null
    companySector: string | null
    isAboveAverage: boolean | null
  }
  projections: {
    conservative: { monthly: number; annual: number }
    optimistic: { monthly: number; annual: number }
  }
  historicalTrend: {
    trend: "increasing" | "decreasing" | "stable"
    /** Fração. */
    averageGrowth: number
    /** 0 a 100. */
    consistency: number
  }
}

const TREND_LABEL: Record<ReportData["historicalTrend"]["trend"], string> = {
  increasing: "Crescente",
  decreasing: "Decrescente",
  stable: "Estável",
}

const BREAKDOWN: Array<{
  key: keyof ReportData["sustainability"]["breakdown"]
  label: string
  help: string
  format: (value: number) => string
}> = [
  {
    key: "roe",
    label: "ROE",
    help: "Rentabilidade sobre o patrimônio líquido: capacidade de gerar lucro com o capital dos sócios.",
    format: (v) => formatPct(v),
  },
  {
    key: "payout",
    label: "Payout",
    help: "Parcela do lucro distribuída como proventos. Entre 30% e 60% costuma equilibrar distribuição e reinvestimento.",
    format: (v) => formatPct(v),
  },
  {
    key: "margemLiquida",
    label: "Margem líquida",
    help: "Lucro líquido sobre a receita: eficiência para transformar vendas em lucro.",
    format: (v) => formatPct(v),
  },
  {
    key: "liquidezCorrente",
    label: "Liquidez corrente",
    help: "Ativo circulante sobre passivo circulante: folga para pagar obrigações de curto prazo.",
    format: (v) => formatNumber(v, { digits: 2 }),
  },
]

const AXIS_TICK = { fontSize: 12, fill: "var(--muted-foreground)" } as const

function ReportSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8" aria-busy="true">
      <Skeleton className="h-8 w-80 max-w-full" />
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  )
}

export default function DividendYieldReportPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { status } = useSession()
  const ticker = params.ticker as string
  const investmentAmount = Number(searchParams.get("investmentAmount") || 0)

  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") {
      router.push(`/calculadoras/dividend-yield?ticker=${encodeURIComponent(ticker)}`)
      return
    }
    if (!ticker || !investmentAmount) {
      setError("Informe a ação e o valor investido na calculadora.")
      setLoading(false)
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const response = await fetch(
          `/api/calculators/dividend-yield/report?ticker=${encodeURIComponent(ticker)}&investmentAmount=${investmentAmount}`
        )
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.error || "Não foi possível carregar o relatório.")
        if (!cancelled) setReportData(data.data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar o relatório.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [status, ticker, investmentAmount, router])

  if (status === "loading" || loading) return <ReportSkeleton />

  if (error || !reportData) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-base font-medium text-foreground">Não foi possível abrir o relatório</p>
          <p className="mt-1 text-sm text-muted-foreground">{error || "Relatório não encontrado."}</p>
          <Button asChild className="mt-4">
            <Link href="/calculadoras/dividend-yield">Voltar para a calculadora</Link>
          </Button>
        </div>
      </div>
    )
  }

  const shares = reportData.currentPrice > 0 ? investmentAmount / reportData.currentPrice : 0
  const yearly = new Map<number, number>()
  reportData.dividendHistory.forEach((div) => {
    const year = new Date(div.date).getFullYear()
    yearly.set(year, (yearly.get(year) || 0) + div.amount)
  })
  const yearlyChartData = Array.from(yearly.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-5)
    .map(([year, total]) => ({ year: String(year), total, income: total * shares }))

  const { sustainability, sectorComparison, projections, historicalTrend } = reportData
  const hasFinancialExclusions =
    sustainability.breakdown.margemLiquida.maxPoints === 0 || sustainability.breakdown.liquidezCorrente.maxPoints === 0

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
      <PageHeader
        breadcrumb={[
          { label: "Calculadoras", href: "/calculadoras" },
          { label: "Dividend yield", href: "/calculadoras/dividend-yield" },
          { label: reportData.ticker },
        ]}
        title={`Relatório de dividendos: ${reportData.ticker}`}
        description={`${reportData.companyName}. Simulação com ${formatBRL(investmentAmount)} investidos.`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/calculadoras/dividend-yield">Nova simulação</Link>
          </Button>
        }
      />

      <section aria-label="Resumo" className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-4 sm:p-5">
        <Stat label="Renda mensal média" value={formatBRL(reportData.monthlyIncome)} caption="estimativa" />
        <Stat label="Renda em 12 meses" value={formatBRL(reportData.annualIncome)} caption="estimativa" />
        <Stat label="Dividend yield" value={formatPct(reportData.dividendYield)} caption="últimos 12 meses" />
        <Stat
          label="Sustentabilidade"
          value={`${formatNumber(sustainability.score, { digits: 0 })}/100`}
          hint="Score de 0 a 100 que combina ROE, payout, margem líquida e liquidez corrente."
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
          <SectionHeader as="h2" title="Proventos por ação nos últimos anos" />
          {yearlyChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="year" tick={AXIS_TICK} tickLine={false} axisLine={false} />
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
                      const point = payload?.[0]?.payload as { year: string; total: number; income: number } | undefined
                      if (!active || !point) return null
                      return (
                        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                          <p className="text-muted-foreground">{point.year}</p>
                          <p className="font-medium tabular-nums">{formatBRL(point.total)} por ação</p>
                          <p className="text-muted-foreground tabular-nums">{formatBRL(point.income)} no seu valor</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="total" fill="var(--chart-1)" radius={[2, 2, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem histórico de proventos suficiente.</p>
          )}
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
          <SectionHeader as="h2" title="Regularidade dos pagamentos" />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Tendência" value={TREND_LABEL[historicalTrend.trend]} size="sm" />
            <Stat label="Crescimento médio" value={formatDeltaPct(historicalTrend.averageGrowth)} size="sm" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Consistência</span>
              <span className="font-medium tabular-nums">{formatPct(historicalTrend.consistency / 100, { digits: 0 })}</span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-label="Consistência dos pagamentos"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={historicalTrend.consistency}
            >
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, historicalTrend.consistency))}%` }} />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Mede a regularidade dos intervalos entre pagamentos. Empresas que pagam em intervalos constantes (mensal,
              trimestral) têm consistência maior.
            </p>
          </div>
        </section>
      </div>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
        <SectionHeader
          as="h2"
          title="Sustentabilidade dos proventos"
          description="Como o score de sustentabilidade é formado. Pesos: ROE 30%, payout 25%, margem líquida 25%, liquidez corrente 20%."
          actions={<Badge variant="neutral">{formatNumber(sustainability.score, { digits: 0 })}/100</Badge>}
        />
        <ul className="divide-y divide-border rounded-lg border border-border">
          {BREAKDOWN.map(({ key, label, help, format }) => {
            const item = sustainability.breakdown[key]
            const applicable = item.maxPoints > 0
            const share = applicable ? Math.min(100, (item.points / item.maxPoints) * 100) : 0
            return (
              <li key={key} className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_160px] sm:items-center sm:gap-6">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span className="text-sm tabular-nums text-foreground">{item.value !== null ? format(item.value) : "—"}</span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {applicable ? help : "Não se aplica a empresas do setor financeiro."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                  </div>
                  <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                    {applicable ? `${formatNumber(item.points, { digits: 0 })}/${formatNumber(item.maxPoints, { digits: 0 })} pts` : "—"}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="text-xs leading-5 text-muted-foreground">
          O score é proporcional ao máximo possível com os dados disponíveis.
          {hasFinancialExclusions &&
            " Em empresas do setor financeiro, margem líquida e liquidez corrente ficam fora do cálculo."}
        </p>

        {sustainability.dividendTrapAlerts.length > 0 && (
          <div className="flex gap-3 rounded-lg bg-warning-subtle p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">Pontos de atenção (possível armadilha de dividendos)</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                {sustainability.dividendTrapAlerts.map((alert) => (
                  <li key={alert}>{alert}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {sectorComparison.sectorAverage !== null && (
          <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
            <SectionHeader
              as="h2"
              title="Comparação com o setor"
              description={sectorComparison.companySector ?? undefined}
              actions={
                sectorComparison.isAboveAverage !== null && (
                  <Badge variant="neutral">
                    {sectorComparison.isAboveAverage ? "DY acima da média do setor" : "DY abaixo da média do setor"}
                  </Badge>
                )
              }
            />
            <div className="grid grid-cols-2 gap-4">
              <Stat label={`Dividend yield de ${reportData.ticker}`} value={formatPct(reportData.dividendYield)} />
              <Stat label="Média do setor" value={formatPct(sectorComparison.sectorAverage)} />
            </div>
          </section>
        )}

        <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
          <SectionHeader
            as="h2"
            title="Cenários de renda"
            description="Estimativas com proventos 20% menores ou 20% maiores que os dos últimos 12 meses."
          />
          <div className="grid grid-cols-2 gap-4">
            <Stat
              label="Cenário conservador"
              value={formatBRL(projections.conservative.monthly)}
              caption={`por mês, ${formatBRL(projections.conservative.annual)} por ano`}
            />
            <Stat
              label="Cenário otimista"
              value={formatBRL(projections.optimistic.monthly)}
              caption={`por mês, ${formatBRL(projections.optimistic.annual)} por ano`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Estimativas a partir da tendência histórica. Os pagamentos reais podem ser diferentes.
          </p>
        </section>
      </div>
    </div>
  )
}
