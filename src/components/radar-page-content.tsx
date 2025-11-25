'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { RadarTickerInput } from '@/components/radar-ticker-input'
import { RadarGrid, RadarAssetData } from '@/components/radar-grid'
import { useRadar } from '@/hooks/use-radar'
import { useRadarExplore } from '@/hooks/use-radar-explore'
import { useToast } from '@/hooks/use-toast'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { Loader2, Radar, Sparkles, AlertCircle, ArrowRight, Info, Crown } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export function RadarPageContent() {
  const [activeTab, setActiveTab] = useState<'meu-radar' | 'explorar'>('meu-radar')
  const [localTickers, setLocalTickers] = useState<string[]>([])

  const {
    radarConfig,
    radarData,
    loadingConfig,
    loadingData,
    saveRadar,
    isSaving,
  } = useRadar()

  const {
    data: exploreData,
    isLoading: loadingExplore,
  } = useRadarExplore()

  const { toast } = useToast()
  const { isPremium } = usePremiumStatus()

  const FREE_TICKER_LIMIT = 3

  // Sincronizar tickers locais com o radar salvo
  useEffect(() => {
    if (radarConfig?.tickers) {
      setLocalTickers(radarConfig.tickers)
    }
  }, [radarConfig?.tickers])

  const handleTickersChange = (tickers: string[]) => {
    setLocalTickers(tickers)
  }

  const handleSave = async (tickers: string[]) => {
    await saveRadar(tickers)
    setLocalTickers(tickers)
  }

  const handleAddToRadar = async (ticker: string) => {
    const tickerUpper = ticker.toUpperCase()
    
    // Verificar se já está no radar
    if (localTickers.includes(tickerUpper)) {
      toast({
        title: 'Ticker já adicionado',
        description: `${tickerUpper} já está no seu radar.`,
        variant: 'destructive',
      })
      return
    }

    // Verificar limite
    const tickerLimit = isPremium ? Infinity : FREE_TICKER_LIMIT
    if (localTickers.length >= tickerLimit) {
      toast({
        title: 'Limite atingido',
        description: `Você pode adicionar até ${tickerLimit} tickers. Clique no botão abaixo para fazer upgrade e adicionar tickers ilimitados.`,
        variant: 'destructive',
      })
      return
    }

    // Adicionar ao radar
    const newTickers = [...localTickers, tickerUpper]
    try {
      await handleSave(newTickers)
      toast({
        title: 'Adicionado ao Radar',
        description: `${tickerUpper} foi adicionado ao seu radar com sucesso.`,
      })
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar',
        description: error.message || 'Não foi possível adicionar ao radar.',
        variant: 'destructive',
      })
    }
  }

  // Converter dados do explore para formato do grid
  const exploreGridData: RadarAssetData[] = exploreData.map((item: any) => ({
    ticker: item.ticker,
    name: item.name,
    sector: item.sector,
    currentPrice: item.currentPrice,
    logoUrl: item.logoUrl,
    overallScore: item.overallScore,
    overallStatus: item.overallStatus || (item.overallScore >= 70 ? 'green' : item.overallScore >= 50 ? 'yellow' : 'red'),
    strategies: {
      approved: item.approvedStrategies || [],
      all: item.strategies || {},
    },
    valuation: {
      upside: item.upside,
      status: item.valuationStatus || (item.upside > 10 ? 'green' : item.upside >= 0 ? 'yellow' : 'red'),
      label: item.upside !== null ? `${item.upside.toFixed(1)}%` : 'N/A',
    },
    technical: {
      status: item.technicalStatus === 'compra' ? 'green' : 'yellow',
      label: item.technicalLabel || (item.technicalStatus === 'compra' ? 'Compra' : 'Neutro'),
      fairEntryPrice: item.technicalFairEntryPrice || null,
    },
    sentiment: {
      score: item.sentimentScore,
      status: item.sentimentStatus || 'yellow',
      label: item.sentimentLabel || 'N/A',
    },
  }))

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Radar className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Radar de Oportunidades</h1>
        </div>
        <p className="text-muted-foreground">
          Visão consolidada e visual da saúde e atratividade de ativos financeiros.
          Monitore seus ativos favoritos ou explore as melhores oportunidades do mercado.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="mb-6">
          <TabsTrigger value="meu-radar" className="flex items-center gap-2">
            <Radar className="w-4 h-4" />
            Meu Radar
          </TabsTrigger>
          <TabsTrigger value="explorar" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Explorar
          </TabsTrigger>
        </TabsList>

        {/* Tab: Meu Radar */}
        <TabsContent value="meu-radar" className="space-y-6">
          {/* Aviso sobre limitações do plano Free */}
          {!isPremium && (
            <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Plano Gratuito - Análise Limitada
                    </p>
                    <p className="text-blue-800 dark:text-blue-200">
                      O Radar Gratuito considera apenas a estratégia <strong>Graham</strong>. 
                      Faça upgrade para Premium e tenha acesso a <strong>8 estratégias completas</strong> 
                      (Bazin, Dividend Yield, Magic Formula, FCD, Gordon, Low P/E, Fundamentalista) 
                      e análises técnicas avançadas.
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link href="/checkout">
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade
                    </Link>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Adicionar Tickers ao Radar
                {!isPremium && (
                  <Badge variant="outline" className="text-xs">
                    Apenas Graham
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Digite o código do ticker para adicionar ao seu radar personalizado.
                Seu radar será salvo automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadarTickerInput
                currentTickers={localTickers}
                onTickersChange={handleTickersChange}
                onSave={handleSave}
              />
            </CardContent>
          </Card>

          {/* Grid de dados */}
          {loadingConfig || loadingData ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Carregando radar...</p>
              </CardContent>
            </Card>
          ) : radarData.length > 0 ? (
            <RadarGrid data={radarData as RadarAssetData[]} isPremium={isPremium!} />
          ) : localTickers.length > 0 ? (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Adicione tickers ao seu radar para ver os dados consolidados.
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Radar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">
                  Seu radar está vazio. Adicione tickers acima para começar.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Explorar */}
        <TabsContent value="explorar" className="space-y-6">
          {/* Aviso sobre limitações do plano Free */}
          {!isPremium && (
            <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Análise Limitada no Modo Explorar
                    </p>
                    <p className="text-blue-800 dark:text-blue-200">
                      As oportunidades são calculadas considerando apenas a estratégia <strong>Graham</strong>. 
                      Com Premium, você terá acesso a análises completas com <strong>8 estratégias</strong> 
                      e dados de sentimento de mercado.
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link href="/checkout">
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade
                    </Link>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Melhores Oportunidades
                {!isPremium && (
                  <Badge variant="outline" className="text-xs">
                    Apenas Graham
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Lista automática das melhores oportunidades do mercado, baseada em:
                solidez (30%), valuation (25%), estratégia (25%) e timing (20%).
                {!isPremium && (
                  <span className="block mt-1 text-xs text-muted-foreground">
                    ⚠️ Análise limitada: apenas estratégia Graham disponível no plano gratuito.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
          </Card>

          {loadingExplore ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Buscando oportunidades...</p>
              </CardContent>
            </Card>
          ) : exploreGridData.length > 0 ? (
            <RadarGrid 
              data={exploreGridData}
              showAddButton={true}
              onAddToRadar={handleAddToRadar}
              radarTickers={localTickers}
              isPremium={isPremium!}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  Nenhuma oportunidade encontrada no momento.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

