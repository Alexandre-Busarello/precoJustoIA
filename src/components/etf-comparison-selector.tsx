'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CompanyLogo } from '@/components/company-logo'
import { X, Search, Plus } from 'lucide-react'

interface EtfCompany {
  id: number
  ticker: string
  name: string
  logoUrl: string | null
}

interface EtfComparisonSelectorProps {
  initialTickers?: string[]
  /** Título do bloco (padrão: "Selecione os ETFs"). */
  title?: string
}

const MAX_ETFS = 6

export function EtfComparisonSelector({ initialTickers = [], title = 'Selecione os ETFs' }: EtfComparisonSelectorProps) {
  const [selected, setSelected] = useState<EtfCompany[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EtfCompany[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Fecha a lista ao clicar fora
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

  // Busca com debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 1) search(query.trim())
      else { setResults([]); setShowResults(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Pré-seleciona os tickers iniciais
  useEffect(() => {
    if (!initialTickers.length) return
    const load = async () => {
      const fetched: EtfCompany[] = []
      for (const t of initialTickers.slice(0, MAX_ETFS)) {
        const res = await fetch(`/api/search-companies?q=${encodeURIComponent(t)}`)
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
    if (selected.length >= MAX_ETFS) return
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

  const missing = 2 - selected.length

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5" aria-labelledby="etf-selector-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="etf-selector-title" className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">De 2 a 6 ETFs, pelo código (ex.: BOVA11, IVVB11).</p>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {selected.length}/{MAX_ETFS}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {selected.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="ETFs selecionados">
            {selected.map((etf) => (
              <li
                key={etf.ticker}
                className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-background py-1 pl-2 pr-1"
              >
                <CompanyLogo ticker={etf.ticker} companyName={etf.name} logoUrl={etf.logoUrl} size={24} />
                <span className="text-sm font-medium text-foreground">{etf.ticker}</span>
                <span className="hidden max-w-[120px] truncate text-xs text-muted-foreground sm:block">{etf.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(etf.ticker)}
                  aria-label={`Remover ${etf.ticker}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {selected.length < MAX_ETFS && (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ETF por código"
              aria-label="Buscar ETF por código"
              className="pl-9"
              onFocus={() => results.length > 0 && setShowResults(true)}
            />
            {showResults && results.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-md"
              >
                {results.map((etf) => {
                  const isSelected = selected.some((s) => s.ticker === etf.ticker)
                  return (
                    <button
                      key={etf.ticker}
                      type="button"
                      onClick={() => add(etf)}
                      disabled={isSelected || selected.length >= MAX_ETFS}
                      className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CompanyLogo ticker={etf.ticker} companyName={etf.name} logoUrl={etf.logoUrl} size={24} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{etf.ticker}</span>
                        <span className="block truncate text-xs text-muted-foreground">{etf.name}</span>
                      </span>
                      {isSelected ? (
                        <span className="text-xs text-muted-foreground">Adicionado</span>
                      ) : (
                        <Plus className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            {showResults && !loading && results.length === 0 && query.length >= 1 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover p-4 text-center text-sm text-muted-foreground shadow-md">
                Nenhum ETF encontrado para &quot;{query}&quot;
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {missing > 0
              ? `Adicione mais ${missing} ETF${missing > 1 ? 's' : ''} para comparar`
              : `${selected.length} ETFs selecionados`}
          </span>
          <Button type="button" onClick={compare} disabled={selected.length < 2} className="w-full sm:w-auto">
            Comparar
          </Button>
        </div>
      </div>
    </section>
  )
}
