'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionHeader } from '@/components/ui/section-header'
import { InfoHint } from '@/components/ui/info-hint'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Info, AlertTriangle, RefreshCw, History, Loader2 } from 'lucide-react'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { useAdminStatus } from '@/hooks/use-admin-status'
import { useToast } from '@/hooks/use-toast'
import { useCompanyAnalysis } from '@/hooks/use-company-data'
import { formatBRL, formatDate, formatNumber, formatPct } from '@/lib/format'
import { getTechnicalTrafficLightStatus, priceRangePosition } from '@/lib/radar-service'
import { softenAiText } from '@/app/acao/[ticker]/analise-tecnica/ai-text'
import SupportResistanceChart from './support-resistance-chart'
import { TechnicalAnalysisDisclaimer } from './technical-analysis-page-limited'

interface TechnicalAnalysisPageProps {
  ticker: string
  /**
   * Score fundamentalista usado no status técnico (só fica favorável com score ≥ 50).
   * Quando omitido, vem da análise da empresa (ações e BDRs). ETFs informam o score PJ-ETF.
   */
  fundamentalScore?: number | null
}

interface PriceLevel {
  price: number
  strength: number
  type: string
  touches: number
}

interface TechnicalAnalysisData {
  rsi: number | null
  stochasticK: number | null
  stochasticD: number | null
  macd: number | null
  macdSignal: number | null
  macdHistogram: number | null
  sma20: number | null
  sma50: number | null
  sma200: number | null
  ema12: number | null
  ema26: number | null
  bbUpper: number | null
  bbMiddle: number | null
  bbLower: number | null
  bbWidth: number | null
  fib236: number | null
  fib382: number | null
  fib500: number | null
  fib618: number | null
  fib786: number | null
  tenkanSen: number | null
  kijunSen: number | null
  senkouSpanA: number | null
  senkouSpanB: number | null
  chikouSpan: number | null
  supportLevels: PriceLevel[]
  resistanceLevels: PriceLevel[]
  psychologicalLevels: PriceLevel[]
  aiMinPrice: number | null
  aiMaxPrice: number | null
  aiFairEntryPrice: number | null
  aiAnalysis: string | null
  aiConfidence: number | null
  calculatedAt: string
  expiresAt: string
  currentPrice: number
}

interface HistoricalData {
  date: string
  close: number
  high: number
  low: number
}

interface ApiResponse {
  ticker: string
  analysis: TechnicalAnalysisData
  historicalData?: HistoricalData[]
  cached: boolean
}

interface HistoryItem {
  id: string
  calculatedAt: string
  expiresAt: string
}

interface HistoryResponse {
  ticker: string
  history: HistoryItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

interface UsageResponse {
  ticker: string
  isPremium: boolean
  allowed: boolean
  remaining: number
  limit: number
  currentUsage: number
  monthlyUsage?: number
}

type ChartLevel = { price: number; strength: number; type: 'support' | 'resistance' | 'psychological'; touches: number }

/** Linha rótulo → valor de uma lista de definições. */
function ValueRow({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  )
}

function IndicatorBlock({
  title,
  hint,
  value,
  badge,
  children,
}: {
  title: string
  hint?: string
  value?: string
  badge?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>{title}</span>
        {hint && <InfoHint content={hint} label={`Sobre ${title}`} />}
      </div>
      {value !== undefined && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span data-num className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </span>
          {badge}
        </div>
      )}
      {children && <dl className="mt-2 divide-y divide-border">{children}</dl>}
    </div>
  )
}

/** Barra da faixa estimada: faixa mínima–máxima, entrada técnica (traço) e preço atual (ponto). */
function EstimatedRangeBar({ min, max, entry, price }: { min: number; max: number; entry: number | null; price: number }) {
  const low = Math.min(min, price)
  const high = Math.max(max, price)
  const pad = (high - low) * 0.08 || high * 0.02
  const domainMin = low - pad
  const domainMax = high + pad
  const at = (value: number) => `${((value - domainMin) / (domainMax - domainMin)) * 100}%`
  const position = priceRangePosition(min, max, price)
  const positionText =
    position?.position === 'below'
      ? 'Preço atual abaixo da faixa estimada'
      : position?.position === 'above'
      ? 'Preço atual acima da faixa estimada'
      : 'Preço atual dentro da faixa estimada'

  return (
    <figure className="space-y-2">
      <div
        role="img"
        aria-label={`${positionText}: ${formatBRL(price)}, faixa de ${formatBRL(min)} a ${formatBRL(max)}`}
        className="relative h-6"
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-subtle ring-1 ring-brand/40"
          style={{ left: at(min), width: `calc(${at(max)} - ${at(min)})` }}
        />
        {entry !== null && entry >= domainMin && entry <= domainMax && (
          <div className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground" style={{ left: at(entry) }} />
        )}
        <div
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground"
          style={{ left: at(price) }}
        />
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-foreground" />
          {positionText}: <span className="tabular-nums text-foreground">{formatBRL(price)}</span>
        </span>
        {entry !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-0.5 rounded-full bg-muted-foreground" />
            Entrada técnica
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-4 rounded-full bg-brand-subtle ring-1 ring-brand/40" />
          Faixa estimada
        </span>
      </figcaption>
    </figure>
  )
}

function LevelList({ title, levels, empty }: { title: string; levels: PriceLevel[]; empty: string }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {levels.length > 0 ? (
        <dl className="mt-1 divide-y divide-border">
          {levels.map((level, idx) => (
            <div key={`${level.price}-${idx}`} className="flex items-baseline justify-between gap-3 py-2">
              <dt className="text-sm font-medium tabular-nums text-foreground">{formatBRL(level.price)}</dt>
              <dd className="text-xs text-muted-foreground">
                força {level.strength}/5
                {level.touches > 0 && ` · ${level.touches} ${level.touches === 1 ? 'toque' : 'toques'}`}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  )
}

function rsiBadge(rsi: number) {
  if (rsi >= 70) return <Badge variant="warning">Sobrecompra</Badge>
  if (rsi <= 30) return <Badge variant="warning">Sobrevenda</Badge>
  return <Badge variant="neutral">Neutro</Badge>
}

/** Busca o score geral da empresa (ações e BDRs) e renderiza a análise. */
function WithCompanyScore({ ticker }: { ticker: string }) {
  const { data: companyAnalysisData } = useCompanyAnalysis(ticker)
  return <TechnicalAnalysisContent ticker={ticker} overallScore={companyAnalysisData?.overallScore?.score ?? null} />
}

export default function TechnicalAnalysisPage({ ticker, fundamentalScore }: TechnicalAnalysisPageProps) {
  if (fundamentalScore !== undefined) return <TechnicalAnalysisContent ticker={ticker} overallScore={fundamentalScore} />
  return <WithCompanyScore ticker={ticker} />
}

function TechnicalAnalysisContent({ ticker, overallScore }: { ticker: string; overallScore: number | null }) {
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { isPremium, isLoading: premiumLoading } = usePremiumStatus()
  const { isAdmin } = useAdminStatus()
  const canUpdate = isPremium || isAdmin

  const analysisQueryKey = selectedAnalysisId
    ? ['technical-analysis', ticker, selectedAnalysisId]
    : ['technical-analysis', ticker]

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: analysisQueryKey,
    queryFn: async () => {
      const url = selectedAnalysisId
        ? `/api/technical-analysis/${ticker}?id=${selectedAnalysisId}`
        : `/api/technical-analysis/${ticker}`
      const response = await fetch(url)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao carregar análise técnica')
      }
      return response.json()
    }
  })

  const { data: historyData, isLoading: historyLoading } = useQuery<HistoryResponse>({
    queryKey: ['technical-analysis-history', ticker, historyPage],
    queryFn: async (): Promise<HistoryResponse> => {
      const response = await fetch(`/api/technical-analysis/${ticker}/history?page=${historyPage}&pageSize=20`)
      if (!response.ok) {
        throw new Error('Erro ao carregar histórico')
      }
      return response.json()
    },
    enabled: historyOpen,
    placeholderData: (previousData) => previousData
  })

  const handleHistoryOpenChange = (open: boolean) => {
    setHistoryOpen(open)
    if (open) {
      setHistoryPage(1)
    }
  }

  // Uso mensal: só para quem não é Premium (depois de saber o plano)
  const { data: usageData } = useQuery<UsageResponse>({
    queryKey: ['technical-analysis-usage', ticker],
    queryFn: async () => {
      const response = await fetch(`/api/technical-analysis/${ticker}/usage`)
      if (!response.ok) {
        throw new Error('Erro ao verificar uso')
      }
      return response.json()
    },
    enabled: !premiumLoading && !isPremium
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/technical-analysis/${ticker}`, {
        method: 'POST'
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao atualizar análise técnica')
      }
      return response.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['technical-analysis', ticker] })
      queryClient.invalidateQueries({ queryKey: ['technical-analysis-history', ticker] })
      setSelectedAnalysisId(null)
      toast({
        title: result.recalculated ? 'Análise atualizada' : 'A análise de hoje já existe',
        description: result.message || 'A análise técnica foi atualizada.'
      })
    },
    onError: (mutationError: Error) => {
      toast({
        title: 'Não foi possível atualizar a análise',
        description: mutationError.message,
        variant: 'destructive'
      })
    }
  })

  const handleHistorySelect = (analysisId: string) => {
    setSelectedAnalysisId(analysisId)
    setHistoryOpen(false)
  }

  const handleLoadCurrent = () => {
    setSelectedAnalysisId(null)
    queryClient.invalidateQueries({ queryKey: ['technical-analysis', ticker] })
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Carregando análise técnica">
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" strokeWidth={1.75} />
        <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
          Não foi possível carregar a análise técnica.
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['technical-analysis', ticker] })}
          >
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!data?.analysis) {
    return (
      <Alert>
        <Info className="size-4" strokeWidth={1.75} />
        <AlertDescription>Dados históricos insuficientes para a análise técnica.</AlertDescription>
      </Alert>
    )
  }

  const analysis = data.analysis
  const status = getTechnicalTrafficLightStatus(analysis, analysis.currentPrice, overallScore)
  const hasRange = analysis.aiMinPrice !== null && analysis.aiMaxPrice !== null && analysis.aiMaxPrice > analysis.aiMinPrice
  const hasFibonacci = analysis.fib236 !== null
  const hasIchimoku = analysis.tenkanSen !== null

  return (
    <div className="space-y-8">
      {/* Controles */}
      <div className="space-y-3">
        {selectedAnalysisId && (
          <Alert>
            <Info className="size-4" strokeWidth={1.75} />
            <AlertDescription className="flex flex-wrap items-center gap-x-2">
              Você está vendo uma análise anterior.
              <Button variant="link" className="h-auto p-0" onClick={handleLoadCurrent}>
                Ver a análise atual
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {!isPremium && usageData && (
          <Alert>
            <Info className="size-4" strokeWidth={1.75} />
            <AlertDescription>
              Você viu {usageData.currentUsage} de {usageData.limit} análises técnicas este mês.
              {usageData.remaining > 0
                ? ` ${usageData.remaining === 1 ? 'Resta 1 análise' : `Restam ${usageData.remaining} análises`}.`
                : ' Com o Premium, o acesso é ilimitado.'}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Calculada em {formatDate(analysis.calculatedAt, { style: 'datetime' })} · válida até{' '}
            {formatDate(analysis.expiresAt, { style: 'datetime' })}
          </p>
          <div className="flex items-center gap-2">
            <Dialog open={historyOpen} onOpenChange={handleHistoryOpenChange}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <History className="size-4 text-muted-foreground" strokeWidth={1.75} />
                  Histórico
                </Button>
              </DialogTrigger>
              <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-2xl flex-col sm:w-full">
                <DialogHeader>
                  <DialogTitle>Histórico de análises técnicas</DialogTitle>
                  <DialogDescription>Selecione uma análise anterior para visualizar.</DialogDescription>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {historyLoading ? (
                    <div className="flex flex-1 items-center justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.75} />
                    </div>
                  ) : historyData && historyData.history && historyData.history.length > 0 ? (
                    <>
                      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                        {historyData.history.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => handleHistorySelect(item.id)}
                              className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                            >
                              <span className="min-w-0">
                                <span className="block text-sm font-medium tabular-nums text-foreground">
                                  {formatDate(item.calculatedAt, { style: 'datetime' })}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  Válida até {formatDate(item.expiresAt)}
                                </span>
                              </span>
                              {selectedAnalysisId === item.id && <Badge variant="brand">Em exibição</Badge>}
                            </button>
                          </li>
                        ))}
                      </ul>
                      {historyData.pagination && historyData.pagination.totalPages > 1 && (
                        <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
                          <p className="text-sm tabular-nums text-muted-foreground">
                            {(historyData.pagination.page - 1) * historyData.pagination.pageSize + 1}–
                            {Math.min(historyData.pagination.page * historyData.pagination.pageSize, historyData.pagination.total)} de{' '}
                            {historyData.pagination.total}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                              disabled={historyData.pagination.page === 1 || historyLoading}
                            >
                              Anterior
                            </Button>
                            <span className="text-sm tabular-nums text-muted-foreground">
                              {historyData.pagination.page} / {historyData.pagination.totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setHistoryPage((p) => Math.min(historyData.pagination.totalPages, p + 1))}
                              disabled={historyData.pagination.page === historyData.pagination.totalPages || historyLoading}
                            >
                              Próxima
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
                      Nenhuma análise anterior encontrada.
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {canUpdate && (
              <Button variant="outline" size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" strokeWidth={1.75} />
                ) : (
                  <RefreshCw className="size-4 text-muted-foreground" strokeWidth={1.75} />
                )}
                {updateMutation.isPending ? 'Atualizando…' : 'Atualizar análise'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Faixa estimada pela IA */}
      {analysis.aiFairEntryPrice !== null && (
        <section aria-labelledby="faixa-estimada" className="space-y-4">
          <SectionHeader
            id="faixa-estimada"
            title={
              <>
                Faixa estimada (30 dias)
                <span className="font-normal text-muted-foreground"> · gerada por IA · não é recomendação</span>
              </>
            }
            actions={<Badge variant={status.status === 'red' ? 'warning' : 'neutral'}>{status.label}</Badge>}
          />
          <div className="space-y-5 rounded-lg border border-border bg-card p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Mínima estimada</p>
                <p data-num className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">
                  {formatBRL(analysis.aiMinPrice)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Máxima estimada</p>
                <p data-num className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">
                  {formatBRL(analysis.aiMaxPrice)}
                </p>
              </div>
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Entrada técnica estimada</span>
                  <InfoHint
                    label="Sobre a entrada técnica"
                    content="Preço que o modelo considera uma região técnica de entrada, a partir de suportes, médias e da faixa estimada. É uma estimativa, não uma recomendação."
                  />
                </div>
                <p data-num className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">
                  {formatBRL(analysis.aiFairEntryPrice)}
                </p>
                {analysis.aiConfidence !== null && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Confiança do modelo: {formatPct(analysis.aiConfidence / 100, { digits: 0 })}
                  </p>
                )}
              </div>
            </div>

            {hasRange && (
              <EstimatedRangeBar
                min={analysis.aiMinPrice as number}
                max={analysis.aiMaxPrice as number}
                entry={analysis.aiFairEntryPrice}
                price={analysis.currentPrice}
              />
            )}

            <p className="text-sm text-muted-foreground">{status.description}</p>

            {analysis.aiAnalysis && (
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Leitura do modelo</p>
                <p className="mt-2 max-w-[68ch] whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {softenAiText(analysis.aiAnalysis)}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Indicadores */}
      <Tabs defaultValue="indicators" className="w-full gap-4">
        <TabsList variant="underline" aria-label="Seções da análise técnica">
          <TabsTrigger value="indicators">Indicadores</TabsTrigger>
          <TabsTrigger value="support-resistance">Suporte/resistência</TabsTrigger>
          <TabsTrigger value="fibonacci">Fibonacci</TabsTrigger>
          <TabsTrigger value="ichimoku">Ichimoku</TabsTrigger>
        </TabsList>

        <TabsContent value="indicators">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {analysis.rsi !== null && (
              <IndicatorBlock
                title="IFR (RSI 14)"
                hint="Índice de força relativa de 0 a 100. Acima de 70 indica sobrecompra; abaixo de 30, sobrevenda."
                value={formatNumber(analysis.rsi, { digits: 1 })}
                badge={rsiBadge(analysis.rsi)}
              />
            )}
            {analysis.macd !== null && (
              <IndicatorBlock
                title="MACD"
                hint="Diferença entre as médias exponenciais de 12 e 26 períodos. O histograma compara o MACD com a linha de sinal."
                value={formatNumber(analysis.macd, { digits: 4 })}
                badge={
                  analysis.macdHistogram !== null ? (
                    <Badge variant="neutral">Histograma {analysis.macdHistogram > 0 ? 'positivo' : 'negativo'}</Badge>
                  ) : undefined
                }
              >
                <ValueRow label="Linha de sinal" value={formatNumber(analysis.macdSignal, { digits: 4 })} />
                <ValueRow label="Histograma" value={formatNumber(analysis.macdHistogram, { digits: 4 })} />
              </IndicatorBlock>
            )}
            {analysis.stochasticK !== null && (
              <IndicatorBlock
                title="Estocástico"
                hint="Posição do fechamento na faixa de preços recente, de 0 a 100. Acima de 80, sobrecompra; abaixo de 20, sobrevenda."
                value={formatNumber(analysis.stochasticK, { digits: 1 })}
              >
                <ValueRow label="%D" value={formatNumber(analysis.stochasticD, { digits: 1 })} />
              </IndicatorBlock>
            )}
            {analysis.bbUpper !== null && (
              <IndicatorBlock title="Bandas de Bollinger" hint="Média de 20 períodos com bandas de 2 desvios-padrão.">
                <ValueRow label="Superior" value={formatBRL(analysis.bbUpper)} />
                <ValueRow label="Média" value={formatBRL(analysis.bbMiddle)} />
                <ValueRow label="Inferior" value={formatBRL(analysis.bbLower)} />
              </IndicatorBlock>
            )}
            {(analysis.sma20 !== null || analysis.sma50 !== null || analysis.sma200 !== null) && (
              <IndicatorBlock title="Médias móveis" hint="SMA: média simples. MME: média exponencial.">
                <ValueRow label="SMA 20" value={formatBRL(analysis.sma20)} />
                <ValueRow label="SMA 50" value={formatBRL(analysis.sma50)} />
                <ValueRow label="SMA 200" value={formatBRL(analysis.sma200)} />
                <ValueRow label="MME 12" value={formatBRL(analysis.ema12)} />
                <ValueRow label="MME 26" value={formatBRL(analysis.ema26)} />
              </IndicatorBlock>
            )}
          </div>
        </TabsContent>

        <TabsContent value="support-resistance" className="space-y-6">
          {data.historicalData && data.historicalData.length > 0 ? (
            <SupportResistanceChart
              historicalData={data.historicalData}
              supportLevels={analysis.supportLevels as ChartLevel[]}
              resistanceLevels={analysis.resistanceLevels as ChartLevel[]}
              currentPrice={analysis.currentPrice}
            />
          ) : (
            <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
              Sem histórico de preços para exibir o gráfico.
            </p>
          )}
          <div className="grid gap-6 rounded-lg border border-border bg-card p-4 sm:p-5 md:grid-cols-2">
            <LevelList title="Suportes" levels={analysis.supportLevels} empty="Nenhum suporte detectado." />
            <LevelList title="Resistências" levels={analysis.resistanceLevels} empty="Nenhuma resistência detectada." />
          </div>
        </TabsContent>

        <TabsContent value="fibonacci">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
            <SectionHeader
              as="h3"
              title="Retrações de Fibonacci"
              description="Níveis entre a mínima e a máxima do período analisado."
            />
            {hasFibonacci ? (
              <dl className="mt-3 max-w-md divide-y divide-border">
                <ValueRow label={formatPct(0.236)} value={formatBRL(analysis.fib236)} />
                <ValueRow label={formatPct(0.382)} value={formatBRL(analysis.fib382)} />
                <ValueRow label={formatPct(0.5)} value={formatBRL(analysis.fib500)} />
                <ValueRow label={formatPct(0.618)} value={formatBRL(analysis.fib618)} />
                <ValueRow label={formatPct(0.786)} value={formatBRL(analysis.fib786)} />
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Níveis de Fibonacci indisponíveis.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ichimoku">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
            <SectionHeader
              as="h3"
              title="Ichimoku"
              description="Tenkan-sen e Kijun-sen são médias de máximas e mínimas; os Senkou Span formam a nuvem."
            />
            {hasIchimoku ? (
              <dl className="mt-3 max-w-md divide-y divide-border">
                <ValueRow label="Tenkan-sen" value={formatBRL(analysis.tenkanSen)} />
                <ValueRow label="Kijun-sen" value={formatBRL(analysis.kijunSen)} />
                <ValueRow label="Senkou Span A" value={formatBRL(analysis.senkouSpanA)} />
                <ValueRow label="Senkou Span B" value={formatBRL(analysis.senkouSpanB)} />
                <ValueRow label="Chikou Span" value={formatBRL(analysis.chikouSpan)} />
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Dados de Ichimoku indisponíveis.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <TechnicalAnalysisDisclaimer />
    </div>
  )
}
