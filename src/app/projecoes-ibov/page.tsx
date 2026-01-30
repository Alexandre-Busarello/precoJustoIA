'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Calendar, BarChart3, Lock, Minus } from 'lucide-react'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { NotificationMarkdown } from '@/components/notification-markdown'

async function fetchProjections() {
  const response = await fetch('/api/ibov-projections')
  if (!response.ok) {
    throw new Error('Erro ao buscar projeções')
  }
  return response.json()
}

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
        bgGradient: 'from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30',
        textColor: 'text-green-600'
      }
    case 'QUEDA':
      return {
        badgeVariant: 'destructive' as const,
        badgeClassName: 'bg-red-500 hover:bg-red-600 text-white border-red-600',
        icon: TrendingDown,
        iconClassName: 'text-red-600 dark:text-red-400',
        borderGradient: 'from-red-500 to-rose-500',
        bgGradient: 'from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30',
        textColor: 'text-red-600'
      }
    case 'ESTABILIDADE':
      return {
        badgeVariant: 'secondary' as const,
        badgeClassName: 'bg-blue-500 hover:bg-blue-600 text-white border-blue-600',
        icon: BarChart3,
        iconClassName: 'text-blue-600 dark:text-blue-400',
        borderGradient: 'from-blue-500 to-indigo-500',
        bgGradient: 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30',
        textColor: 'text-blue-600'
      }
  }
}

export default function ProjecoesIbovPage() {
  const { isPremium } = usePremiumStatus()
  const { data, isLoading } = useQuery({
    queryKey: ['ibov-projections'],
    queryFn: fetchProjections
  })

  const projections = data?.projections || []
  const currentValue = data?.currentValue || 0

  // Agrupar projeções por período
  const groupedProjections = {
    DAILY: projections.filter((p: any) => p.period === 'DAILY'),
    WEEKLY: projections.filter((p: any) => p.period === 'WEEKLY'),
    MONTHLY: projections.filter((p: any) => p.period === 'MONTHLY'),
    ANNUAL: projections.filter((p: any) => p.period === 'ANNUAL')
  }

  const periodLabels = {
    DAILY: 'Diária',
    WEEKLY: 'Semanal',
    MONTHLY: 'Mensal',
    ANNUAL: 'Anual'
  }

  const periodColors = {
    DAILY: 'from-blue-500 to-blue-600',
    WEEKLY: 'from-violet-500 to-violet-600',
    MONTHLY: 'from-purple-500 to-purple-600',
    ANNUAL: 'from-pink-500 to-pink-600'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">Carregando projeções...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-violet-500 p-0.5 shadow-lg">
              <Image 
                src="/ben.png" 
                alt="Ben" 
                width={64} 
                height={64} 
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Projeções IBOVESPA</h1>
              <p className="text-muted-foreground">
                Análises e projeções calculadas pelo Ben, seu assistente de IA especializado em análise fundamentalista
              </p>
            </div>
          </div>
          
          {/* Valor Atual do IBOV */}
          {currentValue > 0 && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Valor Atual</p>
                    <p className="text-2xl font-bold">IBOVESPA</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">{currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Projeções por Período */}
        <div className="space-y-8">
          {(['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL'] as const).map((period) => {
            const periodProjections = groupedProjections[period]
            if (periodProjections.length === 0) {
              return (
                <Card key={period}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Projeção {periodLabels[period]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      Nenhuma projeção disponível para este período ainda.
                    </p>
                  </CardContent>
                </Card>
              )
            }

            // Pegar a projeção mais recente válida ou a mais recente
            const now = new Date()
            const validProjection = periodProjections.find((p: any) => new Date(p.validUntil) > now) || periodProjections[0]

            const projectedValue = Number(validProjection.projectedValue) || 0
            const change = projectedValue - currentValue
            const changePercent = currentValue > 0 ? (change / currentValue) * 100 : 0
            
            // Determinar direção da projeção
            const direction = getProjectionDirection(validProjection.reasoning, projectedValue, currentValue)
            const visuals = getProjectionVisuals(direction)
            const DirectionIcon = visuals.icon

            return (
              <div key={period} className="relative">
                <Card className={cn(
                  "relative overflow-visible",
                  !isPremium && "blur-sm"
                )}>
                  {/* Avatar do Ben no canto superior esquerdo */}
                  <div className="absolute -top-3 -left-3 z-20">
                    <div className={`w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br ${visuals.borderGradient} p-0.5 shadow-lg`}>
                      <Image 
                        src="/ben.png" 
                        alt="Ben" 
                        width={48} 
                        height={48} 
                        className="w-full h-full object-cover rounded-full"
                      />
                    </div>
                  </div>
                  
                  <div className={`relative p-0.5 rounded-lg bg-gradient-to-br ${visuals.borderGradient}`}>
                    <Card className={`border-0 bg-gradient-to-r ${visuals.bgGradient}`}>
                      <CardHeader className="pt-8">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-3">
                            <CardTitle className="text-xl">Projeção {periodLabels[period]}</CardTitle>
                            {isPremium && validProjection.confidence > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {validProjection.confidence}% confiança
                              </Badge>
                            )}
                            {projectedValue > 0 && (
                              <Badge className={visuals.badgeClassName}>
                                <DirectionIcon className="w-3 h-3 mr-1" />
                                {changePercent > 0 ? '+' : ''}
                                {changePercent.toFixed(2)}%
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Criada em {new Date(validProjection.createdAt).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Valores */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Valor Atual</p>
                            <p className="text-xl font-bold">
                              {currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Projeção</p>
                            {projectedValue > 0 ? (
                              <p className={`text-xl font-bold ${visuals.iconClassName}`}>
                                {projectedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            ) : (
                              <p className="text-xl font-bold text-muted-foreground">---</p>
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Variação</p>
                            {projectedValue > 0 ? (
                              <p className={`text-xl font-bold ${visuals.textColor}`}>
                                {change > 0 ? '+' : ''}
                                {change.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            ) : (
                              <p className="text-xl font-bold text-muted-foreground">---</p>
                            )}
                          </div>
                        </div>

                        {/* Reasoning */}
                        <div>
                          <p className="text-sm font-semibold mb-2">Análise do Ben</p>
                          <div className="bg-muted/50 rounded-lg p-4 text-sm">
                            <NotificationMarkdown content={validProjection.reasoning} className="text-sm" />
                          </div>
                        </div>

                        {/* Indicadores Analisados */}
                        {isPremium && validProjection.keyIndicators && typeof validProjection.keyIndicators === 'object' && (
                          <div>
                            <p className="text-sm font-semibold mb-2">Indicadores Analisados</p>
                            {/* Se existe campo "all" com todos os indicadores detalhados */}
                            {(validProjection.keyIndicators as any).all && typeof (validProjection.keyIndicators as any).all === 'object' ? (
                              <div className="space-y-2">
                                {Object.entries((validProjection.keyIndicators as any).all).map(
                                  ([indicator, data]: [string, any]) => {
                                    const impact = data?.impact || 'NEUTRO'
                                    const weight = data?.weight || 0
                                    const reason = data?.reason || ''
                                    const isPositive = impact === 'ALTA'
                                    const isNegative = impact === 'BAIXA'
                                    
                                    return (
                                      <div key={indicator} className="border rounded-lg p-3 bg-muted/30">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-sm font-semibold">{indicator}</span>
                                          <div className="flex items-center gap-2">
                                            <Badge 
                                              variant={isPositive ? 'default' : isNegative ? 'destructive' : 'secondary'} 
                                              className="text-xs"
                                            >
                                              {impact}
                                            </Badge>
                                            <span className="text-sm font-medium">
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
                              <div className="flex flex-wrap gap-2">
                                {validProjection.keyIndicators.primary && (
                                  <Badge variant="default" className="text-xs">
                                    Principal: {validProjection.keyIndicators.primary}
                                  </Badge>
                                )}
                                {Array.isArray(validProjection.keyIndicators.secondary) && 
                                  validProjection.keyIndicators.secondary.map((indicator: string, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {indicator}
                                    </Badge>
                                  ))
                                }
                                {(validProjection.keyIndicators as any).weights && (
                                  <div className="w-full mt-2 space-y-1">
                                    {Object.entries((validProjection.keyIndicators as any).weights).map(
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
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Validade */}
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            Válida até: {new Date(validProjection.validUntil).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>

                        {/* Histórico (se houver múltiplas projeções) - apenas para premium */}
                        {isPremium && periodProjections.length > 1 && (
                          <div className="pt-4 border-t">
                            <p className="text-sm font-semibold mb-2">
                              Histórico ({periodProjections.length} projeções)
                            </p>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {periodProjections.slice(1, 6).map((proj: any) => {
                                const projValue = Number(proj.projectedValue) || 0
                                const projChange = projValue - currentValue
                                const projChangePercent = currentValue > 0 ? (projChange / currentValue) * 100 : 0
                                const projDirection = getProjectionDirection(proj.reasoning, projValue, currentValue)
                                const projVisuals = getProjectionVisuals(projDirection)
                                const ProjDirectionIcon = projVisuals.icon
                                return (
                                  <div 
                                    key={proj.id} 
                                    className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {projValue > 0 ? projValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'}
                                      </span>
                                      {projValue > 0 && (
                                        <Badge className={`${projVisuals.badgeClassName} text-xs`}>
                                          <ProjDirectionIcon className="w-2.5 h-2.5 mr-1" />
                                          {projChangePercent > 0 ? '+' : ''}
                                          {projChangePercent.toFixed(2)}%
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-muted-foreground">
                                      {new Date(proj.createdAt).toLocaleDateString('pt-BR', {
                                        day: '2-digit',
                                        month: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
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
          })}
        </div>
      </div>
    </div>
  )
}
