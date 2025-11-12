'use client'

import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  ReferenceLine
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'

interface PriceChartData {
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
  signal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO'
}

interface StochasticData {
  date: Date
  k: number
  d: number
  signal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO'
}

interface TechnicalAnalysis {
  rsi: RSIData[]
  stochastic: StochasticData[]
  currentRSI: RSIData | null
  currentStochastic: StochasticData | null
  overallSignal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO'
}

interface PriceChartProps {
  data: PriceChartData[]
  technicalAnalysis: TechnicalAnalysis | null
  ticker: string
}

type ChartType = 'line' | 'candlestick'

export default function PriceChart({ data, technicalAnalysis, ticker }: PriceChartProps) {
  const [chartType, setChartType] = useState<ChartType>('line')

  // Preparar dados para o gráfico - agrupar por mês e pegar último registro com volume
  const chartData = useMemo(() => {
    // Criar um mapa para agrupar por mês/ano
    const monthlyData = new Map<string, PriceChartData>()
    
    // Processar dados em ordem cronológica
    const sortedData = [...data].sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateA - dateB
    })
    
    // Agrupar por mês/ano e manter apenas o último registro com volume válido
    sortedData.forEach(item => {
      const date = new Date(item.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      // Só considerar registros com volume > 0
      if (item.volume > 0) {
        const existing = monthlyData.get(monthKey)
        
        // Se não existe registro para este mês, ou se este é mais recente, atualizar
        if (!existing || new Date(item.date).getTime() > new Date(existing.date).getTime()) {
          monthlyData.set(monthKey, item)
        }
      }
    })
    
    // Converter mapa para array e formatar datas
    return Array.from(monthlyData.values())
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return dateA - dateB
      })
      .map(item => ({
        ...item,
        date: new Date(item.date).toLocaleDateString('pt-BR', { 
          month: 'short', 
          year: '2-digit' 
        }),
        fullDate: item.date
      }))
  }, [data])

  // Preparar dados dos indicadores técnicos para o gráfico
  const rsiData = useMemo(() => {
    if (!technicalAnalysis?.rsi) return []
    
    return technicalAnalysis.rsi.map(item => ({
      date: new Date(item.date).toLocaleDateString('pt-BR', { 
        month: 'short', 
        year: '2-digit' 
      }),
      rsi: item.rsi,
      signal: item.signal
    }))
  }, [technicalAnalysis])

  const stochasticData = useMemo(() => {
    if (!technicalAnalysis?.stochastic) return []
    
    return technicalAnalysis.stochastic.map(item => ({
      date: new Date(item.date).toLocaleDateString('pt-BR', { 
        month: 'short', 
        year: '2-digit' 
      }),
      k: item.k,
      d: item.d,
      signal: item.signal
    }))
  }, [technicalAnalysis])

  // Formatadores
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatVolume = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toString()
  }

  // Componente Candlestick customizado
  const CandlestickBar = (props: any) => {
    const { payload, x, y, width, height } = props
    if (!payload) return null

    const { open, high, low, close } = payload
    const isPositive = close >= open
    const color = isPositive ? '#10b981' : '#ef4444'
    
    // Calcular posições relativas
    const priceRange = high - low
    const bodyTop = ((high - Math.max(open, close)) / priceRange) * height + y
    const bodyBottom = ((high - Math.min(open, close)) / priceRange) * height + y
    const wickTop = y
    const wickBottom = y + height
    
    return (
      <g>
        {/* Pavio superior */}
        <line
          x1={x + width / 2}
          y1={wickTop}
          x2={x + width / 2}
          y2={bodyTop}
          stroke={color}
          strokeWidth={1}
        />
        {/* Corpo da vela */}
        <rect
          x={x + width * 0.2}
          y={bodyTop}
          width={width * 0.6}
          height={bodyBottom - bodyTop}
          fill={isPositive ? color : color}
          stroke={color}
          strokeWidth={1}
        />
        {/* Pavio inferior */}
        <line
          x1={x + width / 2}
          y1={bodyBottom}
          x2={x + width / 2}
          y2={wickBottom}
          stroke={color}
          strokeWidth={1}
        />
      </g>
    )
  }

  const getSignalBadge = (signal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO') => {
    switch (signal) {
      case 'SOBRECOMPRA':
        return <Badge variant="destructive" className="text-xs">Sobrecompra</Badge>
      case 'SOBREVENDA':
        return <Badge variant="default" className="text-xs bg-green-600">Sobrevenda</Badge>
      case 'NEUTRO':
        return <Badge variant="secondary" className="text-xs">Neutro</Badge>
    }
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Gráfico de Preços - {ticker}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Dados históricos não disponíveis
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Gráfico Principal de Preços */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>Gráfico de Preços - {ticker}</span>
            </CardTitle>
            <div className="flex space-x-2">
              <Button
                variant={chartType === 'line' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('line')}
              >
                Linha
              </Button>
              <Button
                variant={chartType === 'candlestick' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('candlestick')}
              >
                Candlestick
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    yAxisId="price"
                    domain={['dataMin * 0.95', 'dataMax * 1.05']}
                    tick={{ fontSize: 12 }}
                    tickFormatter={formatPrice}
                  />
                  <YAxis 
                    yAxisId="volume"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    tickFormatter={formatVolume}
                  />
                  <Tooltip
                    formatter={(value: any, name: string) => {
                      if (name === 'volume') {
                        return [formatVolume(value), 'Volume']
                      }
                      return [formatPrice(value), name === 'close' ? 'Preço de Fechamento' : name]
                    }}
                    labelFormatter={(label: string) => `Data: ${label}`}
                  />
                  <Line
                    yAxisId="price"
                    type="monotone"
                    dataKey="close"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    name="close"
                  />
                  <Bar
                    yAxisId="volume"
                    dataKey="volume"
                    fill="#94a3b8"
                    opacity={0.3}
                    name="volume"
                  />
                </ComposedChart>
              ) : (
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    domain={['dataMin * 0.95', 'dataMax * 1.05']}
                    tick={{ fontSize: 12 }}
                    tickFormatter={formatPrice}
                  />
                  <Tooltip
                    formatter={(value: any, name: string) => [formatPrice(value), name]}
                    labelFormatter={(label: string) => `Data: ${label}`}
                  />
                  <Bar
                    dataKey="high"
                    shape={<CandlestickBar />}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Indicadores Técnicos */}
      {technicalAnalysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* RSI */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>RSI (Índice de Força Relativa)</span>
                </CardTitle>
                {technicalAnalysis.currentRSI && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">
                      {technicalAnalysis.currentRSI.rsi.toFixed(1)}
                    </span>
                    {getSignalBadge(technicalAnalysis.currentRSI.signal)}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rsiData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value: any) => [value.toFixed(1), 'RSI']}
                      labelFormatter={(label: string) => `Data: ${label}`}
                    />
                    <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="2 2" />
                    <ReferenceLine y={30} stroke="#10b981" strokeDasharray="2 2" />
                    <Line
                      type="monotone"
                      dataKey="rsi"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-0.5 bg-red-500"></div>
                    <span>Sobrecompra (≥70)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-0.5 bg-green-500"></div>
                    <span>Sobrevenda (≤30)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Oscilador Estocástico */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <TrendingDown className="w-5 h-5" />
                  <span>Oscilador Estocástico</span>
                </CardTitle>
                {technicalAnalysis.currentStochastic && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">
                      K: {technicalAnalysis.currentStochastic.k.toFixed(1)} | 
                      D: {technicalAnalysis.currentStochastic.d.toFixed(1)}
                    </span>
                    {getSignalBadge(technicalAnalysis.currentStochastic.signal)}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stochasticData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => [
                        value.toFixed(1), 
                        name === 'k' ? '%K' : '%D'
                      ]}
                      labelFormatter={(label: string) => `Data: ${label}`}
                    />
                    <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="2 2" />
                    <ReferenceLine y={20} stroke="#10b981" strokeDasharray="2 2" />
                    <Line
                      type="monotone"
                      dataKey="k"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      name="k"
                    />
                    <Line
                      type="monotone"
                      dataKey="d"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      name="d"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-0.5 bg-amber-500"></div>
                    <span>%K</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-0.5 bg-blue-500"></div>
                    <span>%D</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-0.5 bg-red-500"></div>
                    <span>Sobrecompra (≥80)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-0.5 bg-green-500"></div>
                    <span>Sobrevenda (≤20)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resumo da Análise Técnica */}
      {technicalAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo da Análise Técnica</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Sinal Geral</div>
                <div className="flex justify-center">
                  {getSignalBadge(technicalAnalysis.overallSignal)}
                </div>
              </div>
              
              {technicalAnalysis.currentRSI && (
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">RSI Atual</div>
                  <div className="font-semibold">{technicalAnalysis.currentRSI.rsi.toFixed(1)}</div>
                  <div className="flex justify-center mt-1">
                    {getSignalBadge(technicalAnalysis.currentRSI.signal)}
                  </div>
                </div>
              )}
              
              {technicalAnalysis.currentStochastic && (
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">Estocástico Atual</div>
                  <div className="font-semibold">
                    K: {technicalAnalysis.currentStochastic.k.toFixed(1)} | 
                    D: {technicalAnalysis.currentStochastic.d.toFixed(1)}
                  </div>
                  <div className="flex justify-center mt-1">
                    {getSignalBadge(technicalAnalysis.currentStochastic.signal)}
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Interpretação:</strong> Os indicadores técnicos ajudam a identificar possíveis pontos de entrada e saída. 
                RSI acima de 70 indica sobrecompra (possível correção), abaixo de 30 indica sobrevenda (possível recuperação). 
                O oscilador estocástico funciona de forma similar, mas com limites em 80 e 20.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
