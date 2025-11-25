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

