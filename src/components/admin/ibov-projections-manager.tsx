/**
 * Componente Admin: Gerenciador de Projeções IBOV
 * Permite visualizar e recriar projeções IBOV
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  RefreshCw, 
  Calendar, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Projection {
  id: string | null
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'
  projectedValue: number | null
  confidence: number | null
  reasoning: string | null
  validUntil: string | null
  createdAt: string | null
  isValid: boolean
  hasData?: boolean
}

type ProjectionPeriod = 'WEEKLY' | 'MONTHLY' | 'ANNUAL'
// API pode retornar DAILY de dados antigos - não exibimos mas precisamos do tipo para compatibilidade
type ProjectionPeriodFromApi = ProjectionPeriod | 'DAILY'

const PERIOD_LABELS: Record<ProjectionPeriodFromApi, string> = {
  DAILY: 'Diária',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
  ANNUAL: 'Anual'
}

const PERIOD_COLORS: Record<ProjectionPeriodFromApi, string> = {
  DAILY: 'bg-gray-400',
  WEEKLY: 'bg-green-500',
  MONTHLY: 'bg-orange-500',
  ANNUAL: 'bg-purple-500'
}

export function IbovProjectionsManager() {
  const [projections, setProjections] = useState<Projection[]>([])
  const [loading, setLoading] = useState(true)
  const [recreating, setRecreating] = useState<Set<ProjectionPeriod>>(new Set())
  const { toast } = useToast()

  useEffect(() => {
    fetchProjections()
  }, [])

  const fetchProjections = async () => {
    try {
      setLoading(true)
      // Buscar projeções atuais via API (precisa criar endpoint GET)
      // Por enquanto, vamos buscar diretamente do banco via API admin
      const response = await fetch('/api/admin/ibov-projections')
      if (response.ok) {
        const data = await response.json()
        setProjections(data.projections || [])
      }
    } catch (error) {
      console.error('Erro ao buscar projeções:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar projeções',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const recreateProjections = async (periods?: ProjectionPeriod[]) => {
    const periodsToRecreate = periods || ['WEEKLY', 'MONTHLY', 'ANNUAL']
    
    setRecreating(new Set(periodsToRecreate))

    try {
      const response = await fetch('/api/admin/ibov-projections/force-recreate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          periods: periodsToRecreate
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Sucesso',
          description: `${data.totalRecreated} projeção(ões) recriada(s) com sucesso`,
        })
        await fetchProjections()
      } else {
        toast({
          title: 'Erro',
          description: data.error || 'Erro ao recriar projeções',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Erro ao recriar projeções:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível recriar projeções',
        variant: 'destructive'
      })
    } finally {
      setRecreating(new Set())
    }
  }

  const recreateSingle = async (period: ProjectionPeriod) => {
    await recreateProjections([period])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const supportedPeriods: ProjectionPeriod[] = ['WEEKLY', 'MONTHLY', 'ANNUAL']
  const validProjections = projections.filter(p => 
    p.hasData && p.isValid && supportedPeriods.includes(p.period as ProjectionPeriod)
  ) as Array<Projection & { period: ProjectionPeriod }>
  const expiredProjections = projections.filter(p => 
    p.hasData && !p.isValid && supportedPeriods.includes(p.period as ProjectionPeriod)
  ) as Array<Projection & { period: ProjectionPeriod }>
  const missingProjections = supportedPeriods.filter(period => !projections.some(p => p.period === period && p.hasData))

  return (
    <div className="space-y-6">
      {/* Header com ações */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Projeções IBOV</h2>
          <p className="text-gray-600 mt-1">
            Gerencie e recrie projeções do IBOVESPA para diferentes períodos
          </p>
        </div>
        <Button
          onClick={() => recreateProjections()}
          disabled={recreating.size > 0}
          className="gap-2"
        >
          {recreating.size > 0 ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Recriando...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Recriar Todas
            </>
          )}
        </Button>
      </div>

      {/* Projeções Válidas */}
      {validProjections.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Projeções Válidas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {validProjections.map((projection) => (
              <Card key={projection.period} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${PERIOD_COLORS[projection.period]}`} />
                      <CardTitle className="text-lg">{PERIOD_LABELS[projection.period]}</CardTitle>
                    </div>
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Válida
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Valor Projetado</p>
                      <p className="text-2xl font-bold">
                        {projection.projectedValue!.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-gray-600">Confiança</p>
                        <p className="font-semibold">{projection.confidence}%</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Válido até</p>
                        <p className="font-semibold">
                          {new Date(projection.validUntil!).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => recreateSingle(projection.period)}
                      disabled={recreating.has(projection.period)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {recreating.has(projection.period) ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Recriando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Recriar {PERIOD_LABELS[projection.period]}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Projeções Expiradas */}
      {expiredProjections.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Projeções Expiradas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {expiredProjections.map((projection) => (
              <Card key={projection.period} className="relative opacity-75">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${PERIOD_COLORS[projection.period]}`} />
                      <CardTitle className="text-lg">{PERIOD_LABELS[projection.period]}</CardTitle>
                    </div>
                    <Badge variant="destructive">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Expirada
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Valor Projetado</p>
                      <p className="text-2xl font-bold">
                        {projection.projectedValue!.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-gray-600">Confiança</p>
                        <p className="font-semibold">{projection.confidence}%</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Expirou em</p>
                        <p className="font-semibold">
                          {new Date(projection.validUntil!).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => recreateSingle(projection.period)}
                      disabled={recreating.has(projection.period)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {recreating.has(projection.period) ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Recriando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Recriar {PERIOD_LABELS[projection.period]}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Períodos sem dados */}
      {missingProjections.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Períodos sem Projeção</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {missingProjections.map((period) => (
              <Card key={period} className="relative border-dashed border-2 border-gray-300">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${PERIOD_COLORS[period]}`} />
                      <CardTitle className="text-lg">{PERIOD_LABELS[period]}</CardTitle>
                    </div>
                    <Badge variant="outline" className="border-gray-400 text-gray-600">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Sem dados
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-center py-4">
                      <p className="text-gray-500 text-sm">
                        Nenhuma projeção criada para este período
                      </p>
                    </div>
                    <Button
                      onClick={() => recreateSingle(period)}
                      disabled={recreating.has(period)}
                      variant="default"
                      size="sm"
                      className="w-full"
                    >
                      {recreating.has(period) ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Criar {PERIOD_LABELS[period]}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

