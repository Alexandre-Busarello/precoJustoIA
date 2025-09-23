'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, TrendingUp, AlertTriangle, Info, Crown, Lock } from 'lucide-react'
import PriceChart from './price-chart'
import Link from 'next/link'

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

interface ApiResponse {
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

export default function TechnicalAnalysisSection({ ticker, userIsPremium }: TechnicalAnalysisSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTechnicalData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/historical-prices/${ticker}`)
      
      if (!response.ok) {
        throw new Error('Erro ao buscar dados históricos')
      }

      const result: ApiResponse = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [ticker])

  // Buscar dados quando a seção for aberta (apenas para usuários Premium)
  useEffect(() => {
    if (isOpen && !data && !loading && userIsPremium) {
      fetchTechnicalData()
    }
  }, [isOpen, data, loading, userIsPremium, fetchTechnicalData])

  const getSignalColor = (signal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO') => {
    switch (signal) {
      case 'SOBRECOMPRA':
        return 'text-red-600 dark:text-red-400'
      case 'SOBREVENDA':
        return 'text-green-600 dark:text-green-400'
      case 'NEUTRO':
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getSignalIcon = (signal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO') => {
    switch (signal) {
      case 'SOBRECOMPRA':
        return <AlertTriangle className="w-4 h-4 text-red-600" />
      case 'SOBREVENDA':
        return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'NEUTRO':
        return <Info className="w-4 h-4 text-gray-600" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  return (
    <Card className="mt-8">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>Análise Técnica</span>
                <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                  <Crown className="w-3 h-3 mr-1" />
                  Premium
                </Badge>
              </CardTitle>
              <div className="flex items-center space-x-2">
                {data?.technicalAnalysis?.overallSignal && (
                  <div className="flex items-center space-x-1">
                    {getSignalIcon(data.technicalAnalysis.overallSignal)}
                    <span className={`text-sm font-medium ${getSignalColor(data.technicalAnalysis.overallSignal)}`}>
                      {data.technicalAnalysis.overallSignal === 'SOBRECOMPRA' ? 'Sobrecompra' :
                       data.technicalAnalysis.overallSignal === 'SOBREVENDA' ? 'Sobrevenda' : 'Neutro'}
                    </span>
                  </div>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* CTA Premium para usuários não Premium */}
            {!userIsPremium ? (
              <div className="text-center py-8 sm:py-12 px-4 sm:px-6">
                <div className="max-w-sm sm:max-w-md mx-auto">
                  <Lock className="w-12 h-12 sm:w-16 sm:h-16 text-amber-500 mx-auto mb-4 sm:mb-6" />
                  <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Análise Técnica Premium</h3>
                  
                  {/* Prévia dos recursos */}
                  <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-muted/50 rounded-lg text-left">
                    <h4 className="font-semibold mb-2 sm:mb-3 text-center text-sm sm:text-base">O que você terá acesso:</h4>
                    <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                      <li className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                        <span>Gráficos de preços (linha e candlestick)</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                        <span>RSI (Índice de Força Relativa)</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                        <span>Oscilador Estocástico</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                        <span>Sinais de entrada e saída</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                        <span>Identificação de sobrecompra/sobrevenda</span>
                      </li>
                    </ul>
                  </div>

                  <p className="text-muted-foreground mb-4 sm:mb-6 text-xs sm:text-sm leading-relaxed">
                    Combine análise fundamentalista com indicadores técnicos para encontrar os melhores pontos de entrada e saída
                  </p>
                  
                  <Button asChild size="default" className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto sm:text-base">
                    <Link href="/checkout">
                      <Crown className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      Upgrade para Premium
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Estado de Loading */}
                {loading && (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="h-3 sm:h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-48 sm:h-64 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                      <div className="h-40 sm:h-48 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      <div className="h-40 sm:h-48 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                  </div>
                )}

                {/* Estado de Erro */}
                {error && (
                  <div className="text-center py-8 sm:py-12 px-4 sm:px-6">
                    <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-4 sm:mb-6" />
                    <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Erro ao carregar dados</h3>
                    <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-sm sm:max-w-md mx-auto leading-relaxed">{error}</p>
                    <Button onClick={fetchTechnicalData} variant="outline" size="default" className="sm:text-base">
                      Tentar novamente
                    </Button>
                  </div>
                )}

                {/* Dados carregados com sucesso */}
                {data && !loading && !error && (
                  <div className="space-y-4 sm:space-y-6 lg:space-y-8 mt-4 sm:mt-6">
                    {/* Disclaimer educativo - Movido para o início */}
                    <div className="p-4 sm:p-6 lg:p-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg sm:rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
                      <div className="flex items-start space-x-3 sm:space-x-4">
                        <Info className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-blue-600 mt-0.5 sm:mt-1 flex-shrink-0" />
                        <div className="text-blue-700 dark:text-blue-300 flex-1 min-w-0">
                          <h4 className="font-semibold mb-3 sm:mb-4 lg:mb-5 text-sm sm:text-base lg:text-lg">📊 Como usar a Análise Técnica no Preço Justo</h4>
                          
                          <div className="mb-4 sm:mb-5 lg:mb-6">
                            <p className="font-medium mb-2 sm:mb-3 text-xs sm:text-sm lg:text-base">🎯 <strong>Nosso Foco:</strong> Análise Fundamentalista</p>
                            <p className="mb-3 sm:mb-4 text-xs sm:text-sm leading-relaxed">A análise técnica é um <strong>apoio complementar</strong> à nossa análise fundamentalista, que é o coração do Preço Justo. Use os indicadores técnicos para:</p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-5 lg:mb-6">
                            <div className="bg-white/60 dark:bg-gray-800/60 p-3 sm:p-4 rounded-md sm:rounded-lg border border-white/40 dark:border-gray-700/40">
                              <p className="font-semibold text-green-700 dark:text-green-300 mb-1 sm:mb-2 text-xs sm:text-sm">📈 Pontos de Entrada</p>
                              <p className="text-xs leading-relaxed">Identifique momentos de sobrevenda para aportar em bons ativos já validados pela análise fundamentalista</p>
                            </div>
                            <div className="bg-white/60 dark:bg-gray-800/60 p-3 sm:p-4 rounded-md sm:rounded-lg border border-white/40 dark:border-gray-700/40">
                              <p className="font-semibold text-red-700 dark:text-red-300 mb-1 sm:mb-2 text-xs sm:text-sm">📉 Pontos de Saída</p>
                              <p className="text-xs leading-relaxed">Reconheça sinais de sobrecompra para realizar lucros ou rebalancear posições</p>
                            </div>
                          </div>

                          <div className="border-t border-blue-200 dark:border-blue-700 pt-3 sm:pt-4 lg:pt-5">
                            <p className="font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">⚠️ <strong>Importante:</strong></p>
                            <ul className="space-y-1 sm:space-y-2 text-xs list-disc list-inside leading-relaxed">
                              <li><strong>Primeiro:</strong> Valide a qualidade do ativo com nossa análise fundamentalista</li>
                              <li><strong>Depois:</strong> Use indicadores técnicos para timing de entrada e saída</li>
                              <li>Sinais podem persistir por períodos prolongados em tendências fortes</li>
                              <li>Considere sempre o contexto macroeconômico e setorial</li>
                              <li>Dados históricos não garantem performance futura</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Informações do dataset */}
                    <div className="p-4 sm:p-5 lg:p-6 bg-muted/30 rounded-lg sm:rounded-xl border shadow-sm">
                      <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                        <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                          Dados da Análise - {data.companyName}
                        </h3>
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground space-y-1 sm:space-y-2 leading-relaxed">
                        <p>
                          <strong>Dados disponíveis:</strong> {data.dataCount} registros históricos mensais
                        </p>
                        {data.lastUpdate && (
                          <p>
                            <strong>Última atualização:</strong> {formatDate(data.lastUpdate)}
                          </p>
                        )}
                        {data.technicalAnalysis && (
                          <p>
                            <strong>Indicadores calculados:</strong> RSI e Oscilador Estocástico com base nos últimos 24 meses
                          </p>
                        )}
                      </div>
                    </div>

                {/* Verificar se há dados suficientes */}
                {data.historicalData.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 px-4 sm:px-6">
                    <Info className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4 sm:mb-6" />
                    <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Dados não disponíveis</h3>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-sm sm:max-w-md mx-auto leading-relaxed">
                      {data.message || 'Não há dados históricos suficientes para gerar a análise técnica.'}
                    </p>
                  </div>
                ) : data.dataCount < 20 ? (
                  <div className="text-center py-8 sm:py-12 px-4 sm:px-6">
                    <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-500 mx-auto mb-4 sm:mb-6" />
                    <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Dados insuficientes</h3>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-sm sm:max-w-md mx-auto leading-relaxed">
                      São necessários pelo menos 20 registros históricos para calcular os indicadores técnicos. 
                      Atualmente temos {data.dataCount} registros.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Componente de gráficos */}
                    <PriceChart
                      data={data.historicalData}
                      technicalAnalysis={data.technicalAnalysis}
                      ticker={data.ticker}
                    />
                  </>
                )}

                {/* Estado inicial (não carregado) */}
                {!data && !loading && !error && (
                  <div className="text-center py-8 sm:py-12 px-4 sm:px-6">
                    <TrendingUp className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4 sm:mb-6" />
                    <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Análise Técnica</h3>
                    <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-sm sm:max-w-md mx-auto leading-relaxed">
                      Visualize gráficos de preços e indicadores técnicos como RSI e Oscilador Estocástico
                    </p>
                    <Button onClick={fetchTechnicalData} size="default" className="sm:text-base">
                      Carregar Análise Técnica
                    </Button>
                  </div>
                )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
