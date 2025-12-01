"use client"

interface RankingResult {
  ticker: string
  name: string
  sector: string | null
  currentPrice: number
  logoUrl?: string | null
  fairValue: number | null
  upside: number | null
  marginOfSafety: number | null
  rational: string
  key_metrics?: Record<string, number | null>
  fairValueModel?: string | null
}
import { CompanyLogo } from "@/components/company-logo"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Lock } from "lucide-react"

interface ScreeningResultsBlurProps {
  results: RankingResult[]
  totalCount: number
  isPremium: boolean
}

export function ScreeningResultsBlur({ results, totalCount, isPremium }: ScreeningResultsBlurProps) {
  const top3 = results.slice(0, 3)
  const blurred = results.slice(3, 20) // Posições 4-20 com blur (se existirem dados reais)
  
  // SEMPRE mostrar blur quando não for premium, independente do totalCount retornado
  // Isso é um ponto de conversão - sempre mostrar que há mais resultados disponíveis
  const shouldShowBlur = !isPremium
  
  // Usar totalCount se disponível, senão assumir que há mais resultados
  // Sempre mostrar pelo menos 10 cards com blur para criar efeito visual convincente
  const remainingCount = totalCount > 3 ? totalCount - 3 : 10 // Se totalCount <= 3, assumir pelo menos 10 mais
  const blurredCount = shouldShowBlur ? Math.min(Math.max(remainingCount, 10), 17) : 0 // Mínimo 10, máximo 17 cards (posições 4-20)
  
  // Debug: verificar valores
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[ScreeningResultsBlur]', {
      resultsLength: results.length,
      totalCount,
      remainingCount,
      shouldShowBlur,
      blurredCount,
      isPremium
    })
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return "N/A"
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatPercentage = (value: number | null) => {
    if (value === null) return "N/A"
    return `${value.toFixed(1)}%`
  }

  const formatMetricValue = (key: string, value: number | null) => {
    if (value === null || value === undefined) return 'N/A'
    
    const percentualMetrics = ['roe', 'roa', 'roic', 'margemLiquida', 'margemEbitda', 'dy', 'pl', 'pvp']
    
    if (percentualMetrics.includes(key.toLowerCase())) {
      if (key === 'dy' || key === 'roe' || key === 'roa' || key === 'roic' || key === 'margemLiquida' || key === 'margemEbitda') {
        if (value >= 0 && value <= 1) {
          return `${(value * 100).toFixed(1)}%`
        }
        return `${value.toFixed(1)}%`
      }
      return value.toFixed(2)
    }
    
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    })
  }

  const getKeyMetric = (result: RankingResult, key: string): number | null => {
    if (key === 'currentPrice') return result.currentPrice
    if (key === 'upside') return result.upside
    if (key === 'fairValue') return result.fairValue
    return result.key_metrics?.[key] as number | null
  }

  // Determinar qual métrica chave mostrar baseado nos resultados
  const getKeyMetricLabel = (): string => {
    if (results.length === 0) return 'Preço'
    
    // Verificar se tem DY (dividendos)
    if (results[0]?.key_metrics?.dy) return 'DY'
    // Verificar se tem P/L (graham)
    if (results[0]?.key_metrics?.pl) return 'P/L'
    // Verificar se tem CAGR (small caps)
    if (results[0]?.key_metrics?.cagrReceitas) return 'CAGR'
    // Verificar se tem Upside (deep value)
    if (results[0]?.upside) return 'Upside'
    
    return 'Preço'
  }

  const keyMetricLabel = getKeyMetricLabel()

  return (
    <div className="space-y-6">
      {/* Top 3 - Sem blur */}
      <div className="space-y-4">
        {top3.map((result, index) => (
          <Link
            key={result.ticker}
            href={`/acao/${result.ticker}`}
            className="block"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <CompanyLogo 
                    ticker={result.ticker} 
                    logoUrl={result.logoUrl} 
                    size={40} 
                    companyName={result.name} 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-lg truncate">{result.ticker}</div>
                      {result.sector && (
                        <Badge variant="secondary" className="text-xs">
                          {result.sector}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{result.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 text-right flex-shrink-0 flex-wrap">
                  <div>
                    <div className="text-xs text-muted-foreground">Preço</div>
                    <div className="font-semibold text-sm sm:text-base">{formatCurrency(result.currentPrice)}</div>
                  </div>
                  {result.fairValue && (
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground truncate">
                        Preço Justo
                      </div>
                      <div className="font-semibold text-blue-600 text-xs sm:text-sm truncate">{formatCurrency(result.fairValue)}</div>
                    </div>
                  )}
                  {/* DY sempre em destaque quando disponível */}
                  {getKeyMetric(result, 'dy') && (
                    <div>
                      <div className="text-xs text-muted-foreground">DY</div>
                      <div className="font-semibold text-green-600 text-sm sm:text-base">{formatPercentage(getKeyMetric(result, 'dy')! * 100)}</div>
                    </div>
                  )}
                  {/* Upside sempre em destaque quando disponível */}
                  {getKeyMetric(result, 'upside') && (
                    <div>
                      <div className="text-xs text-muted-foreground">Upside</div>
                      <div className="font-semibold text-green-600 text-sm sm:text-base">{formatPercentage(getKeyMetric(result, 'upside'))}</div>
                    </div>
                  )}
                  {/* Outras métricas específicas da estratégia */}
                  {keyMetricLabel === 'P/L' && getKeyMetric(result, 'pl') && (
                    <div>
                      <div className="text-xs text-muted-foreground">P/L</div>
                      <div className="font-semibold text-sm sm:text-base">{formatMetricValue('pl', getKeyMetric(result, 'pl'))}</div>
                    </div>
                  )}
                  {keyMetricLabel === 'CAGR' && getKeyMetric(result, 'cagrReceitas') && (
                    <div>
                      <div className="text-xs text-muted-foreground">CAGR</div>
                      <div className="font-semibold text-green-600 text-sm sm:text-base">{formatPercentage(getKeyMetric(result, 'cagrReceitas')! * 100)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Resultados com Blur (4-20) */}
      {shouldShowBlur && blurredCount > 0 && (
        <div className="relative">
          {/* Mostrar primeiro um card com blur */}
          <div className="mb-6" style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }}>
            {(() => {
              const result = blurred[0] // Se tiver resultado real, usar; senão, criar fantasma
              
              return (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 opacity-60">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-bold flex-shrink-0">
                        4
                      </div>
                      {result ? (
                        <>
                          <CompanyLogo 
                            ticker={result.ticker} 
                            logoUrl={result.logoUrl} 
                            size={40} 
                            companyName={result.name} 
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-semibold text-lg truncate">{result.ticker}</div>
                              {result.sector && (
                                <Badge variant="secondary" className="text-xs">
                                  {result.sector}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">{result.name}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-lg bg-gray-200 dark:bg-gray-700 h-5 w-24 rounded" />
                            <div className="text-sm bg-gray-200 dark:bg-gray-700 h-4 w-32 rounded mt-1" />
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 text-right flex-shrink-0 flex-wrap">
                      {result ? (
                        <>
                          <div>
                            <div className="text-xs text-muted-foreground">Preço</div>
                            <div className="font-semibold text-sm sm:text-base">{formatCurrency(result.currentPrice)}</div>
                          </div>
                          {result.fairValue && (
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground truncate">
                                Preço Justo
                              </div>
                              <div className="font-semibold text-blue-600 text-xs sm:text-sm truncate">{formatCurrency(result.fairValue)}</div>
                            </div>
                          )}
                          {/* DY sempre em destaque quando disponível */}
                          {getKeyMetric(result, 'dy') && (
                            <div>
                              <div className="text-xs text-muted-foreground">DY</div>
                              <div className="font-semibold text-green-600 text-sm sm:text-base">{formatPercentage(getKeyMetric(result, 'dy')! * 100)}</div>
                            </div>
                          )}
                          {/* Upside sempre em destaque quando disponível */}
                          {getKeyMetric(result, 'upside') && (
                            <div>
                              <div className="text-xs text-muted-foreground">Upside</div>
                              <div className="font-semibold text-green-600 text-sm sm:text-base">{formatPercentage(getKeyMetric(result, 'upside'))}</div>
                            </div>
                          )}
                          {/* Outras métricas específicas da estratégia */}
                          {keyMetricLabel === 'P/L' && getKeyMetric(result, 'pl') && (
                            <div>
                              <div className="text-xs text-muted-foreground">P/L</div>
                              <div className="font-semibold text-sm sm:text-base">{formatMetricValue('pl', getKeyMetric(result, 'pl'))}</div>
                            </div>
                          )}
                          {keyMetricLabel === 'CAGR' && getKeyMetric(result, 'cagrReceitas') && (
                            <div>
                              <div className="text-xs text-muted-foreground">CAGR</div>
                              <div className="font-semibold text-green-600 text-sm sm:text-base">{formatPercentage(getKeyMetric(result, 'cagrReceitas')! * 100)}</div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="bg-gray-200 dark:bg-gray-700 h-8 w-16 sm:w-20 rounded" />
                          <div className="bg-gray-200 dark:bg-gray-700 h-8 w-12 sm:w-16 rounded" />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* CTA após primeiro card blur */}
          <div className="text-center mb-6 pointer-events-auto z-10 relative">
            <Lock className="w-10 h-10 mx-auto mb-3 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xl font-bold mb-2">
              A IA encontrou mais oportunidades nesta estratégia
            </h3>
            <p className="text-muted-foreground mb-4 px-4">
              Desbloqueie a lista completa e veja todas as empresas que passaram nos filtros
            </p>
            <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Link href="/checkout">Desbloquear Lista Completa</Link>
            </Button>
          </div>

          {/* Cards restantes com blur */}
          <div className="space-y-4" style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }}>
            {Array.from({ length: Math.max(0, blurredCount - 1) }).map((_, index) => {
              const actualIndex = index + 4 // Posição real (5, 6, 7, ...) - primeiro já foi mostrado
              const result = blurred[index + 1] // Se tiver resultado real, usar; senão, criar fantasma
              
              return (
                <div
                  key={result?.ticker || `blurred-${actualIndex}`}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 opacity-60"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-bold flex-shrink-0">
                        {actualIndex + 1}
                      </div>
                      {result ? (
                        <>
                          <CompanyLogo 
                            ticker={result.ticker} 
                            logoUrl={result.logoUrl} 
                            size={40} 
                            companyName={result.name} 
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-semibold text-lg truncate">{result.ticker}</div>
                              {result.sector && (
                                <Badge variant="secondary" className="text-xs">
                                  {result.sector}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">{result.name}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-lg bg-gray-200 dark:bg-gray-700 h-5 w-24 rounded" />
                            <div className="text-sm bg-gray-200 dark:bg-gray-700 h-4 w-32 rounded mt-1" />
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 text-right flex-shrink-0 flex-wrap">
                      {result ? (
                        <>
                          <div>
                            <div className="text-xs text-muted-foreground">Preço</div>
                            <div className="font-semibold text-sm sm:text-base">{formatCurrency(result.currentPrice)}</div>
                          </div>
                          {result.fairValue && (
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground truncate">
                                Preço Justo
                              </div>
                              <div className="font-semibold text-blue-600 text-xs sm:text-sm truncate">{formatCurrency(result.fairValue)}</div>
                            </div>
                          )}
                          {/* DY sempre em destaque quando disponível */}
                          {getKeyMetric(result, 'dy') && (
                            <div>
                              <div className="text-xs text-muted-foreground">DY</div>
                              <div className="font-semibold text-green-600 text-sm sm:text-base">{formatPercentage(getKeyMetric(result, 'dy')! * 100)}</div>
                            </div>
                          )}
                          {/* Upside sempre em destaque quando disponível */}
                          {getKeyMetric(result, 'upside') && (
                            <div>
                              <div className="text-xs text-muted-foreground">Upside</div>
                              <div className="font-semibold text-green-600 text-sm sm:text-base">{formatPercentage(getKeyMetric(result, 'upside'))}</div>
                            </div>
                          )}
                          {/* Outras métricas específicas da estratégia */}
                          {keyMetricLabel === 'P/L' && getKeyMetric(result, 'pl') && (
                            <div>
                              <div className="text-xs text-muted-foreground">P/L</div>
                              <div className="font-semibold text-sm sm:text-base">{formatMetricValue('pl', getKeyMetric(result, 'pl'))}</div>
                            </div>
                          )}
                          {keyMetricLabel === 'CAGR' && getKeyMetric(result, 'cagrReceitas') && (
                            <div>
                              <div className="text-xs text-muted-foreground">CAGR</div>
                              <div className="font-semibold text-green-600 text-sm sm:text-base">{formatPercentage(getKeyMetric(result, 'cagrReceitas')! * 100)}</div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="bg-gray-200 dark:bg-gray-700 h-8 w-16 sm:w-20 rounded" />
                          <div className="bg-gray-200 dark:bg-gray-700 h-8 w-12 sm:w-16 rounded" />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Se for premium, mostrar todos sem blur */}
      {isPremium && blurred.length > 0 && (
        <div className="space-y-4">
          {blurred.map((result, index) => (
            <Link
              key={result.ticker}
              href={`/acao/${result.ticker}`}
              className="block"
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-bold flex-shrink-0">
                      {index + 4}
                    </div>
                    <CompanyLogo 
                      ticker={result.ticker} 
                      logoUrl={result.logoUrl} 
                      size={40} 
                      companyName={result.name} 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-lg truncate">{result.ticker}</div>
                        {result.sector && (
                          <Badge variant="secondary" className="text-xs">
                            {result.sector}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{result.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 text-right flex-shrink-0 flex-wrap">
                    <div>
                      <div className="text-xs text-muted-foreground">Preço</div>
                      <div className="font-semibold text-sm sm:text-base">{formatCurrency(result.currentPrice)}</div>
                    </div>
                    {result.fairValue && (
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground truncate">
                          Preço Justo
                        </div>
                        <div className="font-semibold text-blue-600 text-xs sm:text-sm truncate">{formatCurrency(result.fairValue)}</div>
                      </div>
                    )}
                    {/* DY sempre em destaque quando disponível */}
                    {getKeyMetric(result, 'dy') && (
                      <div>
                        <div className="text-xs text-muted-foreground">DY</div>
                        <div className="font-semibold text-green-600 text-sm sm:text-base">{formatPercentage(getKeyMetric(result, 'dy')! * 100)}</div>
                      </div>
                    )}
                    {/* Upside sempre em destaque quando disponível */}
                    {result.upside !== null && result.upside !== undefined && (
                      <div>
                        <div className="text-xs text-muted-foreground">Upside</div>
                        <div className="font-semibold text-green-600 text-sm sm:text-base">{formatPercentage(result.upside)}</div>
                      </div>
                    )}
                    {/* P/L e CAGR apenas se forem a métrica principal */}
                    {keyMetricLabel === 'P/L' && getKeyMetric(result, 'pl') && (
                      <div>
                        <div className="text-xs text-muted-foreground">P/L</div>
                        <div className="font-semibold text-sm sm:text-base">{formatMetricValue('pl', getKeyMetric(result, 'pl'))}</div>
                      </div>
                    )}
                    {keyMetricLabel === 'CAGR' && getKeyMetric(result, 'cagrReceitas') && (
                      <div>
                        <div className="text-xs text-muted-foreground">CAGR</div>
                        <div className="font-semibold text-green-600 text-sm sm:text-base">{formatPercentage(getKeyMetric(result, 'cagrReceitas')! * 100)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

