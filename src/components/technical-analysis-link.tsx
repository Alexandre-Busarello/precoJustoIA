'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import Link from 'next/link'
import { TrendingUp, ArrowRight, Crown, Info, ChevronDown } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import TechnicalAnalysisTrafficLight from './technical-analysis-traffic-light'
import { FALLBACK_MONTHLY_PRICE_FORMATTED } from '@/lib/price-utils'

interface TechnicalAnalysisLinkProps {
  ticker: string
  userIsPremium: boolean
  currentPrice: number
  assetType?: 'STOCK' | 'BDR' | 'FII' | 'ETF'
}

export default function TechnicalAnalysisLink({
  ticker,
  userIsPremium,
  currentPrice,
  assetType = 'STOCK'
}: TechnicalAnalysisLinkProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  // Determinar o prefixo da rota baseado no tipo de asset
  const routePrefix = assetType === 'BDR' ? 'bdr' : 
                      assetType === 'FII' ? 'fii' : 
                      assetType === 'ETF' ? 'etf' : 
                      'acao'

  if (!userIsPremium) {
    return (
      <Card className="mt-8 border-2 border-amber-200 dark:border-amber-800">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-semibold">Análise Técnica Premium</h3>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                  <Crown className="w-3 h-3 mr-1" />
                  Premium
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Acesse análise técnica completa com indicadores avançados, suporte/resistência
                e previsão de preços com IA.
              </p>

              {/* Prévia com blur - mesmo padrão visual usado no Score e na Análise Fundamentalista */}
              <div className="relative mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-muted/30 p-4">
                <div className="filter blur-sm pointer-events-none select-none grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Preço Atual</p>
                    <p className="text-sm font-semibold">R$ {currentPrice.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Sinal</p>
                    <p className="text-sm font-semibold text-green-600">Sobrevenda</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Preço Justo (IA)</p>
                    <p className="text-sm font-semibold">R$ XX,XX</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Faixa Prevista</p>
                    <p className="text-sm font-semibold">R$ XX,XX - XX,XX</p>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px] rounded-lg border border-dashed border-orange-300 dark:border-orange-700">
                  <div className="flex items-center space-x-2">
                    <Crown className="w-5 h-5 text-orange-600" />
                    <span className="text-xs font-medium text-muted-foreground">Prévia — resultado real disponível no Premium</span>
                  </div>
                </div>
              </div>

              <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900 dark:text-blue-100 text-xs">
                  A análise técnica é um auxílio complementar para identificar as melhores regiões
                  de preço para entrada em um ativo para <strong>longo prazo</strong>.
                  <strong> Não é recomendada para day trade.</strong>
                </AlertDescription>
              </Alert>
              <Button asChild className="bg-amber-600 hover:bg-amber-700">
                <Link href="/checkout">
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade para Premium
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                a partir de {FALLBACK_MONTHLY_PRICE_FORMATTED}/mês
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-8">
      <CardContent className="p-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          {/* Header sempre visível */}
          <div className="space-y-3">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <TrendingUp className="w-5 h-5 flex-shrink-0" />
                  <h3 className="text-lg font-semibold whitespace-nowrap">Análise Técnica</h3>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 flex-shrink-0">
                    <Crown className="w-3 h-3 mr-1" />
                    Premium
                  </Badge>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 text-muted-foreground ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </CollapsibleTrigger>

            {/* Semáforo e CTA sempre visíveis no header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <TechnicalAnalysisTrafficLight ticker={ticker} currentPrice={currentPrice} compact />
              </div>
              <Button asChild className="flex-shrink-0">
                <Link href={`/${routePrefix}/${ticker.toLowerCase()}/analise-tecnica`}>
                  Ver Completa
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Conteúdo expandível */}
          <CollapsibleContent className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Análise técnica completa com indicadores avançados (RSI, MACD, Bollinger Bands, 
              Fibonacci, Ichimoku), detecção de suporte/resistência e previsão de preços com IA 
              para os próximos 30 dias.
            </p>
            
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900 dark:text-blue-100 text-xs">
                A análise técnica é um auxílio complementar para identificar as melhores regiões 
                de preço para entrada em um ativo para <strong>longo prazo</strong>. 
                <strong> Não é recomendada para day trade.</strong>
              </AlertDescription>
            </Alert>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}

