'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { CompanyLogo } from '@/components/company-logo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Crown, TrendingUp, Loader2, ExternalLink, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ETF_PRESETS, EtfPresetSlug, EtfRankingItem } from '@/lib/strategies/etf-ranking-strategy'

interface EtfRankerProps {
  onBack: () => void
}

function formatPct(value: number | null): string {
  if (value === null) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(1)}%`
}

function formatBrl(value: number | null): string {
  if (value === null) return '—'
  if (value >= 1e9) return `R$ ${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `R$ ${(value / 1e6).toFixed(0)}M`
  return `R$ ${value.toLocaleString('pt-BR')}`
}

function formatTaxa(value: number | null): string {
  if (value === null) return '—'
  return `${(value * 100).toFixed(2)}% a.a.`
}

export function EtfRanker({ onBack }: EtfRankerProps) {
  const { isPremium } = usePremiumStatus()
  const [selectedPreset, setSelectedPreset] = useState<EtfPresetSlug | null>(null)
  const [results, setResults] = useState<EtfRankingItem[]>([])
  const [isLimited, setIsLimited] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const presetList = Object.values(ETF_PRESETS)

  const runPreset = async (slug: EtfPresetSlug) => {
    setSelectedPreset(slug)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/etf-ranking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: slug }),
      })
      if (!res.ok) throw new Error('Erro ao buscar ranking')
      const data = await res.json()
      setResults(data.results)
      setIsLimited(data.isLimited)
    } catch (e) {
      setError('Não foi possível carregar o ranking. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-slate-600 dark:text-slate-400">
          ← <span className="hidden sm:inline">Voltar</span>
        </Button>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            📊 Ranking de ETFs
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
            Rankings baseados no score proprietário Preço Justo
          </p>
        </div>
      </div>

      {/* Preset selector */}
      <div className="grid grid-cols-2 gap-3">
        {presetList.map((preset) => (
          <button
            key={preset.slug}
            onClick={() => runPreset(preset.slug)}
            className={cn(
              'flex flex-col items-start text-left p-4 rounded-2xl border-2 transition-all duration-200 active:scale-[0.97]',
              selectedPreset === preset.slug
                ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-950/40 shadow-lg'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 hover:shadow-md'
            )}
          >
            <span className="text-2xl mb-2">{preset.emoji}</span>
            <p className={cn(
              'text-sm font-bold mb-1',
              selectedPreset === preset.slug ? 'text-teal-700 dark:text-teal-300' : 'text-slate-900 dark:text-white'
            )}>
              {preset.title}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight line-clamp-2">
              {preset.description}
            </p>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm p-4 bg-red-50 dark:bg-red-950/30 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {!loading && !error && results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {results.length} ETF{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
            </p>
            {isLimited && (
              <Badge variant="outline" className="text-xs gap-1">
                <Crown className="w-3 h-3 text-yellow-500" />
                Top 10 — Premium vê todos
              </Badge>
            )}
          </div>

          {results.map((etf, idx) => {
            const effReturn = etf.return1y ?? (etf.return6m !== null ? (1 + etf.return6m) ** 2 - 1 : null)
            const retLabel = formatPct(effReturn)
            const retColor = effReturn === null ? '' : effReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'

            return (
              <Link key={etf.ticker} href={`/etf/${etf.ticker.toLowerCase()}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer border hover:border-teal-300 dark:hover:border-teal-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Posição */}
                      <span className="text-lg font-bold text-slate-400 w-6 text-right shrink-0">
                        {idx + 1}
                      </span>

                      {/* Logo */}
                      <div className="shrink-0">
                        <CompanyLogo
                          logoUrl={etf.logoUrl}
                          companyName={etf.name}
                          ticker={etf.ticker}
                          size={40}
                        />
                      </div>

                      {/* Ticker + Nome */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">{etf.ticker}</span>
                          <Badge variant="outline" className="text-xs">ETF</Badge>
                          {etf.benchmarkIndex && (
                            <span className="text-xs text-slate-400 truncate max-w-[140px]">
                              {etf.benchmarkIndex}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{etf.name}</p>
                      </div>

                      {/* Métricas */}
                      <div className="flex items-center gap-4 shrink-0 text-right">
                        {etf.etfScore !== null && (
                          <div>
                            <p className="text-xs text-slate-400">Score</p>
                            <p className="font-bold text-sm">{etf.etfScore}</p>
                          </div>
                        )}
                        {effReturn !== null && (
                          <div>
                            <p className="text-xs text-slate-400">
                              Retorno{etf.isEstimatedReturn ? ' (est.)' : ' 1a'}
                            </p>
                            <p className={cn('font-bold text-sm', retColor)}>{retLabel}</p>
                          </div>
                        )}
                        {etf.netExpenseRatio !== null && (
                          <div className="hidden sm:block">
                            <p className="text-xs text-slate-400">Taxa</p>
                            <p className="font-bold text-sm">{formatTaxa(etf.netExpenseRatio)}</p>
                          </div>
                        )}
                        <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}

          {/* Upgrade CTA */}
          {isLimited && (
            <Card className="border-2 border-dashed border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-yellow-500" />
                  <p className="text-sm font-medium">Ver todos os ETFs com score</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/checkout">Assinar Premium</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && selectedPreset && results.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum ETF encontrado para este critério</p>
        </div>
      )}
    </div>
  )
}
