"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { signIn, useSession } from "next-auth/react"
import { Loader2, SlidersHorizontal } from "lucide-react"
import type { ScreeningParams } from "@/lib/strategies/types"
import type { ExtendedScreeningParams } from "@/lib/strategies/screening-strategy"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { useEngagementPixel } from "@/hooks/use-engagement-pixel"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { InfoHint } from "@/components/ui/info-hint"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScreeningConfigurator } from "@/components/screening-configurator"
import { FiiScreeningConfigurator } from "@/components/fii-screening-configurator"
import { ScreeningAIAssistant } from "@/components/screening-ai-assistant"
import { SCREENING_PRESETS, getAllPresetSlugs } from "@/lib/screening-presets"
import { ScreeningResults } from "./screening-results"
import { ScreeningSeoContent } from "./screening-seo-content"
import {
  countActiveFiiFilters,
  countActiveStockFilters,
  DEFAULT_FII_PARAMS,
  defaultStockParams,
  fiiParamsFromQuery,
  fiiParamsToQuery,
  sortResults,
  stockParamsFromQuery,
  stockParamsToQuery,
  type FiiScreeningFormParams,
  type MobileSortKey,
  type ScreeningResponse,
  type StockAssetType,
} from "./screening-metrics"

export type ScreeningHubVariant = "stocks" | "fiis"

const MAX_ANONYMOUS_SCREENINGS = 2
const ANON_COUNT_KEY = "anonymousScreeningsCount"
const LIVE_DEBOUNCE_MS = 400
/** Limite de resultados que o backend aplica fora do Premium (o total real não é informado nesse caso). */
const FREE_RESULT_LIMIT = 3

interface SectorData {
  sectors: string[]
  industries: string[]
  industriesBySector: Record<string, string[]>
}

const EMPTY_SECTOR_DATA: SectorData = { sectors: [], industries: [], industriesBySector: {} }

function readAnonCount(): number {
  try {
    return parseInt(window.localStorage.getItem(ANON_COUNT_KEY) || "0", 10) || 0
  } catch {
    return 0
  }
}

function writeAnonCount(value: number | null) {
  try {
    if (value === null) window.localStorage.removeItem(ANON_COUNT_KEY)
    else window.localStorage.setItem(ANON_COUNT_KEY, String(value))
  } catch {
    // Armazenamento indisponível (aba anônima, bloqueio): o limite apenas deixa de ser aplicado.
  }
}

const DESKTOP_QUERY = "(min-width: 1024px)"

function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

/** `lg` e acima: filtros no painel lateral; abaixo, no sheet. Garante uma única cópia dos campos no DOM. */
function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP_QUERY).matches, () => false)
}

function toStockAssetType(value: string | null): StockAssetType {
  return value === "b3" || value === "bdr" ? value : "both"
}

/** Corpo enviado a /api/rank-builder (mesma API de antes; o backend aplica os limites do plano). */
function buildRequestBody(isFii: boolean, params: ExtendedScreeningParams, fiiParams: FiiScreeningFormParams) {
  if (isFii) {
    return {
      model: "fiiScreening",
      params: {
        tipoFii: fiiParams.tipoFii,
        minDY: fiiParams.minDY,
        maxPVP: fiiParams.maxPVP,
        minLiquidity: fiiParams.minLiquidity,
        minQtdImoveis: fiiParams.minQtdImoveis,
        maxVacancia: fiiParams.maxVacancia,
        segmentos: fiiParams.segmento ? [fiiParams.segmento] : undefined,
        assetTypeFilter: "fii",
        companySize: "all",
      },
    }
  }
  const rest: ExtendedScreeningParams = { ...params }
  delete rest.limit
  const assetTypeFilter = rest.assetTypeFilter && rest.assetTypeFilter !== "fii" ? rest.assetTypeFilter : "both"
  return {
    model: "screening",
    params: {
      ...rest,
      includeBDRs: assetTypeFilter === "both" || assetTypeFilter === "bdr",
      assetTypeFilter,
    },
  }
}

const STOCK_SORT_OPTIONS: { value: MobileSortKey; label: string }[] = [
  { value: "relevance", label: "Relevância" },
  { value: "upside", label: "Maior upside" },
  { value: "pl", label: "Menor P/L" },
  { value: "peg", label: "Menor PEG" },
  { value: "dy", label: "Maior DY 12m" },
  { value: "marketCap", label: "Maior valor de mercado" },
]

const FII_SORT_OPTIONS: { value: MobileSortKey; label: string }[] = [
  { value: "relevance", label: "Relevância" },
  { value: "pjFiiScore", label: "Maior score PJ-FII" },
  { value: "dy", label: "Maior DY 12m" },
  { value: "pvp", label: "Menor P/VP" },
  { value: "upside", label: "Maior upside" },
]

export function ScreeningHubPage({ variant }: { variant: ScreeningHubVariant }) {
  const isFiisHub = variant === "fiis"
  const { data: session, status } = useSession()
  const isLoggedIn = !!session
  const { isPremium } = usePremiumStatus()
  // Para anônimos o hook pode liberar conteúdo por IP; no screening vale a regra do backend (Premium logado).
  const hasFullAccess = isLoggedIn && !!isPremium
  const { trackEngagement } = useEngagementPixel()
  const searchParams = useSearchParams()
  // Sem `?assetType=`, começa só com B3: os preços justos dos BDRs dependem de dados em outra moeda e
  // distorciam a primeira tela (upsides de -80% a -90% nas maiores empresas). "B3 e BDRs" segue no filtro.
  const urlAssetType = toStockAssetType(searchParams.get("assetType") ?? "b3")
  const isMobile = useIsMobile()
  const isDesktop = useIsDesktop()

  // Filtros iniciais vindos da URL (links compartilháveis); os nomes antigos, como `dy`, continuam valendo.
  const [params, setParams] = useState<ExtendedScreeningParams>(() =>
    isFiisHub ? defaultStockParams(urlAssetType) : stockParamsFromQuery(new URLSearchParams(searchParams.toString()), urlAssetType)
  )
  const [fiiParams, setFiiParams] = useState<FiiScreeningFormParams>(() =>
    isFiisHub ? fiiParamsFromQuery(new URLSearchParams(searchParams.toString())) : DEFAULT_FII_PARAMS
  )
  const [prevUrlAssetType, setPrevUrlAssetType] = useState(urlAssetType)
  if (urlAssetType !== prevUrlAssetType) {
    setPrevUrlAssetType(urlAssetType)
    if (params.assetTypeFilter !== urlAssetType) setParams((current) => ({ ...current, assetTypeFilter: urlAssetType }))
  }

  // Mantém a URL igual aos filtros, sem nova navegação: o link copiado reabre a mesma busca.
  useEffect(() => {
    const search = (isFiisHub ? fiiParamsToQuery(fiiParams) : stockParamsToQuery(params)).toString()
    const next = `${window.location.pathname}${search ? `?${search}` : ""}`
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next)
  }, [isFiisHub, params, fiiParams])

  const [response, setResponse] = useState<ScreeningResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [mobileSort, setMobileSort] = useState<MobileSortKey>("relevance")
  const [sectorData, setSectorData] = useState<SectorData>(EMPTY_SECTOR_DATA)
  const [sectorsLoading, setSectorsLoading] = useState(true)

  const trackEngagementRef = useRef(trackEngagement)
  useEffect(() => {
    trackEngagementRef.current = trackEngagement
  }, [trackEngagement])

  useEffect(() => {
    let cancelled = false
    fetch("/api/sectors-industries")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: Partial<SectorData>) => {
        if (cancelled) return
        setSectorData({
          sectors: data.sectors ?? [],
          industries: data.industries ?? [],
          industriesBySector: data.industriesBySector ?? {},
        })
      })
      .catch((err) => console.error("Erro ao carregar setores e indústrias:", err))
      .finally(() => {
        if (!cancelled) setSectorsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Ao logar, o limite de buscas anônimas deixa de valer.
  useEffect(() => {
    if (isLoggedIn) {
      writeAnonCount(null)
      setShowRegisterModal(false)
    }
  }, [isLoggedIn])

  const requestKey = useMemo(
    () => JSON.stringify(buildRequestBody(isFiisHub, params, fiiParams)),
    [isFiisHub, params, fiiParams]
  )

  // Resultados ao vivo: a primeira busca roda na hora; as seguintes, 400 ms após a última alteração.
  const completedSearchesRef = useRef(0)
  const countedVisitRef = useRef(false)
  // Filtros dos resultados em tela: se o limite anônimo barrar uma alteração, o painel volta para eles
  // (evita o painel dizer "1 filtro ativo" sobre resultados sem filtro).
  const paramsRef = useRef({ params, fiiParams })
  useEffect(() => {
    paramsRef.current = { params, fiiParams }
  }, [params, fiiParams])
  const appliedRef = useRef<{ key: string; params: ExtendedScreeningParams; fiiParams: FiiScreeningFormParams } | null>(null)
  useEffect(() => {
    if (status === "loading") return
    const isInitial = completedSearchesRef.current === 0
    const controller = new AbortController()

    const timer = window.setTimeout(async () => {
      const anonUsed = !isLoggedIn && !isInitial ? readAnonCount() : 0
      if (!isLoggedIn && !isInitial && !countedVisitRef.current && anonUsed >= MAX_ANONYMOUS_SCREENINGS) {
        const applied = appliedRef.current
        // Chave igual à dos resultados em tela = é a própria reversão abaixo: nada a buscar.
        if (applied?.key === requestKey) return
        setShowRegisterModal(true)
        if (applied) {
          setParams(applied.params)
          setFiiParams(applied.fiiParams)
        }
        return
      }

      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/rank-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestKey,
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: ScreeningResponse = await res.json()
        setResponse(data)
        appliedRef.current = { key: requestKey, ...paramsRef.current }
        completedSearchesRef.current += 1
        if (!isInitial) {
          trackEngagementRef.current()
          // Conta uma busca por visita para anônimos (ajustes seguidos na mesma visita não gastam o limite).
          if (!isLoggedIn && !countedVisitRef.current) {
            countedVisitRef.current = true
            writeAnonCount(anonUsed + 1)
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return
        console.error("Erro ao gerar screening:", err)
        setError("Não foi possível carregar os resultados.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, isInitial ? 0 : LIVE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [requestKey, status, isLoggedIn, retryToken])

  const activeCount = isFiisHub ? countActiveFiiFilters(fiiParams) : countActiveStockFilters(params)
  const currentAssetType = toStockAssetType(params.assetTypeFilter ?? null)

  const clearFilters = () => {
    if (isFiisHub) setFiiParams(DEFAULT_FII_PARAMS)
    else setParams(defaultStockParams(currentAssetType))
  }

  const handleAIParametersGenerated = (generated: ScreeningParams) => {
    setParams({ ...defaultStockParams(currentAssetType), minLiquidity: params.minLiquidity, ...generated })
    setFiltersOpen(false)
  }

  const results = useMemo(() => response?.results ?? [], [response])
  const cardResults = useMemo(() => sortResults(results, mobileSort), [results, mobileSort])
  const total = response?.count ?? 0
  const insufficientData = !isFiisHub && params.dipWithIntactFundamentals ? response?.insufficientData ?? 0 : 0
  const noun = isFiisHub ? (total === 1 ? "FII" : "FIIs") : total === 1 ? "ação" : "ações"
  // Fora do Premium o backend corta em 3 antes de contar: só mostramos o total quando ele é conhecido.
  const countKnown = hasFullAccess || total > results.length || results.length < FREE_RESULT_LIMIT
  const isLimited = !!response && !hasFullAccess && (total > results.length || results.length >= FREE_RESULT_LIMIT)
  const sortOptions = isFiisHub ? FII_SORT_OPTIONS : STOCK_SORT_OPTIONS
  const industriesForAI = sectorData.industries.length > 0 ? sectorData.industries : Object.values(sectorData.industriesBySector).flat()

  const activeLabel = activeCount === 0 ? "Sem filtros" : `${activeCount} filtro${activeCount > 1 ? "s" : ""} ativo${activeCount > 1 ? "s" : ""}`

  const filterFields = (
    <div className="space-y-5">
      {!isFiisHub && (
        <ScreeningAIAssistant
          onParametersGenerated={handleAIParametersGenerated}
          availableSectors={sectorData.sectors}
          availableIndustries={industriesForAI}
          isLoggedIn={isLoggedIn}
          isPremium={hasFullAccess}
        />
      )}
      {isFiisHub ? (
        <FiiScreeningConfigurator
          params={fiiParams}
          onChange={setFiiParams}
          segments={sectorData.industriesBySector["Fundos Imobiliários"] ?? []}
          segmentsLoading={sectorsLoading}
        />
      ) : (
        <ScreeningConfigurator
          params={params}
          onParamsChange={setParams}
          canUsePremiumFilters={hasFullAccess}
          isLoggedIn={isLoggedIn}
          sectors={sectorData.sectors}
          industriesBySector={sectorData.industriesBySector}
          sectorsLoading={sectorsLoading}
        />
      )}
    </div>
  )

  const emptySuggestions = getEmptySuggestions({ isFiisHub, params, fiiParams, setParams, setFiiParams })

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-10 sm:px-6 lg:px-8">
        <PageHeader
          breadcrumb={[{ label: "Ferramentas", href: "/ranking" }, { label: isFiisHub ? "Screening de FIIs" : "Screening de ações" }]}
          title={isFiisHub ? "Screening de FIIs" : "Screening de ações"}
          description={
            isFiisHub
              ? "Filtre fundos imobiliários por dividend yield, P/VP, liquidez, vacância, segmento e tipo."
              : "Filtre ações da B3 e BDRs por valuation, rentabilidade, dividendos e endividamento."
          }
          actions={
            <nav aria-label="Outras ferramentas" className="hidden items-center gap-4 text-sm sm:flex">
              <Link
                href={isFiisHub ? "/screening-acoes" : "/screening-fiis"}
                className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground md:min-h-0"
              >
                {isFiisHub ? "Screening de ações" : "Screening de FIIs"}
              </Link>
              <Link href="/ranking" className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground md:min-h-0">
                Rankings
              </Link>
            </nav>
          }
        />

        {!isFiisHub && (
          <div className="mt-4 flex items-center gap-2">
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">Estratégias prontas</span>
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              {getAllPresetSlugs().map((slug) => (
                <li key={slug} className="shrink-0">
                  <Link
                    href={`/screening-acoes/${slug}`}
                    className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors hover:border-brand hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-8"
                  >
                    {SCREENING_PRESETS[slug].shortTitle}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-6">
          <aside
            aria-label="Filtros"
            className="hidden rounded-lg border border-border bg-card lg:sticky lg:top-20 lg:block lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">Filtros</h2>
                <p className="text-xs text-muted-foreground">{activeLabel}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={clearFilters} disabled={activeCount === 0}>
                Limpar
              </Button>
            </div>
            <div className="p-4">{isDesktop && filterFields}</div>
          </aside>

          <section id="results-section" aria-labelledby="screening-results-title" aria-busy={loading} className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="h-11 lg:hidden"
                onClick={() => setFiltersOpen(true)}
                aria-haspopup="dialog"
              >
                <SlidersHorizontal className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
              </Button>
              {isMobile && results.length > 1 && (
                <Select value={mobileSort} onValueChange={(value) => setMobileSort(value as MobileSortKey)}>
                  <SelectTrigger aria-label="Ordenar resultados" className="min-w-0 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex w-full items-center gap-2 lg:w-auto">
                <h2 id="screening-results-title" className="text-lg font-semibold tabular-nums text-foreground">
                  {!response
                    ? isFiisHub
                      ? "FIIs"
                      : "Ações"
                    : countKnown
                      ? `${total.toLocaleString("pt-BR")} ${noun}`
                      : `Primeiros ${results.length} resultados`}
                </h2>
                {loading && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                    Atualizando
                  </span>
                )}
              </div>
              {insufficientData > 0 && (
                <p className="flex w-full items-center gap-1 text-xs tabular-nums text-muted-foreground">
                  {insufficientData.toLocaleString("pt-BR")} sem dados suficientes
                  <InfoHint content="Ações que atendem aos demais filtros, mas não têm 200 pregões de preço ou dois períodos de 12 meses de demonstrações para avaliar a queda com fundamentos intactos." />
                </p>
              )}
            </div>

            {error ? (
              <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-negative">{error}</p>
                <Button variant="outline" size="sm" onClick={() => setRetryToken((token) => token + 1)}>
                  Tentar novamente
                </Button>
              </div>
            ) : response && total === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
                <p className="font-medium text-foreground">{isFiisHub ? "Nenhum FII encontrado" : "Nenhuma ação encontrada"}</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Os filtros ficaram restritivos demais. Tente uma sugestão abaixo ou limpe os filtros.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {emptySuggestions.map((suggestion) => (
                    <Button key={suggestion.label} variant="outline" size="sm" onClick={suggestion.apply}>
                      {suggestion.label}
                    </Button>
                  ))}
                  <Button size="sm" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                </div>
              </div>
            ) : isMobile && !response ? (
              <div className="flex items-center justify-center rounded-lg border border-border bg-card py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.75} aria-label="Carregando resultados" />
              </div>
            ) : (
              <div className={loading && response ? "opacity-60 transition-opacity" : "transition-opacity"}>
                <ScreeningResults
                  results={isMobile ? cardResults : results}
                  isFii={isFiisHub}
                  compact={isMobile}
                  loading={loading}
                />
              </div>
            )}

            {isLimited && (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-foreground">
                  {countKnown
                    ? `Mostrando ${results.length} de ${total.toLocaleString("pt-BR")} ${noun}.`
                    : `O plano gratuito mostra até ${FREE_RESULT_LIMIT} resultados por busca.`}{" "}
                  <span className="text-muted-foreground">
                    {isLoggedIn
                      ? "Assine o Premium para ver a lista completa e liberar todos os filtros."
                      : "Crie uma conta grátis e teste o Premium por 1 dia para ver a lista completa."}
                  </span>
                </p>
                <Button asChild size="sm" className="shrink-0">
                  <Link href={isLoggedIn ? "/planos" : "/register"}>{isLoggedIn ? "Ver planos" : "Criar conta grátis"}</Link>
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Filtros quantitativos sobre dados públicos. Não é recomendação de investimento. Preço justo, preço-teto e
              upside são estimativas baseadas em modelos.
            </p>
          </section>
        </div>
      </div>

      {!isLoggedIn && status !== "loading" && <ScreeningSeoContent isFiisHub={isFiisHub} />}

      <Sheet open={filtersOpen && !isDesktop} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="bottom"
          className="gap-0 p-0"
          // Não foca o primeiro campo ao abrir: no celular isso abriria o teclado sobre os filtros.
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader className="border-b border-border pr-14">
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>{activeLabel}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{filterFields}</div>
          <SheetFooter className="flex-row border-t border-border bg-background">
            <Button variant="outline" className="h-11" onClick={clearFilters} disabled={activeCount === 0}>
              Limpar
            </Button>
            <Button className="h-11 flex-1" onClick={() => setFiltersOpen(false)}>
              {loading ? "Atualizando…" : `Ver resultados${response && countKnown ? ` (${total.toLocaleString("pt-BR")})` : ""}`}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crie sua conta para continuar filtrando</DialogTitle>
            <DialogDescription>
              Você já usou {MAX_ANONYMOUS_SCREENINGS} buscas sem conta. Com uma conta grátis você continua usando o screening e
              pode testar o Premium por 1 dia para liberar todos os filtros.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button asChild className="h-11 w-full">
              <Link href={`/register?redirect=${encodeURIComponent(isFiisHub ? "/screening-fiis" : "/screening-acoes")}`}>
                Criar conta grátis
              </Link>
            </Button>
            <Button variant="ghost" className="h-11 w-full" onClick={() => signIn()}>
              Já tenho conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface Suggestion {
  label: string
  apply: () => void
}

/** Até 2 sugestões para afrouxar os filtros quando a busca volta vazia. */
function getEmptySuggestions({
  isFiisHub,
  params,
  fiiParams,
  setParams,
  setFiiParams,
}: {
  isFiisHub: boolean
  params: ExtendedScreeningParams
  fiiParams: FiiScreeningFormParams
  setParams: (params: ExtendedScreeningParams) => void
  setFiiParams: (params: FiiScreeningFormParams) => void
}): Suggestion[] {
  const suggestions: Suggestion[] = []

  if (isFiisHub) {
    const { maxPVP, minDY, tipoFii, segmento } = fiiParams
    if (maxPVP !== undefined) {
      suggestions.push({ label: "Aumentar P/VP máximo", apply: () => setFiiParams({ ...fiiParams, maxPVP: Number((maxPVP * 1.3).toFixed(2)) }) })
    }
    if (minDY !== undefined && minDY > 0) {
      suggestions.push({ label: "Reduzir DY mínimo", apply: () => setFiiParams({ ...fiiParams, minDY: Number((minDY * 0.7).toFixed(4)) }) })
    }
    if (tipoFii !== "both") {
      suggestions.push({ label: "Incluir tijolo e papel", apply: () => setFiiParams({ ...fiiParams, tipoFii: "both" }) })
    }
    if (segmento) {
      suggestions.push({ label: "Todos os segmentos", apply: () => setFiiParams({ ...fiiParams, segmento: undefined }) })
    }
    if (fiiParams.minLiquidity !== null) {
      suggestions.push({ label: "Incluir baixa liquidez", apply: () => setFiiParams({ ...fiiParams, minLiquidity: null }) })
    }
    return suggestions.slice(0, 2)
  }

  const { plFilter, roeFilter, dyFilter, companySize, selectedSectors, bazinDiscountFilter, pegFilter } = params
  if (params.dipWithIntactFundamentals) {
    suggestions.push({ label: "Remover filtro de queda", apply: () => setParams({ ...params, dipWithIntactFundamentals: undefined }) })
  }
  if (bazinDiscountFilter?.enabled && bazinDiscountFilter.min !== undefined && bazinDiscountFilter.min > 0) {
    const min = bazinDiscountFilter.min
    suggestions.push({
      label: "Reduzir desconto Bazin",
      apply: () => setParams({ ...params, bazinDiscountFilter: { ...bazinDiscountFilter, min: Number((min / 2).toFixed(4)) } }),
    })
  }
  if (pegFilter?.enabled && pegFilter.max !== undefined) {
    const max = pegFilter.max
    suggestions.push({ label: "Aumentar PEG máximo", apply: () => setParams({ ...params, pegFilter: { ...pegFilter, max: Number((max * 1.5).toFixed(2)) } }) })
  }
  if (plFilter?.enabled && plFilter.max !== undefined) {
    const max = plFilter.max
    suggestions.push({ label: "Aumentar P/L máximo", apply: () => setParams({ ...params, plFilter: { ...plFilter, max: Number((max * 1.5).toFixed(1)) } }) })
  }
  if (roeFilter?.enabled && roeFilter.min !== undefined) {
    const min = roeFilter.min
    suggestions.push({ label: "Reduzir ROE mínimo", apply: () => setParams({ ...params, roeFilter: { ...roeFilter, min: Number((min * 0.6).toFixed(4)) } }) })
  }
  if (dyFilter?.enabled && dyFilter.min !== undefined) {
    const min = dyFilter.min
    suggestions.push({ label: "Reduzir DY mínimo", apply: () => setParams({ ...params, dyFilter: { ...dyFilter, min: Number((min * 0.6).toFixed(4)) } }) })
  }
  if (companySize && companySize !== "all") {
    suggestions.push({ label: "Todos os tamanhos", apply: () => setParams({ ...params, companySize: "all" }) })
  }
  if (selectedSectors && selectedSectors.length > 0) {
    suggestions.push({ label: "Todos os setores", apply: () => setParams({ ...params, selectedSectors: [], selectedIndustries: [] }) })
  }
  if (params.minLiquidity !== null) {
    suggestions.push({ label: "Incluir baixa liquidez", apply: () => setParams({ ...params, minLiquidity: null }) })
  }
  return suggestions.slice(0, 2)
}
