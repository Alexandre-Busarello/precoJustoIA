'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminStatus } from '@/hooks/use-admin-status'

// Função auxiliar para formatar porcentagem (valor já está em porcentagem)
const formatPercent = (value: number | null): string => {
  if (value === null || value === undefined) return 'N/A'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

interface DailyViewData {
  date: string
  points: number
  dailyChange: number
  contributionsSum: number
  contributions: Array<{
    ticker: string
    contribution: number
  }>
  hasContributions: boolean
}

interface IndexDailyViewProps {
  ticker: string
}

export function IndexDailyView({ ticker }: IndexDailyViewProps) {
  const [data, setData] = useState<DailyViewData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recalculating, setRecalculating] = useState<string | null>(null)
  const { isAdmin } = useAdminStatus()

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const response = await fetch(`/api/indices/${ticker}/daily-view`)
        const result = await response.json()

        if (result.success) {
          setData(result.dailyData)
        } else {
          setError(result.error || 'Erro ao carregar dados')
        }
      } catch (err) {
        setError('Erro ao carregar dados diários')
        console.error('Error fetching daily view:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [ticker])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-full mb-4" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-red-500 dark:text-red-400">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    )
  }

  const formatDate = (dateStr: string) => {
    // Parse a data como YYYY-MM-DD e criar Date no timezone local
    // Isso evita problemas de timezone onde 2026-01-12 vira 2026-01-11
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month é 0-indexed no Date
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600 dark:text-green-400'
    if (change < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  const hasDifference = (day: DailyViewData) => {
    return Math.abs(day.dailyChange - day.contributionsSum) >= 0.01
  }

  const handleRecalculateDay = async (date: string) => {
    try {
      setRecalculating(date)
      const response = await fetch(`/api/admin/indices/${ticker}/recalculate-day`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date }),
      })

      const result = await response.json()

      if (result.success) {
        // Recarregar dados
        const refreshResponse = await fetch(`/api/indices/${ticker}/daily-view`)
        const refreshResult = await refreshResponse.json()
        if (refreshResult.success) {
          setData(refreshResult.dailyData)
        }
      } else {
        alert(`Erro ao recalcular: ${result.error}`)
      }
    } catch (err) {
      console.error('Error recalculating day:', err)
      alert('Erro ao recalcular o dia')
    } finally {
      setRecalculating(null)
    }
  }

  return (
    <div className="space-y-4">
      {data.map((day) => (
        <Card key={day.date} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-lg font-semibold">
                {formatDate(day.date)}
              </CardTitle>
              <div className="flex items-center gap-2">
                {getChangeIcon(day.dailyChange)}
                <span className={`text-lg font-bold ${getChangeColor(day.dailyChange)}`}>
                  {formatPercent(day.dailyChange)}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {/* Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-muted/50 dark:bg-muted/20 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Variação do Dia</p>
                  <p className={`text-lg font-semibold ${getChangeColor(day.dailyChange)}`}>
                    {formatPercent(day.dailyChange)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Soma das Contribuições</p>
                  <p className={`text-lg font-semibold ${getChangeColor(day.contributionsSum)}`}>
                    {formatPercent(day.contributionsSum)}
                  </p>
                </div>
              </div>

              {/* Validação */}
              {day.hasContributions && (
                <div className={`text-xs p-2 rounded flex items-center justify-between ${
                  Math.abs(day.dailyChange - day.contributionsSum) < 0.01
                    ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
                    : 'bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400'
                }`}>
                  <span>
                    {Math.abs(day.dailyChange - day.contributionsSum) < 0.01
                      ? '✅ Validação: Soma das contribuições bate com a variação do dia'
                      : `⚠️ Diferença: ${Math.abs(day.dailyChange - day.contributionsSum).toFixed(4)}%`}
                  </span>
                  {isAdmin && hasDifference(day) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRecalculateDay(day.date)}
                      disabled={recalculating === day.date}
                      className="ml-2 h-6 text-xs"
                    >
                      {recalculating === day.date ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Recalculando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Recalcular
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {/* Contribuições por Ativo */}
              {day.hasContributions ? (
                <div>
                  <h4 className="text-sm font-semibold mb-3">Contribuições por Ativo</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground">Ativo</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground">Contribuição</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.contributions.map((contrib) => (
                          <tr key={contrib.ticker} className="border-b last:border-0">
                            <td className="py-2 px-2 font-medium">{contrib.ticker}</td>
                            <td className={`text-right py-2 px-2 font-semibold ${getChangeColor(contrib.contribution)}`}>
                              {formatPercent(contrib.contribution)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Contribuições não disponíveis para este dia
                </div>
              )}

              {/* Pontos */}
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">Pontos: {day.points.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

