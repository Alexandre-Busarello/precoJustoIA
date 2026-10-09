"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, ChevronDown, Loader2, Lock, SlidersHorizontal } from "lucide-react"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { useTracking } from "@/hooks/use-tracking"
import { useEngagementPixel } from "@/hooks/use-engagement-pixel"
import { EventType } from "@/lib/tracking-types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { InfoHint } from "@/components/ui/info-hint"
import { Label } from "@/components/ui/label"
import { SectionHeader } from "@/components/ui/section-header"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { BatchBacktestSelector } from "@/components/batch-backtest-selector"
import { EtfRanker } from "@/components/etf-ranker"
import { RankingParamsPanel } from "@/components/ranking-wizard/ranking-params-panel"
import { RankingResultsTable } from "@/components/ranking-wizard/ranking-results-table"
import {
  etfRowsFromApi,
  etfRowsFromHistory,
  stripEmoji,
  summarizeParams,
  toRankingRows,
  type EtfRow,
  type RankingResponse,
  type RankingResult,
} from "@/components/ranking-wizard/ranking-data"
import { formatBRLCompact, formatDate } from "@/lib/format"
import { LIQUIDITY_DEFAULTS } from "@/lib/finance/liquidity-rules"
import { cn } from "@/lib/utils"
import { getRankingMethodology, methodologyHref } from "@/lib/ranking-methodology"
import type { EtfRankingItem } from "@/lib/strategies/etf-ranking-strategy"
import {
  RANKING_MODELS,
  RANKING_UNIVERSES,
  buildRankBuilderBody,
  canAutoRunRankingModel,
  canUseRankingModel,
  defaultModelForUniverse,
  getRankingModel,
  includesLowLiquidity,
  isModelInUniverse,
  isRankingUniverse,
  modelsForUniverse,
  rankingModelLabel,
  supportsLowLiquidityToggle,
  universeForModel,
  withLowLiquidity,
  type RankingModel,
  type RankingParams,
  type RankingUniverse,
} from "@/lib/ranking-models"

interface QuickRankerProps {
  isLoggedIn: boolean
  /** Sessão ainda carregando: a abertura espera para saber se mostra o ranking salvo do dia. */
  sessionLoading?: boolean
  /** Universo inicial (ex.: `/ranking?assetType=etf`). */
  initialUniverse: RankingUniverse
  /** Modelo inicial (ex.: `/ranking?model=graham`). */
  initialModelKey: string
  /** Ranking salvo a abrir (`/ranking?id=…`). */
  rankingId: string | null
  /** Chamado depois de gerar um ranking (o histórico é recarregado). */
  onRankingGenerated?: () => void
  /**
   * Chamado quando o usuário escolhe um modelo/classe de ativo ou gera de novo: a seleção vai para a URL
   * (e o `id` do ranking salvo sai dela).
   */
  onSelectionChange?: (modelKey: string, universe: RankingUniverse) => void
}

/** Resultado exibido, sempre ligado ao modelo que o gerou (não ao selecionado no momento). */
type RankingOutcome =
  | { kind: "stocks"; modelKey: string; universe: RankingUniverse; response: RankingResponse }
  | { kind: "etf"; modelKey: string; rows: EtfRow[]; isLimited: boolean }

interface SavedInfo {
  createdAt: string
  resultCount: number
}

const GENERIC_ERROR = "Não foi possível gerar o ranking. Tente novamente."

/** Data local (America/Sao_Paulo) no formato AAAA-MM-DD, para comparar "hoje". */
function brazilDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date)
}

/** Id do último ranking salvo do modelo e classe de ativo, se foi gerado hoje; `null` caso contrário. */
async function findTodaysRanking(modelKey: string, universe: RankingUniverse): Promise<string | null> {
  const response = await fetch(`/api/ranking-history?model=${encodeURIComponent(modelKey)}&limit=1`, { credentials: "same-origin" })
  if (!response.ok) return null
  const data: { history?: { id: string; createdAt: string; assetTypeFilter?: string }[] } = await response.json()
  const latest = data.history?.[0]
  if (!latest) return null
  const sameUniverse = (latest.assetTypeFilter ?? "b3") === universe
  const today = brazilDateKey(new Date()) === brazilDateKey(new Date(latest.createdAt))
  return sameUniverse && today ? latest.id : null
}

function resultNoun(model: RankingModel | undefined, universe: RankingUniverse, count: number): string {
  if (model?.assetType === "fii") return count === 1 ? "FII" : "FIIs"
  if (model?.assetType === "etf") return count === 1 ? "ETF" : "ETFs"
  if (universe === "b3") return count === 1 ? "ação" : "ações"
  return count === 1 ? "ativo" : "ativos"
}

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    return typeof data?.error === "string" ? data.error : GENERIC_ERROR
  } catch {
    return GENERIC_ERROR
  }
}

export function QuickRanker({
  isLoggedIn,
  sessionLoading = false,
  initialUniverse,
  initialModelKey,
  rankingId,
  onRankingGenerated,
  onSelectionChange,
}: QuickRankerProps) {
  const router = useRouter()
  const { trackEvent } = useTracking()
  const { trackEngagement } = useEngagementPixel()
  const { isPremium: premiumFlag, isLoading: premiumLoading } = usePremiumStatus()
  const hasPremium = isLoggedIn && premiumFlag === true

  const [universe, setUniverse] = useState<RankingUniverse>(initialUniverse)
  const [modelKey, setModelKey] = useState(initialModelKey)
  const [params, setParams] = useState<RankingParams>(
    () => getRankingModel(initialModelKey)?.defaults(initialUniverse) ?? {}
  )
  const [outcome, setOutcome] = useState<RankingOutcome | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedInfo | null>(null)
  const [paramsOpen, setParamsOpen] = useState(false)
  const [showBatchBacktest, setShowBatchBacktest] = useState(false)
  const requestSeq = useRef(0)
  const initialRunDone = useRef(false)

  const model = getRankingModel(modelKey)
  const usable = model ? canUseRankingModel(model, hasPremium) : false
  const resultModel = outcome ? getRankingModel(outcome.modelKey) : undefined

  const run = useCallback(
    async (target: RankingModel, targetUniverse: RankingUniverse, targetParams: RankingParams, { preview = false } = {}) => {
      const seq = ++requestSeq.current
      setLoading(true)
      setLoadingSaved(false)
      setError(null)
      setSaved(null)
      // A prévia automática da abertura da página vai sem cookies quando dá (não entra no histórico do usuário).
      // Modelos premium, e os gratuitos cujo resultado muda com o plano (ETFs) para quem é Premium, levam a sessão.
      // A prévia da abertura da página vai com a sessão (o plano pode mudar o resultado), mas com `preview`
      // para o servidor não salvar no histórico: só entra no histórico o ranking que o usuário pede.
      const post = (url: string, body: Record<string, unknown>) =>
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(preview ? { ...body, preview: true } : body),
        })
      try {
        let next: RankingOutcome
        if (target.assetType === "etf") {
          const response = await post("/api/etf-ranking", { preset: target.key })
          if (!response.ok) throw new Error(await readError(response))
          const data: { results: EtfRankingItem[]; isLimited: boolean } = await response.json()
          next = { kind: "etf", modelKey: target.key, rows: etfRowsFromApi(data.results ?? []), isLimited: !!data.isLimited }
        } else {
          const response = await post("/api/rank-builder", buildRankBuilderBody(target, targetUniverse, targetParams))
          if (!response.ok) throw new Error(await readError(response))
          const data: RankingResponse = await response.json()
          next = { kind: "stocks", modelKey: target.key, universe: targetUniverse, response: data }
        }
        if (seq !== requestSeq.current) return
        setOutcome(next)
        if (!preview) {
          const resultCount = next.kind === "etf" ? next.rows.length : next.response.results.length
          trackEvent(EventType.RANKING_CREATED, undefined, { model: target.key, resultCount, params: targetParams })
          trackEngagement()
          onRankingGenerated?.()
        }
      } catch (err) {
        if (seq !== requestSeq.current) return
        setOutcome(null)
        setError(err instanceof Error && err.message ? err.message : GENERIC_ERROR)
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    },
    [onRankingGenerated, trackEngagement, trackEvent]
  )

  const loadSaved = useCallback(async (id: string) => {
    const seq = ++requestSeq.current
    setLoading(true)
    setLoadingSaved(true)
    setError(null)
    try {
      const response = await fetch(`/api/ranking/${id}`)
      if (!response.ok) throw new Error(response.status === 404 ? "Ranking salvo não encontrado." : await readError(response))
      const { ranking } = await response.json()
      if (seq !== requestSeq.current) return
      const savedModel = getRankingModel(ranking.model)
      const savedParams: RankingParams = ranking.params ?? {}
      const savedUniverse = isRankingUniverse(savedParams.assetTypeFilter)
        ? savedParams.assetTypeFilter
        : savedModel
          ? universeForModel(savedModel)
          : "b3"
      const results: RankingResult[] = ranking.results ?? []
      setUniverse(savedUniverse)
      setModelKey(ranking.model)
      setParams({ ...(savedModel?.defaults(savedUniverse) ?? {}), ...savedParams })
      setOutcome(
        savedModel?.assetType === "etf"
          ? { kind: "etf", modelKey: ranking.model, rows: etfRowsFromHistory(results), isLimited: false }
          : {
              kind: "stocks",
              modelKey: ranking.model,
              universe: savedUniverse,
              response: { model: ranking.model, params: savedParams, results, count: ranking.resultCount ?? results.length },
            }
      )
      setSaved({ createdAt: ranking.createdAt, resultCount: ranking.resultCount ?? results.length })
      setParamsOpen(false)
    } catch (err) {
      if (seq !== requestSeq.current) return
      setError(err instanceof Error && err.message ? err.message : GENERIC_ERROR)
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [])

  // Ranking salvo: abre sempre que o `id` da URL muda.
  useEffect(() => {
    if (rankingId) {
      initialRunDone.current = true
      loadSaved(rankingId)
    }
  }, [rankingId, loadSaved])

  // Abertura da página: gera o ranking padrão sem nenhum clique.
  useEffect(() => {
    if (initialRunDone.current || rankingId || sessionLoading) return
    const initial = getRankingModel(initialModelKey)
    if (!initial) return
    // Premium ou resultado que depende do plano: espera saber o plano antes de pedir.
    if ((initial.plan !== "free" || initial.planLimitedResults) && premiumLoading) return
    initialRunDone.current = true
    if (canAutoRunRankingModel(initial, hasPremium)) {
      const preview = () => run(initial, initialUniverse, initial.defaults(initialUniverse), { preview: true })
      if (!isLoggedIn) {
        preview()
        return
      }
      // Já gerou este ranking hoje? Mostra o último (com "Gerar com dados atuais") em vez de calcular de novo.
      findTodaysRanking(initial.key, initialUniverse)
        .then((id) => (id ? loadSaved(id) : preview()))
        .catch(preview)
    } else if (initial.isAi && canUseRankingModel(initial, hasPremium)) {
      setParamsOpen(true)
    }
  }, [hasPremium, initialModelKey, initialUniverse, isLoggedIn, loadSaved, premiumLoading, rankingId, run, sessionLoading])

  const applySelection = (nextModel: RankingModel, nextUniverse: RankingUniverse) => {
    setSaved(null)
    onSelectionChange?.(nextModel.key, nextUniverse)
    // A escolha "incluir baixa liquidez" acompanha a troca de modelo de ações.
    const keepLowLiquidity = includesLowLiquidity(params) && supportsLowLiquidityToggle(nextModel)
    const nextParams = withLowLiquidity(nextModel.defaults(nextUniverse), keepLowLiquidity)
    requestSeq.current += 1
    setLoading(false)
    setError(null)
    setModelKey(nextModel.key)
    setUniverse(nextUniverse)
    setParams(nextParams)
    if (canAutoRunRankingModel(nextModel, hasPremium)) {
      setParamsOpen(false)
      run(nextModel, nextUniverse, nextParams)
    } else {
      setOutcome(null)
      setParamsOpen(!!nextModel.isAi && canUseRankingModel(nextModel, hasPremium))
    }
  }

  const handleUniverseChange = (value: string) => {
    if (!isRankingUniverse(value)) return
    const nextModel = model && isModelInUniverse(model, value) ? model : defaultModelForUniverse(value)
    applySelection(nextModel, value)
  }

  const handleModelChange = (key: string) => {
    const nextModel = getRankingModel(key)
    if (nextModel) applySelection(nextModel, universeForModel(nextModel, universe))
  }

  const generate = () => {
    if (!model || !usable) return
    setSaved(null)
    onSelectionChange?.(model.key, universe)
    run(model, universe, params)
  }

  const toggleLowLiquidity = (include: boolean) => {
    if (!model) return
    const nextParams = withLowLiquidity(params, include)
    setParams(nextParams)
    setSaved(null)
    if (canAutoRunRankingModel(model, hasPremium)) {
      onSelectionChange?.(model.key, universe)
      run(model, universe, nextParams)
    }
  }

  const openDefaultRanking = () => {
    const fallback = defaultModelForUniverse(universe)
    applySelection(fallback, universeForModel(fallback, universe))
  }

  const rows = useMemo(
    () => (outcome?.kind === "stocks" ? toRankingRows(outcome.response.results, resultModel) : []),
    [outcome, resultModel]
  )

  const universeModels = modelsForUniverse(universe)
  const lockedModels = RANKING_MODELS.filter((m) => !canUseRankingModel(m, hasPremium))
  const showParams = !!model && usable && model.fields.length > 0
  const showLiquidityToggle = !!model && usable && supportsLowLiquidityToggle(model)
  // Ranking salvo continua visível mesmo quando o modelo deixou de estar no plano (ex.: fim do teste Premium).
  const showLocked = !!model && !usable && !(saved && outcome)
  const awaitingAi = !!model?.isAi && usable && !outcome && !loading && !error
  const shownCount = outcome ? (outcome.kind === "etf" ? outcome.rows.length : outcome.response.results.length) : 0
  const totalCount = outcome?.kind === "stocks" ? Math.max(outcome.response.count ?? shownCount, shownCount) : shownCount
  const outcomeUniverse = outcome?.kind === "stocks" ? outcome.universe : universe
  // Enquanto calcula, o cabeçalho e a tabela já refletem o modelo escolhido; depois, o modelo que gerou o resultado.
  const showingOutcome = !!outcome && !loading
  const headerModel = showingOutcome ? resultModel : model
  const headerLabel = showingOutcome && outcome ? rankingModelLabel(outcome.modelKey) : model?.label ?? rankingModelLabel(modelKey)
  const showEtfTable = showingOutcome ? outcome?.kind === "etf" : model?.assetType === "etf"
  const canBacktest = outcome?.kind === "stocks" && resultModel?.assetType !== "fii" && rows.length > 1

  const countLabel = loading
    ? loadingSaved
      ? "Abrindo ranking salvo…"
      : model?.isAi
      ? "Gerando a síntese com IA. Pode levar alguns minutos."
      : "Calculando o ranking…"
    : outcome
      ? `${shownCount} ${resultNoun(headerModel, outcomeUniverse, shownCount)}${
          totalCount > shownCount
            ? ` de ${totalCount} ${resultNoun(headerModel, outcomeUniverse, totalCount).startsWith("aç") ? "encontradas" : "encontrados"}`
            : ""
        }`
      : undefined

  const openBatchBacktest = () => {
    if (!isLoggedIn) {
      router.push("/login?callbackUrl=%2Franking")
      return
    }
    setShowBatchBacktest(true)
  }

  return (
    <div className="space-y-6">
      <section aria-label="Configuração do ranking" className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_minmax(0,22rem)]">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="ranking-universe" className="text-xs font-medium text-muted-foreground">
              Classe de ativo
            </Label>
            <Select value={universe} onValueChange={handleUniverseChange}>
              <SelectTrigger id="ranking-universe" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANKING_UNIVERSES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="ranking-model" className="text-xs font-medium text-muted-foreground">
              Modelo
            </Label>
            <Select value={model ? modelKey : ""} onValueChange={handleModelChange}>
              <SelectTrigger id="ranking-model" className="w-full">
                <SelectValue placeholder={rankingModelLabel(modelKey)} />
              </SelectTrigger>
              <SelectContent>
                {universeModels.map((option) => {
                  const locked = !canUseRankingModel(option, hasPremium)
                  return (
                    <SelectItem key={option.key} value={option.key}>
                      <span className="flex items-center gap-2">
                        {option.label}
                        {locked && (
                          <Lock className="size-3.5 text-muted-foreground" strokeWidth={1.75} aria-label="Premium" />
                        )}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {model && <p className="max-w-[68ch] text-sm text-muted-foreground">{model.description}</p>}

        {model && <HowItWorks modelKey={model.key} />}

        {showLiquidityToggle && (
          <div className="flex items-center gap-1">
            <Label
              htmlFor="ranking-low-liquidity"
              className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-normal text-foreground"
            >
              <Checkbox
                id="ranking-low-liquidity"
                checked={includesLowLiquidity(params)}
                onCheckedChange={(checked) => toggleLowLiquidity(checked === true)}
                disabled={loading}
              />
              Incluir ativos com baixa liquidez
            </Label>
            <InfoHint
              label="Sobre o filtro de liquidez"
              content={
                <p>
                  Por padrão, ficam fora as ações com volume médio negociado abaixo de {formatBRLCompact(LIQUIDITY_DEFAULTS.stock)} por
                  dia nos últimos 60 pregões. BDRs abaixo de {formatBRLCompact(LIQUIDITY_DEFAULTS.bdr)} por dia continuam no ranking,
                  com aviso. Quando há mais de uma classe da mesma empresa, fica a mais negociada. O volume de cada ativo aparece em
                  Liquidez diária, nos detalhes da linha.
                </p>
              }
            />
          </div>
        )}

        {saved && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground">
              Ranking salvo em <span className="tabular-nums">{formatDate(saved.createdAt, { style: "datetime" })}</span>
              <span className="text-muted-foreground"> · {saved.resultCount} resultados</span>
            </p>
            {model && usable ? (
              <Button variant="outline" size="sm" onClick={generate} disabled={loading} className="shrink-0">
                Gerar com dados atuais
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={openDefaultRanking} className="shrink-0">
                Abrir ranking padrão
              </Button>
            )}
          </div>
        )}

        {showParams && model && (
          <Collapsible open={paramsOpen} onOpenChange={setParamsOpen} className="rounded-lg border border-border bg-card">
            <CollapsibleTrigger className="min-h-11 gap-3 rounded-lg px-4 py-2 text-left hover:no-underline focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none">
              <span className="flex min-w-0 items-center gap-2">
                <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                <span className="shrink-0 text-foreground">Parâmetros</span>
                <span className="truncate font-normal text-muted-foreground">{summarizeParams(model, params)}</span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform" strokeWidth={1.75} aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-5 border-t border-border px-4 py-4">
                <RankingParamsPanel model={model} params={params} onChange={setParams} />
                <div className="flex items-center justify-between gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setParams(model.defaults(universe))}>
                    Restaurar padrão
                  </Button>
                  <Button onClick={generate} disabled={loading} className="hidden md:inline-flex">
                    {loading && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
                    Gerar ranking
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </section>

      <section aria-labelledby="ranking-results-title" aria-busy={loading} className="space-y-3">
        <SectionHeader
          id="ranking-results-title"
          title={headerLabel}
          description={countLabel}
          actions={
            canBacktest && !loading ? (
              <Button variant="outline" size="sm" onClick={openBatchBacktest}>
                Backtest do ranking
              </Button>
            ) : undefined
          }
        />

        {showLocked && model ? (
          <LockedModel model={model} isLoggedIn={isLoggedIn} />
        ) : error ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-negative">{error}</p>
            {model && (
              <Button variant="outline" size="sm" onClick={() => (rankingId ? loadSaved(rankingId) : generate())}>
                Tentar novamente
              </Button>
            )}
          </div>
        ) : awaitingAi ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">Ajuste os parâmetros e gere o ranking</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              A síntese com IA não roda sozinha: leva alguns minutos e o resultado pode variar entre execuções.
            </p>
          </div>
        ) : showEtfTable ? (
          <EtfRanker
            rows={outcome?.kind === "etf" ? outcome.rows : []}
            loading={loading || !outcome}
            isLimited={outcome?.kind === "etf" && outcome.isLimited}
            isLoggedIn={isLoggedIn}
          />
        ) : (
          <RankingResultsTable
            model={headerModel ?? model}
            rows={rows}
            loading={loading || !outcome}
            empty={{
              title: "Nenhum ativo passou nos critérios",
              description: "Afrouxe os parâmetros, por exemplo a margem de segurança mínima, e gere de novo.",
              action: showParams ? (
                <Button variant="outline" size="sm" onClick={() => setParamsOpen(true)}>
                  Ajustar parâmetros
                </Button>
              ) : undefined,
            }}
          />
        )}

        <p className="text-xs leading-5 text-muted-foreground">
          Estimativas de modelos quantitativos com dados públicos. Não é recomendação de investimento. Rentabilidade passada não
          garante resultados futuros.{" "}
          <Link href={methodologyHref(model?.key)} className="text-foreground underline underline-offset-4 hover:text-brand">
            Ver metodologia
          </Link>
        </p>

        {!hasPremium && lockedModels.length > 0 && usable && (
          <p className="text-sm text-muted-foreground">
            {lockedModels.length} modelos, como {lockedModels.slice(0, 3).map((m) => m.label).join(", ")}, fazem parte do Premium.{" "}
            <Link href={isLoggedIn ? "/planos" : "/register"} className="text-foreground underline underline-offset-4 hover:text-brand">
              {isLoggedIn ? "Ver planos" : "Criar conta grátis"}
            </Link>
          </p>
        )}

        {outcome?.kind === "stocks" && outcome.response.rational && (
          <Collapsible className="border-t border-border pt-2">
            <CollapsibleTrigger className="min-h-11 py-2 text-left text-foreground hover:no-underline focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none">
              Como este ranking é calculado
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform" strokeWidth={1.75} aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="max-w-3xl pb-2">
                <MarkdownRenderer content={stripEmoji(outcome.response.rational)} className="text-sm text-muted-foreground" />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </section>

      {/* Mobile: ação principal fixa no rodapé enquanto o painel de parâmetros está aberto (acima da navegação inferior). */}
      {showParams && paramsOpen && (
        <>
          <div aria-hidden="true" className="h-16 md:hidden" />
          <div
            className={cn(
              "fixed inset-x-0 z-30 border-t border-border bg-background px-4 pt-2 md:hidden",
              isLoggedIn
                ? "bottom-[calc(3.5rem+env(safe-area-inset-bottom))] pr-20 pb-2"
                : "bottom-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            )}
          >
            <Button onClick={generate} disabled={loading} className="h-12 w-full text-base">
              {loading && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
              {loading ? "Gerando ranking" : "Gerar ranking"}
            </Button>
          </div>
        </>
      )}

      {outcome?.kind === "stocks" && (
        <BatchBacktestSelector
          isOpen={showBatchBacktest}
          onClose={() => setShowBatchBacktest(false)}
          rankingResults={outcome.response.results}
          onConfigSelected={() => setShowBatchBacktest(false)}
        />
      )}
    </div>
  )
}

function LockedModel({ model, isLoggedIn }: { model: RankingModel; isLoggedIn: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center">
      <p className="text-sm font-medium text-foreground">{model.label} faz parte do plano Premium</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {isLoggedIn
          ? "Assine para usar todos os modelos, com parâmetros editáveis e rankings ilimitados."
          : "Os modelos premium exigem uma conta com assinatura. Com a conta grátis você já salva o histórico dos seus rankings."}
      </p>
      <Button asChild size="sm" className="mt-4">
        <Link href={isLoggedIn ? "/planos" : "/register"}>{isLoggedIn ? "Ver planos" : "Criar conta grátis"}</Link>
      </Button>
    </div>
  )
}

/** "Como funciona" do modelo selecionado: resumo, passos e link para a seção em /metodologia. */
function HowItWorks({ modelKey }: { modelKey: string }) {
  const doc = getRankingMethodology(modelKey)
  if (!doc) return null
  return (
    <Collapsible className="max-w-[68ch] rounded-lg border border-border bg-card">
      <CollapsibleTrigger className="min-h-11 gap-2 px-3 text-left text-foreground hover:no-underline focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none">
        <span className="flex items-center gap-2">
          <BookOpen className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          Como funciona
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform" strokeWidth={1.75} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 border-t border-border px-3 pt-3 pb-3">
          <p className="text-sm text-foreground">{doc.summary}</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-muted-foreground">
            {doc.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <Link
            href={methodologyHref(modelKey)}
            className="inline-flex min-h-11 items-center text-sm font-medium text-foreground underline underline-offset-4 hover:text-brand"
          >
            Metodologia completa
          </Link>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
