'use client'

import { X } from 'lucide-react'
import { AssetSearchInput } from '@/components/asset-search-input'

interface TickerChipsInputProps {
  id: string
  tickers: string[]
  onChange: (tickers: string[]) => void
  /** Quantos tickers o plano permite; acima disso a busca some e aparece o aviso. */
  max: number
  placeholder?: string
  limitNote?: React.ReactNode
}

/** Busca de ativos que acumula tickers em "chips" removíveis. */
export function TickerChipsInput({ id, tickers, onChange, max, placeholder, limitNote }: TickerChipsInputProps) {
  const full = tickers.length >= max
  return (
    <div className="space-y-2">
      {!full && (
        <AssetSearchInput
          // Remonta depois de cada escolha para limpar o campo.
          key={tickers.join(',')}
          id={id}
          placeholder={placeholder ?? 'Digite um ticker, ex.: ITUB4'}
          value=""
          onCompanySelect={(company) => {
            const ticker = company.ticker.toUpperCase()
            if (!tickers.includes(ticker)) onChange([...tickers, ticker])
          }}
        />
      )}
      {tickers.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Ativos escolhidos">
          {tickers.map((ticker) => (
            <li key={ticker} className="inline-flex items-center rounded-md border border-border bg-surface pl-2.5 text-sm font-medium text-foreground">
              {ticker}
              <button
                type="button"
                onClick={() => onChange(tickers.filter((t) => t !== ticker))}
                className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring outline-none md:size-8"
                aria-label={`Remover ${ticker}`}
              >
                <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {full && limitNote}
    </div>
  )
}
