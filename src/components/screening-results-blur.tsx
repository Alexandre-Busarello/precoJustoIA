"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { Lock } from "lucide-react"
import { useEngagementPixel } from "@/hooks/use-engagement-pixel"
import { useEmailVerified } from "@/hooks/use-user-data"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { CompanyLogo } from "@/components/company-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatBRL } from "@/lib/format"
import { formatMarginOfSafety } from "@/lib/valuation-metrics"
import { cn } from "@/lib/utils"
import {
  formatMetricValue,
  resultMargin,
  translateMetricName,
  type ScreeningResult,
} from "@/components/screening/screening-metrics"

interface ScreeningResultsBlurProps {
  results: ScreeningResult[]
  totalCount: number
  isPremium: boolean
  /** Métrica em destaque em cada linha (padrão: a primeira disponível de HIGHLIGHT_KEYS). */
  highlightMetric?: string
  /** Linha de detalhe abaixo do nome (ex.: o motivo de entrar em "Queda com fundamentos intactos"). */
  renderDetail?: (result: ScreeningResult) => string | null
}

const FREE_VISIBLE = 3
const LOCKED_PREVIEW_ROWS = 3

/** Métrica que melhor resume a estratégia, na ordem de preferência. */
const HIGHLIGHT_KEYS = ["magicScore", "dy", "cagrReceitas", "pl", "roe"]

function highlightKey(results: ScreeningResult[]): string | null {
  const first = results[0]?.key_metrics
  if (!first) return null
  return HIGHLIGHT_KEYS.find((key) => typeof first[key] === "number") ?? null
}

function ResultRow({
  result,
  rank,
  metricKey,
  detail,
}: {
  result: ScreeningResult
  rank: number
  metricKey: string | null
  detail: string | null
}) {
  const value = resultMargin(result)
  const tone = value === null || value === 0 ? "text-foreground" : value > 0 ? "text-positive" : "text-negative"
  return (
    <Link
      href={`/acao/${result.ticker.toLowerCase()}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">{rank}</span>
          <CompanyLogo ticker={result.ticker} logoUrl={result.logoUrl} size={36} companyName={result.name} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{result.ticker}</span>
              {result.sector && <Badge variant="neutral">{result.sector}</Badge>}
            </div>
            <p className="truncate text-sm text-muted-foreground">{result.name}</p>
            {detail && <p className="mt-1 text-xs tabular-nums text-muted-foreground">{detail}</p>}
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-left sm:flex sm:shrink-0 sm:gap-6 sm:text-right">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Preço</dt>
            <dd className="text-sm font-medium tabular-nums text-foreground">{formatBRL(result.currentPrice)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="break-words text-xs leading-tight text-muted-foreground">Margem de segurança</dt>
            <dd className={cn("text-sm font-medium tabular-nums", tone)}>{formatMarginOfSafety(value)}</dd>
          </div>
          {metricKey && (
            <div className="min-w-0">
              <dt className="break-words text-xs leading-tight text-muted-foreground">{translateMetricName(metricKey)}</dt>
              <dd className="text-sm font-medium tabular-nums text-foreground">
                {formatMetricValue(metricKey, result.key_metrics?.[metricKey])}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </Link>
  )
}

/** Linha fantasma para a prévia bloqueada: mesmas proporções da linha real, sem dados. */
function PlaceholderRow({ rank }: { rank: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">{rank}</span>
        <div className="size-9 shrink-0 rounded-md bg-muted" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-20 rounded-sm bg-muted" />
          <div className="h-3 w-40 max-w-full rounded-sm bg-muted" />
        </div>
        <div className="hidden h-8 w-40 rounded-sm bg-muted sm:block" />
      </div>
    </div>
  )
}

/**
 * Lista de resultados das páginas de estratégia. Para quem não é Premium mostra os 3 primeiros
 * e, se houver mais empresas, uma prévia bloqueada com um único CTA.
 */
export function ScreeningResultsBlur({ results, totalCount, isPremium, highlightMetric, renderDetail }: ScreeningResultsBlurProps) {
  const { data: session, status } = useSession()
  const { trackEngagement } = useEngagementPixel()
  const { data: emailVerifiedData, isLoading: isLoadingEmail } = useEmailVerified()
  const { isTrialActive } = usePremiumStatus()

  const isLoggedIn = status === "authenticated" && !!session
  const metricKey =
    highlightMetric && typeof results[0]?.key_metrics?.[highlightMetric] === "number" ? highlightMetric : highlightKey(results)
  const visible = isPremium ? results : results.slice(0, FREE_VISIBLE)
  const hiddenCount = Math.max(0, totalCount - visible.length)
  // Fora do Premium o backend devolve no máximo 3 e não informa o total: com 3 resultados pode haver mais.
  const showLocked = !isPremium && (hiddenCount > 0 || results.length >= FREE_VISIBLE)

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
        <p className="font-medium text-foreground">Nenhuma empresa atende aos critérios hoje</p>
        <p className="mt-1 text-sm text-muted-foreground">Os filtros são revistos diariamente com os dados mais recentes.</p>
      </div>
    )
  }

  const returnUrl = typeof window !== "undefined" ? `?returnUrl=${encodeURIComponent(window.location.pathname)}` : ""
  const needsEmailVerification = isLoggedIn && !isTrialActive && !isLoadingEmail && emailVerifiedData?.verified === false

  let cta: { text: string; href: string; description: string }
  if (!isLoggedIn) {
    cta = {
      text: "Criar conta grátis",
      href: `/register${returnUrl}`,
      description: "Crie uma conta grátis e teste o Premium por 1 dia para ver a lista completa.",
    }
  } else if (needsEmailVerification) {
    cta = {
      text: "Verificar e-mail",
      href: "/verificar-email",
      description: "Verifique seu e-mail para ativar o teste de 1 dia do Premium e ver a lista completa.",
    }
  } else {
    cta = {
      text: "Assinar Premium",
      href: "/checkout",
      description: "Assine o Premium para ver a lista completa e usar todos os filtros do screening.",
    }
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {visible.map((result, index) => (
          <li key={result.ticker}>
            <ResultRow result={result} rank={index + 1} metricKey={metricKey} detail={renderDetail?.(result) ?? null} />
          </li>
        ))}
      </ol>

      {showLocked && (
        <div className="grid">
          <div aria-hidden="true" className="pointer-events-none space-y-3 blur-[3px] select-none [grid-area:1/1]">
            {Array.from({ length: hiddenCount > 0 ? Math.min(LOCKED_PREVIEW_ROWS, hiddenCount) : LOCKED_PREVIEW_ROWS }, (_, index) => (
              <PlaceholderRow key={index} rank={visible.length + index + 1} />
            ))}
          </div>
          {/* relative z-10: a camada com blur cria contexto de empilhamento e ficaria por cima do CTA */}
          <div className="relative z-10 flex items-center justify-center p-4 [grid-area:1/1]">
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 text-center shadow-md">
              <Lock className="mx-auto size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              <p className="mt-2 font-medium text-foreground">
                {hiddenCount > 0
                  ? `Mais ${hiddenCount.toLocaleString("pt-BR")} ${hiddenCount === 1 ? "empresa atende" : "empresas atendem"} a estes critérios`
                  : "Veja a lista completa desta estratégia"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{cta.description}</p>
              <Button asChild className="mt-4 h-11 w-full sm:w-auto">
                <Link href={cta.href} onClick={() => !session && trackEngagement()}>
                  {cta.text}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
