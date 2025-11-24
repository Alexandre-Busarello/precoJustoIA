'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Circle, AlertTriangle } from 'lucide-react'

interface TechnicalAnalysisTrafficLightProps {
  ticker: string
  currentPrice: number
  compact?: boolean // Versão compacta para header
}

interface TechnicalAnalysisData {
  aiFairEntryPrice: number | null
  aiMinPrice: number | null
  aiMaxPrice: number | null
  currentPrice: number
}

interface ApiResponse {
  analysis: TechnicalAnalysisData
}

export default function TechnicalAnalysisTrafficLight({
  ticker,
  currentPrice,
  compact = false
}: TechnicalAnalysisTrafficLightProps) {
  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ['technical-analysis-traffic-light', ticker],
    queryFn: async () => {
      const response = await fetch(`/api/technical-analysis/${ticker}`)
      if (!response.ok) {
        return null
      }
      return response.json()
    },
    staleTime: 1000 * 60 * 30, // Cache por 30 minutos
    retry: false
  })

  if (isLoading || !data?.analysis?.aiFairEntryPrice) {
    return null
  }

  const analysis = data.analysis
  const fairPrice = analysis.aiFairEntryPrice!
  const diffPercent = ((currentPrice - fairPrice) / fairPrice) * 100

  // Verde: dentro de 5% do preço justo (para baixo ou até 2% acima)
  let trafficLightColor: 'green' | 'yellow' | 'red' = 'red'
  let trafficLightLabel = 'Fora do Ideal'
  
  if (diffPercent >= -5 && diffPercent <= 2) {
    trafficLightColor = 'green'
    trafficLightLabel = 'Ideal para Compra'
  } else if ((diffPercent > 2 && diffPercent <= 10) || (diffPercent < -5 && diffPercent >= -10)) {
    trafficLightColor = 'yellow'
    trafficLightLabel = 'Próximo do Ideal'
  }

  // Versão compacta para header
  if (compact) {
    return (
      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
        trafficLightColor === 'green' ? 'border-green-500 bg-green-50 dark:bg-green-950' :
        trafficLightColor === 'yellow' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' :
        'border-red-500 bg-red-50 dark:bg-red-950'
      }`}>
        <div className={`w-3 h-3 rounded-full animate-pulse ${
          trafficLightColor === 'green' ? 'bg-green-500' :
          trafficLightColor === 'yellow' ? 'bg-yellow-500' :
          'bg-red-500'
        }`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${
            trafficLightColor === 'green' ? 'text-green-700 dark:text-green-300' :
            trafficLightColor === 'yellow' ? 'text-yellow-700 dark:text-yellow-300' :
            'text-red-700 dark:text-red-300'
          }`}>
            {trafficLightLabel}
          </p>
        </div>
        {analysis.aiFairEntryPrice && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Preço Justo</p>
            <p className="text-sm font-semibold">R$ {analysis.aiFairEntryPrice.toFixed(2)}</p>
          </div>
        )}
      </div>
    )
  }

  // Versão completa (card)
  return (
    <Card className={`border-2 ${
      trafficLightColor === 'green' ? 'border-green-500 bg-green-50 dark:bg-green-950' :
      trafficLightColor === 'yellow' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' :
      'border-red-500 bg-red-50 dark:bg-red-950'
    }`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4">
            <div className={`w-4 h-4 rounded-full animate-pulse ${
              trafficLightColor === 'green' ? 'bg-green-500' :
              trafficLightColor === 'yellow' ? 'bg-yellow-500' :
              'bg-red-500'
            }`} />
            <div>
              <p className="font-semibold text-lg">
                Preço Atual: R$ {currentPrice.toFixed(2)}
              </p>
              <p className={`text-sm font-medium ${
                trafficLightColor === 'green' ? 'text-green-700 dark:text-green-300' :
                trafficLightColor === 'yellow' ? 'text-yellow-700 dark:text-yellow-300' :
                'text-red-700 dark:text-red-300'
              }`}>
                {trafficLightLabel}
              </p>
            </div>
          </div>
          {analysis.aiFairEntryPrice && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Preço Justo de Entrada</p>
              <p className="font-semibold text-lg">R$ {analysis.aiFairEntryPrice.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                Diferença: {diffPercent.toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

