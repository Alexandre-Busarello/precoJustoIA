'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  ChevronDown, 
  ChevronUp, 
  Youtube,
  TrendingUp,
  TrendingDown,
  Minus,
  Lock,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'

interface MarketSentimentSectionProps {
  ticker: string
  youtubeAnalysis: {
    score: number
    summary: string
    positivePoints: string[] | null
    negativePoints: string[] | null
    updatedAt: Date
  } | null
  userIsPremium: boolean
}

export default function MarketSentimentSection({ 
  ticker, 
  youtubeAnalysis, 
  userIsPremium 
}: MarketSentimentSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Determinar sentimento baseado no score
  const getSentiment = (score: number) => {
    if (score >= 71) return { label: 'Positivo', color: 'text-green-600', icon: TrendingUp, bg: 'bg-green-50', border: 'border-green-200' }
    if (score >= 51) return { label: 'Neutro', color: 'text-yellow-600', icon: Minus, bg: 'bg-yellow-50', border: 'border-yellow-200' }
    return { label: 'Negativo', color: 'text-red-600', icon: TrendingDown, bg: 'bg-red-50', border: 'border-red-200' }
  }

  // Se não há análise, não mostrar nada
  if (!youtubeAnalysis) {
    return null
  }

  // Se é análise vazia (sem vídeos), não mostrar nada
  // Verificar se summary indica ausência de vídeos ou se positivePoints e negativePoints são null
  const isEmptyAnalysis = 
    (!youtubeAnalysis.positivePoints || youtubeAnalysis.positivePoints.length === 0) &&
    (!youtubeAnalysis.negativePoints || youtubeAnalysis.negativePoints.length === 0) &&
    (youtubeAnalysis.summary.toLowerCase().includes('não foram encontrados') ||
     youtubeAnalysis.summary.toLowerCase().includes('sem vídeos'))

  if (isEmptyAnalysis) {
    return null
  }

  const sentiment = getSentiment(youtubeAnalysis.score)
  const SentimentIcon = sentiment.icon

  // Limitar informações para não-premium (SEO)
  const showFullAnalysis = userIsPremium
  const displaySummary = showFullAnalysis 
    ? youtubeAnalysis.summary 
    : youtubeAnalysis.summary.substring(0, 100) + '...'
  
  const displayPositivePoints = showFullAnalysis 
    ? (youtubeAnalysis.positivePoints || [])
    : (youtubeAnalysis.positivePoints || []).slice(0, 1)
  
  const displayNegativePoints = showFullAnalysis 
    ? (youtubeAnalysis.negativePoints || [])
    : (youtubeAnalysis.negativePoints || []).slice(0, 1)

  return (
    <div className="mb-8">
      <Card>
        <CardHeader 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${userIsPremium ? sentiment.bg : 'bg-muted'} ${userIsPremium ? sentiment.border : 'border-muted'} border`}>
                <Youtube className={`w-5 h-5 ${userIsPremium ? sentiment.color : 'text-muted-foreground'}`} />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                  Análise de Sentimento de Mercado
                  {!userIsPremium && (
                    <Badge variant="default" className="bg-gradient-to-r from-amber-500 to-orange-600">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Premium
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <span>Análise agregada de fontes especializadas sobre {ticker}</span>
                  {userIsPremium ? (
                    <Badge variant="outline" className={sentiment.color}>
                      <SentimentIcon className="w-3 h-3 mr-1" />
                      {sentiment.label}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="relative">
                      <span className="blur-sm select-none">Positivo</span>
                      <Lock className="absolute inset-0 m-auto w-3 h-3 text-muted-foreground" />
                    </Badge>
                  )}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </Button>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-6">
            {/* Score Visual */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Score de Sentimento
                </span>
                {userIsPremium ? (
                  <span className={`text-2xl font-bold ${sentiment.color}`}>
                    {youtubeAnalysis.score}/100
                  </span>
                ) : (
                  <div className="relative">
                    <span className="text-2xl font-bold blur-sm select-none text-muted-foreground">
                      85/100
                    </span>
                    <Lock className="absolute inset-0 m-auto w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              {userIsPremium ? (
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      youtubeAnalysis.score >= 71 
                        ? 'bg-green-500' 
                        : youtubeAnalysis.score >= 51 
                        ? 'bg-yellow-500' 
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${youtubeAnalysis.score}%` }}
                  />
                </div>
              ) : (
                <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-muted-foreground/20 to-muted-foreground/40 blur-[2px]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            {/* Resumo */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <div className="w-1 h-4 bg-primary rounded-full" />
                Resumo da Análise
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {displaySummary}
              </p>
              {!showFullAnalysis && youtubeAnalysis.summary.length > 100 && (
                <div className="mt-2 text-sm text-muted-foreground italic flex items-center gap-2">
                  <Lock className="w-3 h-3" />
                  Conteúdo completo disponível para usuários Premium
                </div>
              )}
            </div>

            {/* Pontos Positivos */}
            {displayPositivePoints.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-green-500 rounded-full" />
                  Pontos Positivos
                </h4>
                <ul className="space-y-2">
                  {displayPositivePoints.map((point, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{point}</span>
                    </li>
                  ))}
                </ul>
                {!showFullAnalysis && (youtubeAnalysis.positivePoints?.length || 0) > 1 && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-dashed">
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Lock className="w-3 h-3" />
                      +{(youtubeAnalysis.positivePoints?.length || 0) - 1} pontos positivos adicionais disponíveis no Premium
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Pontos Negativos */}
            {displayNegativePoints.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-red-500 rounded-full" />
                  Pontos de Atenção
                </h4>
                <ul className="space-y-2">
                  {displayNegativePoints.map((point, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm">
                      <TrendingDown className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{point}</span>
                    </li>
                  ))}
                </ul>
                {!showFullAnalysis && (youtubeAnalysis.negativePoints?.length || 0) > 1 && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-dashed">
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Lock className="w-3 h-3" />
                      +{(youtubeAnalysis.negativePoints?.length || 0) - 1} pontos de atenção adicionais disponíveis no Premium
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* CTA para não-premium */}
            {!userIsPremium && (
              <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-start space-x-3">
                  <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                      Desbloqueie a Análise Completa
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                      Acesse score de sentimento, análises completas de mercado e todos os insights positivos e negativos identificados por IA sobre {ticker}.
                    </p>
                    <Button asChild className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
                      <Link href="/planos">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Assinar Premium
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer com data de atualização */}
            <div className="mt-6 pt-4 border-t">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                Última atualização: {new Date(youtubeAnalysis.updatedAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

