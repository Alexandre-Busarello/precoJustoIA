'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Minus, RefreshCw, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useAdminStatus } from '@/hooks/use-admin-status'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import Link from 'next/link'

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
  const [currentPage, setCurrentPage] = useState(1)
  const [isMobile, setIsMobile] = useState(false)
  const { isAdmin } = useAdminStatus()
  const { isPremium } = usePremiumStatus()

  // Configuração de paginação
  const ITEMS_PER_PAGE = 10 // Desktop: 10 itens por página
  const ITEMS_PER_PAGE_MOBILE = 5 // Mobile: 5 itens por página

  // Detectar tamanho da tela
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    // Verificar no mount
    checkMobile()
    
    // Adicionar listener para resize
    window.addEventListener('resize', checkMobile)
    
    // Limpar listener ao desmontar
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Resetar para página 1 quando mudar de mobile para desktop ou vice-versa
  useEffect(() => {
    setCurrentPage(1)
  }, [isMobile])

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
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Visão Diária</span>
            {!isPremium && (
              <Badge variant="outline" className="text-xs">
                <Lock className="h-3 w-3 mr-1" />
                Premium
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    )
  }

  // Calcular paginação após dados carregados
  const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE
  const totalPages = Math.ceil(data.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedData = isPremium ? data.slice(startIndex, endIndex) : data.slice(startIndex, endIndex)
  const visibleData = paginatedData
  const shouldBlur = !isPremium

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Visão Diária</span>
          {!isPremium && (
            <Badge variant="outline" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Banner de Upgrade - Topo */}
          {!isPremium && visibleData.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">Desbloqueie a Visão Diária Completa</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Veja todos os {data.length} dias de histórico com detalhes completos de contribuições por ativo sem blur.
                  </p>
                  <Button asChild size="sm" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700">
                    <Link href="/checkout">
                      Fazer Upgrade para Premium
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {visibleData.map((day) => (
            <Card 
              key={day.date} 
              className={`overflow-hidden ${shouldBlur ? 'relative' : ''}`}
              style={shouldBlur ? { filter: 'blur(4px)', pointerEvents: 'none' } : {}}
            >
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

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Mostrando {startIndex + 1} a {Math.min(endIndex, data.length)} de {data.length} dias
              </p>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-9 px-3"
                >
                  <ChevronLeft className="h-4 w-4 mr-1 sm:mr-0" />
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                
                {/* Números de página - mostrar apenas em desktop */}
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Mostrar primeira página, última página, página atual e páginas adjacentes
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="h-9 w-9 p-0"
                        >
                          {page}
                        </Button>
                      )
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <span key={page} className="px-2 text-muted-foreground">
                          ...
                        </span>
                      )
                    }
                    return null
                  })}
                </div>
                
                {/* Indicador de página atual em mobile */}
                <div className="sm:hidden text-sm text-muted-foreground px-2">
                  {currentPage} / {totalPages}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="h-9 px-3"
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <ChevronRight className="h-4 w-4 ml-1 sm:ml-0" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

