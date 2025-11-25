'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CompanyLogo } from '@/components/company-logo'
import { RadarStatusIndicator } from '@/components/radar-status-indicator'
import { useRadar } from '@/hooks/use-radar'
import { Radar, ArrowRight, TrendingUp, Sparkles } from 'lucide-react'
import { RadarAssetData } from './radar-grid'

export function DashboardRadarSection() {
  const {
    radarConfig,
    radarData,
    loadingConfig,
    loadingData,
  } = useRadar()

  const hasRadar = radarConfig?.tickers && radarConfig.tickers.length > 0
  const radarAssets = radarData as RadarAssetData[]

  if (loadingConfig || loadingData) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!hasRadar) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-primary" />
            Radar de Oportunidades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Radar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">
              Monitore seus ativos favoritos em um único painel visual
            </p>
            <Button asChild variant="outline">
              <Link href="/radar">
                Criar Meu Radar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calcular estatísticas dinâmicas
  const totalAssets = radarAssets.length
  const greenAssets = radarAssets.filter(a => a.overallStatus === 'green').length
  const yellowAssets = radarAssets.filter(a => a.overallStatus === 'yellow').length
  const redAssets = radarAssets.filter(a => a.overallStatus === 'red').length
  
  const avgScore = totalAssets > 0
    ? Math.round(radarAssets.reduce((sum, a) => sum + (a.overallScore || 0), 0) / totalAssets)
    : 0

  const assetsWithUpside = radarAssets.filter(a => 
    a.valuation.upside !== null && a.valuation.upside > 0
  ).length

  const assetsWithBuySignal = radarAssets.filter(a => 
    a.technical.status === 'green'
  ).length

  // Pegar top 3 ativos para mostrar
  const topAssets = radarAssets
    .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0))
    .slice(0, 3)

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-primary" />
            Radar de Oportunidades
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/radar">
              Ver Completo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-primary">{totalAssets}</div>
            <div className="text-xs text-muted-foreground">Ativos</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{avgScore}</div>
            <div className="text-xs text-muted-foreground">Score Médio</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{assetsWithUpside}</div>
            <div className="text-xs text-muted-foreground">Com Upside</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{assetsWithBuySignal}</div>
            <div className="text-xs text-muted-foreground">Sinal Compra</div>
          </div>
        </div>

        {/* Indicadores de Status */}
        <div className="flex items-center gap-4 mb-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">
              {greenAssets} Excelente
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-sm text-muted-foreground">
              {yellowAssets} Atenção
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm text-muted-foreground">
              {redAssets} Cuidado
            </span>
          </div>
        </div>

        {/* Top 3 Ativos */}
        {topAssets.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Top Ativos do Radar</h3>
              <Badge variant="outline" className="text-xs">
                {topAssets.length} de {totalAssets}
              </Badge>
            </div>
            {topAssets.map((asset) => (
              <Link
                key={asset.ticker}
                href={`/acao/${asset.ticker.toLowerCase()}`}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
              >
                <CompanyLogo
                  logoUrl={asset.logoUrl}
                  companyName={asset.name}
                  ticker={asset.ticker}
                  size={40}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{asset.ticker}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-center gap-2">
                    <RadarStatusIndicator
                      status={asset.overallStatus}
                      label=""
                      value={asset.overallScore ?? undefined}
                      className="text-xs"
                    />
                    {asset.valuation.upside !== null && asset.valuation.upside > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {asset.valuation.upside.toFixed(1)}%
                      </Badge>
                    )}
                    {asset.technical.status === 'green' && (
                      <Badge variant="default" className="text-xs bg-green-500">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Compra
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Call to Action */}
        <div className="mt-6 pt-4 border-t">
          <Button asChild className="w-full" variant="outline">
            <Link href="/radar">
              <Radar className="w-4 h-4 mr-2" />
              Gerenciar Radar
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

