'use client'

import Link from 'next/link'
import { CompanyLogo } from '@/components/company-logo'
import { RadarStatusIndicator } from '@/components/radar-status-indicator'
import { RadarStrategyBadges } from '@/components/radar-strategy-badges'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExternalLink, Plus, Check, TrendingUp } from 'lucide-react'

export interface RadarAssetData {
  ticker: string
  name: string
  sector: string | null
  currentPrice: number
  logoUrl: string | null
  overallScore: number | null
  overallStatus: 'green' | 'yellow' | 'red'
  strategies: {
    approved: string[]
    all: any
  }
  valuation: {
    upside: number | null
    status: 'green' | 'yellow' | 'red'
    label: string
  }
  technical: {
    status: 'green' | 'yellow' | 'red'
    label: string
    fairEntryPrice: number | null
  }
  sentiment: {
    score: number | null
    status: 'green' | 'yellow' | 'red'
    label: string
  }
}

interface RadarGridProps {
  data: RadarAssetData[]
  loading?: boolean
  className?: string
  onAddToRadar?: (ticker: string) => void | Promise<void>
  radarTickers?: string[]
  showAddButton?: boolean
  isPremium?: boolean
}

export function RadarGrid({ 
  data, 
  loading, 
  className,
  onAddToRadar,
  radarTickers = [],
  showAddButton = false,
  isPremium = false,
}: RadarGridProps) {
  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">
            Nenhum ativo encontrado. Adicione tickers ao seu radar ou explore oportunidades.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Desktop: Tabela */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                Ativo
              </th>
              <th className="text-center p-3 text-xs font-medium text-muted-foreground">
                Score
              </th>
              <th className="text-center p-3 text-xs font-medium text-muted-foreground">
                <div className="flex flex-col items-center gap-1">
                  <span>Estratégias</span>
                  {!isPremium && (
                    <Badge variant="outline" className="text-xs">
                      Apenas Graham
                    </Badge>
                  )}
                </div>
              </th>
              <th className="text-center p-3 text-xs font-medium text-muted-foreground">
                Valuation
              </th>
              <th className="text-center p-3 text-xs font-medium text-muted-foreground">
                Técnico
              </th>
              <th className="text-center p-3 text-xs font-medium text-muted-foreground">
                Sentimento
              </th>
              {showAddButton && (
                <th className="text-center p-3 text-xs font-medium text-muted-foreground">
                  Ação
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((asset) => (
              <tr
                key={asset.ticker}
                className="border-b hover:bg-muted/50 transition-colors"
              >
                {/* Ticker */}
                <td className="p-3">
                  <Link
                    href={`/acao/${asset.ticker.toLowerCase()}`}
                    className="flex items-center gap-3 group"
                  >
                    <CompanyLogo
                      logoUrl={asset.logoUrl}
                      companyName={asset.name}
                      ticker={asset.ticker}
                      size={40}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{asset.ticker}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {asset.name}
                      </div>
                      {asset.sector && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {asset.sector}
                        </Badge>
                      )}
                    </div>
                  </Link>
                </td>

                {/* Score Geral */}
                <td className="p-3 text-center">
                  <RadarStatusIndicator
                    status={asset.overallStatus}
                    label="Score"
                    value={asset.overallScore ?? undefined}
                  />
                </td>

                {/* Estratégias */}
                <td className="p-3 text-center">
                  <RadarStrategyBadges
                    strategies={asset.strategies.all}
                    compact={false}
                  />
                </td>

                {/* Valuation */}
                <td className="p-3 text-center">
                  <RadarStatusIndicator
                    status={asset.valuation.status}
                    label="Upside"
                    value={asset.valuation.upside ?? undefined}
                  />
                </td>

                {/* Análise Técnica */}
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <RadarStatusIndicator
                      status={asset.technical.status}
                      label="Entry"
                      value={asset.technical.label}
                    />
                    <Link
                      href={`/acao/${asset.ticker.toLowerCase()}/analise-tecnica`}
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      title="Ver análise técnica completa"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </td>

                {/* Sentimento */}
                <td className="p-3 text-center">
                  <RadarStatusIndicator
                    status={asset.sentiment.status}
                    label="Sentimento"
                    value={asset.sentiment.score ?? undefined}
                  />
                </td>

                {/* Botão Adicionar ao Radar */}
                {showAddButton && (
                  <td className="p-3 text-center">
                    {radarTickers.includes(asset.ticker) ? (
                      <Badge variant="outline" className="text-xs">
                        <Check className="w-3 h-3 mr-1" />
                        No Radar
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onAddToRadar?.(asset.ticker)
                        }}
                        className="text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Adicionar
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {data.map((asset) => (
          <Card key={asset.ticker} className="overflow-hidden">
            <CardContent className="p-4">
              <Link
                href={`/acao/${asset.ticker.toLowerCase()}`}
                className="block"
              >
                <div className="flex items-start gap-3 mb-4">
                  <CompanyLogo
                    logoUrl={asset.logoUrl}
                    companyName={asset.name}
                    ticker={asset.ticker}
                    size={48}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{asset.ticker}</span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="text-sm text-muted-foreground truncate mb-2">
                      {asset.name}
                    </div>
                    {asset.sector && (
                      <Badge variant="outline" className="text-xs">
                        {asset.sector}
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>

              {/* Indicadores em grid para mobile */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <RadarStatusIndicator
                  status={asset.overallStatus}
                  label="Score Geral"
                  value={asset.overallScore ?? undefined}
                />
                <RadarStatusIndicator
                  status={asset.valuation.status}
                  label="Upside"
                  value={asset.valuation.upside ?? undefined}
                />
                <div className="flex items-center justify-between">
                  <RadarStatusIndicator
                    status={asset.technical.status}
                    label="Entry Point"
                    value={asset.technical.label}
                  />
                  <Link
                    href={`/acao/${asset.ticker.toLowerCase()}/analise-tecnica`}
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0 ml-2"
                    onClick={(e) => e.stopPropagation()}
                    title="Ver análise técnica completa"
                  >
                    <TrendingUp className="w-4 h-4" />
                  </Link>
                </div>
                <RadarStatusIndicator
                  status={asset.sentiment.status}
                  label="Sentimento"
                  value={asset.sentiment.score ?? undefined}
                />
              </div>

              {/* Estratégias */}
              <div className="mt-4 pt-4 border-t">
                <div className="text-xs text-muted-foreground mb-2">
                  Estratégias Aprovadas
                </div>
                <RadarStrategyBadges
                  strategies={asset.strategies.all}
                  compact={true}
                />
              </div>

              {/* Botão Adicionar ao Radar (Mobile) */}
              {showAddButton && (
                <div className="mt-4 pt-4 border-t">
                  {radarTickers.includes(asset.ticker) ? (
                    <Badge variant="outline" className="w-full justify-center">
                      <Check className="w-4 h-4 mr-2" />
                      Já está no Radar
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onAddToRadar?.(asset.ticker)
                      }}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar ao Radar
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

