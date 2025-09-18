'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Brain, Sparkles, AlertCircle, CheckCircle2, Crown, Lock } from 'lucide-react'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import Link from 'next/link'

interface StrategicAnalysisResult {
  fairValue?: number | null
  upside?: number | null
  eligible?: boolean
  score?: number
  currentYield?: number | null
  currentPE?: number | null
  error?: string
}

interface AIAnalysisProps {
  ticker: string
  name: string
  sector: string | null
  currentPrice: number
  financials: Record<string, unknown>
  userIsPremium?: boolean
}

interface AnalysisResponse {
  success: boolean
  analysis?: string
  strategicAnalyses?: Record<string, StrategicAnalysisResult>
  metadata?: {
    ticker: string
    name: string
    sector: string
    currentPrice: number
    timestamp: string
  }
  error?: string
  details?: string
}

export default function AIAnalysis({ 
  ticker, 
  name, 
  sector, 
  currentPrice, 
  financials,
  userIsPremium = false
}: AIAnalysisProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [strategicAnalyses, setStrategicAnalyses] = useState<Record<string, StrategicAnalysisResult> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reviewAttempts, setReviewAttempts] = useState(0)

  const generateAnalysis = async () => {
    // Verificar se o usuário é premium
    if (!userIsPremium) {
      setError('Análise por IA disponível apenas para usuários Premium')
      return
    }

    setIsLoading(true)
    setError(null)
    setAnalysis(null)
    setReviewAttempts(0)

    try {
      let finalAnalysis = null
      let attempts = 0
      const maxAttempts = 3

      while (!finalAnalysis && attempts < maxAttempts) {
        attempts++
        setReviewAttempts(attempts)

        // Gerar análise inicial
        const response = await fetch('/api/generate-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticker,
            name,
            sector,
            currentPrice,
            financials,
            includeStatements: true // Flag para incluir análise de demonstrativos
          }),
        })

        const data: AnalysisResponse = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao gerar análise')
        }

        if (data.success && data.analysis) {
          // Revisar a análise com outra IA
          const reviewResponse = await fetch('/api/review-analysis', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              analysis: data.analysis,
              ticker,
              name
            }),
          })

          const reviewData = await reviewResponse.json()

          if (reviewData.success && reviewData.approved) {
            // Análise aprovada pela revisão
            finalAnalysis = data.analysis
            setStrategicAnalyses(data.strategicAnalyses || null)
          } else if (attempts >= maxAttempts) {
            // Se chegou ao limite de tentativas, usar a última análise mesmo sem aprovação
            finalAnalysis = data.analysis
            setStrategicAnalyses(data.strategicAnalyses || null)
            console.warn('Análise não foi totalmente aprovada na revisão, mas será exibida após máximo de tentativas')
          }
          // Se não foi aprovada e ainda há tentativas, continua o loop
        } else {
          throw new Error('Resposta inválida da API')
        }
      }

      if (finalAnalysis) {
        setAnalysis(finalAnalysis)
      } else {
        throw new Error('Não foi possível gerar uma análise válida após múltiplas tentativas')
      }

    } catch (err) {
      console.error('Erro ao gerar análise:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }

  const renderStrategicAnalyses = () => {
    if (!strategicAnalyses) return null

    const strategyLabels: Record<string, string> = {
      graham: 'Graham',
      dividendYield: 'Dividend Yield',
      lowPE: 'Baixo P/L',
      magicFormula: 'Fórmula Mágica'
    }

    const getStrategyStatus = (result: StrategicAnalysisResult) => {
      if (result.error) return 'error'
      return result.eligible ? 'success' : 'warning'
    }

    const getStrategyIcon = (status: string) => {
      switch (status) {
        case 'success': return <CheckCircle2 className="w-4 h-4 text-green-600" />
        case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-600" />
        case 'error': return <AlertCircle className="w-4 h-4 text-red-600" />
        default: return <AlertCircle className="w-4 h-4 text-gray-600" />
      }
    }

    const getStrategyDescription = (strategy: string, result: StrategicAnalysisResult) => {
      if (result.error) return result.error

      switch (strategy) {
        case 'graham':
          return result.fairValue 
            ? `Preço Justo: R$ ${result.fairValue.toFixed(2)}`
            : 'Dados insuficientes'
        case 'dividendYield':
          return result.currentYield 
            ? `DY Atual: ${(result.currentYield * 100).toFixed(2)}%`
            : 'Dados insuficientes'
        case 'lowPE':
          return result.currentPE 
            ? `P/L Atual: ${result.currentPE.toFixed(1)}`
            : 'Dados insuficientes'
        case 'magicFormula':
          return result.score 
            ? `Score: ${result.score.toFixed(1)}`
            : 'Dados insuficientes'
        default:
          return 'Análise realizada'
      }
    }

    return (
      <div className="mb-6">
        <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center">
          <Sparkles className="w-4 h-4 mr-2" />
          Análises Estratégicas Aplicadas
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(strategicAnalyses).map(([strategy, result]) => {
            const status = getStrategyStatus(result)
            const label = strategyLabels[strategy] || strategy
            const description = getStrategyDescription(strategy, result)

            return (
              <div key={strategy} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStrategyIcon(status)}
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
                <Badge 
                  variant={status === 'success' ? 'default' : status === 'warning' ? 'secondary' : 'destructive'}
                  className="text-xs"
                >
                  {result.eligible ? 'Elegível' : result.error ? 'Erro' : 'Filtrado'}
                </Badge>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center space-x-3">
          <Brain className="w-6 h-6 text-purple-600" />
          <span>Análise com Inteligência Artificial</span>
          <Badge variant="secondary" className="ml-auto">
            Gemini AI
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Botão para gerar análise */}
        {!analysis && !isLoading && (
          <div className="text-center py-8">
            <Brain className="w-16 h-16 text-purple-600 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2 flex items-center justify-center">
              Análise Fundamentalista com IA
              <Crown className="w-5 h-5 ml-2 text-yellow-500" />
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Nossa IA irá analisar {name} ({ticker}) usando múltiplos modelos de valuation, 
              indicadores fundamentalistas, análise de demonstrativos financeiros e informações recentes da internet.
            </p>
            
            {userIsPremium ? (
              <Button 
                onClick={generateAnalysis}
                size="lg"
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Gerar Análise com IA
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Lock className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-yellow-800 dark:text-yellow-200">
                      Recurso Premium
                    </span>
                  </div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 text-center">
                    A análise por IA com demonstrativos financeiros está disponível apenas para usuários Premium.
                  </p>
                </div>
                <Button asChild size="lg" className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white">
                  <Link href="/dashboard">
                    <Crown className="w-5 h-5 mr-2" />
                    Fazer Upgrade Premium
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Estado de carregamento */}
        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Gerando análise... {reviewAttempts > 0 && `(Tentativa ${reviewAttempts}/3)`}
            </h3>
            <p className="text-muted-foreground">
              Nossa IA está analisando {name} com demonstrativos financeiros e buscando informações recentes na internet. 
              Isso pode levar alguns segundos.
            </p>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                <span>Analisando indicadores financeiros</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse delay-75"></div>
                <span>Analisando demonstrativos financeiros</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse delay-150"></div>
                <span>Aplicando modelos de valuation</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse delay-200"></div>
                <span>Buscando notícias recentes</span>
              </div>
              {reviewAttempts > 0 && (
                <div className="flex items-center justify-center space-x-2 mt-4 p-2 bg-blue-50 dark:bg-blue-950 rounded">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse delay-300"></div>
                  <span className="text-blue-700 dark:text-blue-300">Revisando qualidade do relatório...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2 text-red-600">
              Erro ao gerar análise
            </h3>
            <p className="text-muted-foreground mb-6">
              {error}
            </p>
            <Button 
              onClick={generateAnalysis}
              variant="outline"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Análise gerada */}
        {analysis && (
          <div>
            {/* Análises estratégicas resumo */}
            {renderStrategicAnalyses()}

            {/* Análise detalhada da IA */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <Brain className="w-5 h-5 mr-2 text-purple-600" />
                  Análise Detalhada
                </h3>
                <Button 
                  onClick={generateAnalysis}
                  variant="ghost"
                  size="sm"
                  disabled={isLoading}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Regenerar
                </Button>
              </div>
              
              {/* Renderizar markdown */}
              <div className="prose prose-gray dark:prose-invert max-w-none">
                <MarkdownRenderer content={analysis} />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
