'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTracking } from '@/hooks/use-tracking'
import { useEngagementPixel } from '@/hooks/use-engagement-pixel'
import { EventType } from '@/lib/tracking-types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CompanyLogo } from '@/components/company-logo'
import { 
  BarChart3, 
  X, 
  TrendingUp,
  Search,
  Plus,
  ArrowRight,
  CheckCircle2
} from 'lucide-react'

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

  // Marcar que usuário usou o Comparador
  useEffect(() => {
    localStorage.setItem('has_used_comparator', 'true')
  }, [])

  // Debounce search
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
  }, [query])

  // Close dropdown when clicking outside
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
        // Filtrar empresas já selecionadas
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }

  const handleCompanySelect = (company: Company) => {
    if (selectedCompanies.length < 6) {
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
      
      // Track evento de início de comparação
      trackEvent(EventType.COMPARISON_STARTED, undefined, {
        tickerCount: tickers.length,
        tickers: tickers,
      })
      
      // Disparar pixel de engajamento (apenas para usuários deslogados, apenas uma vez por sessão)
      trackEngagement()
      
      router.push(`/compara-acoes/${tickers.join('/')}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || searchResults.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
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

  const canAddMore = selectedCompanies.length < 6
  const canCompare = selectedCompanies.length >= 2

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-xl" id="comparador">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Selecione as Ações para Comparar</span>
          </div>
          <Badge variant={canCompare ? "default" : "secondary"}>
            {selectedCompanies.length}/6
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Search Input with Autocomplete */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Buscar empresa por ticker (ex: VALE3) ou nome (ex: Vale)..."
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => query.trim().length >= 1 && searchResults.length > 0 && setShowResults(true)}
              disabled={!canAddMore}
              className="pl-10 pr-12 py-6 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            {!canAddMore && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Badge variant="secondary" className="text-xs">
                  Máximo atingido
                </Badge>
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div
              ref={resultsRef}
              className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xl max-h-96 overflow-y-auto"
            >
              {searchResults.map((company, index) => (
                <button
                  key={company.ticker}
                  onClick={() => handleCompanySelect(company)}
                  className={`w-full text-left p-4 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                    index === selectedIndex ? 'bg-blue-50 dark:bg-blue-950/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CompanyLogo
                      ticker={company.ticker}
                      companyName={company.name}
                      logoUrl={company.logoUrl}
                      size={40}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {company.ticker}
                        </span>
                        {company.sector && (
                          <Badge variant="outline" className="text-xs">
                            {company.sector}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                        {company.name}
                      </p>
                    </div>
                    <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Companies */}
        {selectedCompanies.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Ações Selecionadas ({selectedCompanies.length})
              </p>
              {selectedCompanies.length >= 2 && (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Pronto para comparar
                </Badge>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedCompanies.map((company) => (
                <div
                  key={company.ticker}
                  className="relative group p-3 border-2 border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all bg-white dark:bg-slate-900"
                >
                  <div className="flex items-center gap-3">
                    <CompanyLogo
                      ticker={company.ticker}
                      companyName={company.name}
                      logoUrl={company.logoUrl}
                      size={48}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {company.ticker}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {company.name}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemove(company.ticker)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label={`Remover ${company.ticker}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
            <Search className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400 font-medium mb-1">
              Nenhuma ação selecionada
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              Use a busca acima para adicionar ações
            </p>
          </div>
        )}

        {/* Compare Button */}
        <Button
          onClick={handleCompare}
          disabled={!canCompare}
          size="lg"
          className="w-full text-base font-semibold py-6"
        >
          <TrendingUp className="w-5 h-5 mr-2" />
          {selectedCompanies.length === 0 && 'Adicione 2+ ações para comparar'}
          {selectedCompanies.length === 1 && 'Adicione mais 1 ação'}
          {selectedCompanies.length >= 2 && `Comparar ${selectedCompanies.length} Ações`}
          {selectedCompanies.length >= 2 && <ArrowRight className="w-5 h-5 ml-2" />}
        </Button>

        {/* Helper Text */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">
              Dica para melhor comparação:
            </p>
            <p className="text-xs text-blue-800 dark:text-blue-200">
              Selecione empresas do mesmo setor para comparação mais relevante. Máximo de 6 ações.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


