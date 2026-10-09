"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Loader2, SlidersHorizontal } from "lucide-react"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { InfoHint } from "@/components/ui/info-hint"
import { ScreeningResultsBlur } from "@/components/screening-results-blur"
import { SocialShareButton } from "@/components/social-share-button"
import type { ScreeningPreset, ScreeningPresetSlug } from "@/lib/screening-presets"
import { dipReason, stockParamsToQuery, type ScreeningResponse } from "./screening-metrics"

const FREE_RESULT_LIMIT = 3

const CRITERIA = [
  "Preço abaixo da média móvel de 200 pregões ou pelo menos 20% abaixo da máxima de 52 semanas",
  "Lucro líquido 12m sem queda acima de 15%, ROE e margem líquida sem queda acima de 3 p.p.",
  "Dívida líquida/EBITDA sem alta acima de 1,0x (não se aplica a bancos e seguradoras)",
  "Apenas ações da B3 com volume médio diário a partir de R$ 1 mi",
]

/**
 * Página de preset com sinais de preço ("Queda com fundamentos intactos"): mostra, em cada ativo, o motivo de ter
 * entrado e quantas ações ficaram de fora por falta de histórico.
 */
export function SignalPresetPage({ preset }: { preset: ScreeningPreset<ScreeningPresetSlug> }) {
  const { isPremium } = usePremiumStatus()
  const { data: session } = useSession()
  const hasFullAccess = !!session && !!isPremium
  const [loading, setLoading] = useState(true)
  const [response, setResponse] = useState<ScreeningResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [shareUrl, setShareUrl] = useState("")

  useEffect(() => {
    setShareUrl(window.location.href)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/rank-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "screening", params: { ...preset.params, includeBDRs: false } }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setResponse(await res.json())
      } catch (err) {
        if (controller.signal.aborted) return
        console.error("Erro ao gerar screening:", err)
        setError("Não foi possível carregar os resultados.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [preset, retryToken])

  const count = response?.count ?? 0
  const shown = response?.results.length ?? 0
  // Fora do Premium o backend corta em 3 antes de contar; nesse caso não afirmamos o total.
  const countKnown = hasFullAccess || count > shown || shown < FREE_RESULT_LIMIT
  const insufficientData = response?.insufficientData ?? 0
  // O filtro de queda é Premium no screening livre: fora do Premium, o link abre o screening sem ele.
  const toolHref = hasFullAccess ? `/screening-acoes?${stockParamsToQuery(preset.params).toString()}` : "/screening-acoes"

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-4xl space-y-6 px-4 pt-6 pb-12 sm:px-6">
        <PageHeader
          breadcrumb={[{ label: "Screening de ações", href: "/screening-acoes" }, { label: preset.shortTitle }]}
          title={preset.title}
          description={preset.hook}
          actions={
            <>
              {shareUrl && <SocialShareButton url={shareUrl} title={preset.title} description={preset.description} />}
              <Button asChild variant="outline" size="sm" className="h-11 md:h-8">
                <Link href={toolHref}>
                  <SlidersHorizontal className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  Ajustar filtros
                </Link>
              </Button>
            </>
          }
        />

        <section aria-labelledby="signal-criteria-title" className="rounded-lg border border-border bg-card p-4">
          <h2 id="signal-criteria-title" className="text-sm font-semibold text-foreground">
            Critérios
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground marker:text-muted-foreground">
            {CRITERIA.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        </section>

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-16" role="status">
            <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Aplicando os critérios às ações da B3</p>
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

        {response && !loading && (
          <section aria-labelledby="signal-results-title" className="space-y-3">
            <div className="space-y-1">
              <h2 id="signal-results-title" className="text-lg font-semibold tabular-nums text-foreground">
                {countKnown
                  ? `${count.toLocaleString("pt-BR")} ${count === 1 ? "ação atende" : "ações atendem"} aos critérios hoje`
                  : `Primeiras ${shown} ações que atendem aos critérios hoje`}
              </h2>
              {insufficientData > 0 && (
                <p className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                  {insufficientData.toLocaleString("pt-BR")} sem dados suficientes
                  <InfoHint content="Ações sem 200 pregões de preço ou sem dois períodos de 12 meses de demonstrações ficam de fora, sem benefício da dúvida." />
                </p>
              )}
            </div>
            <ScreeningResultsBlur
              results={response.results}
              totalCount={count}
              isPremium={hasFullAccess}
              highlightMetric="drawdown52w"
              renderDetail={(result) => dipReason(result.key_metrics)}
            />
            <p className="text-xs text-muted-foreground">
              Filtros quantitativos sobre dados públicos. Não é recomendação de investimento.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
