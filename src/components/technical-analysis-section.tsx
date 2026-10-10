'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, formatNumber } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import PriceChart from './price-chart'
import { useHistoricalPrices } from '@/hooks/use-company-data'

type Signal = 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO'

interface HistoricalData {
  date: string
  open: number
  high: number
  low: number
  close: number
  adjustedClose: number
  volume: number
}

interface RSIData {
  date: Date
  rsi: number
  signal: Signal
}

interface StochasticData {
  date: Date
  k: number
  d: number
  signal: Signal
}

interface TechnicalAnalysis {
  rsi: RSIData[]
  stochastic: StochasticData[]
  currentRSI: RSIData | null
  currentStochastic: StochasticData | null
  overallSignal: Signal
}

interface HistoricalPricesResponse {
  ticker: string
  companyName: string
  historicalData: HistoricalData[]
  technicalAnalysis: TechnicalAnalysis | null
  dataCount: number
  lastUpdate: string
  message?: string
}

interface TechnicalAnalysisSectionProps {
  ticker: string
  userIsPremium: boolean
}

const SIGNAL_LABEL: Record<Signal, string> = {
  SOBRECOMPRA: 'Sobrecompra',
  SOBREVENDA: 'Sobrevenda',
  NEUTRO: 'Neutro',
}

/** A data do último pregão vem como meia-noite UTC: formata o dia do calendário, sem deslocar para o dia anterior. */
function formatCalendarDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return formatDate(null)
  return formatDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)))
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Bloco recolhível de análise técnica (gráfico de preço, RSI e estocástico). Os dados só carregam ao abrir. */
export default function TechnicalAnalysisSection({ ticker, userIsPremium }: TechnicalAnalysisSectionProps) {
  const [isOpen, setIsOpen] = useState(false)

  const { data: rawData, isLoading: loading, error: queryError, refetch } = useHistoricalPrices(
    isOpen && userIsPremium ? ticker : ''
  )
  const data = rawData as unknown as HistoricalPricesResponse | undefined
  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Erro desconhecido') : null
  const overallSignal = data?.technicalAnalysis?.overallSignal

  return (
    <section aria-labelledby="analise-tecnica" className="rounded-lg border border-border bg-card">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <h2>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted/50 sm:px-5"
            >
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span id="analise-tecnica" className="text-lg font-semibold tracking-tight text-foreground">
                  Análise técnica
                </span>
                <Badge variant="brand">Premium</Badge>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {overallSignal && <span className="text-sm text-muted-foreground">{SIGNAL_LABEL[overallSignal]}</span>}
                <ChevronDown
                  className={cn('size-4 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180')}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </span>
            </button>
          </CollapsibleTrigger>
        </h2>

        <CollapsibleContent>
          <div className="border-t border-border px-4 pt-4 pb-5 sm:px-5">
            {!userIsPremium ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  Gráfico de preços em linha e candlestick, RSI e oscilador estocástico fazem parte do Premium.
                </p>
                <Button asChild className="shrink-0">
                  <Link href="/planos">Assinar o Premium</Link>
                </Button>
              </div>
            ) : loading ? (
              <div className="space-y-4" aria-busy="true" aria-label="Carregando análise técnica">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-64 w-full" />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              </div>
            ) : error ? (
              <EmptyState
                title="Não foi possível carregar a análise técnica"
                description={error}
                action={
                  <Button variant="outline" onClick={() => refetch()}>
                    Tentar novamente
                  </Button>
                }
              />
            ) : !data ? (
              <EmptyState
                title="Análise técnica"
                description="Gráfico de preços e indicadores técnicos como RSI e oscilador estocástico."
                action={<Button onClick={() => refetch()}>Carregar análise técnica</Button>}
              />
            ) : (
              <div className="space-y-4">
                <p className="max-w-[68ch] text-sm leading-6 text-muted-foreground">
                  A análise técnica complementa a análise fundamentalista: primeiro avalie a qualidade do ativo, depois
                  use os indicadores para entender o momento do preço. Sinais podem persistir por longos períodos em
                  tendências fortes, e dados históricos não garantem resultados futuros.
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="tabular-nums">{formatNumber(data.dataCount, { digits: 0 })}</span> registros mensais
                  {data.lastUpdate && <> · último registro em {formatCalendarDate(data.lastUpdate)}</>}
                  {data.technicalAnalysis && <> · RSI e estocástico calculados sobre os últimos 24 meses</>}
                </p>

                {data.historicalData.length === 0 ? (
                  <EmptyState
                    title="Dados indisponíveis"
                    description={data.message || 'Não há dados históricos suficientes para gerar a análise técnica.'}
                  />
                ) : data.dataCount < 20 ? (
                  <EmptyState
                    title="Dados insuficientes"
                    description={`São necessários pelo menos 20 registros históricos para calcular os indicadores. Hoje há ${formatNumber(data.dataCount, { digits: 0 })}.`}
                  />
                ) : (
                  <PriceChart data={data.historicalData} technicalAnalysis={data.technicalAnalysis} ticker={data.ticker} />
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}
