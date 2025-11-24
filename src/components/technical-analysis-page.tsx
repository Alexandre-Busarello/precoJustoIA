'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  TrendingUp, 
  Info, 
  BarChart3, 
  Activity,
  AlertTriangle,
  Target,
  Zap,
  Circle
} from 'lucide-react'
import PriceChart from './price-chart'
import SupportResistanceChart from './support-resistance-chart'

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

export default function TechnicalAnalysisPage({
  ticker,
  companyName,
  sector,
  currentPrice
}: TechnicalAnalysisPageProps) {
  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ['technical-analysis', ticker],
    queryFn: async () => {
      const response = await fetch(`/api/technical-analysis/${ticker}`)
      if (!response.ok) {
        throw new Error('Erro ao carregar análise técnica')
      }
      return response.json()
    }
  })

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

  // Calcular status do semáforo baseado no preço atual vs preço justo
  const getTrafficLightStatus = () => {
    if (!analysis?.aiFairEntryPrice) return null
    
    const fairPrice = analysis.aiFairEntryPrice
    const current = analysis.currentPrice
    const diffPercent = ((current - fairPrice) / fairPrice) * 100
    
    // Verde: dentro de 5% do preço justo (para baixo ou até 2% acima)
    if (diffPercent >= -5 && diffPercent <= 2) {
      return { color: 'green', label: 'Ideal para Compra', icon: Circle }
    }
    // Amarelo: entre 2% e 10% acima do preço justo, ou entre 5% e 10% abaixo
    if ((diffPercent > 2 && diffPercent <= 10) || (diffPercent < -5 && diffPercent >= -10)) {
      return { color: 'yellow', label: 'Próximo do Ideal', icon: AlertTriangle }
    }
    // Vermelho: mais de 10% acima ou mais de 10% abaixo
    return { color: 'red', label: 'Fora do Ideal', icon: AlertTriangle }
  }

  const trafficLight = getTrafficLightStatus()

  return (
    <div className="space-y-6">
      {/* Indicador de Semáforo */}
      {trafficLight && (
        <Card className={`border-2 ${
          trafficLight.color === 'green' ? 'border-green-500 bg-green-50 dark:bg-green-950' :
          trafficLight.color === 'yellow' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' :
          'border-red-500 bg-red-50 dark:bg-red-950'
        }`}>
          <CardContent className="pt-6">
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
                  <p className="text-xs text-muted-foreground">
                    Diferença: {((analysis.currentPrice - analysis.aiFairEntryPrice) / analysis.aiFairEntryPrice * 100).toFixed(1)}%
                  </p>
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

