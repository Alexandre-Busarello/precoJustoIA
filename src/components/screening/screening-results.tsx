"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { CompanyLogo } from "@/components/company-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { formatBRL } from "@/lib/format"
import { formatMarginOfSafety } from "@/lib/valuation-metrics"
import { cn } from "@/lib/utils"
import {
  dipReason,
  FII_METRIC_ORDER,
  formatMetricValue,
  metricHint,
  metricTone,
  resultMargin,
  STOCK_METRIC_ORDER,
  translateMetricName,
  visibleMetricKeys,
  type ScreeningResult,
} from "./screening-metrics"

const TONE_CLASS = { positive: "text-positive", negative: "text-negative", neutral: "text-foreground" } as const

function marginTone(value: number | null) {
  if (value === null || value === 0) return TONE_CLASS.neutral
  return value > 0 ? TONE_CLASS.positive : TONE_CLASS.negative
}

function assetHref(result: ScreeningResult, isFii: boolean) {
  return isFii ? `/fii/${result.ticker.toLowerCase()}` : `/acao/${result.ticker.toLowerCase()}`
}

function LowLiquidityBadge() {
  return (
    <Badge variant="warning" className="shrink-0">
      Baixa liquidez
    </Badge>
  )
}

const MARGIN_HINT =
  "1 − preço ÷ preço justo, pelo modelo indicado abaixo do preço justo. Positiva quando o preço está abaixo do preço justo. É uma estimativa baseada em modelos e não é recomendação de investimento."

interface ScreeningResultsProps {
  results: ScreeningResult[]
  isFii: boolean
  /** Renderiza cards (mobile) em vez da tabela. */
  compact: boolean
  loading: boolean
}

export function ScreeningResults({ results, isFii, compact, loading }: ScreeningResultsProps) {
  const metricKeys = useMemo(
    () => visibleMetricKeys(results, isFii ? FII_METRIC_ORDER : STOCK_METRIC_ORDER),
    [results, isFii]
  )
  const showDipReason = useMemo(() => results.some((result) => dipReason(result.key_metrics) !== null), [results])
  const fairValueHint = isFii
    ? "Preço teto pelo dividend yield alvo ou valor patrimonial, conforme o modelo indicado."
    : "Maior estimativa entre os modelos disponíveis (Graham para todos; FCD e Gordon no Premium). É uma estimativa e não é recomendação."

  if (compact) {
    return <ResultCards results={results} isFii={isFii} metricKeys={metricKeys} />
  }

  const columns: DataTableColumn<ScreeningResult>[] = [
    {
      key: "ticker",
      header: "Ativo",
      sortable: true,
      sortValue: (row) => row.ticker,
      cell: (row) => (
        <Link
          href={assetHref(row, isFii)}
          className="flex min-w-0 items-center gap-2 py-0.5 hover:text-brand"
          onClick={(event) => event.stopPropagation()}
        >
          <CompanyLogo ticker={row.ticker} logoUrl={row.logoUrl} size={24} companyName={row.name} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">{row.ticker}</span>
              {row.lowLiquidity && <LowLiquidityBadge />}
            </span>
            <span className="block max-w-[180px] truncate text-xs text-muted-foreground">{row.name}</span>
          </span>
        </Link>
      ),
    },
    {
      key: "currentPrice",
      header: "Preço",
      align: "right",
      sortable: true,
      cell: (row) => formatBRL(row.currentPrice),
    },
    {
      key: "fairValue",
      header: "Preço justo",
      align: "right",
      sortable: true,
      hint: fairValueHint,
      cell: (row) => (
        <span className="flex flex-col items-end">
          <span>{formatBRL(row.fairValue)}</span>
          {row.fairValueModel && <span className="text-xs text-muted-foreground">{row.fairValueModel}</span>}
        </span>
      ),
    },
    {
      key: "marginOfSafety",
      header: "Margem de segurança",
      align: "right",
      sortable: true,
      hint: MARGIN_HINT,
      sortValue: (row) => resultMargin(row),
      cell: (row) => {
        const value = resultMargin(row)
        return <span className={cn("font-medium", marginTone(value))}>{formatMarginOfSafety(value)}</span>
      },
    },
    ...(showDipReason
      ? [
          {
            key: "dipReason",
            header: "Queda e fundamentos",
            hint: "Posição do preço vs. a média móvel de 200 pregões e a máxima de 52 semanas, e a variação do lucro e do ROE no último período de 12 meses.",
            cell: (row: ScreeningResult) => (
              <span className="whitespace-nowrap text-xs text-muted-foreground">{dipReason(row.key_metrics) ?? "—"}</span>
            ),
          } satisfies DataTableColumn<ScreeningResult>,
        ]
      : []),
    ...metricKeys.map<DataTableColumn<ScreeningResult>>((key) => ({
      key,
      header: translateMetricName(key),
      hint: metricHint(key),
      align: "right",
      sortable: true,
      sortValue: (row) => row.key_metrics?.[key] ?? null,
      cell: (row) => {
        const value = row.key_metrics?.[key]
        return <span className={TONE_CLASS[metricTone(key, value)]}>{formatMetricValue(key, value)}</span>
      },
    })),
  ]

  return (
    <DataTable
      columns={columns}
      rows={results}
      getRowId={(row) => row.ticker}
      stickyFirstColumn
      dense
      loading={loading && results.length === 0}
      loadingRows={8}
      maxHeight="calc(100dvh - 15rem)"
      caption={isFii ? "Resultados do screening de FIIs" : "Resultados do screening de ações"}
    />
  )
}

const CARD_PAGE_SIZE = 20

function ResultCards({ results, isFii, metricKeys }: { results: ScreeningResult[]; isFii: boolean; metricKeys: string[] }) {
  const [visible, setVisible] = useState(CARD_PAGE_SIZE)
  const [prevResults, setPrevResults] = useState(results)
  if (results !== prevResults) {
    setPrevResults(results)
    setVisible(CARD_PAGE_SIZE)
  }

  const shown = results.slice(0, visible)
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {shown.map((result) => (
          <li key={result.ticker}>
            <ResultCard result={result} isFii={isFii} metricKeys={metricKeys} />
          </li>
        ))}
      </ul>
      {results.length > visible && (
        <Button variant="outline" className="h-11 w-full" onClick={() => setVisible((current) => current + CARD_PAGE_SIZE)}>
          Mostrar mais {Math.min(CARD_PAGE_SIZE, results.length - visible)}
        </Button>
      )}
    </div>
  )
}

function CardStat({ label, value, detail, className }: { label: string; value: string; detail?: string | null; className?: string }) {
  return (
    <div className="min-w-0 break-words">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-medium tabular-nums text-foreground", className)}>{value}</p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}

function ResultCard({ result, isFii, metricKeys }: { result: ScreeningResult; isFii: boolean; metricKeys: string[] }) {
  const [open, setOpen] = useState(false)
  const value = resultMargin(result)
  const reason = dipReason(result.key_metrics)
  const withValues = metricKeys.filter((key) => result.key_metrics?.[key] !== undefined)
  const primary = withValues.slice(0, 4)
  const extra = withValues.slice(4)

  const metricStat = (key: string) => {
    const metricValue = result.key_metrics?.[key]
    return (
      <CardStat
        key={key}
        label={translateMetricName(key)}
        value={formatMetricValue(key, metricValue)}
        className={TONE_CLASS[metricTone(key, metricValue)]}
      />
    )
  }

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex min-w-0 items-start gap-3">
        <CompanyLogo ticker={result.ticker} logoUrl={result.logoUrl} size={36} companyName={result.name} />
        <Link href={assetHref(result, isFii)} className="min-w-0 flex-1 hover:text-brand">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-foreground">{result.ticker}</span>
            {result.lowLiquidity && <LowLiquidityBadge />}
          </p>
          <p className="truncate text-sm text-muted-foreground">{result.name}</p>
        </Link>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">Margem de segurança</p>
          <p className={cn("text-sm font-semibold tabular-nums", marginTone(value))}>{formatMarginOfSafety(value)}</p>
        </div>
      </div>

      {reason && <p className="mt-2 text-xs tabular-nums text-muted-foreground">{reason}</p>}

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <CardStat label="Preço" value={formatBRL(result.currentPrice)} />
        <CardStat label="Preço justo" value={formatBRL(result.fairValue)} detail={result.fairValueModel} />
      </div>

      {primary.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3">{primary.map(metricStat)}</div>
          {extra.length > 0 && (
            <>
              <CollapsibleContent>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">{extra.map(metricStat)}</div>
              </CollapsibleContent>
              <CollapsibleTrigger className="mt-2 min-h-11 justify-start gap-1 text-sm font-medium text-brand hover:no-underline">
                {open ? "Mostrar menos" : `Mais ${extra.length} indicadores`}
                <ChevronDown className="size-4 transition-transform" strokeWidth={1.75} aria-hidden="true" />
              </CollapsibleTrigger>
            </>
          )}
        </Collapsible>
      )}
    </article>
  )
}
