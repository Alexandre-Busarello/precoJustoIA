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
import { Loader2, Radar, Sparkles, AlertCircle, Info, Crown, HelpCircle, TrendingUp } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="p-2.5 sm:p-3 bg-primary/10 dark:bg-primary/20 rounded-xl shrink-0">
              <Radar className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
                Radar de Oportunidades
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Visão consolidada e visual da saúde e atratividade de ativos financeiros.
                Monitore seus ativos favoritos ou explore as melhores oportunidades do mercado.
              </p>
            </div>
          </div>
        </div>
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

      {/* Legenda */}
      <Card className="mt-8 border-muted">
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardTitle className="flex items-center gap-3 text-lg font-semibold pb-6" style={{ width: '100vw' }}>
                <HelpCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                Legenda - Entenda as Colunas do Radar
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Score Geral */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <h4 className="font-semibold">Score Geral</h4>
                  </div>
                  <p className="text-sm text-muted-foreground ml-5">
                    Nota consolidada de solidez da empresa (0-100). 
                    <span className="block mt-1">
                      <span className="text-green-600 font-medium">Verde (≥70)</span>: Excelente | 
                      <span className="text-yellow-600 font-medium"> Amarelo (50-69)</span>: Atenção | 
                      <span className="text-red-600 font-medium"> Vermelho (&lt;50)</span>: Cuidado
                    </span>
                  </p>
                </div>

                {/* Estratégias */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-500 text-white">G</Badge>
                    <h4 className="font-semibold">Estratégias Aprovadas</h4>
                  </div>
                  <p className="text-sm text-muted-foreground ml-5">
                    Estratégias de investimento onde o ativo se qualifica: Graham, Bazin, Dividend Yield, 
                    Low P/E, Magic Formula, FCD, Gordon, Fundamentalista. 
                    <span className="block mt-1 text-xs">
                      <span className="text-green-600">Verde</span> = Aprovado | 
                      <span className="text-red-600"> Vermelho</span> = Reprovado
                    </span>
                  </p>
                </div>

                {/* Valuation */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <h4 className="font-semibold">Valuation (Upside)</h4>
                  </div>
                  <p className="text-sm text-muted-foreground ml-5">
                    Potencial de valorização baseado no melhor modelo de preço justo (Graham, FCD ou Gordon). 
                    <span className="block mt-1">
                      <span className="text-green-600 font-medium">Verde (&gt;10%)</span>: Alto potencial | 
                      <span className="text-yellow-600 font-medium"> Amarelo (0-10%)</span>: Moderado | 
                      <span className="text-red-600 font-medium"> Vermelho (&lt;0%)</span>: Caro
                    </span>
                  </p>
                </div>

                {/* Análise Técnica */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <h4 className="font-semibold">Análise Técnica</h4>
                  </div>
                  <p className="text-sm text-muted-foreground ml-5">
                    Ponto de entrada baseado em análise técnica com IA. Mostra preço atual vs. preço justo técnico.
                    <span className="block mt-1">
                      <span className="text-green-600 font-medium">Verde</span>: Zona de compra (preço atual ≤ preço justo) | 
                      <span className="text-yellow-600 font-medium"> Amarelo</span>: Neutro
                    </span>
                    <span className="block mt-1 text-xs">
                      Clique no ícone <TrendingUp className="w-3 h-3 inline" /> para ver análise completa
                    </span>
                  </p>
                </div>

                {/* Sentimento */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <h4 className="font-semibold">Sentimento de Mercado</h4>
                  </div>
                  <p className="text-sm text-muted-foreground ml-5">
                    Análise de sentimento baseada em notícias e discussões do YouTube sobre o ativo (0-100).
                    <span className="block mt-1">
                      <span className="text-green-600 font-medium">Verde (≥70)</span>: Positivo | 
                      <span className="text-yellow-600 font-medium"> Amarelo (50-69)</span>: Neutro | 
                      <span className="text-red-600 font-medium"> Vermelho (&lt;50)</span>: Negativo
                    </span>
                  </p>
                </div>

                {/* Informações Gerais */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <h4 className="font-semibold">Informações Gerais</h4>
                  </div>
                  <ul className="text-sm text-muted-foreground ml-5 space-y-1 list-disc list-inside">
                    <li>Clique no ticker para ver página completa do ativo</li>
                    <li>Preços são atualizados automaticamente do Yahoo Finance ao abrir o Radar</li>
                    <li>Modo Explorar considera apenas estratégia Graham para usuários Free</li>
                    <li>Premium tem acesso a todas as 8 estratégias de análise</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  )
}

