'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { Search, X, Plus, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Company {
  ticker: string
  name: string
  assetType?: string
}

interface RadarTickerInputProps {
  currentTickers: string[]
  onTickersChange: (tickers: string[]) => void
  onSave: (tickers: string[]) => Promise<void>
  className?: string
  assetTypeFilter?: string
}

const FREE_TICKER_LIMIT = 3

export function RadarTickerInput({
  currentTickers,
  onTickersChange,
  onSave,
  className,
  assetTypeFilter,
}: RadarTickerInputProps) {
  const [query, setQuery] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const { isPremium } = usePremiumStatus()
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const tickerLimit = isPremium ? Infinity : FREE_TICKER_LIMIT

  // Buscar empresas (com atraso de 300 ms enquanto a pessoa digita)
  useEffect(() => {
    const searchQuery = query.trim()
    if (searchQuery.length < 1) {
      setCompanies([])
      setShowResults(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/search-companies?q=${encodeURIComponent(searchQuery)}`)
        if (response.ok) {
          const data = await response.json()
          // Filtrar por tipo de ativo e tickers já adicionados
          const filtered = data.companies.filter((c: Company) => {
            if (assetTypeFilter && c.assetType !== assetTypeFilter) return false
            return !currentTickers.includes(c.ticker.toUpperCase())
          })
          setCompanies(filtered)
          setShowResults(true)
        }
      } catch (error) {
        console.error('Erro ao buscar empresas:', error)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, assetTypeFilter, currentTickers])

  const handleAddTicker = (ticker: string) => {
    const tickerUpper = ticker.toUpperCase()
    
    if (currentTickers.includes(tickerUpper)) {
      toast({
        title: 'Ticker já adicionado',
        description: `${tickerUpper} já está no seu radar.`,
      })
      return
    }

    if (currentTickers.length >= tickerLimit) {
      toast({
        title: 'Limite atingido',
        description: `No plano gratuito, o radar tem até ${tickerLimit} tickers. Com o Premium, não há limite.`,
        variant: 'destructive',
      })
      return
    }

    onTickersChange([...currentTickers, tickerUpper])
    setQuery('')
    setShowResults(false)
  }

  const handleRemoveTicker = (ticker: string) => {
    onTickersChange(currentTickers.filter(t => t !== ticker))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await onSave(currentTickers)
      toast({
        title: 'Radar salvo',
        description: 'Seu radar foi salvo com sucesso.',
      })
    } catch (error) {
      toast({
        title: 'Não foi possível salvar o radar',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Fechar resultados ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Input de busca */}
      <div className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={assetTypeFilter === 'ETF' ? 'Buscar ETF (ex.: BOVA11, IVVB11)' : 'Buscar ticker (ex.: PETR4, VALE3)'}
            aria-label={assetTypeFilter === 'ETF' ? 'Buscar ETF' : 'Buscar ticker'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (companies.length > 0) {
                setShowResults(true)
              }
            }}
            className="pl-10"
          />
        </div>

        {/* Resultados da busca */}
        {showResults && (companies.length > 0 || loading) && (
          <div
            ref={resultsRef}
            className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-md"
          >
            {loading ? (
              <div role="status" className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                Buscando
              </div>
            ) : (
              <div className="p-1">
                {companies.slice(0, 10).map((company) => (
                  <button
                    key={company.ticker}
                    type="button"
                    onClick={() => handleAddTicker(company.ticker)}
                    className="group flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{company.ticker}</span>
                      <span className="block truncate text-xs text-muted-foreground">{company.name}</span>
                    </span>
                    <Plus className="ml-2 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista de tickers adicionados */}
      {currentTickers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground tabular-nums">
              {currentTickers.length}
              {!isPremium && `/${tickerLimit}`} {currentTickers.length === 1 ? 'ticker' : 'tickers'} no radar
            </span>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
              {saving ? 'Salvando…' : 'Salvar radar'}
            </Button>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Tickers no radar">
            {currentTickers.map((ticker) => (
              <li
                key={ticker}
                className="inline-flex h-11 items-center rounded-md border border-border bg-card pl-3 text-sm font-medium text-foreground md:h-9"
              >
                {ticker}
                <button
                  type="button"
                  onClick={() => handleRemoveTicker(ticker)}
                  className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none md:size-9"
                  aria-label={`Remover ${ticker}`}
                >
                  <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Aviso de limite */}
      {!isPremium && currentTickers.length >= tickerLimit && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Limite de {tickerLimit} tickers do plano gratuito atingido. Com o Premium, não há limite.
          </p>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="/planos">Ver planos</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

