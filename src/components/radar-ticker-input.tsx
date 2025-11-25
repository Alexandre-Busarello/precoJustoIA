'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { Search, X, Plus, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Company {
  ticker: string
  name: string
}

interface RadarTickerInputProps {
  currentTickers: string[]
  onTickersChange: (tickers: string[]) => void
  onSave: (tickers: string[]) => Promise<void>
  className?: string
}

const FREE_TICKER_LIMIT = 3

export function RadarTickerInput({
  currentTickers,
  onTickersChange,
  onSave,
  className,
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

  // Buscar empresas
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 1) {
        searchCompanies(query.trim())
      } else {
        setCompanies([])
        setShowResults(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const searchCompanies = async (searchQuery: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/search-companies?q=${encodeURIComponent(searchQuery)}`)
      
      if (response.ok) {
        const data = await response.json()
        // Filtrar apenas tickers que ainda não foram adicionados
        const filtered = data.companies.filter(
          (c: Company) => !currentTickers.includes(c.ticker.toUpperCase())
        )
        setCompanies(filtered)
        setShowResults(true)
      }
    } catch (error) {
      console.error('Erro ao buscar empresas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTicker = (ticker: string) => {
    const tickerUpper = ticker.toUpperCase()
    
    if (currentTickers.includes(tickerUpper)) {
      toast({
        title: 'Ticker já adicionado',
        description: `${tickerUpper} já está no seu radar.`,
        variant: 'destructive',
      })
      return
    }

    if (currentTickers.length >= tickerLimit) {
      toast({
        title: 'Limite atingido',
        description: `Você pode adicionar até ${tickerLimit} tickers${isPremium ? '' : '. Faça upgrade para Premium para adicionar tickers ilimitados.'}`,
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
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar o radar.',
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Buscar ticker (ex: PETR4, VALE3)..."
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
            className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto"
          >
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                Buscando...
              </div>
            ) : (
              <div className="p-1">
                {companies.slice(0, 10).map((company) => (
                  <button
                    key={company.ticker}
                    onClick={() => handleAddTicker(company.ticker)}
                    className="w-full text-left px-3 py-2 hover:bg-accent rounded-sm flex items-center justify-between group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{company.ticker}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {company.name}
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 ml-2" />
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
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Tickers no radar ({currentTickers.length}
              {!isPremium && `/${tickerLimit}`})
            </span>
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              variant="outline"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                'Salvar Radar'
              )}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentTickers.map((ticker) => (
              <Badge
                key={ticker}
                variant="secondary"
                className="px-3 py-1 text-sm"
              >
                {ticker}
                <button
                  onClick={() => handleRemoveTicker(ticker)}
                  className="ml-2 hover:text-destructive"
                  aria-label={`Remover ${ticker}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Aviso de limite */}
      {!isPremium && currentTickers.length >= tickerLimit && (
        <div className="bg-muted p-4 rounded-lg border border-primary/20">
          <p className="text-sm text-muted-foreground mb-3">
            Limite de {tickerLimit} tickers atingido. Faça upgrade para Premium para adicionar tickers ilimitados.
          </p>
          <Button asChild size="sm" className="w-full">
            <Link href="/checkout">
              Fazer Upgrade Premium
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}

