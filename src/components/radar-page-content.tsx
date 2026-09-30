'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Info, Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'
import { PageHeader } from '@/components/page-header'
import type { RadarAssetData } from '@/components/radar-grid'
import { useRadar } from '@/hooks/use-radar'
import { useRadarExplore } from '@/hooks/use-radar-explore'
import { useToast } from '@/hooks/use-toast'
import { usePremiumStatus } from '@/hooks/use-premium-status'

const RadarTickerInput = dynamic(
  () => import('@/components/radar-ticker-input').then((mod) => mod.RadarTickerInput),
  { loading: () => <RadarCardLoading /> }
)

const RadarGrid = dynamic(
  () => import('@/components/radar-grid').then((mod) => mod.RadarGrid),
  { loading: () => <RadarCardLoading /> }
)

function RadarCardLoading({ label = 'Carregando' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
      {label}
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}

/** Aviso do plano gratuito: texto neutro e um único link para os planos. */
function FreePlanNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span>{children}</span>
      </p>
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <Link href="/planos">Ver planos</Link>
      </Button>
    </div>
  )
}

interface ExploreItem {
  ticker: string
  name: string
  sector: string | null
  currentPrice: number
  logoUrl: string | null
  overallScore: number | null
  overallStatus?: 'green' | 'yellow' | 'red'
  approvedStrategies?: string[]
  strategies?: Record<string, unknown>
  upside: number | null
  valuationStatus?: 'green' | 'yellow' | 'red'
  technicalStatus?: string
  technicalLabel?: string
  technicalFairEntryPrice?: number | null
  sentimentScore: number | null
  sentimentStatus?: 'green' | 'yellow' | 'red'
  sentimentLabel?: string
}

function scoreStatus(score: number | null | undefined): 'green' | 'yellow' | 'red' {
  if (typeof score !== 'number') return 'yellow'
  return score >= 70 ? 'green' : score >= 50 ? 'yellow' : 'red'
}

function toGridRow(item: ExploreItem): RadarAssetData {
  const upside = typeof item.upside === 'number' ? item.upside : null
  return {
    ticker: item.ticker,
    name: item.name,
    sector: item.sector,
    currentPrice: item.currentPrice,
    logoUrl: item.logoUrl,
    overallScore: item.overallScore,
    overallStatus: item.overallStatus || scoreStatus(item.overallScore),
    strategies: {
      approved: item.approvedStrategies || [],
      all: item.strategies || {},
    },
    valuation: {
      upside,
      status: item.valuationStatus || (upside === null ? 'yellow' : upside > 10 ? 'green' : upside >= 0 ? 'yellow' : 'red'),
      label: '',
    },
    technical: {
      status: item.technicalStatus === 'compra' ? 'green' : 'yellow',
      label: item.technicalLabel || (item.technicalStatus === 'compra' ? 'Abaixo do valor estimado' : 'Neutro'),
      fairEntryPrice: item.technicalFairEntryPrice || null,
    },
    sentiment: {
      score: item.sentimentScore,
      status: item.sentimentStatus || 'yellow',
      label: item.sentimentLabel || '—',
    },
  }
}

const FREE_TICKER_LIMIT = 3

export function RadarPageContent() {
  const [activeTab, setActiveTab] = useState<'meu-radar' | 'explorar' | 'etfs'>('meu-radar')
  const [localTickers, setLocalTickers] = useState<string[]>([])
  const [localEtfTickers, setLocalEtfTickers] = useState<string[]>([])

  const { radarConfig, radarData, loadingConfig, loadingData, saveRadar } = useRadar()
  const { data: exploreData, isLoading: loadingExplore } = useRadarExplore()
  const { toast } = useToast()
  const { isPremium } = usePremiumStatus()

  // Sincronizar tickers locais com o radar salvo
  useEffect(() => {
    if (radarConfig?.tickers) {
      setLocalTickers(radarConfig.tickers)
    }
  }, [radarConfig?.tickers])

  // Sincronizar ETF tickers a partir dos dados carregados
  useEffect(() => {
    const etfTickers = (radarData as RadarAssetData[]).filter((a) => a.assetType === 'ETF').map((a) => a.ticker)
    if (etfTickers.length > 0) {
      setLocalEtfTickers(etfTickers)
    }
  }, [radarData])

  const handleSave = async (tickers: string[]) => {
    await saveRadar(tickers)
    setLocalTickers(tickers)
  }

  const handleAddToRadar = async (ticker: string) => {
    const tickerUpper = ticker.toUpperCase()

    if (localTickers.includes(tickerUpper)) {
      toast({ title: 'Ticker já adicionado', description: `${tickerUpper} já está no seu radar.` })
      return
    }

    const tickerLimit = isPremium ? Infinity : FREE_TICKER_LIMIT
    if (localTickers.length >= tickerLimit) {
      toast({
        title: 'Limite atingido',
        description: `No plano gratuito, o radar tem até ${FREE_TICKER_LIMIT} tickers. Com o Premium, não há limite.`,
        variant: 'destructive',
      })
      return
    }

    try {
      await handleSave([...localTickers, tickerUpper])
      toast({ title: 'Adicionado ao radar', description: `${tickerUpper} foi adicionado ao seu radar.` })
    } catch (error) {
      toast({
        title: 'Não foi possível adicionar',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    }
  }

  const handleEtfTickersChange = (etfTickers: string[]) => {
    const nonEtfTickers = localTickers.filter((t) => !localEtfTickers.includes(t))
    setLocalEtfTickers(etfTickers)
    setLocalTickers([...nonEtfTickers, ...etfTickers])
  }

  const handleEtfSave = async (etfTickers: string[]) => {
    const nonEtfTickers = localTickers.filter((t) => !localEtfTickers.includes(t))
    const merged = [...nonEtfTickers, ...etfTickers]
    await saveRadar(merged)
    setLocalTickers(merged)
    setLocalEtfTickers(etfTickers)
  }

  const myRadarData = radarData as RadarAssetData[]
  const etfRadarData = myRadarData.filter((a) => a.assetType === 'ETF')
  const exploreGridData = (exploreData as ExploreItem[]).map(toGridRow)
  const loadingRadar = loadingConfig || loadingData

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-4 pb-12">
      <PageHeader
        title="Radar de oportunidades"
        description="Score, estratégias, upside, posição técnica e sentimento dos seus ativos lado a lado."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="gap-6">
        <TabsList variant="underline" aria-label="Seções do radar">
          <TabsTrigger value="meu-radar">Meu radar</TabsTrigger>
          <TabsTrigger value="etfs">ETFs</TabsTrigger>
          <TabsTrigger value="explorar">Explorar</TabsTrigger>
        </TabsList>

        <TabsContent value="meu-radar" className="space-y-6">
          {!isPremium && (
            <FreePlanNotice>
              No plano gratuito, o radar considera só o modelo de Graham e até {FREE_TICKER_LIMIT} tickers. O Premium inclui
              as 8 estratégias e a análise técnica completa.
            </FreePlanNotice>
          )}

          <section aria-labelledby="radar-adicionar" className="space-y-3">
            <SectionHeader
              as="h2"
              id="radar-adicionar"
              title="Seus tickers"
              description="Busque pelo código para adicionar. Salve para manter o radar entre visitas."
            />
            <RadarTickerInput currentTickers={localTickers} onTickersChange={setLocalTickers} onSave={handleSave} />
          </section>

          {loadingRadar ? (
            <RadarCardLoading label="Carregando radar" />
          ) : myRadarData.length > 0 ? (
            <RadarGrid data={myRadarData} isPremium={!!isPremium} />
          ) : localTickers.length > 0 ? (
            <EmptyState title="Salve o radar para ver os dados" description="Os dados aparecem depois de salvar os tickers adicionados." />
          ) : (
            <EmptyState title="Seu radar está vazio" description="Adicione tickers acima para começar." />
          )}
        </TabsContent>

        <TabsContent value="etfs" className="space-y-6">
          <section aria-labelledby="radar-etfs" className="space-y-3">
            <SectionHeader
              as="h2"
              id="radar-etfs"
              title="ETFs no radar"
              description="Score PJ-ETF, classe, taxa e score da análise por IA lado a lado."
            />
            <RadarTickerInput
              currentTickers={localEtfTickers}
              onTickersChange={handleEtfTickersChange}
              onSave={handleEtfSave}
              assetTypeFilter="ETF"
            />
          </section>

          {loadingRadar ? (
            <RadarCardLoading label="Carregando ETFs" />
          ) : etfRadarData.length > 0 ? (
            <RadarGrid data={etfRadarData} isPremium={!!isPremium} etfMode />
          ) : localEtfTickers.length > 0 ? (
            <EmptyState title="Salve o radar para ver os ETFs" description="Os dados aparecem depois de salvar os ETFs adicionados." />
          ) : (
            <EmptyState title="Nenhum ETF no radar" description="Exemplos: BOVA11, IVVB11, SMAL11, DIVO11." />
          )}
        </TabsContent>

        <TabsContent value="explorar" className="space-y-6">
          {!isPremium && (
            <FreePlanNotice>
              No plano gratuito, a lista considera só o modelo de Graham. O Premium inclui as 8 estratégias e o sentimento de
              mercado.
            </FreePlanNotice>
          )}

          <SectionHeader
            as="h2"
            title="Maiores pontuações do radar"
            description="Ordenadas pela nota composta: solidez (30%), upside (25%), estratégias aprovadas (25%) e posição técnica (20%)."
          />

          {loadingExplore ? (
            <RadarCardLoading label="Calculando a lista (pode levar alguns minutos)" />
          ) : exploreGridData.length > 0 ? (
            <RadarGrid
              data={exploreGridData}
              showAddButton
              onAddToRadar={handleAddToRadar}
              radarTickers={localTickers}
              isPremium={!!isPremium}
            />
          ) : (
            <EmptyState title="Nenhum ativo encontrado no momento" />
          )}
        </TabsContent>
      </Tabs>

      <p className="text-xs leading-5 text-muted-foreground">
        Toque no ícone de informação de cada coluna para ver como ela é calculada. Os preços são atualizados ao abrir o radar.
        Os indicadores são estimativas de modelos quantitativos com dados públicos, não recomendação de investimento.
      </p>
    </div>
  )
}
