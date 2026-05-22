'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CompanyLogo } from '@/components/company-logo'
import { BarChart3, X, Search, Plus, ArrowRight } from 'lucide-react'

interface EtfCompany {
  id: number
  ticker: string
  name: string
  logoUrl: string | null
}

interface EtfComparisonSelectorProps {
  initialTickers?: string[]
}

export function EtfComparisonSelector({ initialTickers = [] }: EtfComparisonSelectorProps) {
  const [selected, setSelected] = useState<EtfCompany[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EtfCompany[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Dismiss dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 1) search(query.trim())
      else { setResults([]); setShowResults(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Pre-select initial tickers
  useEffect(() => {
    if (!initialTickers.length) return
    const load = async () => {
      const fetched: EtfCompany[] = []
      for (const t of initialTickers.slice(0, 6)) {
        const res = await fetch(`/api/search-companies?q=${t}`)
        if (!res.ok) continue
        const { companies } = await res.json()
        const etf = companies?.find(
          (c: { ticker: string; assetType: string }) =>
            c.ticker === t.toUpperCase() && c.assetType === 'ETF'
        )
        if (etf) fetched.push(etf)
      }
      setSelected(fetched)
    }
    load()
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function search(q: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/search-companies?q=${encodeURIComponent(q)}`)
      if (!res.ok) return
      const { companies } = await res.json()
      const etfs = (companies ?? []).filter(
        (c: { assetType: string }) => c.assetType === 'ETF'
      )
      setResults(etfs)
      setShowResults(true)
    } finally {
      setLoading(false)
    }
  }

  function add(company: EtfCompany) {
    if (selected.length >= 6) return
    if (selected.some((s) => s.ticker === company.ticker)) return
    setSelected((prev) => [...prev, company])
    setQuery('')
    setShowResults(false)
  }

  function remove(ticker: string) {
    setSelected((prev) => prev.filter((s) => s.ticker !== ticker))
  }

  function compare() {
    if (selected.length < 2) return
    router.push(`/compara-etfs/${selected.map((s) => s.ticker.toLowerCase()).join('/')}`)
  }

  return (
    <Card className="border-2 border-teal-200 dark:border-teal-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <BarChart3 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          Comparador de ETFs
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Selecione de 2 a 6 ETFs para comparar lado a lado
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected ETFs */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map((etf) => (
              <div
                key={etf.ticker}
                className="flex items-center gap-2 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-lg px-3 py-1.5"
              >
                <CompanyLogo ticker={etf.ticker} companyName={etf.name} logoUrl={etf.logoUrl} size={24} />
                <span className="text-sm font-semibold">{etf.ticker}</span>
                <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[100px]">{etf.name}</span>
                <button
                  onClick={() => remove(etf.ticker)}
                  className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search input */}
        {selected.length < 6 && (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar ETF por código (ex: BOVA11, IVVB11...)"
                className="pl-9"
                onFocus={() => results.length > 0 && setShowResults(true)}
              />
            </div>
            {showResults && results.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-lg shadow-xl max-h-64 overflow-y-auto"
              >
                {results.map((etf) => {
                  const isSelected = selected.some((s) => s.ticker === etf.ticker)
                  return (
                    <button
                      key={etf.ticker}
                      onClick={() => add(etf)}
                      disabled={isSelected || selected.length >= 6}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <CompanyLogo ticker={etf.ticker} companyName={etf.name} logoUrl={etf.logoUrl} size={24} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{etf.ticker}</div>
                        <div className="text-xs text-muted-foreground truncate">{etf.name}</div>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 text-teal-700 dark:text-teal-300 border-teal-300">ETF</Badge>
                      {isSelected && <span className="text-xs text-teal-600">Adicionado</span>}
                      {!isSelected && <Plus className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  )
                })}
              </div>
            )}
            {showResults && !loading && results.length === 0 && query.length >= 1 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-lg shadow-xl p-4 text-sm text-muted-foreground text-center">
                Nenhum ETF encontrado para &quot;{query}&quot;
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-muted-foreground">
            {selected.length < 2
              ? `Adicione mais ${2 - selected.length} ETF${2 - selected.length > 1 ? 's' : ''} para comparar`
              : `${selected.length} ETF${selected.length > 1 ? 's' : ''} selecionado${selected.length > 1 ? 's' : ''}`}
          </span>
          <Button
            onClick={compare}
            disabled={selected.length < 2}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
          >
            Comparar
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
