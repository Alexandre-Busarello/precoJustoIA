'use client'

/**
 * Dashboard IBOV Banner - Exibe projeções semanal e mensal do IBOVESPA
 * Com botão "Ver mais" para expandir detalhamento completo da IA
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getOrCreateIbovProjection, calculateIbovProjection } from '@/app/actions/ibov-projection'
import { TrendingUp, TrendingDown, RefreshCw, ChevronDown, ChevronUp, Lock, Minus, BarChart3 } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { NotificationMarkdown } from '@/components/notification-markdown'

/**
 * Extrai a direção da projeção (ALTA, QUEDA ou ESTABILIDADE) do reasoning ou calcula baseado nos valores
 */
function getProjectionDirection(
  reasoning: string,
  projectedValue: number,
  currentValue: number
): 'ALTA' | 'QUEDA' | 'ESTABILIDADE' {
  // Tentar extrair do reasoning primeiro
  const reasoningUpper = reasoning.toUpperCase()
  if (reasoningUpper.includes('PROJEÇÃO: ALTA') || reasoningUpper.includes('**PROJEÇÃO: ALTA')) {
    return 'ALTA'
  }
  if (reasoningUpper.includes('PROJEÇÃO: QUEDA') || reasoningUpper.includes('**PROJEÇÃO: QUEDA')) {
    return 'QUEDA'
  }
  if (reasoningUpper.includes('PROJEÇÃO: ESTABILIDADE') || reasoningUpper.includes('**PROJEÇÃO: ESTABILIDADE')) {
    return 'ESTABILIDADE'
  }
  
  // Se não encontrou no reasoning, calcular baseado nos valores
  const variation = (projectedValue - currentValue) / currentValue
  const absVariation = Math.abs(variation)
  
  if (absVariation < 0.005) { // Menos de 0.5% de diferença
    return 'ESTABILIDADE'
  }
  
  return variation > 0 ? 'ALTA' : 'QUEDA'
}

/**
 * Retorna informações visuais baseadas na direção da projeção
 */
function getProjectionVisuals(direction: 'ALTA' | 'QUEDA' | 'ESTABILIDADE') {
  switch (direction) {
    case 'ALTA':
      return {
        badgeVariant: 'default' as const,
        badgeClassName: 'bg-green-500 hover:bg-green-600 text-white border-green-600',
        icon: TrendingUp,
        iconClassName: 'text-green-600 dark:text-green-400',
        borderGradient: 'from-green-500 to-emerald-500',
        bgGradient: 'from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30'
      }
    case 'QUEDA':
      return {
        badgeVariant: 'destructive' as const,
        badgeClassName: 'bg-red-500 hover:bg-red-600 text-white border-red-600',
        icon: TrendingDown,
        iconClassName: 'text-red-600 dark:text-red-400',
        borderGradient: 'from-red-500 to-rose-500',
        bgGradient: 'from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30'
      }
    case 'ESTABILIDADE':
      return {
        badgeVariant: 'secondary' as const,
        badgeClassName: 'bg-blue-500 hover:bg-blue-600 text-white border-blue-600',
        icon: BarChart3,
        iconClassName: 'text-blue-600 dark:text-blue-400',
        borderGradient: 'from-blue-500 to-indigo-500',
        bgGradient: 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30'
      }
  }
}

/**
 * Extrai um resumo do reasoning removendo markdown e limitando a 2 linhas
 */
function getReasoningSummary(reasoning: string, maxLength: number = 150): string {
  // Remover markdown básico para o resumo
  let summary = reasoning
    .replace(/^#+\s*/gm, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/`(.*?)`/g, '$1') // Remove code
    .replace(/\n{2,}/g, '\n') // Remove múltiplas quebras de linha
    .trim()
  
  // Pegar apenas as primeiras linhas
  const lines = summary.split('\n').slice(0, 2)
  summary = lines.join(' ')
  
  // Limitar tamanho
  if (summary.length > maxLength) {
    const truncated = summary.substring(0, maxLength)
    const lastSpace = truncated.lastIndexOf(' ')
    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + '...'
    }
    return truncated + '...'
  }
  
  return summary
}

interface ProjectionDisplayProps {
  period: 'WEEKLY' | 'MONTHLY'
  projection: any
  currentValue: number
  isExpanded: boolean
  onToggleExpand: () => void
  isPremium?: boolean
}

function ProjectionDisplay({
  period,
  projection,
  currentValue,
  isExpanded,
  onToggleExpand,
  isPremium = false
}: ProjectionDisplayProps) {
  const change = projection.projectedValue - currentValue
  const changePercent = currentValue > 0 ? (change / currentValue) * 100 : 0
  
  // Determinar direção da projeção
  const direction = getProjectionDirection(projection.reasoning, projection.projectedValue, currentValue)
  const visuals = getProjectionVisuals(direction)
  const DirectionIcon = visuals.icon
  
  return (
    <div className={`relative p-0.5 rounded-lg bg-gradient-to-br ${visuals.borderGradient} h-full`}>
      {/* Avatar do Ben no canto superior esquerdo - fora do Card para não ser cortado */}
      <div className="absolute -top-2.5 -left-2.5 sm:-top-3 sm:-left-3 z-30">
        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-violet-500 p-0.5 shadow-lg">
          <Image 
            src="/ben.png" 
            alt="Ben" 
            width={56} 
            height={56} 
            className="w-full h-full object-cover rounded-full"
          />
        </div>
      </div>
      <Card className={cn(
        `border-0 bg-gradient-to-r ${visuals.bgGradient} relative overflow-visible h-full flex flex-col`,
        !isPremium && "blur-sm"
      )}>
      <CardContent className="p-4 pt-6 sm:pt-8 flex-1 flex flex-col">
        <div className="space-y-4 flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-bold text-lg">IBOVESPA</span>
                <Badge variant="outline" className="text-xs">
                  {period === 'WEEKLY' ? 'Projeção Semanal' : 'Projeção Mensal'}
                </Badge>
                <Badge className={visuals.badgeClassName}>
                  <DirectionIcon className="w-3 h-3 mr-1" />
                  {changePercent > 0 ? '+' : ''}
                  {changePercent.toFixed(2)}%
                </Badge>
              </div>

              {/* Valor Atual vs Projeção */}
              <div className="space-y-2">
                <div className="flex items-baseline gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Valor Atual</p>
                    <p className="text-xl font-semibold text-foreground">
                      {currentValue.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </p>
                  </div>
                  <div className="text-muted-foreground">→</div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      Projeção do Ben{' '}
                      <Image 
                        src="/ben.png" 
                        alt="Ben" 
                        width={16} 
                        height={16} 
                        className="inline rounded-full"
                      />
                    </p>
                    <p className={`text-2xl font-bold ${visuals.iconClassName}`}>
                      {projection.projectedValue.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo (sempre visível) */}
          <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
            <div className="text-sm text-muted-foreground line-clamp-2">
              {getReasoningSummary(projection.reasoning)}
            </div>
          </div>

          {/* Detalhamento Expandível */}
          <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-xs"
              >
                <span>Ver detalhamento completo da análise</span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Reasoning Completo */}
              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Análise Completa da IA</p>
                <div className="text-sm text-muted-foreground">
                  <NotificationMarkdown content={projection.reasoning} className="text-sm" />
                </div>
              </div>

              {/* Indicadores Analisados */}
              {projection.keyIndicators && typeof projection.keyIndicators === 'object' && (
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                  <p className="text-sm font-medium mb-2">Indicadores Analisados</p>
                  <div className="space-y-2">
                    {/* Se existe campo "all" com todos os indicadores detalhados */}
                    {(projection.keyIndicators as any).all && typeof (projection.keyIndicators as any).all === 'object' ? (
                      <div className="space-y-2">
                        {Object.entries((projection.keyIndicators as any).all).map(
                          ([indicator, data]: [string, any]) => {
                            const impact = data?.impact || 'NEUTRO'
                            const weight = data?.weight || 0
                            const reason = data?.reason || ''
                            const isPositive = impact === 'ALTA'
                            const isNegative = impact === 'BAIXA'
                            
                            return (
                              <div key={indicator} className="border rounded-lg p-2 bg-white/30 dark:bg-black/10">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold">{indicator}</span>
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant={isPositive ? 'default' : isNegative ? 'destructive' : 'secondary'} 
                                      className="text-xs"
                                    >
                                      {impact}
                                    </Badge>
                                    <span className="text-xs font-medium">
                                      {(Number(weight) * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                                {reason && (
                                  <p className="text-xs text-muted-foreground mt-1">{reason}</p>
                                )}
                              </div>
                            )
                          }
                        )}
                      </div>
                    ) : (
                      /* Fallback para formato antigo */
                      <>
                        {(projection.keyIndicators as any).primary && (
                          <div>
                            <p className="text-xs text-muted-foreground">Indicador Principal</p>
                            <p className="text-sm font-semibold">
                              {(projection.keyIndicators as any).primary}
                            </p>
                          </div>
                        )}
                        {(projection.keyIndicators as any).secondary && (
                          <div>
                            <p className="text-xs text-muted-foreground">Indicadores Secundários</p>
                            <p className="text-sm">
                              {(projection.keyIndicators as any).secondary.join(', ')}
                            </p>
                          </div>
                        )}
                        {(projection.keyIndicators as any).weights && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Pesos dos Indicadores</p>
                            <div className="space-y-1">
                              {Object.entries((projection.keyIndicators as any).weights).map(
                                ([indicator, weight]: [string, any]) => (
                                  <div key={indicator} className="flex items-center justify-between text-xs">
                                    <span>{indicator}</span>
                                    <span className="font-medium">
                                      {(Number(weight) * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Metadados */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  Confiança: {projection.confidence}%
                </Badge>
                {projection.cached && (
                  <Badge variant="secondary" className="text-xs">
                    Cache
                  </Badge>
                )}
                <span>
                  Válido até:{' '}
                  {new Date(projection.validUntil).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
      </Card>
      {/* Overlay de conversão para usuários não-premium */}
      {!isPremium && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-blue-500/90 to-violet-500/90 backdrop-blur-sm rounded-lg pointer-events-auto">
          <div className="text-center p-4 sm:p-6 max-w-sm">
            <Lock className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-white" />
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
              Desbloqueie Projeções Detalhadas
            </h3>
            <p className="text-blue-100 mb-4 text-xs sm:text-sm">
              Acesse projeções completas do IBOVESPA com análises detalhadas do Ben. Faça upgrade para Premium e tenha acesso ilimitado.
            </p>
            <Button asChild className="bg-white text-blue-600 hover:bg-blue-50 text-sm sm:text-base">
              <Link href="/checkout">
                Fazer Upgrade
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function DashboardIbovBanner() {
  const queryClient = useQueryClient()
  const { isPremium } = usePremiumStatus()
  const [isCalculatingWeekly, setIsCalculatingWeekly] = useState(false)
  const [isCalculatingMonthly, setIsCalculatingMonthly] = useState(false)
  const [hasTriedCalculateWeekly, setHasTriedCalculateWeekly] = useState(false)
  const [hasTriedCalculateMonthly, setHasTriedCalculateMonthly] = useState(false)
  const [expandedWeekly, setExpandedWeekly] = useState(false)
  const [expandedMonthly, setExpandedMonthly] = useState(false)
  const weeklyTimerRef = useRef<NodeJS.Timeout | null>(null)
  const monthlyTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isCalculatingWeeklyRef = useRef(false)
  const isCalculatingMonthlyRef = useRef(false)

  const { data: weeklyData, isLoading: weeklyLoading, refetch: refetchWeekly } = useQuery({
    queryKey: ['ibov-projection', 'WEEKLY'],
    queryFn: () => getOrCreateIbovProjection('WEEKLY'),
    refetchOnWindowFocus: false,
    staleTime: 0, // Sempre considerar stale para permitir refetch imediato após cálculo
    gcTime: 1000 * 60 * 60 * 24, // Manter no cache por 24h (antigo cacheTime)
    retry: false, // Não retry automático para evitar loops
    enabled: true // Sempre habilitado
  })

  const { data: monthlyData, isLoading: monthlyLoading, refetch: refetchMonthly } = useQuery({
    queryKey: ['ibov-projection', 'MONTHLY'],
    queryFn: () => getOrCreateIbovProjection('MONTHLY'),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60, // 1 hora
    retry: false // Não retry automático para evitar loops
  })

  // Calcular automaticamente se não existe projeção mensal (on-demand)
  useEffect(() => {
    const shouldCalculate =
      !monthlyLoading &&
      monthlyData !== undefined &&
      monthlyData !== null &&
      !monthlyData.success &&
      ((monthlyData as any).needsCalculation === true || !(monthlyData as any).error) &&
      !hasTriedCalculateMonthly &&
      !isCalculatingMonthly &&
      !isCalculatingMonthlyRef.current

    if (shouldCalculate) {
      isCalculatingMonthlyRef.current = true
      setHasTriedCalculateMonthly(true)
      setIsCalculatingMonthly(true)

      if (monthlyTimerRef.current) {
        clearTimeout(monthlyTimerRef.current)
      }

      monthlyTimerRef.current = setTimeout(() => {
        calculateIbovProjection('MONTHLY')
          .then(async (result) => {
            monthlyTimerRef.current = null
            if (result?.retryable && !result?.success) {
              isCalculatingMonthlyRef.current = false
              setIsCalculatingMonthly(false)
              setTimeout(() => setHasTriedCalculateMonthly(false), 30000)
            } else if (result?.success) {
              isCalculatingMonthlyRef.current = false
              queryClient.invalidateQueries({ queryKey: ['ibov-projection', 'MONTHLY'] })
              await new Promise(resolve => setTimeout(resolve, 500))
              await refetchMonthly()
              setIsCalculatingMonthly(false)
            } else {
              isCalculatingMonthlyRef.current = false
              queryClient.invalidateQueries({ queryKey: ['ibov-projection', 'MONTHLY'] })
              await refetchMonthly()
              setIsCalculatingMonthly(false)
            }
          })
          .catch(async (error) => {
            console.error('Erro ao calcular projeção mensal:', error)
            monthlyTimerRef.current = null
            isCalculatingMonthlyRef.current = false
            queryClient.invalidateQueries({ queryKey: ['ibov-projection', 'MONTHLY'] })
            await refetchMonthly()
            setIsCalculatingMonthly(false)
            setTimeout(() => setHasTriedCalculateMonthly(false), 60000)
          })
      }, 1500)
    }

    return () => {
      if (monthlyTimerRef.current) {
        clearTimeout(monthlyTimerRef.current)
        monthlyTimerRef.current = null
      }
    }
  }, [monthlyData, monthlyLoading, hasTriedCalculateMonthly, isCalculatingMonthly, refetchMonthly, queryClient])

  // Calcular automaticamente se não existe projeção semanal (on-demand)
  useEffect(() => {
    // Calcular se:
    // 1. Não está loading
    // 2. Tem dados (weeklyData existe)
    // 3. Não tem sucesso (!weeklyData.success)
    // 4. Precisa calcular (needsCalculation === true) OU não tem erro (dados não encontrados)
    // 5. Ainda não tentou calcular
    // 6. Não está calculando agora
    const shouldCalculate = 
      !weeklyLoading && 
      weeklyData !== undefined && 
      weeklyData !== null &&
      !weeklyData.success && 
      ((weeklyData as any).needsCalculation === true || !(weeklyData as any).error) &&
      !hasTriedCalculateWeekly && 
      !isCalculatingWeekly &&
      !isCalculatingWeeklyRef.current

    if (shouldCalculate) {
      // Marcar como calculando usando ref para evitar cancelamento
      isCalculatingWeeklyRef.current = true
      setHasTriedCalculateWeekly(true)
      setIsCalculatingWeekly(true)
      
      // Limpar timer anterior se existir
      if (weeklyTimerRef.current) {
        clearTimeout(weeklyTimerRef.current)
      }
      
      weeklyTimerRef.current = setTimeout(() => {
        calculateIbovProjection('WEEKLY')
          .then(async (result) => {
            weeklyTimerRef.current = null // Limpar ref após executar
            
            if (result?.retryable && !result?.success) {
              // Se for retryable, resetar flag após delay para tentar novamente
              isCalculatingWeeklyRef.current = false
              setIsCalculatingWeekly(false)
              setTimeout(() => {
                setHasTriedCalculateWeekly(false)
              }, 30000)
            } else if (result?.success) {
              // Sucesso - invalidar cache e refetch para atualizar dados
              isCalculatingWeeklyRef.current = false
              queryClient.invalidateQueries({ queryKey: ['ibov-projection', 'WEEKLY'] })
              await new Promise(resolve => setTimeout(resolve, 500))
              await refetchWeekly()
              setIsCalculatingWeekly(false)
            } else {
              // Erro não retryable - invalidar cache e refetch mesmo assim
              isCalculatingWeeklyRef.current = false
              queryClient.invalidateQueries({ queryKey: ['ibov-projection', 'WEEKLY'] })
              await refetchWeekly()
              setIsCalculatingWeekly(false)
            }
          })
          .catch(async (error) => {
            console.error('Erro ao calcular projeção semanal:', error)
            weeklyTimerRef.current = null
            isCalculatingWeeklyRef.current = false
            // Invalidar cache e refetch mesmo em caso de erro para atualizar estado
            queryClient.invalidateQueries({ queryKey: ['ibov-projection', 'WEEKLY'] })
            await refetchWeekly()
            setIsCalculatingWeekly(false)
            // Resetar flag após delay para permitir nova tentativa
            setTimeout(() => {
              setHasTriedCalculateWeekly(false)
            }, 60000)
          })
      }, 1500) // Delay antes de calcular
    }
    
    // Cleanup apenas quando componente desmontar
    return () => {
      if (weeklyTimerRef.current) {
        clearTimeout(weeklyTimerRef.current)
        weeklyTimerRef.current = null
      }
    }
  }, [weeklyData, weeklyLoading, hasTriedCalculateWeekly, isCalculatingWeekly, refetchWeekly, queryClient])

  const handleRecalculateWeekly = async () => {
    setIsCalculatingWeekly(true)
    setHasTriedCalculateWeekly(false)
    try {
      const result = await calculateIbovProjection('WEEKLY')
      console.log('Resultado do recálculo semanal:', result)
      
      // Invalidar cache para forçar atualização
      queryClient.invalidateQueries({ queryKey: ['ibov-projection', 'WEEKLY'] })
      
      // Aguardar um pouco antes de refetch para garantir que o banco foi atualizado
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Refetch para atualizar dados
      await refetchWeekly()
    } catch (error) {
      console.error('Erro ao recalcular projeção semanal:', error)
      // Invalidar cache mesmo em caso de erro
      queryClient.invalidateQueries({ queryKey: ['ibov-projection', 'WEEKLY'] })
      await refetchWeekly()
    } finally {
      setIsCalculatingWeekly(false)
    }
  }

  const handleRecalculateMonthly = async () => {
    setIsCalculatingMonthly(true)
    setHasTriedCalculateMonthly(false)
    try {
      const result = await calculateIbovProjection('MONTHLY')
      queryClient.invalidateQueries({ queryKey: ['ibov-projection', 'MONTHLY'] })
      await new Promise(resolve => setTimeout(resolve, 1000))
      await refetchMonthly()
    } catch (error) {
      console.error('Erro ao recalcular projeção mensal:', error)
      queryClient.invalidateQueries({ queryKey: ['ibov-projection', 'MONTHLY'] })
      await refetchMonthly()
    } finally {
      setIsCalculatingMonthly(false)
    }
  }

  // Buscar valor atual do IBOV (usar do weeklyData ou monthlyData se disponível)
  const currentValue = weeklyData?.currentValue || monthlyData?.currentValue || 0

  // Loading apenas se ambas estiverem carregando pela primeira vez
  const isInitialLoading = weeklyLoading && monthlyLoading

  if (isInitialLoading) {
    return (
      <Card className="border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Carregando projeções IBOV...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
      {/* Projeção Semanal */}
      <div>
        {(weeklyLoading && !weeklyData) || (isCalculatingWeekly && !weeklyData?.success) ? (
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">IBOVESPA - Projeção Semanal</span>
                      {currentValue > 0 && (
                        <Badge variant="secondary">
                          {currentValue.toLocaleString('pt-BR', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Calculando...
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                >
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : weeklyData?.success && (weeklyData as any).projection ? (
          <ProjectionDisplay
            period="WEEKLY"
            projection={(weeklyData as any).projection}
            currentValue={currentValue}
            isExpanded={expandedWeekly}
            onToggleExpand={() => setExpandedWeekly(!expandedWeekly)}
            isPremium={isPremium ?? false}
          />
        ) : (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">IBOVESPA - Projeção Semanal</span>
                      {currentValue > 0 && (
                        <Badge variant="secondary">
                          {currentValue.toLocaleString('pt-BR', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {(weeklyData as any)?.error || 'Dados em tempo real'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRecalculateWeekly}
                  disabled={isCalculatingWeekly}
                >
                  {isCalculatingWeekly ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Calcular
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Projeção Mensal */}
      <div>
        {(monthlyLoading && !monthlyData) || (isCalculatingMonthly && !monthlyData?.success) ? (
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">IBOVESPA - Projeção Mensal</span>
                      {currentValue > 0 && (
                        <Badge variant="secondary">
                          {currentValue.toLocaleString('pt-BR', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Calculando...
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                >
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : monthlyData?.success && (monthlyData as any).projection ? (
          <ProjectionDisplay
            period="MONTHLY"
            projection={(monthlyData as any).projection}
            currentValue={currentValue}
            isExpanded={expandedMonthly}
            onToggleExpand={() => setExpandedMonthly(!expandedMonthly)}
            isPremium={isPremium ?? false}
          />
        ) : (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">IBOVESPA - Projeção Mensal</span>
                      {currentValue > 0 && (
                        <Badge variant="secondary">
                          {currentValue.toLocaleString('pt-BR', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {(monthlyData as any)?.error || 'Dados em tempo real'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRecalculateMonthly}
                  disabled={isCalculatingMonthly}
                >
                  {isCalculatingMonthly ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Calcular
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
