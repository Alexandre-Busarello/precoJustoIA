'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Info, 
  AlertTriangle,
  Zap,
  Circle,
  RefreshCw,
  History,
  Loader2
} from 'lucide-react'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { useAdminStatus } from '@/hooks/use-admin-status'
import { useToast } from '@/hooks/use-toast'
import { useCompanyAnalysis } from '@/hooks/use-company-data'
import SupportResistanceChart from './support-resistance-chart'
import { getTechnicalTrafficLightStatus } from '@/lib/radar-service'

interface TechnicalAnalysisPageProps {
  ticker: string
  companyName: string
  sector: string | null
  currentPrice: number
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
  supportLevels: Array<{ price: number; strength: number; type: string; touches: number }>
  resistanceLevels: Array<{ price: number; strength: number; type: string; touches: number }>
  psychologicalLevels: Array<{ price: number; strength: number; type: string; touches: number }>
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

export default function TechnicalAnalysisPage({
  ticker,
  companyName,
  sector,
  currentPrice
}: TechnicalAnalysisPageProps) {
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { isPremium } = usePremiumStatus()
  const { isAdmin } = useAdminStatus()
  const canUpdate = isPremium || isAdmin

  // Query para obter overallScore (necessário para o TrafficLight)
  const { data: companyAnalysisData } = useCompanyAnalysis(ticker)
  const overallScore = companyAnalysisData?.overallScore?.score ?? null

  // Query para análise atual ou selecionada
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

  // Query para histórico com paginação
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

  // Resetar página quando modal abrir
  const handleHistoryOpenChange = (open: boolean) => {
    setHistoryOpen(open)
    if (open) {
      setHistoryPage(1)
    }
  }

  // Query para uso (apenas usuários gratuitos)
  const { data: usageData } = useQuery<UsageResponse>({
    queryKey: ['technical-analysis-usage', ticker],
    queryFn: async () => {
      const response = await fetch(`/api/technical-analysis/${ticker}/usage`)
      if (!response.ok) {
        throw new Error('Erro ao verificar uso')
      }
      return response.json()
    },
    enabled: !isPremium
  })

  // Mutation para atualizar análise
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['technical-analysis', ticker] })
      queryClient.invalidateQueries({ queryKey: ['technical-analysis-history', ticker] })
      setSelectedAnalysisId(null) // Voltar para análise atual
      toast({
        title: data.recalculated ? 'Análise atualizada com sucesso!' : 'Análise já existe para hoje',
        description: data.message || 'A análise técnica foi atualizada.'
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar análise',
        description: error.message,
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
      <div className="space-y-4">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar análise técnica. Tente novamente mais tarde.
        </AlertDescription>
      </Alert>
    )
  }

  if (!data?.analysis) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Dados históricos insuficientes para análise técnica.
        </AlertDescription>
      </Alert>
    )
  }

  const analysis = data.analysis

  // Usar função centralizada para calcular status do semáforo
  // A função aceita TechnicalAnalysisData com campos opcionais para calculatedAt/expiresAt
  const trafficLightResult = getTechnicalTrafficLightStatus(
    analysis as any, // Converter para compatibilidade com tipos
    analysis.currentPrice,
    overallScore // Passar overallScore obtido do hook useCompanyAnalysis
  )

  const trafficLight = trafficLightResult ? {
    color: trafficLightResult.status,
    label: trafficLightResult.label,
    icon: trafficLightResult.status === 'green' ? Circle : AlertTriangle,
    description: trafficLightResult.description
  } : null

  return (
    <div className="space-y-6">
      {/* Header com controles */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex-1">
          {selectedAnalysisId && (
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Visualizando análise histórica. 
                <Button 
                  variant="link" 
                  className="p-0 h-auto ml-2"
                  onClick={handleLoadCurrent}
                >
                  Carregar análise atual
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {!isPremium && usageData && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Você já visualizou {usageData.currentUsage} de {usageData.limit} análises técnicas este mês.
                {usageData.remaining > 0 ? ` Restam ${usageData.remaining} análises.` : ' Faça upgrade para acesso ilimitado.'}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Botão de Histórico */}
          <Dialog open={historyOpen} onOpenChange={handleHistoryOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <History className="w-4 h-4 mr-2" />
                Histórico
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Histórico de Análises Técnicas</DialogTitle>
                <DialogDescription>
                  Selecione uma análise anterior para visualizar
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8 flex-1">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : historyData && historyData.history && historyData.history.length > 0 ? (
                  <>
                    <div className="space-y-2 flex-1 overflow-y-auto min-h-0 pr-2">
                      {historyData.history.map((item) => (
                        <Card 
                          key={item.id} 
                          className="cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleHistorySelect(item.id)}
                        >
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm sm:text-base truncate">
                                  {new Date(item.calculatedAt).toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                  Válida até: {new Date(item.expiresAt).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                              {selectedAnalysisId === item.id && (
                                <Badge variant="default" className="self-start sm:self-center">Atual</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {/* Controles de Paginação */}
                    {historyData?.pagination && historyData.pagination.totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 mt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                          Mostrando {((historyData.pagination.page - 1) * historyData.pagination.pageSize) + 1} - {Math.min(historyData.pagination.page * historyData.pagination.pageSize, historyData.pagination.total)} de {historyData.pagination.total}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                            disabled={historyData.pagination.page === 1 || historyLoading}
                          >
                            Anterior
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, historyData.pagination.totalPages) }, (_, i) => {
                              let pageNum: number
                              if (historyData.pagination.totalPages <= 5) {
                                pageNum = i + 1
                              } else if (historyData.pagination.page <= 3) {
                                pageNum = i + 1
                              } else if (historyData.pagination.page >= historyData.pagination.totalPages - 2) {
                                pageNum = historyData.pagination.totalPages - 4 + i
                              } else {
                                pageNum = historyData.pagination.page - 2 + i
                              }
                              
                              return (
                                <Button
                                  key={pageNum}
                                  variant={historyData.pagination.page === pageNum ? "default" : "outline"}
                                  size="sm"
                                  className="w-8 h-8 p-0"
                                  onClick={() => setHistoryPage(pageNum)}
                                  disabled={historyLoading}
                                >
                                  {pageNum}
                                </Button>
                              )
                            })}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setHistoryPage(p => Math.min(historyData.pagination.totalPages, p + 1))}
                            disabled={historyData.pagination.page === historyData.pagination.totalPages || historyLoading}
                          >
                            Próxima
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground flex-1 flex items-center justify-center">
                    Nenhuma análise histórica encontrada
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Botão de Atualizar (apenas Premium/Admin) */}
          {canUpdate && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar Análise
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      {/* Indicador de Semáforo */}
      {trafficLight && (
        <Card className={`border-2 ${
          trafficLight.color === 'green' ? 'border-green-500 bg-green-50 dark:bg-green-950' :
          trafficLight.color === 'yellow' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' :
          'border-red-500 bg-red-50 dark:bg-red-950'
        }`}>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-4">
                  <div className={`w-4 h-4 rounded-full animate-pulse ${
                    trafficLight.color === 'green' ? 'bg-green-500' :
                    trafficLight.color === 'yellow' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-semibold text-lg">
                      Preço Atual: R$ {analysis.currentPrice.toFixed(2)}
                    </p>
                    <p className={`text-sm font-medium ${
                      trafficLight.color === 'green' ? 'text-green-700 dark:text-green-300' :
                      trafficLight.color === 'yellow' ? 'text-yellow-700 dark:text-yellow-300' :
                      'text-red-700 dark:text-red-300'
                    }`}>
                      {trafficLight.label}
                    </p>
                  </div>
                </div>
                {analysis.aiFairEntryPrice && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Preço Justo de Entrada</p>
                    <p className="font-semibold text-lg">R$ {analysis.aiFairEntryPrice.toFixed(2)}</p>
                  </div>
                )}
              </div>
              <div className={`text-sm pt-2 border-t ${
                trafficLight.color === 'green' ? 'border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' :
                trafficLight.color === 'yellow' ? 'border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300' :
                'border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              }`}>
                {trafficLight.description}
              </div>
              {analysis.aiMinPrice && analysis.aiMaxPrice && (
                <div className="text-xs text-muted-foreground pt-2">
                  Faixa prevista: R$ {analysis.aiMinPrice.toFixed(2)} - R$ {analysis.aiMaxPrice.toFixed(2)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Disclaimer */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900 dark:text-blue-100">
          <strong>Importante:</strong> A análise técnica é um auxílio complementar para identificar 
          as melhores regiões de preço para entrada em um ativo para <strong>longo prazo</strong>. 
          <strong> Não é recomendada para day trade.</strong> Sempre combine com análise fundamentalista.
        </AlertDescription>
      </Alert>

      {/* Análise da IA */}
      {analysis.aiFairEntryPrice && (
        <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-purple-600" />
              <span>Previsão de Preços com IA (30 dias)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                <p className="text-sm text-muted-foreground">Preço Mínimo Previsto</p>
                <p className="text-2xl font-bold text-red-600">
                  R$ {analysis.aiMinPrice?.toFixed(2) || 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                <p className="text-sm text-muted-foreground">Preço Máximo Previsto</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {analysis.aiMaxPrice?.toFixed(2) || 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-lg border-2 border-purple-300 dark:border-purple-700">
                <p className="text-sm text-muted-foreground">Preço Justo de Entrada</p>
                <p className="text-2xl font-bold text-purple-600">
                  R$ {analysis.aiFairEntryPrice?.toFixed(2) || 'N/A'}
                </p>
                {analysis.aiConfidence && (
                  <Badge variant="outline" className="mt-2">
                    Confiança: {analysis.aiConfidence}%
                  </Badge>
                )}
              </div>
            </div>
            {analysis.aiAnalysis && (
              <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                <p className="text-sm font-semibold mb-2">Análise da IA:</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {analysis.aiAnalysis}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs com Indicadores */}
      <Tabs defaultValue="indicators" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="indicators">Indicadores</TabsTrigger>
          <TabsTrigger value="support-resistance">Suporte/Resistência</TabsTrigger>
          <TabsTrigger value="fibonacci">Fibonacci</TabsTrigger>
          <TabsTrigger value="ichimoku">Ichimoku</TabsTrigger>
        </TabsList>

        <TabsContent value="indicators" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Indicadores Técnicos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analysis.rsi !== null && (
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">RSI</p>
                    <p className="text-2xl font-bold">{analysis.rsi.toFixed(2)}</p>
                    <Badge variant={analysis.rsi >= 70 ? 'destructive' : analysis.rsi <= 30 ? 'default' : 'secondary'}>
                      {analysis.rsi >= 70 ? 'Sobrecompra' : analysis.rsi <= 30 ? 'Sobrevenda' : 'Neutro'}
                    </Badge>
                  </div>
                )}
                {analysis.macd !== null && (
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">MACD</p>
                    <p className="text-2xl font-bold">{analysis.macd.toFixed(4)}</p>
                    {analysis.macdHistogram !== null && (
                      <Badge variant={analysis.macdHistogram > 0 ? 'default' : 'secondary'}>
                        {analysis.macdHistogram > 0 ? 'Alta' : 'Baixa'}
                      </Badge>
                    )}
                  </div>
                )}
                {analysis.bbUpper !== null && (
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Bollinger Bands</p>
                    <div className="space-y-1 text-sm">
                      <p>Superior: R$ {analysis.bbUpper.toFixed(2)}</p>
                      <p>Média: R$ {analysis.bbMiddle?.toFixed(2)}</p>
                      <p>Inferior: R$ {analysis.bbLower?.toFixed(2)}</p>
                    </div>
                  </div>
                )}
                {analysis.sma20 !== null && (
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Médias Móveis</p>
                    <div className="space-y-1 text-sm">
                      <p>SMA 20: R$ {analysis.sma20.toFixed(2)}</p>
                      <p>SMA 50: R$ {analysis.sma50?.toFixed(2)}</p>
                      <p>SMA 200: R$ {analysis.sma200?.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support-resistance" className="space-y-4">
          {/* Gráfico de Suporte e Resistência */}
          {data.historicalData && data.historicalData.length > 0 ? (
            <SupportResistanceChart
              historicalData={data.historicalData}
              supportLevels={analysis.supportLevels as Array<{ price: number; strength: number; type: 'support' | 'resistance' | 'psychological'; touches: number }>}
              resistanceLevels={analysis.resistanceLevels as Array<{ price: number; strength: number; type: 'support' | 'resistance' | 'psychological'; touches: number }>}
              fibonacciLevels={analysis.fib236 ? {
                fib236: analysis.fib236,
                fib382: analysis.fib382,
                fib500: analysis.fib500,
                fib618: analysis.fib618,
                fib786: analysis.fib786
              } : null}
              ichimokuLevels={analysis.tenkanSen ? {
                tenkanSen: analysis.tenkanSen,
                kijunSen: analysis.kijunSen,
                senkouSpanA: analysis.senkouSpanA,
                senkouSpanB: analysis.senkouSpanB,
                chikouSpan: analysis.chikouSpan
              } : null}
              currentPrice={analysis.currentPrice}
              ticker={ticker}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">
                  Dados históricos não disponíveis para exibir gráfico
                </p>
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardHeader>
              <CardTitle>Detalhes dos Níveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3 text-green-600">Níveis de Suporte</h3>
                  <div className="space-y-2">
                    {analysis.supportLevels.length > 0 ? (
                      analysis.supportLevels.map((level, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 rounded">
                          <span className="font-medium">R$ {level.price.toFixed(2)}</span>
                          <Badge variant="outline">Força: {level.strength}/5</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">Nenhum nível de suporte detectado</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3 text-red-600">Níveis de Resistência</h3>
                  <div className="space-y-2">
                    {analysis.resistanceLevels.length > 0 ? (
                      analysis.resistanceLevels.map((level, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950 rounded">
                          <span className="font-medium">R$ {level.price.toFixed(2)}</span>
                          <Badge variant="outline">Força: {level.strength}/5</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">Nenhum nível de resistência detectado</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fibonacci" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Níveis de Fibonacci</CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.fib236 ? (
                <div className="space-y-2">
                  <div className="flex justify-between p-2 border rounded">
                    <span>23.6%</span>
                    <span className="font-medium">R$ {analysis.fib236.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span>38.2%</span>
                    <span className="font-medium">R$ {analysis.fib382?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span>50%</span>
                    <span className="font-medium">R$ {analysis.fib500?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span>61.8%</span>
                    <span className="font-medium">R$ {analysis.fib618?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span>78.6%</span>
                    <span className="font-medium">R$ {analysis.fib786?.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Dados de Fibonacci não disponíveis</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ichimoku" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ichimoku Cloud</CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.tenkanSen !== null ? (
                <div className="space-y-2">
                  <div className="flex justify-between p-2 border rounded">
                    <span>Tenkan-sen</span>
                    <span className="font-medium">R$ {analysis.tenkanSen.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span>Kijun-sen</span>
                    <span className="font-medium">R$ {analysis.kijunSen?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span>Senkou Span A</span>
                    <span className="font-medium">R$ {analysis.senkouSpanA?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span>Senkou Span B</span>
                    <span className="font-medium">R$ {analysis.senkouSpanB?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span>Chikou Span</span>
                    <span className="font-medium">R$ {analysis.chikouSpan?.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Dados de Ichimoku não disponíveis</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Metadata */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">
            Análise calculada em: {new Date(analysis.calculatedAt).toLocaleString('pt-BR')}
            {data.cached && ' (em cache)'}
          </p>
          <p className="text-xs text-muted-foreground">
            Válida até: {new Date(analysis.expiresAt).toLocaleString('pt-BR')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

