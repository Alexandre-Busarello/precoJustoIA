'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Info, 
  Lock,
  Crown,
  TrendingUp,
  BarChart3,
  Target,
  Zap
} from 'lucide-react'

interface TechnicalAnalysisPageLimitedProps {
  ticker: string
  companyName: string
  currentPrice: number
}

export default function TechnicalAnalysisPageLimited({
  ticker,
  companyName,
  currentPrice
}: TechnicalAnalysisPageLimitedProps) {
  return (
    <div className="space-y-6">
      {/* CTA Principal */}
      <Card className="border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
        <CardContent className="p-8 text-center">
          <Lock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Análise Técnica Completa</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Faça login para acessar a análise técnica completa com indicadores avançados, gráficos interativos e previsões de preços com IA.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/login?callbackUrl=${encodeURIComponent(`/acao/${ticker.toLowerCase()}/analise-tecnica`)}`}>
                Fazer Login
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-amber-600 text-amber-600 hover:bg-amber-50">
              <Link href="/checkout">
                <Crown className="w-4 h-4 mr-2" />
                Upgrade para Premium
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Informações Básicas Disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Info className="w-5 h-5" />
            <span>Informações Básicas</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Ticker</p>
              <p className="text-xl font-bold">{ticker}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Preço Atual</p>
              <p className="text-xl font-bold">R$ {currentPrice.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* O que você terá acesso */}
      <Card>
        <CardHeader>
          <CardTitle>O que você terá acesso com Premium:</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Indicadores Técnicos</h3>
                <p className="text-sm text-muted-foreground">
                  RSI, MACD, Stochastic, Bollinger Bands, Médias Móveis (SMA/EMA)
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Suporte e Resistência</h3>
                <p className="text-sm text-muted-foreground">
                  Detecção automática de níveis de suporte e resistência com análise de força
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
              <Target className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Fibonacci e Ichimoku</h3>
                <p className="text-sm text-muted-foreground">
                  Níveis de Fibonacci e análise completa de Ichimoku Cloud
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
              <Zap className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Previsão com IA</h3>
                <p className="text-sm text-muted-foreground">
                  Previsão de preços mínimos, máximos e preço justo de entrada com análise de confiança
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900 dark:text-blue-100">
          <strong>Importante:</strong> A análise técnica é um auxílio complementar para identificar 
          as melhores regiões de preço para entrada em um ativo para <strong>longo prazo</strong>. 
          <strong> Não é recomendada para day trade.</strong> Sempre combine com análise fundamentalista.
        </AlertDescription>
      </Alert>

      {/* CTA Final */}
      <Card className="border-2 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6 text-center">
          <p className="text-lg font-semibold mb-2">
            Desbloqueie o poder da análise técnica completa
          </p>
          <p className="text-muted-foreground mb-4">
            Faça login ou faça upgrade para Premium e tenha acesso a todas as ferramentas de análise técnica.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/login?callbackUrl=${encodeURIComponent(`/acao/${ticker.toLowerCase()}/analise-tecnica`)}`}>
                Fazer Login Gratuito
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-amber-600 text-amber-600 hover:bg-amber-50">
              <Link href="/checkout">
                <Crown className="w-4 h-4 mr-2" />
                Ver Planos Premium
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

