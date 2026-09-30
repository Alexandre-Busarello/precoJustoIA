"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Info, Loader2 } from "lucide-react"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { useSession } from "next-auth/react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatBRLCompact, formatMultiple, formatNumber, formatPct } from "@/lib/format"
import type { ScreeningPreset } from "@/lib/screening-presets"
import type { ScreeningResponse } from "@/components/screening/screening-metrics"
import { ScreeningResultsBlur } from "./screening-results-blur"
import { SocialShareButton } from "./social-share-button"

interface ScreeningConversionPageProps {
  preset: ScreeningPreset
}

/** Métrica que resume cada estratégia nas linhas de resultado. */
const HIGHLIGHT_METRIC: Record<ScreeningPreset["slug"], string> = {
  "as-acoes-mais-baratas-segundo-graham": "pl",
  "top-vacas-leiteiras-dividendos": "dy",
  "small-caps-crescimento-explosivo": "cagrReceitas",
  "oportunidades-desconto-excessivo": "pvp",
  "ranking-formula-magica-b3": "magicScore",
}

const FREE_RESULT_LIMIT = 3

const SORT_LABELS: Record<string, string> = {
  pl_asc: "Menor P/L primeiro",
  dy_desc: "Maior dividend yield primeiro",
  upside_desc: "Maior upside primeiro",
  magic_score_desc: "Maior score da Fórmula Mágica primeiro",
}

function range(label: string, min: string | null, max: string | null): string | null {
  if (min && max) return `${label} entre ${min} e ${max}`
  if (min) return `${label} a partir de ${min}`
  if (max) return `${label} até ${max}`
  return null
}

/** Critérios da estratégia em texto, formatados com @/lib/format. */
function describeFilters(preset: ScreeningPreset): string[] {
  const p = preset.params
  const pct = (value?: number) => (value === undefined ? null : formatPct(value, { digits: 0 }))
  const mult = (value?: number) => (value === undefined ? null : formatMultiple(value))
  const points = (value?: number) => (value === undefined ? null : `${formatNumber(value, { digits: 0 })}%`)
  const score = (value?: number) => (value === undefined ? null : formatNumber(value, { digits: 0 }))

  if (preset.slug === "ranking-formula-magica-b3") {
    return ["Ordena pela combinação de ROIC alto e earnings yield alto (EV/EBIT baixo)", "Apenas ações da B3"]
  }

  const items = [
    p.plFilter?.enabled ? range("P/L", mult(p.plFilter.min), mult(p.plFilter.max)) : null,
    p.pvpFilter?.enabled ? range("P/VP", mult(p.pvpFilter.min), mult(p.pvpFilter.max)) : null,
    p.margemLiquidaFilter?.enabled ? range("Margem líquida", pct(p.margemLiquidaFilter.min), pct(p.margemLiquidaFilter.max)) : null,
    p.roeFilter?.enabled ? range("ROE", pct(p.roeFilter.min), pct(p.roeFilter.max)) : null,
    p.dyFilter?.enabled ? range("Dividend yield", pct(p.dyFilter.min), pct(p.dyFilter.max)) : null,
    p.payoutFilter?.enabled ? range("Payout", pct(p.payoutFilter.min), pct(p.payoutFilter.max)) : null,
    p.cagrReceitas5aFilter?.enabled
      ? range("CAGR de receitas (5 anos)", pct(p.cagrReceitas5aFilter.min), pct(p.cagrReceitas5aFilter.max))
      : null,
    p.dividaLiquidaEbitdaFilter?.enabled
      ? range("Dívida líquida/EBITDA", mult(p.dividaLiquidaEbitdaFilter.min), mult(p.dividaLiquidaEbitdaFilter.max))
      : null,
    p.marketCapFilter?.enabled
      ? range(
          "Valor de mercado",
          p.marketCapFilter.min === undefined ? null : formatBRLCompact(p.marketCapFilter.min),
          p.marketCapFilter.max === undefined ? null : formatBRLCompact(p.marketCapFilter.max)
        )
      : null,
    p.grahamUpsideFilter?.enabled
      ? range("Upside até o preço justo de Graham", points(p.grahamUpsideFilter.min), points(p.grahamUpsideFilter.max))
      : null,
    p.overallScoreFilter?.enabled ? range("Score geral", score(p.overallScoreFilter.min), score(p.overallScoreFilter.max)) : null,
    p.assetTypeFilter === "b3" ? "Apenas ações da B3" : null,
    p.sortBy && SORT_LABELS[p.sortBy] ? `Ordenação: ${SORT_LABELS[p.sortBy].toLowerCase()}` : null,
  ]
  return items.filter((item): item is string => !!item)
}

export function ScreeningConversionPage({ preset }: ScreeningConversionPageProps) {
  const { isPremium } = usePremiumStatus()
  const { data: session } = useSession()
  const hasFullAccess = !!session && !!isPremium
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<ScreeningResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [showConfig, setShowConfig] = useState(false)
  const [shareUrl, setShareUrl] = useState("")

  useEffect(() => {
    setShareUrl(window.location.href)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const fetchResults = async () => {
      setLoading(true)
      setError(null)
      try {
        const isMagicFormula = preset.slug === "ranking-formula-magica-b3"
        const params = isMagicFormula
          ? { assetTypeFilter: preset.params.assetTypeFilter }
          : {
              ...preset.params,
              includeBDRs: preset.params.assetTypeFilter === "both" || preset.params.assetTypeFilter === "bdr",
            }

        const response = await fetch("/api/rank-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: isMagicFormula ? "magicFormula" : "screening", params }),
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        setResults(await response.json())
      } catch (err) {
        if (controller.signal.aborted) return
        console.error("Erro ao gerar screening:", err)
        setError("Não foi possível carregar os resultados.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    fetchResults()
    return () => controller.abort()
  }, [preset, retryToken])

  const filters = describeFilters(preset)
  const count = results?.count ?? 0
  const shown = results?.results.length ?? 0
  // Fora do Premium o backend corta em 3 antes de contar; nesse caso não afirmamos o total.
  const countKnown = hasFullAccess || count > shown || shown < FREE_RESULT_LIMIT

  const actions = (
    <>
      {shareUrl && <SocialShareButton url={shareUrl} title={preset.title} description={preset.description} />}
      <Button variant="outline" size="sm" className="h-11 md:h-8" onClick={() => setShowConfig(true)}>
        <Info className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Ver critérios
      </Button>
    </>
  )

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-4xl space-y-6 px-4 pt-6 pb-12 sm:px-6">
        <PageHeader
          breadcrumb={[
            { label: "Screening de ações", href: "/screening-acoes" },
            { label: preset.shortTitle },
          ]}
          title={preset.title}
          description={preset.hook}
          actions={actions}
        />

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-16" role="status">
            <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Aplicando os critérios às empresas da B3</p>
          </div>
        )}

        {error && !loading && (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-negative">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setRetryToken((token) => token + 1)}>
              Tentar novamente
            </Button>
          </div>
        )}

        {results && !loading && (
          <section aria-labelledby="preset-results-title" className="space-y-3">
            <h2 id="preset-results-title" className="text-lg font-semibold tabular-nums text-foreground">
              {countKnown
                ? `${count.toLocaleString("pt-BR")} ${count === 1 ? "empresa atende" : "empresas atendem"} aos critérios hoje`
                : `Primeiras ${shown} empresas que atendem aos critérios hoje`}
            </h2>
            <ScreeningResultsBlur
              results={results.results}
              totalCount={count}
              isPremium={hasFullAccess}
              highlightMetric={HIGHLIGHT_METRIC[preset.slug]}
            />
            <p className="text-xs text-muted-foreground">
              Preço justo e upside são estimativas baseadas em modelos e dados públicos. Não é recomendação de investimento.
            </p>
          </section>
        )}

        <p className="text-sm text-muted-foreground">
          Quer ajustar os critérios?{" "}
          <Link href="/screening-acoes" className="font-medium text-brand hover:underline">
            Monte seu próprio filtro no screening
          </Link>
        </p>

        <Dialog open={showConfig} onOpenChange={setShowConfig}>
          <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Critérios da estratégia</DialogTitle>
              <DialogDescription>{preset.description}</DialogDescription>
            </DialogHeader>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground marker:text-muted-foreground">
              {filters.map((filter) => (
                <li key={filter}>{filter}</li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
