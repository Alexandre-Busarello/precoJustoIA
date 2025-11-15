'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Clock,
  TrendingUp,
  ChevronRight,
  Sparkles,
  Target,
  Calculator,
  Brain,
  DollarSign,
  PieChart,
  BarChart3,
  RefreshCw,
  Filter,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface RankingHistoryItem {
  id: string
  model: string
  modelName: string
  description: string
  resultCount: number
  createdAt: string
  assetTypeFilter?: 'b3' | 'bdr' | 'both'
}

interface RankingHistorySectionProps {
  onLoadRanking?: (id: string) => void
  refreshTrigger?: number // Quando este valor mudar, o histórico será recarregado
}

const modelIcons: Record<string, any> = {
  'ai': Brain,
  'graham': Target,
  'fundamentalist': BarChart3,
  'fcd': Calculator,
  'lowPE': BarChart3,
  'magicFormula': PieChart,
  'dividendYield': DollarSign,
  'gordon': DollarSign,
  'screening': Sparkles,
}

const modelColors: Record<string, string> = {
  'ai': 'from-purple-500 to-pink-500',
  'graham': 'from-blue-500 to-cyan-500',
  'fundamentalist': 'from-green-500 to-emerald-500',
  'fcd': 'from-orange-500 to-red-500',
  'lowPE': 'from-indigo-500 to-purple-500',
  'magicFormula': 'from-yellow-500 to-orange-500',
  'dividendYield': 'from-green-600 to-teal-600',
  'gordon': 'from-violet-500 to-purple-500',
  'screening': 'from-amber-500 to-yellow-500',
}

const modelOptions = [
  { value: 'all', label: 'Todos os Modelos' },
  { value: 'graham', label: 'Fórmula de Graham' },
  { value: 'fcd', label: 'Fluxo de Caixa Descontado' },
  { value: 'gordon', label: 'Fórmula de Gordon' },
  { value: 'dividendYield', label: 'Dividend Yield' },
  { value: 'lowPE', label: 'Value Investing' },
  { value: 'magicFormula', label: 'Fórmula Mágica' },
  { value: 'fundamentalist', label: 'Fundamentalista 3+1' },
  { value: 'ai', label: '🤖 IA Premium' },
  { value: 'screening', label: 'Screening' },
]

export function RankingHistorySection({ onLoadRanking, refreshTrigger }: RankingHistorySectionProps) {
  const [history, setHistory] = useState<RankingHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  
  // Estados dos filtros
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedModel, setSelectedModel] = useState('all')
  
  const router = useRouter()
  
  const ITEMS_PER_PAGE = 5
  const MAX_PAGES = 10 // Limite de 10 páginas
  const MAX_ITEMS = MAX_PAGES * ITEMS_PER_PAGE // 50 itens no total

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true)
      
      // Construir URL com query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: MAX_ITEMS.toString()
      })
      
      if (startDate) {
        params.append('startDate', startDate)
      }
      if (endDate) {
        params.append('endDate', endDate)
      }
      if (selectedModel && selectedModel !== 'all') {
        params.append('model', selectedModel)
      }
      
      const response = await fetch(`/api/ranking-history?${params.toString()}`)
      
      if (!response.ok) {
        if (response.status === 401) {
          // Não mostrar erro para usuários não autenticados
          setHistory([])
          return
        }
        throw new Error('Erro ao carregar histórico')
      }

      const data = await response.json()
      setHistory(data.history || [])
      setTotalCount(data.totalCount || 0)
    } catch (err) {
      console.error('Erro ao carregar histórico:', err)
      setHistory([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [currentPage, startDate, endDate, selectedModel, MAX_ITEMS])
  
  useEffect(() => {
    loadHistory()
  }, [loadHistory, refreshTrigger])
  
  const handleClearFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedModel('all')
    setCurrentPage(1)
  }
  
  const hasActiveFilters = startDate || endDate || (selectedModel && selectedModel !== 'all')
  
  // Calcular itens da página atual
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentItems = history.slice(startIndex, endIndex)
  const displayTotalPages = Math.ceil(history.length / ITEMS_PER_PAGE)

  const handleLoadRanking = (id: string) => {
    if (onLoadRanking) {
      onLoadRanking(id)
    } else {
      // Navegar para a página de ranking com o ID
      router.push(`/ranking?id=${id}`)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Histórico de Rankings
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 border rounded-lg animate-pulse">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
                <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (history.length === 0 && !hasActiveFilters) {
    return (
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            Histórico de Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
              Nenhum ranking gerado ainda
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Seus rankings serão salvos automaticamente e aparecerão aqui
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const element = document.getElementById('ranking-generator')
                element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              Gerar Primeiro Ranking
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Histórico de Rankings</span>
              <Badge variant="secondary">{totalCount}</Badge>
              {totalCount > MAX_ITEMS && (
                <Badge variant="outline" className="text-xs">
                  {MAX_ITEMS}+ resultados
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filtros</span>
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {hasActiveFilters && <Badge variant="default" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">!</Badge>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadHistory}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
            </div>
          </div>
          
          {/* Filtros */}
          {showFilters && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date" className="text-sm">Data Inicial</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date" className="text-sm">Data Final</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model" className="text-sm">Modelo</Label>
                  <Select value={selectedModel} onValueChange={(value) => {
                    setSelectedModel(value)
                    setCurrentPage(1)
                  }}>
                    <SelectTrigger id="model" className="h-9">
                      <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {hasActiveFilters && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {totalCount} resultado{totalCount !== 1 ? 's' : ''} encontrado{totalCount !== 1 ? 's' : ''}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="gap-2"
                  >
                    <X className="w-4 h-4" />
                    Limpar Filtros
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 0 && hasActiveFilters ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Filter className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
              Nenhum resultado encontrado
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Tente ajustar os filtros para encontrar rankings
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Limpar Filtros
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {currentItems.map((item) => {
                const Icon = modelIcons[item.model] || Target
                const colorGradient = modelColors[item.model] || 'from-gray-500 to-gray-600'
                
                return (
                  <div
                    key={item.id}
                    className="group relative flex items-center gap-3 p-3 border rounded-lg hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-pointer bg-white dark:bg-slate-900"
                    onClick={() => handleLoadRanking(item.id)}
                  >
                    {/* Ícone do Modelo */}
                    <div className={`w-12 h-12 bg-gradient-to-br ${colorGradient} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    {/* Informações */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {item.modelName}
                        </h4>
                        {item.model === 'ai' && (
                          <Sparkles className="w-3 h-3 text-purple-500 flex-shrink-0" />
                        )}
                        {/* Badge de tipo de ativo */}
                        {item.assetTypeFilter && item.assetTypeFilter !== 'both' && (
                          <Badge 
                            variant={item.assetTypeFilter === 'bdr' ? 'default' : 'secondary'}
                            className={`text-xs flex-shrink-0 ${
                              item.assetTypeFilter === 'bdr' 
                                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            {item.assetTypeFilter === 'bdr' ? '🌎 BDR' : '🇧🇷 B3'}
                          </Badge>
                        )}
                        {item.assetTypeFilter === 'both' && (
                          <Badge 
                            variant="outline"
                            className="text-xs flex-shrink-0 border-blue-300 text-blue-700 dark:text-blue-400"
                          >
                            🌍 Ambos
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {item.resultCount} {item.resultCount === 1 ? 'ação' : 'ações'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(item.createdAt), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Botão de Ação */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLoadRanking(item.id)
                      }}
                    >
                      <span className="hidden sm:inline">Abrir</span>
                      <ChevronRight className="w-4 h-4 sm:ml-2" />
                    </Button>
                  </div>
                )
              })}
            </div>

            {/* Paginação */}
            {displayTotalPages > 1 && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {startIndex + 1}-{Math.min(endIndex, history.length)} de {history.length} rankings
                  {totalCount > MAX_ITEMS && <span className="text-xs"> (máximo {MAX_ITEMS} resultados)</span>}
                </div>
                <div className="flex gap-2 items-center w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex-shrink-0"
                  >
                    Anterior
                  </Button>
                  
                  {/* Container com scroll horizontal para botões de página */}
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent px-1 flex-1 sm:flex-initial">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: displayTotalPages }, (_, i) => i + 1).map(page => {
                        // No mobile, mostrar apenas página atual e adjacentes
                        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
                        const showInMobile = !isMobile || Math.abs(page - currentPage) <= 1 || page === 1 || page === displayTotalPages
                        
                        if (!showInMobile) {
                          // Mostrar "..." entre páginas
                          if (page === currentPage - 2 || page === currentPage + 2) {
                            return <span key={page} className="px-2 text-muted-foreground">...</span>
                          }
                          return null
                        }
                        
                        return (
                          <Button
                            key={page}
                            variant={page === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-9 flex-shrink-0"
                          >
                            {page}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(displayTotalPages, prev + 1))}
                    disabled={currentPage === displayTotalPages}
                    className="flex-shrink-0"
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
            
            {/* Aviso quando atingir o limite de páginas */}
            {totalCount > MAX_ITEMS && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Atenção:</strong> Apenas as {MAX_ITEMS} mais recentes resultados são exibidas ({MAX_PAGES} páginas).
                  Use os filtros acima para buscar rankings mais antigos.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
