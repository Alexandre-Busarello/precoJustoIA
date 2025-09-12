"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Clock, 
  BarChart3, 
  RefreshCw, 
  Eye,
  Calendar 
} from "lucide-react"

interface HistoryItem {
  id: string
  model: string
  modelName: string
  params: Record<string, unknown>
  results?: unknown[] | null // Resultados cached
  description: string
  resultCount: number
  createdAt: string
}

interface RankingHistoryProps {
  className?: string
}

export function RankingHistory({ className = "" }: RankingHistoryProps) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reprocessing, setReprocessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('🔍 Frontend: Buscando histórico...')
      
      const response = await fetch('/api/ranking-history')
      const data = await response.json()
      
      console.log('📡 Response status:', response.status)
      console.log('📊 Response data:', data)
      
      if (response.ok) {
        console.log('✅ Histórico recebido:', data.history?.length || 0, 'itens')
        setHistory(data.history || [])
        
        if (!data.history || data.history.length === 0) {
          setError('Nenhum ranking encontrado. Que tal criar seu primeiro ranking?')
        }
      } else {
        console.error('❌ Erro na resposta:', data)
        if (response.status === 401) {
          setError('Sessão expirada. Faça login novamente.')
        } else {
          setError(data.error || `Erro ${response.status}`)
        }
      }
    } catch (networkError) {
      console.error('💥 Erro ao buscar histórico:', networkError)
      setError('Erro de conexão. Verifique sua internet.')
    } finally {
      setLoading(false)
    }
  }

  const handleReprocess = (historyItem: HistoryItem) => {
    try {
      setReprocessing(historyItem.id)
      
      // Salvar parâmetros E resultados no sessionStorage para uso na página de ranking
      const rankingData = {
        model: historyItem.model,
        params: historyItem.params,
        cachedResults: historyItem.results, // Incluir resultados em cache
        resultCount: historyItem.resultCount,
        createdAt: historyItem.createdAt
      }
      
      sessionStorage.setItem('prefillRanking', JSON.stringify(rankingData))
      
      // Redirecionar para a página de ranking
      window.location.href = '/ranking'
    } catch (error) {
      console.error('Erro ao preparar reprocessamento:', error)
    } finally {
      setReprocessing(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getModelBadgeColor = (model: string) => {
    switch (model) {
      case 'graham':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'dividendYield':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'lowPE':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case 'magicFormula':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Últimos Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="space-y-2">
                      <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                  <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (history.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Últimos Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-gray-400" />
            </div>
            {error ? (
              <>
                <h3 className="font-medium mb-2 text-red-600 dark:text-red-400">
                  {error.includes('Sessão') ? 'Erro de Sessão' : 'Erro'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {error}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Recarregar
                </Button>
              </>
            ) : (
              <>
                <h3 className="font-medium mb-2">Nenhum ranking ainda</h3>
                <p className="text-sm text-muted-foreground">
                  Seus rankings gerados aparecerão aqui para fácil acesso
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Últimos Rankings
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchHistory}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-500 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={getModelBadgeColor(item.model)}>
                      {item.modelName}
                    </Badge>
                    <span className="text-sm font-medium">
                      {item.resultCount} empresas
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReprocess(item)}
                  disabled={reprocessing === item.id}
                  className="flex items-center gap-1"
                >
                  {reprocessing === item.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Eye className="w-3 h-3" />
                  )}
                  <span className="text-xs">Ver</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
