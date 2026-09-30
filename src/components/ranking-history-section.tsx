'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, RefreshCw, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionHeader } from '@/components/ui/section-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/format'
import { RANKING_MODELS, rankingModelLabel } from '@/lib/ranking-models'

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

const ITEMS_PER_PAGE = 5
const MAX_PAGES = 10
const MAX_ITEMS = MAX_PAGES * ITEMS_PER_PAGE

const MODEL_FILTERS = [
  { value: 'all', label: 'Todos os modelos' },
  ...RANKING_MODELS.map((model) => ({ value: model.key, label: model.label })),
  { value: 'screening', label: rankingModelLabel('screening') },
]

const UNIVERSE_LABEL: Record<NonNullable<RankingHistoryItem['assetTypeFilter']>, string> = {
  b3: 'B3',
  bdr: 'BDR',
  both: 'B3 e BDR',
}

function assetNoun(model: string, count: number): string {
  const plural = count !== 1
  if (model.startsWith('etfs-')) return plural ? 'ETFs' : 'ETF'
  if (model.startsWith('fii')) return plural ? 'FIIs' : 'FII'
  return plural ? 'ativos' : 'ativo'
}

/** Histórico de rankings do usuário. Usado na aba Histórico de /ranking e no dashboard. */
export function RankingHistorySection({ onLoadRanking, refreshTrigger }: RankingHistorySectionProps) {
  const router = useRouter()
  const [history, setHistory] = useState<RankingHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedModel, setSelectedModel] = useState('all')

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true)
      setError(false)
      const params = new URLSearchParams({ page: '1', limit: MAX_ITEMS.toString() })
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (selectedModel !== 'all') params.append('model', selectedModel)

      const response = await fetch(`/api/ranking-history?${params.toString()}`)
      if (response.status === 401) {
        setHistory([])
        setTotalCount(0)
        return
      }
      if (!response.ok) throw new Error('Erro ao carregar histórico')
      const data = await response.json()
      setHistory(data.history || [])
      setTotalCount(data.totalCount || 0)
    } catch (err) {
      console.error('Erro ao carregar histórico:', err)
      setHistory([])
      setTotalCount(0)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedModel])

  useEffect(() => {
    loadHistory()
  }, [loadHistory, refreshTrigger])

  const hasActiveFilters = !!startDate || !!endDate || selectedModel !== 'all'
  const activeFilterCount = [startDate, endDate, selectedModel !== 'all' ? selectedModel : ''].filter(Boolean).length
  const totalPages = Math.max(1, Math.ceil(history.length / ITEMS_PER_PAGE))
  const page = Math.min(currentPage, totalPages)
  const startIndex = (page - 1) * ITEMS_PER_PAGE
  const currentItems = history.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedModel('all')
    setCurrentPage(1)
  }

  const openRanking = (id: string) => {
    if (onLoadRanking) onLoadRanking(id)
    else router.push(`/ranking?id=${id}`)
  }

  const header = (
    <SectionHeader
      title="Histórico de rankings"
      description={
        loading
          ? 'Carregando…'
          : totalCount > 0
            ? `${totalCount} ${totalCount === 1 ? 'ranking salvo' : 'rankings salvos'}`
            : 'Os rankings que você gera ficam salvos aqui.'
      }
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters((open) => !open)}
            aria-expanded={showFilters}
            aria-controls="ranking-history-filters"
          >
            <SlidersHorizontal className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Button>
          <Button variant="ghost" size="sm" onClick={loadHistory} disabled={loading} aria-label="Atualizar histórico">
            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </>
      }
    />
  )

  return (
    <div className="space-y-4">
      {header}

      {showFilters && (
        <div id="ranking-history-filters" className="grid gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="ranking-history-start">Data inicial</Label>
            <Input
              id="ranking-history-start"
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ranking-history-end">Data final</Label>
            <Input
              id="ranking-history-end"
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ranking-history-model">Modelo</Label>
            <Select
              value={selectedModel}
              onValueChange={(value) => {
                setSelectedModel(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger id="ranking-history-model" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <div className="flex items-center justify-between gap-3 md:col-span-3">
              <p className="text-sm text-muted-foreground tabular-nums">
                {totalCount} {totalCount === 1 ? 'resultado' : 'resultados'}
              </p>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card" aria-label="Carregando histórico">
          {[0, 1, 2].map((index) => (
            <li key={index} className="space-y-2 px-4 py-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-negative">Não foi possível carregar o histórico.</p>
          <Button variant="outline" size="sm" onClick={loadHistory}>
            Tentar novamente
          </Button>
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            {hasActiveFilters ? 'Nenhum ranking com estes filtros' : 'Nenhum ranking gerado ainda'}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {hasActiveFilters
              ? 'Ajuste as datas ou o modelo para encontrar rankings salvos.'
              : 'Cada ranking que você gerar fica salvo aqui com os parâmetros usados.'}
          </p>
          <div className="mt-4 flex justify-center">
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/ranking">Gerar ranking</Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {currentItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openRanking(item.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                >
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {rankingModelLabel(item.model) === item.model ? item.modelName : rankingModelLabel(item.model)}
                      </span>
                      {item.assetTypeFilter && !item.model.startsWith('etfs-') && !item.model.startsWith('fii') && (
                        <Badge variant="neutral">{UNIVERSE_LABEL[item.assetTypeFilter]}</Badge>
                      )}
                    </span>
                    {item.description && <span className="block truncate text-xs text-muted-foreground">{item.description}</span>}
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {item.resultCount} {assetNoun(item.model, item.resultCount)} · {formatDate(item.createdAt, { style: 'relative' })}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                  <span className="sr-only">Abrir ranking</span>
                </button>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav aria-label="Páginas do histórico" className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground tabular-nums">
                {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, history.length)} de {history.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(page - 1)} disabled={page === 1}>
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {page}/{totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(page + 1)} disabled={page === totalPages}>
                  Próxima
                </Button>
              </div>
            </nav>
          )}

          {totalCount > MAX_ITEMS && (
            <p className="text-sm text-muted-foreground">
              Mostrando os {MAX_ITEMS} rankings mais recentes. Use os filtros para encontrar os mais antigos.
            </p>
          )}
        </>
      )}
    </div>
  )
}
