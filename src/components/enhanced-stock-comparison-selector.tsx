'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTracking } from '@/hooks/use-tracking'
import { useEngagementPixel } from '@/hooks/use-engagement-pixel'
import { EventType } from '@/lib/tracking-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CompanyLogo } from '@/components/company-logo'
import { X, Search, Plus, Loader2 } from 'lucide-react'

interface Company {
  id: number
  ticker: string
  name: string
  sector: string | null
  logoUrl: string | null
}

interface EnhancedStockComparisonSelectorProps {
  initialTickers?: string[]
}

const MAX_STOCKS = 6

export function EnhancedStockComparisonSelector({ initialTickers = [] }: EnhancedStockComparisonSelectorProps) {
  const [selectedCompanies, setSelectedCompanies] = useState<Company[]>([])
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { trackEvent } = useTracking()
  const { trackEngagement } = useEngagementPixel()

  // Marcar que o usuário usou o comparador
  useEffect(() => {
    try {
      localStorage.setItem('has_used_comparator', 'true')
    } catch {
      // armazenamento indisponível (janela anônima, bloqueio): sem efeito na página
    }
  }, [])

  // Pré-seleciona os tickers iniciais
  useEffect(() => {
    if (!initialTickers.length) return
    const load = async () => {
      const fetched: Company[] = []
      for (const t of initialTickers.slice(0, MAX_STOCKS)) {
        try {
          const res = await fetch(`/api/search-companies?q=${encodeURIComponent(t)}`)
          if (!res.ok) continue
          const { companies } = await res.json()
          const match = (companies as Company[] | undefined)?.find((c) => c.ticker === t.toUpperCase())
          if (match) fetched.push(match)
        } catch {
          // ignora ticker que falhou; o usuário pode adicioná-lo pela busca
        }
      }
      setSelectedCompanies(fetched)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Busca com debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 1) {
        searchCompanies(query.trim())
      } else {
        setSearchResults([])
        setShowResults(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fecha a lista ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchCompanies = async (searchQuery: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/search-companies?q=${encodeURIComponent(searchQuery)}`)

      if (response.ok) {
        const data = await response.json()
        // Remove empresas já selecionadas
        const filtered = data.companies.filter(
          (c: Company) => !selectedCompanies.some(selected => selected.ticker === c.ticker)
        )
        setSearchResults(filtered)
        setShowResults(true)
        setSelectedIndex(-1)
      }
    } catch (error) {
      console.error('Erro ao buscar empresas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompanySelect = (company: Company) => {
    if (selectedCompanies.length < MAX_STOCKS) {
      setSelectedCompanies([...selectedCompanies, company])
      setQuery('')
      setShowResults(false)
      setSearchResults([])
      setSelectedIndex(-1)
      inputRef.current?.focus()
    }
  }

  const handleRemove = (ticker: string) => {
    setSelectedCompanies(selectedCompanies.filter(c => c.ticker !== ticker))
  }

  const handleCompare = () => {
    if (selectedCompanies.length >= 2) {
      const tickers = selectedCompanies.map(c => c.ticker)

      trackEvent(EventType.COMPARISON_STARTED, undefined, {
        tickerCount: tickers.length,
        tickers: tickers,
      })

      // Pixel de engajamento (apenas deslogados, uma vez por sessão)
      trackEngagement()

      router.push(`/compara-acoes/${tickers.map((t) => t.toLowerCase()).join('/')}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || searchResults.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          handleCompanySelect(searchResults[selectedIndex])
        }
        break
      case 'Escape':
        setShowResults(false)
        setSelectedIndex(-1)
        break
    }
  }

  const canAddMore = selectedCompanies.length < MAX_STOCKS
  const canCompare = selectedCompanies.length >= 2
  const count = selectedCompanies.length

  return (
    <section
      id="comparador"
      className="scroll-mt-24 rounded-lg border border-border bg-card p-4 sm:p-5"
      aria-labelledby="stock-selector-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="stock-selector-title" className="text-lg font-semibold tracking-tight text-foreground">
            Selecione as ações
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            De 2 a 6 empresas. Do mesmo setor, a comparação fica mais útil.
          </p>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {count}/{MAX_STOCKS}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <Input
            ref={inputRef}
            type="text"
            placeholder={canAddMore ? 'Buscar por ticker ou nome (ex.: VALE3, Vale)' : 'Limite de 6 ações atingido'}
            aria-label="Buscar ação por ticker ou nome"
            role="combobox"
            aria-expanded={showResults && searchResults.length > 0}
            aria-controls="stock-selector-results"
            aria-autocomplete="list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.trim().length >= 1 && searchResults.length > 0 && setShowResults(true)}
            disabled={!canAddMore}
            className="pl-9 pr-10"
          />
          {loading && (
            <Loader2
              className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              strokeWidth={1.75}
              aria-label="Buscando"
            />
          )}

          {showResults && searchResults.length > 0 && (
            <div
              ref={resultsRef}
              id="stock-selector-results"
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover shadow-md"
            >
              {searchResults.map((company, index) => (
                <button
                  key={company.ticker}
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  onClick={() => handleCompanySelect(company)}
                  className={`flex min-h-11 w-full items-center gap-3 border-b border-border px-3 py-2 text-left transition-colors last:border-0 hover:bg-accent ${
                    index === selectedIndex ? 'bg-accent' : ''
                  }`}
                >
                  <CompanyLogo ticker={company.ticker} companyName={company.name} logoUrl={company.logoUrl} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{company.ticker}</span>
                      {company.sector && (
                        <Badge variant="neutral" className="hidden sm:inline-flex">
                          {company.sector}
                        </Badge>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{company.name}</span>
                  </span>
                  <Plus className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        {count > 0 ? (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Ações selecionadas">
            {selectedCompanies.map((company) => (
              <li
                key={company.ticker}
                className="flex min-w-0 items-center gap-3 rounded-md border border-border bg-background py-2 pl-3 pr-1"
              >
                <CompanyLogo ticker={company.ticker} companyName={company.name} logoUrl={company.logoUrl} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{company.ticker}</span>
                  <span className="block truncate text-xs text-muted-foreground">{company.name}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(company.ticker)}
                  aria-label={`Remover ${company.ticker}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhuma ação selecionada. Use a busca acima para adicionar.
          </p>
        )}

        <Button type="button" onClick={handleCompare} disabled={!canCompare} className="w-full sm:w-auto">
          {count === 0 && 'Adicione 2 ações para comparar'}
          {count === 1 && 'Adicione mais 1 ação'}
          {count >= 2 && `Comparar ${count} ações`}
        </Button>
      </div>
    </section>
  )
}
