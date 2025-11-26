'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { useCompanyAnalysis } from '@/hooks/use-company-data'
import { getTechnicalTrafficLightStatus } from '@/lib/radar-service'
import { TechnicalAnalysisData } from '@/lib/technical-analysis-service'

interface TechnicalAnalysisTrafficLightProps {
  ticker: string
  currentPrice: number
  compact?: boolean // Versão compacta para header
}

// TechnicalAnalysisData é importado de @/lib/technical-analysis-service

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

  // Query para obter overallScore (necessário para o TrafficLight)
  const { data: companyAnalysisData } = useCompanyAnalysis(ticker)
  const overallScore = companyAnalysisData?.overallScore?.score ?? null

  if (isLoading || !data?.analysis?.aiFairEntryPrice) {
    return null
  }

  const analysis = data.analysis as TechnicalAnalysisData
  
  // Usar função centralizada para calcular status do semáforo
  const trafficLightStatus = getTechnicalTrafficLightStatus(
    analysis,
    currentPrice,
    overallScore // Passar overallScore obtido do hook useCompanyAnalysis
  )

  const trafficLightColor = trafficLightStatus.status
  const trafficLightLabel = trafficLightStatus.label
  const trafficLightDescription = trafficLightStatus.description
  const minPrice = analysis.aiMinPrice
  const maxPrice = analysis.aiMaxPrice

  // Versão compacta para header
  if (compact) {
    return (
      <div className={`flex flex-col gap-2 px-3 py-2 rounded-lg border ${
        trafficLightColor === 'green' ? 'border-green-500 bg-green-50 dark:bg-green-950' :
        trafficLightColor === 'yellow' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' :
        'border-red-500 bg-red-50 dark:bg-red-950'
      }`}>
        <div className="flex items-center gap-3">
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
        <p className={`text-xs ${
          trafficLightColor === 'green' ? 'text-green-600 dark:text-green-400' :
          trafficLightColor === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
          'text-red-600 dark:text-red-400'
        }`}>
          {trafficLightDescription}
        </p>
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
        <div className="space-y-4">
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
              </div>
            )}
          </div>
          <div className={`text-sm pt-2 border-t ${
            trafficLightColor === 'green' ? 'border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' :
            trafficLightColor === 'yellow' ? 'border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300' :
            'border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}>
            {trafficLightDescription}
          </div>
          {minPrice && maxPrice && (
            <div className="text-xs text-muted-foreground pt-2">
              Faixa prevista: R$ {minPrice.toFixed(2)} - R$ {maxPrice.toFixed(2)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

